/**
 * E-3 — Intelligence vocale : Whisper (optionnel) + analyse Gemini « courtier Québec ».
 *
 * Persistance : `users/{brokerId}/call_analyses/{driveDocumentId}` (liée à `residenceId`
 * pour rattachement fiche propriété — même esprit que `mailbox_analyses`).
 *
 * Stockage audio réel (V2) : `primexpert/{brokerId}/residences/{residenceId}/recordings/...`
 * (le brief « recordings/{residenceId} » est mappé sur ce chemin opérationnel.)
 */

import {
  collection,
  deleteField,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  where,
  type Unsubscribe,
} from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import type { RecordingTranscriptionJob } from '@primexpert/core/audio';
import { isValidRecordingTranscriptionJob } from '@primexpert/core/audio';
import { fetchStoragePathAsBase64 } from './driveStorage';
import {
  analyzeQuebecBrokerCallTranscript,
  transcribeAudioPlainTextWithGemini,
} from './gemini';

export const CALL_ANALYSES_SUBCOLLECTION = 'call_analyses';

export type CallPipelineStatus =
  | 'recorded'
  | 'transcribing'
  | 'analyzing'
  | 'analyzed'
  | 'failed';

export interface CallAnalysisRow {
  driveDocumentId: string;
  residenceId: string;
  fileName: string;
  pipelineStatus: CallPipelineStatus;
  transcriptionPlain?: string;
  executiveSummary?: string;
  commitments?: string[];
  clientProfile?: {
    needs?: string;
    budgetHint?: string;
    urgency?: string;
  };
  keyPoints?: string[];
  actionItems?: string[];
  clientSentiment?: string;
  updatedAtMillis: number;
  errorMessage?: string;
}

function callAnalysisRef(brokerId: string, driveDocumentId: string) {
  return doc(db, 'users', brokerId, CALL_ANALYSES_SUBCOLLECTION, driveDocumentId);
}

function base64ToBlob(base64: string, mime: string): Blob {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: mime || 'audio/webm' });
}

/**
 * Whisper OpenAI — excellent sur l’oral québécois ; clé optionnelle `VITE_OPENAI_API_KEY`.
 */
async function transcribeWithOpenAIWhisper(
  blob: Blob,
  locale: 'fr' | 'en'
): Promise<string> {
  const key = import.meta.env.VITE_OPENAI_API_KEY;
  if (!key || typeof key !== 'string') {
    throw new Error('VITE_OPENAI_API_KEY manquante');
  }
  const form = new FormData();
  form.append('file', blob, 'enregistrement.webm');
  form.append('model', 'whisper-1');
  form.append('language', locale === 'fr' ? 'fr' : 'en');
  form.append('response_format', 'json');

  const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}` },
    body: form,
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Whisper HTTP ${res.status}: ${errText.slice(0, 400)}`);
  }
  const json = (await res.json()) as { text?: string };
  return (json.text ?? '').trim();
}

function docToRow(driveDocumentId: string, data: Record<string, unknown>): CallAnalysisRow {
  const clientProfile =
    data.clientProfile && typeof data.clientProfile === 'object'
      ? (data.clientProfile as CallAnalysisRow['clientProfile'])
      : undefined;
  return {
    driveDocumentId,
    residenceId: String(data.residenceId ?? ''),
    fileName: String(data.fileName ?? ''),
    pipelineStatus: (data.pipelineStatus as CallPipelineStatus) ?? 'recorded',
    transcriptionPlain:
      typeof data.transcriptionPlain === 'string' ? data.transcriptionPlain : undefined,
    executiveSummary:
      typeof data.executiveSummary === 'string' ? data.executiveSummary : undefined,
    commitments: Array.isArray(data.commitments)
      ? data.commitments.filter((x): x is string => typeof x === 'string')
      : undefined,
    clientProfile,
    keyPoints: Array.isArray(data.keyPoints)
      ? data.keyPoints.filter((x): x is string => typeof x === 'string')
      : undefined,
    actionItems: Array.isArray(data.actionItems)
      ? data.actionItems.filter((x): x is string => typeof x === 'string')
      : undefined,
    clientSentiment:
      typeof data.clientSentiment === 'string' ? data.clientSentiment : undefined,
    updatedAtMillis:
      typeof data.updatedAtMillis === 'number' ? data.updatedAtMillis : 0,
    errorMessage: typeof data.errorMessage === 'string' ? data.errorMessage : undefined,
  };
}

