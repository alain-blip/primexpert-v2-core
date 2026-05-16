/**
 * Définition des sections — Identité fusionnée.
 */

import type { IdentityFieldRow, IdentitySectionId } from './types';
import {
  resolveIdentityField,
  resolveGeneratorDisplay,
  resolveSprinklerDisplay,
  isFieldEmpty,
} from './resolveIdentityField';
import { formatIdentityScalar } from './formatIdentityDisplay';
import { shouldShowRaphaelBadge } from './msssRaphaelBadge';

export interface IdentityFieldDef {
  id: string;
  canonicalKey?: string;
  nestedPath?: string[];
  labelFr: string;
  labelEn: string;
  format?: (doc: Record<string, unknown>) => string | null;
  confirmedPath?: string[];
}

export interface IdentitySectionDef {
  id: IdentitySectionId;
  titleFr: string;
  titleEn: string;
  accent: string;
  fields: IdentityFieldDef[];
}

export const IDENTITY_SECTION_DEFS: IdentitySectionDef[] = [
  {
    id: 'establishment',
    titleFr: 'Identification de l\'établissement',
    titleEn: 'Establishment identification',
    accent: '#2563eb',
    fields: [
      { id: 'name', canonicalKey: 'name', labelFr: 'Nom commercial', labelEn: 'Trade name' },
      {
        id: 'numeroCertification',
        canonicalKey: 'numeroCertification',
        labelFr: 'Numéro de certification',
        labelEn: 'Certification number',
      },
      { id: 'residenceType', canonicalKey: 'residenceType', labelFr: 'Type de résidence', labelEn: 'Residence type' },
      { id: 'categorieRPA', canonicalKey: 'categorieRPA', labelFr: 'Catégorie RPA', labelEn: 'RPA category' },
      { id: 'dateOuverture', canonicalKey: 'dateOuverture', labelFr: 'Date d\'ouverture', labelEn: 'Opening date' },
      { id: 'telephone', canonicalKey: 'telephone', labelFr: 'Téléphone', labelEn: 'Phone' },
      { id: 'courriel', canonicalKey: 'courriel', labelFr: 'Courriel', labelEn: 'Email' },
      { id: 'siteWeb', canonicalKey: 'siteWeb', labelFr: 'Site web', labelEn: 'Website' },
    ],
  },
  {
    id: 'legal',
    titleFr: 'Structure juridique',
    titleEn: 'Legal structure',
    accent: '#7c3aed',
    fields: [
      { id: 'raisonSociale', canonicalKey: 'raisonSociale', labelFr: 'Raison sociale', labelEn: 'Legal name' },
      { id: 'formeJuridique', canonicalKey: 'formeJuridique', labelFr: 'Forme juridique', labelEn: 'Legal form' },
      { id: 'neq', canonicalKey: 'neq', labelFr: 'NEQ', labelEn: 'NEQ' },
      {
        id: 'dateConstitution',
        labelFr: 'Date de constitution',
        labelEn: 'Incorporation date',
        format: (d) => formatIdentityScalar(d.dateConstitution, '—'),
      },
      {
        id: 'historiqueFusionREQ',
        labelFr: 'Historique fusion REQ',
        labelEn: 'REQ merger history',
        format: (d) => formatIdentityScalar(d.historiqueFusionREQ, '—'),
      },
      {
        id: 'trancheSalariesREQ',
        labelFr: 'Tranche salariés REQ',
        labelEn: 'REQ employee bracket',
        format: (d) => formatIdentityScalar(d.trancheSalariesREQ, '—'),
      },
      {
        id: 'administrateursMSSS',
        labelFr: 'Administrateurs (MSSS)',
        labelEn: 'Administrators (MSSS)',
        format: (d) => formatIdentityScalar(d.administrateursMSSS, '—'),
      },
      {
        id: 'actionnaires',
        labelFr: 'Actionnaires',
        labelEn: 'Shareholders',
        format: (d) => {
          const a = d.actionnaires;
          if (Array.isArray(a) && a.length > 0) {
            return a
              .map((row) => {
                if (row && typeof row === 'object') {
                  const r = row as Record<string, unknown>;
                  const name = r.nom ?? r.name ?? r.raisonSociale ?? '—';
                  const pct = r.pourcentage ?? r.percent ?? r.part;
                  return pct != null ? `${name} (${pct} %)` : String(name);
                }
                return String(row);
              })
              .join(' · ');
          }
          return formatIdentityScalar(a, '—');
        },
      },
    ],
  },
  {
    id: 'building',
    titleFr: 'Bâtiment & installations techniques',
    titleEn: 'Building & technical systems',
    accent: '#d97706',
    fields: [
      { id: 'anneeConstruction', canonicalKey: 'anneeConstruction', labelFr: 'Année construction', labelEn: 'Year built' },
      { id: 'nombreEtages', canonicalKey: 'nombreEtages', labelFr: 'Nombre d\'étages', labelEn: 'Floors' },
      { id: 'superficieBatiment', canonicalKey: 'superficieBatiment', labelFr: 'Superficie bâtiment (m²)', labelEn: 'Building area (m²)' },
      {
        id: 'systemeGicleurs',
        labelFr: 'Système de gicleurs',
        labelEn: 'Sprinkler system',
        format: (d) => resolveSprinklerDisplay(d) ?? '—',
      },
      {
        id: 'generatrice',
        labelFr: 'Génératrice de secours',
        labelEn: 'Emergency generator',
        format: (d) => resolveGeneratorDisplay(d) ?? '—',
        nestedPath: ['immeuble', 'generatrice'],
        confirmedPath: ['immeuble', 'confirmedBy'],
      },
      {
        id: 'historiqueInvestissementsPermis',
        labelFr: 'Historique investissements / permis',
        labelEn: 'Investment & permit history',
        format: (d) => formatIdentityScalar(d.historiqueInvestissementsPermis, '—'),
      },
      {
        id: 'mitigeursEauChaude',
        labelFr: 'Mitigeurs eau chaude',
        labelEn: 'Hot water mixing valves',
        format: (d) => formatIdentityScalar(d.mitigeursEauChaude, '—'),
      },
      {
        id: 'climatisation',
        labelFr: 'Climatisation',
        labelEn: 'Air conditioning',
        format: (d) => formatIdentityScalar(d.climatisation, '—'),
      },
      {
        id: 'constructionType',
        labelFr: 'Type de construction',
        labelEn: 'Construction type',
        nestedPath: ['immeuble', 'constructionType'],
        confirmedPath: ['immeuble', 'confirmedBy'],
        format: (d) => formatIdentityScalar(d.immeuble && typeof d.immeuble === 'object' ? (d.immeuble as Record<string, unknown>).constructionType : null, '—'),
      },
    ],
  },
];

