/**
 * ContentGen.tsx — Rédacteur IA Centris (Phase D-1a)
 *
 * Brief « SYSTÈME SILOS 2026 v4 » D-1 :
 *   « En branchant le NarrativeEngine, on transforme ton silo 2026
 *     en une machine à générer des descriptions ultra-pro. »
 *
 * Architecture Phase D-1a :
 *   1. Gemini génère le texte Centris (créatif, fluide, en français QC).
 *   2. Le moteur de lint OACIQ (@primexpert/core/narrative) :
 *      a) détecte les mots interdits (risque, mauvais, urgent, …)
 *      b) propose un remplacement neutre conforme aux pratiques OACIQ
 *      c) score la qualité (0-100) et liste les expressions recommandées
 *         utilisées (lecture comparative, repères, performance démontrée…)
 *   3. Le courtier valide, corrige, signe (HITL §IV).
 *
 * Note : pour les descriptions Centris (texte marketing), on utilise UNIQUEMENT
 * le linter OACIQ. Le `selectSellerNarrative()` est réservé à la "Lecture
 * Vendeur" du rapport ACM (cf. D-1b).
 */

import React, { useEffect, useMemo, useState } from 'react';
import { FileText, Wand2, Copy, Check, ShieldCheck, Signature, BadgeAlert, ShieldAlert, Sparkles, Home } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { generateListingDescription } from '../services/gemini';
import ReactMarkdown from 'react-markdown';
import { useAuth } from '../lib/auth';
import { useLanguage } from '../lib/i18n';
import {
  lintNarrativeText,
  validateAndFixNarrative,
  type NarrativeLintResult,
} from '@primexpert/core/narrative';
import { listResidences, type Residence } from '../services/residences';

