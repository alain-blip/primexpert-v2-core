/**
 * Moteur de fermeture (closing) — génération déterministe des tâches post-acceptation PA.
 * Étape 4 V2.7 — persistance via port injecté (Firestore Admin / client).
 */

import { addCalendarDays } from '../transaction/promesseAchatEngine';

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const MONTREAL_OFFSET_WINTER = '-05:00';

export const CLOSING_TASK_CODES = [
  'CLOSING_RPA_DOSSIER_HYPOTHEQUE',
  'CLOSING_SUIVI_INSPECTION',
  'CLOSING_ENVOI_NOTAIRE',
] as const;

export type ClosingTaskCode = (typeof CLOSING_TASK_CODES)[number];

/** Brouillon tâche — aligné `residences/{id}/tasks` (UI + hydrateVoiceNote). */
export interface ClosingSequenceTaskDraft {
  title: string;
  description: string;
  dueAtMillis: number;
  status: 'a_faire';
  kind: 'task';
  source: 'closing_pipeline';
  closingPackId: string;
  closingTaskCode: ClosingTaskCode;
  priority: 'high' | 'normal';
  authorId: string;
  authorName?: string;
  orgId: string;
  requiresManualDate?: boolean;
}

export interface ClosingPromesseContext {
  residenceId: string;
  orgId: string;
  brokerId: string;
  brokerName?: string;
  dateAcceptation: string;
  dateNotairePrevue?: string;
  dateLimiteInspection?: string;
}

export interface ClosingEnginePort {
  loadPromesseContext(
    residenceId: string,
    orgId: string
  ): Promise<ClosingPromesseContext | null>;
  hasClosingPack(residenceId: string, closingPackId: string): Promise<boolean>;
  persistClosingTasks(
    residenceId: string,
    tasks: readonly ClosingSequenceTaskDraft[]
  ): Promise<void>;
  markClosingPackComplete(residenceId: string, closingPackId: string): Promise<void>;
}

let closingEnginePort: ClosingEnginePort | undefined;
const simulatedTasksByResidence = new Map<string, ClosingSequenceTaskDraft[]>();
const simulatedPacks = new Set<string>();

export function configureClosingEnginePort(port: ClosingEnginePort): void {
  closingEnginePort = port;
}

/** Tâches simulées en mémoire (tests / dev sans Firestore). */
export function drainSimulatedClosingTasks(residenceId: string): ClosingSequenceTaskDraft[] {
  const copy = [...(simulatedTasksByResidence.get(residenceId) ?? [])];
  simulatedTasksByResidence.delete(residenceId);
  return copy;
}

function montrealDueAtMillis(isoDate: string | undefined, hour = 9): number {
  if (!isoDate?.trim()) return 0;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(isoDate.trim());
  if (!m) return 0;
  const hh = String(hour).padStart(2, '0');
  const d = new Date(`${m[1]}-${m[2]}-${m[3]}T${hh}:00:00${MONTREAL_OFFSET_WINTER}`);
  return Number.isNaN(d.getTime()) ? 0 : d.getTime();
}

function subtractCalendarDays(isoDate: string, days: number): string | undefined {
  const base = new Date(`${isoDate.slice(0, 10)}T12:00:00`);
  if (Number.isNaN(base.getTime())) return undefined;
  base.setTime(base.getTime() - Math.round(days) * MS_PER_DAY);
  const y = base.getFullYear();
  const mo = String(base.getMonth() + 1).padStart(2, '0');
  const da = String(base.getDate()).padStart(2, '0');
  return `${y}-${mo}-${da}`;
}

export function buildClosingPackId(
  residenceId: string,
  dateAcceptation: string
): string {
  const seed = `${residenceId}__${dateAcceptation.slice(0, 10)}`;
  let h = 5381;
  for (let i = 0; i < seed.length; i++) {
    h = ((h << 5) + h) ^ seed.charCodeAt(i);
  }
  return `closing_${(h >>> 0).toString(36)}`;
}

/**
 * Calcule les 3 tâches de fermeture (pur — sans I/O).
 */
