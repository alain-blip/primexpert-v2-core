/**
 * Preuve locale — payload rapport vendeur ACM (tableaux + banquabilité).
 * Usage : npx tsx scripts/verify-acm-vendor-payload.mts
 */
import { buildAcmVendorCraftMyPdfPayload } from '../src/services/acmVendorPdfService.ts';
import type { FinancialDataV2Doc } from '../packages/core/src/financial/normalizeFinancialData.ts';
import type { ResidenceAcmBootstrap } from '../packages/core/src/valuation/residenceAcmBootstrap.ts';
import type { ValuationOutputs } from '../packages/core/src/valuation/valuationEngine.ts';

const financialData: FinancialDataV2Doc = {
  calculatedResults: {
    revenuBrutEffectif: 1_266_072,
    revenuNetExploitation: 800_000,
    depensesTotales: 466_072,
    ratioCouvertureDette: 1.32,
    cashFlow: 95_000,
    empruntMaxTransaction: 5_500_000,
    miseDeFondsRequise: 2_000_000,
    facteurDepenses: 0.368,
    tauxCapitalisation: 0.075,
  },
  baseData: {
    revenusAnnuels: 1_100_000,
    nombreUnites: 60,
    depenses: {
      taxesPermis: 85_000,
      assurances: 42_000,
      entretienReparations: 120_000,
      gestionAdministration: 95_000,
      salairesBenefices: 180_000,
    },
    financement: {
      tauxInteret: 5.25,
      amortissement: 25,
      ltv: 0.75,
      dscr: 1.25,
    },
  },
};

const residence = {
  id: 'demo-residence',
  price: 10_000_000,
  prixDemande: 10_000_000,
  askingPrice: 10_000_000,
  nombreUnites: 60,
  address: '1230, boulevard Laurier',
  city: 'Québec',
};

const bootstrap = {
  residenceLabel: 'Les Quartiers A inc.',
  regionLabel: 'Capitale-Nationale',
  assetClassLabel: 'RPA',
  units: 60,
  revenuBrutEffectif: 1_266_072,
  revenuNetExploitation: 800_000,
  rneBlocksValuation: false,
  rneIntegrityOk: true,
  rneIntegrityIssueFr: null,
  rneIntegrityIssueEn: null,
  askingPrice: 10_000_000,
  suggestedCapRatePct: 7.5,
  targetCapRatePct: 7.5,
  capRateSource: 'gps',
  capRateSampleCount: 12,
  capRateRationaleFr: '—',
  capRateRationaleEn: '—',
  penetrationRatePct: 0,
  marketContext: { competitorCount: 0, population75Plus: null, radiusKm: null },
  valuationInputs: {} as ResidenceAcmBootstrap['valuationInputs'],
} satisfies ResidenceAcmBootstrap;

const valuation = {
  suggestedPrice: 9_500_000,
  suggestedLow: 8_550_000,
  suggestedHigh: 10_450_000,
  bankableValue: 9_200_000,
  operatingExpensesTotal: 466_072,
  actualCapRateAtAsking: 0.08,
  maxLoanByDscr: 0,
  downPaymentRequired: 0,
  expenseRatio: 0.368,
  dscrAtAsking: 0,
  cashOnCashReturn: 0,
} as ValuationOutputs;

const payload = buildAcmVendorCraftMyPdfPayload({
  bootstrap,
  valuation,
  broker: {
    brokerName: 'Jean Courtier',
    agencyName: 'Agence Démo',
    brokerTitle: 'Courtier immobilier',
  },
  locale: 'fr',
  residenceAddress: '1230, boulevard Laurier, Québec',
  effectiveCapRate: 0.075,
  financialData,
  residence,
});

const mfrRaw = payload.mise_de_fonds_minimale_es.replace(/[^\d]/g, '');
const mfrNum = Number(mfrRaw);

console.log('\n--- Extrait payload ACM vendeur (preuve locale) ---\n');
console.log(
  JSON.stringify(
    {
      Nom_Residence: payload.Nom_Residence,
      liste_revenus_count: payload.liste_revenus.length,
      liste_depenses_count: payload.liste_depenses.length,
      liste_depenses: payload.liste_depenses,
      capacite_emprunt_estimee: payload.capacite_emprunt_estimee,
      mise_de_fonds_minimale_es: payload.mise_de_fonds_minimale_es,
      rcd: payload.rcd,
      rendement_mise_fonds: payload.rendement_mise_fonds,
    },
    null,
    2
  )
);

if (payload.liste_depenses.length === 0) {
  console.error('\nÉCHEC : liste_depenses vide\n');
  process.exit(1);
}
if (!(mfrNum > 0)) {
  console.error('\nÉCHEC : mise_de_fonds_minimale_es = 0\n');
  process.exit(1);
}
if (payload.rcd === '0,00') {
  console.error('\nÉCHEC : rcd = 0,00\n');
  process.exit(1);
}

console.log('\nOK — tableaux peuplés et mise de fonds > 0\n');
