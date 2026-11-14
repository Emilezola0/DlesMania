import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Coins, DleCoin } from '../components/DleCoin';
import { CARD_BY_ID } from '../gacha/cards';
import { CardAvatar } from '../gacha/Perks';
import { celebrate, celebrateBig, shake } from '../lib/fx';
import { sfx } from '../lib/sfx';
import { useProgress } from '../store/progress';
import { CAPSULES } from './casino';
import { FrameRing } from './Frame';
import { ASCEND_MAX, EARNED_FRAMES, FRAMES, FRAME_RARITIES, FRAME_RARITY_COLOR, FRAME_RARITY_NAME, ROMAN, albumFrame, ascendLevel, ascendToNext, inSeason, nextSeason, type Frame } from './frames';
import { earnedFrames, useFeats } from './unlocks';
import { SETS } from '../gacha/cards';
import { dateLocale, fromKey, todayKey } from '../lib/date';

const SHELLS = ['#f87171', '#60a5fa', '#34d399', '#fbbf24', '#c084fc', '#f472b6', '#22d3ee'];
const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
const buzz = (p: number | number[]) => {
  try {
    if (!reducedMotion()) navigator.vibrate?.(p);
  } catch {
    // No vibration here.
  }
};

/** The player's icon (their avatar card), or a plain disc: what a frame is shown around. */
export function YourIcon({ className = 'size-16' }: { className?: string }) {
  const card = useProgress((s) => (s.avatar && s.cards[s.avatar] ? CARD_BY_ID.get(s.avatar) : undefined));
  return card ? <CardAvatar card={card} className={className} /> : <span className={`block rounded-full bg-gradient-to-br from-[#3b2d7a] to-[#1b1530] ${className}`} />;
}

/** A capsule: two halves of a shell, the top coloured, the bottom clear-white. */
function Capsule({ color, size, className = '', style, children }: { color: string; size: number; className?: string; style?: React.CSSProperties; children?: React.ReactNode }) {
  return (
    <span className={`capsule block rounded-full ${className.includes('absolute') ? '' : 'relative'} ${className}`} style={{ width: size, height: size, ['--shell' as string]: color, ...style }}>
      <span className="capsule-top" />
      <span className="capsule-bottom" />
      {children}
    </span>
  );
}

type Got = { frame: Frame; duplicate: boolean; coins: number; free: boolean; level?: number; up?: boolean };

/** What a frame won again did for its Ascendant evolution. */
function ascendNote(g: Got, copies: number | undefined): string {
  const lv = g.level ?? 0;
  if (g.up) return lv >= ASCEND_MAX ? `Ascendant ${ROMAN[lv]}: fully evolved!` : `Ascendant ${ROMAN[lv]}!`;
  const n = ascendToNext(g.frame, copies);
  return n ? `${n} more cop${n === 1 ? 'y' : 'ies'} to Ascendant ${ROMAN[lv + 1]}` : `Ascendant ${ROMAN[lv]}, fully evolved`;
}
type Stage = 'idle' | 'turning' | 'dropped' | 'zoom' | 'open';

