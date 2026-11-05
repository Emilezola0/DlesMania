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
import { FRAMES, FRAME_RARITIES, FRAME_RARITY_COLOR, FRAME_RARITY_NAME, type Frame } from './frames';

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

type Got = { frame: Frame; duplicate: boolean; coins: number; free: boolean };
type Stage = 'idle' | 'turning' | 'dropped' | 'zoom' | 'open';

export function Capsules() {
  const coins = useProgress((s) => s.coins);
  const tokens = useProgress((s) => s.capsuleTokens ?? 0);
  const open = useProgress((s) => s.openCapsule);
  const [stage, setStage] = useState<Stage>('idle');
  const [turn, setTurn] = useState(0);
  const [got, setGot] = useState<Got | null>(null);
  const [shell, setShell] = useState(SHELLS[0]);
  const busy = stage === 'turning' || stage === 'dropped' || stage === 'zoom';
  const can = !busy && (tokens > 0 || coins >= CAPSULES.cost);
  // The capsules in the dome, where they lie.
  const pile = useMemo(() => Array.from({ length: 14 }, (_, i) => ({ x: 12 + ((i * 37) % 70), y: 38 + ((i * 53) % 44), color: SHELLS[i % SHELLS.length], rot: (i * 47) % 360 })), []);
  const timers = useRef<number[]>([]);
  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), []);
  const later = (fn: () => void, ms: number) => timers.current.push(window.setTimeout(fn, reducedMotion() ? 0 : ms));

  const go = () => {
    if (!can) return;
    const r = open();
    if (!r) return;
    // What's inside stays inside until it's opened: the last one's result goes, nothing new shows.
    setGot(r);
    setShell(SHELLS[Math.floor(Math.random() * SHELLS.length)]);
    setStage('turning');
    setTurn((t) => t + 1);
    for (let k = 0; k < 6; k++) later(() => sfx.wheelTick(0.7 + k * 0.05), k * 120);
    later(() => (sfx.pop(), setStage('dropped')), 900);
  };

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
              <div className="text-[9px] font-bold uppercase tracking-widest text-[#fbbf24]/80">A capsule</div>
              <div className="flex items-center justify-center gap-1 font-display text-sm font-bold">
                {tokens > 0 ? (
                  <span className="text-[#a7f3d0]">FREE ×{tokens}</span>
                ) : (
                  <>
                    <DleCoin className="size-3.5" /> {CAPSULES.cost}
                  </>
                )}
              </div>
            </div>
            <button type="button" onClick={go} disabled={!can} aria-label="Turn the knob" title="Turn the knob" className="capsule-knob relative grid size-16 place-items-center rounded-full disabled:opacity-60">
              <span className="capsule-knob-bar block h-3 w-12 rounded-full" style={{ rotate: `${turn * 360}deg` }} />
            </button>
            <div className="capsule-chute relative grid size-14 place-items-center rounded-md">
              {stage === 'dropped' && (
                <button type="button" onClick={() => (sfx.whoosh(), setStage('zoom'))} aria-label="Pick up the capsule" className="capsule-drop">
                  <Capsule color={shell} size={40} />
                </button>
              )}
            </div>
          </div>
          <p className="mt-2 h-4 text-center text-xs font-bold tracking-widest text-white/85">
            {stage === 'turning' ? '…' : stage === 'dropped' ? 'TAKE THE CAPSULE' : stage === 'zoom' ? 'OPEN IT!' : can ? 'TURN THE KNOB' : 'NOT ENOUGH COINS'}
          </p>
        </div>
      </div>

      {stage === 'zoom' && got && <Opening got={got} shell={shell} onOpen={() => setStage('open')} />}
      {stage === 'open' && got && <Revealed got={got} again={can ? go : undefined} />}

      {/* Until it's open, the new frame isn't in the collection either. */}
      <FrameCollection hide={busy && got && !got.duplicate ? got.frame.id : undefined} />
    </div>
  );
}

