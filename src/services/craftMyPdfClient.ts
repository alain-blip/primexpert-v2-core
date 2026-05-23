/**
 * Client HTTP CraftMyPDF — partagé entre rapports (détaillé, acheteur, etc.).
 */

export const CRAFTMYPDF_CREATE_URL = 'https://api.craftmypdf.com/v1/create';

interface CraftMyPdfCreateResponse {
  status?: string;
  download_url?: string;
  file?: string;
  message?: string;
  error?: string;
}

export function readCraftMyPdfApiKey(): string {
  const apiKey = import.meta.env.VITE_CRAFTMYPDF_API_KEY?.trim();
  if (!apiKey) throw new Error('CRAFTMYPDF_CONFIG_MISSING');
  return apiKey;
}

function extractPdfDownloadUrl(body: CraftMyPdfCreateResponse): string {
  const url = body.download_url ?? body.file;
  if (typeof url === 'string' && url.startsWith('http')) return url;
  throw new Error(body.message ?? body.error ?? 'CRAFTMYPDF_NO_DOWNLOAD_URL');
}

/** POST /v1/create — retourne le Blob PDF (URL pré-signée ou binaire direct). */
export async function requestCraftMyPdfBlob(
  templateId: string,
  data: Record<string, unknown>
): Promise<Blob> {
  console.log('PAYLOAD ENVOYÉ À CRAFTMYPDF :', { template_id: templateId, data });
  const response = await fetch(CRAFTMYPDF_CREATE_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-KEY': readCraftMyPdfApiKey(),
    },
    body: JSON.stringify({
      template_id: templateId,
      data,
      export_type: 'json',
    }),
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => '');
    throw new Error(`CRAFTMYPDF_HTTP_${response.status}:${errText.slice(0, 200)}`);
  }

  const contentType = response.headers.get('content-type') ?? '';
  if (contentType.includes('application/pdf')) {
    return response.blob();
  }

  const body = (await response.json()) as CraftMyPdfCreateResponse;
  if (body.status && body.status !== 'success' && body.status !== 'completed') {
    throw new Error(body.message ?? body.error ?? `CRAFTMYPDF_STATUS_${body.status}`);
  }

  const pdfUrl = extractPdfDownloadUrl(body);
  const pdfResponse = await fetch(pdfUrl);
  if (!pdfResponse.ok) {
    throw new Error(`CRAFTMYPDF_PDF_FETCH_${pdfResponse.status}`);
  }
  return pdfResponse.blob();
}

export function triggerBrowserDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = 'noopener';
  anchor.click();
  URL.revokeObjectURL(url);
}