export function Capsules() {
  const coins = useProgress((s) => s.coins);
  const tokens = useProgress((s) => s.capsuleTokens ?? 0);
  const openMany = useProgress((s) => s.openCapsules);
  const [stage, setStage] = useState<Stage>('idle');
  const [turn, setTurn] = useState(0);
  const [got, setGot] = useState<Got[]>([]);
  const [shells, setShells] = useState<string[]>([SHELLS[0]]);
  // How many at once (1 to 10): free capsules first, then DleCoins.
  const [count, setCount] = useState(1);
  const busy = stage === 'turning' || stage === 'dropped' || stage === 'zoom';
  const most = Math.min(10, tokens + Math.floor(coins / CAPSULES.cost));
  const n = Math.max(1, Math.min(count, most));
  const freeHere = Math.min(tokens, n);
  const price = (n - freeHere) * CAPSULES.cost;
  const can = !busy && most > 0;
  // The capsules in the dome, where they lie.
  const pile = useMemo(() => Array.from({ length: 14 }, (_, i) => ({ x: 12 + ((i * 37) % 70), y: 38 + ((i * 53) % 44), color: SHELLS[i % SHELLS.length], rot: (i * 47) % 360 })), []);
  const timers = useRef<number[]>([]);
  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), []);
  const later = (fn: () => void, ms: number) => timers.current.push(window.setTimeout(fn, reducedMotion() ? 0 : ms));

  /** Turns the knob (`again`: from the haul just opened, which is closing). */
  const go = (again = false) => {
    if (again ? most <= 0 : !can) return;
    const r = openMany(n);
    if (!r.length) return;
    // What's inside stays inside until it's opened: the last one's result goes, nothing new shows.
    setGot(r);
    setShells(r.map(() => SHELLS[Math.floor(Math.random() * SHELLS.length)]));
    setStage('turning');
    setTurn((t) => t + 1);
    const more = Math.min(4, r.length - 1);
    for (let k = 0; k < 6 + more; k++) later(() => sfx.wheelTick(0.7 + k * 0.05), k * 120);
    later(() => (sfx.pop(), setStage('dropped')), 900 + more * 120);
  };
  const one = got.length === 1;

  return (
    <div className="mx-auto w-full max-w-sm">
      <div className="capsule-cabinet relative rounded-2xl p-3 text-white">
        {/* The dome, full of capsules (they jostle when the knob turns). */}
        <div className="capsule-dome relative mx-auto aspect-square w-[78%] overflow-hidden rounded-full">
          {pile.map((p, i) => (
            <Capsule key={`${i}:${turn}`} color={p.color} size={38} className={`absolute ${stage === 'turning' ? 'capsule-jostle' : ''}`} style={{ left: `${p.x}%`, top: `${p.y}%`, rotate: `${p.rot}deg`, animationDelay: `${(i % 5) * 40}ms` }} />
          ))}
          <span className="capsule-glass pointer-events-none absolute inset-0 rounded-full" aria-hidden />
        </div>
        {/* The body: the price, the knob, the chute. */}
        <div className="relative -mt-3 rounded-xl border-4 border-[#7f1d1d] bg-gradient-to-b from-[#dc2626] to-[#991b1b] p-3">
          <div className="flex items-center justify-between gap-3">
            <div className="rounded-md bg-[#1b1033] px-2 py-1 text-center">
              <div className="text-[9px] font-bold uppercase tracking-widest text-[#fbbf24]/80">{n > 1 ? `${n} capsules` : 'A capsule'}</div>
              <div className="flex items-center justify-center gap-1 font-display text-sm font-bold">
                {freeHere > 0 && <span className="text-[#a7f3d0]">FREE{freeHere > 1 && ` ×${freeHere}`}</span>}
                {freeHere > 0 && price > 0 && <span className="text-white/60">+</span>}
                {(price > 0 || freeHere === 0) && (
                  <>
                    <DleCoin className="size-3.5" /> {(price || CAPSULES.cost).toLocaleString()}
                  </>
                )}
              </div>
            </div>
            <button type="button" onClick={() => go()} disabled={!can} aria-label="Turn the knob" title="Turn the knob" className="capsule-knob relative grid size-16 place-items-center rounded-full disabled:opacity-60">
              <span className="capsule-knob-bar block h-3 w-12 rounded-full" style={{ rotate: `${turn * 360}deg` }} />
            </button>
            <div className="capsule-chute relative grid size-14 place-items-center rounded-md">
              {stage === 'dropped' && (
                <button type="button" onClick={() => (sfx.whoosh(), setStage('zoom'))} aria-label={one ? 'Pick up the capsule' : `Pick up the ${got.length} capsules`} className="capsule-drop relative">
                  {!one && <Capsule color={shells[1]} size={30} className="absolute -left-2 -top-1" />}
                  <Capsule color={shells[0]} size={40} />
                  {!one && <span className="absolute -bottom-1 -right-2 rounded-full bg-[#fbbf24] px-1.5 font-display text-[11px] font-black text-[#1b1033]">×{got.length}</span>}
                </button>
              )}
            </div>
          </div>
          <p className="mt-2 h-4 text-center text-xs font-bold tracking-widest text-white/85">
            {stage === 'turning' ? '…' : stage === 'dropped' ? (one ? 'TAKE THE CAPSULE' : 'TAKE THE CAPSULES') : stage === 'zoom' ? (one ? 'OPEN IT!' : 'OPEN THEM!') : can ? 'TURN THE KNOB' : 'NOT ENOUGH COINS'}
          </p>
          {/* How many at once. */}
          <div className="mt-2 flex items-center justify-center gap-1.5" role="group" aria-label="How many capsules at once">
            <button type="button" disabled={busy || n <= 1} onClick={() => (sfx.select(), setCount(n - 1))} aria-label="One fewer" className="grid size-7 place-items-center rounded-full bg-[#1b1033] font-display font-bold disabled:opacity-40">
              −
            </button>
            {[1, 5, 10].map((k) => (
              <button
                key={k}
                type="button"
                disabled={busy || k > Math.max(1, most)}
                onClick={() => (sfx.select(), setCount(k))}
                className={`rounded-full px-2.5 py-0.5 font-display text-xs font-bold disabled:opacity-40 ${n === k ? 'bg-[#fbbf24] text-[#1b1033]' : 'bg-[#1b1033] text-white/85'}`}
              >
                ×{k}
              </button>
            ))}
            <span className="w-8 text-center font-display text-sm font-black" aria-live="polite">
              ×{n}
            </span>
            <button type="button" disabled={busy || n >= most} onClick={() => (sfx.select(), setCount(n + 1))} aria-label="One more" className="grid size-7 place-items-center rounded-full bg-[#1b1033] font-display font-bold disabled:opacity-40">
              +
            </button>
          </div>
        </div>
      </div>

      {stage === 'zoom' && one && <Opening got={got[0]} shell={shells[0]} onOpen={() => setStage('open')} />}
      {stage === 'open' && one && <Revealed got={got[0]} again={can ? () => go() : undefined} />}
      {stage === 'zoom' && !one && got.length > 0 && <ManyOpening got={got} shells={shells} again={most > 0 ? () => go(true) : undefined} onClose={() => setStage('idle')} />}

      {/* Until they're open, the new frames aren't in the collection either. */}
      <FrameCollection hide={busy ? got.filter((g) => !g.duplicate).map((g) => g.frame.id) : []} />
    </div>
  );
}

