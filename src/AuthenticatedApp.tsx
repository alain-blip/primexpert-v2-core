/**
 * Routes authentifiées — AuthProvider + workhub (chunk séparé de l'entrée publique).
 */

import React, { Suspense, lazy, useEffect, useState } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './lib/auth';
import { isAccountSuspended } from './lib/billingAccess';
import { SuspendedAccountScreen } from './components/SuspendedAccountScreen';
import { WorkhubNavProvider } from './lib/workhubNav';
import { SiloProvider } from './context/SiloContext';
import { motion, AnimatePresence } from 'motion/react';

const WorkhubLayout = lazy(() =>
  import('./components/Layout').then((m) => ({ default: m.Layout }))
);

const Dashboard = lazy(() => import('./components/Dashboard').then((m) => ({ default: m.Dashboard })));
const SuiviDossiersTab = lazy(() =>
  import('./components/SuiviDossiersTab').then((m) => ({ default: m.SuiviDossiersTab }))
);
const Listings = lazy(() =>
  import('./components/Listings')
    .then((m) => ({ default: m.Listings }))
    .catch((err) => {
      console.error('[Listings] Échec chargement chunk', err);
      return {
        default: function ListingsLoadError() {
          return (
            <div className="rounded-2xl border-2 border-red-500 bg-red-50 p-6 text-red-900" role="alert">
              <p className="text-sm font-bold">Mes inscriptions — module indisponible</p>
              <p className="mt-2 font-mono text-xs opacity-90">
                {err instanceof Error ? err.message : String(err)}
              </p>
            </div>
          );
        },
      };
    })
);
const CRM = lazy(() => import('./components/CRM').then((m) => ({ default: m.CRM })));
const ACM = lazy(() => import('./components/ACM').then((m) => ({ default: m.ACM })));
const ContentGen = lazy(() => import('./components/ContentGen').then((m) => ({ default: m.ContentGen })));
const Mailbox = lazy(() =>
  import('./components/mailbox/MailboxContainer').then((m) => ({ default: m.MailboxContainer }))
);
const DocumentsDashboard = lazy(() =>
  import('./components/documents/DocumentsDashboard').then((m) => ({
    default: m.DocumentsDashboard,
  }))
);
const Softphone = lazy(() => import('./components/Softphone/Softphone').then((m) => ({ default: m.Softphone })));
const Settings = lazy(() => import('./components/Settings').then((m) => ({ default: m.Settings })));
const AdminSubscriptionsDashboard = lazy(() =>
  import('./components/AdminSubscriptionsDashboard').then((m) => ({
    default: m.AdminSubscriptionsDashboard,
  }))
);
const MarketLibraryDashboard = lazy(() =>
  import('./components/market/MarketLibraryDashboard').then((m) => ({
    default: m.MarketLibraryDashboard,
  }))
);
const AccesVendeurPage = lazy(() => import('./components/vendor/AccesVendeurPage'));

function LoadingScreen() {
  return (
    <div className="flex h-screen w-screen flex-col items-center justify-center gap-4 bg-[#0a0a0a]">
      <div
        className="h-12 w-12 animate-spin rounded-full border-2 border-[#D4AF37] border-t-transparent"
        aria-hidden
      />
      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Chargement…</p>
    </div>
  );
}

function RouteSuspense() {
  return (
    <div className="flex h-[420px] w-full items-center justify-center" aria-label="Chargement…">
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 1.4, repeat: Infinity, ease: 'linear' }}
        className="h-8 w-8 rounded-full border-2 border-blue-400/40 border-t-blue-300"
      />
    </div>
  );
}

function Workhub() {
  const { profile } = useAuth();
  const [activeTab, setActiveTab] = useState('dashboard');

  useEffect(() => {
    const tab = new URLSearchParams(window.location.search).get('tab');
    if (tab) setActiveTab(tab);
  }, []);

  const renderContent = () => {
    switch (activeTab) {
      case 'admin-billing':
        if (profile?.role !== 'admin_system') return <Dashboard />;
        return <AdminSubscriptionsDashboard />;
      case 'dashboard':
        return <Dashboard />;
      case 'pipeline':
        return <SuiviDossiersTab />;
      case 'listings':
        return <Listings />;
      case 'acm':
        return <ACM />;
      case 'stats':
        return <MarketLibraryDashboard />;
      case 'crm':
        return <CRM />;
      case 'content':
        return <ContentGen />;
      case 'mail':
        return <Mailbox />;
      case 'drive':
        return <DocumentsDashboard />;
      case 'phone':
        return <Softphone />;
      case 'settings':
        return <Settings />;
      default:
        return <Dashboard />;
    }
  };

  return (
    <WorkhubNavProvider setActiveTab={setActiveTab}>
      <Suspense fallback={<LoadingScreen />}>
        <WorkhubLayout activeTab={activeTab} setActiveTab={setActiveTab}>
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.2 }}
              className="h-full"
            >
              <Suspense fallback={<RouteSuspense />}>{renderContent()}</Suspense>
            </motion.div>
          </AnimatePresence>
        </WorkhubLayout>
      </Suspense>
    </WorkhubNavProvider>
  );
}

function ProtectedWorkhub() {
  const { user, loading, profile } = useAuth();

  if (loading) return <LoadingScreen />;
  if (!user) return <Navigate to="/" replace />;
  if (isAccountSuspended(profile)) return <SuspendedAccountScreen />;

  return (
    <SiloProvider accessibleSilosFromProfile={profile?.accessibleSilos}>
      <Workhub />
    </SiloProvider>
  );
}

function AccesVendeurRoute() {
  const { user, loading } = useAuth();
  const token =
    typeof window !== 'undefined'
      ? new URLSearchParams(window.location.search).get('token')
      : null;

  if (token) {
    return (
      <Suspense fallback={<RouteSuspense />}>
        <AccesVendeurPage forcedMode="client" />
      </Suspense>
    );
  }

  if (loading) return <LoadingScreen />;
  if (!user) return <Navigate to="/" replace />;
  return (
    <Suspense fallback={<RouteSuspense />}>
      <AccesVendeurPage forcedMode="broker" />
    </Suspense>
  );
}

/** Ouvre la connexion Google si l'utilisateur arrive via `/workhub?signin=1` depuis la page statique. */
function SignInFromQuery() {
  const { user, loading, signIn } = useAuth();

  useEffect(() => {
    if (loading || user) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('signin') !== '1') return;
    void signIn().finally(() => {
      params.delete('signin');
      const qs = params.toString();
      window.history.replaceState({}, '', qs ? `/workhub?${qs}` : '/workhub');
    });
  }, [user, loading, signIn]);

  return null;
}

export default function AuthenticatedApp() {
  return (
    <AuthProvider>
      <SignInFromQuery />
      <Routes>
        <Route path="/workhub" element={<ProtectedWorkhub />} />
        <Route path="/acces-vendeur" element={<AccesVendeurRoute />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  );
}
