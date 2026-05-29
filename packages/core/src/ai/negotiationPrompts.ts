/**
 * Prompts & parsing JSON — négociation commerciale OACIQ / LOI (cœur métier pur).
 * Aucun appel réseau : branché via @primexpert/core/services/gemini.
 */

import { extractJsonObject } from '../audio/transcriber';
import type {
  ContractSupportType,
  OaciqFormCode,
} from './oaciqSpecsTypes';
import { OACIQ_COMPLIANCE_GUIDE_REF_FR } from './oaciqSpecsTypes';

export const NEGOTIATION_GEMINI_MODEL = 'gemini-2.5-flash' as const;

export interface NegotiationLlmJsonPayload {
  generatedClauseText: string;
  commercialEmailDraft: string;
  complianceJustification?: string;
}

export interface NegotiationPromptContext {
  frictionContext: string;
  transactionState: string;
  contractSupportType: ContractSupportType;
  oaciqFormCode?: OaciqFormCode;
  targetSectionIdentifier?: string;
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

export function buildNegotiationSystemPrompt(
  ctx: NegotiationPromptContext
): string {
  const mode = ctx.contractSupportType;
  const oaciqBlock =
    mode === 'OACIQ_FORM'
      ? `
Mode actif : OACIQ_FORM (formulaire OACIQ).
- Code formulaire cible : ${ctx.oaciqFormCode ?? 'CPC'}.
- Section d'insertion : ${ctx.targetSectionIdentifier ?? 'Section 2'}.
- Tu dois structurer la clause (réduction de prix, condition suspensive, délai, etc.) de manière concise pour s'insérer proprement dans la section désignée.
- Référence explicite au ${OACIQ_COMPLIANCE_GUIDE_REF_FR} dans complianceJustification.`
      : mode === 'LETTER_OF_INTENT'
        ? `
Mode actif : LETTER_OF_INTENT (lettre d'intention).
- Génère une clause autonome formelle, SANS mention de formulaire OACIQ, prête à être insérée dans une LOI commerciale.`
        : `
Mode actif : CUSTOM_CONTRACT (contrat d'achat privé / personnalisé).
- Génère une clause autonome formelle, SANS mention de formulaire OACIQ, prête à être insérée dans un contrat d'achat privé.`;

  return `Tu agis comme un expert en droit immobilier commercial au Québec, aligné sur les Guides des pratiques professionnelles de l'OACIQ.

${oaciqBlock}

Règles impératives :
- Français juridique québécois, clair et mesurable (montants, délais en jours ouvrables, dates, seuils).
- Prévoir explicitement les conséquences en cas de non-respect de l'obligation (résolution, pénalité, extinction de la condition, etc.).
- Ne jamais inventer de faits absents du contexte de friction fourni par le courtier.
- Ne pas promettre un résultat juridique garanti ; rappeler que le courtier doit valider avec ses conseillers.
- Interdiction d'utiliser le mot « audit » ; parler de vérification de conformité ou de diligence raisonnable.

Réponds UNIQUEMENT avec un objet JSON valide, sans markdown, avec exactement ces clés :
{
  "generatedClauseText": "texte complet de la clause juridique",
  "commercialEmailDraft": "courriel vulgarisé pour le client (120 à 220 mots)",
  "complianceJustification": "référence courte au guide OACIQ (obligatoire en OACIQ_FORM, sinon chaîne vide)"
}`;
}

export function buildNegotiationUserPrompt(ctx: NegotiationPromptContext): string {
  return [
    `État de la transaction : ${ctx.transactionState || 'non précisé'}`,
    `Contexte de friction (notes du courtier) :`,
    ctx.frictionContext.trim(),
  ].join('\n\n');
}

export function parseNegotiationLlmJson(raw: string): NegotiationLlmJsonPayload | null {
  const jsonStr = extractJsonObject(raw);
  if (!jsonStr) return null;
  try {
    const o = JSON.parse(jsonStr) as Record<string, unknown>;
    const generatedClauseText = asString(o.generatedClauseText);
    const commercialEmailDraft = asString(o.commercialEmailDraft);
    if (!generatedClauseText || !commercialEmailDraft) return null;
    const complianceJustification = asString(o.complianceJustification);
    return {
      generatedClauseText,
      commercialEmailDraft,
      complianceJustification: complianceJustification || undefined,
    };
  } catch {
    return null;
  }
}
