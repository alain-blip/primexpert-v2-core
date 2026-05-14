/**
 * Build Export Dataset — LOT 8
 *
 * Construit un dataset normalisé pour l'export selon la vue demandée.
 * Applique les politiques de filtrage et de redaction.
 */

import {
  ExportView,
  getExportPolicy,
  isFieldAllowed,
  isSensitiveField,
  auditSensitiveFields,
} from './exportPolicy';
import { formatCurrency } from '@primexpert/core/utils/formatting';

// ============================================================
// TYPES
// ============================================================

export interface ExportDataset {
  /** Métadonnées de l'export */
  meta: {
    residenceId: string;
    residenceName: string;
    view: ExportView;
    generatedAt: Date;
    version: string;
  };
  /** Sections de données */
  sections: ExportSections;
  /** Audit de sécurité */
  audit: {
    sensitiveFieldsFound: string[];
    totalFieldsExported: number;
    totalFieldsRedacted: number;
  };
}

export interface ExportSections {
  summary?: SummarySection;
  identity?: IdentitySection;
  location?: LocationSection;
  capacity?: CapacitySection;
  revenue?: RevenueSection;
  building?: BuildingSection;
  safety?: SafetySection;
  compliance?: ComplianceSection;
  documents?: DocumentsSection;
  quality?: QualitySection;
}

export interface SummarySection {
  headline: string;
  keyMetrics: KeyMetric[];
}

export interface KeyMetric {
  label: string;
  value: string | number;
  unit?: string;
}

export interface IdentitySection {
  name?: string;
  type?: string;
  category?: string;
  legalName?: string;
  neq?: string;
  legalForm?: string;
}

export interface LocationSection {
  address?: string;
  city?: string;
  region?: string;
  postalCode?: string;
}

export interface CapacitySection {
  totalUnits?: number;
  occupancyRate?: number | string;
  availableUnits?: number;
  residents?: number;
}

export interface RevenueSection {
  askingPrice?: number;
  annualRevenue?: number;
  annualExpenses?: number;
  averageRent?: number;
  capRate?: number | string;
  propertyAssessment?: number;
  noi?: number;
}

export interface BuildingSection {
  yearBuilt?: number;
  floors?: number;
  buildingArea?: number;
  landArea?: number;
}

export interface SafetySection {
  sprinklerSystem?: boolean | string;
  elevator?: boolean | string;
  safetyCategory?: string;
}

export interface ComplianceSection {
  msssRecognized?: boolean;
  certifications?: string[];
}

export interface DocumentsSection {
  total: number;
  types: { type: string; count: number }[];
  list?: { filename: string; type: string; uploadedAt?: Date }[];
}

export interface QualitySection {
  score: number;
  status: 'green' | 'yellow' | 'red';
  criticalMissing: string[];
  completeness: number;
}

// ============================================================
// HELPERS DE FORMATAGE
// ============================================================

// formatCurrency importé depuis ../../utils/formatting (SOURCE UNIQUE)

function formatPercent(value: number | undefined): string {
  if (value === undefined || value === null) return 'N/D';
  // Si déjà en pourcentage (ex: 95), retourner directement
  if (value > 1) return `${value.toFixed(1)}%`;
  // Si en décimal (ex: 0.95), convertir
  return `${(value * 100).toFixed(1)}%`;
}

function formatNumber(value: number | undefined): string {
  if (value === undefined || value === null) return 'N/D';
  return new Intl.NumberFormat('fr-CA').format(value);
}

function formatBoolean(value: boolean | string | undefined): string {
  if (value === undefined || value === null) return 'N/D';
  if (value === 'unknown') return 'Inconnu';
  if (value === true || value === 'true' || value === 'oui') return 'Oui';
  if (value === false || value === 'false' || value === 'non') return 'Non';
  return String(value);
}

function getValue<T>(residence: Record<string, unknown>, ...keys: string[]): T | undefined {
  for (const key of keys) {
    const value = residence[key];
    if (value !== undefined && value !== null && value !== '') {
      return value as T;
    }
  }
  return undefined;
}

// ============================================================
// BUILDERS DE SECTIONS
// ============================================================

