import { useState } from 'react';
import { todayKey } from '../lib/date';
import { sfx } from '../lib/sfx';
import { useProgress } from '../store/progress';
import { DleCoin } from './DleCoin';

/**
 * The developer's code box, on the dev server only (`npm run dev`): the built site never shows it, and its code
 * word isn't in the bundle (`import.meta.env.DEV` is false there, so the box and its word are left out).
 * DEVELOPERADMIN gives 5,000 DleCoins once a day, like the daily gift (counted in this browser).
 */
const CODES: Record<string, number> = { DEVELOPERADMIN: 5000 };
const usedKey = (code: string) => `omnidle:dev-code:${code}:${todayKey()}`;

export function DevCode() {
  const [text, setText] = useState('');
  const [note, setNote] = useState<string | null>(null);

  const redeem = () => {
    const code = text.trim().toUpperCase();
    const coins = CODES[code];
    if (!coins) return (sfx.wrong(), setNote('Unknown code.'));
    try {
      if (localStorage.getItem(usedKey(code))) return setNote('Already used today: come back tomorrow.');
      localStorage.setItem(usedKey(code), '1');
    } catch {
      // No storage: paid anyway (dev only).
    }
    useProgress.setState((s) => ({ coins: (s.coins ?? 0) + coins }));
    sfx.correct();
    setText('');
    setNote(`+${coins.toLocaleString()} DleCoins.`);
  };

  return (
    <section className="page space-y-2 rounded-md border-2 border-dashed border-ochre/60 p-5">
      <h2 className="font-display text-lg font-bold">Code (dev server only)</h2>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          redeem();
        }}
      >
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Enter a code" aria-label="Code" className="w-full rounded-md border border-rule-strong bg-card px-3 py-2 uppercase outline-none focus:border-accent" />
        <button type="submit" disabled={!text.trim()} className="btn-accent rounded-md px-4 py-2 font-semibold disabled:opacity-50">
          Redeem
        </button>
      </form>
      {note && (
        <p className="flex items-center gap-1 text-sm text-ink-soft">
          {note.startsWith('+') && <DleCoin className="size-4" />}
          {note}
        </p>
      )}
    </section>
  );
}
