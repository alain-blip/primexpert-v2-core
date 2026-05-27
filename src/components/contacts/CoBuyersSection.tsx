import React, { useMemo, useState } from 'react';
import { Search, X, Loader2 } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useLanguage } from '../../lib/i18n';
import {
  buildContactDisplayName,
  filterContactsBySearchQuery,
  type OrganizationContact,
} from '@primexpert/core/crm';
import {
  linkCoBuyer,
  listOrganizationContacts,
  unlinkCoBuyer,
  type ContactServiceContext,
} from '../../services/contacts';

export interface CoBuyersSectionProps {
  ctx: ContactServiceContext;
  contactId: string | undefined;
  coBuyerIds: string[];
  onCoBuyersChange: (ids: string[]) => void;
  onOpenContact?: (contact: OrganizationContact) => void;
}

export function CoBuyersSection({
  ctx,
  contactId,
  coBuyerIds,
  onCoBuyersChange,
  onOpenContact,
}: CoBuyersSectionProps) {
  const { t } = useLanguage();
  const [search, setSearch] = useState('');
  const [contacts, setContacts] = useState<OrganizationContact[]>([]);
  const [cache, setCache] = useState<Record<string, OrganizationContact>>({});
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  React.useEffect(() => {
    if (!contactId) return;
    void listOrganizationContacts(ctx).then(setContacts);
  }, [ctx, contactId]);

  React.useEffect(() => {
    if (!contactId || coBuyerIds.length === 0) return;
    setCache((prev) => {
      const next = { ...prev };
      for (const id of coBuyerIds) {
        if (next[id]) continue;
        const row = contacts.find((c) => c.id === id);
        if (row) next[id] = row;
      }
      return next;
    });
  }, [contactId, coBuyerIds, contacts]);

  const searchResults = useMemo(() => {
    if (!contactId) return [];
    const linked = new Set([contactId, ...coBuyerIds]);
    const pool = contacts.filter((c) => !linked.has(c.id));
    return filterContactsBySearchQuery(pool, search).slice(0, 8);
  }, [contacts, search, contactId, coBuyerIds]);

  const handleLink = async (partnerId: string) => {
    if (!contactId) {
      setError(
        t(
          'Enregistrez le contact avant de lier un coacheteur.',
          'Save the contact before linking a co-buyer.'
        )
      );
      return;
    }
    setError(null);
    setPending(true);
    try {
      const res = await linkCoBuyer(ctx, contactId, partnerId);
      if (!res.ok) {
        const msg =
          res.error === 'partner_not_writable'
            ? t(
                'Le coacheteur doit être l’un de vos contacts (propriétaire des deux fiches).',
                'Co-buyer must be one of your contacts (you must own both records).'
              )
            : res.error === 'forbidden'
              ? t('Liaison refusée — droits insuffisants.', 'Link denied — insufficient permissions.')
              : t('Échec de la liaison — réessayez.', 'Link failed — please retry.');
        setError(msg);
        return;
      }
      onCoBuyersChange([...coBuyerIds, partnerId]);
      setSearch('');
      const row = contacts.find((c) => c.id === partnerId);
      if (row) setCache((prev) => ({ ...prev, [partnerId]: row }));
    } finally {
      setPending(false);
    }
  };

  const handleUnlink = async (partnerId: string) => {
    if (!contactId) return;
    setError(null);
    setPending(true);
    try {
      const res = await unlinkCoBuyer(ctx, contactId, partnerId);
      if (!res.ok) {
        setError(t('Échec du retrait — réessayez.', 'Unlink failed — please retry.'));
        return;
      }
      onCoBuyersChange(coBuyerIds.filter((id) => id !== partnerId));
    } finally {
      setPending(false);
    }
  };

  const labelClass = 'text-[11px] font-black uppercase tracking-widest text-primexpert-dark';

  return (
    <div className="space-y-2 rounded-lg border-2 border-primexpert-dark/15 bg-primexpert-light/30 p-3">
      <p className={labelClass}>{t('Coacheteurs', 'Co-buyers')}</p>
      {!contactId ? (
        <p className="text-[11px] font-medium text-primexpert-dark/70">
          {t(
            'Enregistrez le contact pour lier des coacheteurs.',
            'Save the contact to link co-buyers.'
          )}
        </p>
      ) : null}
      {coBuyerIds.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {coBuyerIds.map((id) => {
            const row = cache[id] ?? contacts.find((c) => c.id === id);
            const name = row ? buildContactDisplayName(row) : id;
            return (
              <span
                key={id}
                className="inline-flex items-center gap-1 rounded-lg border-2 border-primexpert-blue bg-sky-50 px-2.5 py-1"
              >
                <button
                  type="button"
                  className="text-[11px] font-black text-primexpert-dark hover:underline"
                  onClick={() => row && onOpenContact?.(row)}
                >
                  {name}
                </button>
                <button
                  type="button"
                  disabled={pending}
                  aria-label={t('Retirer le coacheteur', 'Remove co-buyer')}
                  onClick={() => void handleUnlink(id)}
                  className="rounded p-0.5 text-primexpert-dark/70 hover:bg-primexpert-dark hover:text-white disabled:opacity-50"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </span>
            );
          })}
        </div>
      ) : (
        <p className="text-[11px] font-medium text-primexpert-dark/60">
          {t('Aucun coacheteur lié.', 'No co-buyers linked.')}
        </p>
      )}
      {contactId ? (
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-primexpert-dark/50" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t(
              'Rechercher par nom, entreprise, courriel…',
              'Search by name, company, email…'
            )}
            className="w-full rounded-lg border-2 border-primexpert-dark/25 bg-white py-2 pl-10 pr-10 text-sm font-semibold text-primexpert-dark"
          />
          {pending ? (
            <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-primexpert-dark" />
          ) : null}
          {searchResults.length > 0 ? (
            <ul className="mt-1 max-h-40 overflow-y-auto rounded-lg border-2 border-primexpert-dark bg-white shadow-lg">
              {searchResults.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    className="w-full px-3 py-2 text-left text-sm font-semibold text-primexpert-dark hover:bg-primexpert-light"
                    onClick={() => void handleLink(c.id)}
                  >
                    {buildContactDisplayName(c)}
                    {c.email ? (
                      <span className="block text-[10px] font-medium text-primexpert-dark/60">
                        {c.email}
                      </span>
                    ) : null}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
      {error ? <p className="text-xs font-bold text-red-600">{error}</p> : null}
    </div>
  );
}
