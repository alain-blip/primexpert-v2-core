/**
 * Charte tableaux blancs V2 — tokens primexpert-* (SSOT : tailwind.config.js).
 */

export const INSTITUTIONAL_INK = '#142c6a';
export const INSTITUTIONAL_PANEL_BG = '#2656b7';
export const INSTITUTIONAL_PANEL_BG_DARK = '#001b42';
export const INSTITUTIONAL_LIGHT = '#f1f5f9';
export const INSTITUTIONAL_CARD_DARK = '#daeefa';
export const INSTITUTIONAL_GOLD = '#D4AF37';

/** Conteneur bleu institutionnel (ex. Suivi des dossiers, Priorités). */
export const institutionalPanelShellClass =
  'rounded-2xl bg-primexpert-blue p-6 dark:bg-primexpert-blueDeep';

export const institutionalPanelTitleClass =
  'text-xl font-black text-white tracking-tight';

export const institutionalPanelSubtitleClass =
  'text-sm text-white/90 mt-2 leading-relaxed max-w-3xl';

/** Carte blanche encadrée (liste, fiche, ligne de tableau). */
export const institutionalWhiteCardClass =
  'bg-white dark:bg-primexpert-cardDark border-2 border-primexpert-dark border-l-[8px] rounded-xl shadow-xl overflow-hidden';

export const institutionalWhiteCardCompactClass =
  'bg-white dark:bg-primexpert-cardDark border-2 border-primexpert-dark border-l-[8px] rounded-xl shadow-md px-4 py-3 space-y-2';

export const institutionalInkTextClass = 'text-primexpert-dark';

export const institutionalSectionWhiteClass =
  'rounded-[28px] border-2 border-primexpert-dark bg-white dark:bg-primexpert-cardDark p-7 shadow-xl';

export const institutionalStatusBannerClass =
  'w-full bg-primexpert-dark text-white text-[12px] font-black uppercase tracking-widest px-4 py-2 rounded mb-4';

export const institutionalBadgeProgressionClass =
  'inline-block min-w-[150px] text-center px-3 py-1 bg-primexpert-light text-primexpert-dark text-[11px] font-black tracking-wider uppercase rounded mr-3 shrink-0';

export const institutionalBadgeActionClass =
  'inline-block min-w-[150px] text-center px-3 py-1 bg-primexpert-dark text-white text-[11px] font-black tracking-wider uppercase rounded mr-3 shrink-0';

export const institutionalBadgeSuggestionClass =
  'inline-block min-w-[150px] text-center px-3 py-1 bg-amber-100 text-amber-950 border-2 border-primexpert-gold text-[11px] font-black tracking-wider uppercase rounded mr-3 shrink-0';

export const institutionalPrimaryButtonClass =
  'rounded-lg border-2 border-primexpert-dark px-3 py-1.5 text-[11px] font-semibold text-primexpert-dark hover:bg-primexpert-dark/5 transition';

/**
 * Charte "Mes inscriptions" — classes partagées pour unifier les onglets CRM.
 * On enrichit / on étend / on modifie l’existant — aucune duplication autorisée.
 */
export const institutionalListingsPanelClass =
  'rounded-2xl bg-primexpert-blue dark:bg-primexpert-blueDeep p-6 space-y-6';

export const institutionalListingsCardShellClass =
  'overflow-hidden rounded-xl border-2 border-primexpert-dark bg-white dark:bg-primexpert-cardDark shadow-xl';

export const institutionalListingsCardHeaderClass =
  'border-b-2 border-primexpert-dark/15 bg-primexpert-light dark:bg-primexpert-cardDark px-5 py-3';

export const institutionalListingsCardTitleClass =
  'text-[12px] font-black uppercase tracking-wider text-primexpert-dark';

export const institutionalListingsInlineInputClass =
  'w-full rounded-lg border-2 border-primexpert-dark/20 bg-white dark:bg-primexpert-cardDark px-3 py-2 text-[14px] font-semibold text-black outline-none focus:border-primexpert-dark';

export const institutionalListingsActionButtonClass =
  'rounded-lg border-2 border-primexpert-dark bg-primexpert-dark px-4 py-2 text-[12px] font-black uppercase tracking-wider text-white hover:bg-primexpert-blue';

export const institutionalListingsSecondaryButtonClass =
  'rounded-lg border-2 border-primexpert-dark/20 bg-white dark:bg-primexpert-cardDark px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-slate-900 hover:bg-primexpert-light transition';

export const institutionalListingsSecondaryDangerButtonClass =
  'rounded-lg border-2 border-red-300 bg-red-50 dark:bg-red-100 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-red-800 hover:bg-red-100 transition';

export const institutionalListingsFailSafeClass =
  'rounded-xl border-2 border-dashed border-primexpert-dark/35 bg-primexpert-light dark:bg-primexpert-cardDark px-4 py-4';

/** Accès Vendeur — largeur alignée onglets Finances / Identité. */
export const vendorPortalLayoutShellClass = 'mx-auto w-full max-w-5xl px-4';
