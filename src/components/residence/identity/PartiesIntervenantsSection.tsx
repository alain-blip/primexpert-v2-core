import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Loader2,
  Mail,
  MessageSquare,
  Pencil,
  Phone,
  PhoneCall,
  PhoneOff,
  Search,
  UserPlus,
  UserMinus,
  Users,
} from 'lucide-react';
import {
  parsePartiesImpliquees,
  RESIDENCE_PARTY_ROLES,
  RESIDENCE_PARTY_ROLE_LABEL_EN,
  RESIDENCE_PARTY_ROLE_LABEL_FR,
  type ResidencePartyRole,
} from '@primexpert/core/residence';
import {
  buildContactDisplayName,
  type OrganizationContact,
} from '@primexpert/core/crm';
import { useResidenceDocument } from '../../../context/ResidenceDocumentContext';
import { useAuth } from '../../../lib/auth';
import { useLanguage } from '../../../lib/i18n';
import { cn } from '../../../lib/utils';
import {
  listOrganizationContacts,
  getOrganizationContactById,
  linkContactToResidence,
  unlinkContactFromResidence,
  type ContactServiceContext,
} from '../../../services/contacts';
import { ContactFormDrawer } from '../../contacts/ContactFormDrawer';
import { IdentitySectionCard } from './IdentitySectionCard';
import { canUseVoip } from '../../../lib/voipAccess';
import {
  contactsWithEmail,
  contactsWithPhone,
  openMailToContacts,
  openSmsUri,
  openTelFallback,
  partySelectionKey,
} from '../../../lib/partyQuickCommunications';
import {
  hangupBrowserCall,
  isCallActive,
  makeBrowserCall,
  subscribeCallActive,
} from '../../../services/twilioVoiceService';
import { useInstitutionalToast } from '../../../hooks/useInstitutionalToast';

const PARTY_ROLE_SORT: Record<ResidencePartyRole, number> = {
  VENDEUR: 0,
  ACHETEUR: 1,
  NOTAIRE: 2,
  COLLABORATEUR: 3,
};

const MIN_SEARCH_CHARS = 2;

const LINKED_PARTY_CARD_CLASS =
  'flex items-center gap-3 rounded-xl border-2 border-blue-200 bg-blue-50/70 px-4 py-3';

