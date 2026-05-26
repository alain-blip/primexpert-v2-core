/**
 * Rapport vendeur (analyse de mise en marché — ACM) — génération cloud CraftMyPDF.
 * Template : VITE_CRAFTMYPDF_ACM_VENDOR_TEMPLATE_ID (défaut PO : acd77b235dc3edba).
 * Payload snake_case aligné sur le gabarit vendeur — distinct du dossier acheteur.
 */

import type { CertifiableReportBrokerFooter } from '@primexpert/core/financial';
import type { ResidenceAcmBootstrap, ValuationOutputs } from '@primexpert/core/valuation';
import { requestCraftMyPdfBlob, triggerBrowserDownload } from './craftMyPdfClient';
import { fmtBuyerCad, fmtBuyerDscr, fmtBuyerPercent } from './buyerReportPdfService';

/** Variables dynamiques CraftMyPDF — rapport vendeur ACM (valeurs formatées en chaînes). */
export interface AcmVendorCraftMyPdfPayload {
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
  tga: string;
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

  const payload: AcmVendorCraftMyPdfPayload = {
    nom_residence: textOrDash(bootstrap.residenceLabel),
    adresse_residence: textOrDash(input.residenceAddress),
    nom_courtier: textOrDash(broker.brokerName),
    titre_courtier: resolveBrokerTitle(broker, locale),
    agence_courtier: textOrDash(broker.agencyName),
    region: textOrDash(bootstrap.regionLabel ?? undefined),
    nombre_unites: bootstrap.units > 0 ? String(bootstrap.units) : '—',
    rbe: fmtBuyerCad(bootstrap.revenuBrutEffectif),
    opex: fmtBuyerCad(opexAmount),
    rne: fmtBuyerCad(bootstrap.revenuNetExploitation),
    prix_demande: fmtBuyerCad(bootstrap.askingPrice),
    prix_suggere: fmtBuyerCad(valuation.suggestedPrice),
    prix_plancher: fmtBuyerCad(valuation.suggestedLow),
    prix_plafond: fmtBuyerCad(valuation.suggestedHigh),
    valeur_banquable: fmtBuyerCad(valuation.bankableValue),
    tga: fmtBuyerPercent(capPct),
    dscr: fmtBuyerDscr(valuation.dscrAtAsking),
    prix_recommande: fmtBuyerCad(
      input.recommendedPrice != null && Number.isFinite(input.recommendedPrice)
        ? input.recommendedPrice
        : valuation.suggestedPrice
    ),
    lecture_vendeur: textOrDash(input.sellerNarrative ?? undefined),
  };

  console.log('PAYLOAD ENVOYÉ À CRAFTMYPDF (ACM vendeur) :', payload);

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
