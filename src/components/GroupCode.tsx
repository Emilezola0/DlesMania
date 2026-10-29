// The dailies' group codes, on the page (the Firestore side: src/cloud/groups.ts, loaded only when used).
// After a category: make a code for the friends who played along. Before finishing one: type a friend's.
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useCloud } from '../cloud/state';
import { celebrateBig } from '../lib/fx';
import { sfx } from '../lib/sfx';
import { dayKey, useProgress } from '../store/progress';
import type { Domain } from '../types';

const groups = () => import('../cloud/groups');
const MAX_JOINS = 12;

/** In the results: the code for this daily (made on request), or who it came from. */
export function GroupHost({ domain, date }: { domain: Domain; date: string }) {
  const key = dayKey(domain, date);
  const mine = useProgress((s) => s.groups?.[key]);
  const { status, email } = useCloud();
  const signedIn = !!email && status !== 'signedOut';
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [joins, setJoins] = useState<number | null>(null);

  const code = mine?.role === 'host' ? mine.code : null;
  useEffect(() => {
    if (!code) return;
    let live = true;
    groups()
      .then((g) => g.groupJoins(code))
      .then((n) => live && setJoins(n))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [code]);

  if (mine?.role === 'joined') {
    return <p className="text-sm font-semibold text-ink-soft">🤝 Played together with {mine.host ?? 'a friend'} (group code {mine.code})</p>;
  }

  const make = async () => {
    setBusy(true);
    setError(null);
    try {
      await (await groups()).makeGroup(domain);
      sfx.streak();
    } catch (e) {
      sfx.wrong();
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };
  const copy = async () => {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      sfx.click();
    } catch {
      /* no clipboard: the code is on screen */
    }
  };

  return (
    <div className="page mx-auto max-w-md space-y-2 rounded-md p-4 text-center">
      <p className="font-display font-bold">🤝 Played this with friends?</p>
      {code ? (
        <>
          <p className="text-sm text-ink-soft">Give them this code: they enter it in their {domain} daily and get your rounds, score, coins and streak — today only.</p>
          <button type="button" onClick={copy} className="mx-auto block rounded-md border-2 border-dashed border-accent px-5 py-2 font-mono text-3xl font-bold tracking-[0.3em] text-accent" title="Copy the code">
            {code}
          </button>
          <p className="text-xs text-ink-faint">
            {copied ? '✓ Copied · ' : 'Tap to copy · '}
            {joins === null ? '…' : `${joins}/${MAX_JOINS}`} friends joined
          </p>
        </>
      ) : signedIn ? (
        <>
          <p className="text-sm text-ink-soft">Make a group code: everyone who played along gets this daily too, as if they&apos;d played it.</p>
          <button type="button" onClick={make} disabled={busy} className="btn-accent rounded-md px-5 py-2 font-display font-bold disabled:opacity-50">
            {busy ? 'Making…' : 'Make a group code'}
          </button>
        </>
      ) : (
        <p className="text-sm text-ink-soft">
          <Link to="/account" className="font-semibold text-accent hover:underline">
            Sign in
          </Link>{' '}
          to make a group code: everyone who played along gets this daily too.
        </p>
      )}
      {error && <p className="text-sm font-semibold text-coral">{error}</p>}
    </div>
  );
}

/** Before a daily is finished: a friend's group code, to get the rounds played together. */
export function GroupJoin({ domain, date, onJoined }: { domain: Domain; date: string; onJoined: () => void }) {
  const key = dayKey(domain, date);
  const used = useProgress((s) => !!s.groups?.[key]);
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (used) return null;

  const join = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await (await groups()).joinGroup(code, domain);
      sfx.streak();
      celebrateBig();
      onJoined();
    } catch (err) {
      sfx.wrong();
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  if (!open) {
    return (
      <button type="button" onClick={() => (sfx.click(), setOpen(true))} className="text-sm font-semibold text-ink-soft underline-offset-2 hover:text-ink hover:underline">
        🤝 Played this with friends? Enter their group code
      </button>
    );
  }
  return (
    <form onSubmit={join} className="page flex flex-wrap items-center gap-2 rounded-md p-3">
      <p className="w-full text-sm text-ink-soft">
        The friend who played makes a code after the last round. With it, the rounds you haven&apos;t finished become theirs — their answers, score, coins and streak.
      </p>
      <input
        value={code}
        onChange={(e) => (setCode(e.target.value.toUpperCase()), setError(null))}
        placeholder="ABC234"
        aria-label="Group code"
        maxLength={8}
        autoComplete="off"
        spellCheck={false}
        className="w-40 rounded-md border border-rule-strong bg-card px-3 py-2 font-mono text-lg font-bold uppercase tracking-[0.25em]"
      />
      <button type="submit" disabled={busy || code.replace(/[^A-Za-z0-9]/g, '').length !== 6} className="btn-accent rounded-md px-4 py-2 font-display font-bold disabled:opacity-40">
        {busy ? 'Joining…' : 'Join'}
      </button>
      <button type="button" onClick={() => setOpen(false)} className="text-sm text-ink-faint hover:text-ink">
        Cancel
      </button>
      {error && <p className="w-full text-sm font-semibold text-coral">{error}</p>}
    </form>
  );
}
