import { useEffect, useMemo, useRef, useState } from 'react';
import { Coins } from '../components/DleCoin';
import { celebrate, celebrateBig } from '../lib/fx';
import { sfx } from '../lib/sfx';
import { econToday, useProgress } from '../store/progress';
import { ROULETTE, rouletteReturn, type RoulettePrize } from './economy';

/** The wheel's slices, clockwise from the pointer: one jackpot, two small prizes, two free spins, the rest empty. */
const SLICES: RoulettePrize[] = Array.from({ length: 20 }, (_, i) => (i === 0 ? 'jackpot' : i === 5 || i === 15 ? 'small' : i === 9 || i === 12 ? 'free' : 'none'));
const SLICE = 360 / SLICES.length;
const COLOR: Record<RoulettePrize, [string, string]> = {
  jackpot: ['#fbbf24', '#fbbf24'],
  small: ['#2dd4bf', '#2dd4bf'],
  free: ['#f472b6', '#f472b6'],
  none: ['#3b2d7a', '#241a52'],
};
const ICON: Record<RoulettePrize, string> = { jackpot: '💎', small: '🪙', free: '🔄', none: '' };
/** The pause on a free-spin slice before the wheel sets off again by itself (ms). */
const FREE_PAUSE = 900;
const WHEEL = `conic-gradient(${SLICES.map((p, i) => `${COLOR[p][i % 2]} ${i * SLICE}deg ${(i + 1) * SLICE}deg`).join(', ')})`;
const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/** How many wheels a spin turns at once: one, five or twenty-five, each its own spin. */
const MODES = [1, 5, 25] as const;
type Mode = (typeof MODES)[number];
/** Each mode's wheel size (px) and lights around the rim. */
const LOOK: Record<Mode, { size: number; bulbs: number }> = { 1: { size: 192, bulbs: 24 }, 5: { size: 104, bulbs: 14 }, 25: { size: 54, bulbs: 0 } };

/** The stamp after a spin, in the player's language. */
const STAMP = {
  en: { win: 'COOL!', miss: 'NOT COOL' },
  fr: { win: 'COOL !', miss: 'PAS COOL' },
};
const FREE_STAMP = { en: 'FREE SPIN!', fr: 'TOUR GRATUIT !' };

/** The wheel's turn now (0–360), read from the transform the transition is moving. */
function angleOf(el: HTMLElement): number {
  const m = new DOMMatrixReadOnly(getComputedStyle(el).transform);
  return ((Math.atan2(m.b, m.a) * 180) / Math.PI + 360) % 360;
}

/** One spin of one wheel: where it must land, for how long, and whether it ticks aloud. */
interface Turn {
  /** Where it lands, in order: each free spin sets it turning again, the last landing is the prize. */
  chain: RoulettePrize[];
  duration: number;
  /** Only one wheel ticks when many turn: twenty-five clicking at once is noise. */
  ticks: boolean;
  key: number;
}

