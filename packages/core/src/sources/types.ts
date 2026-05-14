/**
 * Types pour la normalisation des sources externes
 *
 * Mission 2 — Sources externes
 *
 * Ces types définissent la structure canonique pour représenter
 * les liens externes (MSSS, REQ, site web) de manière exploitable.
 */

/**
 * Source Registre RPA (MSSS)
 * Lien vers le registre des résidences pour personnes âgées
 */
export interface SourceRegistreRPA {
  /** URL complète vers la fiche MSSS */
  url?: string;
  /** Numéro de registre MSSS */
  numero?: string;
  /** La source est-elle reconnue comme valide? */
  isRecognized: boolean;
  /** Dernière vérification de la source */
  lastCheckedAt?: string;
}

/**
 * Source REQ (Registraire des entreprises du Québec)
 * Informations sur l'entité juridique
 */
export interface SourceREQ {
  /** Numéro d'entreprise du Québec (NEQ) */
  neq?: string;
  /** URL vers la fiche REQ (construit à partir du NEQ) */
  url?: string;
  /** La source est-elle reconnue comme valide? */
  isRecognized: boolean;
  /** Dernière vérification de la source */
  lastCheckedAt?: string;
}

/**
 * Source Site Web de la résidence
 */
export interface SourceSiteWeb {
  /** URL du site web de la résidence */
  url?: string;
  /** La source est-elle reconnue comme valide? */
  isRecognized: boolean;
  /** Dernière vérification de la source */
  lastCheckedAt?: string;
}

/**
 * Structure canonique des sources externes
 *
 * Cette structure regroupe toutes les sources externes
 * d'une résidence de manière normalisée.
 */
export interface SourcesExternes {
  /** Source Registre RPA (MSSS) */
  registreRPA?: SourceRegistreRPA;
  /** Source REQ (Registraire des entreprises) */
  req?: SourceREQ;
  /** Site web de la résidence */
  siteWeb?: SourceSiteWeb;
}

/**
 * Type de source externe
 */
export type SourceType = 'registreRPA' | 'req' | 'siteWeb';

/**
 * Résultat de détection de source
 */
export interface SourceDetectionResult {
  type: SourceType;
  isRecognized: boolean;
  rawValue: string;
  normalizedValue?: string;
}
