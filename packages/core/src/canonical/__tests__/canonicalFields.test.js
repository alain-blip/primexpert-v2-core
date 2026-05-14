/**
 * Tests pour le module canonical
 *
 * Mission 3 — Champs canoniques & Alias Mapper
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import {
  // Alias
  getCanonicalName,
  isCanonicalName,
  isKnownField,
  getAllFieldNames,
  getFieldsByCategory,
  getRequiredFields,
  ALIAS_TO_CANONICAL,
  ALL_CANONICAL_FIELDS,

  // Helpers
  getResidenceField,
  getResidenceFields,
  hasResidenceField,
  prepareCanonicalPatch,
  prepareCanonicalPatchWithAliases,
  validateRequiredFields,
  coerceFieldValue,
  extractCanonicalFields,
  getFieldCoverageReport,

  // Provenance
  createManualProvenance,
  createRegistreRPAProvenance,
  createPDFProvenance,
  compareProvenance,
  shouldOverwrite,
  mergeProvenanceMaps,
  getProvenanceSummary,
  getWeakProvenanceFields,
  createProvenancePatch,
} from '../index';

// Mock de Date pour des tests déterministes
const MOCK_DATE = '2025-01-15T10:00:00.000Z';

describe('fieldAliases', () => {
  // ===========================================================================
  // Tests des maps
  // ===========================================================================
  describe('ALIAS_TO_CANONICAL', () => {
    it('devrait mapper nomResidence vers name', () => {
      expect(ALIAS_TO_CANONICAL['nomResidence']).toBe('name');
    });

    it('devrait mapper prixDemande vers askingPrice', () => {
      expect(ALIAS_TO_CANONICAL['prixDemande']).toBe('askingPrice');
    });

    it('devrait mapper unitsCount vers nombreUnitesTotal', () => {
      expect(ALIAS_TO_CANONICAL['unitsCount']).toBe('nombreUnitesTotal');
    });

    it('devrait mapper sprinklers vers systemeGicleurs', () => {
      expect(ALIAS_TO_CANONICAL['sprinklers']).toBe('systemeGicleurs');
    });

    it('devrait mapper le canonical vers lui-même', () => {
      expect(ALIAS_TO_CANONICAL['name']).toBe('name');
      expect(ALIAS_TO_CANONICAL['askingPrice']).toBe('askingPrice');
    });
  });

  describe('getCanonicalName', () => {
    it('devrait retourner le canonical pour un alias', () => {
      expect(getCanonicalName('nomResidence')).toBe('name');
      expect(getCanonicalName('adresse')).toBe('address');
      expect(getCanonicalName('ville')).toBe('municipalite');
    });

    it('devrait retourner le canonical pour un canonical', () => {
      expect(getCanonicalName('name')).toBe('name');
      expect(getCanonicalName('address')).toBe('address');
    });

    it('devrait retourner undefined pour un champ inconnu', () => {
      expect(getCanonicalName('champInconnu')).toBeUndefined();
    });
  });

  describe('isCanonicalName', () => {
    it('devrait retourner true pour un canonical', () => {
      expect(isCanonicalName('name')).toBe(true);
      expect(isCanonicalName('nombreUnitesTotal')).toBe(true);
    });

    it('devrait retourner false pour un alias', () => {
      expect(isCanonicalName('nomResidence')).toBe(false);
      expect(isCanonicalName('unitsCount')).toBe(false);
    });
  });

  describe('isKnownField', () => {
    it('devrait retourner true pour canonical et alias', () => {
      expect(isKnownField('name')).toBe(true);
      expect(isKnownField('nomResidence')).toBe(true);
    });

    it('devrait retourner false pour un champ inconnu', () => {
      expect(isKnownField('champInconnu')).toBe(false);
    });
  });

  describe('getAllFieldNames', () => {
    it('devrait retourner tous les noms pour name', () => {
      const names = getAllFieldNames('name');
      expect(names).toContain('name');
      expect(names).toContain('nomResidence');
      expect(names).toContain('nom');
    });

    it('devrait retourner un tableau vide pour un champ inconnu', () => {
      expect(getAllFieldNames('champInconnu')).toEqual([]);
    });
  });

  describe('getFieldsByCategory', () => {
    it('devrait retourner les champs identity', () => {
      const fields = getFieldsByCategory('identity');
      expect(fields.some(f => f.canonical === 'name')).toBe(true);
      expect(fields.some(f => f.canonical === 'residenceType')).toBe(true);
    });

    it('devrait retourner les champs capacity', () => {
      const fields = getFieldsByCategory('capacity');
      expect(fields.some(f => f.canonical === 'nombreUnitesTotal')).toBe(true);
      expect(fields.some(f => f.canonical === 'tauxOccupation')).toBe(true);
    });
  });

  describe('getRequiredFields', () => {
    it('devrait retourner les champs requis', () => {
      const required = getRequiredFields();
      expect(required.some(f => f.canonical === 'name')).toBe(true);
      expect(required.some(f => f.canonical === 'address')).toBe(true);
      expect(required.some(f => f.canonical === 'nombreUnitesTotal')).toBe(true);
    });
  });
});

describe('canonicalHelpers', () => {
  // ===========================================================================
  // Tests de lecture
  // ===========================================================================
  describe('getResidenceField', () => {
    it('devrait lire le champ canonique en priorité', () => {
      const residence = { name: 'RPA 1', nomResidence: 'RPA Legacy' };
      expect(getResidenceField(residence, 'name')).toBe('RPA 1');
    });

    it('devrait fallback sur les alias si canonical absent', () => {
      const residence = { nomResidence: 'RPA Legacy' };
      expect(getResidenceField(residence, 'name')).toBe('RPA Legacy');
    });

    it('devrait retourner undefined si aucune valeur', () => {
      const residence = {};
      expect(getResidenceField(residence, 'name')).toBeUndefined();
    });

    it('devrait retourner la valeur par défaut si définie', () => {
      const residence = {};
      // nombreChambresSimples a defaultValue: 0
      expect(getResidenceField(residence, 'nombreChambresSimples')).toBe(0);
    });

    it('devrait gérer null et undefined', () => {
      expect(getResidenceField(null, 'name')).toBeUndefined();
      expect(getResidenceField(undefined, 'name')).toBeUndefined();
    });

    it('devrait ignorer les valeurs vides', () => {
      const residence = { name: '', nomResidence: 'RPA' };
      expect(getResidenceField(residence, 'name')).toBe('RPA');
    });
  });

  describe('getResidenceFields', () => {
    it('devrait lire plusieurs champs', () => {
      const residence = { nomResidence: 'RPA 1', unitsCount: 50, adresse: '123 rue Test' };
      const fields = getResidenceFields(residence, ['name', 'nombreUnitesTotal', 'address']);

      expect(fields.name).toBe('RPA 1');
      expect(fields.nombreUnitesTotal).toBe(50);
      expect(fields.address).toBe('123 rue Test');
    });
  });

  describe('hasResidenceField', () => {
    it('devrait retourner true si le champ a une valeur', () => {
      expect(hasResidenceField({ name: 'RPA' }, 'name')).toBe(true);
      expect(hasResidenceField({ nomResidence: 'RPA' }, 'name')).toBe(true);
    });

    it('devrait retourner false si le champ est vide', () => {
      expect(hasResidenceField({}, 'name')).toBe(false);
      expect(hasResidenceField({ name: '' }, 'name')).toBe(false);
      expect(hasResidenceField({ name: null }, 'name')).toBe(false);
    });
  });

  // ===========================================================================
  // Tests d'écriture
  // ===========================================================================
  describe('prepareCanonicalPatch', () => {
    it('devrait convertir les alias en canonical', () => {
      const patch = prepareCanonicalPatch({
        nomResidence: 'RPA 1',
        unitsCount: 50,
        adresse: '123 rue Test',
      });

      expect(patch.name).toBe('RPA 1');
      expect(patch.nombreUnitesTotal).toBe(50);
      expect(patch.address).toBe('123 rue Test');
      expect(patch.nomResidence).toBeUndefined();
    });

    it('devrait garder les champs non canoniques', () => {
      const patch = prepareCanonicalPatch({
        name: 'RPA 1',
        customField: 'valeur',
      });

      expect(patch.name).toBe('RPA 1');
      expect(patch.customField).toBe('valeur');
    });
  });

  describe('prepareCanonicalPatchWithAliases', () => {
    it('devrait écrire dans les alias si demandé', () => {
      const patch = prepareCanonicalPatchWithAliases(
        { name: 'RPA 1' },
        true
      );

      expect(patch.name).toBe('RPA 1');
      expect(patch.nomResidence).toBe('RPA 1');
      expect(patch.nom).toBe('RPA 1');
    });

    it('devrait ne pas écrire dans les alias par défaut', () => {
      const patch = prepareCanonicalPatchWithAliases(
        { name: 'RPA 1' },
        false
      );

      expect(patch.name).toBe('RPA 1');
      expect(patch.nomResidence).toBeUndefined();
    });
  });

  // ===========================================================================
  // Tests de validation
  // ===========================================================================
  describe('validateRequiredFields', () => {
    it('devrait valider si tous les champs requis sont présents', () => {
      const residence = { name: 'RPA', address: '123 rue', nombreUnitesTotal: 50 };
      const result = validateRequiredFields(residence);

      expect(result.valid).toBe(true);
      expect(result.missing).toHaveLength(0);
    });

    it('devrait reporter les champs manquants', () => {
      const residence = { name: 'RPA' };
      const result = validateRequiredFields(residence);

      expect(result.valid).toBe(false);
      expect(result.missing).toContain('address');
      expect(result.missing).toContain('nombreUnitesTotal');
    });
  });

  describe('coerceFieldValue', () => {
    it('devrait convertir en number', () => {
      const def = { canonical: 'test', aliases: [], category: 'capacity', type: 'number', description: '' };
      expect(coerceFieldValue('50', def)).toBe(50);
      expect(coerceFieldValue('1,234.56', def)).toBe(1234.56);
    });

    it('devrait convertir en boolean', () => {
      const def = { canonical: 'test', aliases: [], category: 'safety', type: 'boolean', description: '' };
      expect(coerceFieldValue('true', def)).toBe(true);
      expect(coerceFieldValue('false', def)).toBe(false);
      expect(coerceFieldValue('oui', def)).toBe(true);
    });

    it('devrait retourner la valeur par défaut si vide', () => {
      const def = { canonical: 'test', aliases: [], category: 'capacity', type: 'number', description: '', defaultValue: 0 };
      expect(coerceFieldValue('', def)).toBe(0);
      expect(coerceFieldValue(null, def)).toBe(0);
    });
  });

  // ===========================================================================
  // Tests d'utilitaires
  // ===========================================================================
  describe('extractCanonicalFields', () => {
    it('devrait extraire et normaliser les champs', () => {
      const residence = {
        nomResidence: 'RPA 1',
        unitsCount: 50,
        adresse: '123 rue',
        customField: 'ignoré',
      };

      const canonical = extractCanonicalFields(residence);

      expect(canonical.name).toBe('RPA 1');
      expect(canonical.nombreUnitesTotal).toBe(50);
      expect(canonical.address).toBe('123 rue');
      expect(canonical.customField).toBeUndefined();
    });
  });

  describe('getFieldCoverageReport', () => {
    it('devrait calculer la couverture', () => {
      const residence = {
        name: 'RPA',
        address: '123 rue',
        nombreUnitesTotal: 50,
      };

      const report = getFieldCoverageReport(residence);

      // Au moins les 3 champs fournis + les champs avec defaultValue (0)
      expect(report.filled).toBeGreaterThanOrEqual(3);
      expect(report.total).toBe(ALL_CANONICAL_FIELDS.length);
      expect(report.missing).not.toContain('name');
      expect(report.missing).not.toContain('address');
      expect(report.missing).not.toContain('nombreUnitesTotal');
      expect(report.coverage).toBeGreaterThan(0);
    });
  });
});

describe('fieldProvenance', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(MOCK_DATE));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ===========================================================================
  // Tests de création
  // ===========================================================================
  describe('createManualProvenance', () => {
    it('devrait créer une provenance manuelle', () => {
      const prov = createManualProvenance('user123', 'Correction manuelle');

      expect(prov.source).toBe('Manual');
      expect(prov.confidence).toBe('high');
      expect(prov.modifiedBy).toBe('user123');
      expect(prov.notes).toBe('Correction manuelle');
      expect(prov.dateSource).toBe(MOCK_DATE);
    });
  });

  describe('createRegistreRPAProvenance', () => {
    it('devrait créer une provenance MSSS', () => {
      const prov = createRegistreRPAProvenance('2025-01-10', 'Sync automatique');

      expect(prov.source).toBe('RegistreRPA');
      expect(prov.confidence).toBe('high');
      expect(prov.dateSource).toBe('2025-01-10');
    });
  });

  describe('createPDFProvenance', () => {
    it('devrait créer une provenance PDF', () => {
      const prov = createPDFProvenance('rapport-annuel.pdf', 'medium');

      expect(prov.source).toBe('PDF');
      expect(prov.confidence).toBe('medium');
      expect(prov.notes).toContain('rapport-annuel.pdf');
    });
  });

  // ===========================================================================
  // Tests de comparaison
  // ===========================================================================
  describe('compareProvenance', () => {
    it('devrait prioriser high > medium > low', () => {
      const high = { source: 'Manual', confidence: 'high', dateSource: MOCK_DATE };
      const medium = { source: 'PDF', confidence: 'medium', dateSource: MOCK_DATE };
      const low = { source: 'Import', confidence: 'low', dateSource: MOCK_DATE };

      expect(compareProvenance(high, medium)).toBeGreaterThan(0);
      expect(compareProvenance(medium, low)).toBeGreaterThan(0);
      expect(compareProvenance(low, high)).toBeLessThan(0);
    });

    it('devrait prioriser par source si confiance égale', () => {
      const manual = { source: 'Manual', confidence: 'high', dateSource: MOCK_DATE };
      const registre = { source: 'RegistreRPA', confidence: 'high', dateSource: MOCK_DATE };

      expect(compareProvenance(manual, registre)).toBeGreaterThan(0);
    });
  });

  describe('shouldOverwrite', () => {
    it('devrait permettre écrasement si nouvelle provenance meilleure', () => {
      const existing = { source: 'Import', confidence: 'low', dateSource: '2024-01-01' };
      const incoming = { source: 'Manual', confidence: 'high', dateSource: MOCK_DATE };

      expect(shouldOverwrite(existing, incoming)).toBe(true);
    });

    it('devrait refuser écrasement si nouvelle provenance moins bonne', () => {
      const existing = { source: 'Manual', confidence: 'high', dateSource: '2024-01-01' };
      const incoming = { source: 'Import', confidence: 'low', dateSource: MOCK_DATE };

      expect(shouldOverwrite(existing, incoming)).toBe(false);
    });

    it('devrait permettre écrasement si pas de provenance existante', () => {
      const incoming = { source: 'Import', confidence: 'low', dateSource: MOCK_DATE };
      expect(shouldOverwrite(undefined, incoming)).toBe(true);
    });
  });

  describe('mergeProvenanceMaps', () => {
    it('devrait fusionner en gardant la meilleure provenance', () => {
      const existing = {
        name: { source: 'Import', confidence: 'low', dateSource: '2024-01-01' },
        address: { source: 'Manual', confidence: 'high', dateSource: '2024-01-01' },
      };
      const incoming = {
        name: { source: 'Manual', confidence: 'high', dateSource: MOCK_DATE },
        address: { source: 'PDF', confidence: 'medium', dateSource: MOCK_DATE },
      };

      const merged = mergeProvenanceMaps(existing, incoming);

      // name: incoming est meilleur
      expect(merged.name.source).toBe('Manual');
      // address: existing est meilleur (high vs medium)
      expect(merged.address.source).toBe('Manual');
      expect(merged.address.dateSource).toBe('2024-01-01');
    });
  });

  // ===========================================================================
  // Tests d'analyse
  // ===========================================================================
  describe('getProvenanceSummary', () => {
    it('devrait calculer un résumé', () => {
      const map = {
        name: { source: 'Manual', confidence: 'high', dateSource: MOCK_DATE },
        address: { source: 'Manual', confidence: 'high', dateSource: MOCK_DATE },
        neq: { source: 'REQ', confidence: 'high', dateSource: MOCK_DATE },
      };

      const summary = getProvenanceSummary(map);

      expect(summary.totalFields).toBe(3);
      expect(summary.bySource.Manual).toBe(2);
      expect(summary.bySource.REQ).toBe(1);
      expect(summary.byConfidence.high).toBe(3);
    });

    it('devrait retourner un résumé vide pour undefined', () => {
      const summary = getProvenanceSummary(undefined);
      expect(summary.totalFields).toBe(0);
    });
  });

  describe('getWeakProvenanceFields', () => {
    it('devrait identifier les champs avec faible confiance', () => {
      const map = {
        name: { source: 'Manual', confidence: 'high', dateSource: MOCK_DATE },
        address: { source: 'Import', confidence: 'low', dateSource: MOCK_DATE },
      };

      const weak = getWeakProvenanceFields(map, { minConfidence: 'medium' });

      expect(weak).toContain('address');
      expect(weak).not.toContain('name');
    });
  });

  describe('createProvenancePatch', () => {
    it('devrait créer un patch avec provenance', () => {
      const provenance = createManualProvenance('user123');
      const patch = createProvenancePatch(
        { name: 'RPA', address: '123 rue' },
        provenance
      );

      expect(patch.name).toBe('RPA');
      expect(patch.address).toBe('123 rue');
      expect(patch['fieldProvenance.name']).toEqual(provenance);
      expect(patch['fieldProvenance.address']).toEqual(provenance);
    });
  });
});
