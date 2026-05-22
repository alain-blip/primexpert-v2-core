import React, { useEffect, useMemo, useRef, useState } from 'react';
import { X, Upload } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useLanguage } from '../../lib/i18n';
import {
  CONTACT_ASSET_NICHES,
  CONTACT_LCI_FIELD_LABEL_FR,
  CONTACT_RELATION_ROLES,
  CONTACT_ROLE_LABEL_EN,
  CONTACT_ROLE_LABEL_FR,
  CONTACT_SILOS,
  CONTACT_SILO_LABEL_EN,
  CONTACT_SILO_LABEL_FR,
  CONTACT_VISIBILITY,
  BUYER_ACQUISITION_TIMELINES,
  BUYER_TARGET_RESIDENCE_TYPES,
  PROFESSIONAL_TYPES,
  PROFESSIONAL_TYPE_LABEL_EN,
  PROFESSIONAL_TYPE_LABEL_FR,
  defaultContactSiloForRoles,
  defaultContactVisibility,
  isAgencyShareAllowedForContact,
  validateContactLciFields,
  resolveContactLegalCompliance,
  type ContactAssetNiche,
  type ContactBuyerCriteria,
  type ContactSellerCriteria,
  type ContactCommunicationPreferences,
  type ContactCriteriaDocumentRef,
  type ContactBuyerDocumentKind,
  type ContactSellerDocumentKind,
  type BuyerTargetResidenceType,
  type ContactLciFieldKey,
  type ContactRelationRole,
  type ContactSilo,
  type ContactSolicitationStatut,
  type ContactVerificationMode,
  type ContactVisibility,
  type OrganizationContact,
} from '@primexpert/core/crm';
import {
  createOrganizationContact,
  listOrganizationBrokers,
  updateOrganizationContact,
  uploadContactIdProof,
  type CreateOrganizationContactInput,
} from '../../services/contacts';
import { useAuth } from '../../lib/auth';
import type { ContactServiceContext } from '../../services/contacts';
import { ContactLegalComplianceHeader } from './ContactLegalComplianceHeader';
import { BuyerTierBadge } from './BuyerTierBadge';
import {
  BuyerCriteriaDocumentsSection,
  buildStandardBuyerDocumentRows,
} from './BuyerCriteriaDocumentsSection';
import { CoBuyersSection } from './CoBuyersSection';
import { CoSellersSection } from './CoSellersSection';
import { ManagedBuyersSection } from './ManagedBuyersSection';
import {
  SellerCriteriaDocumentsSection,
  buildStandardSellerDocumentRows,
} from './SellerCriteriaDocumentsSection';
import { buildContactTimeline } from '../../services/communicationTimelineService';
import { IntelligenceChronologie } from '../intelligence/IntelligenceChronologie';
import type { UnifiedTimelineEvent } from '@primexpert/core/intelligence';
import { institutionalInkTextClass, institutionalPanelTitleClass } from '../../lib/institutionalTheme';

export interface ContactFormDrawerProps {
  open: boolean;
  onClose: () => void;
  ctx: ContactServiceContext;
  editing?: OrganizationContact | null;
  onSaved: () => void;
}

