// The Defence Deck's rules, shown rather than told (src/friends/defence.ts): a duel that plays itself, the element
// wheel, and short tiles for what makes a card's power; and the power bar every duel of a battle is drawn with, so
// the player sees why a card won (its rarity, grades, the element's edge, home, tiredness…).
import { useEffect, useState, type ReactNode } from 'react';
import { ANOMALIES } from '../gacha/anomalies';
import { RARITIES, RARITY_INFO } from '../gacha/cards';
import { BASIC, beats, DEFENCE, sumParts, type Arena, type BattleEvent, type Element, type Part, type PartKey, type Rarity } from './defence';
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

// ---------------------------------------------------------------- the element wheel

const NODE: Record<Element, [number, number]> = {
  fire: [150, 34],
  air: [250, 128],
  earth: [150, 222],
  water: [50, 128],
  light: [150, 128],
  darkness: [268, 222],
};
const R = 21;
/** Every "x beats y" there is (Light's and the circle's). */
const EDGES: [Element, Element][] = (Object.keys(NODE) as Element[]).flatMap((x) => (Object.keys(NODE) as Element[]).filter((y) => beats(x, y)).map((y) => [x, y] as [Element, Element]));

/** An arrow from one element to the other, bowed out round the circle for the four basic ones. */
function arrowPath(x: Element, y: Element): string {
  const [x1, y1] = NODE[x];
  const [x2, y2] = NODE[y];
  const len = Math.hypot(x2 - x1, y2 - y1);
  const [ux, uy] = [(x2 - x1) / len, (y2 - y1) / len];
  const [sx, sy, ex, ey] = [x1 + ux * R, y1 + uy * R, x2 - ux * (R + 4), y2 - uy * (R + 4)];
  if (!BASIC.includes(x) || !BASIC.includes(y)) return `M${sx},${sy} L${ex},${ey}`;
  // Bow away from the middle.
  const [mx, my] = [(sx + ex) / 2, (sy + ey) / 2];
  const [cx, cy] = [mx + (mx - 150) * 0.45, my + (my - 128) * 0.45];
  return `M${sx},${sy} Q${cx},${cy} ${ex},${ey}`;
}

/**
 * Who beats whom, as a wheel: Fire → Air → Earth → Water → Fire round the outside, Light in the middle, Darkness
 * apart. Tap an element (or let it turn by itself) to light up what it beats and what beats it.
 */
