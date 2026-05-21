/**
 * Rapport financier détaillé — gabarit magazine (React + Tailwind).
 * Calqué sur AcmPresentationTemplate — charte Canva bleu/blanc/or.
 */

import type { DetailedFinancialReportModel } from '@primexpert/core/financial';

const GOLD = '#D4AF37';
const NAVY = '#142c6a';
const INK = '#121212';
const EXPENSE_ROWS_PER_PAGE = 16;

const PAGE =
  'pdf-page-break relative box-border flex min-h-[11in] w-[8.5in] flex-col bg-white text-[#1a1a1a]';

function chunk<T>(items: T[], size: number): T[][] {
  if (items.length === 0) return [[]];
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

function computeTotalPages(model: DetailedFinancialReportModel): number {
  const expenseChunks = chunk(model.expenseRows, EXPENSE_ROWS_PER_PAGE);
  return 2 + 1 + expenseChunks.length + 1 + 1;
}

function PdfPageFooter({
  model,
  page,
  total,
}: {
  model: DetailedFinancialReportModel;
  page: number;
  total: number;
}) {
  const L = model.locale === 'fr';
  const legal = L ? model.legalFooterFr : model.legalFooterEn;
  const compliance = L ? model.complianceLineFr : model.complianceLineEn;
  const broker = model.broker;
  const brokerLine = [
    broker.brokerName,
    broker.licenseNumber !== '—'
      ? `${L ? 'Permis OACIQ' : 'OACIQ license'} : ${broker.licenseNumber}`
      : null,
    broker.agencyName,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <footer
      className="mt-auto shrink-0 border-t-2 px-[0.55in] pb-[0.4in] pt-2.5"
      style={{ borderColor: GOLD }}
    >
      <p className="text-[6pt] leading-snug text-neutral-600">{legal}</p>
      <p className="mt-1 text-[6pt] font-semibold leading-snug" style={{ color: NAVY }}>
        {compliance}
      </p>
      <p className="mt-1 text-[6.5pt] text-neutral-600 tabular-nums">
        {L ? 'Horodatage WORM' : 'WORM timestamp'} : {model.generatedAtDisplay}
      </p>
      <div className="mt-1 flex items-end justify-between gap-3 text-[6.5pt] text-neutral-700">
        <p className="min-w-0 flex-1 leading-snug">{brokerLine}</p>
        <p className="shrink-0 font-bold tabular-nums">
          {L ? 'Page' : 'Page'} {page} / {total}
        </p>
      </div>
    </footer>
  );
}

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
          PRIMEXPERT · FINANCE
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

function CoverPage({
  model,
  total,
}: {
  model: DetailedFinancialReportModel;
  total: number;
}) {
  const L = model.locale === 'fr';
  return (
    <section
      className={`${PAGE} pdf-page-break overflow-hidden`}
      style={{
        background: `linear-gradient(145deg, ${INK} 0%, #1a2744 45%, ${NAVY} 100%)`,
      }}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage:
            'repeating-linear-gradient(-12deg, transparent, transparent 8px, #fff 8px, #fff 9px)',
        }}
      />
      <div className="relative flex flex-1 flex-col px-[0.75in] pt-[0.9in]">
        <p className="text-[22pt] font-black tracking-tight text-white">PRIMEXPERT</p>
        <p
          className="mt-2 text-[10pt] font-semibold uppercase tracking-[0.22em]"
          style={{ color: GOLD }}
        >
          {L ? 'Hub Finance · Confort 66+' : 'Finance Hub · Comfort 66+'}
        </p>
        <h1 className="mt-12 max-w-[6.5in] text-[20pt] font-black leading-tight text-white">
          {L
            ? 'Rapport d’Analyse Financière Détaillée'
            : 'Detailed Financial Analysis Report'}
        </h1>
        <p className="mt-4 text-[12pt] font-semibold text-blue-100">{model.propertyTitle}</p>
        <p className="mt-2 text-[10pt] text-neutral-300">{model.propertyAddress}</p>
        <div className="my-8 h-px w-full max-w-[4in]" style={{ backgroundColor: GOLD }} />
        <div>
          <p
            className="text-[9pt] font-bold uppercase tracking-[0.15em]"
            style={{ color: GOLD }}
          >
            {L ? 'Courtier responsable' : 'Responsible broker'}
          </p>
          <p className="mt-3 text-[12pt] font-semibold text-white">{model.broker.brokerName}</p>
          <p className="mt-1 text-[10pt] text-neutral-300">
            {L ? 'Courtier immobilier agréé DA' : 'Licensed real estate broker (DA)'}
          </p>
          <p className="mt-1 text-[10pt] text-neutral-300">{model.broker.agencyName}</p>
          {model.broker.licenseNumber !== '—' ? (
            <p className="mt-2 text-[8pt] text-neutral-400">
              {L ? 'Permis OACIQ' : 'OACIQ license'} : {model.broker.licenseNumber}
            </p>
          ) : null}
        </div>
        <p className="mt-auto pb-[0.25in] text-[8pt] italic text-neutral-500">
          {L
            ? 'Document institutionnel — aucune photographie de l’immeuble'
            : 'Institutional document — no property photograph'}
        </p>
      </div>
      <div className="relative h-[12px] w-full shrink-0" style={{ backgroundColor: GOLD }} />
      <PdfPageFooter model={model} page={1} total={total} />
    </section>
  );
}

