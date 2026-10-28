import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { HeartIcon } from '../boss/BossHeader';
import { celebrate, celebrateBig, shake } from '../lib/fx';
import { sfx } from '../lib/sfx';
import { ALL_KEYS, ALL_MEDIA, ALL_ROOMS, FRANCHISES, MEDIA, bossesFor, challengesFor, hasBoss, keysFor, mediaOfKeys, roomsOf as franchiseRooms } from '../rogue/pools';
import { BossRoom, HigherLowerRoom, Name5Room, OddRoom, PortraitRoom, SortRoom, WhoAmIRoom, type RoomResult } from '../rogue/Rooms';
import {
  ACTS,
  CHALLENGE_INFO,
  NODE_INFO,
  describeNode,
  RELICS,
  ROWS,
  goldFor,
  has,
  makeMap,
  picksOf,
  roomsOf,
  modsFor,
  newRun,
  reachable,
  relicOffer,
  runScore,
  takeRelic,
  type ChallengeKind,
  type MapNode,
  type RelicId,
  type RunState,
} from '../rogue/run';
import { useProgress } from '../store/progress';
import type { Domain } from '../types';

const ROOMS: Record<ChallengeKind, typeof PortraitRoom> = {
  portrait: PortraitRoom,
  higherlower: HigherLowerRoom,
  odd: OddRoom,
  whoami: WhoAmIRoom,
  sort: SortRoom,
  name5: Name5Room,
};
const pickKind = (kinds: ChallengeKind[]) => kinds[Math.floor(Math.random() * kinds.length)];
const HEART_PRICE = 30;
const REST_GOLD = 20;
const MEDIA_KEY = 'omnidle:expedition:media';
const SETUP_KEY = 'omnidle:expedition:setup';

/** What an expedition is made of: franchises, and kinds of room. */
interface Setup {
  picks: string[];
  rooms: ChallengeKind[];
}

const sameSet = (a: string[], b: string[]) => a.length === b.length && a.every((x) => b.includes(x));

/** A setup that's just "these kinds of work, every room" (what the quick buttons make), or null for a hand-picked one. */
function plainMedia(picks: string[], rooms: ChallengeKind[]): Domain[] | null {
  const media = mediaOfKeys(picks);
  return sameSet(picks, keysFor(media)) && sameSet(rooms, ALL_ROOMS) ? media : null;
}

/** Each mix of kinds of work keeps its own best ("mixed": all of them); a hand-picked expedition, "custom". */
function bestKey(picks: string[], rooms: ChallengeKind[]) {
  const media = plainMedia(picks, rooms);
  if (!media) return 'rogue:custom';
  return ALL_MEDIA.every((m) => media.includes(m)) ? 'rogue:mixed' : `rogue:${[...media].sort().join('+')}`;
}

function setupLabel(picks: string[], rooms: ChallengeKind[]) {
  const media = plainMedia(picks, rooms);
  if (media) return ALL_MEDIA.every((m) => media.includes(m)) ? 'Everything' : MEDIA.filter((m) => media.includes(m.id)).map((m) => `${m.icon} ${m.label}`).join(' + ');
  const n = picks.length;
  return `Custom: ${n} franchise${n === 1 ? '' : 's'}${rooms.length < ALL_ROOMS.length ? `, ${rooms.length} kind${rooms.length === 1 ? '' : 's'} of room` : ''}`;
}

function savedSetup(): Setup {
  try {
    const v = JSON.parse(localStorage.getItem(SETUP_KEY) ?? 'null');
    if (v && Array.isArray(v.picks) && Array.isArray(v.rooms)) {
      const picks = ALL_KEYS.filter((k) => v.picks.includes(k));
      const rooms = ALL_ROOMS.filter((k) => v.rooms.includes(k));
      return { picks, rooms: rooms.length ? rooms : ALL_ROOMS };
    }
    // Before hand-picking existed, only the kinds of work were remembered.
    const m = JSON.parse(localStorage.getItem(MEDIA_KEY) ?? 'null');
    if (Array.isArray(m)) {
      const media = ALL_MEDIA.filter((d) => m.includes(d));
      if (media.length) return { picks: keysFor(media), rooms: ALL_ROOMS };
    }
  } catch {
    // No storage: everything.
  }
  return { picks: ALL_KEYS, rooms: ALL_ROOMS };
}

