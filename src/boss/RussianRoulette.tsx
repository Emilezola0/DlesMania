import { useEffect, useMemo, useRef, useState } from 'react';
import type { Roulette } from '../lib/boss';
import { sfx } from '../lib/sfx';
import { findBestMatch, rankBySearch } from '../utils/textMatcher';
import type { BossCard } from '../types';
import { TimerBar } from './TimerBar';

export interface RouletteResult {
  /** True when the player reached the target; false when the boss picked the same character. */
  survived: boolean;
  safePicks: number;
}

interface Props {
  roulette: Roulette;
  bossName: string;
  /** Lines the boss says after a turn the player survives. */
  spared: string[];
  onSay: (text: string, mood: 'taunt' | 'hit' | 'hurt') => void;
  onDone: (result: RouletteResult) => void;
}

type TurnState = 'choose' | 'spinning' | 'safe' | 'shot' | 'won';

/** Spin steps for the boss's pick: fast at first, slowing onto the chosen character. */
const SPIN_DELAYS = [60, 60, 70, 70, 80, 90, 100, 120, 140, 170, 210, 260, 320];

const spellings = (c: BossCard) => [c.label, ...(c.aliases ?? [])];

/**
 * Hard's secret phase. Each turn the player names a character still at the table; then the boss
 * spins and lands on one of the remaining characters at random — the player's pick included.
 * Same character: the fight is lost on the spot. Otherwise both leave the table, and
 * `picksToWin` safe picks win. The odds (1 in characters left) are shown every turn.
 */