/**
 * Crée / met à jour la ligne `call_analyses` après upload Drive (état 🎙️ Enregistré).
 */
export async function registerRecordedCallAnalysis(
  job: RecordingTranscriptionJob
): Promise<void> {
  if (!isValidRecordingTranscriptionJob(job)) return;
  const uid = auth.currentUser?.uid;
  if (!uid || uid !== job.brokerId) return;

  await setDoc(
    callAnalysisRef(job.brokerId, job.driveDocumentId),
    {
      driveDocumentId: job.driveDocumentId,
      residenceId: job.residenceId,
      storagePath: job.storagePath,
      fileName: job.fileName,
      mime: job.mime,
      durationMs: job.durationMs,
      dialedNumber: job.dialedNumber ?? null,
      locale: job.locale ?? 'fr',
      pipelineStatus: 'recorded' as CallPipelineStatus,
      updatedAtMillis: Date.now(),
    },
    { merge: true }
  );
}

/**
 * Pipeline complet : STT (Whisper si clé, sinon Gemini) → analyse métier Gemini.
 * Idempotent si déjà `analyzed` avec résumé exécutif.
 */
export async function runCallAnalysisPipeline(job: RecordingTranscriptionJob): Promise<void> {
  if (!isValidRecordingTranscriptionJob(job)) {
    console.warn('[E-3] job invalide', job);
    return;
  }

  const hasGemini = Boolean(import.meta.env.VITE_GEMINI_API_KEY);
  if (!hasGemini) {
    console.warn('[E-3] VITE_GEMINI_API_KEY absente — analyse métier impossible.');
    return;
  }

  const uid = auth.currentUser?.uid;
  if (!uid || uid !== job.brokerId) {
    console.warn('[E-3] session / brokerId invalides');
    return;
  }

  const ref = callAnalysisRef(job.brokerId, job.driveDocumentId);
  let snap;
  try {
    snap = await getDoc(ref);
  } catch (e) {
    console.error('[E-3] lecture call_analyses', e);
    return;
  }
  if (!snap.exists()) {
    console.warn('[E-3] doc call_analyses absent — enregistrer avant pipeline.');
    return;
  }

  const existing = snap.data();
  const exec = typeof existing.executiveSummary === 'string' ? existing.executiveSummary.trim() : '';
  if (existing.pipelineStatus === 'analyzed' && exec.length > 0) {
    if (import.meta.env.DEV) {
      console.info('[E-3] analyse déjà présente — skip jetons', job.driveDocumentId);
    }
    return;
  }

  const locale = (job.locale ?? 'fr') as 'fr' | 'en';
  const meta = {
    fileName: job.fileName,
    durationMs: job.durationMs,
    dialedNumber: job.dialedNumber,
  };

  try {
    await setDoc(
      ref,
      { pipelineStatus: 'transcribing' as CallPipelineStatus, updatedAtMillis: Date.now() },
      { merge: true }
    );

    const { data: base64, mime: detectedMime } = await fetchStoragePathAsBase64(job.storagePath);
    const mime = detectedMime || job.mime || 'audio/webm';

    let transcriptPlain = '';
    const hasOpenAI = Boolean(import.meta.env.VITE_OPENAI_API_KEY);
    if (hasOpenAI) {
      try {
        const blob = base64ToBlob(base64, mime);
        transcriptPlain = await transcribeWithOpenAIWhisper(blob, locale);
      } catch (wErr) {
        console.warn('[E-3] Whisper indisponible, repli Gemini STT', wErr);
        transcriptPlain = (
          await transcribeAudioPlainTextWithGemini({
            base64,
            mime,
            locale,
            meta,
          })
        ).transcriptPlain;
      }
    } else {
      transcriptPlain = (
        await transcribeAudioPlainTextWithGemini({
          base64,
          mime,
          locale,
          meta,
        })
      ).transcriptPlain;
    }

    await setDoc(
      ref,
      {
        transcriptionPlain: transcriptPlain,
        pipelineStatus: 'analyzing' as CallPipelineStatus,
        updatedAtMillis: Date.now(),
      },
      { merge: true }
    );

    const business = await analyzeQuebecBrokerCallTranscript({
      transcriptPlain,
      locale,
      meta,
    });

    await setDoc(
      ref,
      {
        pipelineStatus: 'analyzed' as CallPipelineStatus,
        executiveSummary: business.executiveSummary,
        commitments: business.commitments,
        clientProfile: business.clientProfile,
        keyPoints: business.keyPoints,
        actionItems: business.actionItems,
        clientSentiment: business.clientSentiment,
        analyzedAtMillis: Date.now(),
        updatedAtMillis: Date.now(),
        errorMessage: deleteField(),
      },
      { merge: true }
    );

    if (import.meta.env.DEV) {
      console.info('[E-3] call_analyses terminé', job.driveDocumentId);
    }
  } catch (e) {
    const msg = (e instanceof Error ? e.message : String(e)).slice(0, 2000);
    console.error('[E-3] pipeline échoué', job.driveDocumentId, e);
    try {
      await setDoc(
        ref,
        {
          pipelineStatus: 'failed' as CallPipelineStatus,
          errorMessage: msg,
          updatedAtMillis: Date.now(),
        },
        { merge: true }
      );
    } catch (persistErr) {
      console.error('[E-3] persistance failed impossible', persistErr);
    }
  }
}

