/**
 * Définition des sections — Identité fusionnée.
 */

import type { IdentityFieldRow, IdentitySectionId } from './types';
import {
  resolveIdentityField,
  isFieldEmpty,
} from './resolveIdentityField';
import { formatIdentityScalar } from './formatIdentityDisplay';
import { shouldShowRaphaelForField } from './msssRaphaelBadge';
import { BUILDING_AUDIT_SECTIONS } from './buildingAuditSections';

export interface IdentityFieldDef {
  id: string;
  canonicalKey?: string;
  nestedPath?: string[];
  labelFr: string;
  labelEn: string;
  format?: (doc: Record<string, unknown>) => string | null;
  confirmedPath?: string[];
  inputType?: 'text' | 'number' | 'sprinkler' | 'currency' | 'percent';
}

export interface IdentitySectionDef {
  id: IdentitySectionId;
  titleFr: string;
  titleEn: string;
  accent: string;
  fields: IdentityFieldDef[];
}

function formatAdministratorsList(raw: unknown): string {
  if (Array.isArray(raw) && raw.length > 0) {
    return raw
      .map((row) => {
        if (row && typeof row === 'object') {
          const r = row as Record<string, unknown>;
          const name = r.nom ?? r.name ?? r.raisonSociale ?? '—';
          const role = r.fonction ?? r.role;
          return role != null ? `${name} (${role})` : String(name);
        }
        return String(row);
      })
      .join(' · ');
  }
  return formatIdentityScalar(raw, '—');
}

export const IDENTITY_SECTION_DEFS: IdentitySectionDef[] = [
  {
    id: 'establishment',
    titleFr: "Identification de l'établissement",
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
      {
        id: 'residenceType',
        canonicalKey: 'residenceType',
        labelFr: 'Type de résidence',
        labelEn: 'Residence type',
      },
      {
        id: 'categorieRPA',
        canonicalKey: 'categorieRPA',
        labelFr: 'Catégorie RPA',
        labelEn: 'RPA category',
      },
      {
        id: 'dateOuverture',
        canonicalKey: 'dateOuverture',
        labelFr: "Date d'ouverture",
        labelEn: 'Opening date',
      },
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
      {
        id: 'raisonSociale',
        canonicalKey: 'raisonSociale',
        labelFr: 'Raison sociale',
        labelEn: 'Legal name',
      },
      {
        id: 'formeJuridique',
        canonicalKey: 'formeJuridique',
        labelFr: 'Forme juridique',
        labelEn: 'Legal form',
      },
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
        id: 'administrateursREQ',
        labelFr: 'Administrateurs (REQ)',
        labelEn: 'Administrators (REQ)',
        format: (d) =>
          formatAdministratorsList(
            d.administrateursREQ ?? d.administrateurs ?? d.administrateursRegistre
          ),
        nestedPath: ['structureJuridique', 'administrateursREQ'],
        confirmedPath: ['structureJuridique', 'confirmedBy'],
      },
      {
        id: 'administrateursMSSS',
        labelFr: 'Administrateurs (MSSS)',
        labelEn: 'Administrators (MSSS)',
        format: (d) => formatAdministratorsList(d.administrateursMSSS),
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
];

export const SERVICES_SECTION_DEF: IdentitySectionDef = {
  id: 'services',
  titleFr: 'Services & Reconnaissance',
  titleEn: 'Services & recognition',
  accent: '#059669',
  fields: [
    {
      id: 'servicesCategorieRPA',
      canonicalKey: 'categorieRPA',
      labelFr: 'Catégorie RPA',
      labelEn: 'RPA category',
    },
    {
      id: 'numeroRQRA',
      labelFr: 'Numéro RQRA',
      labelEn: 'RQRA number',
      nestedPath: ['servicesReconnaissance', 'numeroRQRA'],
      confirmedPath: ['servicesReconnaissance', 'confirmedBy'],
      format: (d) =>
        formatIdentityScalar(
          d.servicesReconnaissance && typeof d.servicesReconnaissance === 'object'
            ? (d.servicesReconnaissance as Record<string, unknown>).numeroRQRA
            : d.numeroRQRA,
          '—'
        ),
    },
    {
      id: 'niveauSoins',
      labelFr: 'Niveau de soins',
      labelEn: 'Care level',
      nestedPath: ['servicesReconnaissance', 'niveauSoins'],
      confirmedPath: ['servicesReconnaissance', 'confirmedBy'],
      format: (d) =>
        formatIdentityScalar(
          d.servicesReconnaissance && typeof d.servicesReconnaissance === 'object'
            ? (d.servicesReconnaissance as Record<string, unknown>).niveauSoins
            : d.niveauSoins,
          '—'
        ),
    },
  ],
};

/** Toutes les sections à champs éditables (grilles). */
export function getAllIdentitySectionDefs(): IdentitySectionDef[] {
  return [...IDENTITY_SECTION_DEFS, ...BUILDING_AUDIT_SECTIONS, SERVICES_SECTION_DEF];
}

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

    const display = def.format ? def.format(doc) : formatIdentityScalar(raw);

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
      value: display ?? '—',
      empty,
      inputType: def.inputType ?? inferInputType(def.id),
      showRaphaelBadge: shouldShowRaphaelForField(doc, def.id, {
        value: raw ?? display,
        confirmedBy,
        forceEmpty: empty,
      }),
    };
  });
}

function inferInputType(fieldId: string): IdentityFieldRow['inputType'] {
  if (fieldId === 'systemeGicleurs' || fieldId === 'generatrice' || fieldId === 'ascenseur') {
    return 'sprinkler';
  }
  if (
    fieldId.includes('evaluation') ||
    fieldId.includes('valeurMarche') ||
    fieldId.includes('Fonciere')
  ) {
    return 'currency';
  }
  if (fieldId.includes('ecart') || fieldId.includes('Pct') || fieldId === 'tauxOccupation') {
    return 'percent';
  }
  if (
    fieldId === 'anneeConstruction' ||
    fieldId === 'nombreEtages' ||
    fieldId === 'superficieBatiment' ||
    fieldId === 'superficieTerrain' ||
    fieldId === 'nombreAscenseurs'
  ) {
    return 'number';
  }
  return 'text';
}
