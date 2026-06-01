/**
 * AppResponsiveLayout — coque SPA V2.8 (workhub uniquement, jamais routes publiques `/` `/login`).
 */

import React, { useMemo } from 'react';
import { cn } from '../../lib/utils';
import { COCKPIT_SURFACE_BG } from '../../lib/responsiveLayoutTokens';
import { useResponsiveLayoutMode } from '../../hooks/useResponsiveLayoutMode';
import {
  ResponsiveLayoutContext,
  buildResponsiveLayoutContextValue,
  useResponsiveLayout,
} from './ResponsiveLayoutContext';

export interface AppResponsiveLayoutProps {
  navigation?: React.ReactNode;
  header?: React.ReactNode;
  children: React.ReactNode;
  secondaryPanel?: React.ReactNode;
  assistantPanel?: React.ReactNode;
  footer?: React.ReactNode;
  bottomNavigation?: React.ReactNode;
  shell?: boolean;
  className?: string;
}

const shellClassName =
  'relative flex h-[100dvh] max-h-[100dvh] w-full overflow-hidden font-sans text-sm text-slate-100 selection:bg-blue-500/30';

function AppResponsiveLayoutChrome({
  navigation,
  header,
  children,
  secondaryPanel,
  assistantPanel,
  footer,
  bottomNavigation,
  shell = true,
  className,
}: AppResponsiveLayoutProps) {
  const { mode, isMobile, isTablet, isLaptop } = useResponsiveLayout();

  if (!shell) {
    return (
      <div className={cn('flex min-h-0 min-w-0 flex-1 flex-col w-full', className)}>
        {children}
      </div>
    );
  }

  const showMobileBottomNav = Boolean(bottomNavigation);

  if (isMobile) {
    return (
      <div
        className={cn(shellClassName, className)}
        style={{ backgroundColor: COCKPIT_SURFACE_BG }}
        data-layout-mode={mode}
      >
        <div
          aria-hidden
          className="pointer-events-none fixed inset-0 -z-10 app-bg opacity-90"
        />

        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          {header ? (
            <header className="app-chrome-bar sticky top-0 z-30 shrink-0 backdrop-blur-md">
              {header}
            </header>
          ) : null}

          <main
            className={cn(
              'custom-scrollbar flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto bg-transparent',
              showMobileBottomNav &&
                'pb-[calc(4.5rem+env(safe-area-inset-bottom))]'
            )}
            id="app-responsive-main"
          >
            {children}
          </main>
        </div>

        {showMobileBottomNav ? (
          <nav
            className="fixed bottom-0 left-0 right-0 z-50 border-t border-white/10 bg-[#0B0F19]/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl"
            aria-label="Navigation mobile"
          >
            {bottomNavigation}
          </nav>
        ) : null}
      </div>
    );
  }

  return (
    <div
      className={cn(shellClassName, className)}
      style={{ backgroundColor: COCKPIT_SURFACE_BG }}
      data-layout-mode={mode}
    >
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10 app-bg opacity-90"
      />

      {navigation ? (
        <aside
          className={cn(
            'app-aside relative z-40 flex h-full max-h-full shrink-0 flex-col overflow-hidden backdrop-blur-md text-white',
            isTablet && 'w-[80px] min-w-[80px] max-w-[80px]',
            isLaptop && 'w-[218px] min-w-[218px]'
          )}
          aria-label="Navigation principale"
        >
          <div
            aria-hidden
            className="app-aside-glow pointer-events-none absolute inset-0"
          />
          <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
            {navigation}
          </div>
        </aside>
      ) : null}

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        {header ? (
          <header className="app-chrome-bar sticky top-0 z-30 shrink-0 backdrop-blur-md">
            {header}
          </header>
        ) : null}

        <div
          className={cn(
            'flex min-h-0 flex-1',
            isTablet && secondaryPanel && 'flex-row',
            isLaptop && 'flex-row'
          )}
        >
          <main
            className={cn(
              'custom-scrollbar flex min-h-0 min-w-0 flex-col overflow-y-auto bg-transparent',
              isTablet && !secondaryPanel && 'flex-1',
              isTablet && secondaryPanel && 'flex-1 border-r border-white/10',
              isLaptop && 'flex-1'
            )}
            id="app-responsive-main"
          >
            {children}
          </main>

          {isTablet && secondaryPanel ? (
            <aside
              className="custom-scrollbar w-[min(42vw,420px)] shrink-0 overflow-y-auto border-l border-white/10 bg-black/20"
              aria-label="Panneau contextuel"
            >
              {secondaryPanel}
            </aside>
          ) : null}
        </div>

        {footer ? (
          <footer className="app-chrome-bar shrink-0 backdrop-blur-md">{footer}</footer>
        ) : null}
      </div>

      {isLaptop && assistantPanel ? (
        <aside
          className="app-assistant relative z-30 flex w-[min(360px,28vw)] min-w-[300px] max-w-[400px] shrink-0 flex-col overflow-hidden border-l-2 border-primexpert-dark text-white"
          aria-label="Assistant IA"
        >
          {assistantPanel}
        </aside>
      ) : null}
    </div>
  );
}

/**
 * Layout adaptatif workhub — détection viewport montée ici uniquement (chunk lazy).
 */
export function AppResponsiveLayout(props: AppResponsiveLayoutProps) {
  const mode = useResponsiveLayoutMode();
  const layoutValue = useMemo(() => buildResponsiveLayoutContextValue(mode), [mode]);

  return (
    <ResponsiveLayoutContext.Provider value={layoutValue}>
      <AppResponsiveLayoutChrome {...props} />
    </ResponsiveLayoutContext.Provider>
  );
}
