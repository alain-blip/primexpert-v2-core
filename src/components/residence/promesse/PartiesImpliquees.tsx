import React from 'react';
import { cn } from '../../../lib/utils';
import {
  institutionalListingsCardHeaderClass,
  institutionalListingsCardShellClass,
  institutionalListingsCardTitleClass,
  institutionalListingsFailSafeClass,
} from '../../../lib/institutionalTheme';

interface PartiesImpliqueesProps {
  title: string;
  labels: {
    coOwners: string;
    collaboratorBroker: string;
    notary: string;
    lawyer: string;
    failSafe: string;
  };
  coSellerIds?: string[];
  collaboratorBrokerIds?: string[];
  notaryIds?: string[];
  lawyerIds?: string[];
  collaboratorBrokerName?: string;
  buyerName?: string;
}

interface PartyRow {
  key: string;
  label: string;
  values: string[];
}

function toDisplayValues(ids: string[] | undefined, fallbackName?: string): string[] {
  const normalized = (ids ?? []).map((id) => id.trim()).filter(Boolean);
  if (fallbackName?.trim()) {
    return [...new Set([fallbackName.trim(), ...normalized])];
  }
  return [...new Set(normalized)];
}

export function PartiesImpliquees({
  title,
  labels,
  coSellerIds,
  collaboratorBrokerIds,
  notaryIds,
  lawyerIds,
  collaboratorBrokerName,
  buyerName,
}: PartiesImpliqueesProps) {
  const rows: PartyRow[] = [
    {
      key: 'coowners',
      label: labels.coOwners,
      values: toDisplayValues(coSellerIds, buyerName),
    },
    {
      key: 'collaborator',
      label: labels.collaboratorBroker,
      values: toDisplayValues(collaboratorBrokerIds, collaboratorBrokerName),
    },
    {
      key: 'notary',
      label: labels.notary,
      values: toDisplayValues(notaryIds),
    },
    {
      key: 'lawyer',
      label: labels.lawyer,
      values: toDisplayValues(lawyerIds),
    },
  ];

  const hasAnyParty = rows.some((row) => row.values.length > 0);

  return (
    <section className={institutionalListingsCardShellClass}>
      <header className={institutionalListingsCardHeaderClass}>
        <h3 className={institutionalListingsCardTitleClass}>{title}</h3>
      </header>
      <div className="p-5">
        {!hasAnyParty ? (
          <div className={institutionalListingsFailSafeClass}>
            <div className="animate-pulse space-y-2">
              <div className="h-4 w-1/3 rounded bg-primexpert-dark/20" />
              <div className="h-4 w-2/3 rounded bg-primexpert-dark/15" />
              <div className="h-4 w-1/2 rounded bg-primexpert-dark/10" />
            </div>
            <p className="mt-3 text-[12px] font-black text-slate-900">{labels.failSafe}</p>
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {rows.map((row) => (
              <article
                key={row.key}
                className="rounded-xl border-2 border-primexpert-dark/20 bg-white dark:bg-primexpert-cardDark p-4"
              >
                <p className={cn(institutionalListingsCardTitleClass, 'text-[10px]')}>
                  {row.label}
                </p>
                {row.values.length === 0 ? (
                  <p className="mt-2 text-[13px] font-semibold text-slate-700">—</p>
                ) : (
                  <ul className="mt-2 space-y-1">
                    {row.values.map((value) => (
                      <li key={value} className="text-[13px] font-bold text-slate-900">
                        {value}
                      </li>
                    ))}
                  </ul>
                )}
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

