import { useEffect, useRef, useState } from 'react';
import { Coins, DleCoin } from '../components/DleCoin';
import { GlyphSeal } from '../components/Glyph';
import { celebrate, celebrateBig } from '../lib/fx';
import { sfx } from '../lib/sfx';
import { econToday, useProgress } from '../store/progress';
import { LINES, SLOTS, SLOT_SYMBOLS, linePay, slotSymbol, type SlotResult, type SlotSymbol } from './casino';

const CELL = 64;
const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/** A symbol on the reels: fruit and gems, the DleCoin, and Omnidle's own seal, the jackpot. */
export function SlotGlyph({ s, size = 40 }: { s: SlotSymbol; size?: number }) {
  if (s === 'coin') return <DleCoin className="size-10" />;
  if (s === 'seal') return <GlyphSeal seed="omnidle" size={size + 4} tone="text-[#b45309]" />;
  const emoji: Record<Exclude<SlotSymbol, 'coin' | 'seal'>, string> = { cherry: '🍒', bell: '🔔', star: '⭐', card: '🃏', gem: '💎' };
  return (
    <span className="leading-none" style={{ fontSize: size * 0.85 }}>
      {emoji[s]}
    </span>
  );
}

/** Each line's colour, its marker on both sides and its stroke over the reels. */
const LINE_COLOR = ['#f87171', '#fbbf24', '#34d399', '#60a5fa', '#c084fc'];

/** One reel: a strip that runs down and stops on its three symbols (the last reel stops last). */
function Reel({ symbols, spin, index, onStop, lit }: { symbols: SlotSymbol[]; spin: number; index: number; onStop: () => void; lit: Set<number> }) {
  const [strip, setStrip] = useState<SlotSymbol[]>(symbols);
  const [y, setY] = useState(0);
  const [moving, setMoving] = useState(false);
  const prev = useRef(symbols);
  const stopped = useRef(onStop);
  stopped.current = onStop;
  const duration = 0.9 + index * 0.4;
  useEffect(() => {
    if (!spin) return;
    if (reducedMotion()) {
      setStrip(symbols);
      setY(0);
      prev.current = symbols;
      stopped.current();
      return;
    }
    // The new symbols on top, a blur of others, the old ones at the bottom (where the reel starts).
    const filler = Array.from({ length: 14 + index * 6 }, () => slotSymbol());
    const next = [...symbols, ...filler, ...prev.current];
    prev.current = symbols;
    finished.current = false;
    setMoving(false);
    setStrip(next);
    setY(-(next.length - 3) * CELL);
    const raf = requestAnimationFrame(() => requestAnimationFrame(() => (setMoving(true), setY(0))));
    // The end of the transition stops the reel; this stops it anyway (a tab in the background runs none).
    const late = window.setTimeout(finish, duration * 1000 + 250);
    return () => (cancelAnimationFrame(raf), window.clearTimeout(late));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spin]);
  const finished = useRef(true);
  const finish = () => {
    if (finished.current) return;
    finished.current = true;
    setMoving(false);
    setStrip(prev.current);
    setY(0);
    stopped.current();
  };
  return (
    <div className="relative overflow-hidden rounded-md bg-gradient-to-b from-[#fff7e6] via-[#fffdf7] to-[#fff7e6] shadow-[inset_0_6px_10px_rgba(0,0,0,0.25),inset_0_-6px_10px_rgba(0,0,0,0.25)]" style={{ width: CELL + 8, height: CELL * 3 }}>
      <div
        className="absolute inset-x-0 top-0"
        style={{ transform: `translateY(${y}px)`, transition: moving ? `transform ${duration}s cubic-bezier(0.2, 0.6, 0.3, 1.06)` : 'none', filter: moving ? undefined : undefined }}
        onTransitionEnd={finish}
      >
        {strip.map((s, i) => (
          <div key={i} className={`grid place-items-center ${i < 3 && lit.has(i) && !moving ? 'slot-win-cell' : ''}`} style={{ height: CELL }}>
            <SlotGlyph s={s} />
          </div>
        ))}
      </div>
    </div>
  );
}

