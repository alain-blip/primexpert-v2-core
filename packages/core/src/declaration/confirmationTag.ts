/**
 * Code de sécurité — déclaration vendeur certifiée.
 */

export function generateDeclarationConfirmationTag(residenceId: string): string {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const suffix = residenceId.replace(/[^a-zA-Z0-9]/g, '').slice(-6).toUpperCase() || 'DV';
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `CONF-DV-${suffix}-${date}-${rand}`;
}
