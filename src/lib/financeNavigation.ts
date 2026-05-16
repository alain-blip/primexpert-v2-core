/** Ouvre Paramètres puis l’onglet Finance (admin_system) après navigation Workhub. */
export const OPEN_FINANCE_STORAGE_KEY = 'primexpert_open_finance';

export function requestOpenFinanceTab(): void {
  try {
    sessionStorage.setItem(OPEN_FINANCE_STORAGE_KEY, '1');
  } catch {
    /* ignore */
  }
}

export function consumeOpenFinanceIntent(): boolean {
  try {
    if (sessionStorage.getItem(OPEN_FINANCE_STORAGE_KEY) !== '1') return false;
    sessionStorage.removeItem(OPEN_FINANCE_STORAGE_KEY);
    return true;
  } catch {
    return false;
  }
}
