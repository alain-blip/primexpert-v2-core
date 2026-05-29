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
import type { MandateCompletenessResult } from '@primexpert/core/residence';
import type { Residence } from './residences';
import type { ResidenceStatus } from '../config/pipelineStages';

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
