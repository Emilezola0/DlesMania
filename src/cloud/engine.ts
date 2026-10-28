// The cloud save, with Firebase: sign-in (Google, an emailed link, or email and password), and the
// save kept in step — loaded and merged when signing in and when the page comes back into view,
// written a moment after every change. One document per player (saves/<uid>) holds everything
// small; the dailies, which grow every day, go one document per month (saves/<uid>/months/<YYYY-MM>).
import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  getRedirectResult,
  isSignInWithEmailLink,
  onAuthStateChanged,
  sendPasswordResetEmail,
  sendSignInLinkToEmail,
  signInWithEmailAndPassword,
  signInWithEmailLink,
  signInWithPopup,
  signInWithRedirect,
  signOut as fbSignOut,
  type User,
} from 'firebase/auth';
import { collection, doc, getDoc, getDocs, writeBatch } from 'firebase/firestore';
import { useProgress } from '../store/progress';
import { auth, db } from './firebase';
import { BY_MONTH, SYNCED, mergeSaves, monthOf, pickSave, type SaveData } from './merge';
import { SIGNED_IN_FLAG, useCloud } from './state';

const EMAIL_KEY = 'omnidle:cloud:email';
const LINKED_KEY = 'omnidle:cloud:linked';
const CHANGED_KEY = 'omnidle:cloud:changedAt';
const PUSH_AFTER_MS = 2000;
const PULL_EVERY_MS = 30_000;


const store = {
  get: (k: string) => {
    try {
      return localStorage.getItem(k);
    } catch {
      return null;
    }
  },
  set: (k: string, v: string | null) => {
    try {
      if (v === null) localStorage.removeItem(k);
      else localStorage.setItem(k, v);
    } catch {
      // Not remembered: the next sign-in counts as a first one.
    }
  },
};

/** Firebase's error codes, in words. */
function explain(e: unknown): string {
  const code = (e as { code?: string })?.code ?? '';
  const words: Record<string, string> = {
    'auth/invalid-credential': 'Wrong email or password.',
    'auth/invalid-email': "That email address doesn't look right.",
    'auth/user-not-found': 'No account with that email.',
    'auth/wrong-password': 'Wrong email or password.',
    'auth/email-already-in-use': 'An account already uses that email — sign in instead.',
    'auth/weak-password': 'Pick a password of at least 6 characters.',
    'auth/too-many-requests': 'Too many tries — wait a moment.',
    'auth/network-request-failed': 'No connection.',
    'auth/unauthorized-domain': "This site isn't in the Firebase project's authorized domains yet.",
    'auth/operation-not-allowed': "This way of signing in isn't turned on in the Firebase project yet.",
    'auth/invalid-action-code': 'That sign-in link has expired or was already used: ask for a new one.',
    'permission-denied': "The database rules don't allow this save yet.",
  };
  return words[code] ?? (e instanceof Error ? e.message : String(e));
}

const fail = (e: unknown) => {
  const offline = typeof navigator !== 'undefined' && !navigator.onLine;
  useCloud.setState({ status: offline ? 'offline' : 'error', error: offline ? null : explain(e) });
};

// ── The save in the cloud ─────────────────────────────────────────────
type Cloud = { data: SaveData; updatedAt: number } | null;

const monthDocs = (uid: string) => collection(db, 'saves', uid, 'months');

async function readCloud(uid: string): Promise<Cloud> {
  const [main, months] = await Promise.all([getDoc(doc(db, 'saves', uid)), getDocs(monthDocs(uid))]);
  if (!main.exists() && months.empty) return null;
  const m = main.data() ?? {};
  const data = (m.data ? JSON.parse(m.data) : {}) as SaveData;
  for (const k of BY_MONTH) (data as Record<string, unknown>)[k] = {};
  months.forEach((d) => {
    const part = d.data();
    for (const k of BY_MONTH) if (part[k]) Object.assign((data as unknown as Record<string, Record<string, unknown>>)[k], JSON.parse(part[k]));
  });
  return { data, updatedAt: Number(m.updatedAt ?? 0) };
}

/** The small part of the save, as written to the main document. */
const mainJson = (d: SaveData) => JSON.stringify(Object.fromEntries(SYNCED.filter((k) => !(BY_MONTH as readonly string[]).includes(k)).map((k) => [k, d[k]])));

let lastPushed: SaveData | null = null;
let lastMain = '';

/** Writes what changed since the last write (everything when `all`). */
async function push(uid: string, all = false) {
  const data = pickSave(useProgress.getState());
  const json = mainJson(data);
  // The months whose dailies changed: a day's entry is replaced (never edited in place) when it changes.
  const months = new Set<string>();
  for (const k of BY_MONTH) {
    const now = data[k] as Record<string, unknown>;
    const before = (lastPushed?.[k] ?? {}) as Record<string, unknown>;
    for (const key of Object.keys(now)) if (all || now[key] !== before[key]) months.add(monthOf(key));
  }
  if (!all && json === lastMain && !months.size) return;
  useCloud.setState({ status: 'syncing' });
  const batch = writeBatch(db);
  batch.set(doc(db, 'saves', uid), { v: 1, updatedAt: Number(store.get(CHANGED_KEY) ?? Date.now()), data: json });
  for (const month of months) {
    const part: Record<string, string> = {};
    for (const k of BY_MONTH) part[k] = JSON.stringify(Object.fromEntries(Object.entries(data[k] as Record<string, unknown>).filter(([key]) => monthOf(key) === month)));
    batch.set(doc(monthDocs(uid), month), part);
  }
  await batch.commit();
  lastPushed = data;
  lastMain = json;
  useCloud.setState({ status: 'synced', lastSync: Date.now(), error: null });
}

