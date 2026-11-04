import { useEffect, useRef, useState } from 'react';
import { Coins } from '../components/DleCoin';
import { celebrate, celebrateBig } from '../lib/fx';
import { sfx } from '../lib/sfx';
import { econToday, useProgress } from '../store/progress';
import { ROULETTE, type RoulettePrize } from './economy';

/** The wheel's slices, clockwise from the pointer: one jackpot, two small prizes, the rest empty. */
const SLICES: RoulettePrize[] = Array.from({ length: 20 }, (_, i) => (i === 0 ? 'jackpot' : i === 5 || i === 15 ? 'small' : 'none'));
const SLICE = 360 / SLICES.length;
const COLOR: Record<RoulettePrize, [string, string]> = {
  jackpot: ['#fbbf24', '#fbbf24'],
  small: ['#2dd4bf', '#2dd4bf'],
  none: ['#2a1f5c', '#1d1640'],
};
const ICON: Record<RoulettePrize, string> = { jackpot: '💎', small: '🪙', none: '' };
const WHEEL = `conic-gradient(${SLICES.map((p, i) => `${COLOR[p][i % 2]} ${i * SLICE}deg ${(i + 1) * SLICE}deg`).join(', ')})`;
const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/** The Card Shop's roulette: a few coins a spin, a few spins a day, and a small chance of a jackpot. */
export function Roulette() {
  const coins = useProgress((s) => s.coins);
  const spins = econToday(useProgress((s) => s.econ)).spins ?? 0;
  const spin = useProgress((s) => s.spinRoulette);
  const [angle, setAngle] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState<{ prize: RoulettePrize; coins: number } | null>(null);
  const timer = useRef<number>();
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const left = Math.max(0, ROULETTE.dailySpins - spins);
  const canSpin = !spinning && left > 0 && coins >= ROULETTE.cost;
  const duration = reducedMotion() ? 400 : 3200;

  const go = () => {
    if (!canSpin) return;
    const r = spin();
    if (!r) return;
    sfx.click();
    // Land on a slice of the prize that came up, somewhere inside it (never on its edge).
    const matches = SLICES.flatMap((p, i) => (p === r.prize ? [i] : []));
    const i = matches[Math.floor(Math.random() * matches.length)];
    const inside = (0.2 + Math.random() * 0.6) * SLICE;
    const target = 360 - (i * SLICE + inside);
    setAngle((a) => a - (a % 360) + 360 * 5 + target);
    setResult(null);
    setSpinning(true);
    timer.current = window.setTimeout(() => {
      setSpinning(false);
      setResult(r);
      if (r.prize === 'jackpot') (sfx.victory(), celebrateBig());
      else if (r.prize === 'small') (sfx.streak(), celebrate());
      else sfx.near();
    }, duration);
  };

  return (
    <section className="space-y-3">
      <h2 className="font-display text-lg font-bold">🎰 Roulette</h2>
      <div className="page flex flex-wrap items-center gap-6 rounded-md p-4">
        <div className="relative mx-auto size-44 shrink-0 sm:mx-0">
          {/* The pointer, at the top. */}
          <div className="absolute left-1/2 top-[-6px] z-10 -translate-x-1/2 border-x-[9px] border-t-[16px] border-x-transparent border-t-ink drop-shadow" aria-hidden />
          <div
            className="relative size-full rounded-full border-4 border-[#fbbf24]/70 shadow-[0_0_24px_rgba(251,191,36,0.25)]"
            style={{ background: WHEEL, transform: `rotate(${angle}deg)`, transition: spinning ? `transform ${duration}ms cubic-bezier(0.12, 0.7, 0.12, 1)` : undefined }}
            aria-hidden
          >
            {SLICES.map((p, i) =>
              ICON[p] ? (
                <span key={i} className="absolute left-1/2 top-1/2 text-sm" style={{ transform: `translate(-50%, -50%) rotate(${(i + 0.5) * SLICE}deg) translateY(-68px)` }}>
                  {ICON[p]}
                </span>
              ) : null,
            )}
            <div className="absolute inset-[38%] rounded-full border-2 border-[#fbbf24]/70 bg-[#1d1640]" />
          </div>
        </div>
        <div className="min-w-0 flex-1 basis-56 space-y-3">
          <p className="text-sm text-ink-soft">
            <Coins n={ROULETTE.cost} /> a spin. A 1 in {Math.round(1 / ROULETTE.jackpotChance)} chance of the 💎 jackpot, <Coins n={ROULETTE.jackpot} />
            {ROULETTE.small > 0 && ROULETTE.smallChance > 0 && (
              <>
                , and a 1 in {Math.round(1 / ROULETTE.smallChance)} chance of 🪙 <Coins n={ROULETTE.small} />
              </>
            )}
            . {ROULETTE.dailySpins} spins a day.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" onClick={go} disabled={!canSpin} className="btn-accent rounded-md px-5 py-2.5 font-display font-bold disabled:opacity-40">
              {spinning ? 'Spinning…' : <>Spin · <Coins n={ROULETTE.cost} /></>}
            </button>
            <span className="text-sm text-ink-soft">
              {left} spin{left === 1 ? '' : 's'} left today
            </span>
          </div>
          <p className="min-h-6 font-display font-bold" aria-live="polite">
            {result?.prize === 'jackpot' && (
              <span className="animate-pop text-[#fbbf24]">
                💎 JACKPOT! +<Coins n={result.coins} />
              </span>
            )}
            {result?.prize === 'small' && (
              <span className="animate-pop text-hit">
                🪙 +<Coins n={result.coins} />
              </span>
            )}
            {result?.prize === 'none' && <span className="text-ink-soft">Nothing this time.</span>}
            {!result && !spinning && left === 0 && <span className="text-ink-soft">No spins left: come back tomorrow.</span>}
            {!result && !spinning && left > 0 && coins < ROULETTE.cost && <span className="text-ink-soft">Not enough DleCoins.</span>}
          </p>
        </div>
      </div>
    </section>
  );
}
