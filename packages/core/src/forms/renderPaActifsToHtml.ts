/**
 * Rendu HTML natif — Promesse d'achat d'actifs (sans OpenXML / docxtemplater).
 * Feuille de style épurée, compatible impression PDF-A.
 */

import { formatCurrency, formatPrix } from '../utils/formatting';
import {
  PA_ACTIFS_CLAUSE_10_0_NON_CONCURRENCE_FR,
  PA_ACTIFS_CLAUSE_7_2_MAINTIEN_FR,
  PA_ACTIFS_CLAUSE_9_0_TRANSITION_FR,
  PA_ACTIFS_TEMPLATE_SECTIONS,
  type PaActifsTemplateBlock,
} from './templates/paActifsTemplate';
import type { PaActifsRenderData } from './paActifsTypes';

export const PA_ACTIFS_HTML_STYLES = `
@page { size: letter; margin: 22mm 18mm; }
* { box-sizing: border-box; }
body.pa-actifs {
  font-family: 'Times New Roman', 'Libre Baskerville', Georgia, serif;
  font-size: 11pt;
  line-height: 1.45;
  color: #0f172a;
  max-width: 210mm;
  margin: 0 auto;
  padding: 12mm 0;
}
.pa-actifs h1 {
  font-size: 14pt;
  text-align: center;
  letter-spacing: 0.04em;
  margin: 0 0 1.2rem;
  text-transform: uppercase;
}
.pa-actifs h2 {
  font-size: 11pt;
  margin: 1.4rem 0 0.6rem;
  border-bottom: 1px solid #cbd5e1;
  padding-bottom: 0.25rem;
}
.pa-actifs p { margin: 0.5rem 0; text-align: justify; }
.pa-actifs .meta {
  font-size: 9pt;
  color: #475569;
  margin-bottom: 1rem;
}
.pa-actifs .ssot-ref {
  font-size: 9pt;
  background: #f1f5f9;
  border-left: 3px solid #142c6a;
  padding: 0.5rem 0.75rem;
  margin: 0.75rem 0;
}
.pa-actifs .blank-line {
  display: inline-block;
  min-width: 12em;
  border-bottom: 1px solid #334155;
  height: 1.1em;
  vertical-align: bottom;
}
.pa-actifs .sig-block { margin-top: 1.5rem; }
.pa-actifs .sig-row { margin: 0.75rem 0; }
.pa-actifs strong.label { font-weight: 700; }
`;

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function blankLine(): string {
  return '<span class="blank-line" aria-hidden="true">&nbsp;</span>';
}

function interpolate(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => {
    const v = vars[key];
    return v != null ? String(v) : '';
  });
}

function money(amount: number | null | undefined, locale: 'fr' | 'en'): string {
  if (amount == null || !Number.isFinite(amount)) return '—';
  return locale === 'fr' ? formatPrix(amount) : formatCurrency(amount, { locale: 'en-CA' });
}

function pct(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return '—';
  return `${v.toFixed(2)} %`;
}