/**
 * Enregistre la ligne Firestore puis lance le pipeline en arrière-plan.
 */
export async function startCallAnalysisAfterUpload(
  job: RecordingTranscriptionJob
): Promise<void> {
  if (!isValidRecordingTranscriptionJob(job)) return;
  try {
    await registerRecordedCallAnalysis(job);
  } catch (e) {
    console.error('[E-3] enregistrement call_analyses impossible', e);
    return;
  }
  void runCallAnalysisPipeline(job);
}

/** Abonnement temps réel pour la liste Softphone « Appels récents ». */
export function subscribeRecentCallAnalyses(
  brokerId: string,
  onUpdate: (rows: CallAnalysisRow[]) => void,
  onError?: (e: Error) => void
): Unsubscribe {
  const col = collection(db, 'users', brokerId, CALL_ANALYSES_SUBCOLLECTION);
  const q = query(col, orderBy('updatedAtMillis', 'desc'), limit(40));
  return onSnapshot(
    q,
    (snap) => {
      onUpdate(snap.docs.map((d) => docToRow(d.id, d.data() as Record<string, unknown>)));
    },
    (e) => {
      console.error('[E-3] subscribe call_analyses', e);
      onError?.(e instanceof Error ? e : new Error(String(e)));
    }
  );
}

/** Fiche résidence — `where(residenceId) + orderBy(updatedAtMillis)` (index composite requis). */
export function subscribeCallAnalysesForResidence(
  brokerId: string,
  residenceId: string,
  onUpdate: (rows: CallAnalysisRow[]) => void,
  onError?: (e: Error) => void
): Unsubscribe {
  const col = collection(db, 'users', brokerId, CALL_ANALYSES_SUBCOLLECTION);
  const q = query(
    col,
    where('residenceId', '==', residenceId),
    orderBy('updatedAtMillis', 'desc'),
    limit(25)
  );
  return onSnapshot(
    q,
    (snap) => {
      onUpdate(snap.docs.map((d) => docToRow(d.id, d.data() as Record<string, unknown>)));
    },
    (e) => {
      console.error('[E-3] subscribe call_analyses par résidence', e);
      onError?.(e instanceof Error ? e : new Error(String(e)));
    }
  );
}

/** Snapshot récent (E-4 — priorisation, sentiment, stagnation). */
export async function fetchRecentCallAnalyses(
  brokerId: string,
  limitN = 200
): Promise<CallAnalysisRow[]> {
  if (!brokerId) return [];
  try {
    const col = collection(db, 'users', brokerId, CALL_ANALYSES_SUBCOLLECTION);
    const q = query(col, orderBy('updatedAtMillis', 'desc'), limit(limitN));
    const snap = await getDocs(q);
    return snap.docs.map((d) => docToRow(d.id, d.data() as Record<string, unknown>));
  } catch (e) {
    console.error('[E-4] fetchRecentCallAnalyses', e);
    return [];
  }
}
