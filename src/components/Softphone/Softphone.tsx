/**
 * Softphone.tsx — V2 Lite (Phase D-2.C-lite "Auto")
 *
 * Brief « SYSTÈME SILOS 2026 v4 » D-2 :
 *   « Click-to-Call Natif (tel:) + MediaRecorder + Auto-Push Drive »
 *
 * Workflow Zéro Clic (validé par Alain le 2026-05-14) :
 *   1. Sélection de la résidence active (sélecteur en haut)
 *   2. Composition du numéro (clavier ou input direct)
 *   3. Bouton "Appeler & Enregistrer" :
 *      a. Demande permission micro (getUserMedia)
 *      b. Démarre MediaRecorder (audio/webm)
 *      c. Ouvre tel:+1XXX (l'app système prend le relais pour le PSTN)
 *      d. Affiche overlay REC + chrono
 *   4. Bouton "Arrêter & Sauvegarder" :
 *      a. Stop le MediaRecorder
 *      b. Upload du Blob via driveStorage.uploadDriveRecording()
 *      c. Atterrit dans Drive > [Résidence] > recordings/Appel_2026-05-14T18-05.webm
 *      d. Métadonnée Firestore enrichie (documentType: 'recording', durationMs, dialedNumber)
 *
 * Conformité OACIQ §IV :
 *   - Bandeau "Annoncer verbalement l'enregistrement" affiché en permanence
 *   - Pas de robot, pas d'auto-dialer — c'est le courtier qui pilote
 *
 * Limitations connues D-2.C-lite (vs softphone Twilio complet) :
 *   - Le tel: deeplink ouvre l'app système (Mac/iPhone) — pas le navigateur
 *   - MediaRecorder capte UNIQUEMENT le micro local (la voix d'Alain)
 *     → pour capter aussi l'interlocuteur, il faudra passer en D-2.C complète
 *       (Twilio Voice SDK + Cloud Run dans primexpert-app)
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Phone, PhoneCall, PhoneOff, Mic, MicOff, Delete,
  ShieldCheck, BadgeAlert, Sparkles, Home, Loader2, CheckCircle2, AlertCircle,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useLanguage } from '../../lib/i18n';
import { useAuth } from '../../lib/auth';
import { listResidences, type Residence } from '../../services/residences';
import { uploadDriveRecording, type DriveDocument } from '../../services/driveStorage';

const KEYPAD = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  ['*', '0', '#'],
];

const PREFERRED_MIME_TYPES = [
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/mp4',
  'audio/ogg',
];

function pickSupportedMimeType(): string | undefined {
  if (typeof MediaRecorder === 'undefined') return undefined;
  return PREFERRED_MIME_TYPES.find((t) => MediaRecorder.isTypeSupported(t));
}

function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function buildTelHref(raw: string): string {
  const digits = raw.replace(/[^0-9+*#]/g, '');
  return `tel:${digits}`;
}

type RecordingState = 'idle' | 'requesting' | 'recording' | 'uploading' | 'saved' | 'error';

export function Softphone() {
  const { t } = useLanguage();
  const { profile } = useAuth();
  const brokerId = profile?.uid;

  const [number, setNumber] = useState('');
  const [residences, setResidences] = useState<Residence[]>([]);
  const [selectedResidenceId, setSelectedResidenceId] = useState<string>('');
  const [residencesLoading, setResidencesLoading] = useState(false);

  const [state, setState] = useState<RecordingState>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [lastSaved, setLastSaved] = useState<DriveDocument | null>(null);

  // Refs pour MediaRecorder (pas de re-render à chaque chunk)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startTsRef = useRef<number>(0);
  const tickerRef = useRef<number | null>(null);

  // Charger les résidences au mount
  useEffect(() => {
    if (!brokerId) return;
    let cancelled = false;
    setResidencesLoading(true);
    listResidences({ tenantId: brokerId, mode: 'strict' })
      .then((rows) => {
        if (!cancelled) setResidences(rows);
      })
      .catch((e) => {
        console.error('[Softphone] residences load failed', e);
      })
      .finally(() => {
        if (!cancelled) setResidencesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [brokerId]);

  // Cleanup au démontage
  useEffect(() => {
    return () => {
      if (tickerRef.current !== null) {
        window.clearInterval(tickerRef.current);
      }
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((tr) => tr.stop());
      }
    };
  }, []);

  const append = (digit: string) => setNumber((prev) => (prev + digit).slice(0, 18));
  const backspace = () => setNumber((prev) => prev.slice(0, -1));
  const clear = () => setNumber('');

  // ==========================================================================
  // CŒUR D-2 — Démarre l'appel + l'enregistrement en parallèle
  // ==========================================================================
  const handleCallAndRecord = useCallback(async () => {
    setErrorMsg(null);
    setLastSaved(null);

    if (!number) {
      setErrorMsg(t('Numéro requis.', 'Number required.'));
      return;
    }
    if (!selectedResidenceId) {
      setErrorMsg(t('Sélectionne une résidence (obligatoire pour archiver).', 'Select a residence (required to archive).'));
      return;
    }

    setState('requesting');

    try {
      // 1. Permission micro
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;

      // 2. MediaRecorder
      const mimeType = pickSupportedMimeType();
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (evt) => {
        if (evt.data && evt.data.size > 0) {
          chunksRef.current.push(evt.data);
        }
      };

      recorder.start(1000); // chunk toutes les secondes pour résilience
      startTsRef.current = Date.now();
      setElapsedMs(0);
      setState('recording');

      // 3. Chrono
      tickerRef.current = window.setInterval(() => {
        setElapsedMs(Date.now() - startTsRef.current);
      }, 250);

      // 4. tel: deeplink (l'app système prend le relais)
      window.location.href = buildTelHref(number);
    } catch (e) {
      console.error('[Softphone] getUserMedia/MediaRecorder failed', e);
      setErrorMsg(
        e instanceof Error && e.name === 'NotAllowedError'
          ? t("Micro bloqué — autorise l'accès au micro pour enregistrer.", 'Mic blocked — allow microphone access to record.')
          : e instanceof Error ? e.message : String(e)
      );
      setState('error');
    }
  }, [number, selectedResidenceId, t]);

  // ==========================================================================
  // Stop + Upload vers Drive
  // ==========================================================================
  const handleStopAndSave = useCallback(async () => {
    if (state !== 'recording' || !mediaRecorderRef.current || !brokerId) return;

    const recorder = mediaRecorderRef.current;
    const durationMs = Date.now() - startTsRef.current;

    // Stop le ticker
    if (tickerRef.current !== null) {
      window.clearInterval(tickerRef.current);
      tickerRef.current = null;
    }

    setState('uploading');

    // Attendre le dernier chunk via une promesse sur 'stop'
    await new Promise<void>((resolve) => {
      recorder.onstop = () => resolve();
      try {
        recorder.stop();
      } catch (e) {
        console.warn('[Softphone] recorder.stop() error', e);
        resolve();
      }
    });

    // Libérer le micro
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((tr) => tr.stop());
      mediaStreamRef.current = null;
    }

    // Reconstituer le Blob
    const mimeType = recorder.mimeType || 'audio/webm';
    const blob = new Blob(chunksRef.current, { type: mimeType });
    chunksRef.current = [];

    try {
      const saved = await uploadDriveRecording({
        blob,
        residenceId: selectedResidenceId,
        durationMs,
        dialedNumber: number,
        ctx: { tenantId: brokerId, mode: 'strict' },
      });
      setLastSaved(saved);
      setState('saved');
      setElapsedMs(0);
    } catch (e) {
      console.error('[Softphone] upload failed', e);
      setErrorMsg(e instanceof Error ? e.message : String(e));
      setState('error');
    }
  }, [state, brokerId, selectedResidenceId, number]);

  // Cancel pendant requesting/recording (sans sauvegarder)
  const handleCancelRecording = useCallback(() => {
    if (tickerRef.current !== null) {
      window.clearInterval(tickerRef.current);
      tickerRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try { mediaRecorderRef.current.stop(); } catch {/* noop */}
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((tr) => tr.stop());
      mediaStreamRef.current = null;
    }
    chunksRef.current = [];
    setElapsedMs(0);
    setState('idle');
  }, []);

  const selectedResidence = residences.find((r) => r.id === selectedResidenceId);

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div className="bg-vault text-white p-10 rounded-[40px] shadow-2xl relative overflow-hidden border border-white/10">
        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500 rounded-full blur-[100px] opacity-20 pointer-events-none" />
        <div className="relative z-10 flex items-start justify-between">
          <div>
            <p className="text-blue-400 text-[10px] font-black uppercase tracking-[0.2em] mb-1">
              {t('Phase D-2.C-lite · Direct Drive Auto', 'Phase D-2.C-lite · Direct Drive Auto')}
            </p>
            <h2 className="text-4xl font-black italic tracking-tighter uppercase">
              {t('Softphone', 'Softphone')}
              <span className="text-blue-500">.V2_LITE</span>
            </h2>
            <p className="mt-3 text-[12px] font-semibold text-blue-200/80 max-w-xl">
              {t(
                "Click-to-call (tel:) + MediaRecorder navigateur. Aucun robot. C'est toi qui pilotes.",
                'Click-to-call (tel:) + browser MediaRecorder. No robots. You stay in control.'
              )}
            </p>
          </div>
          <div className="flex items-center gap-2 rounded-2xl bg-emerald-500/20 border border-emerald-400/30 px-3 py-1.5">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-200" />
            <span className="text-[9px] font-black uppercase tracking-widest text-emerald-100 font-mono">
              brokerId · {brokerId?.slice(0, 8) ?? '—'}
            </span>
          </div>
        </div>
      </div>

      {/* Sélecteur résidence — OBLIGATOIRE pour archiver */}
      <div className="rounded-2xl border border-white/10 bg-vault px-5 py-4 flex items-center gap-3">
        <Home className="h-4 w-4 text-blue-400 shrink-0" />
        <div className="flex-1 min-w-0">
          <span className="block text-[10px] font-black uppercase tracking-widest text-slate-500">
            {t('Résidence rattachée (obligatoire)', 'Attached residence (required)')}
          </span>
          <select
            value={selectedResidenceId}
            onChange={(e) => setSelectedResidenceId(e.target.value)}
            disabled={state === 'recording' || state === 'uploading' || state === 'requesting'}
            className="mt-1.5 w-full text-[12px] font-bold bg-transparent border-b border-white/10 py-1.5 focus:outline-none focus:border-blue-500 disabled:opacity-50"
          >
            <option value="">— {residencesLoading ? t('Chargement…', 'Loading…') : t('Choisis une résidence', 'Pick a residence')} —</option>
            {residences.map((r) => (
              <option key={r.id} value={r.id}>
                {r.address} · {r.city}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Dialer */}
      <div className="rounded-[32px] border border-white/10 bg-vault p-10 shadow-[0_24px_70px_rgba(15,23,42,0.08)] relative">
        {/* Overlay REC */}
        <AnimatePresence>
          {state === 'recording' && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="absolute top-4 right-4 flex items-center gap-2 rounded-full bg-red-500/[0.08] border border-red-300 px-3 py-1.5"
            >
              <motion.span
                animate={{ opacity: [1, 0.2, 1] }}
                transition={{ repeat: Infinity, duration: 1.2 }}
                className="block h-2.5 w-2.5 rounded-full bg-red-600"
              />
              <span className="text-[10px] font-black uppercase tracking-widest text-red-300 font-mono">
                REC · {formatDuration(elapsedMs)}
              </span>
            </motion.div>
          )}
        </AnimatePresence>

        <label className="block">
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">
            {t('Numéro à composer', 'Number to dial')}
          </span>
          <input
            value={number}
            onChange={(e) => setNumber(e.target.value)}
            placeholder="+1 (514) ..."
            disabled={state === 'recording' || state === 'uploading' || state === 'requesting'}
            className="mt-2 w-full text-4xl font-black tracking-tight bg-transparent border-b-2 border-white/10 py-3 focus:outline-none focus:border-blue-600 disabled:opacity-60"
          />
        </label>

        <div className="mt-8 grid grid-cols-3 gap-3 max-w-md mx-auto">
          {KEYPAD.flat().map((digit) => (
            <button
              key={digit}
              type="button"
              onClick={() => append(digit)}
              disabled={state === 'recording' || state === 'uploading' || state === 'requesting'}
              className="aspect-square rounded-2xl bg-white/[0.03] hover:bg-blue-500/10 active:bg-blue-500/15 border border-white/10 hover:border-blue-300 text-2xl font-black italic tracking-tight text-slate-100 transition disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {digit}
            </button>
          ))}
        </div>

        <div className="mt-6 flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={backspace}
            disabled={!number || state === 'recording' || state === 'uploading'}
            className="flex items-center gap-2 rounded-2xl border border-white/10 bg-vault px-5 py-3 text-[10px] font-black uppercase tracking-widest text-slate-300 hover:border-slate-400 disabled:opacity-30 transition"
          >
            <Delete className="h-3.5 w-3.5" />
            {t('Effacer', 'Backspace')}
          </button>
          <button
            type="button"
            onClick={clear}
            disabled={!number || state === 'recording' || state === 'uploading'}
            className="rounded-2xl border border-white/10 bg-vault px-5 py-3 text-[10px] font-black uppercase tracking-widest text-slate-300 hover:border-slate-400 disabled:opacity-30 transition"
          >
            {t('Réinitialiser', 'Clear')}
          </button>
        </div>

        {/* Action buttons */}
        <div className="mt-8 grid grid-cols-2 gap-4">
          {state === 'idle' || state === 'saved' || state === 'error' ? (
            <>
              <button
                type="button"
                onClick={handleCallAndRecord}
                disabled={!number || !selectedResidenceId}
                className="flex items-center justify-center gap-3 rounded-2xl bg-emerald-600 px-6 py-5 text-white text-[11px] font-black uppercase tracking-[0.2em] hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed transition active:scale-95"
              >
                <PhoneCall className="h-4 w-4" />
                {t('Appeler & Enregistrer', 'Call & Record')}
              </button>
              <a
                href={number ? buildTelHref(number) : undefined}
                aria-disabled={!number}
                onClick={(e) => { if (!number) e.preventDefault(); }}
                className={`flex items-center justify-center gap-3 rounded-2xl border-2 border-white/10 bg-vault px-6 py-5 text-slate-300 text-[11px] font-black uppercase tracking-[0.2em] hover:border-blue-300 hover:text-blue-300 transition ${!number ? 'opacity-40 cursor-not-allowed' : ''}`}
              >
                <Phone className="h-4 w-4" />
                {t('Appeler (sans rec.)', 'Call (no rec.)')}
              </a>
            </>
          ) : state === 'requesting' ? (
            <div className="col-span-2 flex items-center justify-center gap-3 rounded-2xl bg-blue-500/10 px-6 py-5 text-blue-300 text-[11px] font-black uppercase tracking-[0.2em] border border-blue-400/30">
              <Loader2 className="h-4 w-4 animate-spin" />
              {t("Demande d'accès au micro…", 'Requesting microphone access…')}
            </div>
          ) : state === 'recording' ? (
            <>
              <button
                type="button"
                onClick={handleStopAndSave}
                className="flex items-center justify-center gap-3 rounded-2xl bg-red-600 px-6 py-5 text-white text-[11px] font-black uppercase tracking-[0.2em] hover:bg-red-700 transition active:scale-95"
              >
                <MicOff className="h-4 w-4" />
                {t('Arrêter & Sauvegarder', 'Stop & Save')}
              </button>
              <button
                type="button"
                onClick={handleCancelRecording}
                className="flex items-center justify-center gap-3 rounded-2xl border-2 border-white/10 bg-vault px-6 py-5 text-slate-300 text-[11px] font-black uppercase tracking-[0.2em] hover:border-red-300 hover:text-red-300 transition"
              >
                <PhoneOff className="h-4 w-4" />
                {t('Annuler', 'Cancel')}
              </button>
            </>
          ) : state === 'uploading' ? (
            <div className="col-span-2 flex items-center justify-center gap-3 rounded-2xl bg-blue-500/10 px-6 py-5 text-blue-300 text-[11px] font-black uppercase tracking-[0.2em] border border-blue-400/30">
              <Loader2 className="h-4 w-4 animate-spin" />
              {t('Envoi au Drive…', 'Uploading to Drive…')}
            </div>
          ) : null}
        </div>

        {/* Helper text */}
        {!selectedResidenceId && state === 'idle' && (
          <p className="mt-4 text-center text-[10px] font-bold uppercase tracking-widest text-slate-400">
            {t('Sélectionne une résidence pour activer l\'enregistrement', 'Select a residence to enable recording')}
          </p>
        )}
      </div>

      {/* Error banner */}
      {errorMsg && (
        <div className="flex items-start gap-3 rounded-2xl border border-red-400/30 bg-red-500/[0.08] px-5 py-4">
          <AlertCircle className="h-4 w-4 text-red-300 mt-0.5 shrink-0" />
          <p className="text-[12px] font-semibold text-red-300 leading-relaxed">{errorMsg}</p>
        </div>
      )}

      {/* Success banner */}
      {lastSaved && state === 'saved' && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-start gap-3 rounded-2xl border border-emerald-400/30 bg-emerald-500/[0.08] px-5 py-4"
        >
          <CheckCircle2 className="h-4 w-4 text-emerald-300 mt-0.5 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-emerald-300">
              {t('Enregistrement archivé dans le Drive', 'Recording archived in Drive')}
            </p>
            <p className="text-[12px] font-bold text-emerald-300 mt-1 truncate font-mono">
              {selectedResidence?.address ?? '—'} / recordings / {lastSaved.fileName}
            </p>
            <p className="text-[10px] font-semibold text-emerald-300 mt-0.5">
              {t('Durée', 'Duration')} · {formatDuration(lastSaved.durationMs ?? 0)} ·{' '}
              {(lastSaved.size / 1024).toFixed(1)} kB
            </p>
          </div>
        </motion.div>
      )}

      {/* Bandeau Compliance OACIQ — TOUJOURS VISIBLE pendant un recording */}
      <div className="rounded-[24px] border border-amber-300 bg-amber-500/[0.06] p-6">
        <div className="flex items-center gap-2">
          <BadgeAlert className="h-4 w-4 text-amber-400" />
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-amber-300">
            {t("OACIQ — Consentement à l'enregistrement OBLIGATOIRE", 'OACIQ — Recording consent MANDATORY')}
          </p>
        </div>
        <p className="mt-2 text-[12px] font-semibold text-amber-300 leading-relaxed">
          {t(
            "Avant d'appuyer sur « Appeler & Enregistrer », tu DOIS annoncer verbalement à ton interlocuteur que l'appel est enregistré. Le micro local capte uniquement TA voix — pour une captation bidirectionnelle, on passera en D-2.C complète (Twilio).",
            'Before pressing « Call & Record », you MUST verbally inform the other party that the call is being recorded. The local microphone captures ONLY your voice — for bidirectional capture, we will upgrade to D-2.C full (Twilio).'
          )}
        </p>
      </div>

      {/* Note technique */}
      <div className="rounded-[20px] border border-white/10 bg-white/[0.03] p-5 text-[11px] leading-relaxed text-slate-300">
        <p className="font-black uppercase tracking-widest text-[9px] text-slate-500 mb-2 flex items-center gap-1.5">
          <Sparkles className="h-3 w-3" />
          {t('Comment ça marche', 'How it works')}
        </p>
        <ol className="list-decimal list-inside space-y-1">
          <li>{t('Tu sélectionnes une résidence (obligatoire).', 'You select a residence (required).')}</li>
          <li>{t('Tu composes un numéro.', 'You enter a phone number.')}</li>
          <li>{t('Tu cliques « Appeler & Enregistrer ». Le navigateur demande le micro.', 'You click « Call & Record ». The browser asks for microphone access.')}</li>
          <li>{t('Ton app téléphone (Mac/iPhone) s\'ouvre et compose. Le micro capte en parallèle.', 'Your phone app (Mac/iPhone) opens and dials. The microphone records in parallel.')}</li>
          <li>{t('Tu cliques « Arrêter & Sauvegarder » à la fin. Le fichier .webm part vers le Drive.', 'You click « Stop & Save » at the end. The .webm file is uploaded to the Drive.')}</li>
        </ol>
      </div>
    </div>
  );
}
