import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Archive,
  Building2,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Folder,
  Handshake,
  Loader2,
  Users,
  Zap,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { useLanguage } from '../../lib/i18n';
import { useAuth } from '../../lib/auth';
import { useSilo } from '../../context/SiloContext';
import {
  DOCUMENTS_LISTING_GROUPS,
  groupResidencesByDocumentsStatus,
  type DocumentsListingGroupId,
} from '../../config/pipelineStages';
import { buildResidenceTenantContext, listResidences, type Residence } from '../../services/residences';
import {
  listOrganizationContacts,
  type ContactServiceContext,
} from '../../services/contacts';
import { buildContactDisplayName } from '@primexpert/core/crm';
import type { OrganizationContact } from '@primexpert/core/crm';
import { DocumentFolderView } from './DocumentFolderView';

type RootId = 'listings' | 'contacts' | 'workspace';

function residenceTitle(r: Residence): string {
  const name =
    r.residenceName?.trim() ||
    r.nomCommercial?.trim() ||
    r.commercialName?.trim() ||
    r.name?.trim();
  if (name) return name;
  const addr = [r.address, r.city].filter(Boolean).join(', ');
  return addr || r.id;
}

function isBuyerOrSeller(c: OrganizationContact): boolean {
  return (
    c.relationRoles?.includes('buyer') === true ||
    c.relationRoles?.includes('seller') === true
  );
}

const LISTING_GROUP_UI: Record<
  DocumentsListingGroupId,
  { icon: typeof Zap; badgeClass: string; headerClass: string }
> = {
  mandate: {
    icon: Zap,
    badgeClass: 'bg-emerald-500/25 text-emerald-200 border-emerald-400/40',
    headerClass: 'text-emerald-300',
  },
  promise: {
    icon: Handshake,
    badgeClass: 'bg-amber-500/25 text-amber-200 border-amber-400/40',
    headerClass: 'text-amber-300',
  },
  sold: {
    icon: CheckCircle2,
    badgeClass: 'bg-blue-500/25 text-blue-200 border-blue-400/40',
    headerClass: 'text-blue-300',
  },
  other: {
    icon: Archive,
    badgeClass: 'bg-slate-500/25 text-slate-300 border-slate-400/30',
    headerClass: 'text-slate-400',
  },
};

