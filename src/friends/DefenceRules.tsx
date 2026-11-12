// The Defence Deck's rules, shown rather than told (src/friends/defence.ts): a duel that plays itself, the element
// wheel, and short tiles for what makes a card's power; and the power bar every duel of a battle is drawn with, so
// the player sees why a card won (its rarity, grades, the element's edge, home, tiredness…).
import { useEffect, useState, type ReactNode } from 'react';
import { ANOMALIES } from '../gacha/anomalies';
import { RARITIES, RARITY_INFO, RARITY_LIGHT } from '../gacha/cards';
import { ELEMENT_GRADE } from '../gacha/grades';
import { beats, DEFENCE, sumParts, type Arena, type BattleEvent, type Element, type Part, type PartKey, type Rarity, type Side } from './defence';
import { ELEMENT_INFO } from './defenceCards';

/** Each piece of a card's power: its colour on the bar, an icon and a word. */
export const PART_INFO: Record<PartKey, { icon: string; label: string; bar: string }> = {
  rarity: { icon: '🃏', label: 'rarity', bar: 'bg-plum' },
  grade: { icon: '⭐', label: 'grades', bar: 'bg-lv2' },
  kind: { icon: '📜', label: 'not a character', bar: 'bg-coral' },
  crew: { icon: '🤝', label: 'crew', bar: 'bg-lv1' },
  light: { icon: '☀️', label: 'light', bar: 'bg-ochre' },
  spare: { icon: '💰', label: 'points unspent', bar: 'bg-lv0' },
  arena: { icon: '🏟️', label: 'arena', bar: 'bg-ochre' },
  home: { icon: '🛡️', label: 'at home', bar: 'bg-accent' },
  lift: { icon: '🏰', label: 'places', bar: 'bg-lv3' },
  hit: { icon: '🥋', label: 'technique hit', bar: 'bg-coral' },
  fatigue: { icon: '😮‍💨', label: 'tired', bar: 'bg-coral' },
  timelost: { icon: '⌛', label: 'time-lost', bar: 'bg-coral' },
  underdog: { icon: '🐕', label: 'underdog', bar: 'bg-rose' },
  edge: { icon: '⚔️', label: 'element edge', bar: 'bg-hit' },
};

/** True just after mounting: what a CSS transition grows from. */
function useMounted() {
  const [on, setOn] = useState(false);
  useEffect(() => {
    // A short timer, not an animation frame: a page not being painted (a tab in the background) still gets there.
    const t = window.setTimeout(() => setOn(true), 30);
    return () => window.clearTimeout(t);
  }, []);
  return on;
}

/** One piece of a bar: grows in when it appears (so a piece added later, like the element's edge, grows on its own). */
function Segment({ k, v, width, delay }: { k: PartKey; v: number; width: string; delay: number }) {
  const on = useMounted();
  return (
    <span
      title={`+${v} ${PART_INFO[k].label}`}
      className={`h-full border-r border-paper/60 transition-[width] duration-500 ease-out ${PART_INFO[k].bar} ${k === 'edge' ? 'animate-pulse' : ''}`}
      style={{ width: on ? width : '0%', transitionDelay: `${delay}ms` }}
    />
  );
}

const STRIPES = 'repeating-linear-gradient(135deg, var(--color-coral) 0 4px, transparent 4px 8px)';

/**
 * A card's power as a bar: what adds to it, piece by piece in its colours, growing in one after another; what takes
 * away (tiredness, a technique's hit…) struck through at its end. `max` is the scale (the same for both cards of a duel).
 */
export function PowerBar({ parts, max, delay = 0, won }: { parts: Part[]; max: number; delay?: number; won?: boolean }) {
  const on = useMounted();
  const plus = parts.filter(([, v]) => v > 0);
  const minus = -parts.filter(([, v]) => v < 0).reduce((n, [, v]) => n + v, 0);
  const top = sumParts(plus);
  const pct = (v: number) => `${(100 * Math.max(0, v)) / Math.max(1, max)}%`;
  const end = delay + plus.length * 140;
  return (
    <div className={`relative h-5 w-full overflow-hidden rounded-sm bg-tile ${won ? 'ring-2 ring-hit' : ''}`}>
      <div className="flex h-full">
        {plus.map(([k, v], i) => (
          <Segment key={`${k}${i}`} k={k} v={v} width={pct(v)} delay={delay + i * 140} />
        ))}
      </div>
      {minus > 0 && (
        <span
          title={`−${minus}`}
          className="absolute inset-y-0 border-l-2 border-coral transition-opacity duration-500"
          style={{ left: pct(top - minus), width: pct(Math.min(minus, top)), backgroundImage: STRIPES, opacity: on ? 1 : 0, transitionDelay: `${end}ms` }}
        />
      )}
    </div>
  );
}

/** The pieces of a card's power in words: "+16 rarity · +6 element edge · −2 tired". */
export function PartChips({ parts }: { parts: Part[] }) {
  return (
    <span className="flex flex-wrap gap-x-2 gap-y-0.5 text-[11px] leading-tight text-ink-soft">
      {parts.map(([k, v], i) => (
        <span key={i} className={`inline-flex items-center gap-1 ${v < 0 ? 'text-coral' : k === 'edge' ? 'font-bold text-hit' : ''}`}>
          <i className={`inline-block size-2 rounded-sm ${PART_INFO[k].bar}`} />
          {v > 0 ? '+' : '−'}
          {Math.abs(v)} {PART_INFO[k].label}
        </span>
      ))}
    </span>
  );
}

type Duel = Extract<BattleEvent, { t: 'duel' }>;
const elName = (e: Element) => `${ELEMENT_INFO[e].icon} ${ELEMENT_INFO[e].name}`;

/** Why a duel went as it did, in a few words. */
export function verdict(e: Duel): ReactNode {
  const wa = e.winner === 'a';
  const [w, l] = wa ? [e.ea, e.ed] : [e.ed, e.ea];
  const [pw, pl] = wa ? [e.pa, e.pd] : [e.pd, e.pa];
  // Battles from before EDGE_FROM: the element alone decided.
  if (e.reason === 'element') return `${elName(w)} beats ${elName(l)}${e.inverted ? ' (inverted!)' : ''}`;
  const edge = e.edge ? `${elName(e.edge === 'a' ? e.ea : e.ed)} beats ${elName(e.edge === 'a' ? e.ed : e.ea)}${e.inverted ? ' (inverted!)' : ''}: +${DEFENCE.edge}` : null;
  if (e.reason === 'tie') return `${edge ? `${edge}. ` : ''}Equal power (⚡${e.pa}): both are out`;
  if (!edge) return `⚡${pw} beats ⚡${pl}: the stronger card wins`;
  if (e.edge === e.winner) return `${edge}, so ⚡${pw} beats ⚡${pl}`;
  return `${edge}, but ⚡${pw} still beats ⚡${pl}`;
}