function buildSummarySection(
  residence: Record<string, unknown>,
  view: ExportView
): SummarySection {
  const name = getValue<string>(residence, 'name', 'nomResidence') || 'Résidence';
  const type = getValue<string>(residence, 'residenceType') || 'RPA';
  const units = getValue<number>(residence, 'nombreUnitesTotal', 'unitsCount');
  const occupancy = getValue<number>(residence, 'tauxOccupation', 'occupancyRate');
  const askingPrice = getValue<number>(residence, 'askingPrice', 'prixDemande');

  const keyMetrics: KeyMetric[] = [];

  if (units && isFieldAllowed('nombreUnitesTotal', view)) {
    keyMetrics.push({ label: 'Unités', value: units });
  }

  if (occupancy !== undefined && isFieldAllowed('tauxOccupation', view)) {
    keyMetrics.push({ label: 'Occupation', value: formatPercent(occupancy) });
  }

  if (askingPrice && isFieldAllowed('askingPrice', view)) {
    keyMetrics.push({ label: 'Prix demandé', value: formatCurrency(askingPrice) });
  }

  return {
    headline: `${name} - ${type}${units ? ` - ${units} unités` : ''}`,
    keyMetrics,
  };
}

function buildIdentitySection(
  residence: Record<string, unknown>,
  view: ExportView
): IdentitySection {
  const section: IdentitySection = {};

  if (isFieldAllowed('name', view)) {
    section.name = getValue<string>(residence, 'name', 'nomResidence');
  }
  if (isFieldAllowed('residenceType', view)) {
    section.type = getValue<string>(residence, 'residenceType');
  }
  if (isFieldAllowed('categorieRPA', view)) {
    section.category = getValue<string>(residence, 'categorieRPA');
  }
  if (isFieldAllowed('raisonSociale', view)) {
    section.legalName = getValue<string>(residence, 'raisonSociale', 'nomCompagnie');
  }
  if (isFieldAllowed('neq', view)) {
    section.neq = getValue<string>(residence, 'neq');
  }
  if (isFieldAllowed('formeJuridique', view)) {
    section.legalForm = getValue<string>(residence, 'formeJuridique');
  }

  return section;
}

function buildLocationSection(
  residence: Record<string, unknown>,
  view: ExportView
): LocationSection {
  const section: LocationSection = {};

  if (isFieldAllowed('address', view)) {
    section.address = getValue<string>(residence, 'address', 'adresse');
  }
  if (isFieldAllowed('municipalite', view)) {
    section.city = getValue<string>(residence, 'municipalite', 'ville');
  }
  if (isFieldAllowed('regionSociosanitaire', view)) {
    section.region = getValue<string>(residence, 'regionSociosanitaire', 'region');
  }
  if (isFieldAllowed('codePostal', view)) {
    section.postalCode = getValue<string>(residence, 'codePostal');
  }

  return section;
}

function buildCapacitySection(
  residence: Record<string, unknown>,
  view: ExportView
): CapacitySection {
  const section: CapacitySection = {};

  if (isFieldAllowed('nombreUnitesTotal', view)) {
    section.totalUnits = getValue<number>(residence, 'nombreUnitesTotal', 'unitsCount', 'nombreUnites');
  }
  if (isFieldAllowed('tauxOccupation', view)) {
    const rate = getValue<number>(residence, 'tauxOccupation', 'occupancyRate');
    section.occupancyRate = rate !== undefined ? formatPercent(rate) : undefined;
  }
  if (isFieldAllowed('nombreUnitesDisponibles', view)) {
    section.availableUnits = getValue<number>(residence, 'nombreUnitesDisponibles');
  }

  return section;
}

