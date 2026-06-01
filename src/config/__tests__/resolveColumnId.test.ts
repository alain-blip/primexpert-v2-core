/**
 * Protection Kanban — couverture exhaustive de resolveColumnId().
 * Aucun statut actif du pipeline ne doit retourner null.
 */

import { describe, expect, it } from 'vitest';
import {
  ACTIVE_PIPELINE_RAW_STATUTS,
  PIPELINE_ACTIVE_STATUSES,
  resolveColumnId,
  type PipelineColumnId,
} from '../pipelineStages';

const LEGACY_TO_COLUMN: Record<string, PipelineColumnId> = {
  prospection: 'prospect',
  prospect: 'prospect',
  lead: 'prospect',
  qualification: 'prospect',
  mandat: 'mandate',
  'en-mandat': 'mandate',
  actif: 'mandate',
  listed: 'mandate',
  promesse: 'promise',
  'promesse-achat': 'promise',
  'pa-acceptee': 'promise',
  'due-diligence': 'promise',
  financement: 'promise',
  'transfert-permis': 'promise',
  vendu: 'sold',
  vendue: 'sold',
  cloture: 'sold',
  fermee: 'sold',
  fermée: 'sold',
  clos: 'sold',
  success: 'sold',
  succes: 'sold',
};

describe('resolveColumnId — protection Kanban', () => {
  it('retourne null pour entrées vides ou hors pipeline', () => {
    expect(resolveColumnId(null)).toBeNull();
    expect(resolveColumnId(undefined)).toBeNull();
    expect(resolveColumnId('')).toBeNull();
    expect(resolveColumnId('   ')).toBeNull();
    expect(resolveColumnId('expired')).toBeNull();
    expect(resolveColumnId('expiré')).toBeNull();
    expect(resolveColumnId('archive')).toBeNull();
    expect(resolveColumnId('froid')).toBeNull();
    expect(resolveColumnId('unknown-status')).toBeNull();
  });

  it('résout les slugs Firestore canoniques (PIPELINE_COLUMN_SET)', () => {
    for (const columnId of PIPELINE_ACTIVE_STATUSES) {
      expect(resolveColumnId(columnId)).toBe(columnId);
      expect(resolveColumnId(columnId.toUpperCase())).toBe(columnId);
      expect(resolveColumnId(`  ${columnId}  `)).toBe(columnId);
    }
  });

  it('résout mandate via slug canonique direct', () => {
    expect(resolveColumnId('mandate')).toBe('mandate');
  });

  it('résout tous les statuts bruts actifs (ACTIVE_PIPELINE_RAW_STATUTS)', () => {
    for (const raw of ACTIVE_PIPELINE_RAW_STATUTS) {
      const column = resolveColumnId(raw);
      expect(column, `statut actif « ${raw} » ne doit pas casser le Kanban`).not.toBeNull();
      expect(PIPELINE_ACTIVE_STATUSES).toContain(column);
    }
  });

  it('résout le mapping legacy Copilote / FR → colonne canonique', () => {
    for (const [raw, expected] of Object.entries(LEGACY_TO_COLUMN)) {
      expect(resolveColumnId(raw)).toBe(expected);
    }
  });

  it('résout via slugTable (diacritiques et séparateurs normalisés)', () => {
    expect(resolveColumnId('en-prospection')).toBe('prospect');
    expect(resolveColumnId('EN MANDAT')).toBe('mandate');
    expect(resolveColumnId('en-promesse')).toBe('promise');
    expect(resolveColumnId('PA Acceptée')).toBe('promise');
    expect(resolveColumnId('due_diligence')).toBe('promise');
    expect(resolveColumnId('transfert-permis')).toBe('promise');
    expect(resolveColumnId('fermée')).toBe('sold');
    expect(resolveColumnId('succès')).toBe('sold');
  });

  it('résout via heuristiques substring (fallback slug)', () => {
    expect(resolveColumnId('attente-mandat')).toBe('mandate');
    expect(resolveColumnId('sous-promesse')).toBe('promise');
    expect(resolveColumnId('promis-achat')).toBe('promise');
    expect(resolveColumnId('bien-vendu')).toBe('sold');
    expect(resolveColumnId('sold-pending')).toBe('sold');
    expect(resolveColumnId('lead-chaud')).toBe('prospect');
    expect(resolveColumnId('prospection-active')).toBe('prospect');
    expect(resolveColumnId('prosp-initiale')).toBe('prospect');
  });

  it('résout des variantes RESO / Centris sans null quand mappables', () => {
    expect(resolveColumnId('pa-acceptee')).toBe('promise');
    expect(resolveColumnId('PA-ACCEPTEE')).toBe('promise');
    expect(resolveColumnId('Under Contract')).toBeNull();
  });
});
