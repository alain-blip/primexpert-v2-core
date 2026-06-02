/**
 * Accès Vendeur — données temps réel (contact + résidence liée).
 * Règle #0 : lecture depuis organizations/{orgId}/contacts et residences/{id}.
 */

import { doc, onSnapshot, type Unsubscribe } from 'firebase/firestore';
import {
  assessMandateCompleteness,
  mandateCompletenessPercent,
  resolveVendorTimelineStage,
  type VendorTimelineStageId,
} from '@primexpert/core/residence';
import {
  buildPromesseAchatViewModel,
  parsePromesseAchatFromDoc,
  type PromesseAchatViewModel,
} from '@primexpert/core/transaction';
import type { OrganizationContact } from '@primexpert/core/crm';
import { db } from '../lib/firebase';
import {
  subscribeOrganizationContact,
  type ContactServiceContext,
} from './contacts';
import {
  extractPipelineStatusRaw,
  resolveResidenceStatus,
  type ResidenceStatus,
} from '../config/pipelineStages';
import type { FinancialDataV2Doc } from '@primexpert/core/financial';
import type { MandateCompletenessResult } from '@primexpert/core/residence';
import type { Residence } from './residences';

export interface VendorPortalViewModel {
  contact: OrganizationContact;
  residenceId: string;
  propertyLabel: string;
  pipelineStatus: ResidenceStatus;
  timelineStageId: VendorTimelineStageId;
  mandatePercent: number;
  mandateResult: MandateCompletenessResult;
  promesse: PromesseAchatViewModel | null;
  hasActivePromesse: boolean;
  brokerId: string;
  residenceDoc: Record<string, unknown>;
}

function resolvePropertyLabel(data: Record<string, unknown>, fallback: string): string {
  const name =
    (typeof data.name === 'string' && data.name.trim()) ||
    (typeof data.nom === 'string' && data.nom.trim()) ||
    (typeof data.residenceName === 'string' && data.residenceName.trim()) ||
    '';
  if (name) return name;
  const address = typeof data.address === 'string' ? data.address.trim() : '';
  const city = typeof data.city === 'string' ? data.city.trim() : '';
  if (address && city) return `${address}, ${city}`;
  if (address) return address;
  return fallback;
}

function buildViewModel(
  contact: OrganizationContact,
  residenceId: string,
  residenceData: Record<string, unknown>
): VendorPortalViewModel | null {
  const brokerId = String(residenceData.courtiersResponsables ?? contact.ownerId ?? '');
  if (!brokerId) return null;

  const pipelineStatus = resolveResidenceStatus(extractPipelineStatusRaw(residenceData));
  const timelineStageId = resolveVendorTimelineStage(pipelineStatus, residenceData);
  const mandateResult = assessMandateCompleteness(residenceData);
  const mandatePercent = mandateCompletenessPercent(residenceData);
  const promesseInput = parsePromesseAchatFromDoc(residenceData);
  const promesse = buildPromesseAchatViewModel(promesseInput);
  const hasActivePromesse =
    timelineStageId === 'promesse_en_cours' &&
    (promesseInput.status === 'accepted' || promesseInput.status === 'received');

  return {
    contact,
    residenceId,
    propertyLabel: resolvePropertyLabel(residenceData, residenceId),
    pipelineStatus,
    timelineStageId,
    mandatePercent,
    mandateResult,
    promesse: hasActivePromesse ? promesse : null,
    hasActivePromesse,
    brokerId,
    residenceDoc: residenceData,
  };
}

/** Adaptateur minimal Residence pour réutiliser les onglets fiche (Identité, Finance). */
export function vendorPortalResidenceAdapter(
  vm: Pick<VendorPortalViewModel, 'residenceId' | 'residenceDoc' | 'pipelineStatus' | 'brokerId'>
): Residence {
  const doc = vm.residenceDoc;
  const priceRaw = doc.price ?? doc.prixDemande ?? doc.askingPrice ?? 0;
  const price = typeof priceRaw === 'number' ? priceRaw : Number(priceRaw) || 0;
  return {
    id: vm.residenceId,
    address: typeof doc.address === 'string' ? doc.address : '',
    city: typeof doc.city === 'string' ? doc.city : '',
    price,
    status: vm.pipelineStatus as ResidenceStatus,
    date: '',
    courtiersResponsables: vm.brokerId,
    residenceName:
      (typeof doc.name === 'string' && doc.name) ||
      (typeof doc.residenceName === 'string' && doc.residenceName) ||
      undefined,
    nombreUnitesTotal:
      typeof doc.nombreUnitesTotal === 'number' ? doc.nombreUnitesTotal : undefined,
    unitesRPA: typeof doc.unitesRPA === 'number' ? doc.unitesRPA : undefined,
    region: typeof doc.region === 'string' ? doc.region : undefined,
    residenceType:
      (typeof doc.residenceType === 'string' && doc.residenceType) ||
      (typeof doc.type === 'string' && doc.type) ||
      undefined,
  };
}