function ListingsByStatusSections({
  residences,
  locale,
  onOpen,
}: {
  residences: Residence[];
  locale: 'fr' | 'en';
  onOpen: (r: Residence) => void;
}) {
  const { t } = useLanguage();
  const grouped = useMemo(() => groupResidencesByDocumentsStatus(residences), [residences]);
  const [openSections, setOpenSections] = useState<Record<DocumentsListingGroupId, boolean>>({
    mandate: true,
    promise: true,
    sold: true,
    other: true,
  });

  const visibleGroups = DOCUMENTS_LISTING_GROUPS.filter((g) => grouped[g.id].length > 0);

  if (visibleGroups.length === 0) {
    return (
      <p className="px-3 py-8 text-center text-[11px] text-slate-500">
        {t('Aucune inscription.', 'No listings.')}
      </p>
    );
  }

  return (
    <div className="space-y-2 p-2">
      {visibleGroups.map((group) => {
        const items = grouped[group.id];
        const ui = LISTING_GROUP_UI[group.id];
        const Icon = ui.icon;
        const isOpen = openSections[group.id];
        const label = locale === 'fr' ? group.labelFr : group.labelEn;

        return (
          <div key={group.id} className="rounded-xl border border-white/8 bg-white/[0.02]">
            <button
              type="button"
              onClick={() =>
                setOpenSections((prev) => ({ ...prev, [group.id]: !prev[group.id] }))
              }
              className="flex w-full items-center gap-2 px-3 py-2.5 text-left"
            >
              <Icon className={cn('h-4 w-4 shrink-0', ui.headerClass)} />
              <span
                className={cn(
                  'min-w-0 flex-1 truncate text-[10px] font-black uppercase tracking-widest',
                  ui.headerClass
                )}
              >
                {label}
              </span>
              <span
                className={cn(
                  'rounded-md border px-1.5 py-0.5 font-mono text-[9px] font-bold',
                  ui.badgeClass
                )}
              >
                {items.length}
              </span>
              <ChevronDown
                className={cn(
                  'h-4 w-4 shrink-0 text-slate-500 transition',
                  isOpen && 'rotate-180'
                )}
              />
            </button>
            {isOpen ? (
              <ul className="border-t border-white/8 pb-1">
                {items.map((r) => (
                  <li key={r.id}>
                    <button
                      type="button"
                      onClick={() => onOpen(r)}
                      className="flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm font-semibold text-slate-200 hover:bg-white/5"
                    >
                      <span className="truncate">{residenceTitle(r)}</span>
                      <ChevronRight className="h-4 w-4 shrink-0 text-slate-600" />
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

export function DocumentsDashboard() {
  const { t, language } = useLanguage();
  const locale = language === 'fr' ? 'fr' : 'en';
  const { profile } = useAuth();
  const { activeSilo } = useSilo();
  const brokerId = profile?.uid ?? '';

  const [loading, setLoading] = useState(true);
  const [residences, setResidences] = useState<Residence[]>([]);
  const [contacts, setContacts] = useState<OrganizationContact[]>([]);
  const [search, setSearch] = useState('');

  const [folderView, setFolderView] = useState<
    | { mode: 'residence'; propertyId: string; propertyTitle: string }
    | { mode: 'contact'; contact: OrganizationContact }
    | { mode: 'workspace' }
    | null
  >(null);

  const ctx: ContactServiceContext | null = useMemo(() => {
    if (!profile?.uid || !profile.orgId) return null;
    return { uid: profile.uid, orgId: profile.orgId, role: profile.role };
  }, [profile]);

  const refresh = useCallback(async () => {
    if (!brokerId || !profile) {
      setResidences([]);
      setContacts([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [resRows, contactRows] = await Promise.all([
        listResidences(buildResidenceTenantContext(profile), { silo: activeSilo }),
        ctx ? listOrganizationContacts(ctx) : Promise.resolve([]),
      ]);
      setResidences(resRows);
      setContacts(contactRows.filter(isBuyerOrSeller));
    } catch (e) {
      console.error('[DocumentsDashboard] load failed', e);
    } finally {
      setLoading(false);
    }
  }, [brokerId, profile, activeSilo, ctx]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const q = search.trim().toLowerCase();
  const filteredResidences = q
    ? residences.filter((r) => residenceTitle(r).toLowerCase().includes(q))
    : residences;
  const filteredContacts = q
    ? contacts.filter((c) => buildContactDisplayName(c).toLowerCase().includes(q))
    : contacts;

  if (folderView?.mode === 'residence') {
    return (
      <DocumentFolderView
        mode="residence"
        propertyId={folderView.propertyId}
        propertyTitle={folderView.propertyTitle}
        onBack={() => setFolderView(null)}
      />
    );
  }
  if (folderView?.mode === 'contact') {
    return (
      <DocumentFolderView
        mode="contact"
        contact={folderView.contact}
        onBack={() => setFolderView(null)}
      />
    );
  }
  if (folderView?.mode === 'workspace') {
    return <DocumentFolderView mode="workspace" onBack={() => setFolderView(null)} />;
  }

  const roots: { id: RootId; icon: typeof Building2; labelFr: string; labelEn: string; count: number }[] = [
    {
      id: 'listings',
      icon: Building2,
      labelFr: 'Inscriptions (propriétés)',
      labelEn: 'Listings (properties)',
      count: residences.length,
    },
    {
      id: 'contacts',
      icon: Users,
      labelFr: 'Clients et contacts',
      labelEn: 'Clients & contacts',
      count: contacts.length,
    },
    {
      id: 'workspace',
      icon: Folder,
      labelFr: 'Espace de travail',
      labelEn: 'Workspace',
      count: 0,
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <p className="text-[10px] font-black uppercase tracking-[0.32em] text-blue-200/70">
          {t('Drive unifié PrimeXpert', 'Unified PrimeXpert Drive')}
        </p>
        <h1 className="mt-2 text-4xl font-black italic uppercase tracking-tighter text-white">
          {t('Mes Documents', 'My Documents')}
        </h1>
        <p className="mt-2 max-w-3xl text-[12px] font-semibold text-slate-500">
          {t(
            'Index virtuel : les inscriptions et contacts reflètent les fichiers déjà stockés sur leurs fiches (aucune copie). L’espace de travail indexe les gabarits agence.',
            'Virtual index: listings and contacts mirror files on their records (no copies). Workspace indexes agency templates.'
          )}
        </p>
      </div>

      <input
        type="search"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder={t('Rechercher une inscription ou un contact…', 'Search listing or contact…')}
        className="w-full max-w-md rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm font-semibold text-white placeholder:text-slate-500"
      />

      {loading ? (
        <div className="flex items-center gap-2 py-16 text-slate-400">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span className="text-sm font-bold">{t('Chargement…', 'Loading…')}</span>
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-3">
          {roots.map((root) => {
            const Icon = root.icon;
            const isWorkspace = root.id === 'workspace';
            return (
              <section
                key={root.id}
                className="workhub-card flex flex-col overflow-hidden rounded-[22px] border border-white/10"
              >
                <button
                  type="button"
                  onClick={() => {
                    if (isWorkspace) setFolderView({ mode: 'workspace' });
                  }}
                  className={cn(
                    'flex items-center gap-3 border-b border-white/10 px-4 py-4 text-left transition hover:bg-white/5',
                    isWorkspace && 'cursor-pointer'
                  )}
                >
                  <Icon className="h-6 w-6 shrink-0 text-blue-300" />
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-black uppercase tracking-widest text-white">
                      {locale === 'fr' ? root.labelFr : root.labelEn}
                    </p>
                    {!isWorkspace ? (
                      <p className="text-[10px] text-slate-500">
                        {root.count} {t('éléments', 'items')}
                      </p>
                    ) : (
                      <p className="text-[10px] text-slate-500">
                        {t('Gabarits et notes', 'Templates & notes')}
                      </p>
                    )}
                  </div>
                  {isWorkspace ? <ChevronRight className="h-5 w-5 text-slate-500" /> : null}
                </button>
                <div className="custom-scrollbar max-h-[360px] flex-1 overflow-y-auto p-2">
                  {root.id === 'listings' ? (
                    <ListingsByStatusSections
                      residences={filteredResidences}
                      locale={locale}
                      onOpen={(r) =>
                        setFolderView({
                          mode: 'residence',
                          propertyId: r.id,
                          propertyTitle: residenceTitle(r),
                        })
                      }
                    />
                  ) : null}
                  {root.id === 'contacts' &&
                    filteredContacts.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => setFolderView({ mode: 'contact', contact: c })}
                        className="flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2.5 text-left text-sm font-semibold text-slate-200 hover:bg-white/5"
                      >
                        <span className="truncate">{buildContactDisplayName(c)}</span>
                        <ChevronRight className="h-4 w-4 shrink-0 text-slate-600" />
                      </button>
                    ))}
                  {root.id === 'workspace' ? (
                    <p className="px-3 py-6 text-center text-[11px] text-slate-500">
                      {t('Ouvrir l’espace de travail →', 'Open workspace →')}
                    </p>
                  ) : null}
                  {root.id === 'contacts' && filteredContacts.length === 0 ? (
                    <p className="px-3 py-8 text-center text-[11px] text-slate-500">
                      {t('Aucun élément.', 'No items.')}
                    </p>
                  ) : null}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