function buildRevenueSection(
  residence: Record<string, unknown>,
  view: ExportView
): RevenueSection {
  const section: RevenueSection = {};

  if (isFieldAllowed('askingPrice', view)) {
    section.askingPrice = getValue<number>(residence, 'askingPrice', 'prixDemande');
  }
  if (isFieldAllowed('revenusAnnuels', view)) {
    section.annualRevenue = getValue<number>(residence, 'revenusAnnuels', 'annualRevenue', 'totalRevenusAnnuels');
  }
  if (isFieldAllowed('depensesAnnuelles', view)) {
    section.annualExpenses = getValue<number>(residence, 'depensesAnnuelles', 'annualExpenses', 'totalDepensesAnnuelles');
  }
  if (isFieldAllowed('loyerMoyen', view)) {
    section.averageRent = getValue<number>(residence, 'loyerMoyen', 'averageRent');
  }
  if (isFieldAllowed('tauxCapitalisation', view)) {
    const rate = getValue<number>(residence, 'tauxCapitalisation', 'capRate');
    section.capRate = rate !== undefined ? formatPercent(rate) : undefined;
  }
  if (isFieldAllowed('evaluationFonciere', view)) {
    section.propertyAssessment = getValue<number>(residence, 'evaluationFonciere', 'propertyAssessment');
  }
  if (isFieldAllowed('revenuNetExploitation', view)) {
    section.noi = getValue<number>(residence, 'revenuNetExploitation', 'noi');
  }

  return section;
}

function buildBuildingSection(
  residence: Record<string, unknown>,
  view: ExportView
): BuildingSection {
  const section: BuildingSection = {};

  if (isFieldAllowed('anneeConstruction', view)) {
    section.yearBuilt = getValue<number>(residence, 'anneeConstruction', 'yearBuilt', 'anneeConstructionApprox');
  }
  if (isFieldAllowed('nombreEtages', view)) {
    section.floors = getValue<number>(residence, 'nombreEtages', 'floors');
  }
  if (isFieldAllowed('superficieBatiment', view)) {
    section.buildingArea = getValue<number>(residence, 'superficieBatiment', 'buildingArea');
  }
  if (isFieldAllowed('superficieTerrain', view)) {
    section.landArea = getValue<number>(residence, 'superficieTerrain', 'landArea');
  }

  return section;
}

function buildSafetySection(
  residence: Record<string, unknown>,
  view: ExportView
): SafetySection {
  const section: SafetySection = {};

  if (isFieldAllowed('systemeGicleurs', view)) {
    const value = getValue<boolean | string>(residence, 'systemeGicleurs', 'sprinklerSystem');
    section.sprinklerSystem = formatBoolean(value);
  }
  if (isFieldAllowed('ascenseur', view)) {
    const value = getValue<boolean | string>(residence, 'ascenseur', 'elevator');
    section.elevator = formatBoolean(value);
  }
  if (isFieldAllowed('categorieSecurite', view)) {
    section.safetyCategory = getValue<string>(residence, 'categorieSecurite');
  }

  return section;
}

function buildComplianceSection(
  residence: Record<string, unknown>,
  _view: ExportView
): ComplianceSection {
  const section: ComplianceSection = {};

  const certMSSS = getValue<boolean>(residence, 'certificationMSSS', 'msssRecognized');
  if (certMSSS !== undefined) {
    section.msssRecognized = certMSSS;
  }

  return section;
}

function buildDocumentsSection(
  documents: Array<{ filename?: string; name?: string; docKind?: string; uploadedAt?: Date }> | undefined,
  view: ExportView
): DocumentsSection {
  const policy = getExportPolicy(view);

  if (!documents || documents.length === 0) {
    return { total: 0, types: [] };
  }

  // Compter par type
  const typeCounts: Record<string, number> = {};
  for (const doc of documents) {
    const type = doc.docKind || 'Autre';
    typeCounts[type] = (typeCounts[type] || 0) + 1;
  }

  const types = Object.entries(typeCounts).map(([type, count]) => ({ type, count }));

  const section: DocumentsSection = {
    total: documents.length,
    types,
  };

  // Inclure la liste si autorisé
  if (policy.includeDocuments) {
    section.list = documents.map((doc) => ({
      filename: doc.filename || doc.name || 'Document',
      type: doc.docKind || 'Autre',
      uploadedAt: doc.uploadedAt,
    }));
  }

  return section;
}

function buildQualitySection(
  qualitySnapshot: Record<string, unknown> | undefined
): QualitySection | undefined {
  if (!qualitySnapshot) return undefined;

  return {
    score: (qualitySnapshot.score as number) || 0,
    status: (qualitySnapshot.status as 'green' | 'yellow' | 'red') || 'red',
    criticalMissing: (qualitySnapshot.criticalMissing as string[]) || [],
    completeness: (qualitySnapshot.completeness as { percentage: number })?.percentage || 0,
  };
}

