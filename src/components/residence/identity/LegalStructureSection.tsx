import React from 'react';
import type { IdentitySectionView } from '@primexpert/core/identity';
import { IdentitySectionCard } from './IdentitySectionCard';
import { ReadOnlyFieldGrid } from './ReadOnlyFieldGrid';

export interface LegalStructureSectionProps {
  section: IdentitySectionView;
  language: 'fr' | 'en';
}

export function LegalStructureSection({ section, language }: LegalStructureSectionProps) {
  return (
    <IdentitySectionCard
      title={language === 'fr' ? section.titleFr : section.titleEn}
      accent={section.accent}
    >
      <ReadOnlyFieldGrid fields={section.fields} language={language} />
    </IdentitySectionCard>
  );
}
