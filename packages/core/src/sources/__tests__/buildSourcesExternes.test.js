/**
 * Tests pour buildSourcesExternes
 *
 * Mission 2 — Sources externes
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  buildSourcesExternesFromResidence,
  isMSSSUrl,
  extractNumeroFromMSSSUrl,
  isValidNumeroRegistre,
  isValidNEQ,
  normalizeNEQ,
  buildREQUrl,
  isValidUrl,
  normalizeUrl,
  hasSourcesExternes,
  countRecognizedSources,
  getSourcesSummary,
} from '../buildSourcesExternes';

// Mock de Date pour des tests déterministes
const MOCK_DATE = '2025-01-15T10:00:00.000Z';

describe('buildSourcesExternes', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(MOCK_DATE));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ===========================================================================
  // Tests de détection MSSS
  // ===========================================================================
  describe('isMSSSUrl', () => {
    it('devrait reconnaître une URL santemonteregie.qc.ca/rpa', () => {
      expect(isMSSSUrl('https://santemonteregie.qc.ca/rpa/12345')).toBe(true);
      expect(isMSSSUrl('http://santemonteregie.qc.ca/rpa/67890')).toBe(true);
    });

    it('devrait reconnaître une URL msss.gouv.qc.ca', () => {
      expect(isMSSSUrl('https://www.msss.gouv.qc.ca/reseau/rpa')).toBe(true);
    });

    it('devrait retourner false pour une URL non-MSSS', () => {
      expect(isMSSSUrl('https://google.com')).toBe(false);
      expect(isMSSSUrl('https://maresidence.com')).toBe(false);
    });

    it('devrait retourner false pour undefined', () => {
      expect(isMSSSUrl(undefined)).toBe(false);
    });
  });

  describe('extractNumeroFromMSSSUrl', () => {
    it('devrait extraire le numéro d\'une URL santemonteregie', () => {
      expect(extractNumeroFromMSSSUrl('https://santemonteregie.qc.ca/rpa/12345')).toBe('12345');
      expect(extractNumeroFromMSSSUrl('https://santemonteregie.qc.ca/rpa/999')).toBe('999');
    });

    it('devrait retourner undefined si pas de numéro', () => {
      expect(extractNumeroFromMSSSUrl('https://msss.gouv.qc.ca')).toBeUndefined();
      expect(extractNumeroFromMSSSUrl(undefined)).toBeUndefined();
    });
  });

  describe('isValidNumeroRegistre', () => {
    it('devrait valider un numéro de 4-6 chiffres', () => {
      expect(isValidNumeroRegistre('1234')).toBe(true);
      expect(isValidNumeroRegistre('12345')).toBe(true);
      expect(isValidNumeroRegistre('123456')).toBe(true);
    });

    it('devrait rejeter un numéro trop court ou trop long', () => {
      expect(isValidNumeroRegistre('123')).toBe(false);
      expect(isValidNumeroRegistre('1234567')).toBe(false);
    });

    it('devrait rejeter les non-chiffres', () => {
      expect(isValidNumeroRegistre('12a45')).toBe(false);
      expect(isValidNumeroRegistre(undefined)).toBe(false);
    });
  });

  // ===========================================================================
  // Tests de détection NEQ
  // ===========================================================================
  describe('isValidNEQ', () => {
    it('devrait valider un NEQ valide (10 chiffres, commence par 117/118)', () => {
      expect(isValidNEQ('1171234567')).toBe(true);
      expect(isValidNEQ('1189876543')).toBe(true);
    });

    it('devrait valider un NEQ avec espaces ou tirets', () => {
      expect(isValidNEQ('117-123-4567')).toBe(true);
      expect(isValidNEQ('117 123 4567')).toBe(true);
    });

    it('devrait rejeter un NEQ invalide', () => {
      expect(isValidNEQ('123456789')).toBe(false); // trop court
      expect(isValidNEQ('12345678901')).toBe(false); // trop long
      expect(isValidNEQ('2171234567')).toBe(false); // ne commence pas par 1
      expect(isValidNEQ(undefined)).toBe(false);
    });
  });

  describe('normalizeNEQ', () => {
    it('devrait supprimer les espaces et tirets', () => {
      expect(normalizeNEQ('117-123-4567')).toBe('1171234567');
      expect(normalizeNEQ('117 123 4567')).toBe('1171234567');
      expect(normalizeNEQ('1171234567')).toBe('1171234567');
    });

    it('devrait retourner undefined pour undefined', () => {
      expect(normalizeNEQ(undefined)).toBeUndefined();
    });
  });

  describe('buildREQUrl', () => {
    it('devrait construire une URL REQ valide', () => {
      const url = buildREQUrl('1171234567');
      expect(url).toContain('registreentreprises.gouv.qc.ca');
      expect(url).toContain('1171234567');
    });

    it('devrait retourner undefined pour un NEQ invalide', () => {
      expect(buildREQUrl('123')).toBeUndefined();
      expect(buildREQUrl(undefined)).toBeUndefined();
    });
  });

  // ===========================================================================
  // Tests de validation URL
  // ===========================================================================
  describe('isValidUrl', () => {
    it('devrait valider une URL complète', () => {
      expect(isValidUrl('https://www.example.com')).toBe(true);
      expect(isValidUrl('http://example.com')).toBe(true);
    });

    it('devrait valider une URL sans protocole', () => {
      expect(isValidUrl('www.example.com')).toBe(true);
      expect(isValidUrl('example.com')).toBe(true);
    });

    it('devrait rejeter une URL invalide', () => {
      expect(isValidUrl('')).toBe(false);
      expect(isValidUrl(undefined)).toBe(false);
    });
  });

  describe('normalizeUrl', () => {
    it('devrait ajouter https:// si absent', () => {
      expect(normalizeUrl('www.example.com')).toBe('https://www.example.com');
      expect(normalizeUrl('example.com')).toBe('https://example.com');
    });

    it('devrait conserver le protocole existant', () => {
      expect(normalizeUrl('https://example.com')).toBe('https://example.com');
      expect(normalizeUrl('http://example.com')).toBe('http://example.com');
    });

    it('devrait retourner undefined pour undefined', () => {
      expect(normalizeUrl(undefined)).toBeUndefined();
    });
  });

  // ===========================================================================
  // Tests de buildSourcesExternesFromResidence
  // ===========================================================================
  describe('buildSourcesExternesFromResidence', () => {
    it('devrait construire une structure complète avec toutes les sources', () => {
      const residence = {
        siteInternetRegistre: 'https://santemonteregie.qc.ca/rpa/12345',
        neq: '1171234567',
        siteWeb: 'www.maresidence.com',
      };

      const sources = buildSourcesExternesFromResidence(residence);

      expect(sources.registreRPA).toBeDefined();
      expect(sources.registreRPA?.url).toBe('https://santemonteregie.qc.ca/rpa/12345');
      expect(sources.registreRPA?.numero).toBe('12345');
      expect(sources.registreRPA?.isRecognized).toBe(true);
      expect(sources.registreRPA?.lastCheckedAt).toBe(MOCK_DATE);

      expect(sources.req).toBeDefined();
      expect(sources.req?.neq).toBe('1171234567');
      expect(sources.req?.isRecognized).toBe(true);
      expect(sources.req?.url).toContain('registreentreprises.gouv.qc.ca');

      expect(sources.siteWeb).toBeDefined();
      expect(sources.siteWeb?.url).toBe('https://www.maresidence.com');
      expect(sources.siteWeb?.isRecognized).toBe(true);
    });

    it('devrait gérer une résidence sans sources', () => {
      const residence = {};
      const sources = buildSourcesExternesFromResidence(residence);

      expect(sources.registreRPA).toBeUndefined();
      expect(sources.req).toBeUndefined();
      expect(sources.siteWeb).toBeUndefined();
    });

    it('devrait marquer isRecognized=false pour une URL non-MSSS', () => {
      const residence = {
        siteInternetRegistre: 'https://random-site.com/page',
      };

      const sources = buildSourcesExternesFromResidence(residence);

      expect(sources.registreRPA?.isRecognized).toBe(false);
    });

    it('devrait utiliser numeroRegistre si siteInternetRegistre est absent', () => {
      const residence = {
        numeroRegistre: '54321',
      };

      const sources = buildSourcesExternesFromResidence(residence);

      expect(sources.registreRPA?.numero).toBe('54321');
      expect(sources.registreRPA?.isRecognized).toBe(true);
      expect(sources.registreRPA?.url).toBeUndefined();
    });

    it('devrait prioriser siteWeb > websiteUrl > siteInternetResidence', () => {
      const residence1 = {
        siteWeb: 'site1.com',
        websiteUrl: 'site2.com',
        siteInternetResidence: 'site3.com',
      };
      expect(buildSourcesExternesFromResidence(residence1).siteWeb?.url).toBe('https://site1.com');

      const residence2 = {
        websiteUrl: 'site2.com',
        siteInternetResidence: 'site3.com',
      };
      expect(buildSourcesExternesFromResidence(residence2).siteWeb?.url).toBe('https://site2.com');

      const residence3 = {
        siteInternetResidence: 'site3.com',
      };
      expect(buildSourcesExternesFromResidence(residence3).siteWeb?.url).toBe('https://site3.com');
    });

    it('devrait gérer un NEQ avec tirets', () => {
      const residence = {
        neq: '117-123-4567',
      };

      const sources = buildSourcesExternesFromResidence(residence);

      expect(sources.req?.neq).toBe('1171234567');
      expect(sources.req?.isRecognized).toBe(true);
    });
  });

  // ===========================================================================
  // Tests des utilitaires
  // ===========================================================================
  describe('hasSourcesExternes', () => {
    it('devrait retourner true si au moins une source existe', () => {
      expect(hasSourcesExternes({ registreRPA: { isRecognized: true } })).toBe(true);
      expect(hasSourcesExternes({ req: { isRecognized: false } })).toBe(true);
      expect(hasSourcesExternes({ siteWeb: { isRecognized: true } })).toBe(true);
    });

    it('devrait retourner false si aucune source', () => {
      expect(hasSourcesExternes({})).toBe(false);
      expect(hasSourcesExternes(undefined)).toBe(false);
    });
  });

  describe('countRecognizedSources', () => {
    it('devrait compter les sources reconnues', () => {
      expect(countRecognizedSources({
        registreRPA: { isRecognized: true },
        req: { isRecognized: true },
        siteWeb: { isRecognized: false },
      })).toBe(2);

      expect(countRecognizedSources({
        registreRPA: { isRecognized: false },
        req: { isRecognized: false },
      })).toBe(0);
    });

    it('devrait retourner 0 pour undefined', () => {
      expect(countRecognizedSources(undefined)).toBe(0);
    });
  });

  describe('getSourcesSummary', () => {
    it('devrait retourner un résumé lisible', () => {
      const summary = getSourcesSummary({
        registreRPA: { numero: '12345', isRecognized: true },
        req: { neq: '1171234567', isRecognized: true },
        siteWeb: { url: 'https://example.com', isRecognized: false },
      });

      expect(summary).toHaveLength(3);
      expect(summary[0]).toContain('✓');
      expect(summary[0]).toContain('#12345');
      expect(summary[1]).toContain('1171234567');
      expect(summary[2]).toContain('?');
    });

    it('devrait retourner un tableau vide pour undefined', () => {
      expect(getSourcesSummary(undefined)).toEqual([]);
    });
  });
});