const DYNAMIC_RENDERERS: Record<string, (data: PaActifsRenderData) => string[]> = {
  partiesHeader: (d) => {
    const fr = d.locale === 'fr';
    return [
      fr
        ? `Par : <strong>${escapeHtml(d.buyer.fullName)}</strong>${d.buyer.address ? `, domicilié au ${escapeHtml(d.buyer.address)}` : ''} (ci-après : «&nbsp;ACHETEUR&nbsp;»);`
        : `By: <strong>${escapeHtml(d.buyer.fullName)}</strong> (hereinafter "BUYER");`,
      fr
        ? `À : <strong>${escapeHtml(d.vendor.legalName)}</strong>, ayant son siège au ${escapeHtml(d.vendor.address)}${d.vendor.presidentName ? `, représentée par ${escapeHtml(d.vendor.presidentName)}` : ''}${d.vendor.secretaryName ? ` et ${escapeHtml(d.vendor.secretaryName)}, secrétaire` : ''} (ci-après : le «&nbsp;VENDEUR&nbsp;»);`
        : `To: <strong>${escapeHtml(d.vendor.legalName)}</strong> (hereinafter "SELLER");`,
      fr
        ? `Courtier : ${escapeHtml(d.broker.displayName)}, permis OACIQ ${escapeHtml(d.broker.licenseNumber)}, ${escapeHtml(d.broker.agencyName)}.`
        : `Broker: ${escapeHtml(d.broker.displayName)}, OACIQ ${escapeHtml(d.broker.licenseNumber)}.`,
    ];
  },
  preamble: (d) => [
    d.locale === 'fr'
      ? `ATTENDU QUE l'acheteur promet d'acheter l'entreprise ci-après décrite, aux prix et conditions énoncés, par l'intermédiaire de ${escapeHtml(d.broker.displayName)}, courtier immobilier.`
      : `WHEREAS the buyer undertakes to purchase the business described below on the terms set forth herein.`,
  ],
  designationEntreprise: (d) =>
    [
      d.locale === 'fr'
        ? `Nom de la résidence : <strong>${escapeHtml(d.residence.commercialName)}</strong>. Adresse : ${escapeHtml(d.residence.civicAddress)}${d.residence.city ? `, ${escapeHtml(d.residence.city)}` : ''}${d.residence.regionAdministrative ? ` (${escapeHtml(d.residence.regionAdministrative)})` : ''}.`
        : `Property: ${escapeHtml(d.residence.commercialName)} — ${escapeHtml(d.residence.civicAddress)}.`,
      d.residence.cadastralDesignation
        ? `Désignation cadastrale : ${escapeHtml(d.residence.cadastralDesignation)}.`
        : '',
      d.residence.superficiePi2 ? `Superficie : ${escapeHtml(d.residence.superficiePi2)}.` : '',
    ].filter(Boolean),
  prixEtPaiement: (d) => {
    const f = d.financial;
    return [
      `Le prix d'achat total est de <strong>${money(f.prixTotal, d.locale)}</strong>, payable selon les modalités suivantes :`,
      `Mise de fonds : ${money(f.miseDeFonds, d.locale)}.`,
      `Balance de prix de vente (financement vendeur) : ${money(f.balancePrixVente, d.locale)}.`,
      `Solde — nouvel emprunt hypothécaire : ${money(f.soldeNouvelEmprunt, d.locale)}.`,
    ];
  },
  referenceAcmFinanciere: (d) => {
    const f = d.financial;
    const lines = [
      `Revenu brut effectif (RBE) de référence : ${money(f.revenuBrutEffectif, d.locale)}.`,
      `Revenu net d'exploitation (RNE) : ${money(f.revenuNetExploitation, d.locale)}.`,
    ];
    if (f.tgaAppliquePct != null) {
      lines.push(
        `Taux de capitalisation global (TGA) retenu : ${pct(f.tgaAppliquePct)}` +
          (f.tgaAjustementQualitatifPct !== 0
            ? ` (médiane territoriale ${pct(f.tgaMedianTerritorialPct)} + ajustement ${pct(f.tgaAjustementQualitatifPct)})`
            : f.territorialSampleCount > 0
              ? ` (médiane territoriale, n=${f.territorialSampleCount})`
              : '') +
          '.'
      );
    }
    if (f.valeurMarchandeIndicative != null) {
      lines.push(
        `Valeur marchande indicative (RNE ÷ TGA) : ${money(f.valeurMarchandeIndicative, d.locale)}.`
      );
    }
    if (d.territorial?.regionAdministrative) {
      lines.push(
        `Territoire comparables : ${escapeHtml(d.territorial.regionAdministrative)}${d.territorial.classeImmeuble ? ` · ${escapeHtml(d.territorial.classeImmeuble)}` : ''}.`
      );
    }
    return lines;
  },
  maintienOperations72: () => [PA_ACTIFS_CLAUSE_7_2_MAINTIEN_FR],
  periodeTransition90: (d) => [
    interpolate(PA_ACTIFS_CLAUSE_9_0_TRANSITION_FR, {
      transitionHeuresMax: d.clauses.transitionHeuresMax,
      transitionJoursMax: d.clauses.transitionJoursMax,
    }),
  ],
  nonConcurrence100: (d) => [
    interpolate(PA_ACTIFS_CLAUSE_10_0_NON_CONCURRENCE_FR, {
      nonConcurrenceAnnees: d.clauses.nonConcurrenceAnnees,
      nonConcurrenceRayonKm: d.clauses.nonConcurrenceRayonKm,
    }),
  ],
  delaiAcceptation: (d) => [
    d.promesse.dateReception
      ? `Délai d'acceptation : offre reçue le ${escapeHtml(d.promesse.dateReception)}.`
      : `Délai d'acceptation : ${blankLine()}.`,
  ],
  blocSignatures: (d) => [
    `<div class="sig-block">En foi de quoi, l'acheteur a signé à ${d.signatures.lieu ? escapeHtml(d.signatures.lieu) : blankLine()}, le ${d.signatures.date ? escapeHtml(d.signatures.date) : blankLine()}, à ${d.signatures.heure ? escapeHtml(d.signatures.heure) : blankLine()}.</div>`,
    `<div class="sig-row"><span class="label">ACHETEUR</span> — ${escapeHtml(d.buyer.fullName)}${d.buyer.authorizedSignatory ? `, par : ${escapeHtml(d.buyer.authorizedSignatory)} dûment autorisé(e)` : ''}<br/>${blankLine()}</div>`,
    `<div class="sig-row"><span class="label">VENDEUR</span> — ${escapeHtml(d.vendor.legalName)}<br/>${blankLine()}</div>`,
  ],
};

