/**
 * Promesse d'achat — pilotage transactionnel (OACIQ, WORM 6 ans).
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, Search } from 'lucide-react';
import {
  PROMESSE_STATUS_OPTIONS,
  WORM_LOCK_MESSAGE_EN,
  WORM_LOCK_MESSAGE_FR,
  appendOfferSummary,
  buildPromesseAchatViewModel,
  formatCurrencyCad,
  formatIsoDateForDisplay,
  parsePromesseAchatFromDoc,
  parsePromesseOffersFromDoc,
  serializePromesseAchatForFirestore,
  type PromesseAchatInput,
  type PromesseOfferSummaryRow,
} from '@primexpert/core/transaction';
import { useResidenceDocument } from '../../../context/ResidenceDocumentContext';
import { useAuth } from '../../../lib/auth';
import { useLanguage } from '../../../lib/i18n';
import { cn, formatCurrency } from '../../../lib/utils';
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

const fieldClass =
  'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-[#000000] focus:border-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-300 disabled:bg-slate-50 disabled:text-slate-600';

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

export function PromesseAchatTab({ residence, brokerId }: PromesseAchatTabProps) {
  const { t, language } = useLanguage();
  const locale = language === 'fr' ? 'fr-CA' : 'en-CA';
  const { profile } = useAuth();
  const { residenceDoc, loading, saving, saveError, updateResidence } = useResidenceDocument();

  const [innerTab, setInnerTab] = useState<InnerTab>('edit');
  const [form, setForm] = useState<PromesseAchatInput>({ status: 'draft' });
  const [offers, setOffers] = useState<PromesseOfferSummaryRow[]>([]);
  const [contactQuery, setContactQuery] = useState('');
  const [docs, setDocs] = useState<PromesseDocumentRecord[]>([]);
  const [uploading, setUploading] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const vm = useMemo(() => buildPromesseAchatViewModel(form), [form]);
  const locked = vm.isWormLocked;

  useEffect(() => {
    if (!residenceDoc) return;
    setForm(parsePromesseAchatFromDoc(residenceDoc));
    setOffers(parsePromesseOffersFromDoc(residenceDoc));
  }, [residenceDoc]);

  useEffect(() => {
    const unsub = subscribePromesseDocuments(residence.id, setDocs);
    return () => unsub();
  }, [residence.id]);

  const contactResults = useMemo(
    () => searchInternalContacts(contactQuery).filter((c) => c.type === 'Acheteur'),
    [contactQuery]
  );

  const persist = useCallback(
    async (next: PromesseAchatInput) => {
      setForm(next);
      const patch = serializePromesseAchatForFirestore(next);
      const nextOffers = appendOfferSummary(offers, next);
      await updateResidence({
        ...patch,
        promesseOffers: nextOffers,
      });
      setOffers(nextOffers);
    },
    [offers, updateResidence]
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
      <p className={inst.loadingText}>
        {t('Chargement de la promesse…', 'Loading purchase promise…')}
      </p>
    );
  }

  return (
    <div className="space-y-5">
      {locked && (
        <p className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-[#000000]">
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
                ? 'border-[#D4AF37]/50 bg-amber-50 text-[#000000]'
                : 'border-slate-200 bg-white text-slate-600 hover:text-[#000000]'
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
            <p className="text-sm text-[#000000]">
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
                        <td className={cn(inst.td, 'text-[#000000] font-semibold')}>
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
          <InstitutionalSection title={t("Promesse d'achat et infos de vente", 'Purchase promise & sale info')}>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="block space-y-1">
                <span className={labelClass}>{t('Statut de la promesse', 'Promise status')}</span>
                {locked ? (
                  <p className="text-sm font-semibold text-[#000000]">
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
                <span className={labelClass}>{t('Prix offert ($)', 'Offered price ($)')}</span>
                <input
                  type="number"
                  className={fieldClass}
                  value={form.prixOffert ?? ''}
                  disabled={locked || saving}
                  onChange={(e) =>
                    patchField('prixOffert', e.target.value === '' ? undefined : Number(e.target.value))
                  }
                />
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
                <p className="text-sm font-semibold text-[#000000] tabular-nums">
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
                            className="w-full text-left px-3 py-2 text-sm text-[#000000] hover:bg-slate-50"
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
                  <p className="text-sm font-semibold text-[#000000]">{form.buyer.fullName}</p>
                  {form.buyer.company ? (
                    <p className="text-sm text-[#000000]">({form.buyer.company})</p>
                  ) : null}
                  <p className="text-sm text-[#000000] mt-1">{form.buyer.email}</p>
                  <p className="text-sm text-[#000000]">{form.buyer.phone}</p>
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

          <InstitutionalSection title={t('Dates limites et délais', 'Deadlines & delays')}>
            <DeadlineRow
              labelFr="Délai visite des lieux (jours)"
              labelEn="Property visit delay (days)"
              days={form.delais?.visiteLieuxJours}
              computed={vm.deadlines.dateLimiteVisiteLieux}
              locale={locale}
              locked={locked}
              saving={saving}
              onDays={(v) =>
                patchField('delais', { ...form.delais, visiteLieuxJours: v })
              }
              t={t}
            />
            <DeadlineRow
              labelFr="Délai vérification des documents (jours)"
              labelEn="Document review delay (days)"
              days={form.delais?.verificationDocumentsJours}
              computed={vm.deadlines.dateLimiteVerificationDocuments}
              locale={locale}
              locked={locked}
              saving={saving}
              onDays={(v) =>
                patchField('delais', { ...form.delais, verificationDocumentsJours: v })
              }
              t={t}
            />
            <DeadlineRow
              labelFr="Délai inspection (jours)"
              labelEn="Inspection delay (days)"
              days={form.delais?.inspectionJours}
              computed={vm.deadlines.dateLimiteInspection}
              locale={locale}
              locked={locked}
              saving={saving}
              onDays={(v) =>
                patchField('delais', { ...form.delais, inspectionJours: v })
              }
              t={t}
            />
            <DeadlineRow
              labelFr="Délai financement hypothécaire (jours)"
              labelEn="Mortgage financing delay (days)"
              days={form.delais?.financementJours}
              computed={vm.deadlines.dateLimiteFinancement}
              locale={locale}
              locked={locked}
              saving={saving}
              onDays={(v) =>
                patchField('delais', { ...form.delais, financementJours: v })
              }
              t={t}
            />
            <DeadlineRow
              labelFr="Délai permis (jours)"
              labelEn="Permit delay (days)"
              days={form.delais?.permisJours}
              computed={vm.deadlines.dateLimitePermis}
              locale={locale}
              locked={locked}
              saving={saving}
              onDays={(v) => patchField('delais', { ...form.delais, permisJours: v })}
              t={t}
            />
          </InstitutionalSection>

          <InstitutionalSection title={t('Commission et courtiers collaborateurs', 'Commission & collaborating brokers')}>
            <div className="grid gap-4 md:grid-cols-3">
              <label className="block space-y-1">
                <span className={labelClass}>{t('Commission totale (%)', 'Total commission (%)')}</span>
                <input
                  type="number"
                  step="0.01"
                  className={fieldClass}
                  disabled={locked || saving}
                  value={form.commission?.totalePct ?? ''}
                  onChange={(e) =>
                    patchField('commission', {
                      ...form.commission,
                      totalePct: e.target.value === '' ? undefined : Number(e.target.value),
                    })
                  }
                />
              </label>
              <label className="block space-y-1">
                <span className={labelClass}>
                  {t('Commission courtier inscripteur (%)', 'Listing broker commission (%)')}
                </span>
                <input
                  type="number"
                  step="0.01"
                  className={fieldClass}
                  disabled={locked || saving}
                  value={form.commission?.inscripteurPct ?? ''}
                  onChange={(e) =>
                    patchField('commission', {
                      ...form.commission,
                      inscripteurPct: e.target.value === '' ? undefined : Number(e.target.value),
                    })
                  }
                />
              </label>
              <label className="block space-y-1">
                <span className={labelClass}>
                  {t('Commission courtier collaborateur (%)', 'Co-broker commission (%)')}
                </span>
                <input
                  type="number"
                  step="0.01"
                  className={fieldClass}
                  disabled={locked || saving}
                  value={form.commission?.collaborateurPct ?? ''}
                  onChange={(e) =>
                    patchField('commission', {
                      ...form.commission,
                      collaborateurPct:
                        e.target.value === '' ? undefined : Number(e.target.value),
                    })
                  }
                />
              </label>
            </div>
            <p className="mt-4 text-sm font-semibold text-[#000000]">
              {t('Montant de la commission totale ($)', 'Total commission amount ($)')}:{' '}
              {formatCurrencyCad(vm.commission.montantCommissionTotale)}
            </p>

            <div className="mt-6 border-t border-slate-200 pt-4 grid gap-3 md:grid-cols-2">
              <p className={cn(labelClass, 'md:col-span-2')}>
                {t('Courtier collaborateur (partie adverse)', 'Collaborating broker (other side)')}
              </p>
              {(['nom', 'telephone', 'courriel', 'partCommissionPct'] as const).map((key) => {
                const labels = {
                  nom: t('Nom', 'Name'),
                  telephone: t('Téléphone', 'Phone'),
                  courriel: t('Courriel', 'Email'),
                  partCommissionPct: t('Part de commission (%)', 'Commission share (%)'),
                };
                return (
                  <label key={key} className="block space-y-1">
                    <span className={labelClass}>{labels[key]}</span>
                    <input
                      type={key === 'partCommissionPct' ? 'number' : 'text'}
                      className={fieldClass}
                      disabled={locked || saving}
                      value={
                        key === 'partCommissionPct'
                          ? form.courtierCollaborateur?.partCommissionPct ?? ''
                          : (form.courtierCollaborateur?.[key] ?? '')
                      }
                      onChange={(e) =>
                        patchField('courtierCollaborateur', {
                          ...form.courtierCollaborateur,
                          [key]:
                            key === 'partCommissionPct'
                              ? e.target.value === ''
                                ? undefined
                                : Number(e.target.value)
                              : e.target.value,
                        })
                      }
                    />
                  </label>
                );
              })}
            </div>
          </InstitutionalSection>

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
                  className="rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-[11px] font-black uppercase tracking-[0.12em] text-[#000000] hover:border-slate-300 disabled:opacity-50"
                >
                  {uploading ? (
                    <Loader2 className="inline h-3.5 w-3.5 animate-spin mr-2" />
                  ) : null}
                  [ 📁 {t('Téléverser un document', 'Upload a document')} ]
                </button>
              </div>
            )}
            {docs.length === 0 ? (
              <p className="text-sm text-[#000000]">{t('Aucune pièce jointe.', 'No attachments.')}</p>
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
                        <td className={cn(inst.td, 'text-[#000000] font-medium')}>
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
                                className="text-[10px] font-black uppercase tracking-widest underline text-[#000000]"
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
                                className="text-[10px] font-black uppercase tracking-widest underline text-[#000000]"
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

function DeadlineRow({
  labelFr,
  labelEn,
  days,
  computed,
  locale,
  locked,
  saving,
  onDays,
  t,
}: {
  labelFr: string;
  labelEn: string;
  days?: number;
  computed?: string;
  locale: string;
  locked: boolean;
  saving: boolean;
  onDays: (v: number | undefined) => void;
  t: (fr: string, en: string) => string;
}) {
  const { language } = useLanguage();
  return (
    <div className="grid gap-3 md:grid-cols-2 border-b border-slate-100 py-3 last:border-0">
      <label className="block space-y-1">
        <span className={labelClass}>{language === 'fr' ? labelFr : labelEn}</span>
        <input
          type="number"
          min={0}
          className={fieldClass}
          disabled={locked || saving}
          value={days ?? ''}
          onChange={(e) =>
            onDays(e.target.value === '' ? undefined : Number(e.target.value))
          }
        />
      </label>
      <div>
        <span className={labelClass}>
          {language === 'fr' ? labelFr.replace('(jours)', '— date') : labelEn.replace('(days)', '— date')}
        </span>
        <p className="text-sm font-semibold text-[#000000] tabular-nums mt-2">
          {formatIsoDateForDisplay(computed, locale)}
        </p>
      </div>
    </div>
  );
}