/** A wheel: it turns when given a turn, and says when it has stopped. */
function Wheel({ size, bulbs, turn, onStop, lang }: { size: number; bulbs: number; turn: Turn | null; onStop: (prize: RoulettePrize, free: number) => void; lang: 'en' | 'fr' }) {
  const [angle, setAngle] = useState(0);
  // Which landing of the turn's chain it's heading for (free spins move it on by themselves).
  const [run, setRun] = useState<{ turn: Turn; step: number } | null>(null);
  useEffect(() => setRun(turn ? { turn, step: 0 } : null), [turn]);
  const [spinning, setSpinning] = useState(false);
  const [landed, setLanded] = useState<{ prize: RoulettePrize; key: number } | null>(null);
  const wheel = useRef<HTMLDivElement>(null);
  const pointer = useRef<HTMLDivElement>(null);
  const settle = useRef<HTMLDivElement>(null);
  const stop = useRef(onStop);
  stop.current = onStop;

  useEffect(() => {
    if (!run) return;
    const { turn, step } = run;
    const prize = turn.chain[step];
    const last = step === turn.chain.length - 1;
    // A free spin turns a little quicker than the paid one.
    const duration = step ? Math.round(turn.duration * 0.75) : turn.duration;
    // Land on a slice of the prize that came up, somewhere inside it (never near its edge, so the rock at the end stays inside).
    const matches = SLICES.flatMap((p, i) => (p === prize ? [i] : []));
    const i = matches[Math.floor(Math.random() * matches.length)];
    const target = 360 - (i * SLICE + (0.3 + Math.random() * 0.4) * SLICE);
    setAngle((a) => a - (a % 360) + 360 * 6 + target);
    setLanded(null);
    setSpinning(true);
    // While it turns: a tick and a flick of the pointer at every peg.
    let raf = 0;
    if (turn.ticks && !reducedMotion()) {
      const start = performance.now();
      let seen = -1;
      const frame = (now: number) => {
        const el = wheel.current;
        if (!el) return;
        const slice = Math.floor(((360 - angleOf(el)) % 360) / SLICE);
        if (seen !== -1 && slice !== seen) {
          sfx.wheelTick(1 + Math.min(1, (now - start) / duration) * 0.6);
          pointer.current?.animate([{ transform: 'translateX(-50%) rotate(-22deg)' }, { transform: 'translateX(-50%) rotate(0deg)' }], { duration: 140, easing: 'ease-out' });
        }
        seen = slice;
        if (now - start < duration) raf = requestAnimationFrame(frame);
      };
      raf = requestAnimationFrame(frame);
    }
    const timers: number[] = [];
    timers.push(
      window.setTimeout(() => {
        setSpinning(false);
        setLanded({ prize, key: turn.key + step });
        // The wheel rocks back a little as it stops.
        if (!reducedMotion()) settle.current?.animate([{ transform: 'rotate(0deg)' }, { transform: 'rotate(-3deg)' }, { transform: 'rotate(1.5deg)' }, { transform: 'rotate(0deg)' }], { duration: 520, easing: 'ease-out' });
        if (last) return stop.current(prize, turn.chain.length - 1);
        // A free spin: a chime, the slice lights up — and off it goes again, for nothing.
        if (turn.ticks) sfx.shimmer(6);
        timers.push(
          window.setTimeout(() => {
            if (turn.ticks) sfx.wheelSpin();
            setRun({ turn, step: step + 1 });
          }, reducedMotion() ? 150 : FREE_PAUSE),
        );
      }, duration),
    );
    return () => {
      timers.forEach((t) => window.clearTimeout(t));
      cancelAnimationFrame(raf);
    };
  }, [run]);

  const free = !!landed && landed.prize === 'free';
  const won = !!landed && landed.prize !== 'none' && !free;
  // Coins bursting out of the wheel on a win, each its own way.
  const burst = useMemo(
    () =>
      Array.from({ length: !landed ? 0 : landed.prize === 'jackpot' ? (size > 100 ? 22 : 12) : size > 100 ? 10 : 4 }, () => {
        const a = Math.random() * Math.PI * 2;
        const d = (0.35 + Math.random() * 0.35) * size;
        return { x: Math.cos(a) * d, y: Math.sin(a) * d - size * 0.15, delay: Math.random() * 0.15, spin: (Math.random() - 0.5) * 720 };
      }),
    [landed, size],
  );
  const small = size < 80;

  return (
    <div className={`relative shrink-0 ${won ? 'z-10' : ''}`} style={{ width: size, height: size }}>
      {bulbs > 0 && (
        // The lights around the rim: chasing while it spins, flashing on a win.
        <div className={`absolute -inset-2 rounded-full ${spinning ? 'roulette-chasing' : won ? 'roulette-flashing' : ''}`} aria-hidden>
          {Array.from({ length: bulbs }, (_, b) => (
            <span
              key={b}
              className={`roulette-bulb absolute left-1/2 top-1/2 rounded-full ${size > 120 ? 'size-2' : 'size-1.5'}`}
              style={{ transform: `translate(-50%, -50%) rotate(${(b * 360) / bulbs}deg) translateY(-${size / 2 + 8}px)`, animationDelay: `${(b % 3) * 0.12}s` }}
            />
          ))}
        </div>
      )}
      {/* The pointer, at the top. */}
      <div
        ref={pointer}
        className="absolute left-1/2 z-10 origin-top -translate-x-1/2 border-x-transparent border-t-[#fbbf24] drop-shadow-[0_2px_3px_rgba(0,0,0,0.6)]"
        style={{ top: small ? -5 : -10, borderLeftWidth: small ? 5 : 10, borderRightWidth: small ? 5 : 10, borderTopWidth: small ? 9 : 18 }}
        aria-hidden
      />
      <div ref={settle} className="size-full">
        <div
          ref={wheel}
          className={`relative size-full rounded-full border-[#fbbf24]/80 shadow-[0_0_28px_rgba(251,191,36,0.3),inset_0_0_18px_rgba(0,0,0,0.5)] ${small ? 'border-2' : 'border-4'} ${won ? (landed.prize === 'jackpot' ? 'roulette-win-jackpot' : 'roulette-win') : ''}`}
          style={{ background: WHEEL, transform: `rotate(${angle}deg)`, transition: spinning && run ? `transform ${run.step ? Math.round(run.turn.duration * 0.75) : run.turn.duration}ms cubic-bezier(0.1, 0.75, 0.1, 1)` : undefined }}
          aria-hidden
        >
          {!small && SLICES.map((_, i) => <span key={i} className="absolute left-1/2 top-1/2 h-[46%] w-px origin-top bg-[#fbbf24]/25" style={{ transform: `rotate(${i * SLICE + 180}deg)` }} />)}
          {SLICES.map((p, i) =>
            ICON[p] ? (
              <span key={`i${i}`} className={`absolute left-1/2 top-1/2 ${size > 120 ? 'text-base' : small ? 'text-[7px]' : 'text-[11px]'}`} style={{ transform: `translate(-50%, -50%) rotate(${(i + 0.5) * SLICE}deg) translateY(-${size * 0.375}px)` }}>
                {ICON[p]}
              </span>
            ) : null,
          )}
          <div className={`absolute inset-[36%] grid place-items-center rounded-full border-[#fbbf24]/80 bg-[radial-gradient(circle_at_35%_30%,#4c3a9a,#1d1640)] ${small ? 'border text-[8px]' : 'border-2 text-lg'}`}>✦</div>
        </div>
      </div>
      {/* A free spin: it says so before it sets off again. */}
      {free && (
        <div key={`f${landed.key}`} className="roulette-free pointer-events-none absolute inset-0 z-20 grid place-items-center" aria-hidden>
          <span className={`whitespace-nowrap rounded-md border-2 border-[#f472b6] bg-[#0d0a1f]/85 font-display font-black text-[#f9a8d4] shadow-lg ${small ? 'px-0.5 text-[7px]' : size > 120 ? 'px-2 py-0.5 text-base' : 'px-1 text-[10px]'}`}>
            🔄 {small ? 'FREE' : FREE_STAMP[lang]}
          </span>
        </div>
      )}
      {won && (
        <div className="pointer-events-none absolute inset-0" key={`b${landed.key}`} aria-hidden>
          {burst.map((c, k) => (
            <span key={k} className={`roulette-coin absolute left-1/2 top-1/2 ${small ? 'text-xs' : 'text-lg'}`} style={{ ['--x' as string]: `${c.x}px`, ['--y' as string]: `${c.y}px`, ['--r' as string]: `${c.spin}deg`, animationDelay: `${c.delay}s` }}>
              🪙
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/** The Card Shop's roulette: a few coins a spin, and a small chance of a jackpot — one wheel, or five or twenty-five at once. */
export function Roulette() {
  const coins = useProgress((s) => s.coins);
  const spins = econToday(useProgress((s) => s.econ)).spins ?? 0;
  const spin = useProgress((s) => s.spinRoulette);
  const lang = useProgress((s) => s.nameLang) === 'fr' ? 'fr' : 'en';
  const [mode, setMode] = useState<Mode>(1);
  const [turns, setTurns] = useState<(Turn | null)[]>([null]);
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState<{ prizes: RoulettePrize[]; coins: number; free: number; key: number } | null>(null);
  const stopped = useRef(0);
  const pending = useRef<{ prizes: RoulettePrize[]; coins: number; free: number } | null>(null);

  const left = Math.max(0, ROULETTE.dailySpins - spins);
  const can = (n: number) => !spinning && left >= n && coins >= ROULETTE.cost * n;
  const look = LOOK[mode];

  const pick = (m: Mode) => {
    if (spinning || m === mode) return;
    sfx.click();
    setMode(m);
    setTurns(Array.from({ length: m }, () => null));
    setResult(null);
  };

  const go = () => {
    if (!can(mode)) return;
    const r = spin(mode);
    if (!r) return;
    sfx.wheelSpin();
    const quick = reducedMotion();
    const now = Date.now();
    // One wheel takes its time; many stop one after another, so each result lands on its own.
    setTurns(
      r.map((x, i) => ({
        chain: x.chain,
        duration: quick ? 400 : mode === 1 ? 3600 : 2600 + Math.random() * 1800,
        ticks: i === 0,
        key: now + i * 100,
      })),
    );
    stopped.current = 0;
    pending.current = { prizes: r.map((x) => x.prize), coins: r.reduce((t, x) => t + x.coins, 0), free: r.reduce((t, x) => t + x.chain.length - 1, 0) };
    setResult(null);
    setSpinning(true);
  };

  // A wheel has stopped: its own little sound when many turn; the verdict when the last one stops.
  const onStop = (prize: RoulettePrize) => {
    stopped.current += 1;
    const all = pending.current;
    if (mode > 1 && prize !== 'none') (prize === 'jackpot' ? sfx.victory() : sfx.coins(2));
    if (!all || stopped.current < all.prizes.length) return;
    setSpinning(false);
    setResult({ ...all, key: Date.now() });
    const jackpots = all.prizes.filter((p) => p === 'jackpot').length;
    if (jackpots) (mode === 1 && sfx.victory(), sfx.coins(18), celebrateBig());
    else if (all.coins > 0) (mode === 1 && sfx.correct(), sfx.coins(7), celebrate());
    else sfx.wahWah();
  };

  const won = !!result && result.coins > 0;
  const count = (p: RoulettePrize) => result?.prizes.filter((x) => x === p).length ?? 0;
  const cost = ROULETTE.cost * mode;

  return (
    <section className="space-y-3">
      <h2 className="font-display text-lg font-bold">🎰 Roulette</h2>
      <div className={`page roulette-box flex flex-wrap items-center gap-6 rounded-md p-4 ${count('jackpot') ? 'roulette-jackpot' : ''}`}>
        <div className="relative mx-auto shrink-0 sm:mx-0">
          <div
            className={`grid place-items-center ${mode === 1 ? '' : mode === 5 ? 'grid-cols-3 gap-x-5 gap-y-6 p-2 sm:grid-cols-5' : 'grid-cols-5 gap-2.5 p-1'}`}
            style={mode === 1 ? { width: look.size, height: look.size } : undefined}
          >
            {turns.map((t, i) => (
              <Wheel key={`${mode}-${i}`} size={look.size} bulbs={look.bulbs} turn={t} onStop={onStop} lang={lang} />
            ))}
          </div>
          {result && (
            <div key={`s${result.key}`} className={`roulette-stamp pointer-events-none absolute inset-0 z-20 grid place-items-center font-display text-2xl font-black tracking-wider ${won ? 'text-[#fbbf24]' : 'text-coral'}`} aria-hidden>
              <span className="whitespace-nowrap rounded-md border-2 border-current bg-[#0d0a1f]/85 px-3 py-1 shadow-lg">
                {won ? STAMP[lang].win : STAMP[lang].miss}
                {mode > 1 && won && <span className="ml-2 text-xl">+{result.coins.toLocaleString()}</span>}
              </span>
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1 basis-56 space-y-3">
          <p className="text-sm text-ink-soft">
            <Coins n={ROULETTE.cost} /> a spin. A 1 in {Math.round(1 / ROULETTE.jackpotChance)} chance of the 💎 jackpot, <Coins n={ROULETTE.jackpot} />
            {ROULETTE.small > 0 && ROULETTE.smallChance > 0 && (
              <>
                , a 1 in {Math.round(1 / ROULETTE.smallChance)} chance of 🪙 <Coins n={ROULETTE.small} />
              </>
            )}
            {ROULETTE.freeChance > 0 && <>, and 1 in {Math.round(1 / ROULETTE.freeChance)} lands on 🔄: the wheel spins again for free</>}. {ROULETTE.dailySpins.toLocaleString()} paid spins a day.
            {rouletteReturn() > 1 && <span className="block text-xs text-ink-faint">On average it pays back about {Math.round(rouletteReturn() * 100)}% of what goes in, mostly through the jackpot: the more you play, the better your odds of it.</span>}
          </p>
          {/* One wheel, or five or twenty-five at once (each a spin of its own). */}
          <div className="flex gap-1" role="group" aria-label="Wheels at once">
            {MODES.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => pick(m)}
                disabled={spinning}
                aria-pressed={m === mode}
                className={`rounded-md border px-3 py-1 font-display text-sm font-bold disabled:opacity-50 ${m === mode ? 'border-[#fbbf24] bg-[#fbbf24]/15 text-[#fbbf24]' : 'border-rule text-ink-soft hover:border-ink-faint'}`}
              >
                ×{m}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" onClick={go} disabled={!can(mode)} className={`btn-accent rounded-md px-5 py-2.5 font-display font-bold disabled:opacity-40 ${can(mode) ? 'roulette-ready' : ''}`}>
              {spinning ? 'Spinning…' : <>{mode === 1 ? 'Spin' : `Spin ×${mode}`} · <Coins n={cost} /></>}
            </button>
            <span className="text-sm text-ink-soft">
              {left.toLocaleString()} spin{left === 1 ? '' : 's'} left today
            </span>
          </div>
          <p className="min-h-6 font-display font-bold" aria-live="polite">
            {result && count('jackpot') > 0 && (
              <span className="animate-pop text-[#fbbf24]">
                💎 JACKPOT{count('jackpot') > 1 ? ` ×${count('jackpot')}` : ''}!{mode > 1 && count('small') > 0 ? ` 🪙 ×${count('small')}` : ''} +<Coins n={result.coins} />
              </span>
            )}
            {result && !count('jackpot') && count('small') > 0 && (
              <span className="animate-pop text-hit">
                🪙{count('small') > 1 ? ` ×${count('small')}` : ''} +<Coins n={result.coins} />
                {mode > 1 && <span className="ml-1 text-sm font-normal text-ink-soft">for {cost} spent</span>}
              </span>
            )}
            {result && !won && <span className="text-ink-soft">{mode === 1 ? 'Nothing this time.' : `Nothing on all ${mode} wheels.`}</span>}
            {result && result.free > 0 && <span className="ml-2 text-sm font-normal text-[#f9a8d4]">🔄 {result.free} free spin{result.free === 1 ? '' : 's'}</span>}
            {!result && !spinning && left < mode && <span className="text-ink-soft">{left === 0 ? 'No spins left: come back tomorrow.' : `Only ${left} spin${left === 1 ? '' : 's'} left today.`}</span>}
            {!result && !spinning && left >= mode && coins < cost && <span className="text-ink-soft">Not enough DleCoins.</span>}
          </p>
        </div>
      </div>
    </section>
  );
}
