/**
 * Tests unitaires pour buildExportDataset — LOT 8
 */

import { describe, it, expect } from 'vitest';
import { buildExportDataset, validateExportDataset } from '../buildExportDataset';

describe('buildExportDataset', () => {
  // ============================================================
  // Données de test
  // ============================================================

  const mockResidence = {
    name: 'Résidence Soleil',
    residenceType: 'RPA',
    categorieRPA: 'Catégorie A',
    address: '123 Rue Principale',
    municipalite: 'Montréal',
    regionSociosanitaire: 'Montréal',
    codePostal: 'H2X 1Y2',
    nombreUnitesTotal: 50,
    tauxOccupation: 0.92,
    askingPrice: 5000000,
    revenusAnnuels: 800000,
    depensesAnnuelles: 400000,
    anneeConstruction: 1995,
    neq: '1234567890',
    raisonSociale: 'Résidences Inc.',
  };

  const mockQualitySnapshot = {
    score: 75,
    status: 'yellow',
    criticalMissing: ['certificatMSSS'],
  };

  const mockDocuments = [
    { filename: 'bail.pdf', docKind: 'Bail' },
    { filename: 'financiers.xlsx', docKind: 'États financiers' },
    { filename: 'photo.jpg', docKind: 'Photo' },
  ];

  const baseInput = {
    residenceId: 'test-123',
    residence: mockResidence,
    qualitySnapshot: mockQualitySnapshot,
    documents: mockDocuments,
    view: 'BANK_VIEW',
  };

  // ============================================================
  // Structure du dataset
  // ============================================================

  describe('structure', () => {
    it('retourne un dataset avec la structure correcte', () => {
      const dataset = buildExportDataset(baseInput);

      expect(dataset).toHaveProperty('meta');
      expect(dataset).toHaveProperty('sections');
      expect(dataset).toHaveProperty('audit');
    });

    it('inclut les métadonnées correctes', () => {
      const dataset = buildExportDataset(baseInput);

      expect(dataset.meta.residenceId).toBe('test-123');
      expect(dataset.meta.residenceName).toBe('Résidence Soleil');
      expect(dataset.meta.view).toBe('BANK_VIEW');
      expect(dataset.meta.version).toBeDefined();
      expect(dataset.meta.generatedAt).toBeInstanceOf(Date);
    });

    it('inclut les informations d\'audit', () => {
      const dataset = buildExportDataset(baseInput);

      expect(dataset.audit).toHaveProperty('sensitiveFieldsFound');
      expect(dataset.audit).toHaveProperty('totalFieldsExported');
      expect(dataset.audit.sensitiveFieldsFound).toHaveLength(0);
    });
  });

  // ============================================================
  // Sections par vue
  // ============================================================

  describe('sections BANK_VIEW', () => {
    it('inclut les sections financières', () => {
      const dataset = buildExportDataset({ ...baseInput, view: 'BANK_VIEW' });

      expect(dataset.sections.summary).toBeDefined();
      expect(dataset.sections.identity).toBeDefined();
      expect(dataset.sections.location).toBeDefined();
      expect(dataset.sections.capacity).toBeDefined();
      expect(dataset.sections.revenue).toBeDefined();
      expect(dataset.sections.building).toBeDefined();
    });

    it('inclut les revenus et dépenses', () => {
      const dataset = buildExportDataset({ ...baseInput, view: 'BANK_VIEW' });

      expect(dataset.sections.revenue?.annualRevenue).toBe(800000);
      expect(dataset.sections.revenue?.annualExpenses).toBe(400000);
      expect(dataset.sections.revenue?.askingPrice).toBe(5000000);
    });

    it('inclut les documents', () => {
      const dataset = buildExportDataset({ ...baseInput, view: 'BANK_VIEW' });

      expect(dataset.sections.documents).toBeDefined();
      expect(dataset.sections.documents?.total).toBe(3);
    });
  });

  describe('sections BUYER_VIEW', () => {
    it('exclut les détails financiers sensibles', () => {
      const dataset = buildExportDataset({ ...baseInput, view: 'BUYER_VIEW' });

      // BUYER_VIEW n'a pas de section revenue
      expect(dataset.sections.revenue).toBeUndefined();
    });

    it('exclut les informations légales détaillées', () => {
      const dataset = buildExportDataset({ ...baseInput, view: 'BUYER_VIEW' });

      expect(dataset.sections.identity?.neq).toBeUndefined();
      expect(dataset.sections.identity?.legalName).toBeUndefined();
    });

    it('exclut les documents', () => {
      const dataset = buildExportDataset({ ...baseInput, view: 'BUYER_VIEW' });

      expect(dataset.sections.documents).toBeUndefined();
    });

    it('exclut le score de qualité', () => {
      const dataset = buildExportDataset({ ...baseInput, view: 'BUYER_VIEW' });

      expect(dataset.sections.quality).toBeUndefined();
    });
  });

  describe('sections INTERNAL_TEAM', () => {
    it('inclut toutes les informations', () => {
      const dataset = buildExportDataset({ ...baseInput, view: 'INTERNAL_TEAM' });

      expect(dataset.sections.summary).toBeDefined();
      expect(dataset.sections.identity).toBeDefined();
      expect(dataset.sections.location).toBeDefined();
      expect(dataset.sections.capacity).toBeDefined();
      expect(dataset.sections.revenue).toBeDefined();
      expect(dataset.sections.building).toBeDefined();
      expect(dataset.sections.documents).toBeDefined();
      expect(dataset.sections.quality).toBeDefined();
    });

    it('inclut le score de qualité', () => {
      const dataset = buildExportDataset({ ...baseInput, view: 'INTERNAL_TEAM' });

      expect(dataset.sections.quality?.score).toBe(75);
      expect(dataset.sections.quality?.status).toBe('yellow');
    });
  });

  // ============================================================
  // Formatage des données
  // ============================================================

  describe('formatage', () => {
    it('inclut les valeurs brutes dans les sections revenue', () => {
      const dataset = buildExportDataset({ ...baseInput, view: 'BANK_VIEW' });

      // Le formatage (askingPriceFormatted, etc.) est fait côté serveur
      // Ici on vérifie que les valeurs brutes sont présentes
      expect(dataset.sections.revenue?.askingPrice).toBe(5000000);
      expect(dataset.sections.revenue?.annualRevenue).toBe(800000);
    });

    it('inclut les valeurs de capacité', () => {
      const dataset = buildExportDataset({ ...baseInput, view: 'BANK_VIEW' });

      expect(dataset.sections.capacity?.totalUnits).toBe(50);
      // occupancyRate est formaté en pourcentage par buildExportDataset
      expect(dataset.sections.capacity?.occupancyRate).toBe('92.0%');
    });
  });

  // ============================================================
  // Validation
  // ============================================================

  describe('validateExportDataset', () => {
    it('passe pour un dataset valide', () => {
      const dataset = buildExportDataset(baseInput);

      expect(() => validateExportDataset(dataset)).not.toThrow();
    });

    it('échoue si des champs sensibles sont trouvés', () => {
      const dataset = buildExportDataset(baseInput);
      // Simuler un champ sensible (ne devrait jamais arriver en prod)
      dataset.audit.sensitiveFieldsFound = ['password'];

      expect(() => validateExportDataset(dataset)).toThrow('ERREUR SÉCURITÉ');
    });
  });

  // ============================================================
  // Cas limites
  // ============================================================

  describe('cas limites', () => {
    it('gère une résidence avec données minimales', () => {
      const minimalInput = {
        residenceId: 'minimal',
        residence: { name: 'Minimal' },
        qualitySnapshot: null,
        documents: [],
        view: 'BANK_VIEW',
      };

      const dataset = buildExportDataset(minimalInput);

      expect(dataset.meta.residenceName).toBe('Minimal');
      expect(dataset.sections.documents?.total).toBe(0);
    });

    it('gère les documents sans docKind', () => {
      const input = {
        ...baseInput,
        documents: [{ filename: 'test.pdf' }],
      };

      const dataset = buildExportDataset(input);

      expect(dataset.sections.documents?.types?.[0]?.type).toBe('Autre');
    });

    it('gère les valeurs undefined', () => {
      const input = {
        ...baseInput,
        residence: {
          ...mockResidence,
          tauxOccupation: undefined,
          askingPrice: undefined,
        },
      };

      const dataset = buildExportDataset(input);

      // Ne devrait pas planter
      expect(dataset.sections.capacity?.occupancyRate).toBeUndefined();
    });
  });
});
