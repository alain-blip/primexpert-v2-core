/* eslint-disable */
/**
 * AUTO-GÉNÉRÉ — NE PAS MODIFIER.
 * Source : packages/core/src/crm/
 * Régénéré : functions/scripts/sync-core-crm.cjs (prebuild)
 */
type CommunicationChannel = 'email' | 'sms' | 'whatsapp' | 'messenger' | 'voice' | 'portal' | string;

export type HotLeadSignalType =
  | 'document_consultation'
  | 'financial_report_click'
  | 'sms_sent';

export interface HotLeadSignal {
  type: HotLeadSignalType;
  weight: number;
  occurredAtMillis?: number;
}

export interface HotLeadScoringInput {
  signals: readonly HotLeadSignal[];
  min?: number;
  max?: number;
}

export interface HotLeadScoringResult {
  score: number;
  breakdown: Record<HotLeadSignalType, number>;
}

export interface HotLeadMessageLike {
  id?: string;
  body?: string | null;
  summaryOneLine?: string | null;
  sentAtMillis?: number;
  channel?: CommunicationChannel | null;
  direction?: 'inbound' | 'outbound' | null;
  metadata?: Record<string, unknown> | null;
}

const HOT_LEAD_WEIGHTS: Record<HotLeadSignalType, number> = {
  document_consultation: 25,
  financial_report_click: 20,
  sms_sent: 15,
};

function clampScore(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

export function calculateHotLeadScore(input: HotLeadScoringInput): HotLeadScoringResult {
  const min = Number.isFinite(input.min) ? (input.min as number) : 0;
  const max = Number.isFinite(input.max) ? (input.max as number) : 100;
  const breakdown: Record<HotLeadSignalType, number> = {
    document_consultation: 0,
    financial_report_click: 0,
    sms_sent: 0,
  };

  let total = 0;
  for (const signal of input.signals) {
    const weight = Number.isFinite(signal.weight) ? signal.weight : HOT_LEAD_WEIGHTS[signal.type];
    total += weight;
    breakdown[signal.type] += weight;
  }

  return {
    score: clampScore(total, min, max),
    breakdown,
  };
}

function hasDocumentConsultationSignal(text: string): boolean {
  return /(document|dossier|pi[eè]ce|annexe).*(consult|vu|view|open|ouvrir|ouvert)/i.test(text);
}

function hasFinancialReportClickSignal(text: string): boolean {
  return /(rapport financier|financial report|[eé]tat financier|financial statement|rbe|rne|tga)/i.test(
    text
  );
}

function readBooleanFlag(meta: Record<string, unknown> | null | undefined, keys: string[]): boolean {
  if (!meta) return false;
  for (const key of keys) {
    if (meta[key] === true) return true;
  }
  return false;
}

export function extractHotLeadSignalsFromMessages(
  messages: readonly HotLeadMessageLike[]
): HotLeadSignal[] {
  const out: HotLeadSignal[] = [];
  for (const msg of messages) {
    const content = `${msg.summaryOneLine ?? ''} ${msg.body ?? ''}`.trim();
    const meta = msg.metadata ?? null;
    const occurredAtMillis = msg.sentAtMillis;

    if (
      readBooleanFlag(meta, ['documentViewed', 'documentConsulted']) ||
      hasDocumentConsultationSignal(content)
    ) {
      out.push({
        type: 'document_consultation',
        weight: HOT_LEAD_WEIGHTS.document_consultation,
        occurredAtMillis,
      });
    }

    if (
      readBooleanFlag(meta, ['financialReportClicked', 'financialReportOpened']) ||
      hasFinancialReportClickSignal(content)
    ) {
      out.push({
        type: 'financial_report_click',
        weight: HOT_LEAD_WEIGHTS.financial_report_click,
        occurredAtMillis,
      });
    }

    if (msg.channel === 'sms' && msg.direction === 'outbound') {
      out.push({
        type: 'sms_sent',
        weight: HOT_LEAD_WEIGHTS.sms_sent,
        occurredAtMillis,
      });
    }
  }
  return out;
}