let applying = false;

/** Loads the account's save and merges it into this device's, then writes the result back. */
async function pull(uid: string) {
  useCloud.setState({ status: 'syncing' });
  const cloud = await readCloud(uid);
  const firstLink = store.get(LINKED_KEY) !== uid;
  const cloudNewer = !!cloud && cloud.updatedAt > Number(store.get(CHANGED_KEY) ?? 0);
  const merged = mergeSaves(pickSave(useProgress.getState()), cloud?.data ?? null, { firstLink, cloudNewer });
  applying = true;
  useProgress.setState(merged);
  applying = false;
  store.set(LINKED_KEY, uid);
  if (firstLink || !cloudNewer) store.set(CHANGED_KEY, String(Date.now()));
  else store.set(CHANGED_KEY, String(cloud!.updatedAt));
  await push(uid, true);
}

// ── Keeping in step ───────────────────────────────────────────────────
let stopWatching: (() => void) | null = null;

function watch(uid: string) {
  stopWatching?.();
  let timer = 0;
  let lastPull = Date.now();
  const flush = () => {
    window.clearTimeout(timer);
    timer = 0;
    push(uid).catch(fail);
  };
  const unsub = useProgress.subscribe((s, prev) => {
    if (applying || SYNCED.every((k) => s[k] === prev[k])) return;
    store.set(CHANGED_KEY, String(Date.now()));
    window.clearTimeout(timer);
    timer = window.setTimeout(flush, PUSH_AFTER_MS);
  });
  // Leaving the page: write now. Coming back: see what the other devices did.
  const onVisible = () => {
    if (document.visibilityState === 'hidden') return timer && flush();
    if (Date.now() - lastPull > PULL_EVERY_MS) ((lastPull = Date.now()), pull(uid).catch(fail));
  };
  const onOnline = () => pull(uid).catch(fail);
  document.addEventListener('visibilitychange', onVisible);
  window.addEventListener('online', onOnline);
  stopWatching = () => {
    unsub();
    window.clearTimeout(timer);
    document.removeEventListener('visibilitychange', onVisible);
    window.removeEventListener('online', onOnline);
    stopWatching = null;
  };
}

async function signedIn(user: User) {
  store.set(SIGNED_IN_FLAG, '1');
  useCloud.setState({ email: user.email, name: user.displayName, error: null });
  try {
    await pull(user.uid);
    watch(user.uid);
    // Cards that came back for offers taken while away.
    void import('./trades').then((t) => t.collectTrades()).catch(() => {});
  } catch (e) {
    fail(e);
    // Still keep writing what's played here; a later pull will merge.
    watch(user.uid);
  }
}

// ── Signing in and out ────────────────────────────────────────────────
const here = () => `${window.location.origin}${window.location.pathname}#/account`;

const run = async (f: () => Promise<unknown>) => {
  useCloud.setState({ error: null });
  try {
    await f();
  } catch (e) {
    const code = (e as { code?: string })?.code;
    if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') return;
    useCloud.setState({ error: explain(e) });
    throw e;
  }
};

const actions = {
  signInGoogle: () =>
    run(async () => {
      const provider = new GoogleAuthProvider();
      try {
        await signInWithPopup(auth, provider);
      } catch (e) {
        // Popups blocked (some phones): the full-page way instead.
        if ((e as { code?: string })?.code === 'auth/popup-blocked') await signInWithRedirect(auth, provider);
        else throw e;
      }
    }),
  sendEmailLink: (email: string) =>
    run(async () => {
      await sendSignInLinkToEmail(auth, email, { url: here(), handleCodeInApp: true });
      store.set(EMAIL_KEY, email);
    }),
  signInPassword: (email: string, password: string) => run(() => signInWithEmailAndPassword(auth, email, password)),
  register: (email: string, password: string) => run(() => createUserWithEmailAndPassword(auth, email, password)),
  resetPassword: (email: string) => run(() => sendPasswordResetEmail(auth, email, { url: here() })),
  signOut: () =>
    run(async () => {
      stopWatching?.();
      const uid = auth.currentUser?.uid;
      if (uid) await push(uid).catch(() => {});
      await fbSignOut(auth);
      store.set(SIGNED_IN_FLAG, null);
    }),
  syncNow: () =>
    run(async () => {
      const uid = auth.currentUser?.uid;
      if (uid) await pull(uid);
    }),
};

export async function start() {
  useCloud.setState({ actions });
  // Back from an emailed sign-in link.
  if (isSignInWithEmailLink(auth, window.location.href)) {
    const email = store.get(EMAIL_KEY) ?? window.prompt('To finish signing in, type the email address the link was sent to:');
    if (email) {
      try {
        await signInWithEmailLink(auth, email, window.location.href);
        store.set(EMAIL_KEY, null);
      } catch (e) {
        useCloud.setState({ error: explain(e) });
      }
    }
    window.history.replaceState(null, '', here());
  }
  getRedirectResult(auth).catch((e) => useCloud.setState({ error: explain(e) }));
  onAuthStateChanged(auth, (user) => {
    if (user) void signedIn(user);
    else {
      stopWatching?.();
      store.set(SIGNED_IN_FLAG, null);
      useCloud.setState({ status: 'signedOut', email: null, name: null });
    }
  });
}