/** How many taps a capsule takes to crack open: the rarer, the more it fights back. */
const TAPS: Record<Frame['rarity'], number> = { common: 3, rare: 3, epic: 3, legendary: 4, mythic: 5, celestial: 6, transcendent: 7 };

/**
 * The capsule, up close: tap and it shakes, cracks, and lets out more and more light in its frame's colour
 * (white until the last taps, so a rare one only shows itself late), then bursts open.
 */
function Opening({ got, shell, onOpen }: { got: Got; shell: string; onOpen: () => void }) {
  const rarity = got.frame.rarity;
  const rank = FRAME_RARITIES.indexOf(rarity);
  const need = TAPS[rarity];
  const color = FRAME_RARITY_COLOR[rarity];
  const [taps, setTaps] = useState(0);
  const [burst, setBurst] = useState(false);
  const shell$ = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  // The light through the cracks: white at first, its true colour from the second-to-last tap.
  const leak = taps >= need - 1 ? color : '#ffffff';
  const sparks = useMemo(
    () =>
      Array.from({ length: 18 + rank * 10 }, (_, i) => {
        const a = (i / (18 + rank * 10)) * Math.PI * 2 + Math.random() * 0.3;
        const d = 120 + Math.random() * 160;
        return { dx: Math.cos(a) * d, dy: Math.sin(a) * d, size: 4 + Math.random() * 7, delay: Math.random() * 120, color: rarity === 'legendary' || rarity === 'transcendent' ? SHELLS[i % SHELLS.length] : i % 3 ? color : '#fff' };
      }),
    [rank, rarity, color],
  );
  // Escape (or a tap on the dark) doesn't skip it: it's opened by hand.
  const tap = () => {
    if (burst) return;
    const n = taps + 1;
    setTaps(n);
    if (n < need) {
      // A crack: it jolts, a creak higher each time, a buzz.
      sfx.hit();
      sfx.wheelTick(0.8 + n * 0.25);
      buzz(12 + n * 8);
      shake(shell$.current, 6 + n * 3, 260);
      return;
    }
    // It bursts.
    setBurst(true);
    sfx.tear();
    sfx.shimmer(2 + rank);
    if (rank >= 5) sfx.supernova();
    buzz([30, 40, 80]);
    shake(stage.current, 6 + rank * 4, 380);
    if (rank >= 3) celebrateBig();
    else if (rank >= 2) celebrate();
    if (got.duplicate) window.setTimeout(() => sfx.coins(4), 500);
    window.setTimeout(onOpen, reducedMotion() ? 0 : 1100);
  };
  // A legendary hums while it's being opened.
  useEffect(() => {
    if (rank >= 3 && taps === need - 1) sfx.suspense(1.2);
  }, [taps, need, rank]);

  return createPortal(
    <div ref={stage} className="capsule-stage fixed inset-0 z-50 grid place-items-center overflow-hidden bg-[#07060c]/90 backdrop-blur-sm" style={{ ['--glow' as string]: leak }}>
      {/* Light behind it, growing with every crack. */}
      <div className="capsule-stage-rays pointer-events-none absolute left-1/2 top-1/2 aspect-square w-[160vmax]" style={{ opacity: 0.15 + (taps / need) * 0.6 }} aria-hidden />
      <div className="pointer-events-none absolute left-1/2 top-1/2 size-[60vmin] -translate-x-1/2 -translate-y-1/2 rounded-full" style={{ background: `radial-gradient(circle, ${leak}${taps ? '55' : '22'}, transparent 65%)`, transition: 'background 0.4s' }} aria-hidden />
      <div className="relative flex flex-col items-center gap-6">
        <button type="button" onClick={tap} aria-label={`Tap to crack the capsule open (${need - taps} left)`} className={`capsule-zoom relative ${burst ? 'pointer-events-none' : 'cursor-pointer'}`}>
          <div ref={shell$} className={burst ? '' : taps ? 'capsule-strain' : 'capsule-idle'} style={{ ['--strain' as string]: `${taps * 1.5}deg` }}>
            <Capsule color={shell} size={190} className={burst ? 'capsule-burst' : ''} style={{ filter: taps ? `drop-shadow(0 0 ${8 + taps * 10}px ${leak})` : undefined }}>
              {/* The cracks, more with each tap, glowing from inside. */}
              <svg viewBox="0 0 100 100" className="pointer-events-none absolute inset-0 size-full" aria-hidden style={{ filter: `drop-shadow(0 0 3px ${leak})` }}>
                {CRACKS.slice(0, Math.min(CRACKS.length, Math.round((taps / need) * CRACKS.length))).map((d, i) => (
                  <path key={i} d={d} className="capsule-crack-line" fill="none" stroke="#fff" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
                ))}
              </svg>
            </Capsule>
          </div>
          {burst && (
            <>
              <div className="pack-flash pointer-events-none fixed inset-0" style={{ background: `radial-gradient(circle, #fff, ${color} 40%, transparent 75%)` }} aria-hidden />
              <div className="pointer-events-none absolute left-1/2 top-1/2" aria-hidden>
                {sparks.map((p, i) => (
                  <span key={i} className="pack-spark absolute rounded-full" style={{ width: p.size, height: p.size, background: p.color, boxShadow: `0 0 12px ${p.color}`, ['--dx' as string]: `${p.dx}px`, ['--dy' as string]: `${p.dy}px`, animationDelay: `${p.delay}ms` }} />
                ))}
              </div>
            </>
          )}
        </button>
        <p className="h-6 font-display text-sm font-bold tracking-[0.3em] text-white/90">
          {burst ? '' : taps === 0 ? 'TAP TO CRACK IT OPEN' : taps === need - 1 ? 'ONE MORE!' : 'KEEP GOING…'}
        </p>
        {/* How many taps it still takes. */}
        <div className="flex gap-2" aria-hidden>
          {Array.from({ length: need }, (_, i) => (
            <span key={i} className="size-2.5 rounded-full transition" style={{ background: i < taps ? leak : 'rgba(255,255,255,0.25)', boxShadow: i < taps ? `0 0 8px ${leak}` : undefined }} />
          ))}
        </div>
      </div>
    </div>,
    document.body,
  );
}