export function ContactFormDrawer({
  open,
  onClose,
  ctx,
  editing,
  onSaved,
}: ContactFormDrawerProps) {
  const { t, language } = useLanguage();
  const { profile } = useAuth();
  const isFr = language === 'fr';
  const isAdmin =
    profile?.role === 'admin' || profile?.role === 'admin_system';

  const [nom, setNom] = useState('');
  const [prenom, setPrenom] = useState('');
  const [dateNaissance, setDateNaissance] = useState('');
  const [occupationProfession, setOccupationProfession] = useState('');
  const [ligne1, setLigne1] = useState('');
  const [ville, setVille] = useState('');
  const [codePostal, setCodePostal] = useState('');
  const [province, setProvince] = useState('QC');
  const [email, setEmail] = useState('');
  const [telephone, setTelephone] = useState('');
  const [silo, setSilo] = useState<ContactSilo>('RESIDENTIEL');
  const [assetNiche, setAssetNiche] = useState<ContactAssetNiche | ''>('');
  const [visibility, setVisibility] = useState<ContactVisibility>('PRIVATE');
  const [roles, setRoles] = useState<Set<ContactRelationRole>>(new Set());
  const [lciErrors, setLciErrors] = useState<ContactLciFieldKey[]>([]);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [timelineEvents, setTimelineEvents] = useState<UnifiedTimelineEvent[]>([]);
  const [timelineLoading, setTimelineLoading] = useState(false);
  const [verificationMode, setVerificationMode] = useState<ContactVerificationMode | ''>('');
  const [capaciteJuridiqueValidee, setCapaciteJuridiqueValidee] = useState(false);
  const [statutSollicitation, setStatutSollicitation] =
    useState<ContactSolicitationStatut>('NON_VERIFIE');
  const [idDocumentUrl, setIdDocumentUrl] = useState<string | undefined>();
  const [uploadPending, setUploadPending] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [buyerBudgetMax, setBuyerBudgetMax] = useState('');
  const [buyerRegions, setBuyerRegions] = useState('');
  const [buyerTgaMinimum, setBuyerTgaMinimum] = useState('');
  const [buyerCriteriaDraft, setBuyerCriteriaDraft] = useState<ContactBuyerCriteria>({});
  const [coBuyerIds, setCoBuyerIds] = useState<string[]>([]);
  const [corporateIsMandatory, setCorporateIsMandatory] = useState(false);
  const [corporateCompanyName, setCorporateCompanyName] = useState('');
  const [corporateReqNumber, setCorporateReqNumber] = useState('');
  const [sellerCriteriaDraft, setSellerCriteriaDraft] = useState<ContactSellerCriteria>({});
  const [coSellerIds, setCoSellerIds] = useState<string[]>([]);
  const [sellerCorporateIsMandatory, setSellerCorporateIsMandatory] = useState(false);
  const [sellerCorporateCompanyName, setSellerCorporateCompanyName] = useState('');
  const [sellerCorporateReqNumber, setSellerCorporateReqNumber] = useState('');
  const [buyerResidenceTypes, setBuyerResidenceTypes] = useState<Set<BuyerTargetResidenceType>>(
    new Set()
  );
  const [buyerUnitsMin, setBuyerUnitsMin] = useState('');
  const [buyerUnitsMax, setBuyerUnitsMax] = useState('');
  const [buyerExperienceDescription, setBuyerExperienceDescription] = useState('');
  const [buyerHasBroker, setBuyerHasBroker] = useState(false);
  const [buyerTimeline, setBuyerTimeline] = useState('');
  const [buyerDownpaymentAmount, setBuyerDownpaymentAmount] = useState('');
  const [unsubscribedFromEmails, setUnsubscribedFromEmails] = useState(false);
  const [excludedFromMassMailing, setExcludedFromMassMailing] = useState(false);
  const [ownerId, setOwnerId] = useState('');
  const [brokers, setBrokers] = useState<{ uid: string; displayName: string }[]>([]);
  const [brokerAgencyName, setBrokerAgencyName] = useState('');
  const [managedBuyerIds, setManagedBuyerIds] = useState<string[]>([]);
  const [professionalType, setProfessionalType] = useState<ProfessionalType | ''>('');

  const isBuyerRole = roles.has('buyer');
  const isSellerRole = roles.has('seller');
  const isBrokerRole = roles.has('broker');
  const isProfessionalRole = roles.has('professional');

  useEffect(() => {
    if (!open || !ctx.orgId) return;
    void listOrganizationBrokers(ctx.orgId).then((rows) =>
      setBrokers(rows.map((b) => ({ uid: b.uid, displayName: b.displayName })))
    );
  }, [open, ctx.orgId]);

  const previewBuyerCriteria = useMemo((): ContactBuyerCriteria => {
    const criteria: ContactBuyerCriteria = { ...buyerCriteriaDraft };
    const budget = buyerBudgetMax.trim() ? Number(buyerBudgetMax.replace(/\s/g, '')) : NaN;
    if (Number.isFinite(budget) && budget > 0) criteria.budgetMax = budget;
    const tga = buyerTgaMinimum.trim() ? Number(buyerTgaMinimum.replace(',', '.')) : NaN;
    if (Number.isFinite(tga) && tga > 0) criteria.tgaMinimum = tga;
    const regions = buyerRegions
      .split(',')
      .map((r) => r.trim())
      .filter(Boolean);
    if (regions.length) criteria.regions = regions;
    if (buyerResidenceTypes.size) {
      criteria.residenceTypes = Array.from(buyerResidenceTypes);
    }
    const unitsMin = buyerUnitsMin.trim() ? Number(buyerUnitsMin.replace(/\s/g, '')) : NaN;
    if (Number.isFinite(unitsMin) && unitsMin >= 0) criteria.unitsMin = unitsMin;
    const unitsMax = buyerUnitsMax.trim() ? Number(buyerUnitsMax.replace(/\s/g, '')) : NaN;
    if (Number.isFinite(unitsMax) && unitsMax >= 0) criteria.unitsMax = unitsMax;
    const exp = buyerExperienceDescription.trim();
    if (exp) criteria.experienceDescription = exp;
    criteria.hasBroker = buyerHasBroker;
    if (buyerTimeline.trim()) criteria.timeline = buyerTimeline.trim();
    const down = buyerDownpaymentAmount.trim()
      ? Number(buyerDownpaymentAmount.replace(/\s/g, ''))
      : NaN;
    if (Number.isFinite(down) && down >= 0) criteria.downpaymentAmount = down;
    if (corporateIsMandatory || corporateCompanyName.trim() || corporateReqNumber.trim()) {
      criteria.corporateMandate = {
        isMandatory: corporateIsMandatory,
        companyName: corporateCompanyName.trim(),
        reqNumber: corporateReqNumber.trim(),
        ...(criteria.corporateMandate?.reqFile
          ? { reqFile: criteria.corporateMandate.reqFile }
          : {}),
      };
    }
    return criteria;
  }, [
    buyerCriteriaDraft,
    buyerBudgetMax,
    buyerRegions,
    buyerTgaMinimum,
    buyerResidenceTypes,
    buyerUnitsMin,
    buyerUnitsMax,
    buyerExperienceDescription,
    buyerHasBroker,
    buyerTimeline,
    buyerDownpaymentAmount,
    corporateIsMandatory,
    corporateCompanyName,
    corporateReqNumber,
  ]);

  const previewSellerCriteria = useMemo((): ContactSellerCriteria => {
    const criteria: ContactSellerCriteria = { ...sellerCriteriaDraft };
    if (
      sellerCorporateIsMandatory ||
      sellerCorporateCompanyName.trim() ||
      sellerCorporateReqNumber.trim()
    ) {
      criteria.corporateMandate = {
        isMandatory: sellerCorporateIsMandatory,
        companyName: sellerCorporateCompanyName.trim(),
        reqNumber: sellerCorporateReqNumber.trim(),
        ...(criteria.corporateMandate?.reqFile
          ? { reqFile: criteria.corporateMandate.reqFile }
          : {}),
      };
    }
    return criteria;
  }, [
    sellerCriteriaDraft,
    sellerCorporateIsMandatory,
    sellerCorporateCompanyName,
    sellerCorporateReqNumber,
  ]);

  const handleBuyerDocumentUploaded = (kind: ContactBuyerDocumentKind, ref: ContactCriteriaDocumentRef) => {
    setBuyerCriteriaDraft((prev) => {
      const next = { ...prev };
      if (kind === 'nda') next.ndaFile = ref;
      else if (kind === 'proof_of_funds') next.proofOfFundsFile = ref;
      else if (kind === 'bank_letter') next.bankLetterFile = ref;
      else if (kind === 'mortgage_pre_approval') next.mortgagePreApprovalFile = ref;
      else if (kind === 'req') {
        next.corporateMandate = {
          isMandatory: corporateIsMandatory,
          companyName: corporateCompanyName.trim(),
          reqNumber: corporateReqNumber.trim(),
          reqFile: ref,
        };
      }
      return next;
    });
  };

  const handleSellerDocumentUploaded = (kind: ContactSellerDocumentKind, ref: ContactCriteriaDocumentRef) => {
    setSellerCriteriaDraft((prev) => {
      const next = { ...prev };
      if (kind === 'brokerage_contract') next.brokerageContractFile = ref;
      else if (kind === 'ownership_proof') next.ownershipProofFile = ref;
      else if (kind === 'seller_declaration') next.sellerDeclarationFile = ref;
      else if (kind === 'req') {
        next.corporateMandate = {
          isMandatory: sellerCorporateIsMandatory,
          companyName: sellerCorporateCompanyName.trim(),
          reqNumber: sellerCorporateReqNumber.trim(),
          reqFile: ref,
        };
      }
      return next;
    });
  };

  const buildSellerCriteria = (): ContactSellerCriteria | undefined => {
    if (!roles.has('seller')) return undefined;
    return previewSellerCriteria;
  };

  useEffect(() => {
    if (!open || !editing?.id) {
      setTimelineEvents([]);
      return;
    }
    let cancelled = false;
    setTimelineLoading(true);
    void buildContactTimeline(ctx.uid, {
      email: editing.email,
      residenceIds: editing.residenceIds,
    })
      .then((events) => {
        if (!cancelled) setTimelineEvents(events);
      })
      .finally(() => {
        if (!cancelled) setTimelineLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, editing?.id, editing?.email, editing?.residenceIds, ctx.uid]);

  useEffect(() => {
    if (!open) return;
    setLciErrors([]);
    setSubmitError(null);
    if (editing) {
      setNom(editing.nom);
      setPrenom(editing.prenom ?? '');
      setDateNaissance(editing.dateNaissance);
      setOccupationProfession(editing.occupationProfession);
      setLigne1(editing.adresse?.ligne1 ?? '');
      setVille(editing.adresse?.ville ?? '');
      setCodePostal(editing.adresse?.codePostal ?? '');
      setProvince(editing.adresse?.province ?? 'QC');
      setEmail(editing.email ?? '');
      setTelephone(editing.telephone ?? '');
      setSilo(editing.silo);
      setAssetNiche(editing.assetNiche ?? '');
      setVisibility(editing.visibility);
      setRoles(new Set(editing.relationRoles ?? []));
      setVerificationMode(editing.legalVerification?.verificationMode ?? '');
      setCapaciteJuridiqueValidee(editing.legalVerification?.capaciteJuridiqueValidee === true);
      setStatutSollicitation(
        editing.legalVerification?.statutSollicitation ?? 'NON_VERIFIE'
      );
      setIdDocumentUrl(editing.legalVerification?.idDocumentUrl);
      setBuyerCriteriaDraft(editing.buyerCriteria ?? {});
      setCoBuyerIds(editing.coBuyerIds ?? []);
      setCorporateIsMandatory(editing.buyerCriteria?.corporateMandate?.isMandatory === true);
      setCorporateCompanyName(editing.buyerCriteria?.corporateMandate?.companyName ?? '');
      setCorporateReqNumber(editing.buyerCriteria?.corporateMandate?.reqNumber ?? '');
      setBuyerBudgetMax(
        editing.buyerCriteria?.budgetMax != null
          ? String(editing.buyerCriteria.budgetMax)
          : ''
      );
      setBuyerRegions(editing.buyerCriteria?.regions?.join(', ') ?? '');
      setBuyerTgaMinimum(
        editing.buyerCriteria?.tgaMinimum != null
          ? String(editing.buyerCriteria.tgaMinimum)
          : ''
      );
      setBuyerResidenceTypes(
        new Set(editing.buyerCriteria?.residenceTypes ?? [])
      );
      setBuyerUnitsMin(
        editing.buyerCriteria?.unitsMin != null ? String(editing.buyerCriteria.unitsMin) : ''
      );
      setBuyerUnitsMax(
        editing.buyerCriteria?.unitsMax != null ? String(editing.buyerCriteria.unitsMax) : ''
      );
      setBuyerExperienceDescription(editing.buyerCriteria?.experienceDescription ?? '');
      setBuyerHasBroker(editing.buyerCriteria?.hasBroker === true);
      setBuyerTimeline(editing.buyerCriteria?.timeline ?? '');
      setBuyerDownpaymentAmount(
        editing.buyerCriteria?.downpaymentAmount != null
          ? String(editing.buyerCriteria.downpaymentAmount)
          : ''
      );
      setUnsubscribedFromEmails(
        editing.communicationPreferences?.unsubscribedFromEmails === true
      );
      setExcludedFromMassMailing(
        editing.communicationPreferences?.excludedFromMassMailing === true
      );
      setOwnerId(editing.ownerId);
      setSellerCriteriaDraft(editing.sellerCriteria ?? {});
      setCoSellerIds(editing.coSellerIds ?? []);
      setSellerCorporateIsMandatory(
        editing.sellerCriteria?.corporateMandate?.isMandatory === true
      );
      setSellerCorporateCompanyName(
        editing.sellerCriteria?.corporateMandate?.companyName ?? ''
      );
      setSellerCorporateReqNumber(editing.sellerCriteria?.corporateMandate?.reqNumber ?? '');
      setBrokerAgencyName(editing.brokerCriteria?.agencyName ?? '');
      setManagedBuyerIds(editing.brokerCriteria?.managedBuyerIds ?? []);
      setProfessionalType(editing.professionalType ?? '');
    } else {
      setNom('');
      setPrenom('');
      setDateNaissance('');
      setOccupationProfession('');
      setLigne1('');
      setVille('');
      setCodePostal('');
      setProvince('QC');
      setEmail('');
      setTelephone('');
      setSilo('RESIDENTIEL');
      setAssetNiche('');
      setVisibility('PRIVATE');
      setRoles(new Set(['buyer']));
      setVerificationMode('');
      setCapaciteJuridiqueValidee(false);
      setStatutSollicitation('NON_VERIFIE');
      setIdDocumentUrl(undefined);
      setUploadError(null);
      setBuyerCriteriaDraft({});
      setCoBuyerIds([]);
      setCorporateIsMandatory(false);
      setCorporateCompanyName('');
      setCorporateReqNumber('');
      setBuyerBudgetMax('');
      setBuyerRegions('');
      setBuyerTgaMinimum('');
      setBuyerResidenceTypes(new Set());
      setBuyerUnitsMin('');
      setBuyerUnitsMax('');
      setBuyerExperienceDescription('');
      setBuyerHasBroker(false);
      setBuyerTimeline('');
      setBuyerDownpaymentAmount('');
      setUnsubscribedFromEmails(false);
      setExcludedFromMassMailing(false);
      setOwnerId(ctx.uid);
      setSellerCriteriaDraft({});
      setCoSellerIds([]);
      setSellerCorporateIsMandatory(false);
      setSellerCorporateCompanyName('');
      setSellerCorporateReqNumber('');
    }
  }, [open, editing, ctx.uid]);

  const agencyShareAllowed = useMemo(
    () => isAgencyShareAllowedForContact(silo, assetNiche || undefined),
    [silo, assetNiche]
  );

  useEffect(() => {
    if (!agencyShareAllowed && visibility === 'AGENCY_SHARED') {
      setVisibility('PRIVATE');
    }
    if (agencyShareAllowed && !editing) {
      setVisibility(defaultContactVisibility(silo, assetNiche || undefined));
    }
  }, [silo, assetNiche, agencyShareAllowed, editing]);

  const inputClass =
    'w-full rounded-lg border-2 border-primexpert-dark bg-white px-3 py-2 text-lg font-medium text-primexpert-dark focus:outline-none focus:ring-2 focus:ring-primexpert-gold/40';
  const labelClass = 'text-[11px] font-black uppercase tracking-widest text-primexpert-dark';
  const errorClass = 'text-[13px] font-bold text-red-600 mt-1';
  const toggleClass =
    'h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-primexpert-dark accent-primexpert-blue';

  const timelineLabel = (key: string) => {
    const labels: Record<string, { fr: string; en: string }> = {
      IMMEDIATE: { fr: 'Immédiat', en: 'Immediate' },
      '0_3_MONTHS': { fr: '0 à 3 mois', en: '0 to 3 months' },
      '3_6_MONTHS': { fr: '3 à 6 mois', en: '3 to 6 months' },
      '6_12_MONTHS': { fr: '6 à 12 mois', en: '6 to 12 months' },
      '12_PLUS': { fr: '12 mois et plus', en: '12+ months' },
    };
    const row = labels[key];
    return row ? (isFr ? row.fr : row.en) : key;
  };

  const residenceTypeLabel = (type: BuyerTargetResidenceType) => {
    const labels: Record<BuyerTargetResidenceType, { fr: string; en: string }> = {
      RPA: {
        fr: 'Résidence pour aînés (RPA)',
        en: 'Retirement home (senior living)',
      },
      RI: { fr: 'Résidence intermédiaire (RI)', en: 'Intermediate residence (RI)' },
      CHSLD: {
        fr: 'Centre d’hébergement et de soins de longue durée (CHSLD)',
        en: 'Long-term care centre (CHSLD)',
      },
    };
    return isFr ? labels[type].fr : labels[type].en;
  };

  const ownerDisplayName =
    brokers.find((b) => b.uid === (ownerId || editing?.ownerId || ctx.uid))?.displayName ??
    (ownerId || editing?.ownerId || ctx.uid);

  const legalVerificationPayload = useMemo(
    () =>
      verificationMode
        ? {
            verificationMode,
            capaciteJuridiqueValidee,
            statutSollicitation,
            idDocumentUrl:
              verificationMode === 'A_DISTANCE' ? idDocumentUrl : undefined,
            verifiedAt: editing?.legalVerification?.verifiedAt,
            verifiedByUid: editing?.legalVerification?.verifiedByUid,
          }
        : undefined,
    [
      verificationMode,
      capaciteJuridiqueValidee,
      statutSollicitation,
      idDocumentUrl,
      editing?.legalVerification?.verifiedAt,
      editing?.legalVerification?.verifiedByUid,
    ]
  );

  const compliancePreview = useMemo(
    () => ({
      nom,
      prenom: prenom.trim() || undefined,
      dateNaissance,
      occupationProfession,
      adresse: { ligne1, ville, province, codePostal },
      legalVerification: legalVerificationPayload,
    }),
    [
      nom,
      prenom,
      dateNaissance,
      occupationProfession,
      ligne1,
      ville,
      province,
      codePostal,
      legalVerificationPayload,
    ]
  );

  const buildBuyerCriteria = (): ContactBuyerCriteria | undefined => {
    if (!roles.has('buyer')) return undefined;
    return previewBuyerCriteria;
  };

  const buildCommunicationPreferences = (): ContactCommunicationPreferences => ({
    unsubscribedFromEmails,
    excludedFromMassMailing,
  });

  const buildBrokerCriteria = (): ContactBrokerCriteria | undefined => {
    if (!roles.has('broker')) return undefined;
    const criteria: ContactBrokerCriteria = {};
    const agency = brokerAgencyName.trim();
    if (agency) criteria.agencyName = agency;
    if (managedBuyerIds.length) criteria.managedBuyerIds = managedBuyerIds;
    return Object.keys(criteria).length > 0 ? criteria : undefined;
  };

  const buildInput = (): CreateOrganizationContactInput => {
    const roleList = Array.from(roles);
    const base: CreateOrganizationContactInput = {
      silo: defaultContactSiloForRoles(roleList, silo),
      assetNiche: silo === 'COMMERCIAL_SPEC' && assetNiche ? assetNiche : undefined,
      visibility,
      nom,
      prenom: prenom.trim() || undefined,
      dateNaissance,
      occupationProfession,
      adresse: { ligne1, ville, province, codePostal },
      relationRoles: roleList,
      email: email.trim() || undefined,
      telephone: telephone.trim() || undefined,
      legalVerification: legalVerificationPayload,
      communicationPreferences: buildCommunicationPreferences(),
    };
    if (isAdmin && ownerId.trim()) {
      base.ownerId = ownerId.trim();
    }
    if (roles.has('buyer')) {
      base.buyerCriteria = buildBuyerCriteria() ?? {};
      base.coBuyerIds = coBuyerIds.length ? coBuyerIds : undefined;
    }
    if (roles.has('seller')) {
      base.sellerCriteria = buildSellerCriteria() ?? {};
      base.coSellerIds = coSellerIds.length ? coSellerIds : undefined;
    }
    if (roles.has('broker')) {
      base.brokerCriteria = buildBrokerCriteria() ?? {};
    }
    if (roles.has('professional') && professionalType) {
      base.professionalType = professionalType;
    }
    return base;
  };

  const handleIdUpload = async (file: File) => {
    if (!editing?.id) {
      setUploadError(
        t(
          'Enregistrez le contact avant de téléverser la pièce d’identité.',
          'Save the contact before uploading ID proof.'
        )
      );
      return;
    }
    setUploadError(null);
    setUploadPending(true);
    try {
      const res = await uploadContactIdProof(ctx, editing.id, file);
      if (!res.ok) {
        setUploadError(
          t('Téléversement refusé — vérifiez vos permissions.', 'Upload denied — check permissions.')
        );
        return;
      }
      setIdDocumentUrl(res.url);
      setVerificationMode('A_DISTANCE');
    } catch {
      setUploadError(t('Erreur de téléversement.', 'Upload error.'));
    } finally {
      setUploadPending(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    const payload = buildInput();
    const lciPreview = {
      ...payload,
      importMeta: editing?.importMeta,
    };
    const lci = validateContactLciFields(lciPreview);
    if (!lci.ok) {
      setLciErrors(lci.missing);
      setSubmitError(
        t(
          'Identification incomplète — corrigez les champs signalés (import legacy).',
          'Incomplete identification — fix highlighted fields (legacy import).'
        )
      );
      return;
    }
    setLciErrors([]);
    setSubmitError(null);
    const compliance = resolveContactLegalCompliance(payload);
    const payloadFinal: CreateOrganizationContactInput =
      compliance.status === 'conform' && payload.legalVerification
        ? {
            ...payload,
            legalVerification: {
              ...payload.legalVerification,
              verifiedAt: new Date().toISOString(),
              verifiedByUid: ctx.uid,
            },
          }
        : payload;
    setPending(true);
    try {
      if (editing) {
        const res = await updateOrganizationContact(ctx, editing.id, payloadFinal);
        if (!res.ok) {
          setSubmitError(
            res.error === 'lci_incomplete'
              ? t('Champs LCI incomplets.', 'Mandatory identity fields incomplete.')
              : t('Modification refusée.', 'Update denied.')
          );
          if (res.missing) setLciErrors(res.missing as ContactLciFieldKey[]);
          return;
        }
      } else {
        const res = await createOrganizationContact(ctx, payloadFinal);
        if (!res.ok) {
          setSubmitError(
            res.error === 'lci_incomplete'
              ? t('Champs LCI incomplets.', 'Mandatory identity fields incomplete.')
              : t('Création refusée.', 'Create denied.')
          );
          if (res.missing) setLciErrors(res.missing as ContactLciFieldKey[]);
          return;
        }
      }
      onSaved();
      onClose();
    } catch (err) {
      console.error('[ContactFormDrawer] submit failed', err);
      setSubmitError(
        t(
          'Erreur Firestore — vérifiez vos permissions ou réessayez.',
          'Firestore error — check permissions or retry.'
        )
      );
    } finally {
      setPending(false);
    }
  };

  const fieldError = (key: ContactLciFieldKey) =>
    lciErrors.includes(key) ? errorClass : 'hidden';

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button
        type="button"
        className="absolute inset-0 bg-black/50"
        aria-label={t('Fermer', 'Close')}
        onClick={onClose}
      />
      <aside
        className="relative z-10 flex h-full w-full max-w-lg flex-col border-l-4 border-primexpert-dark bg-primexpert-light shadow-2xl"
        role="dialog"
        aria-modal="true"
      >
        <header className="flex items-center justify-between border-b-2 border-primexpert-dark bg-primexpert-blue px-5 py-4">
          <h2 className={cn(institutionalPanelTitleClass, 'text-lg')}>
            {editing
              ? t('Modifier le contact', 'Edit contact')
              : t('Nouveau contact', 'New contact')}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border-2 border-white/40 p-2 text-white hover:bg-white/10"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-6">
          {editing?.importMeta?.lciIncomplete ? (
            <div
              className="rounded-xl border-2 border-amber-600 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-950 leading-relaxed"
              role="alert"
            >
              {t(
                'Fiche importée — complétez les champs d’identification obligatoires (OACIQ) avant d’enregistrer. Les valeurs « À compléter » ne sont pas acceptées.',
                'Imported record — complete mandatory identification fields (brokerage act) before saving. Placeholder values are not accepted.'
              )}
            </div>
          ) : null}

          <ContactLegalComplianceHeader contact={compliancePreview} />

          <section className="space-y-4 rounded-xl border-2 border-black bg-white p-4">
            <p className={cn(labelClass, institutionalInkTextClass)}>
              {t(
                'Registre de vérification légale (OACIQ art. 30)',
                'Legal verification registry (brokerage act s. 30)'
              )}
            </p>

            <fieldset className="space-y-2">
              <legend className={labelClass}>
                {t('Mode de vérification d’identité', 'Identity verification mode')}
              </legend>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="radio"
                  name="verificationMode"
                  className="h-5 w-5 border-2 border-black"
                  checked={verificationMode === 'EN_PERSONNE'}
                  onChange={() => setVerificationMode('EN_PERSONNE')}
                />
                <span className="text-lg font-semibold text-primexpert-dark">
                  {t('En personne', 'In person')}
                </span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="radio"
                  name="verificationMode"
                  className="h-5 w-5 border-2 border-black"
                  checked={verificationMode === 'A_DISTANCE'}
                  onChange={() => setVerificationMode('A_DISTANCE')}
                />
                <span className="text-lg font-semibold text-primexpert-dark">
                  {t('À distance', 'Remote')}
                </span>
              </label>
            </fieldset>

            {verificationMode === 'A_DISTANCE' ? (
              <div className="space-y-2 rounded-lg border-2 border-dashed border-primexpert-dark/40 p-3">
                <p className="text-[13px] font-bold text-primexpert-dark">
                  {t(
                    'Pièce d’identité obligatoire (téléversement sécurisé)',
                    'ID document required (secure upload)'
                  )}
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,.pdf,application/pdf"
                  className="sr-only"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void handleIdUpload(f);
                    e.target.value = '';
                  }}
                />
                <button
                  type="button"
                  disabled={uploadPending}
                  onClick={() => fileInputRef.current?.click()}
                  className="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-black bg-[#D4AF37] px-4 py-3 text-lg font-black text-black hover:bg-[#c9a432] disabled:opacity-50"
                >
                  <Upload className="h-5 w-5" aria-hidden />
                  {uploadPending
                    ? t('Téléversement…', 'Uploading…')
                    : t('Téléverser la pièce d’identité', 'Upload ID document')}
                </button>
                {idDocumentUrl ? (
                  <p className="text-[13px] font-bold text-emerald-800">
                    {t('Preuve enregistrée.', 'Proof on file.')}
                  </p>
                ) : null}
                {uploadError ? <p className={errorClass}>{uploadError}</p> : null}
              </div>
            ) : null}

            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                className="mt-1 h-5 w-5 rounded border-2 border-black"
                checked={capaciteJuridiqueValidee}
                onChange={(e) => setCapaciteJuridiqueValidee(e.target.checked)}
              />
              <span className="text-lg font-semibold text-primexpert-dark leading-snug">
                {t(
                  'Capacité juridique validée (client apte à contracter)',
                  'Legal capacity confirmed (client fit to contract)'
                )}
              </span>
            </label>

            <div>
              <label className={labelClass} htmlFor="statutSollicitation">
                {t('Statut de sollicitation (exclusivité)', 'Solicitation status (exclusivity)')}
              </label>
              <select
                id="statutSollicitation"
                className={inputClass}
                value={statutSollicitation}
                onChange={(e) =>
                  setStatutSollicitation(e.target.value as ContactSolicitationStatut)
                }
              >
                <option value="NON_VERIFIE">
                  {t('Non vérifié', 'Not verified')}
                </option>
                <option value="AUCUNE_EXCLUSIVITE_AILLEURS">
                  {t(
                    'Aucune exclusivité ailleurs — conforme',
                    'No exclusivity elsewhere — compliant'
                  )}
                </option>
                <option value="EXCLUSIVITE_AILLEURS">
                  {t('Exclusivité ailleurs détectée', 'Exclusivity elsewhere detected')}
                </option>
              </select>
            </div>
          </section>

          <section className="space-y-3">
            <p className={cn(labelClass, institutionalInkTextClass)}>
              {t(
                'Identification (obligatoire — 4 champs OACIQ)',
                'Identification (required — 4 brokerage act fields)'
              )}
            </p>
            <div>
              <label className={labelClass}>{t('Nom complet (nom de famille)', 'Full name (last name)')}</label>
              <input className={inputClass} value={nom} onChange={(e) => setNom(e.target.value)} />
              <p className={fieldError('nom')}>
                {isFr ? CONTACT_LCI_FIELD_LABEL_FR.nom : 'Name'} — {t('requis', 'required')}
              </p>
            </div>
            <div>
              <label className={labelClass}>{t('Prénom', 'First name')}</label>
              <input className={inputClass} value={prenom} onChange={(e) => setPrenom(e.target.value)} />
            </div>
            <div>
              <label className={labelClass}>{t('Date de naissance', 'Date of birth')}</label>
              <input
                type="date"
                className={inputClass}
                value={dateNaissance}
                onChange={(e) => setDateNaissance(e.target.value)}
              />
              <p className={fieldError('dateNaissance')}>
                {t('Date de naissance requise.', 'Date of birth is required.')}
              </p>
            </div>
            <div>
              <label className={labelClass}>
                {t('Occupation (métier de la partie)', 'Occupation (party profession)')}
              </label>
              <input
                className={inputClass}
                value={occupationProfession}
                onChange={(e) => setOccupationProfession(e.target.value)}
              />
              <p className={fieldError('occupationProfession')}>
                {t(
                  'Occupation professionnelle requise (distincte du taux d’occupation immeuble).',
                  'Professional occupation required (not building occupancy rate).'
                )}
              </p>
            </div>
            <div>
              <label className={labelClass}>{t('Adresse — ligne 1', 'Address line 1')}</label>
              <input className={inputClass} value={ligne1} onChange={(e) => setLigne1(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>{t('Ville', 'City')}</label>
                <input className={inputClass} value={ville} onChange={(e) => setVille(e.target.value)} />
              </div>
              <div>
                <label className={labelClass}>{t('Code postal', 'Postal code')}</label>
                <input
                  className={inputClass}
                  value={codePostal}
                  onChange={(e) => setCodePostal(e.target.value)}
                />
              </div>
            </div>
            <p className={fieldError('adresse')}>
              {t('Adresse complète requise (rue, ville, code postal).', 'Full address required.')}
            </p>
          </section>

          <section className="space-y-3 rounded-xl border-2 border-primexpert-dark bg-white p-4">
            <p className={labelClass}>{t('Coordonnées', 'Contact details')}</p>
            <input
              className={inputClass}
              placeholder={t('Courriel', 'Email')}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <input
              className={inputClass}
              placeholder={t('Téléphone', 'Phone')}
              value={telephone}
              onChange={(e) => setTelephone(e.target.value)}
            />
          </section>

          <section className="space-y-3 rounded-xl border-2 border-primexpert-blue/40 bg-white p-4">
            <p className={labelClass}>
              {t('Préférences de communication', 'Communication preferences')}
            </p>
            <p className="text-[11px] font-medium text-primexpert-dark/80 leading-relaxed">
              {t(
                'Consentements et exclusions — Loi 25 et Loi canadienne anti-pourriel (LCAP).',
                'Consents and exclusions — Quebec Law 25 and Canada’s Anti-Spam Legislation (CASL).'
              )}
            </p>
            <label className="flex items-center justify-between gap-4 rounded-lg border-2 border-primexpert-dark/15 bg-primexpert-light/50 px-3 py-3 cursor-pointer">
              <span className="text-sm font-semibold text-primexpert-dark leading-snug">
                {t('Désabonné des courriels', 'Unsubscribed from emails')}
              </span>
              <input
                type="checkbox"
                role="switch"
                aria-checked={unsubscribedFromEmails}
                className={toggleClass}
                checked={unsubscribedFromEmails}
                onChange={(e) => setUnsubscribedFromEmails(e.target.checked)}
              />
            </label>
            <label className="flex items-center justify-between gap-4 rounded-lg border-2 border-primexpert-dark/15 bg-primexpert-light/50 px-3 py-3 cursor-pointer">
              <span className="text-sm font-semibold text-primexpert-dark leading-snug">
                {t('Exclu des envois massifs', 'Excluded from mass mailings')}
              </span>
              <input
                type="checkbox"
                role="switch"
                aria-checked={excludedFromMassMailing}
                className={toggleClass}
                checked={excludedFromMassMailing}
                onChange={(e) => setExcludedFromMassMailing(e.target.checked)}
              />
            </label>
          </section>

          <section className="space-y-3 rounded-xl border-2 border-primexpert-dark bg-white p-4">
            <p className={labelClass}>{t('Courtier responsable', 'Responsible broker')}</p>
            {isAdmin || !editing ? (
              <select
                className={inputClass}
                value={ownerId || ctx.uid}
                onChange={(e) => setOwnerId(e.target.value)}
                disabled={!isAdmin}
              >
                {(brokers.length ? brokers : [{ uid: ctx.uid, displayName: ownerDisplayName }]).map(
                  (b) => (
                    <option key={b.uid} value={b.uid}>
                      {b.displayName}
                    </option>
                  )
                )}
              </select>
            ) : (
              <p className="text-sm font-semibold text-primexpert-dark">{ownerDisplayName}</p>
            )}
            {!isAdmin && !editing ? (
              <p className="text-[11px] font-medium text-primexpert-dark/70">
                {t(
                  'Ce contact vous sera assigné automatiquement.',
                  'This contact will be assigned to you automatically.'
                )}
              </p>
            ) : null}
            {isAdmin && editing ? (
              <p className="text-[11px] font-medium text-primexpert-dark/70">
                {t(
                  'Réassignation réservée aux administrateurs.',
                  'Reassignment reserved for administrators.'
                )}
              </p>
            ) : null}
          </section>

          <section className="space-y-3 rounded-xl border-2 border-primexpert-dark bg-white p-4">
            <p className={labelClass}>{t('Métadonnées — silo', 'Metadata — silo')}</p>
            <select
              className={inputClass}
              value={silo}
              onChange={(e) => setSilo(e.target.value as ContactSilo)}
            >
              {CONTACT_SILOS.map((s) => (
                <option key={s} value={s}>
                  {isFr ? CONTACT_SILO_LABEL_FR[s] : CONTACT_SILO_LABEL_EN[s]}
                </option>
              ))}
            </select>
            {silo === 'COMMERCIAL_SPEC' ? (
              <select
                className={inputClass}
                value={assetNiche}
                onChange={(e) => setAssetNiche(e.target.value as ContactAssetNiche)}
              >
                <option value="">{t('Choisir une niche', 'Choose niche')}</option>
                {CONTACT_ASSET_NICHES.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            ) : null}
            {agencyShareAllowed ? (
              <div>
                <label className={labelClass}>{t('Visibilité', 'Visibility')}</label>
                <select
                  className={inputClass}
                  value={visibility}
                  onChange={(e) => setVisibility(e.target.value as ContactVisibility)}
                >
                  {CONTACT_VISIBILITY.map((v) => (
                    <option key={v} value={v}>
                      {v === 'PRIVATE'
                        ? t('Privé (courtier)', 'Private (broker)')
                        : t('Partagé agence (pool RPA)', 'Agency shared (RPA pool)')}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <p className="text-[11px] font-medium text-primexpert-dark/80">
                {t('Visibilité : privée (par défaut).', 'Visibility: private (default).')}
              </p>
            )}
          </section>

          <section className="space-y-2 rounded-xl border-2 border-primexpert-dark bg-white p-4">
            <p className={labelClass}>{t('Rôle relationnel', 'Relationship role')}</p>
            <div className="flex flex-wrap gap-2">
              {CONTACT_RELATION_ROLES.map((role) => {
                const label = isFr ? CONTACT_ROLE_LABEL_FR[role] : CONTACT_ROLE_LABEL_EN[role];
                const active = roles.has(role);
                return (
                  <button
                    key={role}
                    type="button"
                    onClick={() => {
                      setRoles((prev) => {
                        const next = new Set(prev);
                        if (next.has(role)) next.delete(role);
                        else next.add(role);
                        if (role === 'broker' && !editing) {
                          setSilo('RESIDENTIEL');
                        }
                        return next;
                      });
                    }}
                    className={cn(
                      'rounded-lg border-2 px-3 py-1.5 text-[10px] font-black uppercase tracking-wider',
                      active
                        ? 'border-primexpert-dark bg-primexpert-dark text-white'
                        : 'border-primexpert-dark/30 bg-primexpert-light text-primexpert-dark'
                    )}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </section>

          {isBuyerRole ? (
            <section className="space-y-3 rounded-xl border-2 border-primexpert-blue/40 bg-white p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className={labelClass}>
                  {t(
                    'Qualification et critères d’acquisition (acheteur)',
                    'Qualification & acquisition criteria (buyer)'
                  )}
                </p>
                <BuyerTierBadge
                  contact={editing ?? { relationRoles: ['buyer'] }}
                  previewCriteria={previewBuyerCriteria}
                  previewRoles={Array.from(roles)}
                />
              </div>
              <p className="text-[11px] font-medium text-primexpert-dark/80 leading-relaxed">
                {t(
                  'La typologie (privilégié / qualifié) est calculée selon les pièces téléversées — non modifiable manuellement.',
                  'Tier (privileged / qualified) is computed from uploaded documents — not manually editable.'
                )}
              </p>
              <BuyerCriteriaDocumentsSection
                ctx={ctx}
                contactId={editing?.id}
                rows={buildStandardBuyerDocumentRows(previewBuyerCriteria)}
                onDocumentUploaded={handleBuyerDocumentUploaded}
              />

              <CoBuyersSection
                ctx={ctx}
                contactId={editing?.id}
                coBuyerIds={coBuyerIds}
                onCoBuyersChange={setCoBuyerIds}
              />

              <div className="space-y-3 rounded-lg border-2 border-primexpert-dark/15 bg-primexpert-light/30 p-3">
                <label className="flex items-center justify-between gap-4 cursor-pointer">
                  <span className={labelClass}>
                    {t('Structure corporative (mandataire Inc.)', 'Corporate structure (Inc. representative)')}
                  </span>
                  <input
                    type="checkbox"
                    role="switch"
                    className={toggleClass}
                    checked={corporateIsMandatory}
                    onChange={(e) => setCorporateIsMandatory(e.target.checked)}
                  />
                </label>
                {corporateIsMandatory ? (
                  <>
                    <div>
                      <label className={labelClass} htmlFor="corporateCompanyName">
                        {t('Nom de la compagnie', 'Company name')}
                      </label>
                      <input
                        id="corporateCompanyName"
                        className={inputClass}
                        value={corporateCompanyName}
                        onChange={(e) => setCorporateCompanyName(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className={labelClass} htmlFor="corporateReqNumber">
                        {t('Numéro d’entreprise du Québec (NEQ)', 'Quebec enterprise number (NEQ)')}
                      </label>
                      <input
                        id="corporateReqNumber"
                        className={inputClass}
                        value={corporateReqNumber}
                        onChange={(e) => setCorporateReqNumber(e.target.value)}
                      />
                    </div>
                    <BuyerCriteriaDocumentsSection
                      ctx={ctx}
                      contactId={editing?.id}
                      rows={[
                        {
                          kind: 'req',
                          labelFr: 'Fiche REQ (Registre des entreprises du Québec)',
                          labelEn: 'REQ extract (Quebec enterprise register)',
                          file: previewBuyerCriteria.corporateMandate?.reqFile,
                        },
                      ]}
                      onDocumentUploaded={handleBuyerDocumentUploaded}
                    />
                  </>
                ) : null}
              </div>

              <div className="space-y-3 rounded-lg border-2 border-primexpert-dark/15 bg-primexpert-light/30 p-3">
                <p className={labelClass}>
                  {t('Critères de recherche (formulaire web)', 'Search criteria (web form)')}
                </p>
                <div>
                  <span className={labelClass}>
                    {t('Type de résidence visé', 'Target property type')}
                  </span>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {BUYER_TARGET_RESIDENCE_TYPES.map((type) => {
                      const active = buyerResidenceTypes.has(type);
                      return (
                        <button
                          key={type}
                          type="button"
                          onClick={() => {
                            setBuyerResidenceTypes((prev) => {
                              const next = new Set(prev);
                              if (next.has(type)) next.delete(type);
                              else next.add(type);
                              return next;
                            });
                          }}
                          className={cn(
                            'rounded-lg border-2 px-3 py-1.5 text-[10px] font-black uppercase tracking-wider',
                            active
                              ? 'border-primexpert-dark bg-primexpert-dark text-white'
                              : 'border-primexpert-dark/30 bg-white text-primexpert-dark'
                          )}
                        >
                          {residenceTypeLabel(type)}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelClass} htmlFor="buyerUnitsMin">
                      {t('Unités — minimum', 'Units — minimum')}
                    </label>
                    <input
                      id="buyerUnitsMin"
                      type="number"
                      min={0}
                      className={inputClass}
                      value={buyerUnitsMin}
                      onChange={(e) => setBuyerUnitsMin(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className={labelClass} htmlFor="buyerUnitsMax">
                      {t('Unités — maximum', 'Units — maximum')}
                    </label>
                    <input
                      id="buyerUnitsMax"
                      type="number"
                      min={0}
                      className={inputClass}
                      value={buyerUnitsMax}
                      onChange={(e) => setBuyerUnitsMax(e.target.value)}
                    />
                  </div>
                </div>
                <div>
                  <label className={labelClass} htmlFor="buyerRegions">
                    {t('Régions ou marchés visés', 'Target regions or markets')}
                  </label>
                  <input
                    id="buyerRegions"
                    className={inputClass}
                    placeholder={t('ex. Montréal, Rive-Nord', 'e.g. Montreal, North Shore')}
                    value={buyerRegions}
                    onChange={(e) => setBuyerRegions(e.target.value)}
                  />
                </div>
                <div>
                  <label className={labelClass} htmlFor="buyerBudgetMax">
                    {t('Budget maximal ($)', 'Maximum budget ($)')}
                  </label>
                  <input
                    id="buyerBudgetMax"
                    type="number"
                    min={0}
                    className={inputClass}
                    value={buyerBudgetMax}
                    onChange={(e) => setBuyerBudgetMax(e.target.value)}
                  />
                </div>
                <div>
                  <label className={labelClass} htmlFor="buyerDownpaymentAmount">
                    {t('Mise de fonds déclarée ($)', 'Declared down payment ($)')}
                  </label>
                  <input
                    id="buyerDownpaymentAmount"
                    type="number"
                    min={0}
                    className={inputClass}
                    value={buyerDownpaymentAmount}
                    onChange={(e) => setBuyerDownpaymentAmount(e.target.value)}
                  />
                </div>
                <div>
                  <label className={labelClass} htmlFor="buyerTimeline">
                    {t('Échéancier d’acquisition', 'Acquisition timeline')}
                  </label>
                  <select
                    id="buyerTimeline"
                    className={inputClass}
                    value={buyerTimeline}
                    onChange={(e) => setBuyerTimeline(e.target.value)}
                  >
                    <option value="">{t('Non renseigné', 'Not set')}</option>
                    {BUYER_ACQUISITION_TIMELINES.map((tl) => (
                      <option key={tl} value={tl}>
                        {timelineLabel(tl)}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelClass} htmlFor="buyerExperienceDescription">
                    {t('Expérience en gestion immobilière', 'Property management experience')}
                  </label>
                  <textarea
                    id="buyerExperienceDescription"
                    rows={3}
                    className={cn(inputClass, 'text-base resize-y min-h-[4.5rem]')}
                    value={buyerExperienceDescription}
                    onChange={(e) => setBuyerExperienceDescription(e.target.value)}
                    placeholder={t(
                      'Décrivez l’expérience pertinente du prospect…',
                      'Describe the prospect’s relevant experience…'
                    )}
                  />
                </div>
                <label className="flex items-center justify-between gap-4 rounded-lg border-2 border-primexpert-dark/15 bg-white px-3 py-3 cursor-pointer">
                  <span className="text-sm font-semibold text-primexpert-dark">
                    {t(
                      'Déjà accompagné par un courtier immobilier',
                      'Already working with a real estate broker'
                    )}
                  </span>
                  <input
                    type="checkbox"
                    role="switch"
                    className={toggleClass}
                    checked={buyerHasBroker}
                    onChange={(e) => setBuyerHasBroker(e.target.checked)}
                  />
                </label>
              </div>

              <div>
                <label className={labelClass} htmlFor="buyerTgaMinimum">
                  {t(
                    'Taux de capitalisation (TGA) minimum visé (%)',
                    'Minimum target capitalization rate (cap rate) (%)'
                  )}
                </label>
                <input
                  id="buyerTgaMinimum"
                  type="number"
                  min={0}
                  step={0.1}
                  className={inputClass}
                  value={buyerTgaMinimum}
                  onChange={(e) => setBuyerTgaMinimum(e.target.value)}
                />
              </div>
            </section>
          ) : null}

          {isSellerRole ? (
            <section className="space-y-3 rounded-xl border-2 border-primexpert-gold/50 bg-white p-4">
              <p className={labelClass}>
                {t(
                  'Mandat de vente et conformité (vendeur)',
                  'Listing mandate & compliance (seller)'
                )}
              </p>
              <p className="text-[11px] font-medium text-primexpert-dark/80 leading-relaxed">
                {t(
                  'Téléversez les pièces justificatives du mandat. La structure corporative (Inc. / NEQ / REQ) s’applique si le vendeur agit pour une personne morale.',
                  'Upload listing supporting documents. Corporate structure (Inc. / NEQ / REQ) applies when the seller acts for a legal entity.'
                )}
              </p>
              <SellerCriteriaDocumentsSection
                ctx={ctx}
                contactId={editing?.id}
                rows={buildStandardSellerDocumentRows(previewSellerCriteria)}
                onDocumentUploaded={handleSellerDocumentUploaded}
              />

              <CoSellersSection
                ctx={ctx}
                contactId={editing?.id}
                coSellerIds={coSellerIds}
                onCoSellersChange={setCoSellerIds}
              />

              <div className="space-y-3 rounded-lg border-2 border-primexpert-dark/15 bg-primexpert-light/30 p-3">
                <label className="flex items-center justify-between gap-4 cursor-pointer">
                  <span className={labelClass}>
                    {t('Structure corporative (mandataire Inc.)', 'Corporate structure (Inc. representative)')}
                  </span>
                  <input
                    type="checkbox"
                    role="switch"
                    className={toggleClass}
                    checked={sellerCorporateIsMandatory}
                    onChange={(e) => setSellerCorporateIsMandatory(e.target.checked)}
                  />
                </label>
                {sellerCorporateIsMandatory ? (
                  <>
                    <div>
                      <label className={labelClass} htmlFor="sellerCorporateCompanyName">
                        {t('Nom de la compagnie', 'Company name')}
                      </label>
                      <input
                        id="sellerCorporateCompanyName"
                        className={inputClass}
                        value={sellerCorporateCompanyName}
                        onChange={(e) => setSellerCorporateCompanyName(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className={labelClass} htmlFor="sellerCorporateReqNumber">
                        {t('Numéro d’entreprise du Québec (NEQ)', 'Quebec enterprise number (NEQ)')}
                      </label>
                      <input
                        id="sellerCorporateReqNumber"
                        className={inputClass}
                        value={sellerCorporateReqNumber}
                        onChange={(e) => setSellerCorporateReqNumber(e.target.value)}
                      />
                    </div>
                    <SellerCriteriaDocumentsSection
                      ctx={ctx}
                      contactId={editing?.id}
                      rows={[
                        {
                          kind: 'req',
                          labelFr: 'Fiche REQ (Registre des entreprises du Québec)',
                          labelEn: 'REQ extract (Quebec enterprise register)',
                          file: previewSellerCriteria.corporateMandate?.reqFile,
                        },
                      ]}
                      onDocumentUploaded={handleSellerDocumentUploaded}
                    />
                  </>
                ) : null}
              </div>
            </section>
          ) : null}

          {isBrokerRole ? (
            <section className="space-y-3 rounded-xl border-2 border-primexpert-dark/30 bg-white p-4">
              <p className={labelClass}>
                {t('Profil courtier immobilier', 'Real estate broker profile')}
              </p>
              <div>
                <label className={labelClass} htmlFor="brokerAgencyName">
                  {t('Nom de l’agence', 'Agency name')}
                </label>
                <input
                  id="brokerAgencyName"
                  className={inputClass}
                  value={brokerAgencyName}
                  onChange={(e) => setBrokerAgencyName(e.target.value)}
                />
              </div>
              <ManagedBuyersSection
                ctx={ctx}
                brokerContactId={editing?.id}
                managedBuyerIds={managedBuyerIds}
                onManagedBuyersChange={setManagedBuyerIds}
              />
            </section>
          ) : null}

          {isProfessionalRole ? (
            <section className="space-y-3 rounded-xl border-2 border-primexpert-dark/30 bg-white p-4">
              <p className={labelClass}>
                {t('Spécialisation professionnelle', 'Professional specialization')}
              </p>
              <div>
                <label className={labelClass} htmlFor="professionalType">
                  {t('Catégorie', 'Category')}
                </label>
                <select
                  id="professionalType"
                  className={inputClass}
                  value={professionalType}
                  onChange={(e) =>
                    setProfessionalType((e.target.value || '') as ProfessionalType | '')
                  }
                >
                  <option value="">
                    {t('— Sélectionner —', '— Select —')}
                  </option>
                  {PROFESSIONAL_TYPES.map((pt) => (
                    <option key={pt} value={pt}>
                      {isFr
                        ? PROFESSIONAL_TYPE_LABEL_FR[pt]
                        : PROFESSIONAL_TYPE_LABEL_EN[pt]}
                    </option>
                  ))}
                </select>
              </div>
            </section>
          ) : null}

          {submitError ? <p className="text-sm font-bold text-red-600">{submitError}</p> : null}

          {editing ? (
            <div className="rounded-xl border-2 border-primexpert-dark/20 bg-primexpert-light/30 p-2">
              {timelineLoading ? (
                <p className="px-4 py-6 text-center text-sm font-semibold text-primexpert-dark">
                  {t('Chargement de l’historique…', 'Loading history…')}
                </p>
              ) : (
                <IntelligenceChronologie
                  brokerId={ctx.uid}
                  mode="communications-only"
                  timelineEvents={timelineEvents}
                />
              )}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={pending}
            className="w-full rounded-xl border-2 border-primexpert-dark bg-primexpert-dark py-3 text-[11px] font-black uppercase tracking-widest text-white hover:bg-primexpert-blue disabled:opacity-50"
          >
            {pending
              ? t('Enregistrement…', 'Saving…')
              : editing
                ? t('Enregistrer', 'Save')
                : t('Créer le contact', 'Create contact')}
          </button>
        </form>
      </aside>
    </div>
  );
}
