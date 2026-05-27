import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ChevronRight,
  Mail,
  Phone,
  Search,
  UserPlus,
  UserCog,
  Filter,
  Info,
  Loader2,
  X,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { useLanguage } from '../../lib/i18n';
import { useAuth } from '../../lib/auth';
import {
  applyContactListClientFilters,
  applyContactListFilter,
  canAdminReassignContactOwner,
  contactInitials,
  contactListFilterLabelEn,
  contactListFilterLabelFr,
  CONTACT_LIST_FILTERS,
  CONTACT_RELATION_ROLES,
  CONTACT_ROLE_LABEL_EN,
  CONTACT_ROLE_LABEL_FR,
  formatContactRoles,
  formatContactSiloBadge,
  buildContactDisplayName,
  BUYER_TIER_FILTER_OPTIONS,
  formatBuyerTierLabel,
  formatBuyerTierTooltip,
  formatProfessionalTypeLabel,
  type BuyerCommercialTier,
  type ContactListFilter,
  type ContactRelationRole,
  type OrganizationContact,
} from '@primexpert/core/crm';
import {
  listOrganizationContacts,
  listOrganizationBrokers,
  reassignContactOwner,
  type ContactServiceContext,
} from '../../services/contacts';
import {
  institutionalPanelShellClass,
  institutionalPanelSubtitleClass,
  institutionalPanelTitleClass,
  institutionalWhiteCardClass,
} from '../../lib/institutionalTheme';
import { ContactFormDrawer } from './ContactFormDrawer';
import { BuyerTierBadge } from './BuyerTierBadge';
import { CRM_INBOUND_QUEUE_KEY } from '../../lib/crmInboundQueue';