/** Both cards' power bars in a duel, on one scale, with what they're made of. */
export function DuelBars({ e, names }: { e: Duel; names: Record<'a' | 'd', string> }) {
  const parts = e.parts;
  if (!parts) return null;
  const max = Math.max(...(['a', 'd'] as const).map((s) => sumParts(parts[s].filter(([, v]) => v > 0))));
  return (
    <div className="space-y-1.5">
      {(['a', 'd'] as const).map((s, k) => (
        <div key={s} className="space-y-0.5">
          <div className="flex items-center gap-2">
            <span className="w-16 shrink-0 truncate text-right text-xs font-bold sm:w-24" title={names[s]}>
              {names[s]}
            </span>
            <PowerBar parts={parts[s]} max={max} delay={k * 250} won={e.winner === s} />
            <span className={`w-9 shrink-0 font-display text-sm font-bold tabular-nums ${e.winner === s ? 'text-hit' : 'text-ink-soft'}`}>⚡{s === 'a' ? e.pa : e.pd}</span>
          </div>
          <div className="pl-[4.5rem] sm:pl-[6.5rem]">
            <PartChips parts={parts[s]} />
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------- a sample duel, playing itself

interface SampleCard {
  rarity: Rarity;
  element: Element;
  parts: Part[];
  out?: boolean;
  tired?: boolean;
}
interface Frame {
  a: SampleCard;
  d: SampleCard;
  text: ReactNode;
  winner?: 'a' | 'd';
}

/** A short battle told in steps, with the game's own numbers (DEFENCE): edge, home, tiredness. */
function frames(): Frame[] {
  const P = DEFENCE.power;
  const home: Part = ['home', DEFENCE.home];
  const a1: SampleCard = { rarity: 'rare', element: 'water', parts: [['rarity', P.rare]] };
  const d1: SampleCard = { rarity: 'epic', element: 'fire', parts: [['rarity', P.epic], home] };
  const d2: SampleCard = { rarity: 'legendary', element: 'earth', parts: [['rarity', P.legendary], home] };
  const edged = (c: SampleCard): SampleCard => ({ ...c, parts: [...c.parts, ['edge', DEFENCE.edge]] });
  const tired: SampleCard = { ...a1, tired: true, parts: [...a1.parts, ['fatigue', -DEFENCE.fatigue]] };
  const sum = (c: SampleCard) => sumParts(c.parts);
  return [
    { a: a1, d: d1, text: <>The first card of each team meets. Power comes from the card&apos;s <b>rarity</b> (and grades). The defender gets <b>+{DEFENCE.home} at home</b>.</> },
    { a: edged(a1), d: d1, text: <>{elName('water')} beats {elName('fire')}: the Water card gets <b className="text-hit">+{DEFENCE.edge}</b> for this duel.</> },
    {
      a: edged(a1),
      d: { ...d1, out: true },
      winner: 'a',
      text: (
        <>
          ⚡{sum(edged(a1))} beats ⚡{sum(d1)}. The <b>higher power wins</b>. The Fire card is out.
        </>
      ),
    },
    { a: tired, d: d2, text: <>The winner <b>stays on the field</b>, but tired: <b className="text-coral">−{DEFENCE.fatigue}</b> for each duel it has won. The defence sends its next card.</> },
    { a: tired, d: edged(d2), text: <>{elName('earth')} beats {elName('water')}: +{DEFENCE.edge} for the Earth card.</> },
    {
      a: { ...tired, out: true },
      d: edged(d2),
      winner: 'd',
      text: (
        <>
          ⚡{sum(edged(d2))} beats ⚡{sum(tired)}: the Water card is out, and the attacker sends its next one. A team with <b>no card left loses</b>.
        </>
      ),
    },
  ];
}

function SampleTile({ c, side, won }: { c: SampleCard; side: 'a' | 'd'; won: boolean }) {
  return (
    <div className={`flex flex-col items-center gap-0.5 rounded-lg border p-2 transition-all duration-500 ${c.out ? 'scale-90 border-rule opacity-30 grayscale' : won ? 'border-hit bg-hit/10' : 'border-rule bg-card'}`}>
      <span className="text-[10px] font-bold uppercase tracking-widest text-ink-faint">{side === 'a' ? 'Attack' : 'Defence'}</span>
      <span className="text-3xl">{ELEMENT_INFO[c.element].icon}</span>
      <span className="text-xs font-bold">{RARITY_INFO[c.rarity].name}</span>
      {c.tired && <span className="text-xs">😮‍💨</span>}
    </div>
  );
}

/** The sample battle: plays by itself, step by step, again and again; ◀ ▶ to go at one's own pace. */
export function SampleDuel() {
  const list = frames();
  const [n, setN] = useState(0);
  const [auto, setAuto] = useState(true);
  useEffect(() => {
    if (!auto) return;
    const t = window.setTimeout(() => setN((k) => (k + 1) % list.length), n === list.length - 1 ? 4200 : 3000);
    return () => window.clearTimeout(t);
  }, [auto, n, list.length]);
  const f = list[n];
  const max = Math.max(...list.flatMap((x) => [sumParts(x.a.parts.filter(([, v]) => v > 0)), sumParts(x.d.parts.filter(([, v]) => v > 0))]));
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-[5rem_1fr] items-center gap-x-3 gap-y-2">
        {(['a', 'd'] as const).map((s) => (
          <div key={s} className="contents">
            <SampleTile c={f[s]} side={s} won={f.winner === s} />
            <div className="space-y-1">
              {/* A new card (or a new piece) grows its bar again. */}
              <div className="flex items-center gap-2">
                <PowerBar key={`${s}${f[s].rarity}`} parts={f[s].parts} max={max} won={f.winner === s} />
                <span className="w-9 font-display text-sm font-bold tabular-nums">⚡{sumParts(f[s].parts)}</span>
              </div>
              <PartChips parts={f[s].parts} />
            </div>
          </div>
        ))}
      </div>
      <p key={n} className="animate-round-in min-h-[3.5rem] rounded-md bg-tile p-2 text-sm">
        {f.text}
      </p>
      <div className="flex items-center justify-center gap-2 text-sm">
        <button type="button" onClick={() => (setAuto(false), setN((k) => (k + list.length - 1) % list.length))} className="btn-paper rounded-md px-3 py-1">
          ◀
        </button>
        <span className="flex gap-1">
          {list.map((_, k) => (
            <i key={k} className={`size-2 rounded-full ${k === n ? 'bg-accent' : 'bg-rule'}`} />
          ))}
        </span>
        <button type="button" onClick={() => (setAuto(false), setN((k) => (k + 1) % list.length))} className="btn-paper rounded-md px-3 py-1">
          ▶
        </button>
        <button type="button" onClick={() => setAuto((a) => !a)} className="btn-paper rounded-md px-3 py-1" aria-label={auto ? 'Pause' : 'Play'}>
          {auto ? '⏸' : '⏵'}
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- helpers for the animated scenes

/** A frame counter going round 0..n-1, each frame lasting `ms(k)`; it stands still while `paused`. */
function useLoop(n: number, ms: number | ((k: number) => number), paused = false) {
  const [k, setK] = useState(0);
  const wait = typeof ms === 'number' ? ms : ms(k);
  useEffect(() => {
    if (paused) return;
    const t = window.setTimeout(() => setK((x) => (x + 1) % n), wait);
    return () => window.clearTimeout(t);
  }, [k, n, wait, paused]);
  return [k, setK] as const;
}

/** A card in a diagram: its element (or another icon), its rarity's colour and gems, its power. */
function MiniCard({ el, rarity, power, big, state, badge, icon }: { el: Element; rarity: Rarity; power?: number; big?: boolean; state?: 'out' | 'win' | 'dim' | 'on'; badge?: ReactNode; icon?: string }) {
  return (
    <div
      className={`relative flex shrink-0 flex-col items-center justify-center rounded-lg border-2 bg-paper transition-all duration-500 ${big ? 'h-24 w-[4.5rem]' : 'h-14 w-11'} ${
        state === 'out' ? 'translate-y-3 scale-90 opacity-25 grayscale' : state === 'dim' ? 'opacity-40' : ''
      } ${state === 'win' ? 'ring-2 ring-hit ring-offset-2 ring-offset-card' : state === 'on' ? 'ring-2 ring-accent ring-offset-2 ring-offset-card' : ''}`}
      style={{ borderColor: RARITY_LIGHT[rarity], outline: '1px solid var(--color-rule)' }}
      title={`${RARITY_INFO[rarity].name} · ${ELEMENT_INFO[el].name}`}
    >
      <span className={big ? 'text-3xl' : 'text-xl'}>{icon ?? ELEMENT_INFO[el].icon}</span>
      <span className="text-[9px] leading-none text-ink-soft">{RARITY_INFO[rarity].gem}</span>
      {power !== undefined && <span className="absolute -bottom-2.5 rounded bg-ink px-1 text-[11px] font-bold tabular-nums text-paper">⚡{power}</span>}
      {badge}
    </div>
  );
}

/** A small label popping up over a card: "+6", "−2 tired", "💥 −4". */
function Badge({ children, tone = 'hit' }: { children: ReactNode; tone?: 'hit' | 'coral' | 'accent' }) {
  return (
    <span className="pointer-events-none absolute inset-x-0 -top-3.5 flex justify-center">
      <span className={`animate-pop whitespace-nowrap rounded-full px-1.5 text-[11px] font-bold text-paper ${tone === 'hit' ? 'bg-hit' : tone === 'coral' ? 'bg-coral' : 'bg-accent'}`}>{children}</span>
    </span>
  );
}

/** One explained idea: a title, its animated diagram, and a line for what the picture can't say. */
function Scene({ icon, title, caption, children, wide }: { icon: string; title: string; caption?: ReactNode; children: ReactNode; wide?: boolean }) {
  return (
    <figure className={`flex flex-col gap-3 overflow-hidden rounded-lg border border-rule bg-card p-3 ${wide ? 'lg:col-span-2' : ''}`}>
      <p className="font-display font-bold">
        {icon} {title}
      </p>
      <div className="flex min-h-[8rem] flex-1 items-center justify-center gap-3">{children}</div>
      {caption && <figcaption className="text-sm text-ink-soft">{caption}</figcaption>}
    </figure>
  );
}

const Arrow = ({ dir = '→', className = '' }: { dir?: string; className?: string }) => <span className={`font-display text-2xl font-black text-ink-faint ${className}`}>{dir}</span>;

// ---------------------------------------------------------------- elements: the circle, Light and Darkness, the table

const ORDER: Element[] = ['fire', 'air', 'earth', 'water', 'light', 'darkness'];

function ArrowMarkers({ id }: { id: string }) {
  return (
    <defs>
      {(['ink-soft', 'hit', 'coral'] as const).map((c) => (
        <marker key={c} id={`${id}-${c}`} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0,0 L10,5 L0,10 z" style={{ fill: `var(--color-${c})` }} />
        </marker>
      ))}
    </defs>
  );
}

function Node({ e, x, y, r = 28, ring = 'rule', above }: { e: Element; x: number; y: number; r?: number; ring?: string; above?: boolean }) {
  return (
    <g>
      <circle cx={x} cy={y} r={r} style={{ fill: 'var(--color-paper)', stroke: `var(--color-${ring})`, strokeWidth: 2.5 }} />
      <text x={x} y={y + 4} textAnchor="middle" fontSize="22">
        {ELEMENT_INFO[e].icon}
      </text>
      <text x={x} y={above ? y - r - 6 : y + r + 14} textAnchor="middle" fontSize="11" fontWeight="700" style={{ fill: 'var(--color-ink)' }}>
        {ELEMENT_INFO[e].name}
      </text>
    </g>
  );
}

/** The four basic elements round a circle, each beating the next; a spark runs round to show the way. */
function ElementCycle() {
  const [cx, cy, R] = [160, 150, 100];
  const at = (deg: number): [number, number] => [cx + R * Math.cos((deg * Math.PI) / 180), cy + R * Math.sin((deg * Math.PI) / 180)];
  const nodes: [Element, number][] = [
    ['fire', -90],
    ['air', 0],
    ['earth', 90],
    ['water', 180],
  ];
  return (
    <svg viewBox="0 0 320 300" className="w-full max-w-[20rem]" role="img" aria-label="Fire beats Air, Air beats Earth, Earth beats Water, Water beats Fire">
      <ArrowMarkers id="dd-cyc" />
      <circle cx={cx} cy={cy} r={R} fill="none" style={{ stroke: 'var(--color-rule)', strokeDasharray: '2 6' }} />
      {nodes.map(([e, deg], i) => {
        const [x1, y1] = at(deg + 22);
        const [x2, y2] = at(deg + 90 - 24);
        const [lx, ly] = [cx + (R + 22) * Math.cos(((deg + 45) * Math.PI) / 180), cy + (R + 22) * Math.sin(((deg + 45) * Math.PI) / 180)];
        return (
          <g key={e}>
            <path d={`M${x1},${y1} A${R},${R} 0 0 1 ${x2},${y2}`} fill="none" strokeWidth="3" style={{ stroke: 'var(--color-hit)' }} markerEnd="url(#dd-cyc-hit)" />
            <text x={lx} y={ly + 4} textAnchor="middle" fontSize="11" fontWeight="700" style={{ fill: 'var(--color-hit)' }}>
              beats
            </text>
            <title>{`${ELEMENT_INFO[e].name} beats ${ELEMENT_INFO[nodes[(i + 1) % 4][0]].name}`}</title>
          </g>
        );
      })}
      <circle r="6" style={{ fill: 'var(--color-ochre)' }}>
        <animateMotion dur="6s" repeatCount="indefinite" path={`M${cx},${cy - R} A${R},${R} 0 0 1 ${cx},${cy + R} A${R},${R} 0 0 1 ${cx},${cy - R}`} />
      </circle>
      {nodes.map(([e, deg]) => {
        const [x, y] = at(deg);
        return <Node key={e} e={e} x={x} y={y - 6} />;
      })}
      <text x={cx} y={cy - 4} textAnchor="middle" fontSize="34" style={{ fill: 'var(--color-ink-faint)' }}>
        ↻
      </text>
      <text x={cx} y={cy + 18} textAnchor="middle" fontSize="11" style={{ fill: 'var(--color-ink-soft)' }}>
        each beats the next
      </text>
    </svg>
  );
}

/** Light in the middle: it beats Fire, Air and Darkness; Earth and Water beat it. Darkness falls only to Light. */
function LightAndDark() {
  const P: Record<'light' | 'darkness' | 'fire' | 'air' | 'earth' | 'water', [number, number]> = {
    light: [160, 108],
    fire: [272, 45],
    air: [272, 160],
    earth: [48, 45],
    water: [48, 160],
    darkness: [160, 228],
  };
  const r = 26;
  const line = (a: Element, b: Element) => {
    const [x1, y1] = P[a];
    const [x2, y2] = P[b];
    const d = Math.hypot(x2 - x1, y2 - y1);
    const [ux, uy] = [(x2 - x1) / d, (y2 - y1) / d];
    return `M${x1 + ux * (r + 2)},${y1 + uy * (r + 2)} L${x2 - ux * (r + 6)},${y2 - uy * (r + 6)}`;
  };
  const arrows: [Element, Element, 'hit' | 'coral'][] = [
    ['light', 'fire', 'hit'],
    ['light', 'air', 'hit'],
    ['light', 'darkness', 'hit'],
    ['earth', 'light', 'coral'],
    ['water', 'light', 'coral'],
  ];
  return (
    <svg viewBox="0 0 320 275" className="w-full max-w-[20rem]" role="img" aria-label="Light beats Fire, Air and Darkness; Earth and Water beat Light; Darkness falls only to Light">
      <ArrowMarkers id="dd-ld" />
      {arrows.map(([a, b, tone], i) => (
        <g key={`${a}${b}`}>
          <path d={line(a, b)} fill="none" strokeWidth="3" style={{ stroke: `var(--color-${tone})` }} markerEnd={`url(#dd-ld-${tone})`} />
          <circle r="4.5" style={{ fill: `var(--color-${tone})` }}>
            <animateMotion dur="1.6s" begin={`${i * 0.3}s`} repeatCount="indefinite" path={line(a, b)} />
          </circle>
        </g>
      ))}
      {(Object.keys(P) as Element[]).map((e) => (
        <Node key={e} e={e} x={P[e as keyof typeof P][0]} y={P[e as keyof typeof P][1]} r={r} ring={e === 'light' ? 'ochre' : e === 'darkness' ? 'plum' : 'rule'} above={e === 'light'} />
      ))}
    </svg>
  );
}

/** Every match-up at a glance: your element down the side, theirs along the top. */
function MatchupGrid() {
  const [row, setRow] = useState<Element | null>(null);
  const [k] = useLoop(ORDER.length, 1700, row !== null);
  const on = row ?? ORDER[k];
  const wins = ORDER.filter((y) => beats(on, y));
  const loses = ORDER.filter((y) => beats(y, on));
  return (
    <div className="w-full space-y-2">
      <table className="mx-auto border-separate border-spacing-1 text-center" onMouseLeave={() => setRow(null)}>
        <thead>
          <tr>
            <th className="text-[10px] font-normal leading-tight text-ink-faint">
              you ↓<br />
              them →
            </th>
            {ORDER.map((e) => (
              <th key={e} className={`text-xl transition-opacity ${wins.includes(e) || loses.includes(e) ? '' : 'opacity-40'}`} title={ELEMENT_INFO[e].name}>
                {ELEMENT_INFO[e].icon}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {ORDER.map((r) => (
            <tr key={r} onClick={() => setRow(row === r ? null : r)} onMouseEnter={() => setRow(r)} className="cursor-pointer">
              <th className={`rounded text-xl transition-colors ${r === on ? 'bg-accent/25' : ''}`} title={ELEMENT_INFO[r].name}>
                {ELEMENT_INFO[r].icon}
              </th>
              {ORDER.map((c) => {
                const w = beats(r, c);
                const l = beats(c, r);
                return (
                  <td
                    key={c}
                    className={`size-9 rounded text-xs font-bold transition sm:size-10 sm:text-sm ${w ? 'bg-hit/35 text-hit' : l ? 'bg-coral/30 text-coral' : 'bg-tile text-ink-faint'} ${r === on ? 'scale-105' : 'opacity-45'}`}
                  >
                    {w ? `+${DEFENCE.edge}` : l ? '✗' : '·'}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <p key={on} className="animate-pop text-center text-sm">
        <b>{elName(on)}</b>: <span className="font-bold text-hit">beats</span> {wins.length ? wins.map(elName).join(', ') : 'nobody'} · <span className="font-bold text-coral">falls to</span>{' '}
        {loses.length ? loses.map(elName).join(', ') : 'nobody'}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------- the team, and a whole battle

const SLOT_COLOURS = ['bg-plum', 'bg-accent', 'bg-ochre', 'bg-rose', 'bg-lv2'];
const SAMPLE_TEAM: { el: Element; rarity: Rarity }[] = [
  { el: 'fire', rarity: 'epic' },
  { el: 'light', rarity: 'legendary' },
  { el: 'water', rarity: 'rare' },
  { el: 'earth', rarity: 'rare' },
  { el: 'air', rarity: 'epic' },
];

/** Five cards dropping into their places, each paying its points out of the budget; what's left over lifts them all. */
function TeamScene() {
  const [k] = useLoop(SAMPLE_TEAM.length + 1, (n) => (n === SAMPLE_TEAM.length ? 3500 : 900));
  const n = k;
  const costs = SAMPLE_TEAM.map((c) => DEFENCE.cost[c.rarity]);
  const paidBy = costs.flatMap((c, i) => Array.from({ length: c }, () => i));
  const spent = costs.slice(0, n).reduce((s, c) => s + c, 0);
  const left = DEFENCE.budget - spent;
  const ORD = ['1st', '2nd', '3rd', '4th', '5th'];
  return (
    <div className="w-full space-y-4">
      <div className="flex items-end justify-center gap-1.5 sm:gap-3">
        {SAMPLE_TEAM.map((c, i) => (
          <div key={i} className="flex flex-col items-center gap-1.5">
            <span className={`text-[10px] font-bold uppercase ${i === 0 ? 'text-accent' : 'text-ink-faint'}`}>{i === 0 ? '1st ⚔️' : ORD[i]}</span>
            {i < n ? (
              <div className="animate-pop">
                <MiniCard {...c} />
              </div>
            ) : (
              <div className="h-14 w-11 rounded-lg border-2 border-dashed border-rule" />
            )}
            <span className={`rounded px-1 text-[11px] font-bold ${i < n ? `${SLOT_COLOURS[i]} text-paper` : 'text-transparent'}`}>{costs[i]} pts</span>
          </div>
        ))}
      </div>
      <div>
        <div className="flex gap-0.5">
          {Array.from({ length: DEFENCE.budget }, (_, p) => (
            <span key={p} className={`h-4 flex-1 rounded-sm transition-colors duration-300 ${p < spent ? SLOT_COLOURS[paidBy[p]] : 'bg-tile'}`} />
          ))}
        </div>
        <p className="mt-1 flex justify-between text-xs text-ink-soft">
          <span>
            {spent} / {DEFENCE.budget} points spent
          </span>
          {n === SAMPLE_TEAM.length && (
            <span className="animate-pop font-bold text-hit">
              {left} left → +{DEFENCE.spare * Math.floor(left / 2)} power to every card
            </span>
          )}
        </p>
      </div>
    </div>
  );
}

interface BCard {
  el: Element;
  rarity: Rarity;
}
interface BFrame {
  a: number;
  d: number;
  pa: number;
  pd: number;
  outA: number[];
  outD: number[];
  win?: Side | 'both';
  badgeA?: ReactNode;
  badgeD?: ReactNode;
  text: ReactNode;
}
const B_ATTACK: BCard[] = [
  { el: 'water', rarity: 'epic' },
  { el: 'fire', rarity: 'rare' },
  { el: 'earth', rarity: 'legendary' },
];
const B_DEFENCE: BCard[] = [
  { el: 'fire', rarity: 'epic' },
  { el: 'air', rarity: 'rare' },
  { el: 'earth', rarity: 'epic' },
];

/** A short battle played out with the game's own rules (edge, home, tiredness, ties), frame by frame. */
function battleFrames(): BFrame[] {
  const teams: Record<Side, BCard[]> = { a: B_ATTACK, d: B_DEFENCE };
  const queue: Record<Side, number[]> = { a: [0, 1, 2], d: [0, 1, 2] };
  const out: Record<Side, number[]> = { a: [], d: [] };
  const field: Record<Side, { i: number; wins: number } | null> = { a: null, d: null };
  const frames: BFrame[] = [];
  const team = (s: Side) => (s === 'a' ? 'attack' : 'defence');
  let last: Pick<BFrame, 'a' | 'd' | 'pa' | 'pd'> = { a: 0, d: 0, pa: 0, pd: 0 };
  for (let guard = 0; guard < 12; guard++) {
    const entered: Side[] = [];
    for (const s of ['a', 'd'] as Side[]) {
      if (!field[s] && queue[s].length) {
        field[s] = { i: queue[s].shift()!, wins: 0 };
        entered.push(s);
      }
    }
    const fa = field.a;
    const fd = field.d;
    if (!fa || !fd) break;
    const ca = teams.a[fa.i];
    const cd = teams.d[fd.i];
    let pa = DEFENCE.power[ca.rarity] - DEFENCE.fatigue * fa.wins;
    let pd = DEFENCE.power[cd.rarity] + DEFENCE.home - DEFENCE.fatigue * fd.wins;
    const tired = (f: { wins: number }) => (f.wins ? <Badge tone="coral">−{DEFENCE.fatigue * f.wins} tired</Badge> : null);
    const base = { a: fa.i, d: fd.i, outA: [...out.a], outD: [...out.d] };
    const stayer = entered.length === 1 ? (entered[0] === 'a' ? 'd' : 'a') : null;
    frames.push({
      ...base,
      pa,
      pd,
      badgeA: tired(fa),
      badgeD: tired(fd) ?? (frames.length === 0 ? <Badge tone="accent">+{DEFENCE.home} home</Badge> : null),
      text:
        frames.length === 0 ? (
          <>
            The <b>first card</b> of each team steps in. The defender gets <b>+{DEFENCE.home} at home</b>.
          </>
        ) : stayer ? (
          <>
            The {team(entered[0])} sends its <b>next card</b>. The {team(stayer)}&apos;s card <b>stays</b>, but tired: <b className="text-coral">−{DEFENCE.fatigue}</b> for each duel it has won.
          </>
        ) : (
          <>Both teams send their next card.</>
        ),
    });
    const edge: Side | null = beats(ca.el, cd.el) ? 'a' : beats(cd.el, ca.el) ? 'd' : null;
    if (edge === 'a') pa += DEFENCE.edge;
    if (edge === 'd') pd += DEFENCE.edge;
    const [we, le] = edge === 'a' ? [ca.el, cd.el] : [cd.el, ca.el];
    frames.push({
      ...base,
      pa,
      pd,
      badgeA: edge === 'a' ? <Badge>+{DEFENCE.edge} edge</Badge> : null,
      badgeD: edge === 'd' ? <Badge>+{DEFENCE.edge} edge</Badge> : null,
      text: edge ? (
        <>
          {elName(we)} beats {elName(le)}: <b className="text-hit">+{DEFENCE.edge}</b> for this duel.
        </>
      ) : (
        <>
          {elName(ca.el)} against {elName(cd.el)}: <b>no edge</b>, only power counts.
        </>
      ),
    });
    const win: Side | 'both' = pa > pd ? 'a' : pd > pa ? 'd' : 'both';
    if (win !== 'a') (out.a.push(fa.i), (field.a = null));
    else fa.wins++;
    if (win !== 'd') (out.d.push(fd.i), (field.d = null));
    else fd.wins++;
    last = { a: fa.i, d: fd.i, pa, pd };
    frames.push({
      ...last,
      outA: [...out.a],
      outD: [...out.d],
      win,
      text:
        win === 'both' ? (
          <>
            ⚡{pa} against ⚡{pd}: <b>equal power, both are out</b>.
          </>
        ) : (
          <>
            ⚡{Math.max(pa, pd)} beats ⚡{Math.min(pa, pd)}: the <b>higher power wins</b>. The {team(win === 'a' ? 'd' : 'a')}&apos;s card is out.
          </>
        ),
    });
  }
  const winner: Side = queue.a.length || field.a ? 'a' : 'd';
  frames.push({
    ...last,
    outA: [...out.a],
    outD: [...out.d],
    win: winner,
    text: (
      <>
        🏁 The {team(winner === 'a' ? 'd' : 'a')} has <b>no card left</b>: the {team(winner)} wins!
      </>
    ),
  });
  return frames;
}

/** The whole battle: both teams in line, their front cards duelling in the middle. */
function BattleScene() {
  const frames = battleFrames();
  const [paused, setPaused] = useState(false);
  const [k, setK] = useLoop(frames.length, (n) => (n === frames.length - 1 ? 4500 : 2600), paused);
  const f = frames[k];
  const lineUp = (s: Side) => {
    const team = s === 'a' ? B_ATTACK : B_DEFENCE;
    const out = s === 'a' ? f.outA : f.outD;
    const on = s === 'a' ? f.a : f.d;
    return (
      <div className="flex items-center justify-center gap-2">
        <span className="w-16 text-right text-[10px] font-bold uppercase tracking-widest text-ink-faint">{s === 'a' ? 'Attack' : 'Defence'}</span>
        {team.map((c, i) => (
          <span key={i} className="relative flex flex-col items-center gap-0.5">
            <MiniCard {...c} state={out.includes(i) ? 'out' : i === on ? 'on' : undefined} />
            {out.includes(i) && <span className="absolute inset-x-0 top-0 flex h-14 items-center justify-center text-2xl font-black text-coral">✗</span>}
            <span className="text-[10px] font-bold text-ink-faint">{i + 1}</span>
          </span>
        ))}
        <span className="w-16" />
      </div>
    );
  };
  const fighter = (s: Side) => {
    const team = s === 'a' ? B_ATTACK : B_DEFENCE;
    const i = s === 'a' ? f.a : f.d;
    const out = (s === 'a' ? f.outA : f.outD).includes(i) && f.win !== undefined;
    return (
      <div key={`${s}${i}`} className="animate-round-in">
        <MiniCard {...team[i]} big power={s === 'a' ? f.pa : f.pd} state={out ? 'out' : f.win === s ? 'win' : undefined} badge={s === 'a' ? f.badgeA : f.badgeD} />
      </div>
    );
  };
  return (
    <div className="w-full space-y-4">
      {lineUp('a')}
      <div className="flex items-center justify-center gap-4 rounded-lg bg-tile/60 py-5">
        {fighter('a')}
        <span className={`font-display text-2xl font-black ${f.win ? 'text-ink-faint' : 'animate-pulse text-coral'}`}>VS</span>
        {fighter('d')}
      </div>
      {lineUp('d')}
      <p key={k} className="animate-round-in min-h-[3.5rem] rounded-md bg-tile p-2 text-sm">
        {f.text}
      </p>
      <div className="flex items-center justify-center gap-2 text-sm">
        <button type="button" onClick={() => (setPaused(true), setK((x) => (x + frames.length - 1) % frames.length))} className="btn-paper rounded-md px-3 py-1" aria-label="Back">
          ◀
        </button>
        <span className="flex gap-1">
          {frames.map((_, n) => (
            <i key={n} className={`size-1.5 rounded-full ${n === k ? 'bg-accent' : 'bg-rule'}`} />
          ))}
        </span>
        <button type="button" onClick={() => (setPaused(true), setK((x) => (x + 1) % frames.length))} className="btn-paper rounded-md px-3 py-1" aria-label="Next">
          ▶
        </button>
        <button type="button" onClick={() => setPaused((p) => !p)} className="btn-paper rounded-md px-3 py-1" aria-label={paused ? 'Play' : 'Pause'}>
          {paused ? '⏵' : '⏸'}
        </button>
      </div>
    </div>
  );
}

/** Both teams out in the same duel: the cheaper team wins; the same cost, the defence. */
function BothOutScene() {
  const [k] = useLoop(2, 2600);
  const [ca, cd] = k === 0 ? [15, 18] : [17, 17];
  const winner = ca < cd ? 'a' : ca > cd ? 'd' : 'd';
  const box = (s: Side, cost: number) => (
    <div className={`flex flex-col items-center gap-1 rounded-lg border-2 p-2 transition-colors duration-500 ${winner === s ? 'border-hit bg-hit/10' : 'border-rule'}`}>
      <span className="text-[10px] font-bold uppercase tracking-widest text-ink-faint">{s === 'a' ? 'Attack' : 'Defence'}</span>
      <span className="flex gap-0.5 text-sm text-coral">✗✗✗✗✗</span>
      <span className="text-sm">
        cost <b>{cost}</b>
      </span>
      <span className={`h-5 text-lg ${winner === s ? 'animate-pop' : 'opacity-0'}`}>🏆</span>
    </div>
  );
  return (
    <div key={k} className="flex items-center gap-3">
      {box('a', ca)}
      <span className="text-center text-xs text-ink-soft">{ca === cd ? 'same cost' : `${Math.min(ca, cd)} < ${Math.max(ca, cd)}`}</span>
      {box('d', cd)}
    </div>
  );
}

// ---------------------------------------------------------------- power

/** What each rarity brings, and what it costs: the stronger, the pricier. */
function RarityLadder() {
  const on = useMounted();
  const top = DEFENCE.power.omni;
  return (
    <div className="w-full space-y-1.5">
      {RARITIES.map((r, i) => (
        <div key={r} className="flex items-center gap-2 text-sm">
          <span className="w-20 shrink-0 text-right font-bold">{RARITY_INFO[r].name}</span>
          <span className="h-4 flex-1 overflow-hidden rounded-sm bg-tile">
            <span className="block h-full rounded-sm bg-plum transition-[width] duration-700 ease-out" style={{ width: on ? `${(100 * DEFENCE.power[r]) / top}%` : '0%', transitionDelay: `${i * 120}ms` }} />
          </span>
          <span className="w-9 shrink-0 font-display font-bold tabular-nums">⚡{DEFENCE.power[r]}</span>
          <span className="w-24 shrink-0 text-xs text-ink-soft" title={`${DEFENCE.cost[r]} points`}>
            {'●'.repeat(DEFENCE.cost[r])} {DEFENCE.cost[r]} pt{DEFENCE.cost[r] > 1 ? 's' : ''}
          </span>
        </div>
      ))}
    </div>
  );
}

/** One card's power, built piece by piece: each piece grows onto the bar as its line lights up. */
function PowerBuilder() {
  const steps: { part: Part; text: ReactNode }[] = [
    { part: ['rarity', DEFENCE.power.epic], text: <>Its rarity: an Epic starts at {DEFENCE.power.epic}.</> },
    { part: ['grade', 2 * DEFENCE.perGrade], text: <>Grades: +{DEFENCE.perGrade} for every two grades above the first (this one is grade 5).</> },
    { part: ['crew', DEFENCE.crew], text: <>Crew: {DEFENCE.crewSize} or more cards of one franchise in the team, +{DEFENCE.crew} each.</> },
    { part: ['home', DEFENCE.home], text: <>At home: a defending card gets +{DEFENCE.home}.</> },
    { part: ['edge', DEFENCE.edge], text: <>Element edge: +{DEFENCE.edge} against an element it beats, for that duel only.</> },
    { part: ['fatigue', -DEFENCE.fatigue], text: <>Tired: −{DEFENCE.fatigue} for each duel it has already won.</> },
  ];
  const [k] = useLoop(steps.length + 1, (n) => (n === steps.length ? 3500 : 1400));
  const shown = steps.slice(0, Math.max(1, Math.min(k + 1, steps.length))).map((s) => s.part);
  const max = sumParts(steps.filter((s) => s.part[1] > 0).map((s) => s.part));
  return (
    <div className="w-full space-y-3">
      <div className="flex items-center gap-3">
        <MiniCard el="fire" rarity="epic" />
        <div className="flex-1">
          <PowerBar key={k === 0 ? 'start' : 'run'} parts={shown} max={max} />
        </div>
        <span className="w-10 font-display text-lg font-bold tabular-nums">⚡{sumParts(shown)}</span>
      </div>
      <ol className="space-y-1 text-sm">
        {steps.map((s, i) => (
          <li key={i} className={`flex items-start gap-2 transition-opacity duration-300 ${i < shown.length ? '' : 'opacity-30'} ${i === shown.length - 1 && k < steps.length ? 'font-bold' : ''}`}>
            <i className={`mt-1 inline-block size-3 shrink-0 rounded-sm ${PART_INFO[s.part[0]].bar}`} />
            <span className={s.part[1] < 0 ? 'text-coral' : ''}>
              {s.part[1] > 0 ? '+' : '−'}
              {Math.abs(s.part[1])}
            </span>
            <span className="text-ink-soft">{s.text}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

// ---------------------------------------------------------------- special cards

/** A technique strikes the card it meets as it arrives. */
function TechniqueScene() {
  const [k] = useLoop(3, (n) => (n === 2 ? 2400 : 1300));
  const hit = DEFENCE.techniqueHit;
  const foe = DEFENCE.power.rare;
  return (
    <>
      <div className={`transition-all duration-500 ${k === 0 ? '-translate-x-6 opacity-0' : ''}`}>
        <MiniCard el="fire" rarity="rare" icon="🥋" power={DEFENCE.power.rare - DEFENCE.kindMalus} />
      </div>
      <Arrow />
      <MiniCard el="earth" rarity="rare" power={k > 0 ? foe - hit : foe} badge={k > 0 ? <Badge tone="coral">💥 −{hit}</Badge> : null} />
    </>
  );
}

/** A place, once out, lifts every card after it. */
function PlaceScene() {
  const [k] = useLoop(3, (n) => (n === 2 ? 2400 : 1300));
  return (
    <>
      <MiniCard el="earth" rarity="rare" icon="🏰" state={k > 0 ? 'out' : undefined} />
      <Arrow />
      {(['water', 'air'] as Element[]).map((e) => (
        <MiniCard key={e} el={e} rarity="epic" power={DEFENCE.power.epic + (k === 2 ? DEFENCE.placeLift : 0)} badge={k === 2 ? <Badge>+{DEFENCE.placeLift}</Badge> : null} />
      ))}
    </>
  );
}

/** Inverted turns the element's edge over. */
function InvertedScene() {
  const [k] = useLoop(2, 2200);
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="flex items-center gap-3">
        <MiniCard el="water" rarity="epic" badge={k === 0 ? <Badge>+{DEFENCE.edge}</Badge> : null} />
        <Arrow dir={k === 0 ? '⟶' : '⟵'} className={k === 1 ? 'text-coral' : 'text-hit'} />
        <MiniCard el="fire" rarity="epic" badge={k === 1 ? <Badge>+{DEFENCE.edge}</Badge> : null} />
      </div>
      <span className="text-xs font-bold text-ink-soft">{k === 0 ? 'Normally: Water has the edge' : `${ANOMALIES.inverted.icon} An Inverted card in the duel: Fire has it`}</span>
    </div>
  );
}

/** Mirror takes the element of the card it meets. */
function MirrorScene() {
  const [k] = useLoop(2, 1800);
  return (
    <>
      <MiniCard el={k === 0 ? 'air' : 'fire'} rarity="epic" badge={<Badge tone="accent">{ANOMALIES.mirror.icon}</Badge>} />
      <Arrow dir="⇋" className={k === 1 ? 'text-accent' : ''} />
      <MiniCard el="fire" rarity="epic" />
    </>
  );
}

/** Corrupted takes a random element every duel. */
function CorruptedScene() {
  const [k] = useLoop(ORDER.length, 700);
  return <MiniCard el={ORDER[(k * 5) % ORDER.length]} rarity="rare" big badge={<Badge tone="accent">{ANOMALIES.corrupted.icon}</Badge>} />;
}

/** Time-Lost slips to the back of its team instead of falling, a little weaker. */
function TimeLostScene() {
  const [k] = useLoop(3, (n) => (n === 2 ? 2400 : 1300));
  const others: BCard[] = [
    { el: 'air', rarity: 'rare' },
    { el: 'earth', rarity: 'epic' },
  ];
  const lost = (
    <MiniCard
      el="water"
      rarity="legendary"
      power={DEFENCE.power.legendary - (k === 2 ? DEFENCE.timelost : 0)}
      state={k === 1 ? 'dim' : undefined}
      badge={k === 1 ? <Badge tone="coral">lost the duel</Badge> : k === 2 ? <Badge tone="coral">−{DEFENCE.timelost}</Badge> : <Badge tone="accent">{ANOMALIES.timelost.icon}</Badge>}
    />
  );
  return (
    <div className="flex items-center gap-2">
      {k < 2 && <div key="front">{lost}</div>}
      {others.map((c, i) => (
        <MiniCard key={i} {...c} />
      ))}
      {k === 2 && (
        <div key="back" className="animate-round-in">
          {lost}
        </div>
      )}
    </div>
  );
}

/** What an attacker sees, against what the card is: Void-Touched and Fake Rarity. */
function DisguiseScene({ kind }: { kind: 'void' | 'fake' }) {
  const [k] = useLoop(2, 1800);
  const seen = kind === 'void' ? <MiniCard el="fire" rarity="epic" icon="❔" /> : <MiniCard el="air" rarity="mythic" />;
  const real = kind === 'void' ? <MiniCard el="fire" rarity="epic" /> : <MiniCard el="air" rarity="common" />;
  return (
    <div className="flex items-center gap-4">
      <div className={`flex flex-col items-center gap-1 transition-opacity duration-500 ${k === 0 ? '' : 'opacity-40'}`}>
        {seen}
        <span className="mt-1 text-[11px] font-bold text-ink-soft">{kind === 'void' ? 'attackers see' : 'others see'}</span>
      </div>
      <div className={`flex flex-col items-center gap-1 transition-opacity duration-500 ${k === 1 ? '' : 'opacity-40'}`}>
        {real}
        <span className="mt-1 text-[11px] font-bold text-ink-soft">it really is</span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- the rules panel

type Tab = 'team' | 'battle' | 'elements' | 'power' | 'special';
const TABS: [Tab, string][] = [
  ['team', '🃏 Team'],
  ['battle', '⚔️ Battle'],
  ['elements', '🔥 Elements'],
  ['power', '⚡ Power'],
  ['special', '✨ Special cards'],
];
const OPEN_KEY = 'omnidle:defence-rules-open';

/** How a battle works: five chapters, each shown with animated diagrams, with a few words where a picture can't say it. */
export function DefenceRules({ arena }: { arena: Arena }) {
  const [open, setOpen] = useState(() => {
    try {
      return localStorage.getItem(OPEN_KEY) !== '0';
    } catch {
      return true;
    }
  });
  const toggle = () =>
    setOpen((o) => {
      try {
        localStorage.setItem(OPEN_KEY, o ? '0' : '1');
      } catch {
        // No storage (a private window): it just won't be remembered.
      }
      return !o;
    });
  const [tab, setTab] = useState<Tab>('battle');
  return (
    <div className="rounded-lg border border-rule">
      <button type="button" onClick={toggle} aria-expanded={open} className="flex w-full items-center justify-between gap-2 p-3 text-left font-display text-lg font-bold">
        <span>📖 How a battle works</span>
        <span className={`transition-transform ${open ? 'rotate-180' : ''}`}>▾</span>
      </button>
      {open && (
        <div className="space-y-3 border-t border-rule p-3">
          <div className="grid grid-cols-3 gap-1 rounded-lg bg-tile p-1 sm:grid-cols-5">
            {TABS.map(([t, label]) => (
              <button key={t} type="button" onClick={() => setTab(t)} aria-pressed={tab === t} className={`rounded-md px-2 py-1.5 font-display text-sm font-bold ${tab === t ? 'bg-paper shadow' : 'text-ink-soft'}`}>
                {label}
              </button>
            ))}
          </div>

          {tab === 'team' && (
            <div className="grid gap-3 lg:grid-cols-2">
              <Scene icon="🃏" title={`${DEFENCE.size} cards, ${DEFENCE.budget} points`} wide caption={<>Each card costs points by its rarity (see ⚡ Power). The 1st card fights first, then the 2nd, and so on: the order is yours to choose.</>}>
                <TeamScene />
              </Scene>
              <Scene icon="🛡️" title="Your defence" caption={<>It stays up for your friends to attack, and you can change it once a day. Each attack it holds off pays you {DEFENCE.held} DleCoins.</>}>
                <div className="flex items-center gap-2">
                  {SAMPLE_TEAM.map((c, i) => (
                    <MiniCard key={i} {...c} />
                  ))}
                </div>
              </Scene>
              <Scene icon="🔍" title="What an attacker sees" caption={<>Only your elements, sorted: not which cards, not their order. They find that out in the fight. {DEFENCE.attacksPerDay} attacks a day, each friend once; a win pays {DEFENCE.win} DleCoins.</>}>
                <div className="flex items-center gap-1.5 text-2xl">
                  {[...SAMPLE_TEAM]
                    .map((c) => c.el)
                    .sort()
                    .map((e, i) => (
                      <span key={i} className="flex size-10 items-center justify-center rounded-full border-2 border-dashed border-rule">
                        {ELEMENT_INFO[e].icon}
                      </span>
                    ))}
                </div>
              </Scene>
            </div>
          )}

          {tab === 'battle' && (
            <div className="grid gap-3 lg:grid-cols-2">
              <Scene icon="⚔️" title="A battle, duel by duel" wide caption={<>The front cards duel. The loser is out; <b>the winner stays on the field</b> and meets the next card, a little tired. A real team has {DEFENCE.size} cards; this one has 3 to keep it short.</>}>
                <BattleScene />
              </Scene>
              <Scene icon="📊" title="Inside a duel: the power bars" wide caption={<>The same bars show in every battle you watch: each colour is one piece of the card&apos;s power, and red stripes are what it lost.</>}>
                <SampleDuel />
              </Scene>
              <Scene icon="🏁" title="Both teams out at once" caption={<>If the last cards knock each other out, the <b>cheaper team</b> wins. The same cost: the defence holds.</>}>
                <BothOutScene />
              </Scene>
              <Scene icon="🟰" title="Equal power" caption={<>Two cards with the same power in a duel are <b>both out</b>.</>}>
                <MiniCard el="water" rarity="epic" power={14} state="out" />
                <span className="font-display text-xl font-black text-ink-faint">=</span>
                <MiniCard el="air" rarity="rare" power={14} state="out" />
              </Scene>
            </div>
          )}

          {tab === 'elements' && (
            <div className="grid gap-3 lg:grid-cols-2">
              <Scene icon="↻" title="The four basic elements" caption={<>Each beats the next one round the circle and falls to the one before. None is the strongest.</>}>
                <ElementCycle />
              </Scene>
              <Scene
                icon="☀️"
                title="Light and Darkness"
                caption={
                  <>
                    <span className="font-bold text-hit">Green</span>: Light beats Fire, Air and Darkness. <span className="font-bold text-coral">Red</span>: Earth and Water beat Light. Darkness beats nobody, but only Light beats it. Some Legendaries,
                    Mythics and Omnis are born Light or Darkness; any card taken to grade {ELEMENT_GRADE} can pick its element.
                  </>
                }
              >
                <LightAndDark />
              </Scene>
              <Scene
                icon="📋"
                title="Every match-up"
                wide
                caption={
                  <>
                    Find your element on the left and theirs along the top. <span className="font-bold text-hit">+{DEFENCE.edge}</span>: your card gets +{DEFENCE.edge} power for that duel. <span className="font-bold text-coral">✗</span>: theirs does. ·: no
                    edge. The edge helps a lot but <b>isn&apos;t a sure win</b>: a much stronger card can still beat it. On Eclipse days, every basic element beats Darkness.
                  </>
                }
              >
                <MatchupGrid />
              </Scene>
            </div>
          )}

          {tab === 'power' && (
            <div className="grid gap-3 lg:grid-cols-2">
              <Scene icon="🃏" title="Rarity: power and cost" caption={<>The higher power wins a duel. Stronger cards cost more of your {DEFENCE.budget} points.</>}>
                <RarityLadder />
              </Scene>
              <Scene icon="⚡" title="A card's power, piece by piece" caption={<>Every piece shows as a colour on the battle&apos;s power bars.</>}>
                <PowerBuilder />
              </Scene>
              <Scene icon={PART_INFO.spare.icon} title="Points left unspent" caption={<>Every 2 points of the budget you don&apos;t use give +{DEFENCE.spare} power to every card of the team: a cheaper team is a little stronger card for card.</>}>
                <div className="flex gap-0.5">
                  {Array.from({ length: DEFENCE.budget }, (_, p) => (
                    <span key={p} className={`h-4 w-3 rounded-sm ${p < DEFENCE.budget - 4 ? 'bg-accent' : 'animate-pulse bg-lv0'}`} />
                  ))}
                </div>
                <span className="font-bold text-hit">4 left → +{2 * DEFENCE.spare}</span>
              </Scene>
              <Scene icon={arena.icon} title={`Today's arena: ${arena.name}`} caption={<>Each day an arena rule changes something for everyone, attackers and defenders alike. A new one tomorrow.</>}>
                <p className="text-center font-display text-lg font-bold">{arena.text}</p>
              </Scene>
            </div>
          )}

          {tab === 'special' && (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <Scene icon="🥋" title="Technique" caption={<>Weaker than a character (−{DEFENCE.kindMalus} power), but it hits the card it meets as it arrives: −{DEFENCE.techniqueHit} for that duel.</>}>
                <TechniqueScene />
              </Scene>
              <Scene icon="🏰" title="Place" caption={<>Weaker than a character (−{DEFENCE.kindMalus} power), but once it&apos;s out, every card after it gets +{DEFENCE.placeLift}.</>}>
                <PlaceScene />
              </Scene>
              <Scene icon={ANOMALIES.inverted.icon} title="Inverted" caption={<>In its duels, the element&apos;s edge goes to the other card. Two Inverted cards cancel out.</>}>
                <InvertedScene />
              </Scene>
              <Scene icon={ANOMALIES.mirror.icon} title="Mirror" caption={<>Takes the element of the card it meets, so neither has an edge.</>}>
                <MirrorScene />
              </Scene>
              <Scene icon={ANOMALIES.corrupted.icon} title="Corrupted" caption={<>A random element in every duel: a gamble.</>}>
                <CorruptedScene />
              </Scene>
              <Scene icon={ANOMALIES.timelost.icon} title="Time-Lost" caption={<>The first time it loses, it slips to the back of its team instead of falling, −{DEFENCE.timelost} power.</>}>
                <TimeLostScene />
              </Scene>
              <Scene icon={ANOMALIES.void.icon} title="Void-Touched" caption={<>Its element is hidden from attackers scouting your defence.</>}>
                <DisguiseScene kind="void" />
              </Scene>
              <Scene icon={ANOMALIES.fake.icon} title="Fake Rarity" caption={<>Looks like a Mythic to other players, whatever it really is.</>}>
                <DisguiseScene kind="fake" />
              </Scene>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
