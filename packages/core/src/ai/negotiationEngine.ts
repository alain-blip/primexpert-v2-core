/**
 * Moteur de négociation commerciale — clauses contextuelles OACIQ / LOI / contrat libre.
 * Phase 1 Étape 3 (V2.6) — génération en brouillon, persistance HITL obligatoire.
 */

import type {
  CommercialNegotiationOutput,
  CommercialNegotiationResult,
  ContractSupportType,
  ManualVerificationClauseDraft,
  ManualVerificationHitlStatus,
  NegotiationTransactionState,
  OaciqFormCode,
  OaciqTransactionalMapping,
} from './oaciqSpecsTypes';
import {
  DEFAULT_BROKER_LEGAL_WARNING_FR,
  MANUAL_VERIFICATION_HITL_STATUS,
  OACIQ_COMPLIANCE_GUIDE_REF_FR,
} from './oaciqSpecsTypes';
import { generateNegotiationClauseWithGemini } from '../services/gemini';

export type {
  CommercialNegotiationOutput,
  CommercialNegotiationResult,
  ContractSupportType,
  ManualVerificationClauseDraft,
  OaciqFormCode,
  OaciqTransactionalMapping,
} from './oaciqSpecsTypes';

/** Port d'injection — Firestore / callable (côté app ou Functions). */
export interface ManualVerificationPersistencePort {
  saveClauseDraft(
    draft: ManualVerificationClauseDraft
  ): Promise<ManualVerificationClauseDraft>;
}

let persistencePort: ManualVerificationPersistencePort | undefined;
const inMemoryHitlQueue: ManualVerificationClauseDraft[] = [];

export function configureManualVerificationPersistence(
  port: ManualVerificationPersistencePort
): void {
  persistencePort = port;
}

/** File locale (tests / dev sans Firestore). */
export function drainInMemoryManualVerifications(): ManualVerificationClauseDraft[] {
  const copy = [...inMemoryHitlQueue];
  inMemoryHitlQueue.length = 0;
  return copy;
}

export interface OaciqRoutingHint {
  oaciqFormCode: OaciqFormCode;
  targetSectionIdentifier: string;
}

/**
 * Routeur formulaire OACIQ — négociation → CPC ; promesse acceptée → M / M3.
 */
export function resolveOaciqFormRouting(
  transactionState: NegotiationTransactionState
): OaciqRoutingHint {
  const normalized = String(transactionState ?? '')
    .trim()
    .toLowerCase();

  if (
    normalized === 'accepted_pipeline' ||
    normalized === 'accepted' ||
    normalized === 'promise'
  ) {
    return { oaciqFormCode: 'M', targetSectionIdentifier: 'Section M3' };
  }

  if (normalized === 'due_diligence') {
    return { oaciqFormCode: 'AM', targetSectionIdentifier: 'Section Annexe' };
  }

  return { oaciqFormCode: 'CPC', targetSectionIdentifier: 'Section 2' };
}

function resolveContractSupportType(
  supportType: ContractSupportType
): ContractSupportType {
  if (
    supportType === 'OACIQ_FORM' ||
    supportType === 'CUSTOM_CONTRACT' ||
    supportType === 'LETTER_OF_INTENT'
  ) {
    return supportType;
  }
  return 'CUSTOM_CONTRACT';
}

/**
 * Validation de conformité contractuelle — champs obligatoires avant persistance HITL.
 */
export function validateOaciqCompliance(
  output: CommercialNegotiationOutput
): { ok: true } | { ok: false; issues: string[] } {
  const issues: string[] = [];

  if (!output.generatedClauseText?.trim()) {
    issues.push('generatedClauseText requis');
  }
  if (!output.commercialEmailDraft?.trim()) {
    issues.push('commercialEmailDraft requis');
  }
  if (!output.requiredBrokerWarning?.trim()) {
    issues.push('requiredBrokerWarning requis');
  }

  if (output.contractSupportType === 'OACIQ_FORM') {
    if (!output.oaciqFormCode) issues.push('oaciqFormCode requis en mode OACIQ_FORM');
    if (!output.targetSectionIdentifier?.trim()) {
      issues.push('targetSectionIdentifier requis en mode OACIQ_FORM');
    }
    if (!output.complianceJustification?.trim()) {
      issues.push('complianceJustification requis en mode OACIQ_FORM');
    }
  }

  if (output.contractSupportType !== 'OACIQ_FORM') {
    if (output.oaciqFormCode) {
      issues.push('oaciqFormCode doit être absent pour contrat libre ou LOI');
    }
    if (output.targetSectionIdentifier) {
      issues.push('targetSectionIdentifier doit être absent pour contrat libre ou LOI');
    }
  }

  return issues.length === 0 ? { ok: true } : { ok: false, issues };
}

