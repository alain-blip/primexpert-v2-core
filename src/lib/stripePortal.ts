import { STRIPE_CUSTOMER_PORTAL_URL } from '../config/companyConfig';

export function openStripeCustomerPortal(): boolean {
  if (!STRIPE_CUSTOMER_PORTAL_URL) {
    return false;
  }
  window.open(STRIPE_CUSTOMER_PORTAL_URL, '_blank', 'noopener,noreferrer');
  return true;
}

export function isStripePortalConfigured(): boolean {
  return Boolean(STRIPE_CUSTOMER_PORTAL_URL);
}
