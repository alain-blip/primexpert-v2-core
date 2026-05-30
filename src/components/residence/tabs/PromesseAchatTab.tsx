/**
 * Promesse d'achat — suivi de la promesse d'achat (OACIQ, WORM 6 ans).
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, Search } from 'lucide-react';
import {
  PROMESSE_STATUS_OPTIONS,
  WORM_LOCK_MESSAGE_EN,
  WORM_LOCK_MESSAGE_FR,
  appendOfferSummary,
  buildPromesseAchatViewModel,
  formatIsoDateForDisplay,
  mergeOffreConditionsWithDelais,
  parseOffreClotureFromDoc,
  parseOffreConditionsFromDoc,
  parseOffreTroncFromDoc,
  parsePromesseAchatFromDoc,
  parsePromesseOffersFromDoc,
  serializeOffreForFirestore,
  serializePromesseAchatForFirestore,
  type OffreClotureInput,
  type OffreConditionsInput,
  type OffreTroncInput,
  type PromesseAchatInput,
  type PromesseOfferSummaryRow,
} from '@primexpert/core/transaction';
import { OffreClotureRetributionSection } from '../promesse/OffreClotureRetributionSection';
import { OffreConditionsLegalesSection } from '../promesse/OffreConditionsLegalesSection';
import { OffreTroncFinancierSection } from '../promesse/OffreTroncFinancierSection';
import { PromesseCommissionPaSection } from '../promesse/PromesseCommissionPaSection';
import { PromesseDelaisPaSection } from '../promesse/PromesseDelaisPaSection';
import { ContractAssemblerPanel } from '../promesse/ContractAssemblerPanel';
import { PartiesImpliquees } from '../promesse/PartiesImpliquees';
import { FinancialDataProvider } from '../../../context/FinancialDataContext';
import { useUnifiedResidence } from '../../../context/ResidenceDataContext';
import { useAuth } from '../../../lib/auth';
import { useLanguage } from '../../../lib/i18n';
import { cn, formatCurrency } from '../../../lib/utils';
import {
  institutionalListingsActionButtonClass,
  institutionalListingsInlineInputClass,
  institutionalListingsPanelClass,
} from '../../../lib/institutionalTheme';
import {
  searchInternalContacts,
  type InternalContact,
} from '../../../lib/internalContacts';
import {
  getPropertyDocumentDownloadUrl,
  removePromesseDocument,
  subscribePromesseDocuments,
  uploadPromesseDocument,
  type PromesseDocumentRecord,
} from '../../../services/promesseDocumentsService';
import { inst, InstitutionalSection } from '../institutional/InstitutionalUi';
import type { Residence } from '../../../services/residences';

type InnerTab = 'edit' | 'summary';
type TransactionStage = 'analyse_financiere' | 'due_diligence' | 'cloture';

const fieldClass = `${institutionalListingsInlineInputClass} text-sm disabled:bg-slate-50 disabled:text-slate-600`;

const labelClass = 'text-[10px] font-black uppercase tracking-[0.12em] text-slate-600';

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

export interface PromesseAchatTabProps {
  residence: Residence;
  brokerId: string;
}

export function PromesseAchatTab({ residence: residenceProp, brokerId }: PromesseAchatTabProps) {
  const { t, language } = useLanguage();
  const locale = language === 'fr' ? 'fr-CA' : 'en-CA';
  const { profile } = useAuth();
  const { residence, residenceRecord, loading, saving, saveError, updateResidence } =
    useUnifiedResidence(residenceProp);

  const [innerTab, setInnerTab] = useState<InnerTab>('edit');
  const [offreTronc, setOffreTronc] = useState<OffreTroncInput>({});
  const [offreConditions, setOffreConditions] = useState<OffreConditionsInput>({});
  const [offreCloture, setOffreCloture] = useState<OffreClotureInput>({});
  const [form, setForm] = useState<PromesseAchatInput>({ status: 'draft' });
  const [offers, setOffers] = useState<PromesseOfferSummaryRow[]>([]);
  const [contactQuery, setContactQuery] = useState('');
  const [docs, setDocs] = useState<PromesseDocumentRecord[]>([]);
  const [uploading, setUploading] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const vm = useMemo(() => buildPromesseAchatViewModel(form), [form]);
  const locked = vm.isWormLocked;

  const transactionStage: TransactionStage = useMemo(() => {
    if (form.status === 'accepted') return 'due_diligence';
    if (form.status === 'refused' || form.status === 'cancelled') return 'cloture';
    return 'analyse_financiere';
  }, [form.status]);

  const stageLabels = useMemo(
    () => ({
      analyse_financiere: t('Analyse financière', 'Financial analysis'),
      due_diligence: t('Diligence raisonnable', 'Due diligence'),
      cloture: t('Clôture', 'Closing'),
    }),
    [t]
  );

  const dueDiligenceChecklist = useMemo(
    () => [
      t('Vérification des certifications CIUSSS', 'Verification of CIUSSS certifications'),
      t('Vérification des baux et grilles de soins', 'Verification of leases and care grids'),
      t("Conformité du permis d'opération", 'Operating permit compliance'),
    ],
    [t]
  );

  const coSellerIds = useMemo(() => {
    const raw = residenceRecord.coSellerIds;
    return Array.isArray(raw) ? raw.map((id) => String(id)).filter(Boolean) : [];
  }, [residenceRecord]);

  const notaryIds = useMemo(() => {
    const raw = residenceRecord.notaryIds ?? residenceRecord.notaireIds;
    if (Array.isArray(raw)) return raw.map((id) => String(id)).filter(Boolean);
    if (typeof raw === 'string' && raw.trim()) return [raw.trim()];
    return [];
  }, [residenceRecord]);

  const lawyerIds = useMemo(() => {
    const raw = residenceRecord.lawyerIds ?? residenceRecord.avocatIds;
    if (Array.isArray(raw)) return raw.map((id) => String(id)).filter(Boolean);
    if (typeof raw === 'string' && raw.trim()) return [raw.trim()];
    return [];
  }, [residenceRecord]);

  const collaboratorBrokerIds = useMemo(() => {
    const raw = residenceRecord.collaboratorBrokerIds;
    if (Array.isArray(raw)) return raw.map((id) => String(id)).filter(Boolean);
    return [];
  }, [residenceRecord]);

  useEffect(() => {
    if (!residenceRecord || Object.keys(residenceRecord).length === 0) return;
    const offre = parseOffreTroncFromDoc(residenceRecord);
    const conditions = parseOffreConditionsFromDoc(residenceRecord);
    const cloture = parseOffreClotureFromDoc(residenceRecord);
    setOffreTronc(offre);
    setOffreConditions(conditions);
    setOffreCloture(cloture);
    setForm(parsePromesseAchatFromDoc(residenceRecord));
    setOffers(parsePromesseOffersFromDoc(residenceRecord));
  }, [residenceRecord]);

  useEffect(() => {
    const unsub = subscribePromesseDocuments(
      residence.id,
      setDocs,
      () => {
        setDocs([]);
      }
    );
    return () => unsub();
  }, [residence.id]);

  const contactResults = useMemo(
    () => searchInternalContacts(contactQuery).filter((c) => c.type === 'Acheteur'),
    [contactQuery]
  );

  const conditionsSyncedWithDelais = useCallback(
    (promesse: PromesseAchatInput, conditions: OffreConditionsInput) =>
      mergeOffreConditionsWithDelais(conditions, {
        dateAcceptation: promesse.dateAcceptation,
        delais: promesse.delais,
      }),
    []
  );

  const buildOffreFirestorePatch = useCallback(
    (
      tronc: OffreTroncInput,
      conditions: OffreConditionsInput,
      cloture: OffreClotureInput,
      promesse: PromesseAchatInput
    ) =>
      serializeOffreForFirestore(
        {
          ...tronc,
          acheteurId: promesse.buyer?.contactId ?? tronc.acheteurId,
          acheteurNom: promesse.buyer?.fullName ?? tronc.acheteurNom,
        },
        conditionsSyncedWithDelais(promesse, conditions),
        cloture
      ),
    [conditionsSyncedWithDelais]
  );

  const persistOffreTronc = useCallback(
    async (next: OffreTroncInput) => {
      if (locked) return;
      setOffreTronc(next);
      await updateResidence(buildOffreFirestorePatch(next, offreConditions, offreCloture, form));
    },
    [buildOffreFirestorePatch, form, locked, offreCloture, offreConditions, updateResidence]
  );

  const persistOffreConditions = useCallback(
    async (next: OffreConditionsInput) => {
      if (locked) return;
      setOffreConditions(next);
      await updateResidence(
        buildOffreFirestorePatch(offreTronc, next, offreCloture, form)
      );
    },
    [buildOffreFirestorePatch, form, locked, offreCloture, offreTronc, updateResidence]
  );

  const persistOffreCloture = useCallback(
    async (next: OffreClotureInput) => {
      if (locked) return;
      setOffreCloture(next);
      await updateResidence(
        buildOffreFirestorePatch(offreTronc, offreConditions, next, form)
      );
    },
    [buildOffreFirestorePatch, form, locked, offreConditions, offreTronc, updateResidence]
  );

  const persist = useCallback(
    async (next: PromesseAchatInput) => {
      setForm(next);
      const nextTronc: OffreTroncInput = {
        ...offreTronc,
        prixOffert: offreTronc.prixOffert,
        acheteurId: next.buyer?.contactId ?? offreTronc.acheteurId,
        acheteurNom: next.buyer?.fullName ?? offreTronc.acheteurNom,
      };
      if (next.buyer) {
        setOffreTronc(nextTronc);
      }
      const patch = {
        ...serializePromesseAchatForFirestore(next),
        ...buildOffreFirestorePatch(nextTronc, offreConditions, offreCloture, next),
      };
      const nextOffers = appendOfferSummary(offers, next);
      try {
        await updateResidence({
          ...patch,
          promesseOffers: nextOffers,
        });
        setOffers(nextOffers);
        setLocalError(null);
      } catch (e) {
        setLocalError(e instanceof Error ? e.message : String(e));
      }
    },
    [buildOffreFirestorePatch, offers, offreCloture, offreConditions, offreTronc, updateResidence]
  );

  const patchField = useCallback(
    <K extends keyof PromesseAchatInput>(key: K, value: PromesseAchatInput[K]) => {
      if (locked) return;
      void persist({ ...form, [key]: value });
    },
    [form, locked, persist]
  );

  const linkContact = (c: InternalContact) => {
    if (locked) return;
    setOffreTronc({
      ...offreTronc,
      acheteurId: c.id,
      acheteurNom: c.fullName,
    });
    void persist({
      ...form,
      buyer: {
        contactId: c.id,
        fullName: c.fullName,
        email: c.email,
        phone: c.phone,
        company: c.company,
        internal: true,
      },
    });
    setContactQuery('');
  };

  const handleUpload = async (files: FileList | null) => {
    if (!files?.length || locked || !profile?.uid) return;
    setUploading(true);
    setLocalError(null);
    try {
      for (const file of Array.from(files)) {
        await uploadPromesseDocument({
          propertyId: residence.id,
          file,
          uploadedBy: brokerId || profile.uid,
          kind: 'autre',
        });
      }
    } catch (e) {
      setLocalError(e instanceof Error ? e.message : String(e));
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  if (loading) {
    return (
      <div className={inst.loading}>
        <p className={inst.loadingText}>
          {t('Chargement de la promesse…', 'Loading purchase promise…')}
        </p>
      </div>
    );
  }

  return (
    <div className={institutionalListingsPanelClass}>
      {locked && (
        <p className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-[#142c6a]">
          {language === 'fr' ? WORM_LOCK_MESSAGE_FR : WORM_LOCK_MESSAGE_EN}
        </p>
      )}

      <nav
        className="flex gap-2 border-b border-slate-200 pb-1"
        aria-label={t('Sous-onglets promesse', 'Promise sub-tabs')}
      >
        {(
          [
            ['edit', t('Modifier la promesse', 'Edit promise')],
            ['summary', t('Résumé des promesses', 'Promise summary')],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setInnerTab(id)}
            className={cn(
              'rounded-lg px-4 py-2 text-[10px] font-black uppercase tracking-[0.12em] border transition',
              innerTab === id
                ? 'border-[#D4AF37]/50 bg-amber-50 text-[#142c6a]'
                : 'border-slate-200 bg-white text-slate-600 hover:text-[#142c6a]'
            )}
          >
            {label}
          </button>
        ))}
      </nav>

      {(saveError || localError) && (
        <p className={inst.alertRed}>{saveError ?? localError}</p>
      )}

      {innerTab === 'summary' ? (
        <InstitutionalSection title={t('Offres reçues sur la bâtisse', 'Offers on this property')}>
          {offers.length === 0 ? (
            <p className="text-sm text-[#142c6a]">
              {t('Aucune offre enregistrée.', 'No offers recorded yet.')}
            </p>
          ) : (
            <div className={inst.tableWrap}>
              <table className={inst.table}>
                <thead>
                  <tr>
                    <th className={inst.th}>{t('Statut', 'Status')}</th>
                    <th className={inst.th}>{t('Acheteur', 'Buyer')}</th>
                    <th className={inst.thRight}>{t('Prix offert', 'Offered')}</th>
                    <th className={inst.thRight}>{t('Prix accepté', 'Accepted')}</th>
                    <th className={inst.th}>{t('Réception', 'Received')}</th>
                  </tr>
                </thead>
                <tbody>
                  {offers.map((row) => {
                    const st = PROMESSE_STATUS_OPTIONS.find((o) => o.value === row.status);
                    return (
                      <tr key={row.id} className={inst.tr}>
                        <td className={cn(inst.td, 'text-[#142c6a] font-semibold')}>
                          {language === 'fr' ? st?.labelFr : st?.labelEn}
                        </td>
                        <td className={inst.td}>{row.buyerName ?? '—'}</td>
                        <td className={inst.tdValue}>
                          {row.prixOffert != null ? formatCurrency(row.prixOffert) : '—'}
                        </td>
                        <td className={inst.tdValue}>
                          {row.prixAccepte != null ? formatCurrency(row.prixAccepte) : '—'}
                        </td>
                        <td className={inst.td}>
                          {row.dateReception
                            ? formatIsoDateForDisplay(row.dateReception, locale)
                            : '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </InstitutionalSection>
      ) : (
        <>
          <InstitutionalSection title={t('Pipeline transaction RPA', 'RPA transaction pipeline')}>
            <div className="grid gap-3 md:grid-cols-3">
              {(['analyse_financiere', 'due_diligence', 'cloture'] as TransactionStage[]).map(
                (stage) => {
                  const isActive = stage === transactionStage;
                  return (
                    <article
                      key={stage}
                      className={cn(
                        'rounded-xl border-2 p-4 transition',
                        isActive
                          ? 'border-primexpert-dark bg-white dark:bg-primexpert-cardDark'
                          : 'border-primexpert-dark/25 bg-primexpert-light dark:bg-primexpert-cardDark'
                      )}
                    >
                      <p className="text-[11px] font-black uppercase tracking-wider text-slate-900">
                        {stageLabels[stage]}
                      </p>
                      <p className="mt-1 text-[12px] font-semibold text-slate-700">
                        {isActive
                          ? t('Étape active', 'Active stage')
                          : t('En attente', 'Pending')}
                      </p>
                    </article>
                  );
                }
              )}
            </div>

            {transactionStage === 'due_diligence' ? (
              <div className="mt-4 rounded-xl border-2 border-primexpert-dark/20 bg-white dark:bg-primexpert-cardDark p-4">
                <p className="text-[11px] font-black uppercase tracking-wider text-slate-900">
                  {t('Checklist diligence raisonnable', 'Due diligence checklist')}
                </p>
                <ul className="mt-3 space-y-2">
                  {dueDiligenceChecklist.map((item) => (
                    <li
                      key={item}
                      className="rounded-lg border border-primexpert-dark/15 bg-primexpert-light px-3 py-2 text-[13px] font-bold text-slate-900"
                    >
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </InstitutionalSection>

          <PartiesImpliquees
            title={t('Parties impliquées à la transaction', 'Parties involved in transaction')}
            labels={{
              coOwners: t('Co-propriétaires', 'Co-owners'),
              collaboratorBroker: t('Courtier collaborateur', 'Collaborating broker'),
              notary: t('Notaire', 'Notary'),
              lawyer: t('Avocat lié', 'Linked lawyer'),
              failSafe: t(
                'Aucun intervenant externe lié à cette transaction',
                'Aucun intervenant externe lié à cette transaction'
              ),
            }}
            coSellerIds={coSellerIds}
            collaboratorBrokerIds={collaboratorBrokerIds}
            notaryIds={notaryIds}
            lawyerIds={lawyerIds}
            collaboratorBrokerName={form.courtierCollaborateur?.nom}
            buyerName={form.buyer?.fullName}
          />

          <OffreTroncFinancierSection
            offre={offreTronc}
            locked={locked}
            onPersist={persistOffreTronc}
          />

          <OffreConditionsLegalesSection
            conditions={offreConditions}
            locked={locked}
            onPersist={persistOffreConditions}
          />

          <OffreClotureRetributionSection
            cloture={offreCloture}
            locked={locked}
            onPersist={persistOffreCloture}
          />

          <FinancialDataProvider residenceId={residence.id}>
            <ContractAssemblerPanel
              residence={residence}
              residenceDoc={residenceRecord ?? undefined}
              locked={locked}
            />
          </FinancialDataProvider>

          <InstitutionalSection title={t("Promesse d'achat et infos de vente", 'Purchase promise & sale info')}>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="block space-y-1">
                <span className={labelClass}>{t('Statut de la promesse', 'Promise status')}</span>
                {locked ? (
                  <p className="text-sm font-bold text-slate-900">
                    {language === 'fr'
                      ? PROMESSE_STATUS_OPTIONS.find((o) => o.value === form.status)?.labelFr
                      : PROMESSE_STATUS_OPTIONS.find((o) => o.value === form.status)?.labelEn}
                  </p>
                ) : (
                  <select
                    className={fieldClass}
                    value={form.status}
                    onChange={(e) =>
                      patchField('status', e.target.value as PromesseAchatInput['status'])
                    }
                    disabled={saving}
                  >
                    {PROMESSE_STATUS_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {language === 'fr' ? o.labelFr : o.labelEn}
                      </option>
                    ))}
                  </select>
                )}
              </label>

              <label className="block space-y-1">
                <span className={labelClass}>{t('Prix accepté ($)', 'Accepted price ($)')}</span>
                <input
                  type="number"
                  className={fieldClass}
                  value={form.prixAccepte ?? ''}
                  disabled={locked || saving}
                  onChange={(e) =>
                    patchField('prixAccepte', e.target.value === '' ? undefined : Number(e.target.value))
                  }
                />
              </label>

              <label className="block space-y-1">
                <span className={labelClass}>{t('Date de réception', 'Received date')}</span>
                <input
                  type="date"
                  className={fieldClass}
                  value={form.dateReception ?? ''}
                  disabled={locked || saving}
                  onChange={(e) => patchField('dateReception', e.target.value || undefined)}
                />
              </label>

              <label className="block space-y-1">
                <span className={labelClass}>{t('Délai de réponse (jours)', 'Response delay (days)')}</span>
                <input
                  type="number"
                  min={0}
                  className={fieldClass}
                  value={form.delaiReponseJours ?? ''}
                  disabled={locked || saving}
                  onChange={(e) =>
                    patchField(
                      'delaiReponseJours',
                      e.target.value === '' ? undefined : Number(e.target.value)
                    )
                  }
                />
              </label>

              <label className="block space-y-1">
                <span className={labelClass}>
                  {t('Date limite de réponse', 'Response deadline')}
                </span>
                <p className="text-sm font-black text-black tabular-nums">
                  {formatIsoDateForDisplay(vm.deadlines.dateLimiteReponse, locale)}
                </p>
              </label>

              <label className="block space-y-1">
                <span className={labelClass}>{t("Date d'acceptation", 'Acceptance date')}</span>
                <input
                  type="date"
                  className={fieldClass}
                  value={form.dateAcceptation ?? ''}
                  disabled={locked || saving}
                  onChange={(e) => patchField('dateAcceptation', e.target.value || undefined)}
                />
              </label>

              <label className="block space-y-1">
                <span className={labelClass}>{t('Date du notaire prévue', 'Expected notary date')}</span>
                <input
                  type="date"
                  className={fieldClass}
                  value={form.dateNotairePrevue ?? ''}
                  disabled={locked || saving}
                  onChange={(e) => patchField('dateNotairePrevue', e.target.value || undefined)}
                />
              </label>
            </div>

            <div className="mt-6 border-t border-slate-200 pt-5">
              <p className={cn(labelClass, 'mb-3')}>{t('Acheteur', 'Buyer')}</p>
              {!locked && (
                <div className="relative mb-3">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                  <input
                    type="search"
                    className={cn(fieldClass, 'pl-9')}
                    placeholder={t('Rechercher un contact interne…', 'Search internal contact…')}
                    value={contactQuery}
                    onChange={(e) => setContactQuery(e.target.value)}
                  />
                  {contactQuery.trim() && contactResults.length > 0 && (
                    <ul className="absolute z-10 mt-1 w-full rounded-xl border border-slate-200 bg-white shadow-sm max-h-40 overflow-y-auto">
                      {contactResults.map((c) => (
                        <li key={c.id}>
                          <button
                            type="button"
                            className="w-full text-left px-3 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-50"
                            onClick={() => linkContact(c)}
                          >
                            {c.fullName} · {c.email}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
              {form.buyer ? (
                <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                  <p className="text-sm font-bold text-slate-900">{form.buyer.fullName}</p>
                  {form.buyer.company ? (
                    <p className="text-sm text-slate-700">({form.buyer.company})</p>
                  ) : null}
                  <p className="mt-1 text-sm text-slate-700">{form.buyer.email}</p>
                  <p className="text-sm text-slate-700">{form.buyer.phone}</p>
                  <span className="inline-block mt-2 text-[9px] font-black uppercase tracking-widest text-slate-600 border border-slate-200 rounded-lg px-2 py-0.5">
                    {t('Contact interne', 'Internal contact')}
                  </span>
                </div>
              ) : (
                <p className="text-sm text-slate-600">
                  {t('Aucun acheteur lié.', 'No buyer linked.')}
                </p>
              )}
            </div>
          </InstitutionalSection>

          <PromesseDelaisPaSection
            form={form}
            vm={vm}
            locale={locale}
            locked={locked}
            saving={saving}
            onPersistDelais={(delais) => {
              if (locked) return;
              void persist({ ...form, delais });
            }}
          />

          <PromesseCommissionPaSection
            form={form}
            vm={vm}
            locked={locked}
            saving={saving}
            onPersistCommission={(commission) => {
              if (locked) return;
              void persist({ ...form, commission });
            }}
            onPersistCollaborateur={(courtierCollaborateur) => {
              if (locked) return;
              void persist({ ...form, courtierCollaborateur });
            }}
          />

          <InstitutionalSection
            title={t("Documents de la promesse d'achat", 'Purchase promise documents')}
          >
            {!locked && (
              <div className="mb-4">
                <input
                  ref={fileRef}
                  type="file"
                  className="hidden"
                  accept=".pdf,.docx,.xlsx,.xls"
                  multiple
                  onChange={(e) => void handleUpload(e.target.files)}
                />
                <button
                  type="button"
                  disabled={uploading}
                  onClick={() => fileRef.current?.click()}
                  className={`${institutionalListingsActionButtonClass} border-primexpert-dark/40 bg-white text-primexpert-dark hover:bg-primexpert-light disabled:opacity-50`}
                >
                  {uploading ? (
                    <Loader2 className="inline h-3.5 w-3.5 animate-spin mr-2" />
                  ) : null}
                  [ 📁 {t('Téléverser un document', 'Upload a document')} ]
                </button>
              </div>
            )}
            {docs.length === 0 ? (
              <p className="text-sm text-[#142c6a]">{t('Aucune pièce jointe.', 'No attachments.')}</p>
            ) : (
              <div className={inst.tableWrap}>
                <table className={inst.table}>
                  <thead>
                    <tr>
                      <th className={inst.th}>{t('Fichier', 'File')}</th>
                      <th className={inst.th}>{t('Ajouté', 'Added')}</th>
                      <th className={inst.thRight}>{t('Taille', 'Size')}</th>
                      <th className={inst.thRight}>{t('Actions', 'Actions')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {docs.map((doc) => (
                      <tr key={doc.id} className={inst.tr}>
                        <td className={cn(inst.td, 'text-[#142c6a] font-medium')}>
                          {doc.promesseDocLabel ?? doc.fileName}
                        </td>
                        <td className={inst.td}>
                          {new Date(doc.uploadedAtMillis).toLocaleString(locale)}
                        </td>
                        <td className={inst.tdValue}>{formatFileSize(doc.sizeBytes)}</td>
                        <td className={inst.tdValue}>
                          <div className="flex justify-end gap-2">
                            {doc.virusScanStatus === 'clean' && (
                              <button
                                type="button"
                                className="text-[10px] font-black uppercase tracking-widest underline text-slate-900"
                                onClick={() =>
                                  void getPropertyDocumentDownloadUrl(doc.storagePath).then(
                                    (url) => window.open(url, '_blank')
                                  )
                                }
                              >
                                {t('Télécharger', 'Download')}
                              </button>
                            )}
                            {!locked && (
                              <button
                                type="button"
                                className="text-[10px] font-black uppercase tracking-widest underline text-slate-900"
                                onClick={() =>
                                  void removePromesseDocument(residence.id, doc)
                                }
                              >
                                {t('Supprimer', 'Delete')}
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </InstitutionalSection>
        </>
      )}

      {saving && (
        <p className="text-[10px] font-mono text-slate-600 flex items-center gap-2">
          <Loader2 className="h-3 w-3 animate-spin" />
          {t('Enregistrement…', 'Saving…')}
        </p>
      )}
    </div>
  );
}

