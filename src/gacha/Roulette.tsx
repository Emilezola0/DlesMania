import { useEffect, useMemo, useRef, useState } from 'react';
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
  none: ['#3b2d7a', '#241a52'],
};
const ICON: Record<RoulettePrize, string> = { jackpot: '💎', small: '🪙', none: '' };
const WHEEL = `conic-gradient(${SLICES.map((p, i) => `${COLOR[p][i % 2]} ${i * SLICE}deg ${(i + 1) * SLICE}deg`).join(', ')})`;
/** The light bulbs around the rim. */
const BULBS = 24;
const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/** The stamp after a spin, in the player's language. */
const STAMP = {
  en: { win: 'COOL!', miss: 'NOT COOL' },
  fr: { win: 'COOL !', miss: 'PAS COOL' },
};

/** The wheel's turn now (0–360), read from the transform the transition is moving. */
function angleOf(el: HTMLElement): number {
  const m = new DOMMatrixReadOnly(getComputedStyle(el).transform);
  return ((Math.atan2(m.b, m.a) * 180) / Math.PI + 360) % 360;
}

/** The Card Shop's roulette: a few coins a spin, and a small chance of a jackpot. */
export function Roulette() {
  const coins = useProgress((s) => s.coins);
  const spins = econToday(useProgress((s) => s.econ)).spins ?? 0;
  const spin = useProgress((s) => s.spinRoulette);
  const lang = useProgress((s) => s.nameLang) === 'fr' ? 'fr' : 'en';
  const [angle, setAngle] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState<{ prize: RoulettePrize; coins: number; key: number } | null>(null);
  const wheel = useRef<HTMLDivElement>(null);
  const pointer = useRef<HTMLDivElement>(null);
  const settle = useRef<HTMLDivElement>(null);
  const timer = useRef<number>();
  const raf = useRef<number>();
  useEffect(
    () => () => {
      window.clearTimeout(timer.current);
      if (raf.current) cancelAnimationFrame(raf.current);
    },
    [],
  );

  const left = Math.max(0, ROULETTE.dailySpins - spins);
  const canSpin = !spinning && left > 0 && coins >= ROULETTE.cost;
  const duration = reducedMotion() ? 400 : 3600;

  /** While the wheel turns: a tick and a flick of the pointer at every peg. */
  const listen = (start: number) => {
    let last = -1;
    const frame = (now: number) => {
      const el = wheel.current;
      if (!el) return;
      // The slice under the pointer (the pointer stays at the top while the wheel turns).
      const slice = Math.floor(((360 - angleOf(el)) % 360) / SLICE);
      if (last !== -1 && slice !== last) {
        sfx.wheelTick(1 + Math.min(1, (now - start) / duration) * 0.6);
        pointer.current?.animate([{ transform: 'translateX(-50%) rotate(-22deg)' }, { transform: 'translateX(-50%) rotate(0deg)' }], { duration: 140, easing: 'ease-out' });
      }
      last = slice;
      if (now - start < duration) raf.current = requestAnimationFrame(frame);
    };
    raf.current = requestAnimationFrame(frame);
  };

  const go = () => {
    if (!canSpin) return;
    const r = spin();
    if (!r) return;
    sfx.wheelSpin();
    // Land on a slice of the prize that came up, somewhere inside it (never near its edge, so the rock at the end stays inside).
    const matches = SLICES.flatMap((p, i) => (p === r.prize ? [i] : []));
    const i = matches[Math.floor(Math.random() * matches.length)];
    const inside = (0.3 + Math.random() * 0.4) * SLICE;
    const target = 360 - (i * SLICE + inside);
    setAngle((a) => a - (a % 360) + 360 * 6 + target);
    setResult(null);
    setSpinning(true);
    if (!reducedMotion()) listen(performance.now());
    timer.current = window.setTimeout(() => {
      setSpinning(false);
      setResult({ ...r, key: Date.now() });
      // The wheel rocks back a little as it stops.
      if (!reducedMotion()) settle.current?.animate([{ transform: 'rotate(0deg)' }, { transform: 'rotate(-3deg)' }, { transform: 'rotate(1.5deg)' }, { transform: 'rotate(0deg)' }], { duration: 520, easing: 'ease-out' });
      if (r.prize === 'jackpot') (sfx.victory(), sfx.coins(18), celebrateBig());
      else if (r.prize === 'small') (sfx.correct(), sfx.coins(7), celebrate());
      else sfx.wahWah();
    }, duration);
  };

  const won = result && result.prize !== 'none';
  // Coins bursting out of the wheel on a win, each its own way.
  const burst = useMemo(
    () =>
      Array.from({ length: result?.prize === 'jackpot' ? 22 : 10 }, () => {
        const a = Math.random() * Math.PI * 2;
        const d = 70 + Math.random() * 70;
        return { x: Math.cos(a) * d, y: Math.sin(a) * d - 30, delay: Math.random() * 0.15, spin: (Math.random() - 0.5) * 720 };
      }),
    [result],
  );

  return (
    <section className="space-y-3">
      <h2 className="font-display text-lg font-bold">🎰 Roulette</h2>
      <div className={`page roulette-box flex flex-wrap items-center gap-6 rounded-md p-4 ${result?.prize === 'jackpot' ? 'roulette-jackpot' : ''}`}>
        <div className="relative mx-auto size-48 shrink-0 sm:mx-0">
          {/* The lights around the rim: chasing while it spins, flashing on a win. */}
          <div className={`absolute -inset-2 rounded-full ${spinning ? 'roulette-chasing' : won ? 'roulette-flashing' : ''}`} aria-hidden>
            {Array.from({ length: BULBS }, (_, b) => (
              <span
                key={b}
                className="roulette-bulb absolute left-1/2 top-1/2 size-2 rounded-full"
                style={{ transform: `translate(-50%, -50%) rotate(${(b * 360) / BULBS}deg) translateY(-104px)`, animationDelay: `${(b % 3) * 0.12}s` }}
              />
            ))}
          </div>
          {/* The pointer, at the top. */}
          <div ref={pointer} className="absolute left-1/2 top-[-10px] z-10 origin-top -translate-x-1/2 border-x-[10px] border-t-[18px] border-x-transparent border-t-[#fbbf24] drop-shadow-[0_2px_3px_rgba(0,0,0,0.6)]" aria-hidden />
          <div ref={settle} className="size-full">
            <div
              ref={wheel}
              className="relative size-full rounded-full border-4 border-[#fbbf24]/80 shadow-[0_0_28px_rgba(251,191,36,0.3),inset_0_0_18px_rgba(0,0,0,0.5)]"
              style={{ background: WHEEL, transform: `rotate(${angle}deg)`, transition: spinning ? `transform ${duration}ms cubic-bezier(0.1, 0.75, 0.1, 1)` : undefined }}
              aria-hidden
            >
              {SLICES.map((_, i) => (
                <span key={i} className="absolute left-1/2 top-1/2 h-[46%] w-px origin-top bg-[#fbbf24]/25" style={{ transform: `rotate(${i * SLICE + 180}deg)` }} />
              ))}
              {SLICES.map((p, i) =>
                ICON[p] ? (
                  <span key={`i${i}`} className="absolute left-1/2 top-1/2 text-base" style={{ transform: `translate(-50%, -50%) rotate(${(i + 0.5) * SLICE}deg) translateY(-72px)` }}>
                    {ICON[p]}
                  </span>
                ) : null,
              )}
              <div className="absolute inset-[36%] grid place-items-center rounded-full border-2 border-[#fbbf24]/80 bg-[radial-gradient(circle_at_35%_30%,#4c3a9a,#1d1640)] text-lg">✦</div>
            </div>
          </div>
          {won && (
            <div className="pointer-events-none absolute inset-0" key={`b${result.key}`} aria-hidden>
              {burst.map((c, k) => (
                <span key={k} className="roulette-coin absolute left-1/2 top-1/2 text-lg" style={{ ['--x' as string]: `${c.x}px`, ['--y' as string]: `${c.y}px`, ['--r' as string]: `${c.spin}deg`, animationDelay: `${c.delay}s` }}>
                  🪙
                </span>
              ))}
            </div>
          )}
          {result && (
            <div key={`s${result.key}`} className={`roulette-stamp pointer-events-none absolute inset-0 z-20 grid place-items-center font-display text-2xl font-black tracking-wider ${won ? 'text-[#fbbf24]' : 'text-coral'}`} aria-hidden>
              <span className="whitespace-nowrap rounded-md border-2 border-current bg-[#0d0a1f]/85 px-3 py-1 shadow-lg">{won ? STAMP[lang].win : STAMP[lang].miss}</span>
            </div>
          )}
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
            <button type="button" onClick={go} disabled={!canSpin} className={`btn-accent rounded-md px-5 py-2.5 font-display font-bold disabled:opacity-40 ${canSpin ? 'roulette-ready' : ''}`}>
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
