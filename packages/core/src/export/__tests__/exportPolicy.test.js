/**
 * Tests unitaires pour exportPolicy — LOT 8
 */

import { describe, it, expect } from 'vitest';
import {
  getExportPolicy,
  isFieldAllowed,
  isSensitiveField,
  filterAllowedFields,
  auditSensitiveFields,
  NEVER_EXPORT_FIELDS,
  VIEW_LABELS,
  INTERNAL_TEAM_POLICY,
  BANK_VIEW_POLICY,
  BUYER_PREVIEW_POLICY,
  BUYER_DOCUMENTS_POLICY,
  BUYER_VIEW_POLICY,
} from '../exportPolicy';

describe('exportPolicy', () => {
  // ============================================================
  // getExportPolicy
  // ============================================================

  describe('getExportPolicy', () => {
    it('retourne la politique INTERNAL_TEAM', () => {
      const policy = getExportPolicy('INTERNAL_TEAM');
      expect(policy).toBe(INTERNAL_TEAM_POLICY);
      expect(policy.includeQualityScore).toBe(true);
      expect(policy.includeProvenance).toBe(true);
    });

    it('retourne la politique BANK_VIEW', () => {
      const policy = getExportPolicy('BANK_VIEW');
      expect(policy).toBe(BANK_VIEW_POLICY);
      expect(policy.includeQualityScore).toBe(true);
      expect(policy.includeProvenance).toBe(false);
    });

    it('retourne la politique BUYER_PREVIEW (aperçu anonyme)', () => {
      const policy = getExportPolicy('BUYER_PREVIEW');
      expect(policy).toBe(BUYER_PREVIEW_POLICY);
      expect(policy.includeQualityScore).toBe(false);
      expect(policy.includeDocuments).toBe(false);
    });

    it('retourne la politique BUYER_DOCUMENTS (identité révélée, envoi documentaire)', () => {
      const policy = getExportPolicy('BUYER_DOCUMENTS');
      expect(policy).toBe(BUYER_DOCUMENTS_POLICY);
      expect(policy.includeQualityScore).toBe(false);
      expect(policy.includeDocuments).toBe(true);
    });

    it('BUYER_VIEW (déprécié) est un alias vers BUYER_DOCUMENTS', () => {
      const policy = getExportPolicy('BUYER_VIEW');
      expect(policy).toBe(BUYER_DOCUMENTS_POLICY);
      expect(policy).toBe(BUYER_VIEW_POLICY);
      expect(policy.includeQualityScore).toBe(false);
      expect(policy.includeDocuments).toBe(true);
    });

    it('lance une erreur pour une vue inconnue', () => {
      expect(() => getExportPolicy('UNKNOWN')).toThrow('Vue d\'export inconnue');
    });
  });

  // ============================================================
  // isSensitiveField
  // ============================================================

  describe('isSensitiveField', () => {
    it('détecte les champs explicitement listés', () => {
      expect(isSensitiveField('administrateurs')).toBe(true);
      expect(isSensitiveField('homeAddress')).toBe(true);
      expect(isSensitiveField('personalPhone')).toBe(true);
      expect(isSensitiveField('sin')).toBe(true);
      expect(isSensitiveField('bankAccount')).toBe(true);
      expect(isSensitiveField('notesInternes')).toBe(true);
    });

    it('détecte les champs par pattern', () => {
      expect(isSensitiveField('password')).toBe(true);
      expect(isSensitiveField('userPassword')).toBe(true);
      expect(isSensitiveField('accessToken')).toBe(true);
      expect(isSensitiveField('apiKey')).toBe(true);
      expect(isSensitiveField('secretKey')).toBe(true);
    });

    it('ne détecte pas les champs normaux', () => {
      expect(isSensitiveField('name')).toBe(false);
      expect(isSensitiveField('address')).toBe(false);
      expect(isSensitiveField('askingPrice')).toBe(false);
      expect(isSensitiveField('tauxOccupation')).toBe(false);
    });
  });

  // ============================================================
  // isFieldAllowed
  // ============================================================

  describe('isFieldAllowed', () => {
    describe('INTERNAL_TEAM', () => {
      it('autorise les champs standards', () => {
        expect(isFieldAllowed('name', 'INTERNAL_TEAM')).toBe(true);
        expect(isFieldAllowed('address', 'INTERNAL_TEAM')).toBe(true);
        expect(isFieldAllowed('askingPrice', 'INTERNAL_TEAM')).toBe(true);
        expect(isFieldAllowed('revenusAnnuels', 'INTERNAL_TEAM')).toBe(true);
      });

      it('interdit les champs sensibles', () => {
        expect(isFieldAllowed('administrateurs', 'INTERNAL_TEAM')).toBe(false);
        expect(isFieldAllowed('password', 'INTERNAL_TEAM')).toBe(false);
        expect(isFieldAllowed('bankAccount', 'INTERNAL_TEAM')).toBe(false);
      });
    });

    describe('BANK_VIEW', () => {
      it('autorise les champs financiers', () => {
        expect(isFieldAllowed('askingPrice', 'BANK_VIEW')).toBe(true);
        expect(isFieldAllowed('revenusAnnuels', 'BANK_VIEW')).toBe(true);
        expect(isFieldAllowed('depensesAnnuelles', 'BANK_VIEW')).toBe(true);
      });

      it('interdit les notes', () => {
        expect(isFieldAllowed('notes', 'BANK_VIEW')).toBe(false);
        expect(isFieldAllowed('commentaires', 'BANK_VIEW')).toBe(false);
      });
    });

    describe('BUYER_PREVIEW (anonymat strict, finances pour évaluation)', () => {
      it('interdit identité et localisation précise', () => {
        expect(isFieldAllowed('name', 'BUYER_PREVIEW')).toBe(false);
        expect(isFieldAllowed('address', 'BUYER_PREVIEW')).toBe(false);
        expect(isFieldAllowed('municipalite', 'BUYER_PREVIEW')).toBe(false);
      });

      it('autorise région large, capacité et finances', () => {
        expect(isFieldAllowed('region', 'BUYER_PREVIEW')).toBe(true);
        expect(isFieldAllowed('tauxOccupation', 'BUYER_PREVIEW')).toBe(true);
        expect(isFieldAllowed('askingPrice', 'BUYER_PREVIEW')).toBe(true);
        expect(isFieldAllowed('revenusAnnuels', 'BUYER_PREVIEW')).toBe(true);
      });

      it('interdit l\'évaluation foncière (identifiant potentiel)', () => {
        expect(isFieldAllowed('evaluationFonciere', 'BUYER_PREVIEW')).toBe(false);
      });
    });

    describe('BUYER_DOCUMENTS / BUYER_VIEW (alias identité + documents)', () => {
      it('autorise identité et finances autorisées par la politique', () => {
        expect(isFieldAllowed('name', 'BUYER_DOCUMENTS')).toBe(true);
        expect(isFieldAllowed('askingPrice', 'BUYER_DOCUMENTS')).toBe(true);
        expect(isFieldAllowed('revenusAnnuels', 'BUYER_DOCUMENTS')).toBe(true);
        expect(isFieldAllowed('name', 'BUYER_VIEW')).toBe(true);
      });

      it('interdit NEQ, forme et évaluation foncière', () => {
        expect(isFieldAllowed('neq', 'BUYER_DOCUMENTS')).toBe(false);
        expect(isFieldAllowed('formeJuridique', 'BUYER_DOCUMENTS')).toBe(false);
        expect(isFieldAllowed('evaluationFonciere', 'BUYER_DOCUMENTS')).toBe(false);
      });
    });
  });

  // ============================================================
  // filterAllowedFields
  // ============================================================

  describe('filterAllowedFields', () => {
    it('filtre les champs selon BUYER_PREVIEW (pas d’identité, finances OK)', () => {
      const data = {
        name: 'Ma Résidence',
        askingPrice: 1000000,
        revenusAnnuels: 150000,
        neq: '12345',
        password: 'secret',
      };

      const filtered = filterAllowedFields(data, 'BUYER_PREVIEW');

      expect(filtered.name).toBeUndefined();
      expect(filtered.askingPrice).toBe(1000000);
      expect(filtered.revenusAnnuels).toBe(150000);
      expect(filtered.neq).toBeUndefined();
      expect(filtered.password).toBeUndefined();
    });

    it('filtre les champs selon BUYER_DOCUMENTS (identité + champs autorisés)', () => {
      const data = {
        name: 'Ma Résidence',
        askingPrice: 1000000,
        revenusAnnuels: 150000,
        neq: '12345',
        password: 'secret',
      };

      const filtered = filterAllowedFields(data, 'BUYER_DOCUMENTS');

      expect(filtered.name).toBe('Ma Résidence');
      expect(filtered.askingPrice).toBe(1000000);
      expect(filtered.revenusAnnuels).toBe(150000);
      expect(filtered.neq).toBeUndefined();
      expect(filtered.password).toBeUndefined();
    });

    it('garde tous les champs autorisés pour BANK_VIEW', () => {
      const data = {
        name: 'Ma Résidence',
        askingPrice: 1000000,
        revenusAnnuels: 150000,
        depensesAnnuelles: 50000,
      };

      const filtered = filterAllowedFields(data, 'BANK_VIEW');

      expect(filtered.name).toBe('Ma Résidence');
      expect(filtered.askingPrice).toBe(1000000);
      expect(filtered.revenusAnnuels).toBe(150000);
      expect(filtered.depensesAnnuelles).toBe(50000);
    });
  });

  // ============================================================
  // auditSensitiveFields
  // ============================================================

  describe('auditSensitiveFields', () => {
    it('détecte les champs sensibles à la racine', () => {
      const data = {
        name: 'Test',
        password: 'secret',
        bankAccount: '12345',
      };

      const found = auditSensitiveFields(data);

      expect(found).toContain('password');
      expect(found).toContain('bankAccount');
      expect(found).not.toContain('name');
    });

    it('détecte les champs sensibles imbriqués', () => {
      const data = {
        identity: {
          name: 'Test',
          personalPhone: '514-555-1234',
        },
        finance: {
          askingPrice: 1000000,
        },
      };

      const found = auditSensitiveFields(data);

      expect(found).toContain('identity.personalPhone');
      expect(found.length).toBe(1);
    });

    it('retourne un tableau vide si aucun champ sensible', () => {
      const data = {
        name: 'Test',
        address: '123 Rue Principale',
        askingPrice: 1000000,
      };

      const found = auditSensitiveFields(data);

      expect(found).toHaveLength(0);
    });
  });

  // ============================================================
  // Constantes
  // ============================================================

  describe('constantes', () => {
    it('NEVER_EXPORT_FIELDS contient les champs critiques', () => {
      expect(NEVER_EXPORT_FIELDS).toContain('administrateurs');
      expect(NEVER_EXPORT_FIELDS).toContain('homeAddress');
      expect(NEVER_EXPORT_FIELDS).toContain('password');
      expect(NEVER_EXPORT_FIELDS).toContain('bankAccount');
      expect(NEVER_EXPORT_FIELDS).toContain('notesInternes');
      expect(NEVER_EXPORT_FIELDS).toContain('automationQueue');
    });

    it('VIEW_LABELS contient les labels pour chaque vue', () => {
      expect(VIEW_LABELS.INTERNAL_TEAM).toBe('Équipe interne');
      expect(VIEW_LABELS.BANK_VIEW).toBe('Pack Financement (Banquier)');
      expect(VIEW_LABELS.BUYER_PREVIEW).toBe('Aperçu Acheteur (Anonyme)');
      expect(VIEW_LABELS.BUYER_DOCUMENTS).toBe('Documents Acheteur (Avec identité)');
    });
  });

  // ============================================================
  // Politiques
  // ============================================================

  describe('politiques', () => {
    it('INTERNAL_TEAM inclut toutes les sections', () => {
      expect(INTERNAL_TEAM_POLICY.sections).toContain('summary');
      expect(INTERNAL_TEAM_POLICY.sections).toContain('identity');
      expect(INTERNAL_TEAM_POLICY.sections).toContain('revenue');
      expect(INTERNAL_TEAM_POLICY.sections).toContain('quality');
      expect(INTERNAL_TEAM_POLICY.sections).toContain('documents');
    });

    it('BANK_VIEW exclut la section quality détaillée', () => {
      expect(BANK_VIEW_POLICY.sections).toContain('summary');
      expect(BANK_VIEW_POLICY.sections).toContain('revenue');
      expect(BANK_VIEW_POLICY.sections).toContain('documents');
      expect(BANK_VIEW_POLICY.sections).not.toContain('compliance');
    });

    it('BUYER_PREVIEW exclut identité explicite et documents', () => {
      expect(BUYER_PREVIEW_POLICY.sections).toContain('summary');
      expect(BUYER_PREVIEW_POLICY.sections).toContain('revenue');
      expect(BUYER_PREVIEW_POLICY.sections).not.toContain('identity');
      expect(BUYER_PREVIEW_POLICY.sections).not.toContain('documents');
    });

    it('BUYER_DOCUMENTS (alias BUYER_VIEW_POLICY) inclut identité et documents', () => {
      expect(BUYER_DOCUMENTS_POLICY.sections).toContain('identity');
      expect(BUYER_DOCUMENTS_POLICY.sections).toContain('documents');
      expect(BUYER_DOCUMENTS_POLICY.sections).toContain('revenue');
      expect(BUYER_VIEW_POLICY.sections).toEqual(BUYER_DOCUMENTS_POLICY.sections);
    });
  });

  // ============================================================
  // Sécurité
  // ============================================================

  describe('sécurité', () => {
    it('les politiques ne permettent jamais l\'export de champs sensibles', () => {
      const policies = [
        INTERNAL_TEAM_POLICY,
        BANK_VIEW_POLICY,
        BUYER_PREVIEW_POLICY,
        BUYER_DOCUMENTS_POLICY,
      ];

      for (const policy of policies) {
        for (const sensitiveField of NEVER_EXPORT_FIELDS) {
          expect(policy.allowedFields).not.toContain(sensitiveField);
        }
      }
    });

    it('NEVER_EXPORT_FIELDS est dans redactedFields de toutes les politiques', () => {
      const policies = [
        INTERNAL_TEAM_POLICY,
        BANK_VIEW_POLICY,
        BUYER_PREVIEW_POLICY,
        BUYER_DOCUMENTS_POLICY,
      ];

      for (const policy of policies) {
        for (const sensitiveField of NEVER_EXPORT_FIELDS) {
          expect(policy.redactedFields).toContain(sensitiveField);
        }
      }
    });
  });
});