export function buildSectionFields(
  doc: Record<string, unknown>,
  section: IdentitySectionDef
): IdentityFieldRow[] {
  return section.fields.map((def) => {
    let raw: unknown;
    if (def.format) {
      const formatted = def.format(doc);
      raw = formatted === '—' ? undefined : formatted;
    } else if (def.canonicalKey) {
      raw = resolveIdentityField(doc, def.canonicalKey, def.nestedPath);
    } else if (def.nestedPath?.length) {
      raw = resolveIdentityField(doc, def.id, def.nestedPath);
    }

    const display = def.format
      ? def.format(doc)
      : formatIdentityScalar(raw);

    const empty = display === '—' || isFieldEmpty(raw);

    let confirmedBy: unknown;
    if (def.confirmedPath?.length) {
      const parent = resolveIdentityField(doc, def.confirmedPath[0], [def.confirmedPath[0]]);
      if (parent && typeof parent === 'object' && !Array.isArray(parent)) {
        confirmedBy = (parent as Record<string, unknown>).confirmedBy;
      }
    }

    return {
      id: def.id,
      labelFr: def.labelFr,
      labelEn: def.labelEn,
      value: display,
      empty,
      showRaphaelBadge: shouldShowRaphaelBadge(doc, {
        value: raw ?? display,
        confirmedBy,
        forceEmpty: empty,
      }),
    };
  });
}
