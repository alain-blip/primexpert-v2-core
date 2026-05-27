/**
 * Rapport vendeur (analyse de mise en marché — ACM) — génération cloud CraftMyPDF.
 * Template : VITE_CRAFTMYPDF_ACM_VENDOR_TEMPLATE_ID (défaut PO : acd77b235dc3edba).
 * Payload snake_case aligné sur le gabarit vendeur — distinct du dossier acheteur.
 */

import type { CertifiableReportBrokerFooter } from '@primexpert/core/financial';
import type { ResidenceAcmBootstrap, ValuationOutputs } from '@primexpert/core/valuation';
import { requestCraftMyPdfBlob, triggerBrowserDownload } from './craftMyPdfClient';
import { fmtBuyerCad, fmtBuyerDscr, fmtBuyerPercent } from './buyerReportPdfService';

/** Page couverture — clés gabarit CraftMyPDF (PascalCase, racine). */
export interface AcmVendorCoverCraftMyPdfFields {
  Nom_Residence: string;
  Adresse_Residence: string;
  Nom_Courtier: string;
  Titre_Courtier: string;
  Agence_Courtier: string;
}

/** Page 6 — indicateurs financiers (snake_case, racine). */
export interface AcmVendorPage6CraftMyPdfFields {
  revenus_brut: string;
  depenses_exploitation: string;
  /** Clé gabarit PO (orthographe WORM — ne pas renommer). */
  revenus_net_baiia: string;
  capacite_emprunt_estimee: string;
  /** Clé gabarit PO (orthographe WORM — ne pas renommer). */
  mise_de_fonds_minimale_es: string;
  tga: string;
  ratio_depenses_exploitation: string;
  rcd: string;
  rendement_mise_fonds: string;
}

/** Variables dynamiques CraftMyPDF — rapport vendeur ACM (valeurs formatées en chaînes). */
export interface AcmVendorCraftMyPdfPayload
  extends AcmVendorCoverCraftMyPdfFields,
    AcmVendorPage6CraftMyPdfFields {
  /** Alias historiques — conservés pour les pages prix / narratif. */
  nom_residence: string;
  adresse_residence: string;
  nom_courtier: string;
  titre_courtier: string;
  agence_courtier: string;
  region: string;
  nombre_unites: string;
  rbe: string;
  opex: string;
  rne: string;
  prix_demande: string;
  prix_suggere: string;
  prix_plancher: string;
  prix_plafond: string;
  valeur_banquable: string;
  dscr: string;
  prix_recommande: string;
  lecture_vendeur: string;
}

export interface BuildAcmVendorCraftMyPdfPayloadInput {
  bootstrap: ResidenceAcmBootstrap;
  valuation: ValuationOutputs;
  broker: CertifiableReportBrokerFooter;
  locale: 'fr' | 'en';
  residenceAddress?: string;
  /** TGA effectif appliqué (ratio décimal, ex. 0.075). */
  effectiveCapRate: number;
  recommendedPrice?: number | null;
  sellerNarrative?: string | null;
}

export interface DownloadAcmVendorReportPdfInput extends BuildAcmVendorCraftMyPdfPayloadInput {
  residenceId?: string;
}

const ACM_VENDOR_TEMPLATE_ID_DEFAULT = 'acd77b235dc3edba';

function readAcmVendorTemplateId(): string {
  const fromEnv = import.meta.env.VITE_CRAFTMYPDF_ACM_VENDOR_TEMPLATE_ID?.trim();
  return fromEnv || ACM_VENDOR_TEMPLATE_ID_DEFAULT;
}

function textOrDash(value: string | null | undefined): string {
  const t = value?.trim();
  return t && t !== '—' ? t : '—';
}

function resolveBrokerTitle(broker: CertifiableReportBrokerFooter, locale: 'fr' | 'en'): string {
  const fromProfile = broker.brokerTitle?.trim();
  if (fromProfile) return fromProfile;
  return locale === 'fr' ? 'Courtier immobilier' : 'Licensed real estate broker';
}

function resolveOpexAmount(bootstrap: ResidenceAcmBootstrap, valuation: ValuationOutputs): number {
  const fromEngine = valuation.operatingExpensesTotal;
  if (Number.isFinite(fromEngine) && fromEngine > 0) return fromEngine;
  const rbe = bootstrap.revenuBrutEffectif;
  const rne = bootstrap.revenuNetExploitation;
  if (rbe > 0 && rne >= 0 && rne < rbe) return rbe - rne;
  return 0;
}

