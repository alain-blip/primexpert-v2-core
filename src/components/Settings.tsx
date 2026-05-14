/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { useLanguage } from '../lib/i18n';
import { useAuth } from '../lib/auth';
import { Settings as SettingsIcon, ShieldCheck, Sparkles, Phone, Users, UserCog } from 'lucide-react';

const SECTIONS = [
  {
    id: 'profile',
    icon: UserCog,
    title: { fr: 'Profil et accréditations', en: 'Profile & accreditations' },
    desc: {
      fr: 'Identité courtier, numéro de permis OACIQ, code APCIQ, signature de courriel.',
      en: 'Broker identity, OACIQ license, APCIQ code, email signature.',
    },
  },
  {
    id: 'compliance',
    icon: ShieldCheck,
    title: { fr: 'Conformité professionnelle', en: 'Professional compliance' },
    desc: {
      fr: 'Règles OACIQ, mentions obligatoires, vocabulaire interdit, garde-fous Vault.',
      en: 'OACIQ rules, mandatory mentions, forbidden vocabulary, Vault guardrails.',
    },
  },
  {
    id: 'ai',
    icon: Sparkles,
    title: { fr: 'Configuration IA', en: 'AI configuration' },
    desc: {
      fr: 'Niveau de créativité, signature automatique, modèles Gemini par usage.',
      en: 'Creativity level, automatic signature, Gemini models per use case.',
    },
  },
  {
    id: 'twilio',
    icon: Phone,
    title: { fr: 'Communications Twilio', en: 'Twilio communications' },
    desc: {
      fr: 'Clés API, numéro sortant, callbacks d\'enregistrement (Phase E).',
      en: 'API keys, outgoing number, recording callbacks (Phase E).',
    },
  },
  {
    id: 'delegation',
    icon: Users,
    title: { fr: 'Collaborateur / Adjointe', en: 'Collaborator / Assistant' },
    desc: {
      fr: 'Délégation contrôlée, copie conforme automatique des courriels générés.',
      en: 'Controlled delegation, automatic CC on generated emails.',
    },
  },
];

export function Settings() {
  const { language, t } = useLanguage();
  const { profile } = useAuth();

  return (
    <div className="space-y-8">
      <div className="bg-[#172554] p-8 rounded-[36px] text-white shadow-[0_30px_90px_rgba(23,37,84,0.28)] relative overflow-hidden">
        <div className="absolute top-0 right-0 w-56 h-56 bg-blue-500 rounded-full blur-[90px] opacity-20 pointer-events-none" />
        <div className="relative flex items-start justify-between gap-6 flex-wrap">
          <div>
            <p className="text-[10px] font-black text-blue-300 tracking-[0.3em] uppercase">
              {t('Paramètres utilisateur', 'User settings')}
            </p>
            <h2 className="text-5xl font-black italic tracking-tighter uppercase mt-2 leading-none">
              {t('Profil et accréditations', 'Profile & accreditations')}
              <span className="text-blue-300 opacity-60">.V2</span>
            </h2>
            <p className="text-[11px] font-black text-blue-300/70 mt-4 tracking-widest uppercase">
              <SettingsIcon className="inline w-3 h-3 mr-2 -mt-0.5" />
              {profile?.displayName ?? 'Workhub'} • {t('Cockpit Silo 2026', 'Silo 2026 cockpit')}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button className="px-5 py-3 bg-white/10 text-white text-[10px] font-black rounded-[18px] uppercase tracking-[0.2em] hover:bg-white/20 transition border border-white/10">
              {t('Réinitialiser l\'interface', 'Reset interface')}
            </button>
            <button className="px-5 py-3 bg-white text-[#172554] text-[10px] font-black rounded-[18px] uppercase tracking-[0.2em] hover:bg-blue-100 transition shadow-[0_18px_40px_rgba(255,255,255,0.18)]">
              {t('Enregistrer les modifications', 'Save changes')}
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {SECTIONS.map((section) => {
          const Icon = section.icon;
          return (
            <div
              key={section.id}
              className="bg-white rounded-[28px] p-6 border border-slate-200/70 shadow-[0_14px_40px_rgba(15,23,42,0.06)] hover:shadow-[0_20px_55px_rgba(37,99,235,0.10)] transition-all group cursor-pointer"
            >
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-[18px] bg-blue-50 text-blue-600 flex items-center justify-center group-hover:bg-blue-600 group-hover:text-white transition-colors shrink-0">
                  <Icon className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <p className="text-[9px] font-black text-slate-500 uppercase tracking-[0.22em]">
                    {t('Section', 'Section')} · {section.id.toUpperCase()}
                  </p>
                  <h3 className="text-[15px] font-black text-slate-900 mt-1 uppercase tracking-tight leading-tight">
                    {section.title[language as 'fr' | 'en'] ?? section.title.fr}
                  </h3>
                  <p className="text-[11px] text-slate-600 mt-3 leading-relaxed">
                    {section.desc[language as 'fr' | 'en'] ?? section.desc.fr}
                  </p>
                </div>
              </div>
              <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-4">
                <span className="text-[9px] font-black text-amber-600 uppercase tracking-[0.22em] bg-amber-50 border border-amber-200 px-2 py-1 rounded-md">
                  {t('Phase E · à venir', 'Phase E · upcoming')}
                </span>
                <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest opacity-0 group-hover:opacity-100 transition">
                  {t('Ouvrir', 'Open')} →
                </span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="bg-white rounded-[28px] p-6 border border-slate-200/70 shadow-[0_14px_40px_rgba(15,23,42,0.06)]">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.22em]">
              {t('Architecture multi-tenant', 'Multi-tenant architecture')}
            </p>
            <h4 className="text-[15px] font-black text-slate-900 mt-1 uppercase tracking-tight">
              {t('Modèle hybride courtier ↔ agence', 'Hybrid broker ↔ agency model')}
            </h4>
          </div>
          <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest">
            <span className="flex items-center gap-1.5 text-green-600">
              <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
              {t('courtiersResponsables', 'courtiersResponsables')}
            </span>
            <span className="text-slate-300">·</span>
            <span className="flex items-center gap-1.5 text-blue-600">
              <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
              {t('organizationId · prêt', 'organizationId · ready')}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
