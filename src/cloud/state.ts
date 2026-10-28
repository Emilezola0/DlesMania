// The account and cloud save, as the pages see them. Firebase itself (src/cloud/engine.ts) only
// loads for players who signed in on this device, opened the account page, or came back from a
// sign-in link — everyone else plays without downloading it.
import { create } from 'zustand';

export type CloudStatus = 'off' | 'loading' | 'signedOut' | 'syncing' | 'synced' | 'offline' | 'error';

export interface CloudActions {
  signInGoogle: () => Promise<void>;
  sendEmailLink: (email: string) => Promise<void>;
  signInPassword: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
  syncNow: () => Promise<void>;
}

interface CloudState {
  status: CloudStatus;
  email: string | null;
  name: string | null;
  lastSync: number | null;
  error: string | null;
  actions: CloudActions | null;
}

export const useCloud = create<CloudState>()(() => ({ status: 'off', email: null, name: null, lastSync: null, error: null, actions: null }));

/** Set when this device has an account signed in: Firebase loads at start to keep the save in step. */
export const SIGNED_IN_FLAG = 'omnidle:cloud';

let starting: Promise<void> | null = null;

/** Loads Firebase and starts listening to the account (once). */
export function startCloud(): Promise<void> {
  if (!starting) {
    useCloud.setState({ status: 'loading' });
    starting = import('./engine').then((m) => m.start()).catch((e) => {
      starting = null;
      useCloud.setState({ status: 'error', error: e instanceof Error ? e.message : String(e) });
    });
  }
  return starting;
}

/** At app start: only when this device signed in before, or a sign-in link brought the player here. */
export function startCloudIfNeeded() {
  let flag = false;
  try {
    flag = localStorage.getItem(SIGNED_IN_FLAG) === '1';
  } catch {
    // No storage: no account on this device.
  }
  if (flag || /[?&]oobCode=/.test(window.location.href)) void startCloud();
}
