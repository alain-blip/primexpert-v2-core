/**
 * Questionnaire déclaration vendeur D1–D25 — édition ou lecture seule.
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  DECLARATION_SECTIONS,
  declarationQuestionInputType,
  declarationQuestionNeedsValue,
} from '@primexpert/core/declaration';
import type {
  DeclarationQuestionDef,
  DeclarationResponse,
  DeclarationVendeurDoc,
} from '@primexpert/core/declaration';
import { useLanguage } from '../../../lib/i18n';
import { cn } from '../../../lib/utils';
import { InstitutionalSection } from '../institutional/InstitutionalUi';

const RESPONSE_OPTIONS: DeclarationResponse[] = ['yes', 'no', 'na'];

const RESPONSE_LABELS: Record<
  DeclarationResponse,
  { fr: string; en: string }
> = {
  yes: { fr: 'Oui', en: 'Yes' },
  no: { fr: 'Non', en: 'No' },
  na: { fr: 'N/A', en: 'N/A' },
};

const NSP_LABELS = { fr: 'Ne sait pas', en: 'Unknown' };

export interface DeclarationQuestionnaireProps {
  declaration: DeclarationVendeurDoc;
  locked: boolean;
  saving: boolean;
  onResponse: (questionId: string, response: DeclarationResponse) => Promise<void>;
  onNotes: (questionId: string, notes: string) => Promise<void>;
  onValue: (questionId: string, value: string) => Promise<void>;
}

export function DeclarationQuestionnaire({
  declaration,
  locked,
  saving,
  onResponse,
  onNotes,
  onValue,
}: DeclarationQuestionnaireProps) {
  const { t, language } = useLanguage();
  const lang = language === 'fr' ? 'fr' : 'en';

  return (
    <div className="space-y-6">
      {DECLARATION_SECTIONS.map((section) => {
        const title = lang === 'fr' ? section.titleFr : section.titleEn;
        const categoryLabel =
          section.category === 'rpa'
            ? t('Spécifique RPA', 'RPA specific')
            : t('Standard', 'Standard');

        return (
          <InstitutionalSection
            key={section.id}
            title={`${section.id} · ${title}`}
          >
            <div className="flex flex-wrap items-center gap-2 px-1 pb-4 -mt-1">
              <span
                className={cn(
                  'rounded-lg border px-2 py-0.5 text-[9px] font-black uppercase tracking-wider',
                  section.category === 'rpa'
                    ? 'border-[#D4AF37]/40 bg-amber-50 text-[#000000]'
                    : 'border-slate-200 bg-slate-50 text-slate-600'
                )}
              >
                {categoryLabel}
              </span>
              {section.sectionOptional ? (
                <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500">
                  {t('Section facultative', 'Optional section')}
                </span>
              ) : null}
              <span className="text-[9px] text-slate-500 font-mono ml-auto">
                {section.questions.length}{' '}
                {t('champs', 'fields')}
              </span>
            </div>

            <ul className="space-y-5">
              {section.questions.map((q) => (
                <DeclarationQuestionCard
                  key={q.id}
                  question={q}
                  answer={declaration.answers[q.id]}
                  locked={locked}
                  saving={saving}
                  lang={lang}
                  t={t}
                  onResponse={onResponse}
                  onNotes={onNotes}
                  onValue={onValue}
                />
              ))}
            </ul>
          </InstitutionalSection>
        );
      })}
    </div>
  );
}

function DeclarationQuestionCard({
  question,
  answer,
  locked,
  saving,
  lang,
  t,
  onResponse,
  onNotes,
  onValue,
}: {
  question: DeclarationQuestionDef;
  answer: DeclarationVendeurDoc['answers'][string] | undefined;
  locked: boolean;
  saving: boolean;
  lang: 'fr' | 'en';
  t: (fr: string, en: string) => string;
  onResponse: (questionId: string, response: DeclarationResponse) => Promise<void>;
  onNotes: (questionId: string, notes: string) => Promise<void>;
  onValue: (questionId: string, value: string) => Promise<void>;
}) {
  const response = answer?.response ?? null;
  const notes = answer?.notes?.trim() ?? '';
  const value = answer?.value?.trim() ?? '';
  const label = lang === 'fr' ? question.labelFr : question.labelEn;
  const needsValue = declarationQuestionNeedsValue(question.fieldType);
  const useNspLabel = question.fieldType === 'yesno_nsp';

  return (
    <li className="rounded-xl border border-slate-200 bg-white px-4 py-4">
      {question.subSection ? (
        <p className="text-[10px] font-bold uppercase tracking-wider text-[#D4AF37] mb-2">
          {question.subSection}
        </p>
      ) : null}

      <p className="text-sm font-semibold text-[#000000] leading-snug mb-3">
        {label}
        {question.optional ? (
          <span className="ml-2 text-[9px] font-bold uppercase tracking-wider text-slate-400">
            {t('Facultatif', 'Optional')}
          </span>
        ) : null}
      </p>

      {needsValue ? (
        <div className="mb-3">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
            {t('Valeur', 'Value')}
          </p>
          {locked ? (
            <p className="text-sm font-semibold text-[#000000] whitespace-pre-wrap leading-relaxed">
              {value || '—'}
            </p>
          ) : (
            <DeclarationValueField
              question={question}
              initialValue={answer?.value ?? ''}
              saving={saving}
              onSave={onValue}
            />
          )}
        </div>
      ) : null}

      <div className="mb-3">
        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2">
          {t('Réponse', 'Answer')}
        </p>
        {locked ? (
          <p className="text-sm font-bold text-[#000000]">
            {response
              ? useNspLabel && response === 'na'
                ? NSP_LABELS[lang]
                : RESPONSE_LABELS[response][lang]
              : '—'}
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {RESPONSE_OPTIONS.map((opt) => {
              const active = response === opt;
              const labelOpt =
                useNspLabel && opt === 'na' ? NSP_LABELS[lang] : RESPONSE_LABELS[opt][lang];
              return (
                <button
                  key={opt}
                  type="button"
                  disabled={saving}
                  onClick={() => void onResponse(question.id, opt)}
                  className={cn(
                    'rounded-xl border px-4 py-2 text-[10px] font-black uppercase tracking-wider transition',
                    active
                      ? 'border-[#D4AF37]/60 bg-amber-50 text-[#000000]'
                      : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300',
                    saving && 'cursor-wait'
                  )}
                >
                  {labelOpt}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div>
        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
          {t('Notes de vérification', 'Verification notes')}
        </p>
        {locked ? (
          <p className="text-sm text-[#000000] whitespace-pre-wrap leading-relaxed min-h-[1.25rem]">
            {notes || '—'}
          </p>
        ) : (
          <DeclarationNotesField
            questionId={question.id}
            initialNotes={answer?.notes ?? ''}
            saving={saving}
            onSave={onNotes}
            placeholder={t(
              'Précisions, dates, références, pièces justificatives…',
              'Details, dates, references, supporting documents…'
            )}
          />
        )}
      </div>
    </li>
  );
}

function DeclarationValueField({
  question,
  initialValue,
  saving,
  onSave,
}: {
  question: DeclarationQuestionDef;
  initialValue: string;
  saving: boolean;
  onSave: (questionId: string, value: string) => Promise<void>;
}) {
  const [local, setLocal] = useState(initialValue);
  const inputKind = declarationQuestionInputType(question.fieldType);

  useEffect(() => {
    setLocal(initialValue);
  }, [initialValue, question.id]);

  const handleBlur = useCallback(() => {
    if (local !== initialValue) {
      void onSave(question.id, local);
    }
  }, [local, initialValue, onSave, question.id]);

  const baseClass = cn(
    'w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-[#000000]',
    'placeholder:text-slate-400 focus:border-[#D4AF37]/60 focus:outline-none focus:ring-1 focus:ring-[#D4AF37]/30'
  );

  if (inputKind === 'textarea') {
    return (
      <textarea
        value={local}
        disabled={saving}
        onChange={(e) => setLocal(e.target.value)}
        onBlur={handleBlur}
        rows={3}
        className={cn(baseClass, 'resize-y min-h-[4.5rem]')}
      />
    );
  }

  return (
    <input
      type={inputKind === 'number' ? 'number' : inputKind === 'date' ? 'date' : 'text'}
      value={local}
      disabled={saving}
      onChange={(e) => setLocal(e.target.value)}
      onBlur={handleBlur}
      className={baseClass}
    />
  );
}

function DeclarationNotesField({
  questionId,
  initialNotes,
  saving,
  onSave,
  placeholder,
}: {
  questionId: string;
  initialNotes: string;
  saving: boolean;
  onSave: (questionId: string, notes: string) => Promise<void>;
  placeholder: string;
}) {
  const [local, setLocal] = useState(initialNotes);

  useEffect(() => {
    setLocal(initialNotes);
  }, [initialNotes, questionId]);

  const handleBlur = useCallback(() => {
    if (local !== initialNotes) {
      void onSave(questionId, local);
    }
  }, [local, initialNotes, onSave, questionId]);

  return (
    <textarea
      value={local}
      disabled={saving}
      onChange={(e) => setLocal(e.target.value)}
      onBlur={handleBlur}
      rows={2}
      placeholder={placeholder}
      className={cn(
        'w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-[#000000]',
        'placeholder:text-slate-400 focus:border-[#D4AF37]/60 focus:outline-none focus:ring-1 focus:ring-[#D4AF37]/30 resize-y min-h-[4rem]'
      )}
    />
  );
}
