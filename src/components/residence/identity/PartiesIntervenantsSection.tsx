import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, Pencil, Search, UserPlus, UserMinus, Users } from 'lucide-react';
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
  type ContactServiceContext,
} from '../../../services/contacts';
import { ContactFormDrawer } from '../../contacts/ContactFormDrawer';
import { IdentitySectionCard } from './IdentitySectionCard';

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

  const ctx: ContactServiceContext | null = useMemo(() => {
    if (!profile?.uid || !profile.orgId) return null;
    return { uid: profile.uid, orgId: profile.orgId, role: profile.role };
  }, [profile]);

  const parties = useMemo(
    () => (residenceDoc ? parsePartiesImpliquees(residenceDoc) : []),
    [residenceDoc]
  );

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

  const searchResults = useMemo(() => {
    const q = search.trim().toLowerCase();
    const linked = new Set(parties.map((p) => p.contactId));
    return contacts
      .filter((c) => !linked.has(c.id))
      .filter((c) => {
        if (!q) return true;
        const name = buildContactDisplayName(c).toLowerCase();
        return name.includes(q) || (c.email?.toLowerCase().includes(q) ?? false);
      })
      .slice(0, 8);
  }, [contacts, search, parties]);

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

  return (
    <>
      <IdentitySectionCard
        title={t('Parties et intervenants', 'Parties & stakeholders')}
        accent="#2656b7"
        headerAction={<Users className="h-4 w-4 text-[#142c6a]" aria-hidden />}
      >
        <p className="text-[11px] font-medium text-slate-600 mb-4 leading-relaxed">
          {t(
            'Liez les contacts de votre répertoire à cette inscription. Les données sont enregistrées sur la fiche résidence.',
            'Link contacts from your directory to this listing. Data is stored on the residence record.'
          )}
        </p>

        {localError ? (
          <p className="mb-3 text-sm font-bold text-red-600">{localError}</p>
        ) : null}

        <div className="mb-4 flex flex-wrap gap-2 items-end">
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
                placeholder={t('Nom ou courriel…', 'Name or email…')}
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

        {loadingContacts ? (
          <div className="flex items-center gap-2 text-sm text-[#142c6a] py-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            {t('Chargement des contacts…', 'Loading contacts…')}
          </div>
        ) : searchResults.length > 0 ? (
          <ul className="mb-4 rounded-xl border border-[#142c6a]/15 bg-slate-50 divide-y divide-slate-200">
            {searchResults.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  className="flex w-full items-center justify-between px-4 py-2.5 text-left hover:bg-white transition"
                  onClick={() => void handleLink(c.id)}
                  disabled={saving || linkPending}
                >
                  <span className="text-sm font-bold text-[#142c6a]">{buildContactDisplayName(c)}</span>
                  <span className="text-[10px] font-black uppercase text-primexpert-blue">
                    {t('Lier', 'Link')}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : search.trim() ? (
          <p className="text-xs text-slate-500 mb-4">
            {t('Aucun contact correspondant.', 'No matching contact.')}
          </p>
        ) : null}

        <div className="space-y-2">
          {parties.length === 0 ? (
            <p className="text-xs font-medium text-slate-500 py-4 text-center border border-dashed border-slate-300 rounded-xl">
              {t('Aucun intervenant lié.', 'No linked parties yet.')}
            </p>
          ) : (
            parties.map((p) => {
              const contact = contactCache[p.contactId];
              const name = contact ? buildContactDisplayName(contact) : p.contactId;
              return (
                <div
                  key={`${p.contactId}-${p.role}`}
                  className="flex items-center gap-3 rounded-xl border-2 border-[#142c6a]/15 bg-white px-4 py-3"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-black text-[#142c6a] truncate">{name}</p>
                    <p className="text-[10px] font-bold uppercase text-primexpert-blue">
                      {roleLabel(p.role)}
                    </p>
                  </div>
                  <button
                    type="button"
                    title={t('Modifier le contact', 'Edit contact')}
                    onClick={() => void openEdit(p.contactId)}
                    className="rounded-lg border border-[#142c6a]/20 p-2 text-[#142c6a] hover:bg-primexpert-light"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    title={t('Retirer du dossier', 'Remove from file')}
                    onClick={() => void handleUnlink(p.contactId)}
                    disabled={saving || linkPending}
                    className="rounded-lg border border-red-200 p-2 text-red-700 hover:bg-red-50 disabled:opacity-50"
                  >
                    <UserMinus className="h-4 w-4" />
                  </button>
                </div>
              );
            })
          )}
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
