/**
 * @primexpert/core — Barrel exports
 *
 * Préférer les imports directs par sous-module pour le tree-shaking :
 *   import { computeNoi } from '@primexpert/core/valuation';
 *   import { withTenantFilter } from '@primexpert/core/tenant';
 *
 * Ce fichier expose seulement les types globaux.
 */

export * as canonical from './canonical';
export * as valuation from './valuation';
export * as narrative from './narrative';
export * as quality from './quality';
export * as sources from './sources';
export * as exportDataset from './export';
export * as tenant from './tenant';
