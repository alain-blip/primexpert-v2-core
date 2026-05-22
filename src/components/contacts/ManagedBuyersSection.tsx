import React, { useMemo, useState } from 'react';
import { Search, X, Loader2 } from 'lucide-react';
import { useLanguage } from '../../lib/i18n';
import {
  buildContactDisplayName,
  filterContactsBySearchQuery,
  type OrganizationContact,
} from '@primexpert/core/crm';
import {
  linkBuyerToBroker,
  listOrganizationContacts,
  unlinkBuyerFromBroker,
  type ContactServiceContext,
} from '../../services/contacts';

export interface ManagedBuyersSectionProps {
  ctx: ContactServiceContext;
  brokerContactId: string | undefined;
  managedBuyerIds: string[];
  onManagedBuyersChange: (ids: string[]) => void;
  onOpenContact?: (contact: OrganizationContact) => void;
}

export function ManagedBuyersSection({
  ctx,
  brokerContactId,
  managedBuyerIds,
  onManagedBuyersChange,
  onOpenContact,
}: ManagedBuyersSectionProps) {
  const { t } = useLanguage();
  const [search, setSearch] = useState('');
  const [contacts, setContacts] = useState<OrganizationContact[]>([]);
  const [cache, setCache] = useState<Record<string, OrganizationContact>>({});
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  React.useEffect(() => {
    if (!brokerContactId) return;
    void listOrganizationContacts(ctx).then(setContacts);
  }, [ctx, brokerContactId]);

  React.useEffect(() => {
    if (!brokerContactId || managedBuyerIds.length === 0) return;
    setCache((prev) => {
      const next = { ...prev };
      for (const id of managedBuyerIds) {
        if (next[id]) continue;
        const row = contacts.find((c) => c.id === id);
        if (row) next[id] = row;
      }
      return next;
    });
  }, [brokerContactId, managedBuyerIds, contacts]);

  const searchResults = useMemo(() => {
    if (!brokerContactId) return [];
    const linked = new Set([brokerContactId, ...managedBuyerIds]);
    const pool = contacts.filter(
      (c) => !linked.has(c.id) && c.relationRoles?.includes('buyer')
    );
    return filterContactsBySearchQuery(pool, search).slice(0, 8);
  }, [contacts, search, brokerContactId, managedBuyerIds]);

  const handleLink = async (buyerId: string) => {
    if (!brokerContactId) {
      setError(
        t(
          'Enregistrez le contact courtier avant d’assigner un acheteur.',
          'Save the broker contact before assigning a buyer.'
        )
      );
      return;
    }
    setError(null);
    setPending(true);
    try {
      const res = await linkBuyerToBroker(ctx, brokerContactId, buyerId);
      if (!res.ok) {
        const msg =
          res.error === 'buyer_not_writable'
            ? t(
                'L’acheteur doit être l’un de vos contacts (droits d’écriture).',
                'Buyer must be one of your contacts (write access required).'
              )
            : res.error === 'not_buyer'
              ? t('Le contact sélectionné n’est pas un acheteur.', 'Selected contact is not a buyer.')
              : res.error === 'forbidden'
                ? t('Assignation refusée — droits insuffisants.', 'Assignment denied — insufficient permissions.')
                : t('Échec de l’assignation — réessayez.', 'Assignment failed — please retry.');
        setError(msg);
        return;
      }
      onManagedBuyersChange([...managedBuyerIds, buyerId]);
      setSearch('');
      const row = contacts.find((c) => c.id === buyerId);
      if (row) setCache((prev) => ({ ...prev, [buyerId]: row }));
    } finally {
      setPending(false);
    }
  };

  const handleUnlink = async (buyerId: string) => {
    if (!brokerContactId) return;
    setError(null);
    setPending(true);
    try {
      const res = await unlinkBuyerFromBroker(ctx, brokerContactId, buyerId);
      if (!res.ok) {
        setError(t('Échec du retrait — réessayez.', 'Unlink failed — please retry.'));
        return;
      }
      onManagedBuyersChange(managedBuyerIds.filter((id) => id !== buyerId));
    } finally {
      setPending(false);
    }
  };

  const labelClass = 'text-[11px] font-black uppercase tracking-widest text-primexpert-dark';

  return (
    <div className="space-y-2 rounded-lg border-2 border-primexpert-dark/15 bg-primexpert-light/30 p-3">
      <p className={labelClass}>
        {t('Acheteurs sous responsabilité', 'Buyers under responsibility')}
      </p>
      <p className="text-[11px] font-medium text-primexpert-dark/70 leading-relaxed">
        {t(
          'L’assignation met à jour le courtier responsable (`ownerId`) sur la fiche de l’acheteur.',
          'Assignment updates the responsible broker (`ownerId`) on the buyer record.'
        )}
      </p>
      {!brokerContactId ? (
        <p className="text-[11px] font-medium text-primexpert-dark/70">
          {t(
            'Enregistrez le contact pour assigner des acheteurs.',
            'Save the contact to assign buyers.'
          )}
        </p>
      ) : null}
      {managedBuyerIds.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {managedBuyerIds.map((id) => {
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
                  aria-label={t('Retirer l’acheteur', 'Remove buyer')}
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
          {t('Aucun acheteur assigné.', 'No buyers assigned.')}
        </p>
      )}
      {brokerContactId ? (
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-primexpert-dark/50" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('Rechercher un acheteur…', 'Search a buyer…')}
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
