/**
 * Ligne inventaire — délègue à la carte institutionnelle coupe-feu.
 */

import React from 'react';
import type { Residence } from '../services/residences';
import type { RadarPropertyType } from '../lib/radarAccess';
import { ListingInstitutionalCard } from './ListingInstitutionalCard';

export type ListingRowProps = React.ComponentProps<typeof ListingInstitutionalCard>;

export function ListingRow(props: React.ComponentProps<typeof ListingInstitutionalCard>) {
  return <ListingInstitutionalCard {...props} className="mb-0" />;
}