export function ContentGen() {
  const { profile } = useAuth();
  const brokerId = profile?.uid;
  const { language, t } = useLanguage();
  const [loading, setLoading] = useState(false);
  const [description, setDescription] = useState('');
  const [copied, setCopied] = useState(false);

  // Phase E-1b — Sélecteur de résidence (tenant-filtered) pour auto-remplir
  // l'adresse et le prix. Le courtier valide les inclusions / atouts ensuite.
  const [residences, setResidences] = useState<Residence[]>([]);
  const [selectedResidenceId, setSelectedResidenceId] = useState<string>('');
  const [residencesLoading, setResidencesLoading] = useState(false);

  const [formData, setFormData] = useState({
    address: "789 Ave Mont-Royal E, Montréal",
    type: "Condo",
    price: "650 000",
    features: "Plafonds 10 pieds, Luminosité exceptionnelle, Vue sur le Parc",
    inclusions: "Électroménagers, Luminaires, Rideaux"
  });

  useEffect(() => {
    if (!brokerId) return;
    let cancelled = false;
    setResidencesLoading(true);
    listResidences({ tenantId: brokerId, mode: 'strict' })
      .then((rows) => {
        if (!cancelled) setResidences(rows);
      })
      .catch((e) => {
        console.error('[ContentGen] listResidences failed', e);
      })
      .finally(() => {
        if (!cancelled) setResidencesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [brokerId]);

  const handleResidenceSelect = (id: string) => {
    setSelectedResidenceId(id);
    if (!id) return;
    const r = residences.find((x) => x.id === id);
    if (!r) return;
    setFormData((prev) => ({
      ...prev,
      address: r.city ? `${r.address}, ${r.city}` : r.address,
      price: r.price ? r.price.toLocaleString('fr-CA') : prev.price,
    }));
  };

  // Lint OACIQ en temps réel sur le texte affiché
  const lintResult: NarrativeLintResult | null = useMemo(() => {
    if (!description) return null;
    return lintNarrativeText(description);
  }, [description]);

  const handleGenerate = async () => {
    setLoading(true);
    try {
      const result = await generateListingDescription(formData, language);
      setDescription(result || '');
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleSanitize = () => {
    if (!description) return;
    const { text } = validateAndFixNarrative(description, true);
    setDescription(text);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(description);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const scoreColor =
    !lintResult ? '' :
    lintResult.qualityScore >= 90 ? 'text-emerald-300 bg-emerald-500/[0.08] border-emerald-400/30' :
    lintResult.qualityScore >= 70 ? 'text-blue-300 bg-blue-500/10 border-blue-400/30' :
    lintResult.qualityScore >= 50 ? 'text-amber-400 bg-amber-500/[0.06] border-amber-500/20' :
                                    'text-red-300 bg-red-500/[0.08] border-red-400/30';

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 min-h-[600px]">
      {/* Editor Side */}
      <div className="space-y-8">
        <div className="bg-vault p-10 rounded-[32px] border border-white/10 shadow-sm space-y-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-blue-500 rounded-xl flex items-center justify-center shadow-lg shadow-blue-200">
                <Signature className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="text-2xl font-black italic text-slate-300 tracking-tighter uppercase">
                  {t('CONFIGURATEUR', 'CONFIGURATOR')}<span className="text-blue-400">_CENTRIS</span>
                </h3>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                  {t('Gemini · Lint OACIQ @primexpert/core', 'Gemini · OACIQ Lint @primexpert/core')}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 rounded-full bg-emerald-500/[0.08] border border-emerald-400/30 px-3 py-1.5">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-300" />
              <span className="text-[9px] font-black uppercase tracking-widest text-emerald-300">
                {t('Lint OACIQ actif', 'OACIQ Lint Active')}
              </span>
            </div>
          </div>

          {/* Sélecteur de résidence — auto-remplit adresse + prix.
              Pattern identique au Softphone (tenant-filtered strict). */}
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 flex items-center gap-3">
            <Home className="h-4 w-4 text-blue-400 shrink-0" />
            <div className="flex-1 min-w-0">
              <span className="block text-[10px] font-black uppercase tracking-widest text-blue-300/70">
                {t('Pré-remplir depuis une résidence', 'Pre-fill from a residence')}
              </span>
              <select
                value={selectedResidenceId}
                onChange={(e) => handleResidenceSelect(e.target.value)}
                className="mt-1.5 w-full text-[12px] font-bold bg-transparent text-slate-200 border-b border-white/10 py-1.5 focus:outline-none focus:border-blue-500"
              >
                <option value="" className="bg-slate-900">
                  — {residencesLoading
                    ? t('Chargement…', 'Loading…')
                    : residences.length === 0
                      ? t('Aucune résidence — saisir manuellement', 'No residence — fill manually')
                      : t('Choisir une résidence (optionnel)', 'Pick a residence (optional)')} —
                </option>
                {residences.map((r) => (
                  <option key={r.id} value={r.id} className="bg-slate-900">
                    {r.address} · {r.city}
                  </option>
                ))}
              </select>
            </div>
            {selectedResidenceId && (
              <button
                onClick={() => handleResidenceSelect('')}
                className="text-[9px] font-black uppercase tracking-widest text-blue-300/60 hover:text-blue-300 transition shrink-0"
              >
                {t('Effacer', 'Clear')}
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-2 col-span-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-1">{t('Adresse Complète', 'Full Address')}</label>
              <input
                value={formData.address}
                onChange={e => setFormData({...formData, address: e.target.value})}
                className="workhub-input w-full p-4 rounded-xl text-sm font-bold uppercase tracking-tight"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-1">Type</label>
              <input
                value={formData.type}
                onChange={e => setFormData({...formData, type: e.target.value})}
                className="workhub-input w-full p-4 rounded-xl text-sm font-bold uppercase tracking-tight"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-1">{t('Prix ($)', 'Price ($)')}</label>
              <input
                value={formData.price}
                onChange={e => setFormData({...formData, price: e.target.value})}
                className="workhub-input w-full p-4 rounded-xl text-sm font-bold tracking-tight"
              />
            </div>
            <div className="space-y-2 col-span-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-1">{t('Atouts principaux', 'Key Assets')}</label>
              <textarea
                rows={3}
                value={formData.features}
                onChange={e => setFormData({...formData, features: e.target.value})}
                className="workhub-input w-full p-4 rounded-xl text-sm font-bold tracking-tight"
              />
            </div>
          </div>

          <button
            onClick={handleGenerate}
            disabled={loading}
            className="w-full py-4 bg-blue-500 text-white font-black rounded-2xl hover:bg-blue-800 transition-all flex items-center justify-center gap-3 group relative overflow-hidden shadow-xl uppercase text-[11px] tracking-widest active:scale-95"
          >
            <AnimatePresence mode="wait">
              {loading ? (
                <motion.div
                  key="loading"
                  animate={{ rotate: 360 }}
                  transition={{ repeat: Infinity, duration: 1 }}
                >
                  <Wand2 className="w-5 h-5 text-blue-200" />
                </motion.div>
              ) : (
                <motion.div key="ready" className="flex items-center gap-3">
                  <Wand2 className="w-5 h-5 text-blue-300" />
                  {t('Rédiger avec l’IA linguistique', 'Write with AI_NLP')}
                </motion.div>
              )}
            </AnimatePresence>
          </button>
        </div>

        {/* Bandeau Signature */}
        <div className="bg-blue-900 text-white p-8 rounded-[32px] shadow-lg border border-white/5 relative overflow-hidden">
           <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500 rounded-full blur-[60px] opacity-10 pointer-events-none" />
           <div className="flex gap-5 relative z-10">
             <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center border border-white/10 shrink-0">
               <ShieldCheck className="w-6 h-6 text-blue-400" />
             </div>
             <div>
               <p className="text-[10px] font-black tracking-widest text-blue-300 uppercase mb-2">{t('Bloc Signature Obligatoire (OACIQ)', 'Mandatory Signature Block (OACIQ)')}</p>
               <div className="space-y-1">
                 <p className="text-sm font-black italic tracking-tight">{profile?.licenseName || profile?.displayName}</p>
                 <p className="text-[10px] font-bold text-blue-200/60 uppercase tracking-widest">{profile?.title || 'Courtier Immobilier Résidentiel'}</p>
                 <p className="text-[10px] font-bold text-blue-400 underline">{profile?.agency || 'Agence Immobilière Primexpert Inc.'}</p>
               </div>
             </div>
           </div>
        </div>
      </div>

      {/* Output Side */}
      <div className="relative">
        <div className="h-full bg-vault rounded-[40px] border border-white/10 shadow-2xl overflow-hidden flex flex-col">
          <div className="bg-white/[0.03] px-10 py-5 border-b border-white/10 flex justify-between items-center">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
              {t('Prévisualisation du brouillon Centris', 'Centris_Draft Preview')}
            </span>

            {description && (
              <div className="flex items-center gap-3">
                {lintResult && (
                  <div className={`flex items-center gap-1.5 rounded-full border px-3 py-1 ${scoreColor}`}>
                    <Sparkles className="h-3 w-3" />
                    <span className="text-[10px] font-black tracking-widest font-mono">
                      OACIQ {lintResult.qualityScore}/100
                    </span>
                  </div>
                )}
                <button
                  onClick={handleCopy}
                  className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-blue-300 hover:text-blue-300 transition-all font-mono"
                >
                  {copied ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
                  {copied ? t('Copie réussie', 'COPIED_OK') : t('Copier', 'COPY_CLIPBOARD')}
                </button>
              </div>
            )}
          </div>

          {/* Lint Banner — mots interdits détectés */}
          {lintResult && !lintResult.isValid && (
            <div className="px-10 py-4 bg-red-500/[0.08] border-b border-red-400/30 flex items-start gap-3">
              <ShieldAlert className="h-4 w-4 text-red-300 mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-red-300">
                  {t('Lint OACIQ — mots à éviter détectés', 'OACIQ Lint — discouraged words detected')}
                </p>
                <p className="text-[11px] font-bold text-red-300 mt-1 leading-relaxed">
                  {lintResult.foundWords.map((w, i) => (
                    <span key={w}>
                      <code className="bg-red-500/15 px-1.5 py-0.5 rounded">{w}</code>
                      {i < lintResult.foundWords.length - 1 ? ' · ' : ''}
                    </span>
                  ))}
                </p>
              </div>
              <button
                onClick={handleSanitize}
                className="shrink-0 rounded-xl border border-red-300 bg-vault px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-red-300 hover:bg-red-500/[0.08] transition"
              >
                <BadgeAlert className="inline h-3 w-3 mr-1" />
                {t('Corriger auto.', 'Auto-fix')}
              </button>
            </div>
          )}

          {/* Recommended expressions used (positive feedback) */}
          {lintResult && lintResult.usedRecommendedExpressions.length > 0 && (
            <div className="px-10 py-3 bg-emerald-500/[0.08] border-b border-emerald-400/30">
              <p className="text-[10px] font-bold tracking-widest text-emerald-300">
                <Sparkles className="inline h-3 w-3 mr-1" />
                {t('Expressions OACIQ utilisées', 'OACIQ expressions used')} ·{' '}
                <span className="font-mono">{lintResult.usedRecommendedExpressions.join(' · ')}</span>
              </p>
            </div>
          )}

          <div className="flex-1 p-12 overflow-y-auto">
            {description ? (
              <div className="prose prose-blue max-w-none prose-headings:font-black prose-headings:italic prose-headings:tracking-tighter prose-headings:text-slate-300 prose-p:text-slate-300 prose-p:leading-relaxed prose-p:font-medium">
                <ReactMarkdown>{description}</ReactMarkdown>
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center space-y-6 opacity-10">
                <FileText className="w-24 h-24 text-slate-400" />
                <p className="text-2xl font-black uppercase tracking-tighter italic font-serif">
                  {t('En attente de génération', 'Awaiting_Generation')}
                </p>
              </div>
            )}
          </div>

          <div className="p-8 bg-white/[0.03] border-t border-white/10 italic font-black uppercase tracking-widest text-[9px] text-slate-300 flex justify-between">
            <span>{t('Validation humaine obligatoire', 'HUMAN_IN_THE_LOOP_VALIDATION_REQUIRED')}</span>
            <span className="text-blue-500">{t('v2.0 · OACIQ Core Lint', 'v2.0 · OACIQ Core Lint')}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
