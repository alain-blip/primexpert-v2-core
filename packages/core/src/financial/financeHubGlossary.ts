/**
 * Glossaire Hub Finance — panneau « Comprendre ce tableau » (Confort 66+).
 */

export interface FinanceHubGlossaryEntry {
  readonly code: string;
  readonly titleFr: string;
  readonly titleEn: string;
  readonly bodyFr: string;
  readonly bodyEn: string;
}

export const FINANCE_HUB_GLOSSARY: ReadonlyArray<FinanceHubGlossaryEntry> = [
  {
    code: 'RNE',
    titleFr: 'Revenu net d’exploitation (RNE)',
    titleEn: 'Net operating income (NOI)',
    bodyFr:
      'Revenus d’exploitation moins dépenses d’exploitation, avant financement et impôts. Base des ratios bancaires et de la valorisation par capitalisation.',
    bodyEn:
      'Operating revenue minus operating expenses, before financing and taxes. Basis for bank ratios and capitalization valuation.',
  },
  {
    code: 'RBE',
    titleFr: 'Revenu brut effectif (RBE)',
    titleEn: 'Effective gross income (EGI)',
    bodyFr:
      'Revenus locatifs et annexes avant vacance et provisions. Sert au multiple du revenu brut (MRB).',
    bodyEn:
      'Rental and ancillary income before vacancy and allowances. Used for the gross revenue multiple (MRB).',
  },
  {
    code: 'MRN',
    titleFr: 'Multiple du revenu net (MRN)',
    titleEn: 'Net revenue multiple (MRN)',
    bodyFr:
      'Rapport prix demandé ÷ revenu net d’exploitation (RNE). Indique combien d’années de RNE sont payées dans le prix.',
    bodyEn:
      'Asking price ÷ net operating income (NOI). Shows how many years of NOI are embedded in the price.',
  },
  {
    code: 'MRB',
    titleFr: 'Multiple du revenu brut (MRB)',
    titleEn: 'Gross revenue multiple (MRB)',
    bodyFr:
      'Rapport prix demandé ÷ revenu brut effectif (RBE). Comparaison rapide avec les transactions du marché.',
    bodyEn:
      'Asking price ÷ effective gross income (EGI). Quick comparison with market transactions.',
  },
  {
    code: 'TGA',
    titleFr: 'Taux de capitalisation (TGA)',
    titleEn: 'Capitalization rate (cap rate)',
    bodyFr:
      'RNE ÷ valeur de l’immeuble (souvent exprimé en %). Plus le taux est bas, plus le prix est élevé à RNE constant.',
    bodyEn:
      'NOI ÷ property value (often as a percentage). A lower rate means a higher price at constant NOI.',
  },
  {
    code: 'DSCR',
    titleFr: 'Ratio de couverture de la dette (DSCR)',
    titleEn: 'Debt service coverage ratio (DSCR)',
    bodyFr:
      'RNE ÷ service annuel de la dette. Les prêteurs exigent en général un ratio minimal (ex. 1,20×).',
    bodyEn:
      'NOI ÷ annual debt service. Lenders typically require a minimum ratio (e.g. 1.20×).',
  },
  {
    code: 'MFR',
    titleFr: 'Mise de fonds requise (MFR)',
    titleEn: 'Required down payment (RFR)',
    bodyFr:
      'Apport minimal en capital pour respecter le plafond de prêt (LTV) et le scénario bancaire retenu.',
    bodyEn:
      'Minimum equity required to meet the loan ceiling (LTV) and the selected bank scenario.',
  },
];