/** The cracks across a capsule (in its 100×100 box), drawn one after another as it's tapped. */
const CRACKS = [
  'M50 50 L44 38 L48 30 L42 18',
  'M50 50 L60 56 L66 52 L78 60',
  'M50 50 L46 62 L52 70 L47 84',
  'M44 38 L32 36 L26 42',
  'M60 56 L62 44 L72 38 L80 30',
  'M46 62 L34 66 L24 62',
  'M48 30 L58 24 L64 14',
  'M52 70 L64 76 L70 86',
];

/** What came out: the frame spinning in around the player's icon, its name, and what to do next. */
function Revealed({ got, again }: { got: Got; again?: () => void }) {
  const worn = useProgress((s) => s.frame);
  const setFrame = useProgress((s) => s.setFrame);
  const [close, setClose] = useState(false);
  const copies = useProgress((s) => s.frameCopies?.[got.frame.id]);
  const color = FRAME_RARITY_COLOR[got.frame.rarity];
  // An evolution reached: the fanfare.
  useEffect(() => {
    if (!got.up) return;
    const t = window.setTimeout(() => (sfx.shimmer(3 + Math.min(4, got.level ?? 0)), celebrateBig()), 500);
    return () => window.clearTimeout(t);
  }, [got]);
  if (close) return null;
  return createPortal(
    <div className="fixed inset-0 z-50 grid place-items-center overflow-hidden bg-[#07060c]/90 p-4 backdrop-blur-sm" style={{ ['--glow' as string]: color }}>
      <div className="capsule-stage-rays pointer-events-none absolute left-1/2 top-1/2 aspect-square w-[160vmax]" style={{ opacity: 0.7 }} aria-hidden />
      <div className="relative flex flex-col items-center text-center text-white">
        <div className="capsule-frame-in relative grid size-44 place-items-center">
          <FrameRing frame={got.frame} level={got.level}>
            <YourIcon className="size-36" />
          </FrameRing>
          {!got.duplicate && <span className="pack-stamp absolute -right-6 -top-2 rounded-md border-2 border-coral bg-[#1b1530] px-2 py-0.5 font-display text-lg font-black text-coral">NEW!</span>}
          {got.up && <span className="pack-stamp absolute -right-8 -top-2 rounded-md border-2 border-amber-300 bg-[#1b1530] px-2 py-0.5 font-display text-lg font-black text-amber-300">▲ {ROMAN[got.level ?? 0]}</span>}
        </div>
        <p className="mt-6 text-xs font-bold uppercase tracking-[0.35em]" style={{ color }}>
          {FRAME_RARITY_NAME[got.frame.rarity]} frame{got.free && ' · free capsule'}
        </p>
        <p className="capsule-name font-display text-3xl font-black">{got.frame.name}</p>
        {got.duplicate && (
          <>
            <p className="mt-1 text-sm text-white/75">
              Already yours — <Coins n={got.coins} /> back.
            </p>
            <p className={`mt-1 font-display font-bold ${got.up ? 'text-lg text-amber-300' : 'text-xs text-white/60'}`}>{ascendNote(got, copies)}</p>
          </>
        )}
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          {worn !== got.frame.id && (
            <button type="button" onClick={() => (sfx.select(), setFrame(got.frame.id), setClose(true))} className="rounded-md bg-white px-5 py-2 font-display font-bold text-[#1b1530]">
              Wear it
            </button>
          )}
          {again && (
            <button type="button" onClick={() => (setClose(true), again())} className="rounded-md border-2 border-white/60 px-5 py-2 font-display font-bold">
              Another
            </button>
          )}
          <button type="button" onClick={() => setClose(true)} className="rounded-md px-4 py-2 font-display font-bold text-white/70 hover:text-white">
            Close
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/**
 * Several capsules at once: they lie in a tray, each opened with a tap (or all of them, one after another, with a
 * pause and a shake before a rare one). Each frame comes out where its capsule was, then the haul is added up.
 */
function ManyOpening({ got, shells, again, onClose }: { got: Got[]; shells: string[]; again?: () => void; onClose: () => void }) {
  const worn = useProgress((s) => s.frame);
  const setFrame = useProgress((s) => s.setFrame);
  const [opened, setOpened] = useState<boolean[]>(() => got.map(() => false));
  const [auto, setAuto] = useState(false);
  const [charging, setCharging] = useState(-1);
  const stage = useRef<HTMLDivElement>(null);
  const done = opened.every(Boolean);
  const rankOf = (i: number) => FRAME_RARITIES.indexOf(got[i].frame.rarity);
  const best = got.reduce((b, g) => Math.max(b, FRAME_RARITIES.indexOf(g.frame.rarity)), 0);

  const crack = (i: number) => {
    if (opened[i]) return;
    const rank = rankOf(i);
    setOpened((o) => o.map((v, k) => v || k === i));
    setCharging(-1);
    sfx.pop();
    if (rank >= 2) sfx.shimmer(1 + rank);
    if (rank >= 5) sfx.supernova();
    buzz(rank >= 3 ? [30, 40, 80] : 15);
    if (rank >= 3) {
      shake(stage.current, 4 + rank * 2, 320);
      celebrateBig();
    } else if (rank >= 2) celebrate();
    if (got[i].duplicate) window.setTimeout(() => sfx.coins(2), 300);
  };
  // Open all: one after another; before a rare one, it strains and hums a moment.
  useEffect(() => {
    if (!auto) return;
    const i = opened.indexOf(false);
    if (i < 0) {
      setAuto(false);
      return;
    }
    const rare = rankOf(i) >= 3;
    if (rare) {
      setCharging(i);
      sfx.suspense(0.8);
    }
    const t = window.setTimeout(() => crack(i), reducedMotion() ? 0 : rare ? 900 : 260);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auto, opened]);

  const fresh = got.filter((g) => !g.duplicate).length;
  const ups = got.filter((g) => g.up).length;
  const back = got.reduce((t, g) => t + g.coins, 0);
  return createPortal(
    <div ref={stage} className="fixed inset-0 z-50 grid place-items-center overflow-y-auto overflow-x-hidden bg-[#07060c]/90 p-4 backdrop-blur-sm" style={{ ['--glow' as string]: done ? FRAME_RARITY_COLOR[FRAME_RARITIES[best]] : '#ffffff' }}>
      {done && <div className="capsule-stage-rays pointer-events-none fixed left-1/2 top-1/2 aspect-square w-[160vmax]" style={{ opacity: 0.45 }} aria-hidden />}
      <div className="relative flex w-full max-w-md flex-col items-center text-center text-white">
        <p className="font-display text-sm font-bold tracking-[0.3em] text-white/90">{done ? 'YOUR HAUL' : `${opened.filter(Boolean).length} / ${got.length} OPEN`}</p>
        <div className="mt-6 grid w-full grid-cols-5 gap-x-2 gap-y-7">
          {got.map((g, i) => {
            const color = FRAME_RARITY_COLOR[g.frame.rarity];
            return opened[i] ? (
              <button
                key={i}
                type="button"
                onClick={() => {
                  if (g.duplicate || worn === g.frame.id) return;
                  sfx.select();
                  setFrame(g.frame.id);
                }}
                title={g.duplicate ? `${g.frame.name}: already yours` : worn === g.frame.id ? `${g.frame.name}: worn` : `Wear ${g.frame.name}`}
                className="relative flex min-w-0 flex-col items-center gap-1"
                style={{ ['--glow' as string]: color }}
              >
                <span className="capsule-frame-in grid size-14 place-items-center">
                  <FrameRing frame={g.frame} level={g.level} badge>
                    <YourIcon className="size-11" />
                  </FrameRing>
                </span>
                <span className="max-w-full truncate text-[10px] font-bold" style={{ color }}>
                  {g.frame.name}
                </span>
                <span className={`text-[9px] ${g.up ? 'font-bold text-amber-300' : 'text-white/60'}`}>{g.up ? `▲ Ascendant ${ROMAN[g.level ?? 0]}` : g.duplicate ? `+${g.coins}` : worn === g.frame.id ? 'worn' : FRAME_RARITY_NAME[g.frame.rarity]}</span>
                {!g.duplicate && <span className="pack-stamp absolute -right-1 -top-3 rounded border border-coral bg-[#1b1530] px-1 font-display text-[9px] font-black text-coral">NEW</span>}
              </button>
            ) : (
              <button key={i} type="button" onClick={() => crack(i)} disabled={auto} aria-label={`Open capsule ${i + 1}`} className="grid h-[84px] place-items-center">
                <span className={charging === i ? 'capsule-strain' : 'capsule-idle'} style={{ ['--strain' as string]: '6deg', animationDelay: `${i * 90}ms` }}>
                  <Capsule color={shells[i]} size={52} style={charging === i ? { filter: 'drop-shadow(0 0 14px #fff)' } : undefined} />
                </span>
              </button>
            );
          })}
        </div>
        {done ? (
          <>
            <p className="mt-6 text-sm text-white/80">
              {fresh ? `${fresh} new frame${fresh > 1 ? 's' : ''}` : ups ? '' : 'Nothing new this time'}
              {ups > 0 && <span className="font-bold text-amber-300">{fresh ? ' · ' : ''}▲ {ups} evolution{ups > 1 ? 's' : ''}</span>}
              {back > 0 && (
                <>
                  {' · '}
                  <Coins n={back} /> back
                </>
              )}
            </p>
            <p className="mt-1 text-xs text-white/50">Tap a new frame to wear it.</p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              {again && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    again();
                  }}
                  className="rounded-md bg-white px-5 py-2 font-display font-bold text-[#1b1530]"
                >
                  Again
                </button>
              )}
              <button type="button" onClick={onClose} className="rounded-md border-2 border-white/60 px-5 py-2 font-display font-bold">
                Close
              </button>
            </div>
          </>
        ) : (
          <div className="mt-6 flex flex-col items-center gap-2">
            <button type="button" disabled={auto} onClick={() => setAuto(true)} className="rounded-md bg-white px-5 py-2 font-display font-bold text-[#1b1530] disabled:opacity-60">
              Open all
            </button>
            <p className="text-xs text-white/60">or tap them one by one</p>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}

/** One frame of the collection: worn on a tap when it's yours; otherwise a mystery, or how to get it. */
function FrameTile({ f, mine, worn, onWear, label, hint, level = 0 }: { f: Frame; mine: boolean; worn: boolean; onWear: () => void; label?: string; hint: string; level?: number }) {
  return (
    <button
      type="button"
      disabled={!mine}
      onClick={onWear}
      title={hint}
      className={`flex flex-col items-center gap-1 rounded-md p-1 ${worn ? 'bg-tile ring-2 ring-accent' : mine ? 'hover:bg-tile' : 'cursor-default'}`}
    >
      <span className={`grid size-12 place-items-center ${mine ? '' : 'opacity-30 grayscale'}`}>
        <FrameRing frame={f} level={mine ? level : 0} badge>
          {mine ? <YourIcon className="size-10" /> : <span className="grid size-10 place-items-center rounded-full bg-tile font-display font-bold text-ink-faint">?</span>}
        </FrameRing>
      </span>
      <span className="max-w-full truncate text-[10px] font-semibold" style={{ color: FRAME_RARITY_COLOR[f.rarity] }}>
        {mine ? f.name : (label ?? '???')}
      </span>
    </button>
  );
}

const dayMonth = (key: string) => fromKey(key).toLocaleDateString(dateLocale(), { day: 'numeric', month: 'short' });

/** Every frame: the machine's (won to wear, the others a mystery; seasonal ones say when they're back), then the trophies, earned by playing. */
function FrameCollection({ hide }: { hide: string[] }) {
  const owned = useProgress((s) => s.frames ?? []).filter((id) => !hide.includes(id));
  const copies = useProgress((s) => s.frameCopies);
  const worn = useProgress((s) => s.frame);
  const setFrame = useProgress((s) => s.setFrame);
  const feats = useFeats();
  const earned = earnedFrames(feats);
  const today = todayKey();
  const wear = (id: string | null) => (sfx.select(), setFrame(id));
  // A frame for each set completed; one locked to show the way while none is.
  const albums = feats.sets.map((id) => albumFrame(id, SETS.find((s) => s.id === id)?.franchise ?? 'Album'));
  const trophies = [...EARNED_FRAMES, ...(albums.length ? albums : [albumFrame('?', 'Full set')])];
  return (
    <section className="page mt-3 space-y-2 rounded-md p-3">
      <div className="flex items-baseline justify-between">
        <h3 className="font-display font-bold">Your icon frames</h3>
        <span className="text-xs text-ink-soft">
          {FRAMES.filter((f) => owned.includes(f.id)).length} / {FRAMES.length}
        </span>
      </div>
      <p className="text-xs text-ink-soft">
        Worn around your icon (the card you picked in the Album). Tap one to wear it. Seasonal frames are in the machine only around their day. <b>Ascendant:</b> a frame won again evolves, up to {ROMAN[ASCEND_MAX]}, a little grander each time (the rarer the frame, the fewer copies it takes); friends see it too.
      </p>
      <div className="grid grid-cols-4 gap-x-2 gap-y-3 pt-2">
        <button type="button" onClick={() => wear(null)} className={`flex flex-col items-center gap-1 rounded-md p-1 ${!worn ? 'bg-tile ring-2 ring-accent' : 'hover:bg-tile'}`}>
          <span className="grid size-12 place-items-center">
            <YourIcon className="size-10" />
          </span>
          <span className="text-[10px] font-semibold">None</span>
        </button>
        {FRAMES.map((f) => {
          const mine = owned.includes(f.id);
          const now = inSeason(f, today);
          const back = f.season && !now ? nextSeason(f, today) : null;
          return (
            <FrameTile
              key={f.id}
              f={f}
              mine={mine}
              worn={worn === f.id}
              onWear={() => wear(f.id)}
              level={ascendLevel(f, copies?.[f.id])}
              label={f.season ? (now ? 'In now!' : back ? `Back ${dayMonth(back)}` : '???') : undefined}
              hint={mine ? `${f.name} (${FRAME_RARITY_NAME[f.rarity]})${ascendLevel(f, copies?.[f.id]) ? ` · Ascendant ${ROMAN[ascendLevel(f, copies?.[f.id])]}` : ''}${ascendToNext(f, copies?.[f.id]) ? ` · ${ascendToNext(f, copies?.[f.id])} more to ${ROMAN[ascendLevel(f, copies?.[f.id]) + 1]}` : ''}` : f.season ? `A seasonal ${FRAME_RARITY_NAME[f.rarity]} frame — ${now ? 'in the machine now, for a few days only' : back ? `back in the machine on ${dayMonth(back)}` : 'back next year'}` : `A ${FRAME_RARITY_NAME[f.rarity]} frame — still in the machine`}
            />
          );
        })}
      </div>
      <div className="flex items-baseline justify-between pt-3">
        <h3 className="font-display font-bold">Trophies</h3>
        <span className="text-xs text-ink-soft">earned by playing, never in the machine</span>
      </div>
      <div className="grid grid-cols-4 gap-x-2 gap-y-3 pt-1">
        {trophies.map((f) => {
          const mine = earned.has(f.id);
          return <FrameTile key={f.id} f={f} mine={mine} worn={worn === f.id} onWear={() => wear(f.id)} label={f.earn} hint={mine ? `${f.name} — ${f.earn}` : `To earn: ${f.earn}`} />;
        })}
      </div>
    </section>
  );
}