function toOaciqTransactionalMapping(
  output: CommercialNegotiationOutput
): OaciqTransactionalMapping | null {
  if (
    output.contractSupportType !== 'OACIQ_FORM' ||
    !output.oaciqFormCode ||
    !output.targetSectionIdentifier
  ) {
    return null;
  }
  return {
    oaciqFormCode: output.oaciqFormCode,
    targetSectionIdentifier: output.targetSectionIdentifier,
    clauseInsertionTemplate: output.generatedClauseText,
    requiredBrokerWarning: output.requiredBrokerWarning,
    complianceJustification:
      output.complianceJustification ?? OACIQ_COMPLIANCE_GUIDE_REF_FR,
  };
}

async function persistHitlDraft(
  draft: ManualVerificationClauseDraft
): Promise<ManualVerificationClauseDraft> {
  if (persistencePort) {
    return persistencePort.saveClauseDraft(draft);
  }
  inMemoryHitlQueue.push(draft);
  return draft;
}

function buildManualVerificationDraft(
  frictionContext: string,
  transactionState: string,
  output: CommercialNegotiationOutput
): ManualVerificationClauseDraft {
  return {
    kind: 'commercial_negotiation_clause',
    status: MANUAL_VERIFICATION_HITL_STATUS as ManualVerificationHitlStatus,
    frictionContext: frictionContext.trim(),
    transactionState: String(transactionState ?? '').trim(),
    output,
    createdAt: new Date().toISOString(),
  };
}

/**
 * Génère une clause commerciale contextuelle (OACIQ, contrat personnalisé ou LOI)
 * et persiste le brouillon en statut pending_human_review (HITL strict).
 */
export async function generateCommercialContextualClause(
  frictionContext: string,
  transactionState: NegotiationTransactionState,
  supportType: ContractSupportType
): Promise<CommercialNegotiationResult> {
  const context = String(frictionContext ?? '').trim();
  if (!context) {
    throw new Error('frictionContext requis pour la génération de clause.');
  }

  const contractSupportType = resolveContractSupportType(supportType);
  const warning = DEFAULT_BROKER_LEGAL_WARNING_FR;
  const routing =
    contractSupportType === 'OACIQ_FORM'
      ? resolveOaciqFormRouting(transactionState)
      : undefined;

  const llmPayload = await generateNegotiationClauseWithGemini({
    frictionContext: context,
    transactionState: String(transactionState ?? '').trim(),
    contractSupportType,
    oaciqFormCode: routing?.oaciqFormCode,
    targetSectionIdentifier: routing?.targetSectionIdentifier,
  });

  const output: CommercialNegotiationOutput =
    contractSupportType === 'OACIQ_FORM' && routing
      ? {
          contractSupportType: 'OACIQ_FORM',
          oaciqFormCode: routing.oaciqFormCode,
          targetSectionIdentifier: routing.targetSectionIdentifier,
          generatedClauseText: llmPayload.generatedClauseText,
          commercialEmailDraft: llmPayload.commercialEmailDraft,
          requiredBrokerWarning: warning,
          complianceJustification:
            llmPayload.complianceJustification?.trim() || OACIQ_COMPLIANCE_GUIDE_REF_FR,
        }
      : {
          contractSupportType,
          generatedClauseText: llmPayload.generatedClauseText,
          commercialEmailDraft: llmPayload.commercialEmailDraft,
          requiredBrokerWarning: warning,
        };

  const compliance = validateOaciqCompliance(output);
  if (!compliance.ok) {
    throw new Error(
      `Validation de conformité contractuelle échouée : ${compliance.issues.join('; ')}`
    );
  }

  const verification = buildManualVerificationDraft(
    context,
    transactionState,
    output
  );
  await persistHitlDraft(verification);

  return { output, verification };
}

/**
 * Alias historique — délègue au moteur hybride en mode formulaire OACIQ.
 * @deprecated Préférer generateCommercialContextualClause avec supportType explicite.
 */
export async function generateContextualOaciqClause(
  frictionContext: string,
  transactionState: NegotiationTransactionState
): Promise<OaciqTransactionalMapping> {
  const { output } = await generateCommercialContextualClause(
    frictionContext,
    transactionState,
    'OACIQ_FORM'
  );
  const mapping = toOaciqTransactionalMapping(output);
  if (!mapping) {
    throw new Error('Impossible de produire un mapping OACIQ transactional.');
  }
  return mapping;
}
