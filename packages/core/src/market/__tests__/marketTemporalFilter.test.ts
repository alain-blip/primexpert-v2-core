import { describe, expect, it } from 'vitest';
import {
  parseEventDateStringToMillis,
  parseMarketDateToMillis,
  passesTemporalFilter,
  temporalCutoff,
} from '../marketGpsViewModel';

describe('market temporal filter', () => {
  const now = new Date('2026-05-20T12:00:00Z').getTime();
  const cutoff24m = temporalCutoff('24m', now)!;

  it('priorise la date de transaction sur injectedAtMillis (bug placebo)', () => {
    const sale2021 = parseMarketDateToMillis('2021-06-15', undefined, now);
    expect(sale2021).toBe(parseEventDateStringToMillis('2021-06-15'));
    expect(passesTemporalFilter(sale2021, '24m', now)).toBe(false);
  });

  it('exclut une vente de 2021 de la fenêtre 24 mois', () => {
    const millis = parseEventDateStringToMillis('2021-03-01');
    expect(millis).toBeGreaterThan(0);
    expect(millis).toBeLessThan(cutoff24m);
    expect(passesTemporalFilter(millis, '24m', now)).toBe(false);
  });

  it('inclut une vente récente dans la fenêtre 24 mois', () => {
    const millis = parseEventDateStringToMillis('2025-11-01');
    expect(passesTemporalFilter(millis, '24m', now)).toBe(true);
  });

  it('exclut les dates inconnues (sortMillis = 0) hors mode archives', () => {
    expect(passesTemporalFilter(0, '24m', now)).toBe(false);
    expect(passesTemporalFilter(0, 'all', now)).toBe(true);
  });

  it('utilise anneeDonnees quand la date transaction est absente', () => {
    const millis = parseMarketDateToMillis(null, 2021);
    expect(passesTemporalFilter(millis, '24m', now)).toBe(false);
  });
});
