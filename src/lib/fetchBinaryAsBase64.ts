/**
 * Télécharge une URL (ex. Storage signée) et retourne le corps en base64 + MIME.
 */

export async function fetchBinaryAsBase64(url: string): Promise<{ data: string; mime: string }> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Téléchargement échoué: HTTP ${response.status}`);
  }
  const mime = response.headers.get('content-type') || 'application/octet-stream';
  const buffer = await response.arrayBuffer();
  let binary = '';
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return { data: btoa(binary), mime };
}