export interface SubscribeVendorPortalInput {
  ctx: ContactServiceContext;
  contactId: string;
  residenceId?: string;
  onUpdate: (vm: VendorPortalViewModel | null) => void;
  onError?: (err: Error) => void;
}

/**
 * Écoute le contact et la résidence active (temps réel).
 * La résidence est choisie via residenceId ou la première entrée de contact.residenceIds.
 */
export function subscribeVendorPortal(input: SubscribeVendorPortalInput): Unsubscribe {
  const { ctx, contactId, residenceId: preferredResidenceId, onUpdate, onError } = input;
  let residenceUnsub: Unsubscribe | null = null;
  let latestContact: OrganizationContact | null = null;
  let activeResidenceId: string | null = preferredResidenceId ?? null;

  const teardownResidence = () => {
    residenceUnsub?.();
    residenceUnsub = null;
  };

  const bindResidence = (resId: string) => {
    if (activeResidenceId === resId && residenceUnsub) return;
    teardownResidence();
    activeResidenceId = resId;
    if (!resId || !latestContact) {
      onUpdate(null);
      return;
    }
    residenceUnsub = onSnapshot(
      doc(db, 'residences', resId),
      (snap) => {
        if (!snap.exists() || !latestContact) {
          onUpdate(null);
          return;
        }
        const vm = buildViewModel(latestContact, resId, snap.data() as Record<string, unknown>);
        onUpdate(vm);
      },
      (err) => {
        console.error('[vendorPortal] residence subscribe failed', err);
        onError?.(err as Error);
        onUpdate(null);
      }
    );
  };

  const contactUnsub = subscribeOrganizationContact(
    ctx,
    contactId,
    (contact) => {
      latestContact = contact;
      if (!contact) {
        teardownResidence();
        onUpdate(null);
        return;
      }

      const ids = contact.residenceIds ?? [];
      const nextResId =
        preferredResidenceId && ids.includes(preferredResidenceId)
          ? preferredResidenceId
          : ids[0] ?? null;

      if (!nextResId) {
        teardownResidence();
        onUpdate(null);
        return;
      }
      bindResidence(nextResId);
    },
    onError
  );

  return () => {
    contactUnsub();
    teardownResidence();
  };
}

/** Jetons d'accès fantôme publics (One Pager — sans Firestore). */
export const GHOST_VENDOR_PORTAL_TOKEN_RESIDENTIAL = 'demo-visiteur-residentiel';
export const GHOST_VENDOR_PORTAL_TOKEN_COMMERCIAL = 'demo-visiteur-commercial';

export type GhostVendorPortalProfile = 'residential' | 'commercial';

const GHOST_BROKER_ID = 'ghost-broker-demo';
const GHOST_ORG_ID = 'ghost-demo-org';

export function resolveGhostVendorPortalProfile(token: string): GhostVendorPortalProfile | null {
  if (token === GHOST_VENDOR_PORTAL_TOKEN_RESIDENTIAL) return 'residential';
  if (token === GHOST_VENDOR_PORTAL_TOKEN_COMMERCIAL) return 'commercial';
  return null;
}

export function isGhostVendorPortalToken(token: string): boolean {
  return resolveGhostVendorPortalProfile(token) != null;
}

function ghostResidentialContact(): OrganizationContact {
  return {
    id: 'ghost-contact-residentiel',
    orgId: GHOST_ORG_ID,
    ownerId: GHOST_BROKER_ID,
    silo: 'RESIDENTIEL',
    visibility: 'PRIVATE',
    leadSource: 'BROKER_GENERATED',
    nom: 'Tremblay',
    prenom: 'Sophie',
    relationRoles: ['seller'],
    residenceIds: ['ghost-residence-residentiel'],
    email: 'sophie.tremblay@exemple.ca',
    telephone: '514-555-0142',
  };
}

function ghostCommercialContact(): OrganizationContact {
  return {
    id: 'ghost-contact-commercial',
    orgId: GHOST_ORG_ID,
    ownerId: GHOST_BROKER_ID,
    silo: 'RES_COM',
    visibility: 'PRIVATE',
    leadSource: 'BROKER_GENERATED',
    nom: 'Groupe Laval',
    prenom: 'Investissements',
    relationRoles: ['seller'],
    residenceIds: ['ghost-residence-commercial'],
    email: 'contact@investissements-laval.ca',
    telephone: '514-555-0198',
  };
}

function ghostResidentialPromesseStressDates(): {
  dateReception: string;
  dateAcceptation: string;
  delais: {
    visiteLieuxJours: number;
    verificationDocumentsJours: number;
    inspectionJours: number;
    financementJours: number;
    permisJours: number;
  };
} {
  const now = new Date();
  const toIso = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };
  const addDays = (base: Date, days: number) => {
    const d = new Date(base);
    d.setDate(d.getDate() + days);
    return d;
  };
  /** Stress-test J-3 : délai de financement bancaire dans exactement 3 jours civils. */
  const financeDeadline = addDays(now, 3);
  const dateAcceptation = addDays(now, -18);
  const acceptanceMs = new Date(`${toIso(dateAcceptation)}T12:00:00`).getTime();
  const financementJours = Math.max(
    1,
    Math.round((financeDeadline.getTime() - acceptanceMs) / 86_400_000)
  );
  return {
    dateReception: toIso(addDays(now, -21)),
    dateAcceptation: toIso(dateAcceptation),
    delais: {
      visiteLieuxJours: 5,
      verificationDocumentsJours: 7,
      inspectionJours: 10,
      financementJours,
      permisJours: 30,
    },
  };
}

