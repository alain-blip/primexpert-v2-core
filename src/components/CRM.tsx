import React, { useEffect, useMemo, useState } from 'react';
import { Users, Mail, Phone, ChevronRight, UserPlus, FileDown, Filter } from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '../lib/utils';
import { useLanguage } from '../lib/i18n';
import { CRM_INBOUND_QUEUE_KEY, type CrmInboundDraft } from '../lib/crmInboundQueue';
import { ASSET_NICHE_IDS, type AssetNiche } from '../types/residence';
import { useSilo } from '../context/SiloContext';
import { ScopedDocumentManager } from './documents/ScopedDocumentManager';

interface CrmRow {
  id: number;
  name: string;
  type: string;
  email: string;
  phone: string;
  status: string;
  initials: string;
  investorProfiles: AssetNiche[];
  /** `global` = répertoire partagé ; niche = fiche privée à ce silo. */
  siloScope?: 'global' | AssetNiche;
}

const SEED_CONTACTS: CrmRow[] = [
  {
    id: 1,
    name: 'Jean Tremblay',
    type: 'Vendeur',
    email: 'jean@tremblay.com',
    phone: '514-555-0101',
    status: 'Chaud',
    initials: 'JT',
    investorProfiles: ['RPA', 'PLEX'],
    siloScope: 'global',
  },
  {
    id: 2,
    name: 'Sophie Martin',
    type: 'Acheteur',
    email: 'sophie.m@gmail.com',
    phone: '438-555-0202',
    status: 'Actif',
    initials: 'SM',
    investorProfiles: ['RPA'],
    siloScope: 'global',
  },
  {
    id: 3,
    name: 'Marc-André Roy',
    type: 'Collaborateur',
    email: 'roy@immobilier.ca',
    phone: '450-555-0303',
    status: 'Partenaire',
    initials: 'MR',
    investorProfiles: ['CPE'],
    siloScope: 'CPE',
  },
  {
    id: 4,
    name: 'Lucie Gagnon',
    type: 'Vendeur',
    email: 'lg@videotron.ca',
    phone: '514-555-0404',
    status: 'Froid',
    initials: 'LG',
    investorProfiles: ['PLEX', 'CPE'],
    siloScope: 'global',
  },
  {
    id: 5,
    name: 'Pierre Lefebvre',
    type: 'Acheteur',
    email: 'pierre.le@outlook.com',
    phone: '514-555-0505',
    status: 'Nouveau',
    initials: 'PL',
    investorProfiles: ['CPE', 'RPA'],
    siloScope: 'PLEX',
  },
];

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function draftToRow(d: CrmInboundDraft, id: number): CrmRow {
  const profiles: AssetNiche[] =
    d.investorProfiles && d.investorProfiles.length > 0 ? d.investorProfiles : ['RPA'];
  return {
    id,
    name: d.name,
    type: d.type,
    email: d.email,
    phone: d.phone,
    status: d.status,
    initials: initialsFromName(d.name),
    investorProfiles: profiles,
    siloScope: d.contactSiloScope ?? 'global',
  };
}

function nichePillClass(n: AssetNiche): string {
  switch (n) {
    case 'RPA':
      return 'border-emerald-400/35 bg-emerald-500/12 text-emerald-200';
    case 'CPE':
      return 'border-sky-400/35 bg-sky-500/12 text-sky-200';
    case 'PLEX':
      return 'border-amber-400/35 bg-amber-500/12 text-amber-200';
    default:
      return 'border-white/15 bg-white/[0.06] text-slate-300';
  }
}

