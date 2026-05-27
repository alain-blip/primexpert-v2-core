/**
 * Twilio Voice SDK — appels WebRTC depuis le navigateur (Phase 1 VOIP).
 * Import dynamique pour ne pas alourdir ni bloquer le chargement du Workhub.
 */

import { auth } from '../lib/firebase';
import { getFunctionsBaseUrl } from '../lib/functionsBaseUrl';

type TwilioDevice = import('@twilio/voice-sdk').Device;
type TwilioCall = import('@twilio/voice-sdk').Call;

let device: TwilioDevice | null = null;
let activeCall: TwilioCall | null = null;
let isInitializing = false;
let isReady = false;
let preferredEdge: string = import.meta.env.VITE_TWILIO_EDGE || 'roaming';

type CallActiveListener = (active: boolean) => void;
const callActiveListeners = new Set<CallActiveListener>();

function setCallActive(active: boolean): void {
  for (const listener of callActiveListeners) listener(active);
}

/** Abonnement UI — reflète la présence d’un appel WebRTC actif. */
export function subscribeCallActive(listener: CallActiveListener): () => void {
  callActiveListeners.add(listener);
  listener(activeCall !== null);
  return () => {
    callActiveListeners.delete(listener);
  };
}

export function isCallActive(): boolean {
  return activeCall !== null;
}

function logFermetureLigneConformite(detail?: Record<string, unknown>): void {
  console.info(
    '[TwilioVoice] Vérification de fermeture de ligne de conformité',
    detail ?? {}
  );
}

function clearActiveCall(): void {
  activeCall = null;
  setCallActive(false);
}

function bindCallLifecycle(call: TwilioCall): void {
  call.on('accept', () => setCallActive(true));
  call.on('error', (err) => {
    console.error('[TwilioVoice] Call error:', err);
    clearActiveCall();
  });
  call.on('disconnect', () => {
    logFermetureLigneConformite({ source: 'remote_or_sdk_disconnect' });
    clearActiveCall();
  });
  call.on('cancel', () => {
    logFermetureLigneConformite({ source: 'cancel' });
    clearActiveCall();
  });
}

async function loadTwilioVoiceSdk() {
  return import('@twilio/voice-sdk');
}

async function fetchTwilioToken(): Promise<string> {
  const user = auth.currentUser;
  if (!user) throw new Error('Non authentifié');

  const idToken = await user.getIdToken(true);
  const response = await fetch(`${getFunctionsBaseUrl()}/getTwilioToken`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${idToken}` },
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error || 'Impossible de récupérer le jeton Twilio');
  }

  const data = (await response.json()) as { token: string };
  return data.token;
}

export async function initializeTwilioDevice(): Promise<void> {
  if (isInitializing) return;
  if (device && isReady) return;

  isInitializing = true;
  try {
    const { Device } = await loadTwilioVoiceSdk();
    const token = await fetchTwilioToken();
    device = new Device(token, {
      codecPreferences: ['opus', 'pcmu'],
      logLevel: 1,
      edge: preferredEdge,
      closeProtection: true,
    });

    device.on('registered', () => {
      isReady = true;
    });

    device.on('unregistered', () => {
      isReady = false;
    });

    device.on('error', (error) => {
      console.error('[TwilioVoice] Device error:', error);
      if (error?.code === 31005 && preferredEdge !== 'roaming') {
        preferredEdge = 'roaming';
      }
      if (error?.code === 31005) isReady = false;
    });

    device.on('tokenWillExpire', async () => {
      if (!auth.currentUser || !device) return;
      try {
        const newToken = await fetchTwilioToken();
        device.updateToken(newToken);
      } catch (e) {
        console.error('[TwilioVoice] Token refresh failed', e);
        isReady = false;
      }
    });

    await device.register();
  } finally {
    isInitializing = false;
  }
}

export async function makeBrowserCall(
  to: string,
  residenceId: string | null = null,
  brokerId: string | null = null,
  contactId: string | null = null
): Promise<{ success: boolean; callSid?: string }> {
  if (!device || !isReady) {
    await initializeTwilioDevice();
  }
  if (!device) throw new Error('Appareil Twilio indisponible');
  if (activeCall) throw new Error('Un appel est déjà en cours');

  activeCall = await device.connect({
    params: {
      To: to,
      residenceId: residenceId ?? '',
      brokerId: brokerId ?? '',
      contactId: contactId ?? '',
    },
  });

  setCallActive(true);
  bindCallLifecycle(activeCall);

  return { success: true, callSid: activeCall.parameters?.CallSid };
}

/** Coupe l’appel WebRTC en cours (bouton Raccrocher). */
export function hangupBrowserCall(): void {
  if (activeCall) {
    activeCall.disconnect();
    clearActiveCall();
  } else if (device) {
    device.disconnectAll();
    clearActiveCall();
  }
  logFermetureLigneConformite({ source: 'user_hangup' });
}

/** @deprecated Préférer `isCallActive()` */
export function hasActiveCall(): boolean {
  return isCallActive();
}
