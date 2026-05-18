/**
 * Diagnostic territorial — 3 zones de texte (souscription RPA).
 */

import React from 'react';
import type { MarketDiagnosticFieldId } from '@primexpert/core/market';
import { useLanguage } from '../../../lib/i18n';
import { useMarketFieldSave } from '../../../hooks/useMarketFieldSave';
import { InstitutionalSection } from '../institutional/InstitutionalUi';
import { MarketBlurTextarea } from './MarketBlurTextarea';

const FIELDS: {
  id: MarketDiagnosticFieldId;
  titleFr: string;
  titleEn: string;
}[] = [
  { id: 'avantagesConcurrentiels', titleFr: 'Avantages concurrentiels', titleEn: 'Competitive advantages' },
  { id: 'pointsAmeliorer', titleFr: 'Points à améliorer', titleEn: 'Areas for improvement' },
  { id: 'positionnementMarche', titleFr: 'Positionnement sur le marché', titleEn: 'Market positioning' },
];

export function TerritorialDiagnosticSection() {
  const { t, language } = useLanguage();
  const lang = language === 'fr' ? 'fr' : 'en';
  const { savingFieldId, getFieldValue, setDraft, saveDiagnosticField } = useMarketFieldSave();

  return (
    <InstitutionalSection title={t('Diagnostic territorial', 'Territorial diagnostic')}>
      <div className="space-y-6">
        {FIELDS.map((field) => (
          <MarketBlurTextarea
            key={field.id}
            fieldId={field.id}
            label={lang === 'fr' ? field.titleFr : field.titleEn}
            value={getFieldValue(field.id)}
            saving={savingFieldId === field.id}
            onDraft={setDraft}
            onSave={(id, v) => void saveDiagnosticField(id as MarketDiagnosticFieldId, v)}
          />
        ))}
      </div>
    </InstitutionalSection>
  );
}
