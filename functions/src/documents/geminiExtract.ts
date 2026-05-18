/**
 * Extraction Gemini via Vertex AI (identité de service Cloud Functions).
 */

const GEMINI_MODEL = 'gemini-1.5-flash';
const VERTEX_LOCATION = 'us-central1';

const SYSTEM_PROMPT = `Tu es un analyste immobilier commercial senior. Extrais les données financières clés de ce document (montants, taxes, année, revenus, dépenses). Renvoie uniquement un objet JSON propre avec ces clés, sans texte ou markdown autour.

Structure attendue (utilise les tableaux même s'il n'y a qu'une entrée) :
{
  "amounts": [{ "label": "description", "value": 0, "currency": "CAD" }],
  "dates": [{ "label": "description", "isoDate": "AAAA-MM-JJ" }],
  "taxes": [{ "label": "description", "amount": 0, "year": 2024 }],
  "revenus": [{ "label": "description", "value": 0 }],
  "depenses": [{ "label": "description", "value": 0 }],
  "annee": 2024
}`;

function parseJsonFromModelText(text: string): Record<string, unknown> {
  const trimmed = text.trim();
  const fence = /^```(?:json)?\s*([\s\S]*?)```$/i.exec(trimmed);
  const payload = fence ? fence[1].trim() : trimmed;
  return JSON.parse(payload) as Record<string, unknown>;
}

export function normalizeExtractedData(raw: Record<string, unknown>): Record<string, unknown> {
  const amounts = Array.isArray(raw.amounts) ? raw.amounts : [];
  const dates = Array.isArray(raw.dates) ? raw.dates : [];
  const taxes = Array.isArray(raw.taxes) ? raw.taxes : [];
  const revenus = Array.isArray(raw.revenus) ? raw.revenus : [];
  const depenses = Array.isArray(raw.depenses) ? raw.depenses : [];

  const extracted: Record<string, unknown> = { amounts, dates, taxes };
  if (revenus.length) extracted.revenus = revenus;
  if (depenses.length) extracted.depenses = depenses;
  if (raw.annee != null) extracted.annee = raw.annee;
  return extracted;
}

function formatVertexError(err: unknown): string {
  const base = err instanceof Error ? err.message : String(err);
  if (/SERVICE_DISABLED|has not been used|aiplatform\.googleapis\.com/i.test(base)) {
    return `VERTEX_API_DISABLED: activez aiplatform.googleapis.com sur primexpert-app-v2 — ${base.slice(0, 200)}`;
  }
  if (/PERMISSION_DENIED|403 Forbidden/i.test(base)) {
    return `VERTEX_PERMISSION_DENIED: accordez roles/aiplatform.user au compte de service Cloud Functions — ${base.slice(0, 200)}`;
  }
  return base.slice(0, 500);
}

export async function extractFinancialDocumentWithGemini(
  mimeType: string,
  base64Data: string,
  fileName: string
): Promise<Record<string, unknown>> {
  const project =
    process.env.GCLOUD_PROJECT || process.env.GCP_PROJECT || 'primexpert-app-v2';

  console.info('[geminiExtract] start', {
    project,
    location: VERTEX_LOCATION,
    model: GEMINI_MODEL,
    mimeType,
    fileName,
    payloadBytes: base64Data.length,
  });

  try {
    const { VertexAI } = await import('@google-cloud/vertexai');
    const vertex = new VertexAI({ project, location: VERTEX_LOCATION });
    const model = vertex.getGenerativeModel({
      model: GEMINI_MODEL,
      generationConfig: {
        temperature: 0.1,
        responseMimeType: 'application/json',
      },
    });

    const result = await model.generateContent({
      contents: [
        {
          role: 'user',
          parts: [
            { text: SYSTEM_PROMPT },
            { text: `Nom du fichier : ${fileName}` },
            { inlineData: { mimeType, data: base64Data } },
          ],
        },
      ],
    });

    const text =
      result.response?.candidates?.[0]?.content?.parts
        ?.map((p) => ('text' in p ? p.text : ''))
        .join('') ?? '';

    if (!text) throw new Error('VERTEX_EMPTY_RESPONSE: réponse vide du modèle Gemini.');
    return normalizeExtractedData(parseJsonFromModelText(text));
  } catch (err) {
    const formatted = formatVertexError(err);
    console.error('[geminiExtract] error', { project, formatted });
    throw new Error(formatted);
  }
}
