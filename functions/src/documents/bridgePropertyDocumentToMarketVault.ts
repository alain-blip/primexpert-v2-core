/**
 * Pont CRM → Big Data — ingestion passive depuis documents résidence.
 *
 * Déclenché après analyse IA d'un état financier ou rapport d'évaluation agréé.
 * Crée une entrée market_documents en attente de validation HITL.
 */

import type { DocumentReference } from 'firebase-admin/firestore';
import { extractFinancialDocumentWithGemini } from './geminiExtract';
import { resolveExtractionKind } from './documentTaxonomy';
import { getDb } from '../lib/firestore';

const RESIDENCES = 'residences';
const DOCUMENTS = 'documents';
const MARKET_DOCUMENTS = 'market_documents';
const PARSEABLE_MIME = new Set(['application/pdf']);

const BRIDGE_TAXONOMY_IDS = new Set([
  'bilans_etats_financiers',
  'rapport_interimaire',
  'rapport_evaluation_agree',
]);

function adminStorage() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { getStorage } = require('firebase-admin/storage') as typeof import('firebase-admin/storage');
  return getStorage();
}

async function downloadAsBase64(storagePath: string): Promise<{ data: string; mimeType: string }> {
  const file = adminStorage().bucket().file(storagePath);
  const [buffer] = await file.download();
  const [meta] = await file.getMetadata();
  return { data: buffer.toString('base64'), mimeType: meta.contentType ?? 'application/pdf' };
}

function stripUndefinedDeep<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => stripUndefinedDeep(item)) as T;
  }
  if (value && typeof value === 'object' && !(value instanceof Date)) {
    const out: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      if (nested !== undefined) out[key] = stripUndefinedDeep(nested);
    }
    return out as T;
  }
  return value;
}

export function isEligibleForMarketBridge(data: Record<string, unknown>): boolean {
  if (data.marketBridgeDocumentId) return false;
  if (data.parsingStatus !== 'completed') return false;
  if (data.virusScanStatus !== 'clean') return false;

  const taxonomyId = String(data.taxonomyDocumentTypeId ?? data.documentTypeId ?? '').trim();
  if (taxonomyId && BRIDGE_TAXONOMY_IDS.has(taxonomyId)) return true;

  const extracted = (data.extractedData ?? {}) as Record<string, unknown>;
  const docType = String(extracted.documentType ?? '').trim();
  const kind = resolveExtractionKind(docType);
  if (kind === 'etats_financiers' || kind === 'rapport_evaluation') return true;

  if (data.category === 'financier' && /financier|évaluat|evaluation|bilan|état/i.test(docType)) {
    return true;
  }

  return false;
}

export async function bridgePropertyDocumentToMarketVault(
  propertyId: string,
  documentId: string
): Promise<{ marketDocumentId: string } | { skipped: true; reason: string }> {
  const db = getDb();
  const propertyRef = db.collection(RESIDENCES).doc(propertyId);
  const propertySnap = await propertyRef.get();
  if (!propertySnap.exists) return { skipped: true, reason: 'property_not_found' };

  const propertyData = propertySnap.data() ?? {};
  const brokerId = String(propertyData.courtiersResponsables ?? '').trim();
  if (!brokerId) return { skipped: true, reason: 'missing_broker' };

  const docRef = propertyRef.collection(DOCUMENTS).doc(documentId);
  const docSnap = await docRef.get();
  if (!docSnap.exists) return { skipped: true, reason: 'document_not_found' };

  const data = docSnap.data() ?? {};
  if (!isEligibleForMarketBridge(data)) {
    return { skipped: true, reason: 'not_eligible' };
  }

  const storagePath = String(data.storagePath ?? '');
  const fileName = String(data.fileName ?? 'document.pdf');
  const mimeType = String(data.mimeType ?? 'application/pdf');
  if (!storagePath || !PARSEABLE_MIME.has(mimeType)) {
    return { skipped: true, reason: 'unsupported_mime_or_path' };
  }

  try {
    const { data: base64, mimeType: storageMime } = await downloadAsBase64(storagePath);
    const extractedData = await extractFinancialDocumentWithGemini(
      storageMime || mimeType,
      base64,
      fileName,
      { documentCategory: 'MARKET_REPORT' }
    );

    const now = Date.now();
    const marketRef = await db.collection(MARKET_DOCUMENTS).add({
      fileName,
      mimeType,
      sizeBytes: typeof data.sizeBytes === 'number' ? data.sizeBytes : 0,
      storagePath,
      uploadedBy: brokerId,
      uploadedAtMillis: now,
      documentCategory: 'MARKET_REPORT',
      virusScanStatus: 'clean',
      parsingStatus: 'completed',
      parsingEligible: true,
      isValidated: false,
      parsedAtMillis: now,
      extractedData: stripUndefinedDeep(extractedData),
      bridgeOrigin: 'residence_passive',
      sourcePropertyId: propertyId,
      sourcePropertyDocumentId: documentId,
      sourcePropertyLabel:
        String(propertyData.nomCommercial ?? propertyData.name ?? propertyData.address ?? '').trim() ||
        propertyId,
    });

    await docRef.update({
      marketBridgeDocumentId: marketRef.id,
      marketBridgeStatus: 'completed',
      marketBridgedAtMillis: now,
    });

    console.info('[marketBridge] created market_documents entry', {
      propertyId,
      documentId,
      marketDocumentId: marketRef.id,
    });

    return { marketDocumentId: marketRef.id };
  } catch (e) {
    const reason = e instanceof Error ? e.message : String(e);
    console.error('[marketBridge] failed', { propertyId, documentId, reason });
    await docRef.update({
      marketBridgeStatus: 'failed',
      marketBridgeError: reason.slice(0, 500),
    });
    throw e;
  }
}

export async function markBridgePending(docRef: DocumentReference): Promise<void> {
  await docRef.update({ marketBridgeStatus: 'pending' });
}