function renderBlock(block: PaActifsTemplateBlock, data: PaActifsRenderData): string {
  if (block.kind === 'heading' && block.text) {
    return `<h1>${escapeHtml(block.text)}</h1>`;
  }
  if (block.kind === 'static' && block.text) {
    return `<p>${escapeHtml(block.text)}</p>`;
  }
  if (block.kind === 'dynamic' && block.dynamicKey) {
    const fn = DYNAMIC_RENDERERS[block.dynamicKey];
    if (!fn) return '';
    return fn(data)
      .map((html) => (html.startsWith('<') ? html : `<p>${html}</p>`))
      .join('\n');
  }
  return '';
}

/** Assemble le document HTML complet à partir du gabarit structurel et des données SSOT. */
export function renderPaActifsToHtml(data: PaActifsRenderData): string {
  const title =
    data.locale === 'fr' ? "Promesse d'achat d'actifs" : 'Asset purchase promise';
  const sectionsHtml = PA_ACTIFS_TEMPLATE_SECTIONS.map((section) => {
    const sectionTitle = data.locale === 'fr' ? section.titleFr : section.titleEn;
    const body = section.blocks.map((b) => renderBlock(b, data)).join('\n');
    return `<section id="${escapeHtml(section.id)}">
<h2>${escapeHtml(section.number)}. ${escapeHtml(sectionTitle)}</h2>
${body}
</section>`;
  }).join('\n');

  const metaRef = data.referenceId ? `Réf. ${escapeHtml(data.referenceId)} · ` : '';

  return `<!DOCTYPE html>
<html lang="${data.locale === 'fr' ? 'fr-CA' : 'en-CA'}">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>${escapeHtml(title)}</title>
<style>${PA_ACTIFS_HTML_STYLES}</style>
</head>
<body class="pa-actifs">
<p class="meta">${metaRef}Généré le ${escapeHtml(data.generatedAtIso)} — PrimeXpert (générateur natif, sans fusion OpenXML)</p>
${sectionsHtml}
<p class="ssot-ref">Données financières : revenu net d'exploitation (RNE) et taux de capitalisation global (TGA) issus du module ACM V3.2 et de la grille financière V2 validée. Ce document ne remplace pas l'avis juridique d'un notaire ou avocat.</p>
</body>
</html>`;
}