export function RussianRoulette({ roulette, bossName, spared, onSay, onDone }: Props) {
  const { pool, picksToWin, turnSeconds } = roulette;
  const [out, setOut] = useState<Record<string, 'player' | 'boss'>>({});
  const [safe, setSafe] = useState(0);
  const [turn, setTurn] = useState(0);
  const [state, setState] = useState<TurnState>('choose');
  const [choice, setChoice] = useState<string | null>(null);
  const [spinAt, setSpinAt] = useState<string | null>(null);
  const [note, setNote] = useState<{ text: string; key: number } | null>(null);
  const [text, setText] = useState('');
  const [active, setActive] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const timers = useRef<number[]>([]);

  const remaining = useMemo(() => pool.filter((c) => !out[c.label]), [pool, out]);
  const suggestions = useMemo(
    () => (text.trim() ? rankBySearch(text, remaining, spellings, 6) : []),
    [remaining, text],
  );

  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  useEffect(() => {
    if (state === 'choose') input.current?.focus({ preventScroll: true });
  }, [state, turn]);

  const later = (ms: number, fn: () => void) => timers.current.push(window.setTimeout(fn, ms));

  const pick = (card: BossCard, forced = false) => {
    if (state !== 'choose' || out[card.label]) return;
    setText('');
    setActive(0);
    setChoice(card.label);
    setState('spinning');
    if (forced) setNote({ text: `You hesitated — fate picked ${card.label} for you.`, key: Date.now() });
    else setNote(null);
    sfx.select();

    // The boss's pick: uniform over everything still at the table, the player's pick included.
    const table = remaining;
    const bossPick = table[Math.floor(Math.random() * table.length)].label;
    // Spin through the table, ending on the boss's pick.
    const start = Math.floor(Math.random() * table.length);
    const offset = (table.findIndex((c) => c.label === bossPick) - start - SPIN_DELAYS.length + 1 + table.length * 4) % table.length;
    let t = 0;
    SPIN_DELAYS.forEach((delay, i) => {
      t += delay;
      const label = table[(start + offset + i + table.length * 4) % table.length].label;
      later(t, () => {
        setSpinAt(label);
        sfx.tick();
      });
    });

    later(t + 450, () => {
      if (bossPick === card.label) {
        setState('shot');
        sfx.hurt();
        later(1700, () => onDone({ survived: false, safePicks: safe }));
        return;
      }
      const nextSafe = safe + 1;
      setOut((o) => ({ ...o, [card.label]: 'player', [bossPick]: 'boss' }));
      setSafe(nextSafe);
      setSpinAt(null);
      if (nextSafe >= picksToWin) {
        setState('won');
        sfx.streak();
        later(1300, () => onDone({ survived: true, safePicks: nextSafe }));
        return;
      }
      setState('safe');
      sfx.correct();
      onSay(spared[(nextSafe - 1) % Math.max(1, spared.length)] ?? 'Again.', 'hit');
      later(1300, () => {
        setChoice(null);
        setState('choose');
        setTurn((n) => n + 1);
      });
    });
  };

  const submitText = () => {
    const typed = suggestions[active];
    if (typed) return pick(typed);
    const best = findBestMatch(text, pool, spellings);
    if (!best) setNote({ text: `“${text.trim()}” isn't at this table.`, key: Date.now() });
    else if (out[best.item.label]) setNote({ text: `${best.item.label} has already left the table.`, key: Date.now() });
    else return pick(best.item);
    setText('');
  };

  const odds = remaining.length;

  return (
    <div className="space-y-4">
      <div className="text-center">
        <p className="boss-secret-title font-display text-xs font-bold uppercase tracking-[0.4em] text-coral">Secret phase · Russian Roulette</p>
        <h3 className="mt-1 font-display text-xl font-bold sm:text-2xl">
          Name a character — then {bossName} picks one. <span className="text-coral">Never the same.</span>
        </h3>
      </div>

      {/* Chambers: one per safe pick needed. */}
      <div className="flex items-center justify-center gap-2" aria-label={`${safe} of ${picksToWin} safe picks`}>
        {Array.from({ length: picksToWin }, (_, i) => (
          <span
            key={i}
            className={`grid size-8 place-items-center rounded-full border-2 font-display text-xs font-bold transition ${
              i < safe ? 'animate-pop border-hit bg-hit text-on-strong' : i === safe && state === 'shot' ? 'animate-pop border-coral bg-coral text-on-strong' : 'border-rule-strong text-ink-faint'
            }`}
          >
            {i < safe ? '✓' : i === safe && state === 'shot' ? '✗' : i + 1}
          </span>
        ))}
      </div>

      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="font-display font-semibold tracking-wider text-ink-soft">
          Odds this turn: <b className="text-coral">1 in {odds}</b>
        </span>
        <span className="text-ink-faint">{odds} at the table</span>
      </div>

      {turnSeconds > 0 && (
        <TimerBar
          total={turnSeconds * 1000}
          running={state === 'choose'}
          resetKey={turn}
          onExpire={() => remaining.length && pick(remaining[Math.floor(Math.random() * remaining.length)], true)}
        />
      )}

      <ul className={`grid grid-cols-4 gap-2 sm:grid-cols-6 ${state === 'shot' ? 'animate-shake' : ''}`}>
        {pool.map((c) => {
          const gone = out[c.label];
          const isChoice = choice === c.label;
          const isSpin = spinAt === c.label;
          const shot = state === 'shot' && isChoice;
          return (
            <li key={c.label}>
              <button
                type="button"
                disabled={state !== 'choose' || !!gone}
                onClick={() => pick(c)}
                title={c.label}
                className={`group relative block aspect-square w-full overflow-hidden rounded-md border-2 bg-tile transition ${
                  shot
                    ? 'boss-roulette-shot border-coral'
                    : isSpin
                      ? 'z-10 scale-110 border-coral shadow-lg shadow-coral/40'
                      : isChoice
                        ? 'border-accent ring-4 ring-accent/40'
                        : gone
                          ? 'border-rule opacity-35 grayscale'
                          : 'border-rule hover:-translate-y-0.5 hover:border-ink'
                }`}
              >
                {c.image && <img src={c.image} alt="" draggable={false} className="size-full object-cover object-top" />}
                <span className="absolute inset-x-0 bottom-0 truncate bg-black/60 px-1 py-0.5 text-[10px] font-semibold text-white">{c.label}</span>
                {gone && (
                  <span className={`absolute right-1 top-1 rounded-sm px-1 text-[10px] font-bold ${gone === 'player' ? 'bg-hit text-on-strong' : 'bg-coral text-on-strong'}`}>
                    {gone === 'player' ? 'YOU' : 'BOSS'}
                  </span>
                )}
                {isChoice && !gone && state !== 'shot' && <span className="absolute left-1 top-1 rounded-sm bg-accent px-1 text-[10px] font-bold text-on-strong">YOU</span>}
                {shot && <span className="absolute inset-0 grid place-items-center bg-coral/60 font-display text-2xl font-bold text-white">BANG</span>}
              </button>
            </li>
          );
        })}
      </ul>

      <div className="relative">
        <input
          ref={input}
          value={text}
          disabled={state !== 'choose'}
          onChange={(e) => {
            setText(e.target.value);
            setActive(0);
          }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setActive((a) => Math.min(a + 1, suggestions.length - 1));
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              setActive((a) => Math.max(a - 1, 0));
            } else if (e.key === 'Enter' && text.trim()) submitText();
          }}
          placeholder={state === 'choose' ? 'Type a name, or tap a portrait…' : state === 'spinning' ? `${bossName} is choosing…` : ''}
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          className="w-full rounded-xl border border-coral/60 bg-card/90 px-4 py-3 text-base outline-none ring-coral/30 transition placeholder:text-ink-faint focus:border-coral focus:ring-4 disabled:opacity-60"
        />
        {suggestions.length > 0 && state === 'choose' && (
          <ul className="animate-pop absolute z-20 mt-2 w-full overflow-hidden rounded-xl border border-rule-strong bg-card shadow-2xl">
            {suggestions.map((c, i) => (
              <li key={c.label}>
                <button
                  type="button"
                  onMouseEnter={() => setActive(i)}
                  onClick={() => pick(c)}
                  className={`w-full px-4 py-2.5 text-left font-medium ${i === active ? 'bg-accent-soft' : 'hover:bg-tile'}`}
                >
                  {c.label}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <p className="h-5 text-center text-sm font-semibold" aria-live="polite">
        {state === 'spinning' && <span className="text-ink-soft">{note ? note.text : `${bossName} is choosing…`}</span>}
        {state === 'safe' && <span className="animate-pop inline-block text-hit">Click. A different name — you live.</span>}
        {state === 'won' && <span className="animate-pop inline-block text-hit">You survived the roulette!</span>}
        {state === 'shot' && <span className="animate-pop inline-block text-coral">BANG — {bossName} chose {choice} too.</span>}
        {state === 'choose' && note && (
          <span key={note.key} className="animate-pop inline-block text-coral">
            {note.text}
          </span>
        )}
      </p>
    </div>
  );
}
