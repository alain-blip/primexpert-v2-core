/** Jours écoulés depuis trialStartDate (yyyy-mm-dd), minuit locale. */
export function trialDaysElapsed(trialStartIso?: string): number | null {
  if (!trialStartIso) return null;
  const start = new Date(`${trialStartIso}T12:00:00`);
  if (Number.isNaN(start.getTime())) return null;
  return Math.floor((Date.now() - start.getTime()) / 86400000);
}

export function shouldShowJ7Survey(trialStartIso?: string, j7Completed?: boolean): boolean {
  if (j7Completed) return false;
  const days = trialDaysElapsed(trialStartIso);
  if (days === null) return false;
  return days >= 7;
}

export function shouldSendJ21Email(
  trialStartIso?: string,
  lastEmailSent?: string | null
): boolean {
  const days = trialDaysElapsed(trialStartIso);
  if (days === null || days < 21) return false;
  if (lastEmailSent === 'J21' || lastEmailSent === 'J30' || lastEmailSent === 'J40') return false;
  return true;
}
