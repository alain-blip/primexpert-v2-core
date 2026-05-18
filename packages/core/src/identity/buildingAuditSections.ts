/**
 * Bâtiment — 5 blocs d'audit distincts (Phase 4).
 */

import type { IdentitySectionDef } from './identitySections';
import { formatIdentityScalar } from './formatIdentityDisplay';
import { resolveGeneratorDisplay, resolveSprinklerDisplay } from './resolveIdentityField';

export const BUILDING_AUDIT_SECTIONS: IdentitySectionDef[] = [
  {
    id: 'building_cadastre',
    titleFr: 'Cadastre et évaluation municipale',
    titleEn: 'Cadastre & municipal assessment',
    accent: '#0d9488',
    fields: [
      {
        id: 'lotsCadastraux',
        canonicalKey: 'lotsCadastraux',
        labelFr: 'Lots cadastraux',
        labelEn: 'Cadastral lots',
      },
      {
        id: 'superficieTerrain',
        canonicalKey: 'superficieTerrain',
        labelFr: 'Superficie terrain (m²)',
        labelEn: 'Land area (m²)',
      },
      {
        id: 'evaluationTerrain',
        labelFr: 'Évaluation terrain ($)',
        labelEn: 'Land assessment ($)',
        nestedPath: ['cadastre', 'evaluationTerrain'],
        confirmedPath: ['cadastre', 'confirmedBy'],
        format: (d) =>
          formatIdentityScalar(
            d.cadastre && typeof d.cadastre === 'object'
              ? (d.cadastre as Record<string, unknown>).evaluationTerrain
              : d.evaluationTerrain,
            '—'
          ),
      },
      {
        id: 'evaluationBatiment',
        labelFr: 'Évaluation bâtiment ($)',
        labelEn: 'Building assessment ($)',
        nestedPath: ['cadastre', 'evaluationBatiment'],
        confirmedPath: ['cadastre', 'confirmedBy'],
        format: (d) =>
          formatIdentityScalar(
            d.cadastre && typeof d.cadastre === 'object'
              ? (d.cadastre as Record<string, unknown>).evaluationBatiment
              : d.evaluationBatiment,
            '—'
          ),
      },
      {
        id: 'evaluationFonciere',
        canonicalKey: 'evaluationFonciere',
        labelFr: 'Évaluation foncière totale ($)',
        labelEn: 'Total property assessment ($)',
      },
    ],
  },
  {
    id: 'building_crossval',
    titleFr: 'Validation croisée — évaluation & JLR',
    titleEn: 'Cross-validation — assessment & JLR',
    accent: '#6366f1',
    fields: [
      {
        id: 'valeurMarcheJLR',
        labelFr: 'Valeur marché JLR ($)',
        labelEn: 'JLR market value ($)',
        nestedPath: ['validationJLR', 'valeurMarche'],
        confirmedPath: ['validationJLR', 'confirmedBy'],
        format: (d) =>
          formatIdentityScalar(
            d.validationJLR && typeof d.validationJLR === 'object'
              ? (d.validationJLR as Record<string, unknown>).valeurMarche
              : d.valeurMarcheJLR,
            '—'
          ),
      },
      {
        id: 'comparatifJLR',
        labelFr: 'Comparatif JLR',
        labelEn: 'JLR comparables',
        nestedPath: ['validationJLR', 'comparatif'],
        confirmedPath: ['validationJLR', 'confirmedBy'],
        format: (d) =>
          formatIdentityScalar(
            d.validationJLR && typeof d.validationJLR === 'object'
              ? (d.validationJLR as Record<string, unknown>).comparatif
              : d.comparatifJLR,
            '—'
          ),
      },
      {
        id: 'historiqueEvaluationsJLR',
        labelFr: 'Historique évaluations JLR',
        labelEn: 'JLR assessment history',
        nestedPath: ['validationJLR', 'historique'],
        confirmedPath: ['validationJLR', 'confirmedBy'],
        format: (d) =>
          formatIdentityScalar(
            d.validationJLR && typeof d.validationJLR === 'object'
              ? (d.validationJLR as Record<string, unknown>).historique
              : d.historiqueEvaluationsJLR,
            '—'
          ),
      },
      {
        id: 'ecartEvaluationPct',
        labelFr: 'Écart évaluation / JLR (%)',
        labelEn: 'Assessment vs JLR gap (%)',
        nestedPath: ['validationJLR', 'ecartPct'],
        confirmedPath: ['validationJLR', 'confirmedBy'],
        format: (d) =>
          formatIdentityScalar(
            d.validationJLR && typeof d.validationJLR === 'object'
              ? (d.validationJLR as Record<string, unknown>).ecartPct
              : d.ecartEvaluationPct,
            '—'
          ),
      },
    ],
  },
  {
    id: 'building_structure',
    titleFr: 'Structure du bâtiment',
    titleEn: 'Building structure',
    accent: '#d97706',
    fields: [
      {
        id: 'anneeConstruction',
        canonicalKey: 'anneeConstruction',
        labelFr: 'Année de construction',
        labelEn: 'Year built',
      },
      {
        id: 'constructionType',
        labelFr: 'Type de structure',
        labelEn: 'Structure type',
        nestedPath: ['immeuble', 'constructionType'],
        confirmedPath: ['immeuble', 'confirmedBy'],
        format: (d) =>
          formatIdentityScalar(
            d.immeuble && typeof d.immeuble === 'object'
              ? (d.immeuble as Record<string, unknown>).constructionType
              : null,
            '—'
          ),
      },
      {
        id: 'typeToiture',
        labelFr: 'Toiture',
        labelEn: 'Roofing',
        nestedPath: ['immeuble', 'toiture'],
        confirmedPath: ['immeuble', 'confirmedBy'],
        format: (d) =>
          formatIdentityScalar(
            d.immeuble && typeof d.immeuble === 'object'
              ? (d.immeuble as Record<string, unknown>).toiture
              : d.typeToiture,
            '—'
          ),
      },
      {
        id: 'nombreEtages',
        canonicalKey: 'nombreEtages',
        labelFr: "Nombre d'étages",
        labelEn: 'Floors',
      },
      {
        id: 'superficieBatiment',
        canonicalKey: 'superficieBatiment',
        labelFr: 'Superficie bâtiment (m²)',
        labelEn: 'Building area (m²)',
      },
    ],
  },
  {
    id: 'building_technical',
    titleFr: 'Installations techniques (Registre MSSS / JLR)',
    titleEn: 'Technical systems (MSSS / JLR registry)',
    accent: '#2563eb',
    fields: [
      {
        id: 'generatrice',
        labelFr: 'Génératrice de secours',
        labelEn: 'Emergency generator',
        format: (d) => resolveGeneratorDisplay(d) ?? '—',
        nestedPath: ['immeuble', 'generatrice'],
        confirmedPath: ['immeuble', 'confirmedBy'],
      },
      {
        id: 'ascenseur',
        canonicalKey: 'ascenseur',
        labelFr: 'Ascenseur',
        labelEn: 'Elevator',
        format: (d) => {
          const v = d.ascenseur;
          if (v === true) return 'Oui';
          if (v === false) return 'Non';
          return formatIdentityScalar(v, '—');
        },
      },
      {
        id: 'nombreAscenseurs',
        canonicalKey: 'nombreAscenseurs',
        labelFr: "Nombre d'ascenseurs",
        labelEn: 'Elevator count',
      },
      {
        id: 'systemeMecanique',
        labelFr: 'Système mécanique',
        labelEn: 'Mechanical system',
        nestedPath: ['immeuble', 'systemeMecanique'],
        confirmedPath: ['immeuble', 'confirmedBy'],
        format: (d) =>
          formatIdentityScalar(
            d.immeuble && typeof d.immeuble === 'object'
              ? (d.immeuble as Record<string, unknown>).systemeMecanique
              : d.systemeMecanique,
            '—'
          ),
      },
      {
        id: 'climatisation',
        labelFr: 'Climatisation',
        labelEn: 'Air conditioning',
        format: (d) => formatIdentityScalar(d.climatisation, '—'),
      },
      {
        id: 'mitigeursEauChaude',
        labelFr: 'Mitigeurs eau chaude',
        labelEn: 'Hot water mixing valves',
        format: (d) => formatIdentityScalar(d.mitigeursEauChaude, '—'),
      },
      {
        id: 'historiqueInvestissementsPermis',
        labelFr: 'Historique investissements / permis',
        labelEn: 'Investment & permit history',
        format: (d) => formatIdentityScalar(d.historiqueInvestissementsPermis, '—'),
      },
    ],
  },
  {
    id: 'building_security',
    titleFr: 'Sécurité',
    titleEn: 'Safety & fire protection',
    accent: '#dc2626',
    fields: [
      {
        id: 'systemeGicleurs',
        labelFr: 'Système de gicleurs',
        labelEn: 'Sprinkler system',
        format: (d) => resolveSprinklerDisplay(d) ?? '—',
      },
      {
        id: 'alarmeIncendie',
        labelFr: 'Alarme incendie',
        labelEn: 'Fire alarm',
        nestedPath: ['securite', 'alarmeIncendie'],
        confirmedPath: ['securite', 'confirmedBy'],
        format: (d) =>
          formatIdentityScalar(
            d.securite && typeof d.securite === 'object'
              ? (d.securite as Record<string, unknown>).alarmeIncendie
              : d.alarmeIncendie,
            '—'
          ),
      },
      {
        id: 'conformiteIncendie',
        labelFr: 'Conformité incendie',
        labelEn: 'Fire compliance',
        nestedPath: ['securite', 'conformiteIncendie'],
        confirmedPath: ['securite', 'confirmedBy'],
        format: (d) =>
          formatIdentityScalar(
            d.securite && typeof d.securite === 'object'
              ? (d.securite as Record<string, unknown>).conformiteIncendie
              : d.conformiteIncendie,
            '—'
          ),
      },
      {
        id: 'alarmeIntrusion',
        labelFr: 'Alarme intrusion',
        labelEn: 'Intrusion alarm',
        nestedPath: ['securite', 'alarmeIntrusion'],
        confirmedPath: ['securite', 'confirmedBy'],
        format: (d) =>
          formatIdentityScalar(
            d.securite && typeof d.securite === 'object'
              ? (d.securite as Record<string, unknown>).alarmeIntrusion
              : d.alarmeIntrusion,
            '—'
          ),
      },
    ],
  },
];
