/**
 * Découpage sémantique local — rapports marché (V2.8).
 * Extrait uniquement les pages à ancrages québécois avant appel Vertex.
 */

import { createHash } from 'node:crypto';
import { PDFDocument } from 'pdf-lib';
import {
  findSemanticPageIndices,
  selectMarketParsePageIndices,
} from './_vendored/marketPdfSemanticAnchors';

export interface MarketPdfSliceResult {
  contentHashMd5: string;
  originalPageCount: number;
  selectedPageIndices: number[];
  slicedPdfBase64: string;
  slicedPageCount: number;
  semanticHit: boolean;
}

interface PdfParsePageData {
  pageIndex: number;
  getTextContent: (opts?: { normalizeWhitespace?: boolean }) => Promise<{
    items: Array<{ str?: string }>;
  }>;
}

function loadPdfParse(): (
  buffer: Buffer,
  options?: { pagerender?: (pageData: PdfParsePageData) => Promise<string> }
) => Promise<{ numpages: number }> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('pdf-parse') as (
    buffer: Buffer,
    options?: { pagerender?: (pageData: PdfParsePageData) => Promise<string> }
  ) => Promise<{ numpages: number }>;
}

/** Empreinte MD5 déterministe du binaire PDF (cache anti-doublon). */
export function computePdfContentHashMd5(buffer: Buffer): string {
  return createHash('md5').update(buffer).digest('hex');
}

/** Balaye le PDF, isole les pages sémantiques et recombine un payload réduit. */
export async function sliceMarketPdfForIa(buffer: Buffer): Promise<MarketPdfSliceResult> {
  const contentHashMd5 = computePdfContentHashMd5(buffer);
  const pageTexts: string[] = [];
  const pdfParse = loadPdfParse();

  await pdfParse(buffer, {
    pagerender: async (pageData: PdfParsePageData) => {
      const textContent = await pageData.getTextContent({ normalizeWhitespace: true });
      const text = textContent.items.map((item) => item.str ?? '').join(' ');
      pageTexts[pageData.pageIndex] = text;
      return text;
    },
  });

  const srcPdf = await PDFDocument.load(buffer, { ignoreEncryption: true });
  const originalPageCount = srcPdf.getPageCount();
  const selectedPageIndices = selectMarketParsePageIndices(pageTexts).filter(
    (idx) => idx >= 0 && idx < originalPageCount
  );
  const indicesToUse =
    selectedPageIndices.length > 0
      ? selectedPageIndices
      : Array.from({ length: Math.min(3, originalPageCount) }, (_, i) => i);

  const dstPdf = await PDFDocument.create();
  const copiedPages = await dstPdf.copyPages(srcPdf, indicesToUse);
  for (const page of copiedPages) dstPdf.addPage(page);
  const slicedBytes = await dstPdf.save();

  const semanticHit = findSemanticPageIndices(pageTexts).length > 0;

  return {
    contentHashMd5,
    originalPageCount,
    selectedPageIndices: indicesToUse,
    slicedPdfBase64: Buffer.from(slicedBytes).toString('base64'),
    slicedPageCount: indicesToUse.length,
    semanticHit,
  };
}
