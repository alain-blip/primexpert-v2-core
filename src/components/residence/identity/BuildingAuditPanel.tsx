import React from 'react';
import type { IdentitySectionView } from '@primexpert/core/identity';
import { EditableIdentitySection } from './EditableIdentitySection';

/**
 * Reventilation du bâtiment — 5 blocs de diligence raisonnable
 * (cadastre, validation JLR, structure, installations, sécurité).
 *
 * Charte Confort 66+ : chaque sous-bloc est délégué à
 * `EditableIdentitySection` (édition inline permanente, sans bouton
 * "Modifier").
 */
export interface BuildingAuditPanelProps {
  blocks: IdentitySectionView[];
  language: 'fr' | 'en';
}

export function BuildingAuditPanel({ blocks, language }: BuildingAuditPanelProps) {
  return (
    <div className="space-y-6">
      <div className="rounded-xl border-2 border-slate-200 bg-white px-5 py-4 shadow-sm">
        <p className="text-[13px] font-black uppercase tracking-[0.18em] text-[#142c6a]">
          {language === 'fr'
            ? 'Reventilation du bâtiment — diligence raisonnable en 5 blocs'
            : 'Building breakdown — 5 due-diligence blocks'}
        </p>
        <p className="mt-2 text-[15px] font-semibold leading-relaxed text-slate-700">
          {language === 'fr'
            ? 'Cadastre, recoupement JLR, structure, installations techniques et sécurité.'
            : 'Cadastre, JLR cross-check, structure, technical systems and safety.'}
        </p>
      </div>
      {blocks.map((block) => (
        <EditableIdentitySection key={block.id} section={block} language={language} />
      ))}
    </div>
  );
}
