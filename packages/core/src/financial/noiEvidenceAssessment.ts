/**
 * Évaluation de concordance RNE déclaré / RNE vérifié pour les vues bancaires.
 */

export type NoiEvidenceStatus = 'ok' | 'warn' | 'fail' | 'unknown';

export interface NoiEvidenceAssessment {
  status: NoiEvidenceStatus;
  noteFr: string;
  noteEn: string;
  variancePct: number | null;
  variancePctLabel: string | null;
}

function finitePositive(value: unknown): number | null {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function assessNoiEvidence(input: {
  verifiedNoi: number | null | undefined;
  declaredNoi: number | null | undefined;
  okThresholdPct?: number;
  warningThresholdPct?: number;
}): NoiEvidenceAssessment {
  const verifiedNoi = finitePositive(input.verifiedNoi);
  const declaredNoi = finitePositive(input.declaredNoi);
  const okThresholdPct = input.okThresholdPct ?? 5;
  const warningThresholdPct = input.warningThresholdPct ?? 15;

  if (verifiedNoi != null && declaredNoi != null) {
    const variancePct =
      (Math.abs(verifiedNoi - declaredNoi) / Math.max(verifiedNoi, declaredNoi)) * 100;
    const variancePctLabel = variancePct.toFixed(1);
    if (variancePct <= okThresholdPct) {
      return {
        status: 'ok',
        variancePct,
        variancePctLabel,
        noteFr:
          'RNE déclaré et RNE vérifié concordent (écart ≤ 5 %). Pièces justificatives en ordre côté prêteur.',
        noteEn:
          'Declared and verified NOI match (≤ 5% variance). Supporting evidence is aligned with lender expectations.',
      };
    }
    if (variancePct <= warningThresholdPct) {
      return {
        status: 'warn',
        variancePct,
        variancePctLabel,
        noteFr: `Écart de ${variancePctLabel} % entre RNE déclaré et RNE vérifié — justifier la normalisation des dépenses.`,
        noteEn: `${variancePctLabel}% gap between declared and verified NOI — justify expense normalization.`,
      };
    }
    return {
      status: 'fail',
      variancePct,
      variancePctLabel,
      noteFr: `Écart majeur de ${variancePctLabel} % entre RNE déclaré et RNE vérifié — vérifier les sources avant présentation prêteur.`,
      noteEn: `Major ${variancePctLabel}% gap between declared and verified NOI — verify sources before lender submission.`,
    };
  }

  if (verifiedNoi != null) {
    return {
      status: 'warn',
      variancePct: null,
      variancePctLabel: null,
      noteFr:
        'Seul le RNE vérifié (calculé) est disponible — manque la déclaration vendeur pour pleinement convaincre le prêteur.',
      noteEn:
        'Only verified NOI (computed) is available — missing seller statement to fully convince the lender.',
    };
  }

  if (declaredNoi != null) {
    return {
      status: 'warn',
      variancePct: null,
      variancePctLabel: null,
      noteFr:
        'Seul le RNE déclaré est disponible — recommander une normalisation par dépenses vérifiées.',
      noteEn:
        'Only declared NOI is available — recommend normalization with verified expenses.',
    };
  }

  return {
    status: 'unknown',
    variancePct: null,
    variancePctLabel: null,
    noteFr: 'Aucune donnée RNE disponible — compléter Revenus & Dépenses.',
    noteEn: 'No NOI data available — complete Revenue & Expenses.',
  };
}

