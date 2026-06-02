/**
 * Prompts système — Rédacteur IA Centris (descriptions marketing).
 * Filtre lexical conditionnel selon `propertyContext` (SSOT v3.5).
 */

import type { PropertyContext } from '../canonical/propertyContext';

export type ListingDescriptionLanguage = 'fr' | 'en';

/** Instruction de base — conformité OACIQ / Loi 101. */
export function buildListingDescriptionBaseInstruction(
  language: ListingDescriptionLanguage
): string {
  return language === 'fr'
    ? "Tu es l'assistant de Primexpert. Tu dois t'exprimer exclusivement en français impeccable, en utilisant les termes techniques francophones conformes à la loi 101. Ne jamais utiliser le mot « audit »; préférer « vérification », « conformité » ou « diligence raisonnable »."
    : "You are Primexpert's assistant. Write in professional English while preserving Quebec real estate compliance. Never use the word \"audit\"; prefer \"verification\", \"compliance\" or \"due diligence\".";
}

/**
 * Règles contextuelles injectées dans le prompt Vertex / Gemini
 * selon le champ Firestore `propertyContext`.
 */
export function buildListingDescriptionContextRules(
  propertyContext: PropertyContext,
  language: ListingDescriptionLanguage
): string {
  if (propertyContext === 'CPE') {
    return language === 'fr'
      ? `Contexte CPE (centre de la petite enfance) — miroir analytique RPA :
- Appliquer la même rigueur d'analyse des dépenses d'exploitation que pour une résidence pour aînés (RPA).
- SUBSTITUER le vocabulaire institutionnel aînés : ne pas utiliser « lits », « soins », « MSSS », « CIUSSS ».
- UTILISER à la place : « places autorisées », « pouponnières », « agréments du Ministère de la Famille (MFA) ».
- Ton professionnel investisseur; mentionner conformité réglementaire et exploitation sans promesse de rendement.`
      : `CPE (childcare centre) context — RPA analytical mirror:
- Apply the same operating-expense analysis rigor as for a seniors' residence (RPA).
- DO NOT use seniors vocabulary: no "beds", "care", "MSSS", "CIUSSS".
- USE instead: "authorized places", "childcare facilities", "Ministry of Family (MFA) approvals".
- Professional investor tone; mention regulatory compliance without yield promises.`;
  }

  if (propertyContext === 'RESIDENTIAL') {
    return language === 'fr'
      ? `Contexte résidentiel (unifamilial, condo, plex < 5) :
- Structure narrative ÉMOTIONNELLE axée sur le mode de vie familial et les commodités du secteur (parcs, écoles, transport, ensoleillement, tranquillité).
- INTERDIT formellement : jargon institutionnel (MSSS, CIUSSS, RPA, CPE, lits, soins) et jargon financier commercial (revenu net d'exploitation (RNE), taux de capitalisation (TGA), analyse comparative de marché (ACM) institutionnelle, revenu brut effectif (RBE)).
- Privilégier les atouts tangibles : luminosité, aménagement, quartier, proximité des services.`
      : `Residential context (single family, condo, small plex):
- EMOTIONAL narrative focused on family lifestyle and neighbourhood amenities (parks, schools, transit, sunlight, quiet streets).
- STRICTLY FORBIDDEN: institutional jargon (MSSS, CIUSSS, RPA, CPE, beds, care) and commercial financial jargon (NOI, cap rate, institutional CMA, EGI).
- Emphasize tangible assets: brightness, layout, neighbourhood, nearby services.`;
  }

  if (propertyContext === 'COMMERCIAL_PLEX') {
    return language === 'fr'
      ? `Contexte plex commercial (5 unités et plus) :
- Ton investisseur professionnel; mentionner revenus locatifs et entretien du bâtiment sans promesse de rendement.
- Utiliser « revenu net d'exploitation (RNE) » et « taux de capitalisation (TGA) » uniquement si pertinent pour la description Centris (toujours en toutes lettres avec abréviation entre parenthèses).`
      : `Commercial plex context (5+ units):
- Professional investor tone; mention rental income and building upkeep without yield promises.
- Use "net operating income (NOI)" and "capitalization rate (cap rate)" only when relevant (full term plus abbreviation in parentheses).`;
  }

  // RPA — défaut historique
  return language === 'fr'
    ? `Contexte résidence pour aînés (RPA) :
- Ton professionnel, rassurant pour investisseurs et acquéreurs institutionnels.
- Vocabulaire conforme : résidence pour aînés (RPA), revenu net d'exploitation (RNE), ratio des dépenses d'exploitation (RDE) si pertinent.
- Éviter promesses de rendement; privilégier repères, conformité et qualité d'exploitation.`
    : `Seniors' residence (RPA) context:
- Professional, reassuring tone for investors and institutional buyers.
- Compliant vocabulary: seniors' residence (RPA), net operating income (NOI), operating expense ratio (OER) when relevant.
- Avoid yield promises; emphasize benchmarks, compliance and operational quality.`;
}

/** Assemble le bloc prompt complet pour generateListingDescription. */
export function buildListingDescriptionSystemPrompt(
  propertyContext: PropertyContext,
  language: ListingDescriptionLanguage
): string {
  const base = buildListingDescriptionBaseInstruction(language);
  const contextRules = buildListingDescriptionContextRules(propertyContext, language);
  return `${base}\n\n${contextRules}`;
}
