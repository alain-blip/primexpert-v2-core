import React from 'react';
import type { IdentitySectionView } from '@primexpert/core/identity';
import { EditableIdentitySection } from './EditableIdentitySection';

export interface BuildingAuditPanelProps {
  blocks: IdentitySectionView[];
  language: 'fr' | 'en';
}

export function BuildingAuditPanel({ blocks, language }: BuildingAuditPanelProps) {
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
        <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">
          {language === 'fr'
            ? 'Reventilation du bâtiment — vérification en 5 blocs'
            : 'Building breakdown — 5 verification blocks'}
        </p>
        <p className="mt-1 text-xs text-slate-600">
          {language === 'fr'
            ? 'Cadastre, validation JLR, structure, installations techniques et sécurité.'
            : 'Cadastre, JLR cross-check, structure, technical systems and safety.'}
        </p>
      </div>
      {blocks.map((block) => (
        <EditableIdentitySection key={block.id} section={block} language={language} />
      ))}
    </div>
  );
}
