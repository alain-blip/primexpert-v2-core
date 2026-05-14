import { GoogleGenAI, Type } from "@google/genai";
import type { Language } from "../lib/i18n";

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
