/**
 * Extraction Gemini via Vertex AI (ADC / compte de service Cloud Functions).
 */

import {
  getVertexClient,
  getVertexGeminiModel,
  getVertexLocation,
  getVertexProject,
} from '../services/vertexClient';

const SYSTEM_PROMPT = `Tu es un analyste immobilier commercial senior. Extrais les données financières clés de ce document (montants, taxes, année, revenus, dépenses). Renvoie uniquement un objet JSON propre avec ces clés, sans texte ou markdown autour.

Structure attendue (utilise les tableaux même s'il n'y a qu'une entrée) :
{
  "amounts": [{ "label": "description", "value": 0, "currency": "CAD" }],
  "dates": [{ "label": "description", "isoDate": "AAAA-MM-JJ" }],
  "taxes": [{ "label": "description", "amount": 0, "year": 2024 }],
  "revenus": [{ "label": "description", "value": 0 }],
  "depenses": [{ "label": "description", "value": 0 }],
  "annee": 2024,
  "comparables": [{ "label": "adresse ou lot", "salePrice": 0, "capRatePct": 0, "regionKey": "clé région" }]
}

Si le document est un rapport d'évaluation (JLR, évaluation municipale, ACM), remplis aussi "comparables" avec les immeubles comparables (prix de vente, taux de capitalisation (TGA), clé de région). Sinon omets "comparables".`;

function parseJsonFromModelText(text: string): Record<string, unknown> {
  const trimmed = text.trim();
  const fence = /^```(?:json)?\s*([\s\S]*?)```$/i.exec(trimmed);
  const payload = fence ? fence[1].trim() : trimmed;
  try {
    return JSON.parse(payload) as Record<string, unknown>;
  } catch (parseErr) {
    console.error('[geminiExtract] JSON parse failed — raw model text', {
      preview: trimmed.slice(0, 2000),
      length: trimmed.length,
      parseError: parseErr instanceof Error ? parseErr.message : String(parseErr),
    });
    throw parseErr;
  }
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
  const comparables = Array.isArray(raw.comparables) ? raw.comparables : [];
  if (comparables.length) extracted.comparables = comparables;
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
  if (/NOT_FOUND|was not found|invalid model/i.test(base)) {
    return `VERTEX_MODEL_NOT_FOUND: vérifiez VERTEX_GEMINI_MODEL (ex. gemini-2.5-flash) — ${base.slice(0, 200)}`;
  }
  if (/UNAUTHENTICATED|invalid authentication|credentials/i.test(base)) {
    return `VERTEX_AUTH: sur Cloud Functions l'ADC utilise le compte de service runtime (pas de clé JSON) — ${base.slice(0, 200)}`;
  }
  return base.slice(0, 500);
}

export async function extractFinancialDocumentWithGemini(
  mimeType: string,
  base64Data: string,
  fileName: string
): Promise<Record<string, unknown>> {
  const project = getVertexProject();
  const location = getVertexLocation();
  const modelId = getVertexGeminiModel();

  console.info('[geminiExtract] start', {
    project,
    location,
    model: modelId,
    mimeType,
    fileName,
    payloadBytes: base64Data.length,
  });

  if (location !== 'us-central1') {
    throw new Error(
      `VERTEX_REGION_MISMATCH: le parseur exige us-central1 (reçu: ${location})`
    );
  }

  try {
    const vertex = await getVertexClient();
    console.info('[geminiExtract] vertex client', {
      project,
      location,
      model: modelId,
      publisherPath: `publishers/google/models/${modelId}`,
    });

    const model = vertex.getGenerativeModel({
      model: modelId,
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
    console.info('[geminiExtract] model response received', { textLength: text.length });
    return normalizeExtractedData(parseJsonFromModelText(text));
  } catch (err) {
    const formatted = formatVertexError(err);
    console.error('[geminiExtract] error', { project, location, model: modelId, formatted });
    throw new Error(formatted);
  }
}
