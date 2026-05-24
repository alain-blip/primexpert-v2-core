/**
 * Pilule source — clone exact V1 (MarketDashboard.jsx · comparables table).
 */

import { inferMarketSourceTag } from '@primexpert/core/market';

export function MarketSourceTag({
  sourceDocumentName,
  source,
  sourceDocumentId,
}: {
  sourceDocumentName?: string;
  source?: string;
  sourceDocumentId?: string;
}) {
  const tag = inferMarketSourceTag(sourceDocumentName, source, sourceDocumentId);

  return (
    <span
      className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${tag.className}`}
      title={tag.title}
    >
      {tag.label}
    </span>
  );
}
