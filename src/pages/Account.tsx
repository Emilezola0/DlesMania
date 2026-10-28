import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { NameLangSwitch } from '../components/NameLangSwitch';
import { Spinner } from '../components/Spinner';
import { mergeSaves, pickSave, type SaveData } from '../cloud/merge';
import { CARD_BY_ID, RARITY_INFO } from '../gacha/cards';
import { CardAvatar } from '../gacha/Perks';
import { startCloud, useCloud } from '../cloud/state';
import { todayKey } from '../lib/date';
import { sfx } from '../lib/sfx';
import { useProgress } from '../store/progress';

const STATUS: Record<string, string> = {
  off: 'Not connected',
  loading: 'Connecting…',
  signedOut: 'Not signed in',
  syncing: 'Saving…',
  synced: 'Saved to your account',
  offline: 'Offline — saved here, sent when back online',
  error: 'Not saved to your account',
};

/** Export and import: the whole save as a file, account or not. */
function Backup() {
  const file = useRef<HTMLInputElement>(null);
  const [note, setNote] = useState<string | null>(null);
  const exportSave = () => {
    const blob = new Blob([JSON.stringify({ omnidle: 1, exported: new Date().toISOString(), save: pickSave(useProgress.getState()) }, null, 1)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `omnidle-save-${todayKey()}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    sfx.click();
    setNote('Save downloaded.');
  };
  const importSave = async (f: File | undefined) => {
    if (!f) return;
    try {
      const parsed = JSON.parse(await f.text());
      const save = parsed?.save as SaveData | undefined;
      if (!parsed?.omnidle || !save || typeof save !== 'object') throw new Error('not a save');
      if (!window.confirm('Add this save to your progress? Days, bests and cards are combined; the coin balance and the Expedition run come from the file.')) return;
      useProgress.setState(mergeSaves(pickSave(useProgress.getState()), save, { firstLink: false, cloudNewer: true }));
      sfx.streak();
      setNote('Save imported.');
    } catch {
      sfx.wrong();
      setNote("That file isn't an Omnidle save.");
    } finally {
      if (file.current) file.current.value = '';
    }
  };
  return (
    <section className="page space-y-3 rounded-md p-5">
      <h2 className="font-display text-lg font-bold">Backup</h2>
      <p className="text-sm text-ink-soft">Your whole save as a file — to keep, or to bring to another browser without an account.</p>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={exportSave} className="btn-paper rounded-md px-4 py-2 font-semibold">
          ⬇ Export save
        </button>
        <button type="button" onClick={() => file.current?.click()} className="btn-paper rounded-md px-4 py-2 font-semibold">
          ⬆ Import save
        </button>
        <input ref={file} type="file" accept="application/json,.json" className="hidden" onChange={(e) => importSave(e.target.files?.[0])} />
      </div>
      {note && <p className="text-sm font-semibold">{note}</p>}
    </section>
  );
}

/** The cards the player shows: their icon and their background, picked in the album. */
function Profile() {
  const avatar = useProgress((s) => (s.avatar && s.cards[s.avatar] ? CARD_BY_ID.get(s.avatar) : undefined));
  const backdrop = useProgress((s) => (s.backdrop && s.cards[s.backdrop] ? CARD_BY_ID.get(s.backdrop) : undefined));
  const setAvatar = useProgress((s) => s.setAvatar);
  const setBackdrop = useProgress((s) => s.setBackdrop);
  const reactions = useProgress((s) => s.cardReactions ?? true);
  const setReactions = useProgress((s) => s.setCardReactions);
  const row = (label: string, card: typeof avatar, clear: () => void) => (
    <div className="flex items-center gap-3">
      {card ? <CardAvatar card={card} className="size-10" /> : <span className="grid size-10 place-items-center rounded-full border-2 border-dashed border-rule-strong text-ink-faint">?</span>}
      <div className="min-w-0 flex-1">
        <p className="text-xs uppercase tracking-widest text-ink-faint">{label}</p>
        <p className="truncate font-semibold">{card ? `${card.name} · ${RARITY_INFO[card.rarity].name}` : 'None'}</p>
      </div>
      {card && (
        <button type="button" onClick={clear} className="btn-paper rounded-md px-3 py-1 text-sm font-semibold">
          Remove
        </button>
      )}
    </div>
  );
  return (
    <section className="page space-y-3 rounded-md p-5">
      <h2 className="font-display text-lg font-bold">Your cards on show</h2>
      {row('Icon', avatar, () => setAvatar(null))}
      {row('Background', backdrop, () => setBackdrop(null))}
      <label className="flex cursor-pointer items-start gap-3 rounded-md border border-rule p-3">
        <input type="checkbox" checked={reactions} onChange={(e) => setReactions(e.target.checked)} className="mt-1 size-4 accent-[var(--color-accent)]" />
        <span>
          <span className="block font-semibold">Cards react while you play</span>
          <span className="block text-sm text-ink-soft">A Legendary or Mythic icon pops up with a word on a right answer, a mistake or a big win (a Mythic says its voice line); a Legendary or Mythic background lights up, winces or bursts.</span>
        </span>
      </label>
      <p className="text-xs text-ink-faint">
        Pick them in the{' '}
        <Link to="/album" className="font-semibold text-accent">
          Album
        </Link>
        : open a card, then “Use as my icon” — or, for a Rare card or better, “Use as background”.
      </p>
    </section>
  );
}

/** /account */
export default function Account() {
  const { status, email, name, lastSync, error, actions } = useCloud();
  const [mode, setMode] = useState<'link' | 'password'>('link');
  const [form, setForm] = useState({ email: '', password: '' });
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => void startCloud(), []);

  const signedIn = !!email && status !== 'signedOut';
  const go = async (f: () => Promise<void>) => {
    setBusy(true);
    try {
      await f();
      return true;
    } catch {
      return false;
    } finally {
      setBusy(false);
    }
  };
  const field = 'w-full rounded-md border border-rule-strong bg-card px-3 py-2.5 outline-none focus:border-accent';

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <Link to="/" className="font-display text-sm font-semibold tracking-wider text-ink-soft hover:text-ink">
          ← Omnidle
        </Link>
        <h1 className="text-5xl font-bold">Account</h1>
        <p className="text-ink-soft">Sign in to keep the same streak, album, coins and bests on your phone and your computer. Without an account, everything stays saved in this browser.</p>
      </div>

      {status === 'off' || status === 'loading' || !actions ? (
        <p className="flex items-center gap-2 text-ink-soft">
          <Spinner /> Connecting…
        </p>
      ) : signedIn ? (
        <section className="page space-y-4 rounded-md p-5">
          <div>
            <p className="font-display text-xs uppercase tracking-[0.3em] text-ink-faint">Signed in as</p>
            <p className="text-xl font-bold">{name ?? email}</p>
            {name && <p className="text-sm text-ink-soft">{email}</p>}
          </div>
          <p className={`flex items-center gap-2 text-sm font-semibold ${status === 'error' ? 'text-coral' : status === 'synced' ? 'text-hit' : 'text-ink-soft'}`}>
            {status === 'syncing' ? <Spinner /> : status === 'synced' ? '✓' : status === 'error' ? '⚠' : '•'} {STATUS[status]}
            {status === 'synced' && lastSync && <span className="font-normal text-ink-faint">· {new Date(lastSync).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>}
          </p>
          {error && <p className="text-sm text-coral">{error}</p>}
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={busy} onClick={() => go(actions.syncNow)} className="btn-accent rounded-md px-4 py-2 font-semibold disabled:opacity-50">
              ⟳ Sync now
            </button>
            <button type="button" disabled={busy} onClick={() => go(actions.signOut)} className="btn-paper rounded-md px-4 py-2 font-semibold">
              Sign out
            </button>
          </div>
          <p className="text-xs text-ink-faint">Signing out keeps your progress in this browser; signing in again on any device brings it all back.</p>
        </section>
      ) : (
        <section className="page space-y-4 rounded-md p-5">
          <button type="button" disabled={busy} onClick={() => go(actions.signInGoogle)} className="btn-ink flex w-full items-center justify-center gap-3 rounded-md px-4 py-3 font-display font-bold">
            <svg viewBox="0 0 48 48" className="size-5" aria-hidden>
              <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
              <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
              <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
              <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
            </svg>
            Continue with Google
          </button>
          <div className="flex items-center gap-3 text-xs uppercase tracking-widest text-ink-faint">
            <span className="h-px flex-1 bg-rule" /> or with your email <span className="h-px flex-1 bg-rule" />
          </div>
          <div className="flex gap-1.5 text-sm">
            {(['link', 'password'] as const).map((m) => (
              <button key={m} type="button" onClick={() => (setMode(m), setSent(false))} className={`rounded-full border-2 px-3 py-1 font-semibold ${mode === m ? 'border-ink bg-ink text-paper' : 'border-rule-strong text-ink-soft'}`}>
                {m === 'link' ? 'Email me a link' : 'Password'}
              </button>
            ))}
          </div>
          <form
            className="space-y-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (mode === 'link') void go(() => actions.sendEmailLink(form.email)).then((ok) => ok && setSent(true));
              else void go(() => actions.signInPassword(form.email, form.password));
            }}
          >
            <input type="email" required autoComplete="email" placeholder="you@example.com" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className={field} />
            {mode === 'password' && (
              <input type="password" required minLength={6} autoComplete="current-password" placeholder="Password (6 characters or more)" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className={field} />
            )}
            <div className="flex flex-wrap gap-2">
              <button type="submit" disabled={busy} className="btn-accent rounded-md px-4 py-2 font-semibold disabled:opacity-50">
                {mode === 'link' ? 'Send me a sign-in link' : 'Sign in'}
              </button>
              {mode === 'password' && (
                <>
                  <button type="button" disabled={busy || !form.email || form.password.length < 6} onClick={() => go(() => actions.register(form.email, form.password))} className="btn-paper rounded-md px-4 py-2 font-semibold disabled:opacity-50">
                    Create an account
                  </button>
                  <button type="button" disabled={busy || !form.email} onClick={() => go(() => actions.resetPassword(form.email)).then((ok) => ok && setSent(true))} className="text-sm font-semibold text-ink-soft underline-offset-2 hover:underline disabled:opacity-50">
                    Forgot it?
                  </button>
                </>
              )}
            </div>
          </form>
          {sent && <p className="text-sm font-semibold text-hit">✉ Sent to {form.email} — open the email on this device and follow the link{mode === 'password' ? ' to choose a new password' : ''}. Check the spam folder if it isn&apos;t there in a minute.</p>}
          {error && <p className="text-sm font-semibold text-coral">{error}</p>}
          <p className="text-xs text-ink-faint">Your progress in this browser comes with you: the first time you sign in here, it&apos;s added to your account.</p>
        </section>
      )}

      <Profile />

      <section className="page flex flex-wrap items-center justify-between gap-3 rounded-md p-5">
        <div>
          <h2 className="font-display text-lg font-bold">Names</h2>
          <p className="text-sm text-ink-soft">Show characters and titles in English or in French, where they differ.</p>
        </div>
        <NameLangSwitch />
      </section>

      <Backup />
    </div>
  );
}
