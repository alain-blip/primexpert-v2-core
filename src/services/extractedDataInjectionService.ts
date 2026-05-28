/**
 * Injection courtier — montants validés → fiche financial/dataV2 + Identité résidence + Big Data anonymisé.
 */

import {
  doc,
  collection,
  getDoc,
  writeBatch,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import {
  assessFinancialDataOverwrite,
  type FinancialDataV2Doc,
  type FinancialOverwriteAssessment,
} from '@primexpert/core/financial';
import type { ExtractedAmountRow, ExtractedComparableRow } from '../lib/extractedDataInjection';
import {
  buildResidenceCadastrePatch,
  buildResidenceEvaluationSubjectPatch,
  inferAnneeDonnees,
  inferCategoryFromExtractedData,
  inferProvenanceFromFileName,
  resolveRegionAdministrative,
} from '../lib/extractedDataInjection';
import type { MarketAnalyticsRawEntry } from '../types/marketAnalytics';
import type { MarketDataProvenance, MarketSiloType } from '../types/marketAnalytics';
import type { MarketAnalyticsComparableSnapshot } from '../types/marketAnalytics';
import type { PropertyDocumentRecord } from '../types/propertyDocument';
import { stripUndefinedDeep } from '../lib/firestoreSanitize';
import type { MarketAnalyticsValidatedAmount } from '../types/marketAnalytics';

const MARKET_ANALYTICS_RAW = 'market_analytics_raw';
const RESIDENCES = 'residences';

export class FinancialOverwriteConfirmationRequired extends Error {
  readonly assessment: FinancialOverwriteAssessment;

  constructor(assessment: FinancialOverwriteAssessment) {
    super('FINANCIAL_OVERWRITE_CONFIRMATION_REQUIRED');
    this.name = 'FinancialOverwriteConfirmationRequired';
    this.assessment = assessment;
  }
}

export interface InjectExtractedDataInput {
  propertyId: string;
  document: PropertyDocumentRecord;
  selectedRows: ExtractedAmountRow[];
  selectedComparableRows?: ExtractedComparableRow[];
  siloType: MarketSiloType;
  brokerId: string;
  residenceCity?: string;
  residenceRegionHint?: string;
}

/** Détection conflit avant injection — états financiers vs fiche existante. */
export async function loadFinancialOverwriteAssessment(
  propertyId: string,
  document: PropertyDocumentRecord
): Promise<FinancialOverwriteAssessment | null> {
  const financialRef = doc(db, RESIDENCES, propertyId, 'financial', 'dataV2');
  const financialSnap = await getDoc(financialRef);
  const existing = financialSnap.exists()
    ? (financialSnap.data() as FinancialDataV2Doc)
    : null;
  const incomingYear = inferAnneeDonnees(document.extractedData, document.fileName);
  return assessFinancialDataOverwrite(existing, incomingYear);
}

export interface InjectExtractedDataResult {
  financialUpdated: boolean;
  residenceIdentityUpdated: boolean;
  marketEntryIds: string[];
}

function resolveComparableRegion(row: ExtractedComparableRow) {
  return resolveRegionAdministrative(row.city, row.region);
}

export async function injectExtractedDataToResidence(
  input: InjectExtractedDataInput
): Promise<InjectExtractedDataResult> {
  const {
    propertyId,
    document,
    selectedRows,
    selectedComparableRows = [],
    siloType,
    brokerId,
    residenceCity,
    residenceRegionHint,
  } = input;

  const subjectPatch = buildResidenceEvaluationSubjectPatch(document.extractedData);
  const hasSelection =
    selectedRows.length > 0 || selectedComparableRows.length > 0 || subjectPatch != null;

  if (!hasSelection) {
    throw new Error('Sélectionnez au moins un élément à injecter.');
  }

  const provenanceFromFile: MarketDataProvenance = inferProvenanceFromFileName(document.fileName);
  const provenance: MarketDataProvenance =
    selectedComparableRows.length > 0 || subjectPatch
      ? 'rapport_evaluation'
      : provenanceFromFile;

  const defaultRegion = resolveRegionAdministrative(residenceCity, residenceRegionHint);
  const anneeDonnees = inferAnneeDonnees(document.extractedData, document.fileName);

  const residenceRef = doc(db, RESIDENCES, propertyId);
  const docRef = doc(db, RESIDENCES, propertyId, 'documents', document.id);

  const marketEntryIds: string[] = [];
  const batch = writeBatch(db);

  /** Hub Finance : plus d’écriture directe — validation via panneau Saisie manuelle. */
  const financialUpdated = false;

  if (selectedRows.length > 0) {
    const validatedAmounts: MarketAnalyticsValidatedAmount[] = selectedRows.map((r) => {
      const row: MarketAnalyticsValidatedAmount = {
        label: r.label,
        value: r.value,
        currency: r.currency,
      };
      if (r.expenseKey) row.expenseKey = r.expenseKey;
      return row;
    });

    const amountsMarketRef = doc(collection(db, MARKET_ANALYTICS_RAW));
    const amountsPayload: MarketAnalyticsRawEntry = {
      siloType,
      regionAdministrative: defaultRegion.regionAdministrative,
      regionDisplayName: defaultRegion.displayName,
      anneeDonnees,
      provenance,
      validatedAmounts,
      injectedAtMillis: Date.now(),
    };
    batch.set(amountsMarketRef, stripUndefinedDeep(amountsPayload));
    marketEntryIds.push(amountsMarketRef.id);
  }

  if (subjectPatch) {
    batch.update(residenceRef, stripUndefinedDeep(subjectPatch));
  }

  for (const comp of selectedComparableRows) {
    const compRegion = resolveComparableRegion(comp);
    const snapshot: MarketAnalyticsComparableSnapshot = { city: comp.city };
    if (comp.units != null) snapshot.units = comp.units;
    if (comp.salePrice != null) snapshot.salePrice = comp.salePrice;
    if (comp.capRatePct != null) snapshot.capRatePct = comp.capRatePct;
    if (comp.netIncomePerUnit != null) snapshot.netIncomePerUnit = comp.netIncomePerUnit;

    const compMarketRef = doc(collection(db, MARKET_ANALYTICS_RAW));
    const compPayload: MarketAnalyticsRawEntry = {
      siloType,
      regionAdministrative: compRegion.regionAdministrative,
      regionDisplayName: compRegion.displayName,
      anneeDonnees,
      provenance: 'rapport_evaluation',
      validatedAmounts: [],
      comparableSnapshot: snapshot,
      injectedAtMillis: Date.now(),
    };
    batch.set(compMarketRef, stripUndefinedDeep(compPayload));
    marketEntryIds.push(compMarketRef.id);
  }

  const targetCategory = inferCategoryFromExtractedData(document.extractedData);

  batch.update(
    docRef,
    stripUndefinedDeep({
      category: targetCategory,
      parsingStatus: 'verified',
      isValidated: true,
      validatedAtMillis: Date.now(),
      validatedBy: brokerId,
      validatedAmountKeys: selectedRows.map((r) => r.id),
      validatedComparableKeys: selectedComparableRows.map((r) => r.id),
      marketAnalyticsEntryIds: marketEntryIds,
      ...(marketEntryIds[0] ? { marketAnalyticsEntryId: marketEntryIds[0] } : {}),
    })
  );

  await batch.commit();

  return {
    financialUpdated,
    residenceIdentityUpdated: subjectPatch != null,
    marketEntryIds,
  };
}

export interface InjectCertificateLocalisationInput {
  propertyId: string;
  document: PropertyDocumentRecord;
  brokerId: string;
}

export interface InjectCertificateLocalisationResult {
  residenceCadastreUpdated: boolean;
}

/** Injection locale uniquement — Certificat de localisation (pas de Big Data). */
export async function injectCertificateLocalisationToResidence(
  input: InjectCertificateLocalisationInput
): Promise<InjectCertificateLocalisationResult> {
  const { propertyId, document, brokerId } = input;
  const cadastrePatch = buildResidenceCadastrePatch(document.extractedData);
  if (!cadastrePatch) {
    throw new Error('Aucune donnée cadastrale à injecter (lot ou superficie manquants).');
  }

  const residenceRef = doc(db, RESIDENCES, propertyId);
  const docRef = doc(db, RESIDENCES, propertyId, 'documents', document.id);
  const batch = writeBatch(db);

  batch.update(residenceRef, stripUndefinedDeep(cadastrePatch));
  const targetCategory = inferCategoryFromExtractedData(document.extractedData);

  batch.update(
    docRef,
    stripUndefinedDeep({
      category: targetCategory,
      parsingStatus: 'completed',
      isValidated: true,
      validatedAtMillis: Date.now(),
      validatedBy: brokerId,
      clInjectedAtMillis: Date.now(),
    })
  );

  await batch.commit();
  return { residenceCadastreUpdated: true };
}
