import { useEffect, useRef, useState } from 'react';
import { Coins, DleCoin } from '../components/DleCoin';
import { GlyphSeal } from '../components/Glyph';
import { celebrate, celebrateBig } from '../lib/fx';
import { sfx } from '../lib/sfx';
import { econToday, useProgress } from '../store/progress';
import { LINES, SLOTS, SLOT_LUCK, SLOT_SYMBOLS, linePay, slotCost, slotSymbol, type SlotResult, type SlotSymbol } from './casino';

/** A reel's cell, by how many machines play at once (smaller the more there are). */
const cellFor = (machines: number) => (machines >= 10 ? 26 : machines >= 5 ? 30 : 64);
const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/** A symbol on the reels: fruit and gems, the DleCoin, and Omnidle's own seal, the jackpot. */
export function SlotGlyph({ s, size = 40 }: { s: SlotSymbol; size?: number }) {
  if (s === 'coin') return <DleCoin className={size >= 36 ? 'size-10' : size >= 22 ? 'size-6' : 'size-4'} />;
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
function Reel({ symbols, spin, index, delay, cell, onStop, lit, lucky }: { symbols: SlotSymbol[]; spin: number; index: number; delay: number; cell: number; onStop: () => void; lit: Set<number>; lucky: Set<number> }) {
  const [strip, setStrip] = useState<SlotSymbol[]>(symbols);
  const [y, setY] = useState(0);
  const [moving, setMoving] = useState(false);
  const prev = useRef(symbols);
  // The spin it was put up at: a machine added between spins doesn't run on its own.
  const seen = useRef(spin);
  const stopped = useRef(onStop);
  stopped.current = onStop;
  // Several machines: each a little after the one before, so they don't all stop at once.
  const duration = 0.9 + index * 0.4 + delay;
  useEffect(() => {
    if (!spin || spin === seen.current) return;
    seen.current = spin;
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
    setY(-(next.length - 3) * cell);
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
  const big = cell >= 60;
  return (
    <div className={`relative overflow-hidden bg-gradient-to-b from-[#fff7e6] via-[#fffdf7] to-[#fff7e6] ${big ? 'rounded-md shadow-[inset_0_6px_10px_rgba(0,0,0,0.25),inset_0_-6px_10px_rgba(0,0,0,0.25)]' : 'rounded-sm shadow-[inset_0_3px_5px_rgba(0,0,0,0.25),inset_0_-3px_5px_rgba(0,0,0,0.25)]'}`} style={{ width: cell + (big ? 8 : 2), height: cell * 3 }}>
      <div className="absolute inset-x-0 top-0" style={{ transform: `translateY(${y}px)`, transition: moving ? `transform ${duration}s cubic-bezier(0.2, 0.6, 0.3, 1.06)` : 'none' }} onTransitionEnd={finish}>
        {strip.map((s, i) => (
          <div key={i} className={`relative grid place-items-center ${i < 3 && lit.has(i) && !moving ? 'slot-win-cell' : ''}`} style={{ height: cell }}>
            <SlotGlyph s={s} size={big ? 40 : Math.round(cell * 0.66)} />
            {/* Lined up by luck. */}
            {i < 3 && lucky.has(i) && !moving && (
              <span className={`slot-lucky absolute right-0 top-0 ${big ? 'text-xs' : 'text-[8px]'}`} title="Lined up by luck">
                🍀
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/** One machine's three reels, and its winning lines drawn over them once they've stopped. */
function Machine({ grid, result, spin, delay, cell, onStop }: { grid: SlotSymbol[][]; result: SlotResult | null; spin: number; delay: number; cell: number; onStop: () => void }) {
  const lit = [0, 1, 2].map((reel) => new Set((result?.wins ?? []).filter((w) => reel < w.count).map((w) => LINES[w.line][reel])));
  const lucky = [0, 1, 2].map((reel) => new Set((result?.lucky ?? []).filter(([r]) => r === reel).map(([, row]) => row)));
  const big = cell >= 60;
  return (
    <div className={`relative flex rounded-lg bg-[#1b1033] ${big ? 'gap-1.5 p-1.5' : 'gap-0.5 p-1'}`}>
      {[0, 1, 2].map((i) => (
        <Reel key={i} index={i} delay={delay} cell={cell} symbols={grid[i]} spin={spin} onStop={onStop} lit={lit[i]} lucky={lucky[i]} />
      ))}
      {result && result.wins.length > 0 && (
        <svg className={`pointer-events-none absolute ${big ? 'inset-1.5' : 'inset-1'}`} viewBox="0 0 3 3" preserveAspectRatio="none" aria-hidden>
          {result.wins.map((w) => {
            const pts = LINES[w.line].slice(0, w.count).map((row, reel) => `${reel + 0.5},${row + 0.5}`).join(' ');
            return <polyline key={w.line} className="slot-line" points={pts} fill="none" stroke={LINE_COLOR[w.line]} strokeWidth={big ? 5 : 3} vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" />;
          })}
        </svg>
      )}
    </div>
  );
}

const demoGrid = (seed: number): SlotSymbol[][] => [0, 1, 2].map((r) => [0, 1, 2].map((k) => SLOT_SYMBOLS[(r * 2 + k + seed) % SLOT_SYMBOLS.length]));

export function Slots() {
  const coins = useProgress((s) => s.coins);
  const play = useProgress((s) => s.playSlots);
  const spins = econToday(useProgress((s) => s.econ)).slots ?? 0;
  const left = Math.max(0, SLOTS.dailySpins - spins);
  const [bet, setBet] = useState(SLOTS.bets[0]);
  const [luck, setLuck] = useState(0);
  const [machines, setMachines] = useState(SLOTS.machines[0]);
  const [grids, setGrids] = useState<SlotSymbol[][][]>(() => [demoGrid(0)]);
  const [spin, setSpin] = useState(0);
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<SlotResult[] | null>(null);
  const [auto, setAuto] = useState(false);
  const [showPays, setShowPays] = useState(false);
  const stoppedReels = useRef(0);
  const ticker = useRef<number>();
  const pending = useRef<SlotResult[] | null>(null);
  const each = slotCost(bet, luck);
  const cost = each * machines;
  const can = !running && left >= machines && coins >= cost;
  const cell = cellFor(machines);
  /** What a line pays at this bet is the yardstick: a big win is 25 spins' prizes on one machine. */
  const stake = SLOTS.cost * bet;

  const pickMachines = (n: number) => {
    if (running || n === machines) return;
    sfx.select();
    setMachines(n);
    setResults(null);
    setGrids(Array.from({ length: n }, (_, k) => grids[k] ?? demoGrid(k)));
  };

  const go = () => {
    if (running) return;
    const rs = play(bet, luck, machines);
    if (!rs) return setAuto(false);
    sfx.click();
    setResults(null);
    setGrids(rs.map((r) => r.grid));
    stoppedReels.current = 0;
    setRunning(true);
    setSpin((n) => n + 1);
    pending.current = rs;
    window.clearInterval(ticker.current);
    if (!reducedMotion()) ticker.current = window.setInterval(() => sfx.wheelTick(0.8 + Math.random() * 0.4), 70);
  };
  const reelStopped = () => {
    stoppedReels.current += 1;
    // One tick a reel on a single machine; on many, one per machine's last reel (not thirty at once).
    if (machines === 1 || stoppedReels.current % 3 === 0) sfx.tick();
    if (stoppedReels.current < 3 * (pending.current?.length ?? 1)) return;
    window.clearInterval(ticker.current);
    const rs = pending.current;
    setRunning(false);
    setResults(rs);
    const won = rs?.reduce((t, r) => t + r.coins, 0) ?? 0;
    if (!rs || !won) return;
    sfx.coins(Math.min(14, 3 + rs.reduce((t, r) => t + r.wins.length, 0) * 2));
    if (rs.some((r) => r.coins >= stake * 25)) celebrateBig();
    else if (won >= cost * 2) celebrate();
  };
  useEffect(() => () => window.clearInterval(ticker.current), []);
  // Auto: the next spin a moment after the last one stops (until it's turned off, or nothing's left to play).
  useEffect(() => {
    if (!auto || running) return;
    if (!can) return setAuto(false);
    const t = window.setTimeout(go, results?.some((r) => r.coins) ? 1100 : 450);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auto, running, results]);

  const won = results?.reduce((t, r) => t + r.coins, 0) ?? 0;
  const winning = results?.filter((r) => r.coins > 0).length ?? 0;
  const winLines = new Set(machines === 1 ? (results?.[0]?.wins ?? []).map((w) => w.line) : []);
  const big = !!results && results.some((r) => r.coins >= stake * 25);

  return (
    <div className={`mx-auto w-full ${machines === 1 ? 'max-w-sm' : 'max-w-2xl'}`}>
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
            <div className="text-[9px] uppercase tracking-[0.3em] text-white/60">{machines === 1 ? '5 lines · 3 reels' : `${machines} machines · 5 lines each`}</div>
          </div>
          <div className="text-right text-[10px] font-bold uppercase tracking-widest text-[#fbbf24]/80">
            Spins
            <div className="font-display text-sm tabular-nums text-white">{left.toLocaleString('en')}</div>
          </div>
        </div>
        {/* The reels: one machine with its line markers either side, or several side by side. */}
        {machines === 1 ? (
          <div className="relative flex items-center justify-center gap-1.5">
            <LineMarkers lit={winLines} />
            <Machine grid={grids[0]} result={results?.[0] ?? null} spin={spin} delay={0} cell={cell} onStop={reelStopped} />
            <LineMarkers lit={winLines} />
          </div>
        ) : (
          <div className="relative flex flex-wrap justify-center gap-1.5">
            {grids.map((g, k) => (
              <div key={k} className="flex flex-col items-center">
                <Machine grid={g} result={results?.[k] ?? null} spin={spin} delay={k * 0.08} cell={cell} onStop={reelStopped} />
                <div className="h-4 text-[10px] font-bold tabular-nums text-[#fde68a]">{results?.[k]?.coins ? `+${results[k].coins.toLocaleString('en')}` : ''}</div>
              </div>
            ))}
          </div>
        )}
        {/* What it paid. */}
        <div className="relative mt-2 h-7 text-center font-display font-bold">
          {results &&
            (won > 0 ? (
              <span key={spin} className={`inline-flex items-center gap-1 text-[#fde68a] ${big ? 'slot-jackpot text-xl' : 'animate-pop'}`}>
                {big ? 'JACKPOT! ' : 'WIN '}+<Coins n={won} />
                {machines > 1 && <span className="text-xs text-white/60"> · {winning}/{machines} machines</span>}
              </span>
            ) : (
              <span className="text-sm text-white/50">No line this time</span>
            ))}
        </div>
        {/* Auto, spin; then machines, bet and luck. */}
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
        </div>
        <div className="relative mt-2 grid grid-cols-3 gap-2">
          <Picker label="Machines" options={SLOTS.machines.map((n) => ({ key: n, text: `×${n}`, title: `${n} machine${n > 1 ? 's' : ''} at once: ${n} spin${n > 1 ? 's' : ''} for ${n} times the cost` }))} value={machines} disabled={running} onPick={pickMachines} tone="blue" />
          <Picker label="Bet" options={SLOTS.bets.map((b) => ({ key: b, text: `×${b}`, title: `Bet ×${b}: cost and prizes ×${b}` }))} value={bet} disabled={running} onPick={(b) => (sfx.select(), setBet(b))} tone="red" />
          <Picker label="Luck" options={SLOT_LUCK.map((l, k) => ({ key: k, text: '🍀'.repeat(k + 1), title: k ? `Luck ${'🍀'.repeat(k + 1)}: reels line up more often · the spin costs ×${l.cost}` : 'No extra luck' }))} value={luck} disabled={running} onPick={(k) => (sfx.select(), setLuck(k))} tone="green" />
        </div>
      </div>
      <button type="button" onClick={() => setShowPays((p) => !p)} className="mt-2 w-full text-center text-xs font-semibold text-ink-soft underline-offset-2 hover:underline">
        {showPays ? 'Hide' : 'Show'} what pays
      </button>
      {showPays && <PayTable bet={bet} luck={luck} machines={machines} />}
    </div>
  );
}

const TONE = {
  blue: 'bg-[#2563eb] shadow-[0_0_0_2px_#93c5fd]',
  red: 'bg-[#dc2626] shadow-[0_0_0_2px_#fbbf24]',
  green: 'bg-[#15803d] shadow-[0_0_0_2px_#86efac]',
};
/** A row of choices on the cabinet: machines, bet or luck. */
function Picker<K extends number>({ label, options, value, disabled, onPick, tone }: { label: string; options: { key: K; text: string; title: string }[]; value: K; disabled: boolean; onPick: (k: K) => void; tone: keyof typeof TONE }) {
  return (
    <div role="group" aria-label={label}>
      <div className="mb-0.5 text-center text-[9px] font-bold uppercase tracking-[0.25em] text-white/60">{label}</div>
      <div className="flex gap-1">
        {options.map((o) => (
          <button key={o.key} type="button" disabled={disabled} onClick={() => onPick(o.key)} aria-pressed={value === o.key} title={o.title} className={`flex-1 whitespace-nowrap rounded-md px-1 py-1 text-[11px] font-black leading-none transition ${value === o.key ? `${TONE[tone]} text-white` : 'bg-[#1b1033] text-white/70 hover:text-white'}`}>
            {o.text}
          </button>
        ))}
      </div>
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

function PayTable({ bet, luck, machines }: { bet: number; luck: number; machines: number }) {
  return (
    <div className="page mt-2 space-y-1 rounded-md p-3 text-sm">
      <p className="text-xs text-ink-soft">
        <b>Machines</b> (×1, ×5, ×10): that many machines spin at once, each on its own, for that many times the cost (and that many of the day&apos;s spins). <b>Bet</b> (×1, ×5, ×10): the spin&apos;s cost and its prizes, both multiplied. <b>Luck</b> (🍀): now and then reel 2 or 3 lines a symbol up with the reel before it (a 🍀 marks it), so wins come more often and big ones much more; the prizes stay, the spin costs more:{' '}
        {SLOT_LUCK.map((l, k) => `${'🍀'.repeat(k + 1)} ×${l.cost}`).join(' · ')}. Now: a spin costs <Coins n={slotCost(bet, luck) * machines} />
        {machines > 1 && <> ({machines} × <Coins n={slotCost(bet, luck)} />)</>}.
      </p>
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
