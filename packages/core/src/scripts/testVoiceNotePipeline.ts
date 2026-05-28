/**
 * Test pipeline note vocale — simulation transcription + intention + hydratation optionnelle.
 *
 * Usage :
 *   npx tsx packages/core/src/scripts/testVoiceNotePipeline.ts
 *   npx tsx packages/core/src/scripts/testVoiceNotePipeline.ts --gemini
 *   npx tsx packages/core/src/scripts/testVoiceNotePipeline.ts --gemini --hydrate --residence-id=XXX --broker-id=UID --org-id=org_XXX
 */

import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseVoiceIntentJson, suggestedDateToMillis } from '../ai/voiceParser.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '../../../..');

const SAMPLE_TRANSCRIPT =
  'Visite complétée, Tremblay veut une baisse de prix pour la toiture, planifier un suivi ce vendredi';

function parseArgv(argv: string[]) {
  return {
    gemini: argv.includes('--gemini'),
    hydrate: argv.includes('--hydrate'),
    residenceId: argv.find((a) => a.startsWith('--residence-id='))?.slice('--residence-id='.length)?.trim(),
    brokerId: argv.find((a) => a.startsWith('--broker-id='))?.slice('--broker-id='.length)?.trim(),
    orgId: argv.find((a) => a.startsWith('--org-id='))?.slice('--org-id='.length)?.trim(),
  };
}

function nextFridayFromReference(refYmd: string): string {
  const [y, m, d] = refYmd.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const dow = date.getDay();
  const add = dow <= 5 ? 5 - dow : 5 - dow + 7;
  date.setDate(date.getDate() + add);
  const yy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

async function runGeminiIntent(transcript: string): Promise<ReturnType<typeof parseVoiceIntentJson>> {
  const functionsDir = resolve(ROOT, 'functions');
  process.chdir(functionsDir);
  const { analyzeVoiceIntentWithGemini } = await import(
    '../../../functions/src/audio/analyzeVoiceIntent.ts'
  );
  const ref = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Toronto' });
  return analyzeVoiceIntentWithGemini(transcript, ref);
}

async function hydrateResidence(
  residenceId: string,
  brokerId: string,
  intent: NonNullable<ReturnType<typeof parseVoiceIntentJson>>,
  rawTranscript: string
) {
  const saPath = resolve(ROOT, 'serviceAccountNew.json');
  if (!existsSync(saPath)) throw new Error('serviceAccountNew.json requis pour --hydrate');
  const { cert, initializeApp, getApps, deleteApp } = await import('firebase-admin/app');
  const { getFirestore, FieldValue } = await import('firebase-admin/firestore');
  const sa = JSON.parse(readFileSync(saPath, 'utf8'));
  while (getApps().length) await deleteApp(getApps()[0]);
  const app = initializeApp({ credential: cert(sa) });
  const db = getFirestore(app, 'ai-studio-1214d671-efd2-47da-93b7-425feb92155a');
  const uploadId = `test-${Date.now()}`;
  const now = FieldValue.serverTimestamp();
  const dueAtMillis = suggestedDateToMillis(intent.suggestedDate);

  const noteRef = await db.collection('residences').doc(residenceId).collection('notes').add({
    text: intent.cleanText,
    authorId: brokerId,
    authorName: 'Test pipeline vocal',
    createdAt: now,
    source: 'voice',
    voiceUploadId: uploadId,
    hasActionItem: intent.hasActionItem,
    updatedAt: now,
  });

  let taskId: string | undefined;
  if (intent.hasActionItem && intent.taskDescription) {
    const taskRef = await db.collection('residences').doc(residenceId).collection('tasks').add({
      title: intent.taskDescription,
      description: intent.cleanText,
      dueAtMillis: dueAtMillis > 0 ? dueAtMillis : 0,
      kind: 'task',
      status: 'a_faire',
      authorId: brokerId,
      authorName: 'Test pipeline vocal',
      createdAt: now,
      source: 'voice_intent',
      voiceUploadId: uploadId,
      updatedAt: now,
    });
    taskId = taskRef.id;
  }

  await deleteApp(app);
  return { noteId: noteRef.id, taskId, dueAtMillis };
}

async function main() {
  const opts = parseArgv(process.argv.slice(2));
  const ref = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Toronto' });
  console.log('\n=== Test pipeline note vocale ===');
  console.log('Transcription simulée :', SAMPLE_TRANSCRIPT);
  console.log('Date de référence (Montréal) :', ref);

  let intent: ReturnType<typeof parseVoiceIntentJson>;

  if (opts.gemini) {
    console.log('\n— Analyse Gemini (Vertex) —');
    intent = await runGeminiIntent(SAMPLE_TRANSCRIPT);
    if (!intent) throw new Error('Gemini: parse échoué');
  } else {
    console.log('\n— Mode simulation (JSON attendu, sans appel API) —');
    const mockJson = JSON.stringify({
      cleanText:
        'Visite complétée. M. Tremblay souhaite une baisse de prix liée à la toiture. Suivi à planifier pour ce vendredi.',
      hasActionItem: true,
      taskDescription: 'Planifier un suivi avec Tremblay (toiture / baisse de prix)',
      suggestedDate: nextFridayFromReference(ref),
    });
    intent = parseVoiceIntentJson(mockJson);
    if (!intent) throw new Error('Parse mock échoué');
  }

  console.log('\nRésultat intention :');
  console.log(JSON.stringify(intent, null, 2));

  const dueMs = suggestedDateToMillis(intent.suggestedDate);
  if (intent.hasActionItem) {
    if (!intent.taskDescription) throw new Error('hasActionItem sans taskDescription');
    if (!intent.suggestedDate) console.warn('⚠ suggestedDate vide — tâche sans échéance');
    else {
      console.log('Échéance tâche :', intent.suggestedDate, '→', new Date(dueMs).toISOString());
      const expectedFriday = nextFridayFromReference(ref);
      if (intent.suggestedDate !== expectedFriday) {
        console.warn(`⚠ Date suggérée ${intent.suggestedDate} ≠ vendredi calculé ${expectedFriday}`);
      } else {
        console.log('✓ Date vendredi cohérente');
      }
    }
  }

  if (opts.hydrate) {
    if (!opts.residenceId || !opts.brokerId) {
      throw new Error('--hydrate requiert --residence-id et --broker-id');
    }
    console.log('\n— Hydratation Firestore —');
    const result = await hydrateResidence(opts.residenceId, opts.brokerId, intent, SAMPLE_TRANSCRIPT);
    console.log('Note créée :', result.noteId);
    if (result.taskId) console.log('Tâche créée :', result.taskId, 'dueAtMillis=', result.dueAtMillis);
    else console.warn('Aucune tâche créée');
  }

  console.log('\n✅ Test terminé');
  if (!opts.gemini) {
    console.log('Relancez avec --gemini pour valider Vertex, --hydrate pour écrire en base.');
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