export function ElementWheel() {
  const all = Object.keys(NODE) as Element[];
  const [picked, setPicked] = useState<Element | null>(null);
  const [turn, setTurn] = useState(0);
  useEffect(() => {
    if (picked) return;
    const t = window.setInterval(() => setTurn((n) => (n + 1) % all.length), 1800);
    return () => window.clearInterval(t);
  }, [picked, all.length]);
  const on = picked ?? all[turn];
  const wins = all.filter((y) => beats(on, y));
  const loses = all.filter((y) => beats(y, on));
  const tone = (x: Element, y: Element) => (x === on ? 'hit' : y === on ? 'coral' : null);
  return (
    <div className="grid items-center gap-3 sm:grid-cols-[minmax(0,18rem)_1fr]">
      <svg viewBox="0 0 300 250" className="w-full max-w-[18rem] justify-self-center" role="img" aria-label="Which element beats which">
        <defs>
          {(['ink-faint', 'hit', 'coral'] as const).map((c) => (
            <marker key={c} id={`dd-arrow-${c}`} viewBox="0 0 10 10" refX="7" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M0,0 L10,5 L0,10 z" style={{ fill: `var(--color-${c})` }} />
            </marker>
          ))}
        </defs>
        {EDGES.map(([x, y]) => {
          const t = tone(x, y);
          return (
            <path
              key={`${x}${y}`}
              d={arrowPath(x, y)}
              fill="none"
              strokeWidth={t ? 3 : 1.5}
              strokeDasharray={t ? '6 4' : undefined}
              className={t ? 'dd-flow' : ''}
              style={{ stroke: `var(--color-${t ?? 'ink-faint'})`, opacity: t ? 1 : 0.35, transition: 'opacity .3s' }}
              markerEnd={`url(#dd-arrow-${t ?? 'ink-faint'})`}
            />
          );
        })}
        {all.map((e) => {
          const [x, y] = NODE[e];
          const state = e === on ? 'on' : wins.includes(e) ? 'win' : loses.includes(e) ? 'lose' : 'off';
          return (
            <g key={e} onClick={() => setPicked(picked === e ? null : e)} className="cursor-pointer" role="button" aria-label={ELEMENT_INFO[e].name}>
              <circle
                cx={x}
                cy={y}
                r={state === 'on' ? R + 3 : R}
                style={{
                  fill: 'var(--color-card)',
                  stroke: `var(--color-${state === 'on' ? 'accent' : state === 'win' ? 'hit' : state === 'lose' ? 'coral' : 'rule'})`,
                  strokeWidth: state === 'off' ? 1.5 : 3,
                  transition: 'all .3s',
                }}
              />
              <text x={x} y={y + 7} textAnchor="middle" fontSize="20">
                {ELEMENT_INFO[e].icon}
              </text>
            </g>
          );
        })}
      </svg>
      <div key={on} className="animate-pop space-y-2 text-sm">
        <p className="font-display text-lg font-bold">{elName(on)}</p>
        <p>
          <span className="font-bold text-hit">Beats</span> {wins.length ? wins.map(elName).join(', ') : 'nothing'}
        </p>
        <p>
          <span className="font-bold text-coral">Falls to</span> {loses.length ? loses.map(elName).join(', ') : 'only Light'}
        </p>
        <p className="rounded-md bg-hit/10 p-2 text-ink-soft">
          Having the edge gives <b className="text-hit">+{DEFENCE.edge} power</b> for that duel. It helps a lot, but it isn&apos;t a sure win: a much stronger card can still beat it.
        </p>
        <p className="text-xs text-ink-faint">{picked ? 'Tap it again to let the wheel turn.' : 'Tap an element to look at it.'}</p>
      </div>
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

// ---------------------------------------------------------------- the rules panel

function Tile({ icon, title, children }: { icon: string; title: string; children: ReactNode }) {
  return (
    <div className="animate-pop flex gap-2 rounded-md border border-rule bg-card p-2.5 text-sm">
      <span className="text-2xl leading-none">{icon}</span>
      <div className="min-w-0">
        <p className="font-display font-bold">{title}</p>
        <div className="text-ink-soft">{children}</div>
      </div>
    </div>
  );
}

type Tab = 'duel' | 'elements' | 'power' | 'special';
const TABS: [Tab, string][] = [
  ['duel', '▶ A duel'],
  ['elements', '🔥 Elements'],
  ['power', '⚡ Power'],
  ['special', '✨ Special cards'],
];

/** How a battle works: four short pages, each shown rather than told. */
export function DefenceRules({ arena }: { arena: Arena }) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>('duel');
  return (
    <div className="rounded-lg border border-rule">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex w-full items-center justify-between gap-2 p-3 text-left font-display font-bold">
        <span>📖 How a battle works</span>
        <span className={`transition-transform ${open ? 'rotate-180' : ''}`}>▾</span>
      </button>
      {open && (
        <div className="space-y-3 border-t border-rule p-3">
          <div className="grid grid-cols-2 gap-1 rounded-lg bg-tile p-1 sm:grid-cols-4">
            {TABS.map(([t, label]) => (
              <button key={t} type="button" onClick={() => setTab(t)} aria-pressed={tab === t} className={`rounded-md px-2 py-1.5 font-display text-sm font-bold ${tab === t ? 'bg-paper shadow' : 'text-ink-soft'}`}>
                {label}
              </button>
            ))}
          </div>
          {tab === 'duel' && (
            <div className="space-y-3">
              <SampleDuel />
              <div className="grid gap-2 sm:grid-cols-3">
                <Tile icon="🃏" title={`${DEFENCE.size} cards, in order`}>
                  At most {DEFENCE.budget} points: {RARITIES.map((r) => `${RARITY_INFO[r].name} ${DEFENCE.cost[r]}`).join(', ')}.
                </Tile>
                <Tile icon="🏆" title="The winner stays">
                  It meets the next card, −{DEFENCE.fatigue} power for each duel it has won. Equal power: both are out.
                </Tile>
                <Tile icon="🏁" title="The end">
                  A team with no card left loses. Both out at once: the cheaper team wins (the defence if they cost the same).
                </Tile>
              </div>
            </div>
          )}
          {tab === 'elements' && <ElementWheel />}
          {tab === 'power' && (
            <div className="grid gap-2 sm:grid-cols-2">
              <Tile icon={PART_INFO.rarity.icon} title="Rarity">
                <span className="flex flex-wrap gap-x-3">
                  {RARITIES.map((r) => (
                    <span key={r}>
                      {RARITY_INFO[r].name} <b>{DEFENCE.power[r]}</b>
                    </span>
                  ))}
                </span>
              </Tile>
              <Tile icon={PART_INFO.grade.icon} title="Grades">
                +{DEFENCE.perGrade} for every two grades above the first (+3 at most).
              </Tile>
              <Tile icon={PART_INFO.edge.icon} title="Element edge">
                +{DEFENCE.edge} in a duel against an element yours beats.
              </Tile>
              <Tile icon={PART_INFO.home.icon} title="At home">
                The defence&apos;s cards get +{DEFENCE.home}.
              </Tile>
              <Tile icon={PART_INFO.fatigue.icon} title="Tired">
                −{DEFENCE.fatigue} for each duel a card has won and stayed on.
              </Tile>
              <Tile icon={PART_INFO.crew.icon} title="Crew">
                {DEFENCE.crewSize} cards or more of one franchise: +{arena.crew ?? DEFENCE.crew} each.
              </Tile>
              <Tile icon={PART_INFO.spare.icon} title="Points unspent">
                +{DEFENCE.spare} to every card for each 2 points of the budget left unused.
              </Tile>
              <Tile icon={arena.icon} title={`Today: ${arena.name}`}>
                {arena.text}
              </Tile>
            </div>
          )}
          {tab === 'special' && (
            <div className="grid gap-2 sm:grid-cols-2">
              <Tile icon="🥋" title="Technique">
                −{DEFENCE.kindMalus} power, but it hits the card it meets as it arrives: −{DEFENCE.techniqueHit}.
              </Tile>
              <Tile icon="🏰" title="Place">
                −{DEFENCE.kindMalus} power, but once it&apos;s out, every card after it gets +{DEFENCE.placeLift}.
              </Tile>
              <Tile icon={ANOMALIES.inverted.icon} title="Inverted">
                Turns the element over: the edge goes to the other card.
              </Tile>
              <Tile icon={ANOMALIES.mirror.icon} title="Mirror">
                Takes the element of the card it meets.
              </Tile>
              <Tile icon={ANOMALIES.corrupted.icon} title="Corrupted">
                A random element each duel.
              </Tile>
              <Tile icon={ANOMALIES.timelost.icon} title="Time-Lost">
                Slips away once instead of falling, back at the end of its team (−{DEFENCE.timelost}).
              </Tile>
              <Tile icon={ANOMALIES.void.icon} title="Void-Touched">
                Its element is hidden from attackers (❔).
              </Tile>
              <Tile icon={ANOMALIES.fake.icon} title="Fake Rarity">
                Looks like a Mythic to whoever looks at it.
              </Tile>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
