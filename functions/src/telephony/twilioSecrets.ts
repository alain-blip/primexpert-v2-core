/** Lecture des secrets Twilio Voice JWT (API Key SK…, pas le Auth Token principal). */

export type TwilioVoiceJwtSecrets = {
  accountSid: string;
  apiKey: string;
  apiSecret: string;
  twimlAppSid: string;
  /** Quelle variable d'environnement a fourni le Account SID */
  accountSidSource: 'TWILIO_ACCOUNT_SID' | 'TWILIO_SID';
};

function trimSecret(value: string | undefined): string {
  return (value ?? '').trim();
}

/** Masque une valeur secrète pour les logs (préfixe + 4 derniers caractères). */
export function maskTwilioSecret(value: string, visiblePrefix = 4): string {
  if (!value) return '(vide)';
  if (value.length <= visiblePrefix + 4) return `${value.slice(0, visiblePrefix)}…`;
  return `${value.slice(0, visiblePrefix)}…${value.slice(-4)}`;
}

export function readTwilioVoiceJwtSecrets(): TwilioVoiceJwtSecrets | null {
  const fromAccountSid = trimSecret(process.env.TWILIO_ACCOUNT_SID);
  const fromLegacySid = trimSecret(process.env.TWILIO_SID);
  const accountSid = fromAccountSid || fromLegacySid;
  const accountSidSource: TwilioVoiceJwtSecrets['accountSidSource'] = fromAccountSid
    ? 'TWILIO_ACCOUNT_SID'
    : 'TWILIO_SID';

  const apiKey = trimSecret(process.env.TWILIO_API_KEY);
  const apiSecret = trimSecret(process.env.TWILIO_API_SECRET);
  const twimlAppSid = trimSecret(process.env.TWILIO_TWIML_APP_SID);

  if (!accountSid || !apiKey || !apiSecret || !twimlAppSid) {
    return null;
  }

  return { accountSid, apiKey, apiSecret, twimlAppSid, accountSidSource };
}

export type TwilioSecretDiagnostic = {
  /** `true` si la vérification de conformité des clés est passée. */
  verificationClesConforme: boolean;
  issues: string[];
  present: Record<string, boolean>;
  masked: Record<string, string>;
  accountSidSource?: TwilioVoiceJwtSecrets['accountSidSource'];
};

/**
 * Vérification de conformité des clés Twilio (journal de conformité serveur).
 * Aide au débogage 20101 AccessTokenInvalid — lexique OACIQ : pas « audit ».
 */
export function diagnoseTwilioVoiceJwtSecrets(
  secrets: TwilioVoiceJwtSecrets | null
): TwilioSecretDiagnostic {
  const present = secrets
    ? {
        TWILIO_ACCOUNT_SID: false,
        TWILIO_SID: Boolean(secrets.accountSid),
        TWILIO_API_KEY: Boolean(secrets.apiKey),
        TWILIO_API_SECRET: Boolean(secrets.apiSecret),
        TWILIO_TWIML_APP_SID: Boolean(secrets.twimlAppSid),
      }
    : {
        TWILIO_ACCOUNT_SID: Boolean(trimSecret(process.env.TWILIO_ACCOUNT_SID)),
        TWILIO_SID: Boolean(trimSecret(process.env.TWILIO_SID)),
        TWILIO_API_KEY: Boolean(trimSecret(process.env.TWILIO_API_KEY)),
        TWILIO_API_SECRET: Boolean(trimSecret(process.env.TWILIO_API_SECRET)),
        TWILIO_TWIML_APP_SID: Boolean(trimSecret(process.env.TWILIO_TWIML_APP_SID)),
      };

  if (!secrets) {
    const missing: string[] = [];
    if (!present.TWILIO_ACCOUNT_SID && !present.TWILIO_SID) {
      missing.push('TWILIO_ACCOUNT_SID ou TWILIO_SID');
    }
    if (!present.TWILIO_API_KEY) missing.push('TWILIO_API_KEY');
    if (!present.TWILIO_API_SECRET) missing.push('TWILIO_API_SECRET');
    if (!present.TWILIO_TWIML_APP_SID) missing.push('TWILIO_TWIML_APP_SID');
    return {
      verificationClesConforme: false,
      issues: [`Secret(s) manquant(s) : ${missing.join(', ')}`],
      present,
      masked: {},
    };
  }

  const issues: string[] = [];
  if (!secrets.accountSid.startsWith('AC')) {
    issues.push('Account SID invalide (doit commencer par AC)');
  }
  if (!secrets.apiKey.startsWith('SK')) {
    issues.push('TWILIO_API_KEY invalide (doit être une API Key SK…, pas le Auth Token)');
  }
  if (secrets.apiSecret.startsWith('SK') || secrets.apiSecret.startsWith('AC')) {
    issues.push(
      'TWILIO_API_SECRET ressemble à un SID — utiliser le secret de l’API Key, pas le Auth Token principal'
    );
  }
  if (!secrets.twimlAppSid.startsWith('AP')) {
    issues.push('TWILIO_TWIML_APP_SID invalide (doit commencer par AP)');
  }
  if (present.TWILIO_ACCOUNT_SID && present.TWILIO_SID) {
    const acct = trimSecret(process.env.TWILIO_ACCOUNT_SID);
    const leg = trimSecret(process.env.TWILIO_SID);
    if (acct && leg && acct !== leg) {
      issues.push('TWILIO_ACCOUNT_SID et TWILIO_SID divergent — TWILIO_ACCOUNT_SID est prioritaire');
    }
  }

  return {
    verificationClesConforme: issues.length === 0,
    issues,
    present,
    accountSidSource: secrets.accountSidSource,
    masked: {
      accountSid: maskTwilioSecret(secrets.accountSid, 6),
      apiKey: maskTwilioSecret(secrets.apiKey, 4),
      apiSecret: maskTwilioSecret(secrets.apiSecret, 0),
      twimlAppSid: maskTwilioSecret(secrets.twimlAppSid, 4),
    },
  };
}
