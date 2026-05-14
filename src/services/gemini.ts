import { GoogleGenAI, Type } from "@google/genai";
import type { Language } from "../lib/i18n";
import type { InventoryResidenceRef, MailParseResult } from "@primexpert/core/mail";

let ai: GoogleGenAI | null = null;

function getGeminiClient() {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error("VITE_GEMINI_API_KEY doit être défini dans .env.local pour utiliser Gemini.");
  }

  ai ??= new GoogleGenAI({ apiKey });
  return ai;
}

export async function generateListingDescription(details: any, language: Language = 'fr') {
  const model = "gemini-3-flash-preview";
  const responseLanguage = language === 'fr' ? 'français du Québec' : 'English';
  const systemInstruction = language === 'fr'
    ? "Tu es l'assistant de Primexpert. Tu dois t'exprimer exclusivement en français impeccable, en utilisant les termes techniques francophones conformes à la loi 101."
    : "You are Primexpert's assistant. You must write in professional English while preserving Quebec real estate compliance requirements.";
  const prompt = `${systemInstruction}

    Générer une description immobilière professionnelle pour Centris (Québec) basée sur ces détails:
    Adresse: ${details.address}
    Type: ${details.type}
    Prix demandé: ${details.price} $
    Caractéristiques: ${details.features}
    Inclusions: ${details.inclusions}
    
    Règles:
    1. Ton professionnel, vendeur, élégant.
    2. Répondre uniquement en ${responseLanguage}.
    3. Inclure naturellement des clauses de conformité si nécessaire.
    4. Diviser en paragraphes clairs.
    5. Ajouter une section logicielle "Signature du Courtier" à la fin.
  `;

  try {
    const response = await getGeminiClient().models.generateContent({
      model,
      contents: prompt,
      config: {
        temperature: 0.7,
      }
    });

    return response.text;
  } catch (error) {
    console.error("AI Generation Error:", error);
    throw error;
  }
}

export async function analyzeMarketValue(data: any, language: Language = 'fr') {
  const model = "gemini-3.1-pro-preview"; // Use Pro for complex reasoning
  const responseLanguage = language === 'fr' ? 'français du Québec' : 'English';
  const systemInstruction = language === 'fr'
    ? "Tu es l'assistant de Primexpert. Tu dois t'exprimer exclusivement en français impeccable, en utilisant les termes techniques francophones conformes à la loi 101."
    : "You are Primexpert's assistant. You must write in professional English while preserving Quebec real estate compliance requirements.";
  const prompt = `${systemInstruction}

    En tant qu'expert en analyse comparative de marché (ACM) au Québec, analysez cette propriété:
    Détails: ${JSON.stringify(data.property)}
    Comparables récents: ${JSON.stringify(data.comparables)}
    
    Fournissez une analyse structurée incluant:
    1. Estimation de la valeur marchande (Fourchette Min/Max).
    2. Facteurs d'ajustement (Intrinsèques, Géospatiaux, Temporels).
    3. Stratégie de mise en marché recommandée.
    
    Répondez uniquement en ${responseLanguage}.
    Répondez en JSON.
  `;

  try {
    const response = await getGeminiClient().models.generateContent({
      model,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            estimatedValue: {
              type: Type.OBJECT,
              properties: {
                min: { type: Type.NUMBER },
                max: { type: Type.NUMBER },
                suggested: { type: Type.NUMBER }
              }
            },
            adjustments: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            },
            strategy: { type: Type.STRING }
          }
        }
      }
    });

    return JSON.parse(response.text);
  } catch (error) {
    console.error("AI ACM Error:", error);
    throw error;
  }
}

const MAILBOX_LEAD_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    lead: {
      type: Type.OBJECT,
      properties: {
        contactName: { type: Type.STRING },
        phone: { type: Type.STRING },
        email: { type: Type.STRING },
        intent: { type: Type.STRING },
      },
    },
    residence: {
      type: Type.OBJECT,
      properties: {
        matchedResidenceId: { type: Type.STRING },
        mentionedAddress: { type: Type.STRING },
        matchConfidence: { type: Type.STRING },
      },
    },
    urgency: { type: Type.STRING },
    summaryOneLine: { type: Type.STRING },
  },
};

/**
 * Phase E-2 — Extraction structurée (lead, résidence, urgence) via Gemini.
 * Le merge avec les heuristiques @primexpert/core/mail se fait côté UI.
 */