export function Slots() {
  const coins = useProgress((s) => s.coins);
  const play = useProgress((s) => s.playSlots);
  const spins = econToday(useProgress((s) => s.econ)).slots ?? 0;
  const left = Math.max(0, SLOTS.dailySpins - spins);
  const [bet, setBet] = useState(SLOTS.bets[0]);
  const [grid, setGrid] = useState<SlotSymbol[][]>(() => [0, 1, 2].map((r) => [0, 1, 2].map((k) => SLOT_SYMBOLS[(r * 2 + k) % SLOT_SYMBOLS.length])));
  const [spin, setSpin] = useState(0);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<SlotResult | null>(null);
  const [auto, setAuto] = useState(false);
  const [showPays, setShowPays] = useState(false);
  const stoppedReels = useRef(0);
  const ticker = useRef<number>();
  const cost = SLOTS.cost * bet;
  const can = !running && left > 0 && coins >= cost;

  const go = () => {
    if (running) return;
    const r = play(bet);
    if (!r) return setAuto(false);
    sfx.click();
    setResult(null);
    setGrid(r.grid);
    stoppedReels.current = 0;
    setRunning(true);
    setSpin((n) => n + 1);
    pending.current = r;
    window.clearInterval(ticker.current);
    if (!reducedMotion()) ticker.current = window.setInterval(() => sfx.wheelTick(0.8 + Math.random() * 0.4), 70);
  };
  const pending = useRef<SlotResult | null>(null);
  const reelStopped = () => {
    stoppedReels.current += 1;
    sfx.tick();
    if (stoppedReels.current < 3) return;
    window.clearInterval(ticker.current);
    const r = pending.current;
    setRunning(false);
    setResult(r);
    if (!r || !r.coins) return;
    sfx.coins(Math.min(14, 3 + r.wins.length * 2));
    if (r.coins >= cost * 25) celebrateBig();
    else if (r.coins >= cost * 4) celebrate();
  };
  useEffect(() => () => window.clearInterval(ticker.current), []);
  // Auto: the next spin a moment after the last one stops (until it's turned off, or nothing's left to play).
  useEffect(() => {
    if (!auto || running) return;
    if (!can) return setAuto(false);
    const t = window.setTimeout(go, result?.coins ? 1100 : 450);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auto, running, result]);

  // The winning cells, reel by reel, and the lines they're on.
  const lit = [0, 1, 2].map((reel) => new Set((result?.wins ?? []).filter((w) => reel < w.count).map((w) => LINES[w.line][reel])));
  const winLines = new Set((result?.wins ?? []).map((w) => w.line));
  const big = !!result && result.coins >= cost * 25;

  return (
    <div className="mx-auto w-full max-w-sm">
      <div className="slot-cabinet relative rounded-2xl p-3 text-white">
        <div className="slot-bulbs pointer-events-none absolute inset-1 rounded-xl" aria-hidden />
        {/* The marquee: the balance, the name, today's spins. */}
        <div className="relative mb-3 flex items-center justify-between gap-2 rounded-lg border-2 border-[#fbbf24] bg-[#1b1033] px-3 py-2">
          <div className="text-[10px] font-bold uppercase tracking-widest text-[#fbbf24]/80">
            Coins
            <div className="font-display text-sm tabular-nums text-white">{coins.toLocaleString('en')}</div>
          </div>
          <div className="text-center">
            <div className="slot-title font-display text-2xl font-black tracking-wider">OMNI SLOTS</div>
            <div className="text-[9px] uppercase tracking-[0.3em] text-white/60">5 lines · 3 reels</div>
          </div>
          <div className="text-right text-[10px] font-bold uppercase tracking-widest text-[#fbbf24]/80">
            Spins
            <div className="font-display text-sm tabular-nums text-white">{left.toLocaleString('en')}</div>
          </div>
        </div>
        {/* The reels, the line markers either side, and the winning lines drawn over them. */}
        <div className="relative flex items-center justify-center gap-1.5">
          <LineMarkers lit={winLines} />
          <div className="relative flex gap-1.5 rounded-lg bg-[#1b1033] p-1.5">
            {[0, 1, 2].map((i) => (
              <Reel key={i} index={i} symbols={grid[i]} spin={spin} onStop={reelStopped} lit={lit[i]} />
            ))}
            {result && result.wins.length > 0 && (
              <svg className="pointer-events-none absolute inset-1.5" viewBox="0 0 3 3" preserveAspectRatio="none" aria-hidden>
                {result.wins.map((w) => {
                  const pts = LINES[w.line].slice(0, w.count).map((row, reel) => `${reel + 0.5},${row + 0.5}`).join(' ');
                  return <polyline key={w.line} className="slot-line" points={pts} fill="none" stroke={LINE_COLOR[w.line]} strokeWidth={5} vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" />;
                })}
              </svg>
            )}
          </div>
          <LineMarkers lit={winLines} />
        </div>
        {/* What it paid. */}
        <div className="relative mt-2 h-7 text-center font-display font-bold">
          {result && (result.coins > 0 ? <span key={spin} className={`inline-flex items-center gap-1 text-[#fde68a] ${big ? 'slot-jackpot text-xl' : 'animate-pop'}`}>{big ? 'JACKPOT! ' : 'WIN '}+<Coins n={result.coins} /></span> : <span className="text-sm text-white/50">No line this time</span>)}
        </div>
        {/* Auto, spin, bet. */}
        <div className="relative mt-1 flex items-stretch gap-2">
          <button type="button" onClick={() => (sfx.select(), setAuto((a) => !a))} aria-pressed={auto} title="Auto-spin: keeps spinning until you stop it" className={`rounded-lg border-2 px-3 font-display text-lg font-bold transition ${auto ? 'border-[#34d399] bg-[#065f46] text-[#a7f3d0]' : 'border-white/20 bg-[#1b1033] text-white/80 hover:border-white/50'}`}>
            <span className={auto ? 'inline-block animate-spin [animation-duration:2s]' : ''}>⟳</span>
          </button>
          <button type="button" onClick={go} disabled={!can} className="slot-spin flex-1 rounded-lg py-2 font-display text-[#3b1d00] disabled:opacity-50">
            <div className="flex items-center justify-center gap-1 text-[11px] font-bold">
              <DleCoin className="size-3.5" /> {cost.toLocaleString('en')}
            </div>
            <div className="text-lg font-black tracking-widest">{running ? '…' : 'SPIN'}</div>
          </button>
          <div className="flex flex-col gap-1" role="group" aria-label="Bet">
            {SLOTS.bets.map((b) => (
              <button key={b} type="button" disabled={running} onClick={() => (sfx.select(), setBet(b))} aria-pressed={bet === b} className={`rounded-md px-2.5 text-xs font-black transition ${bet === b ? 'bg-[#dc2626] text-white shadow-[0_0_0_2px_#fbbf24]' : 'bg-[#1b1033] text-white/70 hover:text-white'}`}>
                ×{b}
              </button>
            ))}
          </div>
        </div>
      </div>
      <button type="button" onClick={() => setShowPays((p) => !p)} className="mt-2 w-full text-center text-xs font-semibold text-ink-soft underline-offset-2 hover:underline">
        {showPays ? 'Hide' : 'Show'} what pays
      </button>
      {showPays && <PayTable bet={bet} />}
    </div>
  );
}