export function CRM() {
  const { t } = useLanguage();
  const { activeSilo } = useSilo();
  const [contacts, setContacts] = useState<CrmRow[]>(SEED_CONTACTS);
  const [profileFilter, setProfileFilter] = useState<AssetNiche | 'all' | 'cockpit'>('cockpit');
  const [selectedContactId, setSelectedContactId] = useState<number>(SEED_CONTACTS[0]?.id ?? 0);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(CRM_INBOUND_QUEUE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as unknown;
      if (!Array.isArray(parsed) || parsed.length === 0) return;

      const drafts = parsed.filter(
        (x): x is CrmInboundDraft =>
          x &&
          typeof x === 'object' &&
          typeof (x as CrmInboundDraft).name === 'string'
      );

      if (drafts.length === 0) return;

      const baseId = Date.now();
      const rows = drafts.map((d, i) => draftToRow(d, baseId + i));
      setContacts((prev) => [...rows, ...prev]);
      sessionStorage.removeItem(CRM_INBOUND_QUEUE_KEY);
    } catch (e) {
      console.error('[CRM] inbound queue merge failed', e);
    }
  }, []);

  const visibleContacts = useMemo(() => {
    const scoped = contacts.filter((c) => {
      const s = c.siloScope ?? 'global';
      if (s === 'global') return true;
      return s === activeSilo;
    });
    if (profileFilter === 'all') return scoped;
    if (profileFilter === 'cockpit') {
      return scoped.filter((c) => c.investorProfiles.includes(activeSilo));
    }
    return scoped.filter((c) => c.investorProfiles.includes(profileFilter));
  }, [contacts, profileFilter, activeSilo]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Chaud':
      case 'Hot':
        return 'bg-orange-500/15 text-orange-300 border-orange-400/30';
      case 'Actif':
      case 'Active':
        return 'bg-green-500/15 text-green-300 border-green-400/30';
      case 'Partenaire':
      case 'Partner':
        return 'bg-blue-500/15 text-blue-300 border-blue-400/30';
      case 'Nouveau':
      case 'New':
        return 'bg-purple-500/15 text-purple-300 border-purple-400/30';
      default:
        return 'bg-white/[0.04] text-slate-300 border-white/10';
    }
  };

  const inboundHint = useMemo(
    () =>
      t(
        'Filtrer par profil investisseur : repère qui suit RPA, CPE ou Plex. Les fiches Messagerie héritent du silo cockpit ; les fiches « privées silo » n’apparaissent que dans leur niche.',
        'Filter by investor profile: who tracks RPA, CPE or Plex. Mailbox-created records inherit the cockpit silo; private silo-scoped rows only appear in that niche.'
      ),
    [t]
  );

  const filterButtons: { key: AssetNiche | 'all' | 'cockpit'; label: string }[] = [
    { key: 'cockpit', label: t(`Cockpit (${activeSilo})`, `Cockpit (${activeSilo})`) },
    { key: 'all', label: t('Tous', 'All') },
    ...ASSET_NICHE_IDS.map((id) => ({ key: id, label: id })),
  ];
  const selectedContact = visibleContacts.find((c) => c.id === selectedContactId) ?? visibleContacts[0];

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h2 className="text-4xl font-black italic text-slate-300 tracking-tighter uppercase">
            RÉPERTOIRE<span className="text-blue-400">_CRM</span>
          </h2>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
            {t('Traçabilité conforme et suivi CRM', 'Compliant traceability & CRM pipeline')}
          </p>
          <p className="text-[9px] font-semibold text-blue-300/80 mt-2 max-w-xl leading-relaxed">{inboundHint}</p>
        </div>
        <div className="flex gap-3">
          <button
            type="button"
            className="flex items-center gap-2 px-5 py-2.5 border border-white/10 bg-vault rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-300 hover:bg-white/[0.03] transition-all shadow-sm"
          >
            <FileDown className="w-4 h-4" />
            Exporter CSV
          </button>
          <button
            type="button"
            className="flex items-center gap-2 px-6 py-3 bg-blue-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg hover:bg-blue-800 hover:scale-105 active:scale-95 transition-all"
          >
            <UserPlus className="w-4 h-4" />
            Nouv. Contact
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-white/10 bg-vault-bright px-4 py-3">
        <div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-widest text-slate-500">
          <Filter className="h-3.5 w-3.5" />
          {t('Profil investisseur', 'Investor profile')}
        </div>
        {filterButtons.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => setProfileFilter(key)}
            className={cn(
              'rounded-xl border px-3 py-1.5 text-[9px] font-black uppercase tracking-widest transition',
              profileFilter === key
                ? 'border-blue-400/50 bg-blue-600 text-white'
                : 'border-white/10 bg-white/[0.04] text-slate-400 hover:border-white/20 hover:text-slate-200'
            )}
          >
            {label}
          </button>
        ))}
        <span className="ml-auto font-mono text-[9px] text-slate-500">
          {visibleContacts.length} / {contacts.length}
        </span>
      </div>

      <div className="bg-vault-bright rounded-2xl border border-white/10 shadow-sm overflow-hidden">
        <div className="grid grid-cols-1 divide-y divide-white/[0.06]">
          <div className="bg-white/[0.03] px-8 py-3 grid grid-cols-1 lg:grid-cols-5 gap-4 text-[10px] font-black uppercase tracking-widest text-slate-400">
            <div className="lg:col-span-1">{t('Nom / Type', 'Name / Type')}</div>
            <div className="lg:col-span-1">{t('Coordonnées', 'Contact')}</div>
            <div className="lg:col-span-1">{t('Profils niche', 'Niche profiles')}</div>
            <div className="lg:col-span-1">{t('Suivi commercial', 'Pipeline status')}</div>
            <div className="lg:col-span-1 text-right">{t('Actions', 'Actions')}</div>
          </div>
          {visibleContacts.map((contact, i) => (
            <motion.div
              key={contact.id}
              onClick={() => setSelectedContactId(contact.id)}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: Math.min(i * 0.05, 0.4) }}
              className={cn(
                'flex items-center px-8 py-5 hover:bg-blue-500/10 transition-all cursor-pointer group',
                selectedContact?.id === contact.id && 'bg-blue-500/10'
              )}
            >
              <div className="w-12 h-12 bg-blue-900 text-blue-300 rounded-lg flex items-center justify-center font-black italic text-lg mr-8 shadow-sm group-hover:bg-blue-500 group-hover:text-white transition-colors">
                {contact.initials}
              </div>

              <div className="flex-1 grid grid-cols-1 lg:grid-cols-5 gap-4 items-center">
                <div>
                  <h4 className="text-sm font-black text-slate-300 tracking-tight">{contact.name}</h4>
                  <p className="text-[10px] text-blue-400 font-bold uppercase tracking-tighter">{contact.type}</p>
                </div>

                <div className="flex flex-col gap-0.5">
                  <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 truncate">
                    <Mail className="w-3 h-3 text-blue-400 shrink-0" />
                    <span>{contact.email}</span>
                  </div>
                  <div className="flex items-center gap-2 text-[10px] font-bold text-slate-300 font-mono tracking-tighter">
                    <Phone className="w-3 h-3 text-blue-400 shrink-0" />
                    <span>{contact.phone}</span>
                  </div>
                </div>

                <div className="flex flex-wrap gap-1">
                  {contact.investorProfiles.map((n) => (
                    <span
                      key={n}
                      className={cn(
                        'rounded-lg border px-2 py-0.5 text-[8px] font-black tracking-wider',
                        nichePillClass(n)
                      )}
                    >
                      {n}
                    </span>
                  ))}
                </div>

                <div className="flex items-center">
                  <span
                    className={cn(
                      'px-2 py-1 rounded text-[9px] font-black uppercase tracking-widest border',
                      getStatusColor(contact.status)
                    )}
                  >
                    {contact.status}
                  </span>
                </div>

                <div className="flex justify-end">
                  <div className="p-2 rounded-lg bg-white/[0.03] text-slate-300 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                    <ChevronRight className="w-4 h-4" />
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
      {selectedContact ? (
        <ScopedDocumentManager
          scope="contact"
          contactId={String(selectedContact.id)}
          compact
          title={t('Espace Documents — Qualification', 'Document space — Qualification')}
          subtitle={t(
            `Contact : ${selectedContact.name} — entente de confidentialité, preuve de fonds, lettre bancaire, CANAFE.`,
            `Contact: ${selectedContact.name} — NDA, proof of funds, bank letter, FINTRAC.`
          )}
        />
      ) : null}
    </div>
  );
}
