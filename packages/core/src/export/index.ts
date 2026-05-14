/**
 * Export Module — LOT 8
 *
 * Exports pour l'export et le partage sécurisé
 */

export {
  type ExportView,
  type ExportPolicy,
  type ExportSection,
  getExportPolicy,
  isFieldAllowed,
  isSensitiveField,
  filterAllowedFields,
  auditSensitiveFields,
  NEVER_EXPORT_FIELDS,
  SENSITIVE_FIELD_PATTERNS,
  VIEW_LABELS,
  VIEW_DESCRIPTIONS,
  INTERNAL_TEAM_POLICY,
  BANK_VIEW_POLICY,
  BUYER_VIEW_POLICY,
} from './exportPolicy';

// Re-export for convenient access
export type { ExportView as ExportViewType } from './exportPolicy';

export {
  type ExportDataset,
  type ExportSections,
  type BuildExportDatasetInput,
  buildExportDataset,
  validateExportDataset,
} from './buildExportDataset';