export async function analyzeMailboxMessageForLeads(input: {
  subject: string;
  body: string;
  sender: string;
  inventory: readonly InventoryResidenceRef[];
  language: Language;
}): Promise<Partial<MailParseResult>> {
  const model = "gemini-3-flash-preview";
  const lang = input.language === "fr" ? "français du Québec" : "English";
  const invJson = JSON.stringify(
    input.inventory.map((r) => ({
      id: r.id,
      address: r.address,
      city: r.city,
    }))
  );

  const prompt =
    input.language === "fr"
      ? `Tu es l'assistant Primexpert (courtier immobilier Québec). Analyse ce courriel entrant.

Expéditeur affiché: ${input.sender}
Objet: ${input.subject}
Corps:
"""
${input.body}
"""

Inventaire résidences (choisir matchedResidenceId UNIQUEMENT parmi ces id, sinon chaîne vide):
${invJson}

Règles:
- intent du lead: buyer | seller | peer | agency | unknown (en anglais, minuscules).
- urgency: low | medium | high
- matchConfidence: high | medium | low | none
- Numéros téléphone format nord-américain si détectés.
- Zéro invention de faits: si une info est absente, laisser chaîne vide.
- summaryOneLine: une phrase factuelle max 180 caractères.

Réponds UNIQUEMENT en JSON valide selon le schéma demandé. Texte libre: ${lang}.`
      : `You are Primexpert's assistant (Quebec real estate broker). Analyze this inbound email.

Sender: ${input.sender}
Subject: ${input.subject}
Body:
"""
${input.body}
"""

Residence inventory (matchedResidenceId MUST be one of these ids or empty string):
${invJson}

Rules: same as French version — intent buyer|seller|peer|agency|unknown; urgency low|medium|high; matchConfidence high|medium|low|none; do not invent facts.

Reply ONLY in valid JSON per schema. Language: ${lang}.`;

  try {
    const response = await getGeminiClient().models.generateContent({
      model,
      contents: prompt,
      config: {
        temperature: 0.2,
        responseMimeType: "application/json",
        responseSchema: MAILBOX_LEAD_SCHEMA,
      },
    });

    const text = response.text;
    if (!text) return {};
    return JSON.parse(text) as Partial<MailParseResult>;
  } catch (e) {
    console.error("[Mailbox] Gemini extract failed:", e);
    return {};
  }
}

/**
 * Brouillon de réponse — ton professionnel aligné sur la charte narrative
 * (vocabulaire prudent, repères, lecture comparative — sans promesse de rendement).
 */
export async function generateMailboxReplyDraft(input: {
  parse: MailParseResult;
  subject: string;
  sender: string;
  language: Language;
}): Promise<string> {
  const model = "gemini-3-flash-preview";
  const lang = input.language === "fr" ? "français du Québec" : "English";
  const p = input.parse;

  const prompt =
    input.language === "fr"
      ? `Tu rédiges un BROUILLON de réponse courriel pour un courtier immobilier au Québec (Primexpert).

Contexte extrait (JSON):
${JSON.stringify(p, null, 2)}

Courriel reçu — objet: ${input.subject}
Expéditeur: ${input.sender}

Exigences:
- Ton chaleureux mais professionnel; tutoiement ou vouvoiement cohérent avec l'expéditeur.
- Vocabulaire compatible OACIQ: éviter garanties, urgences artificielles, promesses de prix.
- Préférer formulations du type « repères », « lecture comparative », « nous pourrions convenir d'un échange ».
- Proposer une prochaine étape concrète (appel, visite, envoi d'infos) sans pression.
- Longueur: 120 à 220 mots.
- Langue: ${lang}.
- Commencer par une salutation appropriée. Pas de signature bloque (le courtier l'ajoutera).`
      : `Draft a professional email reply for a Quebec real estate broker (Primexpert).

Parsed context (JSON):
${JSON.stringify(p, null, 2)}

Inbound subject: ${input.subject}
From: ${input.sender}

Requirements: OACIQ-safe wording (no guarantees, no artificial urgency). Prefer "market benchmarks", "comparative reading". 120-220 words. ${lang}.`;

  try {
    const response = await getGeminiClient().models.generateContent({
      model,
      contents: prompt,
      config: { temperature: 0.55 },
    });

    return response.text?.trim() ?? "";
  } catch (e) {
    console.error("[Mailbox] Gemini reply draft failed:", e);
    return "";
  }
}