/** Why a setup can't set out yet, if it can't. */
function setupProblem({ picks, rooms }: Setup): string | null {
  if (!picks.length) return 'Pick at least one franchise.';
  if (!rooms.length) return 'Pick at least one kind of room.';
  if (!challengesFor(picks, rooms).length) return "None of these franchises can fill the rooms you picked: add some of either.";
  if (!bossesFor(picks).length) return 'Pick at least one franchise with a guardian (👑) for the bosses.';
  return null;
}

const chip = (on: boolean) =>
  `rounded-full border-2 px-3 py-1.5 text-sm font-semibold transition ${on ? 'border-ink bg-ink text-paper' : 'border-rule-strong bg-card text-ink-soft hover:border-ink'}`;

/**
 * The kinds of work to set out with (quick buttons, a kind is on when all its franchises are), and
 * behind "Customise", every franchise and every kind of room, one by one.
 */
function SetupPicker({ setup, onChange }: { setup: Setup; onChange: (s: Setup) => void }) {
  const [open, setOpen] = useState(() => !plainMedia(setup.picks, setup.rooms));
  const set = (next: Setup) => {
    sfx.click();
    onChange(next);
    try {
      localStorage.setItem(SETUP_KEY, JSON.stringify(next));
    } catch {
      // Not remembered, that's all.
    }
  };
  const order = (keys: string[]) => ALL_KEYS.filter((k) => keys.includes(k));
  const withKeys = (keys: string[], on: boolean) => set({ ...setup, picks: order(on ? [...new Set([...setup.picks, ...keys])] : setup.picks.filter((k) => !keys.includes(k))) });
  const toggleKey = (k: string) => withKeys([k], !setup.picks.includes(k));
  const toggleRoom = (r: ChallengeKind) =>
    set({ ...setup, rooms: setup.rooms.includes(r) ? setup.rooms.filter((x) => x !== r) : ALL_ROOMS.filter((x) => x === r || setup.rooms.includes(x)) });
  const allNone = (onAll: () => void, onNone: () => void) => (
    <span className="flex gap-1 text-xs">
      <button type="button" onClick={onAll} className="btn-paper rounded px-2 py-0.5 font-semibold">
        All
      </button>
      <button type="button" onClick={onNone} className="btn-paper rounded px-2 py-0.5 font-semibold">
        None
      </button>
    </span>
  );

  return (
    <div className="space-y-3">
      <p className="font-display text-xs uppercase tracking-[0.3em] text-ink-faint">Made of</p>
      <div className="flex flex-wrap items-center gap-2">
        {MEDIA.map((m) => {
          const keys = keysFor([m.id]);
          const n = keys.filter((k) => setup.picks.includes(k)).length;
          const on = n === keys.length;
          return (
            <button
              key={m.id}
              type="button"
              aria-pressed={on}
              onClick={() => withKeys(keys, !on)}
              className={`rounded-full border-2 px-4 py-2 font-display font-bold transition ${on ? 'border-ink bg-ink text-paper' : n ? 'border-ink bg-tile text-ink' : 'border-rule-strong bg-card text-ink-soft hover:border-ink'}`}
            >
              {m.icon} {m.label}
              {n > 0 && !on && <span className="ml-1.5 text-xs font-semibold">{n}/{keys.length}</span>}
            </button>
          );
        })}
        <button type="button" onClick={() => (sfx.click(), setOpen((o) => !o))} aria-expanded={open} className="btn-paper rounded-full px-4 py-2 font-display text-sm font-bold">
          ⚙ {open ? 'Hide the details' : 'Customise'}
        </button>
      </div>

      {open && (
        <div className="animate-pop space-y-4 rounded-md border border-rule-strong bg-card p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-display font-bold">Franchises</p>
            <span className="flex gap-2">
              <button type="button" onClick={() => set({ picks: ALL_KEYS, rooms: ALL_ROOMS })} className="btn-paper rounded-md px-3 py-1 text-sm font-semibold">
                Select everything
              </button>
              <button type="button" onClick={() => set({ ...setup, picks: [] })} className="btn-paper rounded-md px-3 py-1 text-sm font-semibold">
                Deselect everything
              </button>
            </span>
          </div>
          {MEDIA.map((m) => {
            const list = FRANCHISES.filter((x) => x.domain === m.id);
            return (
              <div key={m.id} className="space-y-1.5">
                <div className="flex items-center gap-3">
                  <p className="font-display text-sm font-bold">
                    {m.icon} {m.label}
                  </p>
                  {allNone(
                    () => withKeys(list.map((x) => x.key), true),
                    () => withKeys(list.map((x) => x.key), false),
                  )}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {list.map((x) => {
                    const rooms = franchiseRooms(x.key);
                    return (
                      <button
                        key={x.key}
                        type="button"
                        aria-pressed={setup.picks.includes(x.key)}
                        onClick={() => toggleKey(x.key)}
                        title={`Rooms: ${rooms.map((r) => CHALLENGE_INFO[r].name).join(', ') || 'none'}${hasBoss(x.key) ? ' · has a guardian' : ''}`}
                        className={chip(setup.picks.includes(x.key))}
                      >
                        {x.label}
                        <span className="ml-1.5 text-xs opacity-80">
                          {rooms.map((r) => CHALLENGE_INFO[r].icon).join('')}
                          {hasBoss(x.key) ? '👑' : ''}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
          <div className="space-y-1.5 border-t border-rule pt-3">
            <div className="flex items-center gap-3">
              <p className="font-display font-bold">Rooms</p>
              {allNone(
                () => set({ ...setup, rooms: ALL_ROOMS }),
                () => set({ ...setup, rooms: [] }),
              )}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {ALL_ROOMS.map((r) => (
                <button key={r} type="button" aria-pressed={setup.rooms.includes(r)} onClick={() => toggleRoom(r)} className={chip(setup.rooms.includes(r))}>
                  {CHALLENGE_INFO[r].icon} {CHALLENGE_INFO[r].name}
                </button>
              ))}
            </div>
            <p className="text-xs text-ink-faint">The icons beside a franchise are the rooms it can fill; 👑 means it has a guardian for the bosses. Shops, campfires and gambles always come.</p>
          </div>
        </div>
      )}
    </div>
  );
}

/** What's on screen besides the map. */
type Screen =
  | { kind: 'map' }
  | { kind: 'room'; node: MapNode; challenge: ChallengeKind | 'boss'; elite: boolean; gamble?: boolean }
  | { kind: 'reward'; offer: RelicId[]; text: string }
  | { kind: 'shop'; offer: RelicId[] }
  | { kind: 'rest' }
  | { kind: 'event'; node: MapNode }
  | { kind: 'result'; result: Outcome; then: Screen };

/** How a room went, shown before moving on. */
interface Outcome {
  won: boolean;
  perfect: boolean;
  boss: boolean;
  note: string;
  gold: number;
  /** Hearts before the room, and how many it cost. */
  hearts: number;
  maxHearts: number;
  lost: number;
  line: string;
  /** The run ended with this room. */
  last: boolean;
}

const pickLine = (xs: string[]) => xs[Math.floor(Math.random() * xs.length)];
const WIN_LINES = ['The path opens.', 'Onward!', 'Not even close.', 'Another one down.', 'Clean work.', 'They never stood a chance.'];
const PERFECT_LINES = ['Flawless.', 'Not a single slip.', 'Textbook.'];
const LOSS_LINES = ['Just a scratch — keep going.', 'Shake it off.', 'The next room is yours.', 'Even legends stumble.', 'Lesson learned.'];
const BOSS_WIN_LINES = ['The guardian falls!', 'The way ahead is clear.', 'Legendary.'];
const BOSS_LOSS_LINES = ['The guardian holds. Catch your breath and strike again.', 'Close! It knows your moves now — so do you.'];
const LAST_LINES = ['Your last heart gave out.', 'The road ends here — this time.'];

/** Counts up to `to`, for gold won. */
function CountUp({ to }: { to: number }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!to) return;
    const start = performance.now();
    let id = 0;
    const step = (t: number) => {
      const k = Math.min(1, (t - start) / 700);
      setN(Math.round(to * (1 - (1 - k) ** 3)));
      if (k < 1) id = requestAnimationFrame(step);
    };
    id = requestAnimationFrame(step);
    // A hidden tab never runs the frames: land on the total anyway.
    const done = window.setTimeout(() => setN(to), 900);
    return () => (cancelAnimationFrame(id), window.clearTimeout(done));
  }, [to]);
  return <>{n}</>;
}

/** A room's outcome: a stamp, the gold won or the hearts it cost, and the way on. */
function ResultCard({ result: o, onNext }: { result: Outcome; onNext: () => void }) {
  useEffect(() => {
    const go = (e: KeyboardEvent) => e.key === 'Enter' && onNext();
    // A moment before Enter counts: the key that sent the last answer shouldn't skip the card.
    const id = window.setTimeout(() => window.addEventListener('keydown', go), 400);
    return () => (window.clearTimeout(id), window.removeEventListener('keydown', go));
  }, [onNext]);
  const title = o.won ? (o.boss ? 'Guardian defeated!' : o.perfect ? 'Perfect!' : 'Victory!') : o.last ? 'Fallen' : o.boss ? 'Driven back' : 'Room lost';
  return (
    <section className={`page animate-round-in space-y-4 overflow-hidden rounded-md p-6 text-center ${o.won ? 'ring-2 ring-hit/50' : 'ring-2 ring-miss/40'}`}>
      <div className="animate-stamp text-6xl" aria-hidden>
        {o.won ? (o.boss ? '👑' : o.perfect ? '🌟' : '⚔️') : o.last ? '🪦' : '💔'}
      </div>
      <p className={`font-display text-4xl font-bold tracking-wide ${o.won ? 'text-hit' : 'text-coral'}`}>{title}</p>
      <p className="text-lg">{o.note}</p>
      {o.won ? (
        <div className="flex flex-wrap items-center justify-center gap-3">
          <span className="animate-pop rounded-full border border-ochre/50 bg-ochre/10 px-4 py-1.5 font-display text-2xl font-bold" style={{ animationDelay: '250ms' }}>
            +<CountUp to={o.gold} /> 🪙
          </span>
          {o.perfect && (
            <span className="animate-pop rounded-full border border-hit/50 bg-hit/10 px-3 py-1 font-display text-sm font-bold uppercase tracking-widest text-hit" style={{ animationDelay: '500ms' }}>
              Flawless +5
            </span>
          )}
        </div>
      ) : (
        <div className="flex justify-center gap-1.5">
          {Array.from({ length: o.maxHearts }, (_, i) => {
            const breaking = i < o.hearts && i >= o.hearts - o.lost;
            return (
              <span key={i} className={breaking ? 'animate-heart-break' : ''} style={breaking ? { animationDelay: `${300 + (o.hearts - 1 - i) * 200}ms` } : undefined}>
                <HeartIcon full={i < o.hearts} className="size-8" />
              </span>
            );
          })}
        </div>
      )}
      <p className="font-serif text-lg italic text-ink-soft">{o.line}</p>
      <button type="button" onClick={onNext} className={`${o.won ? 'btn-accent' : 'btn-ink'} rounded-md px-8 py-3 font-display font-bold tracking-wider`}>
        {o.last ? 'See the expedition' : !o.won && o.boss ? 'Face the guardian again' : 'Continue'}
      </button>
    </section>
  );
}


function Hud({ run }: { run: RunState }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-rule-strong bg-card px-3 py-2">
      <div className="flex items-center gap-1">
        {Array.from({ length: run.maxHearts }, (_, i) => (
          <HeartIcon key={i} full={i < run.hearts} className="size-5" />
        ))}
      </div>
      <p className="font-display text-sm font-bold">🪙 {run.gold}</p>
      <p className="font-display text-sm text-ink-soft">
        Act {run.act}/{ACTS} · {run.cleared} won
      </p>
      <div className="flex gap-1">
        {run.relics.map((r) => (
          <span key={r} title={`${RELICS[r].name}: ${RELICS[r].blurb}`} className="cursor-help text-xl">
            {RELICS[r].icon}
          </span>
        ))}
      </div>
    </div>
  );
}

/** The act's map, first row at the top and the boss at the bottom; the rooms within reach glow. */
function RunMap({ run, onEnter }: { run: RunState; onEnter: (n: MapNode) => void }) {
  const open = new Set(reachable(run).map((n) => n.id));
  const rowH = 74;
  const height = (ROWS + 1) * rowH;
  const width = (row: number) => run.map.filter((n) => n.row === row).length;
  const pos = (n: MapNode) => ({ x: ((n.col + 0.5) / width(n.row)) * 100, y: n.row * rowH + rowH / 2 });
  const byId = new Map(run.map.map((n) => [n.id, n]));
  // The room whose card shows: hovered or focused, or tapped once on a touch screen (a second tap enters).
  const [shown, setShown] = useState<string | null>(null);
  const touch = useRef(false);
  const tip = shown ? byId.get(shown) : undefined;
  return (
    <div className="relative mx-auto w-full max-w-md" style={{ height }} onPointerLeave={() => !touch.current && setShown(null)}>
      <svg className="absolute inset-0 size-full" viewBox={`0 0 100 ${height}`} preserveAspectRatio="none" aria-hidden>
        {run.map.flatMap((n) =>
          n.next.map((id) => {
            const a = pos(n);
            const b = pos(byId.get(id)!);
            return <line key={`${n.id}-${id}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="currentColor" strokeOpacity={0.25} strokeWidth={0.6} strokeDasharray="1.5 1.5" vectorEffect="non-scaling-stroke" />;
          }),
        )}
      </svg>
      {run.map.map((n) => {
        const { x, y } = pos(n);
        const isOpen = open.has(n.id);
        const here = run.at === n.id;
        const icon = n.challenge ? CHALLENGE_INFO[n.challenge].icon : NODE_INFO[n.kind].icon;
        const name = n.kind === 'fight' ? CHALLENGE_INFO[n.challenge!].name : n.kind === 'elite' ? `Elite · ${CHALLENGE_INFO[n.challenge!].name}` : NODE_INFO[n.kind].name;
        return (
          <button
            key={n.id}
            type="button"
            // Not `disabled`: rooms out of reach still show their card on hover.
            aria-disabled={!isOpen}
            aria-label={name}
            onPointerDown={(e) => (touch.current = e.pointerType !== 'mouse')}
            onPointerEnter={(e) => e.pointerType === 'mouse' && setShown(n.id)}
            onFocus={() => setShown(n.id)}
            onBlur={() => !touch.current && setShown(null)}
            onClick={() => {
              if (touch.current && shown !== n.id) return setShown(n.id);
              if (isOpen) onEnter(n);
            }}
            className={`absolute grid -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-2 transition ${n.kind === 'boss' ? 'size-16 text-3xl' : 'size-12 text-xl'} ${
              here ? 'border-ink bg-ink text-paper' : isOpen ? 'animate-pulse border-accent bg-card shadow-lg hover:scale-110' : 'cursor-default border-rule bg-card/70 opacity-60'
            } ${n.kind === 'elite' ? 'ring-2 ring-coral/60' : ''} ${shown === n.id ? 'z-10 scale-110' : ''}`}
            style={{ left: `${x}%`, top: y }}
          >
            {icon}
          </button>
        );
      })}
      {tip && <RoomCard run={run} node={tip} open={open.has(tip.id)} here={run.at === tip.id} at={pos(tip)} rowH={rowH} rows={ROWS} touch={touch.current} />}
    </div>
  );
}

/** The card beside a room on the map: what it is, what it pays, what it costs. */
function RoomCard({ run, node, open, here, at, rowH, rows, touch }: { run: RunState; node: MapNode; open: boolean; here: boolean; at: { x: number; y: number }; rowH: number; rows: number; touch: boolean }) {
  const d = describeNode(run, node, HEART_PRICE, REST_GOLD);
  const icon = node.challenge ? CHALLENGE_INFO[node.challenge].icon : NODE_INFO[node.kind].icon;
  // Below the room in the top half of the map, above it lower down; kept inside the map's width.
  const below = at.y < ((rows + 1) * rowH) / 2;
  const h = at.x < 30 ? '-translate-x-6' : at.x > 70 ? '-translate-x-[calc(100%-1.5rem)]' : '-translate-x-1/2';
  return (
    <div
      role="tooltip"
      className={`animate-pop pointer-events-none absolute z-20 w-64 ${h} rounded-md border border-rule-strong bg-card p-3 text-left text-sm shadow-xl`}
      style={{ left: `${at.x}%`, ...(below ? { top: at.y + 34 } : { bottom: (rows + 1) * rowH - at.y + 34 }) }}
    >
      <p className="font-display font-bold">
        {icon} {d.title}
      </p>
      {d.body.map((b, i) => (
        <p key={i} className={i ? 'mt-1 text-ink-soft' : 'mt-1'}>
          {b}
        </p>
      ))}
      {(d.win || d.lose) && (
        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 border-t border-rule pt-2 text-xs font-semibold">
          {d.win && <span className="text-hit">Win: {d.win}</span>}
          {d.lose && <span className="text-coral">Lose: {d.lose}</span>}
        </div>
      )}
      <p className="mt-2 text-xs italic text-ink-faint">{here ? "You're here." : open ? (touch ? 'Tap again to enter.' : 'Click to enter.') : 'Out of reach from here.'}</p>
    </div>
  );
}

/** /expedition */
export default function Expedition() {
  const run = useProgress((s) => s.rogueRun);
  const setRun = useProgress((s) => s.setRogueRun);
  const [setup, setSetup] = useState<Setup>(savedSetup);
  const bests = useProgress((s) => s.bests);
  const best = bests[run ? bestKey(picksOf(run), roomsOf(run)) : bestKey(setup.picks, setup.rooms)] ?? 0;
  const problem = setupProblem(setup);
  const recordBest = useProgress((s) => s.recordBest);
  const [screen, setScreen] = useState<Screen>({ kind: 'map' });
  const save = (r: RunState) => setRun({ ...r, log: r.log.slice(-6) });

  const finish = (r: RunState, won: boolean) => {
    const done = { ...r, over: true, won };
    save(done);
    recordBest(bestKey(picksOf(done), roomsOf(done)), runScore(done));
  };

  const enter = (n: MapNode) => {
    if (!run) return;
    sfx.click();
    // Standing on the room from the moment it's entered: leaving the page doesn't skip it for free.
    const r = { ...run, at: n.id };
    save(r);
    if (n.kind === 'fight' || n.kind === 'elite') setScreen({ kind: 'room', node: n, challenge: n.challenge!, elite: n.kind === 'elite' });
    else if (n.kind === 'boss') setScreen({ kind: 'room', node: n, challenge: 'boss', elite: false });
    else if (n.kind === 'shop') setScreen({ kind: 'shop', offer: relicOffer(r) });
    else if (n.kind === 'rest') setScreen({ kind: 'rest' });
    else setScreen({ kind: 'event', node: n });
  };

  const roomDone = (res: RoomResult) => {
    if (!run || screen.kind !== 'room') return;
    const { node, elite, gamble } = screen;
    const boss = node.kind === 'boss';
    const base = { boss, note: res.note, hearts: run.hearts, maxHearts: run.maxHearts };
    let r: RunState = { ...run };
    if (res.won) {
      const gold = goldFor(r, boss ? 'boss' : elite ? 'elite' : 'fight', res.perfect);
      r = { ...r, gold: r.gold + gold, cleared: r.cleared + 1, log: [...r.log, `✓ ${res.note} (+${gold} 🪙)`] };
      const result: Outcome = { ...base, won: true, perfect: res.perfect, gold, lost: 0, last: false, line: pickLine(boss ? BOSS_WIN_LINES : res.perfect ? PERFECT_LINES : WIN_LINES) };
      if (boss) (sfx.victory(), celebrateBig());
      else if (res.perfect) (sfx.streak(), celebrate());
      else (sfx.hit(), celebrate());
      let then: Screen = { kind: 'map' };
      if (boss) {
        if (has(r, 'bandage')) r.hearts = Math.min(r.maxHearts, r.hearts + 1);
        if (r.act >= ACTS) {
          finish(r, true);
          return setScreen({ kind: 'result', result: { ...result, line: 'The expedition is complete!' }, then: { kind: 'map' } });
        }
        r = { ...r, act: r.act + 1, map: makeMap(r.act + 1, r.seed, picksOf(r), roomsOf(r)), at: null };
        then = { kind: 'reward', offer: relicOffer(r), text: `Act ${r.act - 1} cleared! Take a relic for the road.` };
      } else if (elite || gamble) then = { kind: 'reward', offer: relicOffer(r), text: gamble ? 'The gamble paid off.' : 'Elite beaten: a relic of your choice.' };
      save(r);
      return setScreen({ kind: 'result', result, then });
    }
    sfx.hurt();
    shake(document.querySelector('main'), 10, 400);
    const cost = Math.min(r.hearts, boss ? 2 : 1);
    r = { ...r, hearts: r.hearts - cost, log: [...r.log, `✗ ${res.note} (−${cost} ❤)`] };
    const last = r.hearts <= 0;
    const result: Outcome = { ...base, won: false, perfect: false, gold: 0, lost: cost, last, line: pickLine(last ? LAST_LINES : boss ? BOSS_LOSS_LINES : LOSS_LINES) };
    if (last) finish(r, false);
    else save(r);
    // A boss has to be beaten: the act's last room comes back.
    setScreen({ kind: 'result', result, then: !last && boss ? { kind: 'room', node, challenge: 'boss', elite: false } : { kind: 'map' } });
  };

  const takeReward = (relic: RelicId | null) => {
    if (!run) return;
    if (relic) sfx.correct();
    save(relic ? takeRelic(run, relic) : run);
    setScreen({ kind: 'map' });
  };

  // ── Start ─────────────────────────────────────────────────────────────
  if (!run) {
    return (
      <div className="space-y-8">
        <div>
          <Link to="/games" className="font-display text-sm font-semibold tracking-wider text-ink-soft hover:text-ink">
            ← Games
          </Link>
          <h1 className="text-5xl font-bold">Expedition</h1>
          <p className="max-w-2xl text-ink-soft">
            A run through {ACTS} acts of rooms, each a short challenge from the other games: blurred portraits, Higher or Lower, Odd One Out, Who Am
            I?, Quick Sort, lists to name — and a guardian at the end of each act. Choose your path; win rooms for gold, beat elites for relics,
            spend it all at shops. A lost room costs a heart; lose them all and the expedition ends.
          </p>
        </div>
        <SetupPicker setup={setup} onChange={setSetup} />
        <div className="flex flex-wrap items-center gap-4">
          <button
            type="button"
            disabled={!!problem}
            onClick={() => (sfx.click(), setRun(newRun(setup.picks, setup.rooms)), setScreen({ kind: 'map' }))}
            className="btn-ink rounded-md px-8 py-3.5 font-display text-lg font-bold tracking-widest disabled:opacity-40"
          >
            Set out
          </button>
          {problem ? (
            <p className="text-sm font-semibold text-coral">{problem}</p>
          ) : (
            best > 0 && <p className="text-ink-soft">Best expedition ({setupLabel(setup.picks, setup.rooms)}): {best} points</p>
          )}
        </div>
        <ul className="grid gap-2 sm:grid-cols-2">
          {(Object.keys(RELICS) as RelicId[]).map((r) => (
            <li key={r} className="flex items-center gap-3 rounded-md border border-rule bg-card p-2.5 text-sm">
              <span className="text-2xl">{RELICS[r].icon}</span>
              <span>
                <span className="font-semibold">{RELICS[r].name}</span> — {RELICS[r].blurb}
              </span>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  // ── The end ───────────────────────────────────────────────────────────
  if (run.over && screen.kind !== 'result') {
    const score = runScore(run);
    return (
      <div className="mx-auto max-w-xl space-y-5 text-center">
        <p className="font-display text-sm uppercase tracking-[0.3em] text-ink-faint">{run.won ? 'Expedition complete' : 'The expedition ends here'}</p>
        <p className="font-serif text-7xl font-bold">{score}</p>
        <p className="text-ink-soft">
          {setupLabel(picksOf(run), roomsOf(run))} · {run.cleared} rooms won · {run.gold} gold · act {run.act} · {score >= best ? '★ Best expedition' : `best ${best}`}
        </p>
        <div className="flex justify-center gap-1 text-2xl">{run.relics.map((r) => RELICS[r].icon)}</div>
        <ul className="space-y-1 text-sm text-ink-soft">
          {run.log.map((l, i) => (
            <li key={i}>{l}</li>
          ))}
        </ul>
        <div className="flex justify-center gap-3">
          <button type="button" onClick={() => (sfx.click(), setRun(newRun(picksOf(run), roomsOf(run))), setScreen({ kind: 'map' }))} className="btn-ink rounded-md px-6 py-3 font-display font-bold tracking-wider">
            New expedition
          </button>
          <button type="button" onClick={() => setRun(null)} className="btn-paper rounded-md px-6 py-3 font-display font-bold tracking-wider">
            Back
          </button>
        </div>
      </div>
    );
  }

  // ── In a run ─────────────────────────────────────────────────────────
  const Room = screen.kind === 'room' && screen.challenge !== 'boss' ? ROOMS[screen.challenge] : null;
  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div className="flex items-end justify-between">
        <p className="font-display text-xs uppercase tracking-[0.3em] text-ink-faint">Expedition</p>
        {screen.kind === 'map' && (
          <button type="button" onClick={() => window.confirm('Abandon this expedition?') && finish(run, false)} className="text-xs font-semibold text-ink-faint hover:text-coral">
            Abandon
          </button>
        )}
      </div>
      <Hud run={run} />

      {screen.kind === 'map' && (
        <>
          <p className="text-center font-serif text-lg italic text-ink-soft">{run.at ? 'Choose the next room.' : `Act ${run.act}: choose where to begin.`}</p>
          {run.log.length > 0 && <p className="text-center text-sm text-ink-soft">{run.log.at(-1)}</p>}
          <RunMap run={run} onEnter={enter} />
        </>
      )}

      {screen.kind === 'room' && (
        <section key={screen.node.id + run.hearts} className="page animate-round-in rounded-md p-4 sm:p-6">
          <p className="mb-3 text-center font-display text-sm font-bold uppercase tracking-widest text-coral">
            {screen.challenge === 'boss' ? '👑 Boss' : screen.gamble ? '❓ Gamble' : screen.elite ? '💀 Elite' : '⚔️ Challenge'}
          </p>
          {Room ? <Room mods={modsFor(run, screen.elite)} onDone={roomDone} /> : <BossRoom act={run.act} keys={picksOf(run)} onDone={roomDone} />}
        </section>
      )}

      {screen.kind === 'result' && <ResultCard result={screen.result} onNext={() => (sfx.click(), setScreen(screen.then))} />}

      {screen.kind === 'reward' && (
        <section className="page animate-round-in space-y-4 rounded-md p-5 text-center">
          <p className="font-serif text-2xl font-bold">{screen.text}</p>
          <div className="grid gap-2 sm:grid-cols-3">
            {screen.offer.map((r) => (
              <button key={r} type="button" onClick={() => takeReward(r)} className="flex flex-col items-center gap-1 rounded-md border border-rule-strong bg-card p-3 transition hover:-translate-y-0.5 hover:border-ink">
                <span className="text-3xl">{RELICS[r].icon}</span>
                <span className="font-display font-bold">{RELICS[r].name}</span>
                <span className="text-xs text-ink-soft">{RELICS[r].blurb}</span>
              </button>
            ))}
          </div>
          <button type="button" onClick={() => takeReward(null)} className="text-sm font-semibold text-ink-soft hover:text-ink">
            Skip
          </button>
        </section>
      )}

      {screen.kind === 'shop' && (
        <section className="page animate-round-in space-y-4 rounded-md p-5 text-center">
          <p className="font-serif text-2xl font-bold">🛒 A travelling merchant</p>
          <div className="grid gap-2 sm:grid-cols-3">
            {screen.offer.map((r) => {
              const owned = has(run, r);
              const afford = run.gold >= RELICS[r].price;
              return (
                <button
                  key={r}
                  type="button"
                  disabled={owned || !afford}
                  onClick={() => (sfx.correct(), save(takeRelic({ ...run, gold: run.gold - RELICS[r].price }, r)))}
                  className="flex flex-col items-center gap-1 rounded-md border border-rule-strong bg-card p-3 transition enabled:hover:-translate-y-0.5 enabled:hover:border-ink disabled:opacity-45"
                >
                  <span className="text-3xl">{RELICS[r].icon}</span>
                  <span className="font-display font-bold">{RELICS[r].name}</span>
                  <span className="text-xs text-ink-soft">{RELICS[r].blurb}</span>
                  <span className="font-display text-sm font-bold">{owned ? 'Bought' : `🪙 ${RELICS[r].price}`}</span>
                </button>
              );
            })}
          </div>
          <button
            type="button"
            disabled={run.gold < HEART_PRICE || run.hearts >= run.maxHearts}
            onClick={() => (sfx.correct(), save({ ...run, gold: run.gold - HEART_PRICE, hearts: run.hearts + 1 }))}
            className="btn-paper rounded-md px-4 py-2 font-display text-sm font-semibold disabled:opacity-45"
          >
            ❤ A heart back — 🪙 {HEART_PRICE}
          </button>
          <div>
            <button type="button" onClick={() => setScreen({ kind: 'map' })} className="btn-ink rounded-md px-6 py-2.5 font-display font-bold tracking-wider">
              Move on
            </button>
          </div>
        </section>
      )}

      {screen.kind === 'rest' && (
        <section className="page animate-round-in space-y-4 rounded-md p-5 text-center">
          <p className="font-serif text-2xl font-bold">🔥 A campfire</p>
          <div className="flex flex-wrap justify-center gap-3">
            <button
              type="button"
              disabled={run.hearts >= run.maxHearts}
              onClick={() => (sfx.correct(), save({ ...run, hearts: run.hearts + 1 }), setScreen({ kind: 'map' }))}
              className="btn-ink rounded-md px-5 py-3 font-display font-bold disabled:opacity-45"
            >
              Rest: ❤ +1
            </button>
            <button type="button" onClick={() => (sfx.correct(), save({ ...run, gold: run.gold + REST_GOLD }), setScreen({ kind: 'map' }))} className="btn-paper rounded-md px-5 py-3 font-display font-bold">
              Search the camp: 🪙 +{REST_GOLD}
            </button>
          </div>
        </section>
      )}

      {screen.kind === 'event' && (
        <section className="page animate-round-in space-y-4 rounded-md p-5 text-center">
          <p className="font-serif text-2xl font-bold">❓ A stranger&apos;s wager</p>
          <p className="text-ink-soft">“Beat an elite challenge of my choosing and a relic is yours. Fail, and it costs you a heart.”</p>
          <div className="flex justify-center gap-3">
            <button
              type="button"
              onClick={() => setScreen({ kind: 'room', node: screen.node, challenge: pickKind(challengesFor(picksOf(run), roomsOf(run))), elite: true, gamble: true })}
              className="btn-ink rounded-md px-5 py-3 font-display font-bold"
            >
              Accept
            </button>
            <button type="button" onClick={() => setScreen({ kind: 'map' })} className="btn-paper rounded-md px-5 py-3 font-display font-bold">
              Walk away
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
