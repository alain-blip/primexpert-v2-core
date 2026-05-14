/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { Suspense, lazy, useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './lib/auth';
import { WorkhubNavProvider } from './lib/workhubNav';
import { Layout } from './components/Layout';
import { LanguageProvider, useLanguage } from './lib/i18n';
import { LogIn, TrendingUp, BarChart3 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// Phase F-1 — Code-splitting par route.
// Chaque composant lourd est charge a la demande (chunk JS dedie).
// Le payload initial du Workhub se limite a Layout + Dashboard + vendors.
const Dashboard  = lazy(() => import('./components/Dashboard').then(m => ({ default: m.Dashboard })));
const Listings   = lazy(() => import('./components/Listings').then(m => ({ default: m.Listings })));
const CRM        = lazy(() => import('./components/CRM').then(m => ({ default: m.CRM })));
const ACM        = lazy(() => import('./components/ACM').then(m => ({ default: m.ACM })));
const ContentGen = lazy(() => import('./components/ContentGen').then(m => ({ default: m.ContentGen })));
const Mailbox    = lazy(() => import('./components/Mailbox').then(m => ({ default: m.Mailbox })));
const Drive      = lazy(() => import('./components/Drive/Drive').then(m => ({ default: m.Drive })));
const Softphone  = lazy(() => import('./components/Softphone/Softphone').then(m => ({ default: m.Softphone })));
const Settings   = lazy(() => import('./components/Settings').then(m => ({ default: m.Settings })));

function LoadingScreen() {
  return (
    <div className="h-screen w-screen flex items-center justify-center bg-[#0a0a0a]">
      <motion.div 
        animate={{ rotate: 360 }}
        transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
        className="w-12 h-12 border-2 border-[#D4AF37] border-t-transparent rounded-full"
      />
    </div>
  );
}

// Fallback Suspense pour chargements de routes lazy (F-1).
// Compact, palette Vault, animation discrete pour ne pas distraire.
function RouteSuspense() {
  return (
    <div className="h-[420px] w-full flex items-center justify-center" aria-label="Chargement…">
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 1.4, repeat: Infinity, ease: 'linear' }}
        className="w-8 h-8 border-2 border-blue-400/40 border-t-blue-300 rounded-full"
      />
    </div>
  );
}