export function ContactsListPage() {
  const { t, language } = useLanguage();
  const { profile } = useAuth();
  const isFr = language === 'fr';

  const [contacts, setContacts] = useState<OrganizationContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [filter, setFilter] = useState<ContactListFilter>('mine');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRole, setSelectedRole] = useState<ContactRelationRole | null>(null);
  const [selectedBuyerTier, setSelectedBuyerTier] = useState<BuyerCommercialTier | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<OrganizationContact | null>(null);
  const [reassignTarget, setReassignTarget] = useState<OrganizationContact | null>(null);
  const [brokers, setBrokers] = useState<{ uid: string; displayName: string }[]>([]);
  const [reassignUid, setReassignUid] = useState('');
  const [reassignPending, setReassignPending] = useState(false);

  const ctx: ContactServiceContext | null = useMemo(() => {
    if (!profile?.uid || !profile.orgId) return null;
    return {
      uid: profile.uid,
      orgId: profile.orgId,
      role: profile.role,
    };
  }, [profile]);

  const isAdmin = profile?.role === 'admin' || profile?.role === 'admin_system';

  const refresh = useCallback(async () => {
    if (!ctx) {
      setContacts([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setLoadError(null);
    try {
      const rows = await listOrganizationContacts(ctx);
      setContacts(rows);
    } catch (e) {
      console.error('[ContactsListPage] load failed', e);
      setLoadError(
        t(
          'Impossible de charger les contacts (permissions Firestore?).',
          'Unable to load contacts (Firestore permissions?).'
        )
      );
    } finally {
      setLoading(false);
    }
  }, [ctx, t]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!isAdmin || !profile?.orgId) return;
    void listOrganizationBrokers(profile.orgId).then((rows) =>
      setBrokers(rows.map((b) => ({ uid: b.uid, displayName: b.displayName })))
    );
  }, [isAdmin, profile?.orgId]);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(CRM_INBOUND_QUEUE_KEY);
      if (!raw || !ctx) return;
      const parsed = JSON.parse(raw) as unknown;
      if (!Array.isArray(parsed) || parsed.length === 0) return;
      sessionStorage.removeItem(CRM_INBOUND_QUEUE_KEY);
      setDrawerOpen(true);
      setEditing(null);
    } catch (e) {
      console.warn('[ContactsListPage] inbound queue', e);
    }
  }, [ctx]);

  const scopeFiltered = useMemo(() => {
    if (!ctx) return [];
    return applyContactListFilter(contacts, filter, ctx.uid);
  }, [contacts, filter, ctx]);

  const visible = useMemo(() => {
    if (!ctx) return [];
    return applyContactListClientFilters(contacts, {
      listFilter: filter,
      currentUid: ctx.uid,
      searchQuery,
      selectedRole,
      selectedBuyerTier,
    });
  }, [contacts, filter, ctx, searchQuery, selectedRole, selectedBuyerTier]);

  const roleLabel = (role: ContactRelationRole) =>
    isFr ? CONTACT_ROLE_LABEL_FR[role] : CONTACT_ROLE_LABEL_EN[role];

  const hasClientFilters =
    searchQuery.trim().length > 0 || selectedRole != null || selectedBuyerTier != null;

  const openCreate = () => {
    setEditing(null);
    setDrawerOpen(true);
  };

  const openEdit = (c: OrganizationContact) => {
    setEditing(c);
    setDrawerOpen(true);
  };

  const handleReassign = async () => {
    if (!ctx || !reassignTarget || !reassignUid) return;
    setReassignPending(true);
    try {
      const res = await reassignContactOwner(ctx, reassignTarget.id, reassignUid);
      if (!res.ok) {
        alert(
          t(
            'Réassignation refusée (lead non redistribuable ou droits insuffisants).',
            'Reassignment denied.'
          )
        );
        return;
      }
      setReassignTarget(null);
      setReassignUid('');
      await refresh();
    } finally {
      setReassignPending(false);
    }
  };

  if (!profile?.orgId) {
    return (
      <section className={institutionalPanelShellClass}>
        <p className="text-white font-bold">
          {t(
            'Profil incomplet — identifiant d’organisation manquant.',
            'Incomplete profile — missing organization id.'
          )}
        </p>
      </section>
    );
  }

  return (
    <section className={cn(institutionalPanelShellClass, 'space-y-6')}>
      <header className="px-1 flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <h1 className={institutionalPanelTitleClass}>
            {t('Répertoire clients', 'Client directory')}
          </h1>
          <p className={institutionalPanelSubtitleClass}>
            {t(
              'Contacts cloisonnés par courtier — pool résidence pour aînés (RPA) partagé en agence.',
              'Broker-scoped contacts — retirement home (RPA) agency pool.'
            )}
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="flex items-center gap-2 rounded-xl border-2 border-primexpert-dark bg-white px-5 py-2.5 text-[10px] font-black uppercase tracking-widest text-primexpert-dark hover:bg-primexpert-light shrink-0"
        >
          <UserPlus className="h-4 w-4" />
          {t('Nouveau contact', 'New contact')}
        </button>
      </header>

      <div className="rounded-xl border-2 border-primexpert-dark bg-white px-4 py-3 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <label className="relative flex-1 min-w-0">
            <span className="sr-only">{t('Rechercher un contact', 'Search contacts')}</span>
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-primexpert-dark/50"
              aria-hidden
            />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t(
                'Rechercher un acheteur par nom, entreprise, courriel…',
                'Search a buyer by name, company, email…'
              )}
              className="w-full rounded-lg border-2 border-primexpert-dark/25 bg-primexpert-light py-2.5 pl-10 pr-10 text-sm font-semibold text-primexpert-dark placeholder:text-primexpert-dark/45 focus:border-primexpert-dark focus:outline-none focus:ring-2 focus:ring-primexpert-gold/30"
            />
            {searchQuery ? (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-primexpert-dark/60 hover:bg-primexpert-light hover:text-primexpert-dark"
                aria-label={t('Effacer la recherche', 'Clear search')}
              >
                <X className="h-4 w-4" />
              </button>
            ) : null}
          </label>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[9px] font-black uppercase tracking-widest text-primexpert-dark/70 shrink-0">
            {t('Rôle', 'Role')}
          </span>
          <button
            type="button"
            onClick={() => setSelectedRole(null)}
            className={cn(
              'rounded-lg border-2 px-3 py-1.5 text-[9px] font-black uppercase tracking-wider transition',
              selectedRole == null
                ? 'border-primexpert-dark bg-primexpert-dark text-white'
                : 'border-primexpert-dark/25 bg-primexpert-light text-primexpert-dark hover:border-primexpert-dark'
            )}
          >
            {t('Tous', 'All')}
          </button>
          {CONTACT_RELATION_ROLES.map((role) => (
            <button
              key={role}
              type="button"
              onClick={() => setSelectedRole(selectedRole === role ? null : role)}
              className={cn(
                'rounded-lg border-2 px-3 py-1.5 text-[9px] font-black uppercase tracking-wider transition',
                selectedRole === role
                  ? 'border-primexpert-dark bg-primexpert-dark text-white'
                  : 'border-primexpert-dark/25 bg-primexpert-light text-primexpert-dark hover:border-primexpert-dark'
              )}
            >
              {roleLabel(role)}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2 border-t border-primexpert-dark/15 pt-3">
          <span className="text-[9px] font-black uppercase tracking-widest text-primexpert-dark/70 shrink-0">
            {t('Typologie acheteur', 'Buyer tier')}
          </span>
          <button
            type="button"
            onClick={() => setSelectedBuyerTier(null)}
            className={cn(
              'rounded-lg border-2 px-3 py-1.5 text-[9px] font-black uppercase tracking-wider transition',
              selectedBuyerTier == null
                ? 'border-primexpert-dark bg-primexpert-dark text-white'
                : 'border-primexpert-dark/25 bg-primexpert-light text-primexpert-dark hover:border-primexpert-dark'
            )}
          >
            {t('Tous', 'All')}
          </button>
          {BUYER_TIER_FILTER_OPTIONS.map((tier) => (
            <button
              key={tier}
              type="button"
              onClick={() =>
                setSelectedBuyerTier(selectedBuyerTier === tier ? null : tier)
              }
              className={cn(
                'rounded-lg border-2 px-3 py-1.5 text-[9px] font-black uppercase tracking-wider transition',
                selectedBuyerTier === tier
                  ? 'border-primexpert-dark bg-primexpert-dark text-white'
                  : 'border-primexpert-dark/25 bg-primexpert-light text-primexpert-dark hover:border-primexpert-dark'
              )}
            >
              {formatBuyerTierLabel(tier, isFr ? 'fr' : 'en')}
            </button>
          ))}
          <div className="relative group ml-0.5 shrink-0">
            <button
              type="button"
              className="inline-flex h-7 w-7 items-center justify-center rounded-lg border-2 border-primexpert-dark/20 bg-white text-primexpert-dark/70 hover:border-primexpert-dark hover:text-primexpert-dark"
              aria-label={t(
                'Définitions des typologies acheteur',
                'Buyer tier definitions'
              )}
            >
              <Info className="h-4 w-4" aria-hidden />
            </button>
            <div
              role="tooltip"
              className="pointer-events-none absolute left-0 top-full z-50 mt-1 hidden w-72 rounded-lg border-2 border-primexpert-dark bg-white p-3 text-left text-[11px] font-semibold leading-relaxed text-primexpert-dark shadow-lg group-hover:block group-focus-within:block whitespace-pre-line"
            >
              {formatBuyerTierTooltip(isFr ? 'fr' : 'en')}
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-xl border-2 border-primexpert-dark bg-primexpert-light px-4 py-3">
        <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-primexpert-dark">
          <Filter className="h-4 w-4" />
          {t('Filtres', 'Filters')}
        </div>
        {CONTACT_LIST_FILTERS.map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setFilter(key)}
            className={cn(
              'rounded-lg border-2 px-3 py-1.5 text-[9px] font-black uppercase tracking-wider transition',
              filter === key
                ? 'border-primexpert-dark bg-primexpert-dark text-white'
                : 'border-primexpert-dark/25 bg-white text-primexpert-dark hover:border-primexpert-dark'
            )}
          >
            {isFr ? contactListFilterLabelFr(key) : contactListFilterLabelEn(key)}
          </button>
        ))}
        <span className="ml-auto font-mono text-[10px] text-primexpert-dark/70">
          {visible.length} / {scopeFiltered.length}
          {hasClientFilters ? ` · ${contacts.length} ${t('total', 'total')}` : ''}
        </span>
      </div>

      {loadError ? (
        <p className="rounded-xl border-2 border-red-500 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
          {loadError}
        </p>
      ) : null}

      <div className={cn(institutionalWhiteCardClass, 'overflow-hidden')}>
        <div className="hidden lg:grid lg:grid-cols-6 gap-3 px-6 py-3 bg-primexpert-light border-b-2 border-primexpert-dark text-[10px] font-black uppercase tracking-widest text-primexpert-dark">
          <div className="col-span-2">{t('Nom / rôles', 'Name / roles')}</div>
          <div>{t('Silo', 'Silo')}</div>
          <div>{t('Coordonnées', 'Contact')}</div>
          <div>{t('Visibilité', 'Visibility')}</div>
          <div className="text-right">{t('Actions', 'Actions')}</div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-primexpert-dark">
            <Loader2 className="h-6 w-6 animate-spin" />
            <span className="text-sm font-bold">{t('Chargement…', 'Loading…')}</span>
          </div>
        ) : visible.length === 0 ? (
          <div className="py-16 text-center text-sm font-bold text-primexpert-dark/70 px-6">
            {hasClientFilters && scopeFiltered.length > 0
              ? t(
                  'Aucun contact ne correspond aux filtres actifs.',
                  'No contacts match the active filters.'
                )
              : t('Aucun contact pour ce filtre.', 'No contacts for this filter.')}
          </div>
        ) : (
          visible.map((contact) => (
            <div
              key={contact.id}
              className="grid grid-cols-1 lg:grid-cols-6 gap-3 items-center px-6 py-4 border-b border-primexpert-dark/10 hover:bg-primexpert-light/80 transition cursor-pointer"
              onClick={() => openEdit(contact)}
              onKeyDown={(e) => e.key === 'Enter' && openEdit(contact)}
              role="button"
              tabIndex={0}
            >
              <div className="col-span-2 flex items-center gap-3 min-w-0">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border-2 border-primexpert-dark bg-primexpert-blue text-sm font-black text-white">
                  {contactInitials(contact)}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-black text-primexpert-dark truncate">
                    {buildContactDisplayName(contact)}
                  </p>
                  <p className="text-[10px] font-bold uppercase text-primexpert-blue">
                    {formatContactRoles(contact.relationRoles, isFr ? 'fr' : 'en')}
                  </p>
                  <BuyerTierBadge contact={contact} className="mt-1" />
                  {contact.relationRoles?.includes('professional') &&
                  contact.professionalType ? (
                    <span className="mt-1 inline-block rounded-md border border-primexpert-dark/25 bg-white px-2 py-0.5 text-[9px] font-black uppercase tracking-wide text-primexpert-dark">
                      {formatProfessionalTypeLabel(
                        contact.professionalType,
                        isFr ? 'fr' : 'en'
                      )}
                    </span>
                  ) : null}
                </div>
              </div>
              <div>
                <span className="inline-block rounded-lg border-2 border-primexpert-dark/20 bg-primexpert-light px-2 py-0.5 text-[9px] font-black uppercase text-primexpert-dark">
                  {formatContactSiloBadge(contact.silo, contact.assetNiche, isFr ? 'fr' : 'en')}
                </span>
              </div>
              <div className="space-y-0.5 text-[10px] font-bold text-primexpert-dark/80">
                {contact.email ? (
                  <span className="flex items-center gap-1 truncate">
                    <Mail className="h-3 w-3 shrink-0" />
                    {contact.email}
                  </span>
                ) : null}
                {contact.telephone ? (
                  <span className="flex items-center gap-1">
                    <Phone className="h-3 w-3 shrink-0" />
                    {contact.telephone}
                  </span>
                ) : null}
              </div>
              <div>
                <span
                  className={cn(
                    'inline-block rounded-lg px-2 py-0.5 text-[9px] font-black uppercase',
                    contact.visibility === 'AGENCY_SHARED'
                      ? 'bg-primexpert-gold/20 text-primexpert-dark border border-primexpert-gold'
                      : 'bg-slate-100 text-slate-600 border border-slate-300'
                  )}
                >
                  {contact.visibility === 'AGENCY_SHARED'
                    ? t('Agence', 'Agency')
                    : t('Privé', 'Private')}
                </span>
              </div>
              <div
                className="flex justify-end gap-2"
                onClick={(e) => e.stopPropagation()}
              >
                {isAdmin && canAdminReassignContactOwner(contact.leadSource) ? (
                  <button
                    type="button"
                    title={t('Réassigner le lead', 'Reassign lead')}
                    onClick={() => {
                      setReassignTarget(contact);
                      setReassignUid('');
                    }}
                    className="rounded-lg border-2 border-primexpert-dark p-2 text-primexpert-dark hover:bg-primexpert-dark hover:text-white"
                  >
                    <UserCog className="h-4 w-4" />
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => openEdit(contact)}
                  className="rounded-lg border-2 border-primexpert-dark/20 p-2 text-primexpert-dark hover:bg-primexpert-blue hover:text-white"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {ctx ? (
        <ContactFormDrawer
          open={drawerOpen}
          onClose={() => {
            setDrawerOpen(false);
            setEditing(null);
          }}
          ctx={ctx}
          editing={editing}
          onSaved={() => void refresh()}
        />
      ) : null}

      {reassignTarget ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <button
            type="button"
            className="absolute inset-0 bg-black/50"
            aria-label={t('Fermer', 'Close')}
            onClick={() => setReassignTarget(null)}
          />
          <div className="relative z-10 w-full max-w-md rounded-2xl border-2 border-primexpert-dark bg-white p-6 shadow-2xl">
            <h3 className="text-lg font-black text-primexpert-dark mb-2">
              {t('Réassigner le lead publicitaire', 'Reassign advertising lead')}
            </h3>
            <p className="text-sm text-primexpert-dark/80 mb-4">
              {buildContactDisplayName(reassignTarget)}
            </p>
            <select
              className="w-full rounded-lg border-2 border-primexpert-dark px-3 py-2 text-sm font-bold text-primexpert-dark mb-4"
              value={reassignUid}
              onChange={(e) => setReassignUid(e.target.value)}
            >
              <option value="">{t('Choisir un courtier', 'Choose a broker')}</option>
              {brokers.map((b) => (
                <option key={b.uid} value={b.uid}>
                  {b.displayName}
                </option>
              ))}
            </select>
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setReassignTarget(null)}
                className="rounded-lg border-2 border-primexpert-dark px-4 py-2 text-[10px] font-black uppercase"
              >
                {t('Annuler', 'Cancel')}
              </button>
              <button
                type="button"
                disabled={!reassignUid || reassignPending}
                onClick={() => void handleReassign()}
                className="rounded-lg border-2 border-primexpert-dark bg-primexpert-dark px-4 py-2 text-[10px] font-black uppercase text-white disabled:opacity-50"
              >
                {reassignPending ? t('…', '…') : t('Réassigner', 'Reassign')}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

/** Alias historique Workhub — même composant. */
export function CRM() {
  return <ContactsListPage />;
}
