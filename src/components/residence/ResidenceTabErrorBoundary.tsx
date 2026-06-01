/**
 * Attrape les erreurs de rendu React dans les onglets fiche résidence (évite écran noir).
 */

import React, { Component, type ErrorInfo, type ReactNode } from 'react';

export interface ResidenceTabErrorBoundaryProps {
  tabLabel: string;
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export class ResidenceTabErrorBoundary extends Component<
  ResidenceTabErrorBoundaryProps,
  State
> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[ResidenceTabErrorBoundary]', this.props.tabLabel, error, info.componentStack);
  }

  render(): ReactNode {
    if (this.state.error) {
      return (
        <div
          role="alert"
          className="rounded-xl border-2 border-red-400 bg-red-50 px-6 py-8 text-red-950"
        >
          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-red-800">
            Erreur de rendu — {this.props.tabLabel}
          </p>
          <p className="mt-3 text-sm font-semibold leading-relaxed">{this.state.error.message}</p>
          <button
            type="button"
            className="mt-4 rounded-lg border border-red-300 bg-white px-4 py-2 text-xs font-bold uppercase tracking-wide text-red-900 hover:bg-red-100"
            onClick={() => this.setState({ error: null })}
          >
            Réessayer
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
