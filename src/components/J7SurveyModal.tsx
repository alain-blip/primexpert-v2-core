/**
 * Sondage J7 — première semaine d'essai.
 * Options B/C → alerte courriel au responsable support.
 */

import React, { useState } from 'react';
import { X, MessageSquareHeart } from 'lucide-react';
import { useLanguage } from '../lib/i18n';
import { useAuth } from '../lib/auth';
import { submitJ7Survey } from '../services/j7SurveyService';
import { J7_OPTION_LABELS, type J7SurveyOption } from '../types/nurture';
import { cn } from '../lib/utils';

interface J7SurveyModalProps {
  open: boolean;
  onClose: () => void;
  onSubmitted: () => void;
}

export function J7SurveyModal({ open, onClose, onSubmitted }: J7SurveyModalProps) {
  const { t, language } = useLanguage();
  const { profile, refreshProfile } = useAuth();
  const locale = language === 'fr' ? 'fr' : 'en';
  const [option, setOption] = useState<J7SurveyOption | null>(null);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open || !profile) return null;

  const handleSubmit = async () => {
    if (!option) {
      setError(t('Choisissez une option.', 'Please select an option.'));
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await submitJ7Survey(profile, { option, comment }, locale);
      await refreshProfile();
      onSubmitted();
      onClose();
    } catch (e) {
      console.error(e);
      setError(t('Envoi impossible. Réessayez.', 'Could not submit. Please try again.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="j7-survey-title"
    >
      <div className="relative w-full max-w-lg rounded-2xl border border-white/15 bg-slate-950 p-6 shadow-2xl">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 rounded-lg p-1 text-slate-500 transition hover:bg-white/10 hover:text-white"
          aria-label={t('Fermer', 'Close')}
        >
          <X className="h-5 w-5" />
        </button>

        <div className="mb-4 flex items-center gap-3 pr-8">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-blue-500/30 bg-blue-500/15">
            <MessageSquareHeart className="h-5 w-5 text-blue-300" aria-hidden />
          </div>
          <div>
            <p className="text-[9px] font-black uppercase tracking-widest text-blue-300">
              {t('Semaine 1', 'Week 1')}
            </p>
            <h2 id="j7-survey-title" className="text-lg font-black text-white">
              {t('Comment va votre première semaine sur Primexpert ?', 'How is your first week on Primexpert?')}
            </h2>
          </div>
        </div>

        <fieldset className="mt-4 space-y-2">
          <legend className="sr-only">{t('Options du sondage', 'Survey options')}</legend>
          {(['A', 'B', 'C'] as const).map((key) => (
            <label
              key={key}
              className={cn(
                'flex cursor-pointer gap-3 rounded-xl border p-3 transition',
                option === key
                  ? 'border-blue-500/60 bg-blue-500/15'
                  : 'border-white/10 bg-white/5 hover:border-white/20'
              )}
            >
              <input
                type="radio"
                name="j7-option"
                value={key}
                checked={option === key}
                onChange={() => setOption(key)}
                className="mt-1"
              />
              <span className="text-[11px] font-semibold leading-snug text-white">
                <span className="font-black text-blue-300">{key}.</span>{' '}
                {locale === 'fr' ? J7_OPTION_LABELS[key].fr : J7_OPTION_LABELS[key].en}
              </span>
            </label>
          ))}
        </fieldset>

        {(option === 'B' || option === 'C') && (
          <div className="mt-4">
            <label className="text-[9px] font-black uppercase tracking-widest text-slate-400">
              {t('Commentaire (optionnel)', 'Comment (optional)')}
            </label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={3}
              className="mt-2 w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm text-white placeholder:text-slate-600"
              placeholder={t('Décrivez votre besoin…', 'Describe what you need…')}
            />
          </div>
        )}

        {error ? <p className="mt-3 text-[11px] font-semibold text-rose-400">{error}</p> : null}

        <button
          type="button"
          disabled={submitting}
          onClick={handleSubmit}
          className="mt-5 w-full rounded-xl bg-blue-600 py-3 text-[10px] font-black uppercase tracking-widest text-white transition hover:bg-blue-500 disabled:opacity-50"
        >
          {submitting ? t('Envoi…', 'Sending…') : t('Envoyer', 'Submit')}
        </button>
      </div>
    </div>
  );
}
