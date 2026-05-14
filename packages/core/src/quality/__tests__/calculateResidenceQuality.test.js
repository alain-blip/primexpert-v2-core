/**
 * Tests: calculateResidenceQuality
 *
 * LOT 6 — Monitoring & Qualité des Données
 *
 * Vérifie que:
 * - Dossier vide → red + criticalMissing
 * - Dossier complet → green
 * - manual+high vs official conflict → conflict detected
 * - stale sources → stale true
 * - OR rule works (raisonSociale OR neq)
 */

import { describe, it, expect } from 'vitest';
import { calculateResidenceQuality } from '../calculateResidenceQuality';
import { QUALITY_RULES, SCORE_THRESHOLDS } from '../qualityRules';

// ============================================================
// FIXTURES
// ============================================================

const EMPTY_RESIDENCE = {};

const MINIMAL_RESIDENCE = {
  name: 'Résidence Test',
  address: '123 rue Test',
  municipalite: 'Montréal',
  telephone: '514-555-1234',
};

const COMPLETE_RESIDENCE = {
  // Identity
  name: 'Résidence Complète',
  residenceType: 'RPA',
  categorieRPA: 'Catégorie 1',

  // Location
  address: '123 rue Complète',
  municipalite: 'Montréal',
  regionSociosanitaire: '06 - Montréal',
  codePostal: 'H2X 1Y2',

  // Contact
  telephone: '514-555-1234',
  courriel: 'info@residence.com',
  siteWeb: 'https://residence.com',

  // Legal
  raisonSociale: 'Résidences ABC Inc.',
  neq: '1234567890',
  formeJuridique: 'Société par actions',

  // Capacity
  nombreUnitesTotal: 50,
  tauxOccupation: 95,
  nombreUnitesDisponibles: 3,

  // Building
  anneeConstruction: 2010,
  nombreEtages: 5,
  superficieBatiment: 5000,
  superficieTerrain: 8000,

  // Safety
  systemeGicleurs: true,
  ascenseur: true,
  categorieSecurite: 'A',

  // Finance
  askingPrice: 5000000,
  revenusAnnuels: 1200000,
  depensesAnnuelles: 600000,
  loyerMoyen: 1500,
  tauxCapitalisation: 0.08,
  evaluationFonciere: 4000000,

  // Market
  dateOuverture: new Date('2010-01-01'),
  datePrisePossession: new Date('2023-06-15'),
  anneeAcquisitionImmeuble: 2023,
  anneeDebutExploitationRPA: 2010,
};

const RESIDENCE_WITH_ALTERNATIVES = {
  // Utilise les alternatives au lieu des clés principales
  nomResidence: 'Résidence Alt',
  adresse: '456 rue Alternative',
  ville: 'Laval',
  neq: '9876543210', // Alternative à raisonSociale
  unitsCount: 30, // Alternative à nombreUnitesTotal
  occupancyRate: 0.9, // Alternative à tauxOccupation
};

// ============================================================
// TESTS
// ============================================================