export function PartiesIntervenantsSection() {
  const { t, language } = useLanguage();
  const { profile } = useAuth();
  const { residenceDoc, residenceId, saving } = useResidenceDocument();
  const [linkPending, setLinkPending] = useState(false);
  const isFr = language === 'fr';

  const [contacts, setContacts] = useState<OrganizationContact[]>([]);
  const [contactCache, setContactCache] = useState<Record<string, OrganizationContact>>({});
  const [loadingContacts, setLoadingContacts] = useState(true);
  const [search, setSearch] = useState('');
  const [rolePick, setRolePick] = useState<ResidencePartyRole>('VENDEUR');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<OrganizationContact | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(() => new Set());
  const [callPending, setCallPending] = useState(false);
  const [callActive, setCallActive] = useState(false);
  const { showSuccess, showError } = useInstitutionalToast();
  const voipEnabled = canUseVoip(profile);

  useEffect(() => subscribeCallActive(setCallActive), []);

  const ctx: ContactServiceContext | null = useMemo(() => {
    if (!profile?.uid || !profile.orgId) return null;
    return { uid: profile.uid, orgId: profile.orgId, role: profile.role };
  }, [profile]);

  const parties = useMemo(() => {
    const list = residenceDoc ? parsePartiesImpliquees(residenceDoc) : [];
    return [...list].sort((a, b) => {
      const byRole = PARTY_ROLE_SORT[a.role] - PARTY_ROLE_SORT[b.role];
      if (byRole !== 0) return byRole;
      return a.assigneLe.localeCompare(b.assigneLe);
    });
  }, [residenceDoc]);

  const refreshContacts = useCallback(async () => {
    if (!ctx) return;
    setLoadingContacts(true);
    try {
      const rows = await listOrganizationContacts(ctx);
      setContacts(rows);
      const cache: Record<string, OrganizationContact> = {};
      for (const r of rows) cache[r.id] = r;
      setContactCache(cache);
    } finally {
      setLoadingContacts(false);
    }
  }, [ctx]);

  useEffect(() => {
    void refreshContacts();
  }, [refreshContacts]);

  const partyContactIds = useMemo(
    () => parties.map((p) => p.contactId).join(','),
    [parties]
  );

  useEffect(() => {
    if (!ctx || !partyContactIds) return;
    const ids = partyContactIds.split(',').filter(Boolean);
    let cancelled = false;
    void (async () => {
      for (const contactId of ids) {
        const row = await getOrganizationContactById(ctx, contactId);
        if (cancelled || !row) continue;
        setContactCache((prev) =>
          prev[contactId] ? prev : { ...prev, [contactId]: row }
        );
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ctx, partyContactIds]);

  const searchQuery = search.trim().toLowerCase();
  const searchActive = searchQuery.length >= MIN_SEARCH_CHARS;

  const searchResults = useMemo(() => {
    if (!searchActive) return [];
    const linked = new Set(parties.map((p) => p.contactId));
    return contacts
      .filter((c) => !linked.has(c.id))
      .filter((c) => {
        const name = buildContactDisplayName(c).toLowerCase();
        return (
          name.includes(searchQuery) ||
          (c.email?.toLowerCase().includes(searchQuery) ?? false) ||
          (c.telephone?.replace(/\D/g, '').includes(searchQuery.replace(/\D/g, '')) ?? false)
        );
      })
      .slice(0, 8);
  }, [contacts, searchActive, searchQuery, parties]);

  const handleLink = async (contactId: string) => {
    if (!ctx || !residenceDoc || !residenceId) return;
    setLocalError(null);
    setLinkPending(true);
    try {
      const res = await linkContactToResidence(ctx, {
        residenceId,
        residenceDoc,
        contactId,
        role: rolePick,
      });
      if (!res.ok) {
        const msg =
          res.error === 'forbidden'
            ? t(
                'Seuls vos contacts peuvent être liés (propriétaire du contact).',
                'Only contacts you own can be linked (contact owner).'
              )
            : t(
                'Échec de la liaison — réessayez.',
                'Link failed — please retry.'
              );
        setLocalError(msg);
        return;
      }
      setSearch('');
      await refreshContacts();
    } catch (e) {
      setLocalError(e instanceof Error ? e.message : String(e));
    } finally {
      setLinkPending(false);
    }
  };

  const handleUnlink = async (contactId: string) => {
    if (!ctx || !residenceDoc || !residenceId) return;
    setLocalError(null);
    setLinkPending(true);
    try {
      const res = await unlinkContactFromResidence(ctx, {
        residenceId,
        residenceDoc,
        contactId,
      });
      if (!res.ok) {
        setLocalError(
          t('Échec du retrait — réessayez.', 'Unlink failed — please retry.')
        );
        return;
      }
      await refreshContacts();
    } catch (e) {
      setLocalError(e instanceof Error ? e.message : String(e));
    } finally {
      setLinkPending(false);
    }
  };

  const openEdit = async (contactId: string) => {
    if (!ctx) return;
    let row = contactCache[contactId];
    if (!row) {
      row = (await getOrganizationContactById(ctx, contactId)) ?? undefined;
      if (row) setContactCache((prev) => ({ ...prev, [row!.id]: row! }));
    }
    if (row) {
      setEditingContact(row);
      setDrawerOpen(true);
    }
  };

  const roleLabel = (role: ResidencePartyRole) =>
    isFr ? RESIDENCE_PARTY_ROLE_LABEL_FR[role] : RESIDENCE_PARTY_ROLE_LABEL_EN[role];

  const residenceLabel =
    residenceDoc?.adresse != null
      ? String(residenceDoc.adresse)
      : residenceId ?? '';

  const selectedPartyRows = useMemo(() => {
    return parties
      .filter((p) => selectedKeys.has(partySelectionKey(p.contactId, p.role)))
      .map((p) => {
        const contact = contactCache[p.contactId];
        if (!contact) return null;
        return { party: p, contact };
      })
      .filter((r): r is { party: (typeof parties)[0]; contact: OrganizationContact } => r != null);
  }, [parties, selectedKeys, contactCache]);

  const hasSelection = selectedKeys.size > 0;

  const toggleSelection = (contactId: string, role: ResidencePartyRole) => {
    const key = partySelectionKey(contactId, role);
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const clearSelection = () => setSelectedKeys(new Set());

  const handleCall = async () => {
    const dialRows = contactsWithPhone(
      selectedPartyRows.map((r) => ({ contact: r.contact, role: r.party.role }))
    );
    if (dialRows.length === 0) {
      showError(
        t(
          'Aucun téléphone sur les contacts sélectionnés.',
          'No phone number on selected contacts.'
        )
      );
      return;
    }
    const target = dialRows[0]!;
    setCallPending(true);
    try {
      if (voipEnabled && profile?.uid) {
        await makeBrowserCall(
          target.phone,
          residenceId ?? null,
          profile.uid,
          target.contact.id
        );
        const name = buildContactDisplayName(target.contact);
        showSuccess(
          dialRows.length > 1
            ? t(
                `Appel intégré vers ${name} (premier numéro — ${dialRows.length - 1} autre(s) non appelé(s))`,
                `Integrated call to ${name} (first number — ${dialRows.length - 1} other(s) skipped)`
              )
            : t(`Appel intégré lancé vers ${name}`, `Integrated call started to ${name}`)
        );
      } else {
        openTelFallback(target.phone);
        const name = buildContactDisplayName(target.contact);
        showSuccess(
          dialRows.length > 1
            ? t(
                `Appel système vers ${name} (téléphonie intégrée inactive)`,
                `System call to ${name} (integrated telephony inactive)`
              )
            : t(
                'Ouverture de l’app téléphone (téléphonie intégrée non activée).',
                'Opening phone app (integrated telephony not enabled).'
              )
        );
      }
    } catch (e) {
      showError(e instanceof Error ? e.message : String(e));
    } finally {
      setCallPending(false);
    }
  };

  const handleHangup = () => {
    if (!isCallActive()) return;
    hangupBrowserCall();
    showSuccess(
      t(
        'Ligne fermée — vérification de fermeture de ligne de conformité enregistrée.',
        'Line disconnected — compliance line closure verification recorded.'
      )
    );
  };

  const handleSms = () => {
    const dialRows = contactsWithPhone(
      selectedPartyRows.map((r) => ({ contact: r.contact, role: r.party.role }))
    );
    if (dialRows.length === 0) {
      showError(
        t(
          'Aucun téléphone sur les contacts sélectionnés.',
          'No phone number on selected contacts.'
        )
      );
      return;
    }
    openSmsUri(dialRows[0]!.phone);
    if (dialRows.length > 1) {
      showError(
        t(
          'Un SMS à la fois — premier numéro ouvert.',
          'One SMS at a time — first number opened.'
        )
      );
    }
  };

  const handleEmail = () => {
    const emailRows = contactsWithEmail(
      selectedPartyRows.map((r) => ({ contact: r.contact, role: r.party.role }))
    );
    if (emailRows.length === 0) {
      showError(
        t(
          'Aucun courriel sur les contacts sélectionnés.',
          'No email on selected contacts.'
        )
      );
      return;
    }
    openMailToContacts(
      emailRows.map((r) => ({ contact: r.contact, email: r.email })),
      residenceLabel
    );
  };

  return (
    <>
      <IdentitySectionCard
        title={t('Parties et intervenants', 'Parties & stakeholders')}
        accent="#2656b7"
        headerAction={<Users className="h-4 w-4 text-[#142c6a]" aria-hidden />}
      >
        <p className="text-[11px] font-medium text-slate-600 mb-4 leading-relaxed">
          {t(
            'Liez les contacts de votre répertoire à cette inscription. Vous pouvez associer plusieurs vendeurs (co-indivisaires, administrateurs) au même immeuble.',
            'Link contacts from your directory to this listing. You can associate several sellers (co-owners, administrators) with the same property.'
          )}
        </p>

        {localError ? (
          <p className="mb-3 text-sm font-bold text-red-600">{localError}</p>
        ) : null}

        {hasSelection ? (
          <div
            className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border-2 border-[#D4AF37]/40 bg-amber-50/80 px-3 py-3"
            role="toolbar"
            aria-label={t('Actions rapides', 'Quick actions')}
          >
            <span className="text-[10px] font-black uppercase tracking-widest text-[#142c6a] mr-1">
              {t(
                `${selectedKeys.size} sélectionné(s)`,
                `${selectedKeys.size} selected`
              )}
            </span>
            {voipEnabled && callActive ? (
              <button
                type="button"
                onClick={handleHangup}
                className="inline-flex items-center gap-1.5 rounded-lg border-2 border-red-700 bg-red-600 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-white hover:bg-red-700"
                aria-label={t('Raccrocher', 'Hang up')}
              >
                <PhoneOff className="h-3.5 w-3.5" aria-hidden />
                {t('Raccrocher', 'Hang up')}
              </button>
            ) : (
              <button
                type="button"
                disabled={callPending || (voipEnabled && callActive)}
                onClick={() => void handleCall()}
                className="inline-flex items-center gap-1.5 rounded-lg border-2 border-[#142c6a] bg-[#142c6a] px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-white hover:bg-[#1e3d8f] disabled:opacity-50"
              >
                {callPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                ) : (
                  <PhoneCall className="h-3.5 w-3.5" aria-hidden />
                )}
                {t('Appeler', 'Call')}
              </button>
            )}
            <button
              type="button"
              onClick={handleSms}
              className="inline-flex items-center gap-1.5 rounded-lg border-2 border-[#142c6a]/30 bg-white px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-[#142c6a] hover:bg-blue-50"
            >
              <MessageSquare className="h-3.5 w-3.5" aria-hidden />
              {t('Envoyer un SMS', 'Send SMS')}
            </button>
            <button
              type="button"
              onClick={handleEmail}
              className="inline-flex items-center gap-1.5 rounded-lg border-2 border-[#142c6a]/30 bg-white px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-[#142c6a] hover:bg-blue-50"
            >
              <Mail className="h-3.5 w-3.5" aria-hidden />
              {t('Envoyer un courriel', 'Send email')}
            </button>
            <button
              type="button"
              onClick={clearSelection}
              className="ml-auto text-[10px] font-bold uppercase tracking-widest text-slate-500 hover:text-[#142c6a]"
            >
              {t('Tout décocher', 'Clear selection')}
            </button>
          </div>
        ) : null}

        {/* Intervenants déjà liés — en premier, carte bleue par personne */}
        <div className="space-y-2 mb-5">
          {parties.length === 0 ? (
            <p className="text-xs font-medium text-slate-500 py-4 text-center border border-dashed border-slate-300 rounded-xl bg-white">
              {t('Aucun intervenant lié.', 'No linked parties yet.')}
            </p>
          ) : (
            parties.map((p) => {
              const contact = contactCache[p.contactId];
              const name = contact ? buildContactDisplayName(contact) : p.contactId;
              const selKey = partySelectionKey(p.contactId, p.role);
              const checked = selectedKeys.has(selKey);
              return (
                <div key={`${p.contactId}-${p.role}`} className={LINKED_PARTY_CARD_CLASS}>
                  <label
                    className="flex shrink-0 items-center justify-center cursor-pointer"
                    title={t('Sélectionner pour actions rapides', 'Select for quick actions')}
                  >
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-2 border-[#142c6a]/40 text-[#142c6a] focus:ring-[#D4AF37]/50"
                      checked={checked}
                      onChange={() => toggleSelection(p.contactId, p.role)}
                      aria-label={t(
                        `Sélectionner ${name}`,
                        `Select ${name}`
                      )}
                    />
                  </label>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-black text-[#142c6a] truncate">{name}</p>
                    <p className="text-[10px] font-bold uppercase text-primexpert-blue">
                      {roleLabel(p.role)}
                    </p>
                    {contact?.telephone ? (
                      <p className="mt-1 inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700">
                        <Phone className="h-3.5 w-3.5 text-slate-500 shrink-0" />
                        <span className="truncate">{contact.telephone}</span>
                      </p>
                    ) : null}
                    {contact?.email ? (
                      <p className="mt-0.5 inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700">
                        <Mail className="h-3.5 w-3.5 text-slate-500 shrink-0" />
                        <span className="truncate">{contact.email}</span>
                      </p>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    title={t('Modifier le contact', 'Edit contact')}
                    onClick={() => void openEdit(p.contactId)}
                    className="rounded-lg border border-blue-200 bg-white p-2 text-[#142c6a] hover:bg-blue-50"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    title={t('Retirer du dossier', 'Remove from file')}
                    onClick={() => void handleUnlink(p.contactId)}
                    disabled={saving || linkPending}
                    className="rounded-lg border border-red-200 bg-white p-2 text-red-700 hover:bg-red-50 disabled:opacity-50"
                  >
                    <UserMinus className="h-4 w-4" />
                  </button>
                </div>
              );
            })
          )}
        </div>

        {/* Recherche — sous les liés, suggestions seulement si ≥ 2 caractères */}
        <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4">
          <p className="text-[10px] font-black uppercase tracking-widest text-[#142c6a] mb-3">
            {t('Ajouter un intervenant', 'Add a party')}
          </p>
          <div className="flex flex-wrap gap-2 items-end">
            <div className="flex-1 min-w-[200px]">
              <label className="text-[10px] font-black uppercase tracking-widest text-[#142c6a]">
                {t('Rechercher un contact', 'Search contact')}
              </label>
              <div className="relative mt-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#142c6a]/50" />
                <input
                  className="w-full rounded-lg border-2 border-[#142c6a]/20 bg-white py-2 pl-9 pr-3 text-sm font-medium text-[#142c6a]"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={t('Nom ou courriel (min. 2 car.)…', 'Name or email (min. 2 chars)…')}
                  autoComplete="off"
                />
              </div>
            </div>
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-[#142c6a]">
                {t('Rôle', 'Role')}
              </label>
              <select
                className="mt-1 rounded-lg border-2 border-[#142c6a]/20 bg-white px-3 py-2 text-sm font-bold text-[#142c6a]"
                value={rolePick}
                onChange={(e) => setRolePick(e.target.value as ResidencePartyRole)}
              >
                {RESIDENCE_PARTY_ROLES.map((r) => (
                  <option key={r} value={r}>
                    {roleLabel(r)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {loadingContacts && searchActive ? (
            <div className="mt-3 flex items-center gap-2 text-sm text-[#142c6a]">
              <Loader2 className="h-4 w-4 animate-spin" />
              {t('Recherche…', 'Searching…')}
            </div>
          ) : null}

          {searchActive && !loadingContacts && searchResults.length > 0 ? (
            <ul
              className="mt-3 rounded-xl border border-[#142c6a]/15 bg-white divide-y divide-slate-200 shadow-sm"
              role="listbox"
            >
              {searchResults.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    className="flex w-full items-center justify-between px-4 py-2.5 text-left hover:bg-blue-50/50 transition"
                    onClick={() => void handleLink(c.id)}
                    disabled={saving || linkPending}
                  >
                    <span className="text-sm font-bold text-[#142c6a]">
                      {buildContactDisplayName(c)}
                    </span>
                    <span className="text-[10px] font-black uppercase text-primexpert-blue">
                      {linkPending
                        ? t('Liaison…', 'Linking…')
                        : t('Ajouter', 'Add')}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}

          {searchActive && !loadingContacts && searchResults.length === 0 ? (
            <p className="mt-3 text-xs text-slate-500">
              {t('Aucun contact correspondant.', 'No matching contact.')}
            </p>
          ) : null}
        </div>

        {ctx ? (
          <button
            type="button"
            onClick={() => {
              setEditingContact(null);
              setDrawerOpen(true);
            }}
            className={cn(
              'mt-4 flex items-center gap-2 rounded-xl border-2 border-[#142c6a] px-4 py-2',
              'text-[10px] font-black uppercase tracking-widest text-[#142c6a] hover:bg-primexpert-light'
            )}
          >
            <UserPlus className="h-4 w-4" />
            {t('Nouveau contact', 'New contact')}
          </button>
        ) : null}
      </IdentitySectionCard>

      {ctx ? (
        <ContactFormDrawer
          open={drawerOpen}
          onClose={() => {
            setDrawerOpen(false);
            setEditingContact(null);
          }}
          ctx={ctx}
          editing={editingContact}
          onSaved={() => void refreshContacts()}
        />
      ) : null}
    </>
  );
}
