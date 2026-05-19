/**
 * Diffusion Web — barrel des orchestrateurs Cloud Function.
 *
 * Import dynamique recommandé côté `functions/src/index.ts` :
 *   const { publishListingHandler } = await import('./diffusion/publishListingV2');
 *
 * Pour les tests unitaires, on peut importer en statique.
 */

export * from './wordPressClient';
export * from './buildWordPressPayload';
export * from './syndicationStore';
export * from './publishListingV2';
export * from './saveDraftListingV2';
export * from './hideListingV2';