function LineMarkers({ lit }: { lit: Set<number> }) {
  // Lines 4 and 5 (the diagonals) start in the top and bottom corners: their markers sit by rows 1 and 3.
  const order = [3, 0, 1, 2, 4];
  return (
    <div className="flex flex-col justify-between self-stretch py-1.5">
      {order.map((l) => (
        <span key={l} className={`grid size-4 place-items-center rounded-sm text-[9px] font-black text-[#1b1033] transition ${lit.has(l) ? 'scale-125' : 'opacity-60'}`} style={{ background: LINE_COLOR[l], boxShadow: lit.has(l) ? `0 0 8px ${LINE_COLOR[l]}` : undefined }}>
          {l + 1}
        </span>
      ))}
    </div>
  );
}

function PayTable({ bet }: { bet: number }) {
  return (
    <div className="page mt-2 space-y-1 rounded-md p-3 text-sm">
      <p className="text-xs text-ink-soft">Three in a line (rows or diagonals) pays, at ×{bet}:</p>
      {[...SLOT_SYMBOLS].reverse().map((s) => (
        <div key={s} className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-1">
            {[0, 1, 2].map((i) => (
              <span key={i} className="grid size-7 place-items-center">
                <SlotGlyph s={s} size={24} />
              </span>
            ))}
          </span>
          <span className="flex items-center gap-2 font-semibold tabular-nums">
            {linePay(s, 2) > 0 && (
              <span className="text-xs text-ink-soft">
                two from the left <Coins n={Math.round(linePay(s, 2) * bet)} />
              </span>
            )}
            <Coins n={Math.round(linePay(s, 3) * bet)} />
          </span>
        </div>
      ))}
    </div>
  );
}