export function buildAcmVendorCraftMyPdfPayload(
  input: BuildAcmVendorCraftMyPdfPayloadInput
): AcmVendorCraftMyPdfPayload {
  const { bootstrap, valuation, broker, locale } = input;
  const opexAmount = resolveOpexAmount(bootstrap, valuation);
  const capPct =
    Number.isFinite(input.effectiveCapRate) && input.effectiveCapRate > 0
      ? input.effectiveCapRate > 1
        ? input.effectiveCapRate / 100
        : input.effectiveCapRate
      : valuation.actualCapRateAtAsking;

  const nomResidence = textOrDash(bootstrap.residenceLabel);
  const adresseResidence = textOrDash(input.residenceAddress);
  const nomCourtier = textOrDash(broker.brokerName);
  const titreCourtier = resolveBrokerTitle(broker, locale);
  const agenceCourtier = textOrDash(broker.agencyName);

  const revenusBrut = bootstrap.revenuBrutEffectif;
  const revenusNet = bootstrap.revenuNetExploitation;
  const capaciteEmprunt = valuation.maxLoanByDscr;
  const miseDeFonds = valuation.downPaymentRequired;
  const ratioDepenses = valuation.expenseRatio;
  const rcd = valuation.dscrAtAsking;
  const rendementMiseFonds = valuation.cashOnCashReturn;
  const tgaFormatted = fmtBuyerPercent(capPct);

  const payload: AcmVendorCraftMyPdfPayload = {
    Nom_Residence: nomResidence,
    Adresse_Residence: adresseResidence,
    Nom_Courtier: nomCourtier,
    Titre_Courtier: titreCourtier,
    Agence_Courtier: agenceCourtier,
    revenus_brut: fmtBuyerCad(revenusBrut),
    depenses_exploitation: fmtBuyerCad(opexAmount),
    revenus_net_baiia: fmtBuyerCad(revenusNet),
    capacite_emprunt_estimee: fmtBuyerCad(capaciteEmprunt),
    mise_de_fonds_minimale_es: fmtBuyerCad(miseDeFonds),
    tga: tgaFormatted,
    ratio_depenses_exploitation: fmtBuyerPercent(ratioDepenses),
    rcd: fmtBuyerDscr(rcd),
    rendement_mise_fonds: fmtBuyerPercent(rendementMiseFonds),
    nom_residence: nomResidence,
    adresse_residence: adresseResidence,
    nom_courtier: nomCourtier,
    titre_courtier: titreCourtier,
    agence_courtier: agenceCourtier,
    region: textOrDash(bootstrap.regionLabel ?? undefined),
    nombre_unites: bootstrap.units > 0 ? String(bootstrap.units) : '—',
    rbe: fmtBuyerCad(revenusBrut),
    opex: fmtBuyerCad(opexAmount),
    rne: fmtBuyerCad(revenusNet),
    prix_demande: fmtBuyerCad(bootstrap.askingPrice),
    prix_suggere: fmtBuyerCad(valuation.suggestedPrice),
    prix_plancher: fmtBuyerCad(valuation.suggestedLow),
    prix_plafond: fmtBuyerCad(valuation.suggestedHigh),
    valeur_banquable: fmtBuyerCad(valuation.bankableValue),
    dscr: fmtBuyerDscr(rcd),
    prix_recommande: fmtBuyerCad(
      input.recommendedPrice != null && Number.isFinite(input.recommendedPrice)
        ? input.recommendedPrice
        : valuation.suggestedPrice
    ),
    lecture_vendeur: textOrDash(input.sellerNarrative ?? undefined),
  };

  console.log('PAYLOAD ENVOYÉ À CRAFTMYPDF (ACM vendeur) :', payload);
  console.log('Vérif. couverture CraftMyPDF :', {
    Nom_Residence: payload.Nom_Residence,
    Adresse_Residence: payload.Adresse_Residence,
    Nom_Courtier: payload.Nom_Courtier,
  });
  console.log('Vérif. page 6 CraftMyPDF :', {
    revenus_brut: payload.revenus_brut,
    depenses_exploitation: payload.depenses_exploitation,
    revenus_net_baiia: payload.revenus_net_baiia,
    tga: payload.tga,
    rcd: payload.rcd,
  });

  return payload;
}

function buildFilename(slug: string, stamp: string): string {
  return `primexpert-rapport-acm-vendeur-${slug}-${stamp}.pdf`;
}

export async function downloadAcmVendorReportPdf(
  input: DownloadAcmVendorReportPdfInput
): Promise<void> {
  const payload = buildAcmVendorCraftMyPdfPayload(input);
  const templateId = readAcmVendorTemplateId();
  const blob = await requestCraftMyPdfBlob(templateId, payload as unknown as Record<string, unknown>);

  const slug = (input.residenceId ?? 'acm').replace(/[^a-zA-Z0-9]/g, '').slice(-10);
  const stamp = new Date().toISOString().replace(/[^0-9]/g, '').slice(0, 14);
  triggerBrowserDownload(blob, buildFilename(slug, stamp));
}
