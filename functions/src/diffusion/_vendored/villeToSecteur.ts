/* eslint-disable */
/**
 * AUTO-GÉNÉRÉ — NE PAS MODIFIER.
 *
 * Source canonique : packages/core/src/diffusion/
 * Régénéré par   : functions/scripts/sync-core-diffusion.cjs (prebuild)
 */
/**
 * Mapping ville → secteur large (anonymisation géographique).
 *
 * Règle d'or : aucune ville ne doit fuiter dans le silo `public_listings`.
 * Le secteur est volontairement plus large (couronne, région métropolitaine).
 *
 * Port TypeScript de `00_RPA_SYSTEME_APP/.../constants/publicListing.js`.
 * Retourner `null` sur ville inconnue est délibéré : on préfère omettre que
 * fournir un secteur fallback qui faciliterait la rétro-identification.
 */

export const VILLE_TO_SECTEUR: Readonly<Record<string, string>> = Object.freeze({
  // Île de Montréal
  'Montréal': 'Île de Montréal',
  'Laval': 'Laval',

  // Rive-Sud
  'Longueuil': 'Rive-Sud',
  'Brossard': 'Rive-Sud',
  'Saint-Lambert': 'Rive-Sud',
  'Boucherville': 'Rive-Sud',
  'Saint-Bruno': 'Rive-Sud',
  'Saint-Hubert': 'Rive-Sud',

  // Couronne Nord
  'Terrebonne': 'Couronne Nord',
  'Blainville': 'Couronne Nord',
  'Repentigny': 'Couronne Nord',
  'Mascouche': 'Couronne Nord',
  'Boisbriand': 'Couronne Nord',
  'Sainte-Thérèse': 'Couronne Nord',
  'Mirabel': 'Couronne Nord',

  // Laurentides
  'Saint-Jérôme': 'Laurentides',
  'Mont-Tremblant': 'Laurentides',
  'Sainte-Agathe': 'Laurentides',

  // Lanaudière
  'Joliette': 'Lanaudière',
  "L'Assomption": 'Lanaudière',

  // Montérégie Ouest
  'Châteauguay': 'Montérégie Ouest',
  'Vaudreuil-Dorion': 'Montérégie Ouest',
  'Salaberry-de-Valleyfield': 'Montérégie Ouest',

  // Montérégie Est
  'Saint-Hyacinthe': 'Montérégie Est',
  'Granby': 'Montérégie Est',
  'Sorel-Tracy': 'Montérégie Est',

  // Estrie
  'Sherbrooke': 'Estrie',
  'Magog': 'Estrie',

  // Capitale-Nationale
  'Québec': 'Région de Québec',
  'Lévis': 'Région de Québec',
  'Beauport': 'Région de Québec',
  'Charlesbourg': 'Région de Québec',

  // Mauricie
  'Trois-Rivières': 'Mauricie',
  'Shawinigan': 'Mauricie',

  // Saguenay – Lac-Saint-Jean
  'Saguenay': 'Saguenay–Lac-Saint-Jean',
  'Chicoutimi': 'Saguenay–Lac-Saint-Jean',
  'Alma': 'Saguenay–Lac-Saint-Jean',

  // Outaouais
  'Gatineau': 'Outaouais',
  'Hull': 'Outaouais',

  // Bas-Saint-Laurent
  'Rimouski': 'Bas-Saint-Laurent',
  'Rivière-du-Loup': 'Bas-Saint-Laurent',

  // Centre-du-Québec
  'Drummondville': 'Centre-du-Québec',
  'Victoriaville': 'Centre-du-Québec',
});

/**
 * Convertit une ville en secteur anonymisé.
 *
 * @param ville Nom brut côté Firestore (peut être `null`, vide, ou inconnu).
 * @returns Secteur correspondant, ou `null` si la ville est inconnue / vide.
 *          Préférer `null` au fallback : aucune divulgation par déduction inverse.
 */
export function villeToSecteur(ville: string | null | undefined): string | null {
  if (typeof ville !== 'string') return null;
  const trimmed = ville.trim();
  if (!trimmed) return null;
  return VILLE_TO_SECTEUR[trimmed] ?? null;
}
