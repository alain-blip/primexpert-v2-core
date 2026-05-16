import React from 'react';
import type { IdentitySectionView } from '@primexpert/core/identity';
import { IdentitySectionCard } from './IdentitySectionCard';
import { ReadOnlyFieldGrid } from './ReadOnlyFieldGrid';

export interface BuildingTechnicalSectionProps {
  section: IdentitySectionView;
  language: 'fr' | 'en';
}

export function BuildingTechnicalSection({ section, language }: BuildingTechnicalSectionProps) {
  return (
    <IdentitySectionCard
      title={language === 'fr' ? section.titleFr : section.titleEn}
      accent={section.accent}
    >
      <ReadOnlyFieldGrid fields={section.fields} language={language} />
    </IdentitySectionCard>
  );
}
