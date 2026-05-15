/**
 * driveExtraction.ts — Extraction IA des documents Drive (Phase C)
 *
 * Brief « SYSTÈME SILOS 2026 v4 » §3 — chantier C.3 :
 *   « On commence à brancher les functions-ai de la V1 (Document Analyst)
 *     pour que le Drive "lise" les documents déposés. »
 *
 * IMPORTANT — Décision Phase C :
 *   Les `functions-ai` V1 sont dans un projet Firebase DISTINCT
 *   (`copilote-pour-courtiers-en-rpa`) du projet V2 (`primexpert-app`).
 *   Donc on ne PEUT PAS les appeler directement (auth/sécurité séparées).
 *
 *   Solution V2-native : utiliser le SDK @google/genai (déjà dépendance V2,
 *   utilisé par services/gemini.ts) pour faire l'extraction localement.
 *   Cela évite la duplication des Cloud Functions (§II) et l'ajout d'un
 *   pont inter-projets (KISS §III).
 *
 *   Quand la migration multi-tenant sera complète (Phase D), on pourra
 *   relocaliser les fonctions-ai dans le projet V2 si nécessaire.
 *
 * Mode opératoire :
 *   1) Le fichier est téléchargé depuis Firebase Storage (URL signée).
 *   2) Pour les PDF/images : envoi en base64 inline à Gemini.
 *   3) Gemini retourne un JSON structuré (champs canoniques + insights).
 *   4) Mise à jour Firestore `drive_documents` (status: ready, extractedFields, aiInsights).
 *
 * Charte v2026.2 §V — Zone Rouge : noms canoniques préservés
 *   (prixAnnonce, nombreUnites, courtiersResponsables, etc.)
 */

import { GoogleGenAI, Type } from '@google/genai';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { fetchBinaryAsBase64 } from '../lib/fetchBinaryAsBase64';
import { getDriveDocumentUrl } from './driveStorage';

let ai: GoogleGenAI | null = null;

function getGeminiClient(): GoogleGenAI {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('VITE_GEMINI_API_KEY requis dans .env.local pour l\'extraction Drive.');
  }
  ai ??= new GoogleGenAI({ apiKey });
  return ai;
}

export interface DriveExtractionResult {
  /** Type de document détecté par l'IA */
  documentType: 'DV' | 'Contrat de courtage' | 'États financiers' | 'Photo' | 'Bail' | 'Autre';
  /** Texte brut extrait (OCR si nécessaire) */
  extractedText: string;
  /** Champs canoniques détectés — Zone Rouge OACIQ */
  extractedFields: {
    prixAnnonce?: number;
    nombreUnites?: number;
    revenuNetExploitation?: number;
    tauxCapitalisation?: number;
    revenusAnnuels?: number;
    adresse?: string;
    ville?: string;
  };
  /** Insights IA (risques, alertes, opportunités) */
  aiInsights: string[];
  /** Score de confiance global (0-1) */
  confidence: number;
}

const EXTRACTION_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    documentType: {
      type: Type.STRING,
      enum: ['DV', 'Contrat de courtage', 'États financiers', 'Photo', 'Bail', 'Autre'],
    },
    extractedText: { type: Type.STRING },
    extractedFields: {
      type: Type.OBJECT,
      properties: {
        prixAnnonce: { type: Type.NUMBER },
        nombreUnites: { type: Type.NUMBER },
        revenuNetExploitation: { type: Type.NUMBER },
        tauxCapitalisation: { type: Type.NUMBER },
        revenusAnnuels: { type: Type.NUMBER },
        adresse: { type: Type.STRING },
        ville: { type: Type.STRING },
      },
    },
    aiInsights: { type: Type.ARRAY, items: { type: Type.STRING } },
    confidence: { type: Type.NUMBER },
  },
  required: ['documentType', 'extractedText', 'extractedFields', 'aiInsights', 'confidence'],
};

const SYSTEM_PROMPT = `Tu es l'analyste documentaire de PrimeXpert (courtage immobilier OACIQ).
Tu reçois un document immobilier (DV, contrat, états financiers, bail, photo).
Tu dois :
1. Identifier le type de document.
2. Extraire le texte brut pertinent.
3. Identifier les champs canoniques OACIQ : prixAnnonce, nombreUnites, revenuNetExploitation, tauxCapitalisation (en décimal, ex 0.08), revenusAnnuels, adresse, ville.
4. Lister 2 à 5 insights pertinents (risques, opportunités, alertes de conformité).
5. Donner un score de confiance global entre 0 et 1.

IMPORTANT : ne JAMAIS renommer les champs. Garder les slugs exacts (Zone Rouge §V).`;

/**
 * Extrait les champs canoniques d'un document via Gemini Vision.
 * Met à jour le doc Firestore `drive_documents` avec les résultats.
 */
export async function extractDriveDocument(params: {
  driveDocumentId: string;
  storagePath: string;
  mime: string;
}): Promise<DriveExtractionResult> {
  const { driveDocumentId, storagePath, mime } = params;

  // 1. Statut "processing"
  await updateDoc(doc(db, 'drive_documents', driveDocumentId), { status: 'processing' });

  try {
    // 2. Récupérer le contenu via URL signée → base64
    const downloadUrl = await getDriveDocumentUrl(storagePath);
    const { data, mime: detectedMime } = await fetchBinaryAsBase64(downloadUrl);

    // 3. Appel Gemini Vision avec inline data
    const client = getGeminiClient();
    const response = await client.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: [
        {
          role: 'user',
          parts: [
            { text: SYSTEM_PROMPT },
            { inlineData: { mimeType: detectedMime || mime, data } },
          ],
        },
      ],
      config: {
        responseMimeType: 'application/json',
        responseSchema: EXTRACTION_SCHEMA,
      },
    });

    const parsed = JSON.parse(response.text) as DriveExtractionResult;

    // 4. Stocker le résultat
    await updateDoc(doc(db, 'drive_documents', driveDocumentId), {
      status: 'ready',
      documentType: parsed.documentType,
      extractedText: parsed.extractedText,
      extractedFields: parsed.extractedFields,
      aiInsights: parsed.aiInsights,
      extractionConfidence: parsed.confidence,
      extractedAt: new Date(),
    });

    return parsed;
  } catch (e) {
    console.error('[driveExtraction] Échec extraction:', e);
    await updateDoc(doc(db, 'drive_documents', driveDocumentId), {
      status: 'failed',
      extractionError: e instanceof Error ? e.message : String(e),
    });
    throw e;
  }
}
