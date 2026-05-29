/**
 * SPA workhub — entrée publique = HTML statique (index.html + gate.ts).
 */

import React, { Suspense, lazy } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { LanguageProvider } from './lib/i18n';

const AuthenticatedApp = lazy(() => import('./AuthenticatedApp'));

function AuthenticatedFallback() {
  return (
    <div className="flex min-h-screen w-screen items-center justify-center bg-[#0a0a0a] text-slate-400">
      <p className="text-[10px] font-black uppercase tracking-[0.2em]">Chargement du cockpit…</p>
    </div>
  );
}

export default function App() {
  return (
    <LanguageProvider>
      <BrowserRouter>
        <Suspense fallback={<AuthenticatedFallback />}>
          <AuthenticatedApp />
        </Suspense>
      </BrowserRouter>
    </LanguageProvider>
  );
}
