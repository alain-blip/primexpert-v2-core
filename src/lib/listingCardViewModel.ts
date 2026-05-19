/**
 * ViewModel carte inscription — en-tête nom + 2 lignes KISS (sans PROGRESSION).
 */

import { formatCurrency } from './utils';
import type { Residence, ResidenceStatus } from '../services/residences';

export interface ListingCardViewModel {
  residenceName: string;
  askingPriceLabel: string;
  addressLine: string;
  commissionRateLabel: string;
  potentialRevenueLabel: string;
  statusBannerLabel: string;
  statusBannerClass: string;
  borderShellClass: string;
  headerTintClass: string;
  suggestionIA: string;
}

const STATUS_BANNER_CLASS =
  'w-full bg-primexpert-dark text-white text-[11px] font-black uppercase tracking-wide py-2 px-2 rounded';

const STATUS_BANNER_GOLD_CLASS =
  'w-full bg-primexpert-gold text-black text-[11px] font-black uppercase tracking-wide py-2 px-2 rounded';

const MISSING_COMMERCIAL_NAME_FR = '⚠️ SANS NOM COMMERCIAL';
const MISSING_COMMERCIAL_NAME_EN = 'RPA À NOMMER';

type ListingIdentitySource = Residence & Record<string, unknown>;

function firstText(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value !== 'string') continue;
    const trimmed = value.trim();
    if (trimmed && trimmed !== '—') return trimmed;
  }
  return null;
}

function firstNumber(...values: unknown[]): number | null {
  for (const value of values) {
    if (typeof value === 'number' && Number.isFinite(value) && value >= 0) return value;
    if (typeof value !== 'string') continue;
    const cleaned = value.trim().replace(/\s/g, '').replace(/[^\d.,-]/g, '').replace(',', '.');
    const parsed = Number(cleaned);
    if (Number.isFinite(parsed) && parsed >= 0) return parsed;
  }
  return null;
}

function formatPercent(value: number | null): string {
  if (value == null) return '—';
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
}

function residenceIdentity(residence: ListingIdentitySource): {
  residenceName: string;
  askingPriceLabel: string;
  addressLine: string;
} {
  const addr = firstText(residence.address, residence.adresse) ?? '—';
  const city = residence.city?.trim();
  const cityLabel = city && city !== '—' ? city : '';
  const residenceName =
    firstText(
      residence.residenceName,
      residence.commercialName,
      residence.nomCommercial,
      residence.nom_commercial,
      residence.name,
      residence.nomResidence,
      residence.nom
    ) ?? (residence.status === 'mandate' || residence.status === 'promise'
      ? MISSING_COMMERCIAL_NAME_FR
      : MISSING_COMMERCIAL_NAME_EN);
  const askingPrice =
    firstNumber(
      residence.askingPrice,
      residence.prixDemande,
      residence.prixListe,
      residence.listPrice,
      residence.price
    ) ?? 0;
  const commissionRate = firstNumber(
    residence.commissionRate,
    residence.tauxCommission,
    residence.commissionPct,
    (residence.commission as Record<string, unknown> | undefined)?.totalePct,
    (residence.commission as Record<string, unknown> | undefined)?.inscripteurPct
  );
  const explicitPotentialRevenue = firstNumber(
    residence.potentialRevenue,
    residence.revenuPotentiel,
    residence.revenuPotentielCommission,
    residence.revenuPotentielAnnuel,
    residence.revenusPotentiels
  );
  const calculatedPotentialRevenue =
    explicitPotentialRevenue ?? (commissionRate != null ? askingPrice * (commissionRate / 100) : null);

  return {
    residenceName,
    askingPriceLabel: formatCurrency(askingPrice),
    addressLine: cityLabel ? `${addr}, ${cityLabel}` : addr,
    commissionRateLabel: formatPercent(commissionRate),
    potentialRevenueLabel: calculatedPotentialRevenue != null ? formatCurrency(calculatedPotentialRevenue) : '—',
  };
}

function statusBannerFor(status: ResidenceStatus, lang: 'fr' | 'en'): string {
  const map: Record<ResidenceStatus, { fr: string; en: string }> = {
    mandate: {
      fr: 'INSCRIPTION ACTIVE — MANDAT EN VIGUEUR',
      en: 'ACTIVE LISTING — MANDATE ON MARKET',
    },
    promise: {
      fr: 'INSCRIPTION ACTIVE — PA ACCEPTÉE',
      en: 'ACTIVE LISTING — ACCEPTED PP',
    },
    prospect: {
      fr: 'PROSPECTION — MANDAT EN PRÉPARATION',
      en: 'PROSPECTING — MANDATE IN PREPARATION',
    },
    sold: {
      fr: 'VENDU — TRANSACTION CLÔTURÉE',
      en: 'SOLD — TRANSACTION CLOSED',
    },
    expired: {
      fr: 'MANDAT EXPIRÉ',
      en: 'EXPIRED MANDATE',
    },
    unsigned: {
      fr: 'NON SIGNÉ — EN ATTENTE',
      en: 'UNSIGNED — PENDING',
    },
  };
  const row = map[status] ?? map.mandate;
  return lang === 'fr' ? row.fr : row.en;
}

/** Texte fixe de suggestion IA (charte inscriptions actives). */
export function listingCardSuggestion(lang: 'fr' | 'en'): string {
  if (lang === 'fr') {
    return '💡 Consolider visites, appels et courriels sur la fiche Intelligence.';
  }
  return '💡 Consolidate visits, calls, and emails on the Intelligence tab.';
}

export function buildListingCardViewModel(
  residence: Residence,
  options: { language: 'fr' | 'en' }
): ListingCardViewModel {
  const lang = options.language === 'fr' ? 'fr' : 'en';
  const suggestionIA = listingCardSuggestion(lang);
  const identity = residenceIdentity(residence as ListingIdentitySource);

  let borderShellClass = 'border-primexpert-dark border-l-primexpert-dark';
  let statusBannerClass = STATUS_BANNER_CLASS;
  let headerTintClass = 'bg-primexpert-light';

  switch (residence.status) {
    case 'mandate':
    case 'prospect':
      borderShellClass = 'border-primexpert-dark border-l-black';
      break;
    case 'promise':
      borderShellClass = 'border-primexpert-gold border-l-primexpert-gold';
      statusBannerClass = STATUS_BANNER_GOLD_CLASS;
      headerTintClass = 'bg-amber-50/90';
      break;
    case 'sold':
      headerTintClass = 'bg-slate-100';
      break;
    case 'expired':
      borderShellClass = 'border-slate-400 border-l-slate-500';
      headerTintClass = 'bg-slate-50';
      break;
    case 'unsigned':
      borderShellClass = 'border-slate-300 border-l-slate-400';
      break;
    default:
      break;
  }

  return {
    residenceName: identity.residenceName,
    askingPriceLabel: identity.askingPriceLabel,
    addressLine: identity.addressLine,
    commissionRateLabel: identity.commissionRateLabel,
    potentialRevenueLabel: identity.potentialRevenueLabel,
    statusBannerLabel: statusBannerFor(residence.status, lang),
    statusBannerClass,
    borderShellClass,
    headerTintClass,
    suggestionIA,
  };
}
