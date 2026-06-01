/**
 * Vérification des délais légaux — 7 champs critiques dès PA acceptée / pa-acceptee.
 * SSOT : promesseAchatEngine.ts (extension, pas de duplication UI).
 */

import { describe, expect, it } from 'vitest';
import {
  DEDIT_LCI_ART_73_2_JOURS,
  PA_ACCEPTEE_CRITICAL_DEADLINE_KEYS,
  addCalendarDays,
  buildPromesseAchatViewModel,
  computeDeadlinesFromAcceptance,
  validatePaAccepteeCriticalDeadlines,
} from '../promesseAchatEngine';
import { deriveOffreConditionDatesFromDelais } from '../offreSync';
import { resolveColumnId } from '../../../../../src/config/pipelineStages';

const DATE_ACCEPTATION = '2026-03-15';
const DATE_RECEPTION = '2026-03-01';

const DELAIS_COMPLETS = {
  visiteLieuxJours: 5,
  verificationDocumentsJours: 7,
  inspectionJours: 10,
  financementJours: 21,
  permisJours: 30,
} as const;

describe('PA acceptée — 7 délais critiques (inspection, financement, permis, dédit LCI art. 73.2)', () => {
  it('expose exactement 7 clés SSOT', () => {
    expect(PA_ACCEPTEE_CRITICAL_DEADLINE_KEYS).toHaveLength(7);
    expect(PA_ACCEPTEE_CRITICAL_DEADLINE_KEYS).toContain('dateLimiteInspection');
    expect(PA_ACCEPTEE_CRITICAL_DEADLINE_KEYS).toContain('dateLimiteFinancement');
    expect(PA_ACCEPTEE_CRITICAL_DEADLINE_KEYS).toContain('dateLimitePermis');
    expect(PA_ACCEPTEE_CRITICAL_DEADLINE_KEYS).toContain('dateLimiteDeduitLci');
  });

  it('calcule les 5 délais post-acceptation + dédit LCI art. 73.2 depuis dateAcceptation', () => {
    const deadlines = computeDeadlinesFromAcceptance(DATE_ACCEPTATION, DELAIS_COMPLETS);

    expect(deadlines.dateLimiteVisiteLieux).toBe(
      addCalendarDays(DATE_ACCEPTATION, DELAIS_COMPLETS.visiteLieuxJours)
    );
    expect(deadlines.dateLimiteVerificationDocuments).toBe(
      addCalendarDays(DATE_ACCEPTATION, DELAIS_COMPLETS.verificationDocumentsJours)
    );
    expect(deadlines.dateLimiteInspection).toBe(
      addCalendarDays(DATE_ACCEPTATION, DELAIS_COMPLETS.inspectionJours)
    );
    expect(deadlines.dateLimiteFinancement).toBe(
      addCalendarDays(DATE_ACCEPTATION, DELAIS_COMPLETS.financementJours)
    );
    expect(deadlines.dateLimitePermis).toBe(
      addCalendarDays(DATE_ACCEPTATION, DELAIS_COMPLETS.permisJours)
    );
    expect(deadlines.dateLimiteDeduitLci).toBe(
      addCalendarDays(DATE_ACCEPTATION, DEDIT_LCI_ART_73_2_JOURS)
    );
    expect(DEDIT_LCI_ART_73_2_JOURS).toBe(3);
  });

  it('retourne {} si dateAcceptation absente', () => {
    expect(computeDeadlinesFromAcceptance(undefined, DELAIS_COMPLETS)).toEqual({});
  });

  it('buildPromesseAchatViewModel — 7 échéances présentes quand PA acceptée + données complètes', () => {
    const vm = buildPromesseAchatViewModel({
      status: 'accepted',
      dateReception: DATE_RECEPTION,
      delaiReponseJours: 5,
      dateAcceptation: DATE_ACCEPTATION,
      delais: { ...DELAIS_COMPLETS },
    });

    for (const key of PA_ACCEPTEE_CRITICAL_DEADLINE_KEYS) {
      expect(vm.deadlines[key], `échéance manquante : ${key}`).toBeTruthy();
    }

    expect(vm.deadlines.dateLimiteReponse).toBe(addCalendarDays(DATE_RECEPTION, 5));
    expect(vm.deadlines.dateLimiteDeduitLci).toBe(
      addCalendarDays(DATE_ACCEPTATION, DEDIT_LCI_ART_73_2_JOURS)
    );
  });

  it('validatePaAccepteeCriticalDeadlines — ok quand les 7 champs sont calculables', () => {
    const result = validatePaAccepteeCriticalDeadlines({
      status: 'accepted',
      dateReception: DATE_RECEPTION,
      delaiReponseJours: 5,
      dateAcceptation: DATE_ACCEPTATION,
      delais: { ...DELAIS_COMPLETS },
    });
    expect(result).toEqual({ ok: true });
  });

  it('validatePaAccepteeCriticalDeadlines — échoue si statut !== accepted', () => {
    const result = validatePaAccepteeCriticalDeadlines({
      status: 'received',
      dateReception: DATE_RECEPTION,
      delaiReponseJours: 5,
      dateAcceptation: DATE_ACCEPTATION,
      delais: { ...DELAIS_COMPLETS },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.missing).toHaveLength(7);
    }
  });

  it('validatePaAccepteeCriticalDeadlines — signale les champs manquants', () => {
    const result = validatePaAccepteeCriticalDeadlines({
      status: 'accepted',
      dateAcceptation: DATE_ACCEPTATION,
      delais: {
        inspectionJours: 10,
        financementJours: 21,
        permisJours: 30,
      },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.missing).toContain('dateLimiteReponse');
      expect(result.missing).toContain('dateLimiteVisiteLieux');
      expect(result.missing).toContain('dateLimiteVerificationDocuments');
      expect(result.missing).not.toContain('dateLimiteInspection');
      expect(result.missing).not.toContain('dateLimiteFinancement');
      expect(result.missing).not.toContain('dateLimitePermis');
      expect(result.missing).not.toContain('dateLimiteDeduitLci');
    }
  });

  it('synchronise offre.dateLimiteFinancement et offre.dateLimitePermisMsss depuis les délais PA', () => {
    const derived = deriveOffreConditionDatesFromDelais({
      dateAcceptation: DATE_ACCEPTATION,
      delais: DELAIS_COMPLETS,
    });
    expect(derived.dateLimiteFinancement).toBe(
      addCalendarDays(DATE_ACCEPTATION, DELAIS_COMPLETS.financementJours)
    );
    expect(derived.dateLimitePermisMsss).toBe(
      addCalendarDays(DATE_ACCEPTATION, DELAIS_COMPLETS.permisJours)
    );
  });

  it('aligne statut Kanban pa-acceptee avec colonne promise (PA acceptée)', () => {
    expect(resolveColumnId('pa-acceptee')).toBe('promise');
    expect(resolveColumnId('PA_ACCEPTEE')).toBe('promise');
  });
});
