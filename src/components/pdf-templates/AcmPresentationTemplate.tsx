/**
 * Présentation ACM — gabarit magazine institutionnel (React + Tailwind).
 * Page 2 : À propos (bouclier déontologique avant les chiffres).
 * Page 4 : Le Cœur Stratégique (tuiles calculatedResults).
 */

import type { AcmPresentationReportModel } from '@primexpert/core/financial';

const GOLD = '#D4AF37';
const NAVY = '#142c6a';
const INK = '#121212';

const PAGE =
  'pdf-page-break relative box-border flex min-h-[11in] w-[8.5in] flex-col bg-white text-[#1a1a1a]';

function PdfPageFooter({
  model,
  page,
  total,
}: {
  model: AcmPresentationReportModel;
  page: number;
  total: number;
}) {
  const L = model.locale === 'fr';
  const broker = model.broker;
  const line = [
    broker.brokerName,
    broker.licenseNumber && broker.licenseNumber !== '—'
      ? `${L ? 'Permis' : 'License'} : ${broker.licenseNumber}`
      : null,
    broker.agencyName,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <footer
      className="mt-auto shrink-0 border-t-2 px-[0.65in] pb-[0.45in] pt-3"
      style={{ borderColor: GOLD }}
    >
      <p className="text-[7pt] text-neutral-600">
        {L ? 'Généré le' : 'Generated'} : {model.generatedAtDisplay}
      </p>
      <div className="mt-1 flex items-end justify-between gap-4 text-[7pt] text-neutral-700">
        <p className="min-w-0 flex-1 leading-snug">{line}</p>
        <p className="shrink-0 font-semibold tabular-nums">
          {L ? 'Page' : 'Page'} {page} / {total}
        </p>
      </div>
    </footer>
  );
}

/** En-tête intérieur — charte Canva « Blue White Modern Business Annual Report ». */
function PdfLightHeader({
  subtitle,
  pageLabel,
}: {
  subtitle: string;
  pageLabel?: string;
}) {
  return (
    <header className="shrink-0">
      <div
        className="flex items-center px-[0.65in] py-3"
        style={{ backgroundColor: NAVY }}
      >
        <span className="text-[10pt] font-black tracking-[0.12em] text-white">
          PRIMEXPERT · ACM
        </span>
        <span className="ml-4 text-[8pt] font-medium uppercase tracking-[0.14em] text-blue-100/90">
          {subtitle}
        </span>
        {pageLabel ? (
          <span
            className="ml-auto text-[28pt] font-black leading-none text-white/15 tabular-nums"
            aria-hidden
          >
            {pageLabel}
          </span>
        ) : null}
      </div>
      <div className="flex h-[4px] w-full">
        <div className="flex-[3]" style={{ backgroundColor: NAVY }} />
        <div className="flex-1" style={{ backgroundColor: GOLD }} />
      </div>
    </header>
  );
}

function CoverPage({ model }: { model: AcmPresentationReportModel }) {
  const L = model.locale === 'fr';
  return (
    <section className={`${PAGE} pdf-page-break flex-row overflow-hidden`}>
      <div
        className="flex w-[38%] shrink-0 flex-col justify-between px-[0.55in] py-[0.75in]"
        style={{ backgroundColor: NAVY }}
      >
        <div>
          <p className="text-[20pt] font-black tracking-tight text-white">PRIMEXPERT</p>
          <p
            className="mt-3 text-[9pt] font-semibold uppercase tracking-[0.22em] text-blue-100"
          >
            {L ? 'Rapport annuel institutionnel' : 'Institutional annual report'}
          </p>
        </div>
        <p className="text-[8pt] leading-relaxed text-blue-100/80">
          {L
            ? 'Blue White Modern · Équipe Alain St-Jean'
            : 'Blue White Modern · Alain St-Jean team'}
        </p>
      </div>
      <div className="flex min-w-0 flex-1 flex-col bg-white px-[0.65in] pt-[0.85in]">
        <p
          className="text-[11pt] font-semibold uppercase tracking-[0.2em]"
          style={{ color: NAVY }}
        >
          {L ? 'Présentation de mise en marché' : 'Market launch presentation'}
        </p>
        <h1
          className="mt-8 max-w-[4.2in] text-[16pt] font-bold leading-snug"
          style={{ color: INK }}
        >
          {model.coverTitle}
        </h1>
        <div className="my-7 h-px w-full max-w-[3in]" style={{ backgroundColor: GOLD }} />
        <div>
          <p
            className="text-[9pt] font-bold uppercase tracking-[0.15em]"
            style={{ color: NAVY }}
          >
            {L ? 'Courtier responsable' : 'Responsible broker'}
          </p>
          <p className="mt-3 text-[12pt] font-semibold text-black">{model.broker.brokerName}</p>
          <p className="mt-1 text-[10pt] text-neutral-600">{model.broker.titleLine}</p>
          <p className="mt-1 text-[10pt] text-neutral-600">{model.broker.agencyName}</p>
          {model.broker.phone ? (
            <p className="mt-1 text-[10pt] text-neutral-500">{model.broker.phone}</p>
          ) : null}
          {model.broker.licenseNumber && model.broker.licenseNumber !== '—' ? (
            <p className="mt-2 text-[8pt] text-neutral-500">
              {L ? 'Permis OACIQ' : 'OACIQ license'} : {model.broker.licenseNumber}
            </p>
          ) : null}
        </div>
        <p className="mt-auto pb-[0.35in] text-[8pt] italic text-neutral-500">
          {L
            ? 'Document confidentiel — aucune photographie de la propriété'
            : 'Confidential document — no property photograph'}
        </p>
        <PdfPageFooter model={model} page={1} total={6} />
      </div>
    </section>
  );
}

