/**
 * Pilules source — clone visuel V1 (Centris, CoStar, Évaluateur, JLR…).
 */

export interface MarketSourceTagInfo {
  label: string;
  className: string;
  title?: string;
}

export function inferMarketSourceTag(
  sourceDocumentName?: string,
  source?: string,
  sourceDocumentId?: string
): MarketSourceTagInfo {
  const haystack = [sourceDocumentName, source, sourceDocumentId]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  if (/costar/.test(haystack)) {
    return { label: 'CoStar', className: 'bg-blue-100 text-blue-700' };
  }
  if (/centris/.test(haystack)) {
    return { label: 'Centris', className: 'bg-green-100 text-green-700' };
  }
  if (/jlr|jonction\s+l[eé]gale|fiche\s*jlr/.test(haystack)) {
    return { label: 'JLR', className: 'bg-orange-100 text-orange-800' };
  }
  if (/altus/.test(haystack)) {
    return { label: 'Altus', className: 'bg-slate-100 text-slate-700' };
  }
  if (/mercier|c[oô]t[eé]/.test(haystack)) {
    return { label: 'Côté Mercier', className: 'bg-indigo-100 text-indigo-800' };
  }
  if (/évaluat|evaluation|rpa|rapport.*march/.test(haystack)) {
    return { label: 'RPA Évaluation', className: 'bg-violet-100 text-violet-800' };
  }

  const fallback =
    sourceDocumentName?.trim() ||
    (source && source !== '—' ? source.slice(0, 24) : undefined) ||
    (sourceDocumentId ? `${sourceDocumentId.slice(0, 8)}…` : 'Marché');

  return { label: fallback, className: 'bg-violet-100 text-violet-800' };
}