/** How many taps a capsule takes to crack open: the rarer, the more it fights back. */
const TAPS: Record<Frame['rarity'], number> = { common: 3, rare: 3, epic: 3, legendary: 4 };

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
        return { dx: Math.cos(a) * d, dy: Math.sin(a) * d, size: 4 + Math.random() * 7, delay: Math.random() * 120, color: rarity === 'legendary' ? SHELLS[i % SHELLS.length] : i % 3 ? color : '#fff' };
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
  const color = FRAME_RARITY_COLOR[got.frame.rarity];
  if (close) return null;
  return createPortal(
    <div className="fixed inset-0 z-50 grid place-items-center overflow-hidden bg-[#07060c]/90 p-4 backdrop-blur-sm" style={{ ['--glow' as string]: color }}>
      <div className="capsule-stage-rays pointer-events-none absolute left-1/2 top-1/2 aspect-square w-[160vmax]" style={{ opacity: 0.7 }} aria-hidden />
      <div className="relative flex flex-col items-center text-center text-white">
        <div className="capsule-frame-in relative grid size-44 place-items-center">
          <FrameRing frame={got.frame}>
            <YourIcon className="size-36" />
          </FrameRing>
          {!got.duplicate && <span className="pack-stamp absolute -right-6 -top-2 rounded-md border-2 border-coral bg-[#1b1530] px-2 py-0.5 font-display text-lg font-black text-coral">NEW!</span>}
        </div>
        <p className="mt-6 text-xs font-bold uppercase tracking-[0.35em]" style={{ color }}>
          {FRAME_RARITY_NAME[got.frame.rarity]} frame{got.free && ' · free capsule'}
        </p>
        <p className="capsule-name font-display text-3xl font-black">{got.frame.name}</p>
        {got.duplicate && (
          <p className="mt-1 text-sm text-white/75">
            Already yours — <Coins n={got.coins} /> back.
          </p>
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

/** Every frame: the ones won to wear (tap), the others still a mystery. */
function FrameCollection({ hide }: { hide?: string }) {
  const owned = useProgress((s) => s.frames ?? []).filter((id) => id !== hide);
  const worn = useProgress((s) => s.frame);
  const setFrame = useProgress((s) => s.setFrame);
  return (
    <section className="page mt-3 space-y-2 rounded-md p-3">
      <div className="flex items-baseline justify-between">
        <h3 className="font-display font-bold">Your icon frames</h3>
        <span className="text-xs text-ink-soft">
          {owned.length} / {FRAMES.length}
        </span>
      </div>
      <p className="text-xs text-ink-soft">Worn around your icon (the card you picked in the Album). Tap one to wear it.</p>
      <div className="grid grid-cols-4 gap-x-2 gap-y-3 pt-2">
        <button type="button" onClick={() => (sfx.select(), setFrame(null))} className={`flex flex-col items-center gap-1 rounded-md p-1 ${!worn ? 'bg-tile ring-2 ring-accent' : 'hover:bg-tile'}`}>
          <span className="grid size-12 place-items-center">
            <YourIcon className="size-10" />
          </span>
          <span className="text-[10px] font-semibold">None</span>
        </button>
        {FRAMES.map((f) => {
          const mine = owned.includes(f.id);
          return (
            <button
              key={f.id}
              type="button"
              disabled={!mine}
              onClick={() => (sfx.select(), setFrame(f.id))}
              title={mine ? `${f.name} (${FRAME_RARITY_NAME[f.rarity]})` : `A ${FRAME_RARITY_NAME[f.rarity]} frame — still in the machine`}
              className={`flex flex-col items-center gap-1 rounded-md p-1 ${worn === f.id ? 'bg-tile ring-2 ring-accent' : mine ? 'hover:bg-tile' : 'cursor-default'}`}
            >
              <span className={`grid size-12 place-items-center ${mine ? '' : 'opacity-30 grayscale'}`}>
                <FrameRing frame={f}>
                  {mine ? <YourIcon className="size-10" /> : <span className="grid size-10 place-items-center rounded-full bg-tile font-display font-bold text-ink-faint">?</span>}
                </FrameRing>
              </span>
              <span className="truncate text-[10px] font-semibold" style={{ color: FRAME_RARITY_COLOR[f.rarity] }}>
                {mine ? f.name : '???'}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