function ghostResidentialResidenceDoc(): Record<string, unknown> {
  const promesseDates = ghostResidentialPromesseStressDates();
  return {
    name: 'Maison unifamiliale — Saint-Lambert',
    address: '842, boulevard Saint-Jean',
    city: 'Saint-Lambert',
    region: 'Montérégie',
    prixDemande: 875_000,
    residenceType: 'unifamilial',
    pipelineStatus: 'pa-acceptee',
    courtiersResponsables: GHOST_BROKER_ID,
    promesseAchat: {
      status: 'accepted',
      prixOffert: 875_000,
      prixAccepte: 875_000,
      delaiReponseJours: 3,
      ...promesseDates,
    },
  };
}

function ghostCommercialResidenceDoc(): Record<string, unknown> {
  return {
    name: 'Immeuble à revenus — 6 logements, Plateau-Mont-Royal',
    address: '4550, avenue du Parc',
    city: 'Montréal',
    region: 'Montréal',
    prixDemande: 1_890_000,
    nombreUnitesTotal: 6,
    residenceType: 'plex',
    pipelineStatus: 'mandate',
    courtiersResponsables: GHOST_BROKER_ID,
    acmValeurEstimee: 1_925_000,
    acmFourchetteBasse: 1_860_000,
    acmFourchetteHaute: 1_990_000,
  };
}

/** ViewModel mock — court-circuite Firestore pour les jetons démo publics. */
export function buildGhostVendorPortalViewModel(
  profile: GhostVendorPortalProfile
): VendorPortalViewModel {
  const contact =
    profile === 'residential' ? ghostResidentialContact() : ghostCommercialContact();
  const residenceId =
    profile === 'residential' ? 'ghost-residence-residentiel' : 'ghost-residence-commercial';
  const residenceDoc =
    profile === 'residential'
      ? ghostResidentialResidenceDoc()
      : ghostCommercialResidenceDoc();

  const pipelineStatus = resolveResidenceStatus(
    extractPipelineStatusRaw(residenceDoc)
  );
  const timelineStageId = resolveVendorTimelineStage(pipelineStatus, residenceDoc);
  const mandateResult = assessMandateCompleteness(residenceDoc);
  const mandatePercent = mandateCompletenessPercent(residenceDoc);
  const promesseInput = parsePromesseAchatFromDoc(residenceDoc);
  const promesse = buildPromesseAchatViewModel(promesseInput);
  const hasActivePromesse =
    profile === 'residential' &&
    timelineStageId === 'promesse_en_cours' &&
    promesseInput.status === 'accepted';

  return {
    contact,
    residenceId,
    propertyLabel: resolvePropertyLabel(residenceDoc, residenceId),
    pipelineStatus,
    timelineStageId,
    mandatePercent,
    mandateResult,
    promesse: hasActivePromesse ? promesse : null,
    hasActivePromesse,
    brokerId: GHOST_BROKER_ID,
    residenceDoc,
  };
}

/** Données financières mock (profil commercial — TGA, RNE, financement). */
export function getGhostFinancialData(
  profile: GhostVendorPortalProfile
): FinancialDataV2Doc | null {
  if (profile !== 'commercial') return null;

  const revenuBrutEffectif = 198_000;
  const depensesTotalesNormalisees = 56_000;
  const revenuNetExploitation = revenuBrutEffectif - depensesTotalesNormalisees;
  const tauxCapitalisation = 5.75;
  const valeurCapitalisation = Math.round(revenuNetExploitation / (tauxCapitalisation / 100));
  const prixDemande = 1_890_000;
  const ratioCouvertureDette = 1.24;
  const paiementAnnuelDette = Math.round(revenuNetExploitation / ratioCouvertureDette);

  return {
    calculatedResults: {
      revenuBrutEffectif,
      depensesTotalesNormalisees,
      revenuNetExploitation,
      tauxCapitalisation,
      valeurCapitalisation,
      prixDemande,
      ratioCouvertureDette,
      hypothequeMaxRecommandee: 1_512_000,
      miseDeFondsRequise: prixDemande - 1_512_000,
      nombreUnites: 6,
      prixParUnite: Math.round(prixDemande / 6),
      paiementAnnuel: paiementAnnuelDette,
      cashFlow: revenuNetExploitation - paiementAnnuelDette,
    },
    baseData: {
      revenusAnnuels: revenuBrutEffectif,
      nombreUnites: 6,
      financement: {
        programmeSchl: 'schl_standard',
        categorieBien: 'multilogement_regulier',
      },
    },
  };
}