// ============================================================
// FONCTION PRINCIPALE
// ============================================================

export interface BuildExportDatasetInput {
  residenceId: string;
  residence: Record<string, unknown>;
  qualitySnapshot?: Record<string, unknown>;
  documents?: Array<{ filename?: string; name?: string; docKind?: string; uploadedAt?: Date }>;
  view: ExportView;
}

/**
 * Construit le dataset d'export pour une résidence
 */
export function buildExportDataset(input: BuildExportDatasetInput): ExportDataset {
  const { residenceId, residence, qualitySnapshot, documents, view } = input;
  const policy = getExportPolicy(view);

  // Construire les sections selon la politique
  const sections: ExportSections = {};
  let totalFieldsExported = 0;
  let totalFieldsRedacted = 0;

  if (policy.sections.includes('summary')) {
    sections.summary = buildSummarySection(residence, view);
    totalFieldsExported += sections.summary.keyMetrics.length;
  }

  if (policy.sections.includes('identity')) {
    sections.identity = buildIdentitySection(residence, view);
    totalFieldsExported += Object.keys(sections.identity).filter((k) => sections.identity![k as keyof IdentitySection] !== undefined).length;
  }

  if (policy.sections.includes('location')) {
    sections.location = buildLocationSection(residence, view);
    totalFieldsExported += Object.keys(sections.location).filter((k) => sections.location![k as keyof LocationSection] !== undefined).length;
  }

  if (policy.sections.includes('capacity')) {
    sections.capacity = buildCapacitySection(residence, view);
    totalFieldsExported += Object.keys(sections.capacity).filter((k) => sections.capacity![k as keyof CapacitySection] !== undefined).length;
  }

  if (policy.sections.includes('revenue')) {
    sections.revenue = buildRevenueSection(residence, view);
    totalFieldsExported += Object.keys(sections.revenue).filter((k) => sections.revenue![k as keyof RevenueSection] !== undefined).length;
  }

  if (policy.sections.includes('building')) {
    sections.building = buildBuildingSection(residence, view);
    totalFieldsExported += Object.keys(sections.building).filter((k) => sections.building![k as keyof BuildingSection] !== undefined).length;
  }

  if (policy.sections.includes('safety')) {
    sections.safety = buildSafetySection(residence, view);
    totalFieldsExported += Object.keys(sections.safety).filter((k) => sections.safety![k as keyof SafetySection] !== undefined).length;
  }

  if (policy.sections.includes('compliance')) {
    sections.compliance = buildComplianceSection(residence, view);
  }

  if (policy.sections.includes('documents') && policy.includeDocuments) {
    sections.documents = buildDocumentsSection(documents, view);
  }

  if (policy.sections.includes('quality') && policy.includeQualityScore && qualitySnapshot) {
    sections.quality = buildQualitySection(qualitySnapshot);
  }

  // Calculer les champs redactés
  totalFieldsRedacted = policy.redactedFields.length;

  // Audit de sécurité - vérifier qu'aucun champ sensible n'est présent
  const sensitiveFieldsFound = auditSensitiveFields(sections as unknown as Record<string, unknown>);

  return {
    meta: {
      residenceId,
      residenceName: getValue<string>(residence, 'name', 'nomResidence') || 'Résidence',
      view,
      generatedAt: new Date(),
      version: '1.0.0',
    },
    sections,
    audit: {
      sensitiveFieldsFound,
      totalFieldsExported,
      totalFieldsRedacted,
    },
  };
}

/**
 * Valide qu'un dataset ne contient pas de données sensibles
 * Lance une erreur si des données sensibles sont trouvées
 */
export function validateExportDataset(dataset: ExportDataset): void {
  if (dataset.audit.sensitiveFieldsFound.length > 0) {
    throw new Error(
      `ERREUR SÉCURITÉ: Données sensibles détectées dans l'export: ${dataset.audit.sensitiveFieldsFound.join(', ')}`
    );
  }
}

export default buildExportDataset;