function AboutPage({
  model,
  total,
}: {
  model: DetailedFinancialReportModel;
  total: number;
}) {
  const L = model.locale === 'fr';
  const intro = L ? model.aboutIntroFr : model.aboutIntroEn;
  const clauses = L ? model.deontologicalClauseFr : model.deontologicalClauseEn;

  return (
    <section
      className={`${PAGE} pdf-page-break`}
      style={{ background: 'linear-gradient(180deg, #f0f5fb 0%, #ffffff 30%)' }}
    >
      <PdfLightHeader
        subtitle={L ? 'À propos de ce document' : 'About this document'}
        pageLabel="02"
      />
      <div className="flex flex-1 flex-col px-[0.75in] py-[0.5in]">
        <h2 className="text-[22pt] font-black leading-tight" style={{ color: INK }}>
          {L ? 'À propos de ce document' : 'About this document'}
        </h2>
        <div
          className="mt-5 rounded-sm border-l-4 bg-white/90 px-5 py-4 shadow-sm"
          style={{ borderColor: GOLD }}
        >
          <p className="text-[10pt] font-bold uppercase tracking-wide" style={{ color: NAVY }}>
            {L ? 'Non-évaluation agréée' : 'Not a certified appraisal'}
          </p>
          <p className="mt-2 text-[9.5pt] leading-relaxed text-neutral-800">
            {clauses[0]}
          </p>
        </div>
        <div className="mt-6 space-y-4">
          {intro.map((p, i) => (
            <p key={i} className="text-[10pt] leading-[1.65] text-neutral-800">
              {p}
            </p>
          ))}
        </div>
        <div className="mt-8">
          <p
            className="text-[9pt] font-black uppercase tracking-[0.18em]"
            style={{ color: NAVY }}
          >
            {L ? 'Protection et avertissements' : 'Protection and warnings'}
          </p>
          <ul className="mt-3 space-y-3">
            {clauses.slice(1).map((c, i) => (
              <li key={i} className="flex gap-3 text-[9.5pt] leading-[1.6] text-neutral-800">
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
      <PdfPageFooter model={model} page={2} total={total} />
    </section>
  );
}

function SummaryTilesPage({
  model,
  total,
}: {
  model: DetailedFinancialReportModel;
  total: number;
}) {
  const L = model.locale === 'fr';
  const tiles = [
    {
      label: L ? 'Revenu brut effectif (RBE)' : 'Effective gross income (EGI)',
      value: model.revenueSummary.rbe,
    },
    {
      label: L ? 'Revenus annuels déclarés' : 'Declared annual revenue',
      value: model.revenueSummary.revenusAnnuels,
    },
    {
      label: L ? 'Total dépenses normalisées' : 'Total normalized expenses',
      value: model.totals.depensesNormalisees,
    },
    {
      label: L ? 'Revenu net d’exploitation (RNE)' : 'Net operating income (NOI)',
      value: model.totals.rne,
    },
  ];

  return (
    <section className={`${PAGE} pdf-page-break`} style={{ backgroundColor: '#fafafa' }}>
      <PdfLightHeader
        subtitle={L ? 'Vue synthèse' : 'Summary view'}
        pageLabel="03"
      />
      <div className="flex flex-1 flex-col px-[0.75in] py-[0.5in]">
        <h2 className="text-[18pt] font-black" style={{ color: INK }}>
          {L ? 'Indicateurs clés — Confort 66+' : 'Key indicators — Comfort 66+'}
        </h2>
        <div className="mt-6 grid grid-cols-2 gap-4">
          {tiles.map((tile, i) => (
            <div
              key={i}
              className="pdf-avoid-break flex min-h-[1.5in] flex-col justify-between rounded-md border bg-white px-4 py-4 shadow-sm"
              style={{ borderColor: GOLD }}
            >
              <p className="text-[8pt] font-bold uppercase leading-snug tracking-wide text-neutral-600">
                {tile.label}
              </p>
              <p
                className="mt-3 text-[16pt] font-black tabular-nums leading-none"
                style={{ color: INK }}
              >
                {tile.value}
              </p>
            </div>
          ))}
        </div>
      </div>
      <PdfPageFooter model={model} page={3} total={total} />
    </section>
  );
}

function ExpenseTableSection({
  model,
  rows,
  pageIndex,
  pageNumber,
  total,
  isFirst,
  isLastChunk,
}: {
  model: DetailedFinancialReportModel;
  rows: DetailedFinancialReportModel['expenseRows'];
  pageIndex: number;
  pageNumber: number;
  total: number;
  isFirst: boolean;
  isLastChunk: boolean;
}) {
  const L = model.locale === 'fr';

  return (
    <section className={`${PAGE} pdf-page-break`}>
      <PdfLightHeader
        subtitle={
          isFirst
            ? L
              ? 'Le Cœur Financier — ventilation'
              : 'Financial core — breakdown'
            : L
              ? 'Dépenses (suite)'
              : 'Expenses (continued)'
        }
        pageLabel={isFirst ? '04' : undefined}
      />
      <div className="flex flex-1 flex-col px-[0.55in] py-[0.45in]">
        {isFirst ? (
          <h2 className="text-[17pt] font-black" style={{ color: INK }}>
            {L
              ? 'Ventilation des revenus et dépenses'
              : 'Revenue and expense breakdown'}
          </h2>
        ) : null}
        <div
          className={`overflow-hidden rounded-md border-2 ${isFirst ? 'mt-4' : 'mt-2'}`}
          style={{ borderColor: GOLD }}
        >
          <table className="w-full border-collapse text-[8.5pt]">
            <thead>
              <tr style={{ backgroundColor: NAVY }} className="text-white">
                <th className="px-3 py-2 text-left font-bold">
                  {L ? 'Poste' : 'Line item'}
                </th>
                <th className="px-3 py-2 text-right font-bold tabular-nums">
                  {L ? 'Déclaré (Vendeur)' : 'Declared (Seller)'}
                </th>
                <th className="px-3 py-2 text-right font-bold tabular-nums">
                  {L ? 'Normalisé (Courtier)' : 'Normalized (Broker)'}
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr
                  key={`${pageIndex}-${i}`}
                  className={`pdf-table-row pdf-avoid-break border-b border-neutral-200 ${
                    i % 2 === 0 ? 'bg-neutral-50' : 'bg-white'
                  }`}
                >
                  <td className="px-3 py-2 font-medium text-neutral-800">{row.label}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{row.declared}</td>
                  <td className="px-3 py-2 text-right font-semibold tabular-nums">
                    {row.normalized}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {isLastChunk ? (
          <div
            className="pdf-avoid-break mt-4 rounded-md border-2 px-4 py-3"
            style={{ borderColor: GOLD, backgroundColor: 'rgba(212,175,55,0.12)' }}
          >
            <div className="flex justify-between text-[9pt] font-bold tabular-nums">
              <span>{L ? 'Total dépenses déclarées' : 'Total declared expenses'}</span>
              <span>{model.totals.depensesDeclarees}</span>
            </div>
            <div className="mt-2 flex justify-between text-[9pt] font-bold tabular-nums">
              <span>{L ? 'Total dépenses normalisées' : 'Total normalized expenses'}</span>
              <span>{model.totals.depensesNormalisees}</span>
            </div>
            <div
              className="mt-3 flex justify-between border-t pt-2 text-[11pt] font-black tabular-nums"
              style={{ borderColor: GOLD, color: INK }}
            >
              <span>
                {L ? 'Revenu net d’exploitation (RNE)' : 'Net operating income (NOI)'}
              </span>
              <span>{model.totals.rne}</span>
            </div>
          </div>
        ) : null}
      </div>
      <PdfPageFooter model={model} page={pageNumber} total={total} />
    </section>
  );
}

function LabelValueTilesPage({
  model,
  titleFr,
  titleEn,
  rows,
  pageNumber,
  total,
  pageLabel,
}: {
  model: DetailedFinancialReportModel;
  titleFr: string;
  titleEn: string;
  rows: DetailedFinancialReportModel['financingRows'];
  pageNumber: number;
  total: number;
  pageLabel?: string;
}) {
  const L = model.locale === 'fr';

  return (
    <section className={`${PAGE} pdf-page-break`} style={{ backgroundColor: '#fafafa' }}>
      <PdfLightHeader
        subtitle={L ? titleFr : titleEn}
        pageLabel={pageLabel}
      />
      <div className="flex flex-1 flex-col px-[0.75in] py-[0.5in]">
        <h2 className="text-[17pt] font-black" style={{ color: INK }}>
          {L ? titleFr : titleEn}
        </h2>
        <div className="mt-6 grid grid-cols-2 gap-3 content-start">
          {rows.map((row, i) => {
            const label = L ? row.labelFr : row.labelEn;
            return (
              <div
                key={i}
                className="pdf-avoid-break flex min-h-[1.2in] flex-col justify-between rounded-md border bg-white px-3 py-3 shadow-sm"
                style={{ borderColor: GOLD }}
              >
                <p className="text-[7.5pt] font-bold uppercase leading-snug text-neutral-600">
                  {label}
                </p>
                <p
                  className="mt-2 text-[13pt] font-black tabular-nums leading-none"
                  style={{ color: INK }}
                >
                  {row.value}
                </p>
              </div>
            );
          })}
        </div>
      </div>
      <PdfPageFooter model={model} page={pageNumber} total={total} />
    </section>
  );
}

export interface DetailedFinancialReportTemplateProps {
  model: DetailedFinancialReportModel;
}

export function DetailedFinancialReportTemplate({
  model,
}: DetailedFinancialReportTemplateProps) {
  const expenseChunks = chunk(model.expenseRows, EXPENSE_ROWS_PER_PAGE);
  const total = computeTotalPages(model);
  let pageNum = 3;

  return (
    <div
      id="detailed-financial-report-pdf-root"
      className="bg-white font-sans antialiased"
      style={{ width: '8.5in' }}
    >
      <CoverPage model={model} total={total} />
      <AboutPage model={model} total={total} />
      <SummaryTilesPage model={model} total={total} />
      {expenseChunks.map((rows, idx) => {
        pageNum += 1;
        return (
          <ExpenseTableSection
            key={idx}
            model={model}
            rows={rows}
            pageIndex={idx}
            pageNumber={pageNum}
            total={total}
            isFirst={idx === 0}
            isLastChunk={idx === expenseChunks.length - 1}
          />
        );
      })}
      <LabelValueTilesPage
        model={model}
        titleFr="Finançabilité et scénarios bancaires"
        titleEn="Financing and bank scenarios"
        rows={model.financingRows}
        pageNumber={total - 1}
        total={total}
      />
      <LabelValueTilesPage
        model={model}
        titleFr="Grille des rendements (5 ans)"
        titleEn="Yield grid (5 years)"
        rows={model.yieldRows}
        pageNumber={total}
        total={total}
      />
    </div>
  );
}
