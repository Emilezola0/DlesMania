import { useState } from 'react';
import { sfx } from '../lib/sfx';

/** One thing a game can be narrowed to (a franchise, a theme, a deck…), in a group (a kind of work…). */
export interface CustomOption {
  key: string;
  label: string;
  /** A group heading ("🎮 Video Games"); options without one share a single list. */
  group?: string;
  /** A tooltip: what's in it. */
  hint?: string;
}

const read = (storageKey: string, all: string[]): string[] => {
  try {
    const v = JSON.parse(localStorage.getItem(storageKey) ?? 'null');
    if (Array.isArray(v)) {
      const picks = all.filter((k) => v.includes(k));
      if (picks.length) return picks;
    }
  } catch {
    // No storage: everything.
  }
  return all;
};

/**
 * What a game is made of, picked by the player as for an Expedition: everything by default, remembered
 * on this device (`storageKey`). `custom` is true when it isn't everything (games keep a separate best then).
 */
export function useCustomPicks(storageKey: string, options: CustomOption[]) {
  const all = options.map((o) => o.key);
  const [picks, setPicks] = useState<string[]>(() => read(storageKey, all));
  const set = (next: string[]) => {
    const ordered = all.filter((k) => next.includes(k));
    setPicks(ordered);
    try {
      localStorage.setItem(storageKey, JSON.stringify(ordered));
    } catch {
      // Not remembered, that's all.
    }
  };
  return { picks, setPicks: set, custom: picks.length < all.length, all };
}

const chip = (on: boolean) =>
  `rounded-full border-2 px-3 py-1.5 text-sm font-semibold transition ${on ? 'border-ink bg-ink text-paper' : 'border-rule-strong bg-card text-ink-soft hover:border-ink'}`;

/**
 * The "⚙ Customise" panel of every game, like the Expedition's: every option one by one, All / None per
 * group, Select / Deselect everything. `min`: how many must stay picked for the game to work.
 */
export function Customise({
  options,
  picks,
  onChange,
  noun = 'franchise',
  min = 1,
  problem,
}: {
  options: CustomOption[];
  picks: string[];
  onChange: (picks: string[]) => void;
  noun?: string;
  min?: number;
  /** Why the current picks can't make a game (beyond `min`), if they can't. */
  problem?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const all = options.map((o) => o.key);
  const set = (next: string[]) => (sfx.click(), onChange(next));
  const toggle = (k: string) => set(picks.includes(k) ? picks.filter((x) => x !== k) : [...picks, k]);
  const groups = [...new Set(options.map((o) => o.group ?? ''))];
  const withKeys = (keys: string[], on: boolean) => set(on ? [...new Set([...picks, ...keys])] : picks.filter((k) => !keys.includes(k)));
  const tooFew = picks.length < min ? `Pick at least ${min} ${noun}${min === 1 ? '' : 's'}.` : null;
  const warning = tooFew ?? problem ?? null;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => (sfx.click(), setOpen((o) => !o))} aria-expanded={open} className="btn-paper rounded-full px-4 py-2 font-display text-sm font-bold">
          ⚙ {open ? 'Hide the details' : 'Customise'}
        </button>
        <span className="text-sm text-ink-soft">
          {picks.length === all.length ? `Everything (${all.length} ${noun}s)` : `Custom: ${picks.length} of ${all.length} ${noun}s`}
        </span>
      </div>
      {warning && <p className="text-sm font-semibold text-miss">{warning}</p>}
      {open && (
        <div className="animate-pop space-y-4 rounded-md border border-rule-strong bg-card p-4">
          <div className="flex flex-wrap items-center justify-end gap-2">
            <button type="button" onClick={() => set(all)} className="btn-paper rounded-md px-3 py-1 text-sm font-semibold">
              Select everything
            </button>
            <button type="button" onClick={() => set([])} className="btn-paper rounded-md px-3 py-1 text-sm font-semibold">
              Deselect everything
            </button>
          </div>
          {groups.map((g) => {
            const list = options.filter((o) => (o.group ?? '') === g);
            return (
              <div key={g || 'all'} className="space-y-1.5">
                {g && (
                  <div className="flex items-center gap-3">
                    <p className="font-display text-sm font-bold">{g}</p>
                    <span className="flex gap-1 text-xs">
                      <button type="button" onClick={() => withKeys(list.map((o) => o.key), true)} className="btn-paper rounded px-2 py-0.5 font-semibold">
                        All
                      </button>
                      <button type="button" onClick={() => withKeys(list.map((o) => o.key), false)} className="btn-paper rounded px-2 py-0.5 font-semibold">
                        None
                      </button>
                    </span>
                  </div>
                )}
                <div className="flex flex-wrap gap-1.5">
                  {list.map((o) => (
                    <button key={o.key} type="button" aria-pressed={picks.includes(o.key)} title={o.hint} onClick={() => toggle(o.key)} className={chip(picks.includes(o.key))}>
                      {o.label}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
