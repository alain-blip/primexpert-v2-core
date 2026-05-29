/**
 * Page d'authentification publique — HTML5 brut, Firebase chargé au clic uniquement.
 */

import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogIn } from 'lucide-react';
import { useLanguage } from '../lib/i18n';
import { checkExistingSession, publicSignIn } from '../lib/publicEntryAuth';

export function LandingPage() {
  const { language, setLanguage, t } = useLanguage();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || window.innerWidth < 768) return;

    let cancelled = false;
    const timer = window.setTimeout(() => {
      void checkExistingSession().then((hasSession) => {
        if (!cancelled && hasSession) {
          navigate('/workhub', { replace: true });
        }
      });
    }, 2_000);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [navigate]);

  const handleInitializeSession = async () => {
    setBusy(true);
    try {
      const ok = await publicSignIn();
      if (ok) {
        navigate('/workhub', { replace: true });
      }
    } finally {
      setBusy(false);
    }
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

          <nav
            className="flex flex-wrap items-center justify-end gap-2 sm:gap-3"
            aria-label={t('Navigation et connexion', 'Navigation and sign in')}
          >
            <div
              className="flex items-center rounded-lg border border-neutral-300 p-0.5"
              role="group"
              aria-label={t('Choix de la langue', 'Language selection')}
            >
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
              disabled={busy}
              onClick={handleInitializeSession}
              className="rounded-lg px-3 py-2 text-sm font-semibold text-neutral-800 hover:bg-neutral-100 disabled:opacity-60"
              title={t('Entrer dans le cockpit Primexpert (GPS immobilier)', 'Enter the Primexpert cockpit')}
            >
              GPS
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={handleInitializeSession}
              className="rounded-lg border border-neutral-900 bg-neutral-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-neutral-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900 disabled:opacity-60"
            >
              {busy ? t('Connexion…', 'Signing in…') : t('Connexion', 'Sign in')}
            </button>
          </nav>
        </div>
      </header>

      <main>
        <section
          className="relative overflow-hidden border-b border-neutral-200 bg-neutral-50"
          aria-labelledby="hero-heading"
        >
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.03]"
            style={{
              backgroundImage:
                'linear-gradient(to right, #000 1px, transparent 1px), linear-gradient(to bottom, #000 1px, transparent 1px)',
              backgroundSize: '24px 24px',
            }}
          />
          <div className="relative mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24 lg:px-8 lg:py-28">
            <div className="mx-auto max-w-4xl text-center">
              <div className="mx-auto mb-12 block w-full">
                <img
                  src="/logo-primexpert-noir.png"
                  alt="Primexpert"
                  className="relative z-10 mx-auto block h-32 w-auto max-w-full object-contain sm:h-40 lg:h-48"
                />
              </div>

              <div className="flex flex-col items-center gap-6">
                <h1
                  id="hero-heading"
                  className="text-3xl font-black leading-tight tracking-tight text-neutral-950 sm:text-4xl md:text-5xl lg:text-[2.75rem] lg:leading-[1.15]"
                >
                  {t("Devenez l'expert, devenez Primexpert.", 'Become the expert, become Primexpert.')}
                </h1>
                <p className="mx-auto max-w-2xl text-pretty text-lg leading-relaxed text-neutral-600 sm:text-xl">
                  {t("Signer, c'est bien. Au juste prix, c'est mieux.", 'Signing is good. At the right price is better.')}
                </p>
                <div className="mt-4 flex flex-col items-stretch justify-center gap-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-center">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={handleInitializeSession}
                    className="inline-flex min-h-[48px] items-center justify-center gap-3 rounded-lg bg-neutral-900 px-8 py-3 text-center text-base font-semibold text-white shadow-sm transition hover:bg-neutral-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900 disabled:opacity-60"
                  >
                    <LogIn className="h-5 w-5" />
                    {busy ? t('Connexion…', 'Signing in…') : t('Initialiser la session', 'Initialize session')}
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={handleInitializeSession}
                    className="inline-flex min-h-[48px] items-center justify-center rounded-lg border-2 border-neutral-900 bg-transparent px-8 py-3 text-center text-base font-semibold text-neutral-900 transition hover:bg-neutral-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900 disabled:opacity-60"
                  >
                    {t(
                      "Voir la démo de l'analyse comparative de marché (ACM)",
                      'View the comparative market analysis (CMA) demo'
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section
          className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24"
          aria-labelledby="features-heading"
        >
          <h2 id="features-heading" className="sr-only">
            {t('Fonctionnalités', 'Features')}
          </h2>
          <div className="grid gap-8 md:grid-cols-3 md:gap-10">
            {[
              [
                '1',
                t("L'analyse comparative de marché (ACM) personnalisée", 'Personalized comparative market analysis (CMA)'),
                t(
                  'Opinion de valeur fondée, motivée et prête à être validée par le courtier.',
                  'A grounded, reasoned value opinion ready for broker validation.'
                ),
              ],
              [
                '2',
                t('Centralisation totale', 'Total centralization'),
                t(
                  'Répertoire clients (CRM), dossiers, rappels et conformité rassemblés dans un seul GPS immobilier.',
                  'Client relationship management (CRM), files, reminders and compliance gathered into one real estate GPS.'
                ),
              ],
              [
                '3',
                t('Mise en marché éclair', 'Fast go-to-market'),
                t(
                  'Rédaction, signature conforme et garde-fous publicitaires intégrés.',
                  'Copywriting, compliant signature and advertising guardrails integrated.'
                ),
              ],
            ].map(([index, title, body]) => (
              <article
                key={index}
                className="flex flex-col rounded-2xl border border-neutral-200 bg-white p-8 shadow-sm transition hover:border-neutral-300 hover:shadow-md"
              >
                <div
                  className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg border border-neutral-200 bg-neutral-50 text-xl font-black text-neutral-900"
                  aria-hidden="true"
                >
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
          <p className="text-sm text-neutral-500">
            {t(
              'Primexpert accompagne le courtier, sans remplacer sa validation professionnelle.',
              'Primexpert supports the broker without replacing professional validation.'
            )}
          </p>
          <p className="mt-4 text-sm font-medium text-neutral-700">
            {t('© 2026 Primexpert. Tous droits réservés.', '© 2026 Primexpert. All rights reserved.')}
          </p>
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