function LandingPage() {
  const { user, signIn } = useAuth();
  const { language, setLanguage, t } = useLanguage();
  const navigate = useNavigate();

  const handleInitializeSession = async () => {
    if (!user) {
      await signIn();
    }

    navigate('/workhub');
  };

  return (
    <div className="min-h-screen w-screen bg-white text-neutral-950 antialiased overflow-x-hidden">
      <header className="sticky top-0 z-50 border-b border-neutral-200 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <button
            type="button"
            onClick={() => navigate('/')}
            className="rounded-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900"
            aria-label="Primexpert — accueil"
          >
            <img src="/logo-primexpert-noir.png" alt="Primexpert" className="h-9 w-auto" />
          </button>

          <nav className="flex flex-wrap items-center justify-end gap-2 sm:gap-3" aria-label={t('Navigation et connexion', 'Navigation and sign in')}>
            <div className="flex items-center rounded-lg border border-neutral-300 p-0.5" role="group" aria-label={t('Choix de la langue', 'Language selection')}>
              {(['fr', 'en'] as const).map((nextLanguage) => (
                <button
                  key={nextLanguage}
                  type="button"
                  onClick={() => setLanguage(nextLanguage)}
                  title={
                    nextLanguage === 'fr'
                      ? t('Français (Canada) — défaut', 'French (Canada) — default')
                      : t('Anglais', 'English')
                  }
                  className={`rounded-md px-3 py-1.5 text-sm font-semibold transition ${language === nextLanguage ? 'bg-neutral-900 text-white' : 'text-neutral-700 hover:bg-neutral-100'}`}
                >
                  {nextLanguage === 'fr' ? 'FR' : 'EN'}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={handleInitializeSession}
              className="rounded-lg px-3 py-2 text-sm font-semibold text-neutral-800 hover:bg-neutral-100"
              title={t('Entrer dans le cockpit Primexpert (GPS immobilier)', 'Enter the Primexpert cockpit')}
            >
              GPS
            </button>
            <button
              type="button"
              onClick={handleInitializeSession}
              className="rounded-lg border border-neutral-900 bg-neutral-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-neutral-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900"
            >
              {t('Connexion', 'Sign in')}
            </button>
          </nav>
        </div>
      </header>

      <main>
        <section className="relative overflow-hidden border-b border-neutral-200 bg-neutral-50" aria-labelledby="hero-heading">
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.03]"
            style={{
              backgroundImage: 'linear-gradient(to right, #000 1px, transparent 1px), linear-gradient(to bottom, #000 1px, transparent 1px)',
              backgroundSize: '24px 24px',
            }}
          />
          <div className="relative mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24 lg:px-8 lg:py-28">
            <div className="mx-auto max-w-4xl text-center">
              <motion.div
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="mx-auto mb-12 block w-full"
              >
                <img
                  src="/logo-primexpert-noir.png"
                  alt="Primexpert"
                  className="relative z-10 mx-auto block h-32 w-auto max-w-full object-contain sm:h-40 lg:h-48"
                />
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.08, duration: 0.5 }}
                className="flex flex-col items-center gap-6"
              >
                <h1 id="hero-heading" className="text-3xl font-black leading-tight tracking-tight text-neutral-950 sm:text-4xl md:text-5xl lg:text-[2.75rem] lg:leading-[1.15]">
                  {t("Devenez l'expert, devenez Primexpert.", 'Become the expert, become Primexpert.')}
                </h1>
                <p className="mx-auto max-w-2xl text-pretty text-lg leading-relaxed text-neutral-600 sm:text-xl">
                  {t("Signer, c'est bien. Au juste prix, c'est mieux.", 'Signing is good. At the right price is better.')}
                </p>
                <div className="mt-4 flex flex-col items-stretch justify-center gap-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-center">
                  <button
                    type="button"
                    onClick={handleInitializeSession}
                    className="inline-flex min-h-[48px] items-center justify-center gap-3 rounded-lg bg-neutral-900 px-8 py-3 text-center text-base font-semibold text-white shadow-sm transition hover:bg-neutral-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900"
                  >
                    <LogIn className="h-5 w-5" />
                    {t('Initialiser la session', 'Initialize session')}
                  </button>
                  <button
                    type="button"
                    onClick={handleInitializeSession}
                    className="inline-flex min-h-[48px] items-center justify-center rounded-lg border-2 border-neutral-900 bg-transparent px-8 py-3 text-center text-base font-semibold text-neutral-900 transition hover:bg-neutral-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900"
                  >
                    {t("Voir la démo de l'ACM", 'View the CMA demo')}
                  </button>
                </div>
              </motion.div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24" aria-labelledby="features-heading">
          <h2 id="features-heading" className="sr-only">{t('Fonctionnalités', 'Features')}</h2>
          <div className="grid gap-8 md:grid-cols-3 md:gap-10">
            {[
              ['1', t("L'ACM personnalisée", 'Personalized CMA'), t('Opinion de valeur fondée, motivée et prête à être validée par le courtier.', 'A grounded, reasoned value opinion ready for broker validation.')],
              ['2', t('Centralisation totale', 'Total centralization'), t('CRM, dossiers, rappels et conformité rassemblés dans un seul GPS immobilier.', 'CRM, files, reminders and compliance gathered into one real estate GPS.')],
              ['3', t('Mise en marché éclair', 'Fast go-to-market'), t('Rédaction, signature conforme et garde-fous publicitaires intégrés.', 'Copywriting, compliant signature and advertising guardrails integrated.')],
            ].map(([index, title, body]) => (
              <article key={index} className="flex flex-col rounded-2xl border border-neutral-200 bg-white p-8 shadow-sm transition hover:border-neutral-300 hover:shadow-md">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg border border-neutral-200 bg-neutral-50 text-xl font-black text-neutral-900" aria-hidden="true">
                  {index}
                </div>
                <h3 className="text-xl font-black text-neutral-950">{title}</h3>
                <p className="mt-3 flex-1 leading-relaxed text-neutral-600">{body}</p>
              </article>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t border-neutral-200 bg-neutral-50 py-10">
        <div className="mx-auto max-w-6xl px-4 text-center sm:px-6 lg:px-8">
          <p className="text-sm text-neutral-500">{t('Primexpert accompagne le courtier, sans remplacer sa validation professionnelle.', 'Primexpert supports the broker without replacing professional validation.')}</p>
          <p className="mt-4 text-sm font-medium text-neutral-700">{t('© 2026 Primexpert. Tous droits réservés.', '© 2026 Primexpert. All rights reserved.')}</p>
          <p className="mx-auto mt-3 max-w-3xl text-xs leading-relaxed text-neutral-400">
            {t(
              'Tous droits réservés. Toute reproduction, distribution ou utilisation, en tout ou en partie, est strictement interdite sans autorisation écrite préalable.',
              'All rights reserved. Any reproduction, distribution, or use, in whole or in part, is strictly prohibited without prior written authorization.'
            )}
          </p>
        </div>
      </footer>
    </div>
  );
}

function Workhub() {
  const [activeTab, setActiveTab] = useState('dashboard');

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard': return <Dashboard />;
      case 'pipeline': return (
        <div className="h-[600px] flex flex-col items-center justify-center opacity-20 italic">
          <TrendingUp className="w-24 h-24 mb-4" />
          <p className="text-[20px] font-black uppercase tracking-[0.3em]">PIPELINE_FLOW_ENGINE</p>
        </div>
      );
      case 'listings': return <Listings />;
      case 'acm': return <ACM />;
      case 'stats': return (
        <div className="h-[600px] flex flex-col items-center justify-center opacity-20 italic">
          <BarChart3 className="w-24 h-24 mb-4" />
          <p className="text-[20px] font-black uppercase tracking-[0.3em]">MARKET_ANALYTICS_V4</p>
        </div>
      );
      case 'crm': return <CRM />;
      case 'content': return <ContentGen />;
      case 'mail': return <Mailbox />;
      case 'drive': return <Drive />;
      case 'phone': return <Softphone />;
      case 'settings': return <Settings />;
      default: return <Dashboard />;
    }
  };

  return (
    <WorkhubNavProvider setActiveTab={setActiveTab}>
      <Layout activeTab={activeTab} setActiveTab={setActiveTab}>
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            transition={{ duration: 0.2 }}
            className="h-full"
          >
            <Suspense fallback={<RouteSuspense />}>
              {renderContent()}
            </Suspense>
          </motion.div>
        </AnimatePresence>
      </Layout>
    </WorkhubNavProvider>
  );
}

function ProtectedWorkhub() {
  const { user, loading } = useAuth();

  if (loading) {
    return <LoadingScreen />;
  }

  if (!user) {
    return <Navigate to="/" replace />;
  }

  return <Workhub />;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/workhub" element={<ProtectedWorkhub />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <LanguageProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </LanguageProvider>
    </AuthProvider>
  );
}