/** Page 2 — bouclier déontologique (avant données financières). */
function AboutDocumentPage({ model }: { model: AcmPresentationReportModel }) {
  const L = model.locale === 'fr';
  const clauses = L ? model.deontologicalClauseFr : model.deontologicalClauseEn;

  const intro = L
    ? [
        'Ce document constitue une présentation stratégique préparée par votre courtier immobilier agréé dans le cadre d’une démarche de mise en marché institutionnelle. Il vise à structurer la conversation mandat et le positionnement marché — sans divulguer d’éléments visuels de la propriété.',
        'Important : ce livrable ne constitue pas une évaluation agréée au sens de la Loi sur les évaluateurs et évaluatrices agréés du Québec (non-évaluation agréée). Toute valeur marchande affichée repose sur l’analyse comparative de marché (ACM) et les repères sectoriels du moteur PrimeXpert.',
        'Les chiffres de finançabilité proviennent exclusivement de l’objet calculé immuable financial/dataV2.calculatedResults. Aucune formule n’est recalculée dans ce rendu PDF.',
      ]
    : [
        'This document is a strategic presentation prepared by your licensed real estate broker as part of an institutional go-to-market process. It structures the mandate conversation and market positioning — without disclosing visual property elements.',
        'Important: this deliverable is not a certified appraisal under Québec appraiser legislation (not a certified appraisal). Any market value shown relies on comparative market analysis (CMA) and PrimeXpert sector benchmarks.',
        'Financing figures come exclusively from the immutable object financial/dataV2.calculatedResults. No formulas are recalculated in this PDF render.',
      ];

  return (
    <section
      className={`${PAGE} pdf-page-break`}
      style={{
        background: 'linear-gradient(180deg, #f0f5fb 0%, #ffffff 28%)',
      }}
    >
      <PdfLightHeader
        subtitle={L ? 'À propos de ce document' : 'About this document'}
        pageLabel="02"
      />
      <div className="flex flex-1 flex-col px-[0.75in] py-[0.55in]">
        <p
          className="text-[9pt] font-black uppercase tracking-[0.22em]"
          style={{ color: NAVY }}
        >
          {L ? 'Présentation confidentielle' : 'Confidential presentation'}
        </p>
        <h2 className="mt-3 text-[22pt] font-black leading-tight text-black">
          {L ? 'À propos de ce document' : 'About this document'}
        </h2>
        <div
          className="mt-6 rounded-sm border-l-4 bg-white/80 px-5 py-4 shadow-sm"
          style={{ borderColor: GOLD }}
        >
          <p className="text-[10pt] font-bold uppercase tracking-wide" style={{ color: NAVY }}>
            {L ? 'Non-évaluation agréée' : 'Not a certified appraisal'}
          </p>
          <p className="mt-2 text-[9.5pt] leading-relaxed text-neutral-800">
            {L
              ? 'Le vendeur reconnaît que le courtier n’agit pas à titre d’évaluateur agréé et que les conclusions de marché sont des repères transactionnels, non des certificats d’évaluation.'
              : 'The seller acknowledges that the broker is not acting as a certified appraiser and that market conclusions are transactional benchmarks, not appraisal certificates.'}
          </p>
        </div>
        <div className="mt-8 space-y-5">
          {intro.map((p, i) => (
            <p key={i} className="text-[10.5pt] leading-[1.65] text-neutral-800">
              {p}
            </p>
          ))}
        </div>
        <div className="mt-10">
          <p
            className="text-[9pt] font-black uppercase tracking-[0.18em]"
            style={{ color: NAVY }}
          >
            {L ? 'Bouclier déontologique' : 'Deontological shield'}
          </p>
          <ul className="mt-4 space-y-4">
            {clauses.map((c, i) => (
              <li key={i} className="flex gap-3 text-[10pt] leading-[1.6] text-neutral-800">
                <span
                  className="mt-[0.35em] h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: GOLD }}
                />
                <span>{c}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <PdfPageFooter model={model} page={2} total={6} />
    </section>
  );
}

function MarketPositionPage({ model }: { model: AcmPresentationReportModel }) {
  const L = model.locale === 'fr';
  const body = L ? model.marketConclusionFr : model.marketConclusionEn;

  return (
    <section className={`${PAGE} pdf-page-break`}>
      <PdfLightHeader
        subtitle={
          L ? 'Positionnement marché (ACM)' : 'Market positioning (CMA)'
        }
      />
      <div className="flex flex-1 flex-col px-[0.75in] py-[0.55in]">
        <h2 className="text-[18pt] font-black" style={{ color: INK }}>
          {L ? 'Positionnement marché (ACM)' : 'Market positioning (CMA)'}
        </h2>
        <div
          className="mt-6 rounded-md border-2 bg-neutral-50 px-5 py-5"
          style={{ borderColor: GOLD }}
        >
          <p className="text-[9pt] font-bold uppercase tracking-wide text-neutral-600">
            {L ? 'Valeur marchande retenue' : 'Retained market value'}
          </p>
          <p className="mt-2 text-[22pt] font-black tabular-nums" style={{ color: INK }}>
            {model.marketValueDisplay}
          </p>
          <p className="mt-3 text-[10pt] text-neutral-700">
            {L ? 'Taux de capitalisation (TGA) médian secteur' : 'Median sector cap rate'} :{' '}
            <span className="font-bold">{model.marketCapRateDisplay}</span>
          </p>
        </div>
        <p className="mt-8 text-[11pt] leading-[1.7] text-neutral-800">{body}</p>
        <p className="mt-auto text-[9pt] italic text-neutral-500">
          {L ? `Secteur : ${model.sectorRegion}` : `Sector: ${model.sectorRegion}`}
        </p>
      </div>
      <PdfPageFooter model={model} page={3} total={6} />
    </section>
  );
}

/** Page 4 — Le Cœur Stratégique (tuiles KPI, SSOT calculatedResults). */
function StrategicCorePage({ model }: { model: AcmPresentationReportModel }) {
  const L = model.locale === 'fr';

  return (
    <section
      className={`${PAGE} pdf-page-break`}
      style={{ backgroundColor: '#fafafa' }}
    >
      <PdfLightHeader
        subtitle={L ? 'Le Cœur Stratégique' : 'The Strategic Core'}
        pageLabel="04"
      />
      <div className="flex flex-1 flex-col px-[0.75in] py-[0.5in]">
        <p
          className="text-[9pt] font-black uppercase tracking-[0.2em]"
          style={{ color: NAVY }}
        >
          {L ? 'Finançabilité institutionnelle' : 'Institutional financing'}
        </p>
        <h2 className="mt-2 text-[20pt] font-black leading-tight" style={{ color: INK }}>
          {L ? 'Le Cœur Stratégique' : 'The Strategic Core'}
        </h2>
        <p className="mt-3 max-w-[6.2in] text-[10pt] leading-relaxed text-neutral-700">
          {L
            ? 'Grille alimentée par financial/dataV2.calculatedResults — lecture acheteur institutionnel, sans recalcul local.'
            : 'Grid powered by financial/dataV2.calculatedResults — institutional buyer view, no local recalculation.'}
        </p>
        <div className="mt-8 grid flex-1 grid-cols-2 gap-4 content-start">
          {model.financingTiles.map((tile, i) => {
            const label = L ? tile.labelFr : tile.labelEn;
            return (
              <div
                key={i}
                className="flex min-h-[1.65in] flex-col justify-between rounded-md border-2 bg-white px-4 py-4 shadow-sm"
                style={{ borderColor: GOLD }}
              >
                <p className="text-[8.5pt] font-bold uppercase leading-snug tracking-wide text-neutral-600">
                  {label}
                </p>
                <p
                  className="mt-4 text-[17pt] font-black tabular-nums leading-none"
                  style={{ color: INK }}
                >
                  {tile.value}
                </p>
              </div>
            );
          })}
        </div>
        <div
          className="mt-6 rounded-md px-4 py-3 text-[9pt] leading-relaxed text-neutral-700"
          style={{ backgroundColor: 'rgba(20,44,106,0.06)' }}
        >
          {L
            ? `Valeur marchande de référence : ${model.marketValueDisplay} · Taux de capitalisation (TGA) : ${model.marketCapRateDisplay}`
            : `Reference market value: ${model.marketValueDisplay} · Cap rate: ${model.marketCapRateDisplay}`}
        </div>
      </div>
      <PdfPageFooter model={model} page={4} total={6} />
    </section>
  );
}

function LaunchPlanPage({ model }: { model: AcmPresentationReportModel }) {
  const L = model.locale === 'fr';
  const bullets = L ? model.launchActionsFr : model.launchActionsEn;

  return (
    <section className={`${PAGE} pdf-page-break`}>
      <PdfLightHeader
        subtitle={
          L ? 'Plan de mise en marché stratégique' : 'Strategic launch plan'
        }
      />
      <div className="flex flex-1 flex-col px-[0.75in] py-[0.55in]">
        <h2 className="text-[18pt] font-black" style={{ color: INK }}>
          {L ? 'Plan de mise en marché stratégique' : 'Strategic launch plan'}
        </h2>
        <ul className="mt-8 space-y-6">
          {bullets.map((item, i) => (
            <li key={i} className="flex gap-4">
              <span
                className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: GOLD }}
              />
              <p className="text-[11pt] leading-[1.65] text-neutral-800">{item}</p>
            </li>
          ))}
        </ul>
      </div>
      <PdfPageFooter model={model} page={5} total={6} />
    </section>
  );
}

function MandateSignaturePage({ model }: { model: AcmPresentationReportModel }) {
  const L = model.locale === 'fr';
  const fields = L
    ? [
        'Prix demandé approuvé : _________________________________________________',
        'Durée du mandat (1 an) : _________________________________________________',
        'Signature du vendeur : __________________________________________________',
        'Date : __________________________________________________________________',
      ]
    : [
        'Approved asking price : _________________________________________________',
        'Mandate term (1 year) : _________________________________________________',
        'Seller signature : ______________________________________________________',
        'Date : __________________________________________________________________',
      ];

  return (
    <section className={PAGE}>
      <PdfLightHeader
        subtitle={L ? 'Approbation du mandat' : 'Mandate approval'}
      />
      <div className="flex flex-1 flex-col px-[0.75in] py-[0.55in]">
        <h2 className="text-[18pt] font-black" style={{ color: INK }}>
          {L ? 'Approbation du mandat' : 'Mandate approval'}
        </h2>
        <p className="mt-4 text-[10pt] leading-relaxed text-neutral-700">
          {L
            ? 'En signant, le vendeur confirme avoir pris connaissance de la présentation, du caractère non évaluatif du document et des engagements déontologiques du courtier.'
            : 'By signing, the seller confirms having reviewed the presentation, the non-appraisal nature of this document, and the broker’s deontological commitments.'}
        </p>
        <div className="mt-10 space-y-8">
          {fields.map((f, i) => (
            <p key={i} className="border-b border-neutral-300 pb-2 text-[11pt] text-neutral-800">
              {f}
            </p>
          ))}
        </div>
      </div>
      <PdfPageFooter model={model} page={6} total={6} />
    </section>
  );
}

export interface AcmPresentationTemplateProps {
  model: AcmPresentationReportModel;
}

export function AcmPresentationTemplate({ model }: AcmPresentationTemplateProps) {
  return (
    <div
      id="acm-presentation-pdf-root"
      className="bg-white font-sans antialiased"
      style={{ width: '8.5in' }}
    >
      <CoverPage model={model} />
      <AboutDocumentPage model={model} />
      <MarketPositionPage model={model} />
      <StrategicCorePage model={model} />
      <LaunchPlanPage model={model} />
      <MandateSignaturePage model={model} />
    </div>
  );
}