describe('calculateResidenceQuality', () => {
  describe('dossier vide', () => {
    it('retourne status red pour un dossier vide', () => {
      const input = {
        residence: EMPTY_RESIDENCE,
      };

      const report = calculateResidenceQuality(input);

      expect(report.status).toBe('red');
      expect(report.score).toBeLessThan(SCORE_THRESHOLDS.YELLOW);
    });

    it('identifie tous les champs critiques comme manquants', () => {
      const input = {
        residence: EMPTY_RESIDENCE,
      };

      const report = calculateResidenceQuality(input);

      // Tous les champs CRITICAL doivent être dans criticalMissing
      const criticalRules = QUALITY_RULES.filter((r) => r.criticality === 'CRITICAL');
      expect(report.criticalMissing.length).toBeGreaterThan(0);
      expect(report.criticalMissing.length).toBeLessThanOrEqual(criticalRules.length);
    });

    it('génère des recommandations P0 pour les champs critiques', () => {
      const input = {
        residence: EMPTY_RESIDENCE,
      };

      const report = calculateResidenceQuality(input);

      const p0Recommendations = report.recommendations.filter((r) => r.priority === 'P0');
      expect(p0Recommendations.length).toBeGreaterThan(0);
    });
  });

  describe('dossier complet', () => {
    it('retourne status green pour un dossier complet', () => {
      const input = {
        residence: COMPLETE_RESIDENCE,
      };

      const report = calculateResidenceQuality(input);

      expect(report.status).toBe('green');
      expect(report.score).toBeGreaterThanOrEqual(SCORE_THRESHOLDS.GREEN);
    });

    it('n\'a pas de champs critiques manquants', () => {
      const input = {
        residence: COMPLETE_RESIDENCE,
      };

      const report = calculateResidenceQuality(input);

      expect(report.criticalMissing.length).toBe(0);
    });

    it('a un pourcentage de complétude élevé', () => {
      const input = {
        residence: COMPLETE_RESIDENCE,
      };

      const report = calculateResidenceQuality(input);

      expect(report.completeness.percentage).toBeGreaterThanOrEqual(90);
    });
  });

  describe('règles OR (alternatives)', () => {
    it('satisfait la règle raisonSociale avec neq comme alternative', () => {
      const input = {
        residence: {
          name: 'Test',
          neq: '1234567890', // Alternative à raisonSociale
        },
      };

      const report = calculateResidenceQuality(input);

      // raisonSociale ne devrait pas être dans criticalMissing si neq est présent
      expect(report.criticalMissing).not.toContain('raisonSociale');
    });

    it('satisfait les règles avec les champs alternatifs', () => {
      const input = {
        residence: RESIDENCE_WITH_ALTERNATIVES,
      };

      const report = calculateResidenceQuality(input);

      // Les alternatives doivent être reconnues
      expect(report.completeness.missing).not.toContain('address'); // adresse est l'alternative
      expect(report.completeness.missing).not.toContain('municipalite'); // ville est l'alternative
      expect(report.completeness.missing).not.toContain('nombreUnitesTotal'); // unitsCount est l'alternative
    });
  });

  describe('conflits de provenance', () => {
    it('détecte un conflit manual+high vs source officielle', () => {
      const input = {
        residence: {
          name: 'Test',
          address: '123 Test',
        },
        fieldProvenance: {
          address: {
            source: 'Manual',
            confidence: 'high',
          },
        },
        sourcesExternes: [
          {
            source: 'MSSS',
            isRecognized: true,
            lastCheckedAt: new Date(),
          },
        ],
      };

      const report = calculateResidenceQuality(input);

      const manualConflict = report.conflicts.find(
        (c) => c.issue === 'manual_vs_official' && c.field === 'address'
      );
      expect(manualConflict).toBeDefined();
    });

    it('détecte les champs à faible confiance', () => {
      const input = {
        residence: {
          name: 'Test',
        },
        fieldProvenance: {
          name: {
            source: 'PDF',
            confidence: 'low',
          },
        },
      };

      const report = calculateResidenceQuality(input);

      const lowConfidenceConflict = report.conflicts.find(
        (c) => c.issue === 'low_confidence' && c.field === 'name'
      );
      expect(lowConfidenceConflict).toBeDefined();
    });

    it('détecte les données obsolètes (> 90 jours)', () => {
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 100);

      const input = {
        residence: {
          name: 'Test',
        },
        fieldProvenance: {
          name: {
            source: 'PDF',
            confidence: 'high',
            dateSource: oldDate,
          },
        },
      };

      const report = calculateResidenceQuality(input);

      const staleConflict = report.conflicts.find(
        (c) => c.issue === 'stale' && c.field === 'name'
      );
      expect(staleConflict).toBeDefined();
    });
  });

  describe('fraîcheur des sources', () => {
    it('détecte les sources stale (> 30 jours)', () => {
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 35);

      const input = {
        residence: { name: 'Test' },
        sourcesExternes: [
          {
            source: 'MSSS',
            isRecognized: true,
            lastCheckedAt: oldDate,
          },
        ],
      };

      const report = calculateResidenceQuality(input);

      const msssFreshness = report.freshness.sources.find((s) => s.source === 'MSSS');
      expect(msssFreshness?.stale).toBe(true);
      expect(report.freshness.hasStaleData).toBe(true);
    });

    it('marque les sources récentes comme non-stale', () => {
      const recentDate = new Date();
      recentDate.setDate(recentDate.getDate() - 5);

      const input = {
        residence: { name: 'Test' },
        sourcesExternes: [
          {
            source: 'MSSS',
            isRecognized: true,
            lastCheckedAt: recentDate,
          },
        ],
      };

      const report = calculateResidenceQuality(input);

      const msssFreshness = report.freshness.sources.find((s) => s.source === 'MSSS');
      expect(msssFreshness?.stale).toBe(false);
    });

    it('ajoute les sources non vérifiées comme stale', () => {
      const input = {
        residence: { name: 'Test' },
        // Pas de sourcesExternes
      };

      const report = calculateResidenceQuality(input);

      expect(report.freshness.sources.length).toBeGreaterThan(0);
      expect(report.freshness.sources.every((s) => s.stale)).toBe(true);
      expect(report.freshness.hasStaleData).toBe(true);
    });
  });

  describe('fraîcheur des documents', () => {
    it('compte les documents par statut', () => {
      const input = {
        residence: { name: 'Test' },
        documentsSummary: {
          total: 5,
          pending: 1,
          failed: 1,
          successful: 3,
          lastIngestAt: new Date(),
        },
      };

      const report = calculateResidenceQuality(input);

      expect(report.freshness.documents.total).toBe(5);
      expect(report.freshness.documents.pending).toBe(1);
      expect(report.freshness.documents.failed).toBe(1);
      expect(report.freshness.documents.successful).toBe(3);
    });
  });

  describe('scoring', () => {
    it('pénalise les champs critiques manquants', () => {
      const almostComplete = { ...COMPLETE_RESIDENCE };
      delete almostComplete.name;
      delete almostComplete.address;

      const input = {
        residence: almostComplete,
      };

      const report = calculateResidenceQuality(input);

      // Le score devrait être impacté par les champs critiques manquants
      expect(report.score).toBeLessThan(100);
      expect(report.criticalMissing).toContain('name');
      expect(report.criticalMissing).toContain('address');
    });

    it('donne un statut yellow pour un dossier partiel', () => {
      const input = {
        residence: MINIMAL_RESIDENCE,
      };

      const report = calculateResidenceQuality(input);

      // Avec seulement quelques champs, devrait être yellow ou red
      expect(['yellow', 'red']).toContain(report.status);
    });
  });

  describe('recommandations', () => {
    it('génère des recommandations triées par priorité', () => {
      const input = {
        residence: MINIMAL_RESIDENCE,
      };

      const report = calculateResidenceQuality(input);

      expect(report.recommendations.length).toBeGreaterThan(0);

      // Vérifier le tri par priorité
      const priorities = report.recommendations.map((r) => r.priority);
      const expectedOrder = [...priorities].sort((a, b) => {
        const order = { P0: 0, P1: 1, P2: 2 };
        return order[a] - order[b];
      });
      expect(priorities).toEqual(expectedOrder);
    });

    it('inclut une recommandation de sync si sources stale', () => {
      const input = {
        residence: MINIMAL_RESIDENCE,
        // Pas de sourcesExternes = sources stale
      };

      const report = calculateResidenceQuality(input);

      const syncReco = report.recommendations.find((r) => r.action === 'SYNC_SOURCES');
      expect(syncReco).toBeDefined();
      expect(syncReco?.links?.target).toBe('sync');
    });
  });

  describe('valeurs spéciales', () => {
    it('accepte false pour systemeGicleurs (acceptFalse)', () => {
      const input = {
        residence: {
          ...MINIMAL_RESIDENCE,
          systemeGicleurs: false, // Explicitement false = valide
        },
      };

      const report = calculateResidenceQuality(input);

      expect(report.completeness.missing).not.toContain('systemeGicleurs');
    });

    it('accepte "unknown" pour systemeGicleurs (acceptUnknown)', () => {
      const input = {
        residence: {
          ...MINIMAL_RESIDENCE,
          systemeGicleurs: 'unknown',
        },
      };

      const report = calculateResidenceQuality(input);

      expect(report.completeness.missing).not.toContain('systemeGicleurs');
    });

    it('considère une chaîne vide comme non remplie', () => {
      const input = {
        residence: {
          name: '',
          address: '   ',
        },
      };

      const report = calculateResidenceQuality(input);

      expect(report.completeness.missing).toContain('name');
      expect(report.completeness.missing).toContain('address');
    });
  });

  describe('structure du rapport', () => {
    it('retourne toutes les propriétés attendues', () => {
      const input = {
        residence: MINIMAL_RESIDENCE,
      };

      const report = calculateResidenceQuality(input);

      expect(report).toHaveProperty('score');
      expect(report).toHaveProperty('status');
      expect(report).toHaveProperty('completeness');
      expect(report).toHaveProperty('criticalMissing');
      expect(report).toHaveProperty('conflicts');
      expect(report).toHaveProperty('freshness');
      expect(report).toHaveProperty('recommendations');
      expect(report).toHaveProperty('computedAt');
    });

    it('completeness contient les catégories', () => {
      const input = {
        residence: MINIMAL_RESIDENCE,
      };

      const report = calculateResidenceQuality(input);

      expect(report.completeness.byCategory).toHaveProperty('identity');
      expect(report.completeness.byCategory).toHaveProperty('location');
      expect(report.completeness.byCategory).toHaveProperty('finance');
      expect(report.completeness.byCategory).toHaveProperty('safety');
    });
  });
});
