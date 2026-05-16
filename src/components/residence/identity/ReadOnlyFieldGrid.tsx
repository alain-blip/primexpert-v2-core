import React from 'react';
import type { IdentityFieldRow } from '@primexpert/core/identity';
import { RaphaelBadge } from '../../msss/RaphaelBadge';
import { cn } from '../../../lib/utils';

export interface ReadOnlyFieldGridProps {
  fields: IdentityFieldRow[];
  language: 'fr' | 'en';
}

export function ReadOnlyFieldGrid({ fields, language }: ReadOnlyFieldGridProps) {
  if (fields.length === 0) {
    return (
      <p className="text-sm text-slate-500 italic">
        {language === 'fr' ? 'Aucune donnée renseignée.' : 'No data on file.'}
      </p>
    );
  }

  return (
    <dl className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-4">
      {fields.map((field) => (
        <div key={field.id} className="min-w-0">
          <dt className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
            {language === 'fr' ? field.labelFr : field.labelEn}
            <RaphaelBadge show={field.showRaphaelBadge} />
          </dt>
          <dd
            className={cn(
              'text-sm font-semibold text-[#000000] break-words',
              field.empty && 'text-slate-400 font-normal italic'
            )}
          >
            {field.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}