export function buildClosingSequenceTaskDrafts(
  ctx: ClosingPromesseContext
): ClosingSequenceTaskDraft[] {
  const dateAcceptation = ctx.dateAcceptation.slice(0, 10);
  const closingPackId = buildClosingPackId(ctx.residenceId, dateAcceptation);
  const authorId = ctx.brokerId;
  const authorName = ctx.brokerName;
  const orgId = ctx.orgId;

  const j1Iso = addCalendarDays(dateAcceptation, 1);
  const j2Iso = addCalendarDays(dateAcceptation, 2);

  let notaireIso: string | undefined;
  let requiresManualDate = false;
  if (ctx.dateNotairePrevue?.trim()) {
    notaireIso = subtractCalendarDays(ctx.dateNotairePrevue.slice(0, 10), 10);
  } else {
    notaireIso = addCalendarDays(dateAcceptation, 30);
    requiresManualDate = true;
  }

  const inspectionNote = ctx.dateLimiteInspection
    ? `Date limite inspection (PA) : ${ctx.dateLimiteInspection.slice(0, 10)}.`
    : 'Confirmer la date limite d\'inspection dans la promesse d\'achat.';

  return [
    {
      title: 'Dossier courtier hypothécaire — exploitation RPA',
      description: [
        'Acheminer au courtier hypothécaire le dossier d\'exploitation : baux, états financiers, rapports CISSS, liste des locataires.',
        `Acceptation PA : ${dateAcceptation}.`,
      ].join('\n'),
      dueAtMillis: montrealDueAtMillis(j1Iso, 9),
      status: 'a_faire',
      kind: 'task',
      source: 'closing_pipeline',
      closingPackId,
      closingTaskCode: 'CLOSING_RPA_DOSSIER_HYPOTHEQUE',
      priority: 'high',
      authorId,
      authorName,
      orgId,
    },
    {
      title: 'Suivi inspection — levée condition bâtiment',
      description: [
        'Suivre la levée de la condition d\'inspection en bâtiment et relancer les parties si nécessaire.',
        inspectionNote,
      ].join('\n'),
      dueAtMillis: montrealDueAtMillis(j2Iso, 9),
      status: 'a_faire',
      kind: 'task',
      source: 'closing_pipeline',
      closingPackId,
      closingTaskCode: 'CLOSING_SUIVI_INSPECTION',
      priority: 'high',
      authorId,
      authorName,
      orgId,
    },
    {
      title: 'Envoi notaire — dossier d\'achat complet',
      description: [
        'Préparer et transmettre au notaire instrumentant le dossier d\'achat complet (titres, PA acceptée, déclarations, financement).',
        requiresManualDate
          ? 'Date de clôture notariale non confirmée — échéance provisoire (J+30).'
          : `Clôture notariale prévue : ${ctx.dateNotairePrevue?.slice(0, 10)}.`,
      ].join('\n'),
      dueAtMillis: montrealDueAtMillis(notaireIso, 9),
      status: 'a_faire',
      kind: 'task',
      source: 'closing_pipeline',
      closingPackId,
      closingTaskCode: 'CLOSING_ENVOI_NOTAIRE',
      priority: 'high',
      authorId,
      authorName,
      orgId,
      requiresManualDate,
    },
  ];
}

async function defaultSimulatedPort(): Promise<ClosingEnginePort> {
  return {
    async loadPromesseContext(residenceId, orgId) {
      return {
        residenceId,
        orgId,
        brokerId: 'simulated-broker',
        dateAcceptation: new Date().toISOString().slice(0, 10),
      };
    },
    async hasClosingPack(residenceId, closingPackId) {
      return simulatedPacks.has(`${residenceId}__${closingPackId}`);
    },
    async persistClosingTasks(residenceId, tasks) {
      simulatedTasksByResidence.set(residenceId, [...tasks]);
    },
    async markClosingPackComplete(residenceId, closingPackId) {
      simulatedPacks.add(`${residenceId}__${closingPackId}`);
    },
  };
}

/**
 * Génère et injecte la séquence de fermeture (3 tâches) pour une PA acceptée.
 * Idempotent via `closingPackId` — ne régénère pas si le pack existe déjà.
 */
export async function generateClosingSequenceTasks(
  residenceId: string,
  orgId: string
): Promise<void> {
  const rid = String(residenceId ?? '').trim();
  const oid = String(orgId ?? '').trim();
  if (!rid || !oid) {
    throw new Error('residenceId et orgId requis pour generateClosingSequenceTasks.');
  }

  const port = closingEnginePort ?? (await defaultSimulatedPort());
  const ctx = await port.loadPromesseContext(rid, oid);
  if (!ctx?.dateAcceptation?.trim()) {
    throw new Error(
      'Contexte promesse incomplet : dateAcceptation requise (promesseAchat.statut accepted).'
    );
  }

  const tasks = buildClosingSequenceTaskDrafts(ctx);
  const closingPackId = tasks[0]?.closingPackId;
  if (!closingPackId) {
    throw new Error('Impossible de calculer closingPackId.');
  }

  if (await port.hasClosingPack(rid, closingPackId)) {
    return;
  }

  await port.persistClosingTasks(rid, tasks);
  await port.markClosingPackComplete(rid, closingPackId);
}
