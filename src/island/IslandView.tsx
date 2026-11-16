// Friends → Island → My island (stage 2a): your icon walks on a small island seen from the side. Plant two seeds,
// harvest what grows a day or two later, and build with it: blocks, wallpapers, lights, music, furniture, and frames
// that show your cards. The rules of each move are in src/island/island.ts; the save is the progress store's.
import { memo, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { GIF_CLIP } from '../gacha/CardClip';
import { CARD_BY_ID, type Card } from '../gacha/cards';
import { CardAvatar, ShownPicture } from '../gacha/Perks';
import { shownName } from '../lib/french';
import { tr } from '../lib/i18n';
import { sfx } from '../lib/sfx';
import { todayKey } from '../lib/date';
import { useProgress } from '../store/progress';
import { canLayer, dig, fgAt, harvest, harvestChoices, helpSeed, idx, ISLAND_GATE, itemsIn, isReady, isSea, isSolid, ISLAND, kindOf, layerKey, NATURAL, newIsland, pickUp, place, plant, readyOn, setTune, showCard, solidAt, surfaceAt, upgradeIsland, water, xy, zipLines, type Bag, type Change, type Island, type Layer, type Who } from './island';
import { EMOTES, useLive, type EmoteEvent, type LiveCfg, type Peer, type TuneEvent, type TvEvent } from './live';
import { FISHING, markerAt, rollCatch, zoneOf, type Catch } from './fishing';
import { canCraft, RECIPES, type Station } from './crafting';
import { biomeAt, dungeonIsland, dungeonOf, FIRE_JET, fireJetOn } from './dungeon';
import { weekOf } from '../gacha/economy';
import { discFits, DISC_PLAYERS, HEAR, islandBand, type Source } from './music';
import { ShowBar, VolumeSlider, YouTubeShow, YT, ytId, ytOf } from './YouTube';
import { canHear, playVoice } from '../gacha/voice';
import { Backdrop, cellHash, Clouds, dirtColor, isBeach, PlotArt } from './scenery';
import { SeedArt } from './SeedBook';
import { ItemArt } from './sprites';
import { ITEM_BY_ID, SEED_BY_ID, SEEDS } from './seeds';

type Tool = 'walk' | 'build' | 'plant' | 'pick' | 'dig';
/** A move on the island; `what` names it for the island's book ("build", "plant"…). */
export type Move = (island: Island, items: Bag, seeds: Bag) => Change;
export type Act = (move: Move, what?: string) => Promise<string | null> | string | null;
/** Whose island and what you may do: your own (everything), a friend's as a builder, or a visit (walk, look, water). */
export type IslandMode = 'own' | 'build' | 'visit';
const TOOLS: { id: Tool; icon: string; name: string; fr: string }[] = [
  { id: 'walk', icon: '🚶', name: 'Walk', fr: 'Marcher' },
  { id: 'build', icon: '🧱', name: 'Build', fr: 'Construire' },
  { id: 'plant', icon: '🌱', name: 'Plant', fr: 'Planter' },
  { id: 'pick', icon: '✋', name: 'Pick up', fr: 'Ramasser' },
  { id: 'dig', icon: '⛏️', name: 'Dig', fr: 'Creuser' },
];
const LAYERS: { id: Layer; icon: string; name: string; fr: string }[] = [
  { id: 'back', icon: '⬅️', name: 'Behind', fr: 'Derrière' },
  { id: 'mid', icon: '⏺️', name: 'Middle', fr: 'Milieu' },
  { id: 'front', icon: '➡️', name: 'In front', fr: 'Devant' },
];
const nameOf = (x: { name: string; fr: string }) => tr(x.name, x.fr);
/** A Mythic or an Omni card with a line to say: what a card reader takes. */
const readable = (c: Card | undefined) => !!c && (c.rarity === 'mythic' || c.rarity === 'omni') && canHear(c);
const itemName = (id: string) => (NATURAL[id] ? nameOf(NATURAL[id]) : nameOf(ITEM_BY_ID.get(id)!));
/** A card's clip a screen can play: one of ours (an MP4 in public/clips) or a GIF. */
export const screenClips = (c: Card | undefined) => (c?.clip ?? '').split('|').filter((u) => /\/clips\/.+\.mp4$/.test(u) || GIF_CLIP.test(u));
export const screenClip = (c: Card | undefined): string | undefined => screenClips(c)[0];

/** A GIF clip, looping silent: a real .gif as a picture, a GIF site's MP4 as a muted video. */
function GifLoop({ src, className }: { src: string; className: string }) {
  return /\.mp4(\?|$)/.test(src) ? <video src={src} autoPlay muted loop playsInline className={className} /> : <img src={src} alt="" className={className} />;
}

/** How dark it is on the island (0 day … 0.7 night), from the player's own clock: dusk from 18:00, night 21:00–5:00, dawn until 7:00. */
function darknessAt(d = new Date()): number {
  const h = d.getHours() + d.getMinutes() / 60;
  const night = 0.7;
  if (h >= 21 || h < 5) return night;
  if (h >= 18) return ((h - 18) / 3) * night;
  if (h < 7) return (1 - (h - 5) / 2) * night;
  return 0;
}
/** A light's glow colour. */
const GLOW: Record<string, string> = {
  'neon-sign': '#f472b6',
  'neon-tube': '#38bdf8',
  'disco-ball': '#e879f9',
  'aurora-lamp': '#5eead4',
  'bubble-lamp': '#a5f3fc',
  'star-lamp': '#fef08a',
  'moon-nightlight': '#c7d2fe',
  'wall-torch': '#fb923c',
  'iron-lantern': '#fcd34d',
  'crystal-lamp': '#67e8f9',
  'crystal-chandelier': '#a5f3fc',
  'firefly-jar': '#bef264',
  'stained-window': '#fca5a5',
  spotlight: '#fffbeb',
  fireplace: '#fb923c',
};

const NATURAL_ICON: Record<string, string> = { dirt: '🟫', stone: '🪨', 'coal-ore': '⚫', 'iron-ore': '🔩', 'gold-ore': '🟡', 'crystal-ore': '💎' };
const itemIcon = (id: string) => NATURAL_ICON[id] ?? ITEM_BY_ID.get(id)?.icon ?? '❔';
/** Frames hung on the wall (the card fills them); the others are stands that hold a card up. */
const HUNG = new Set(['card-frame', 'gold-card-frame', 'grand-card-frame']);
/** Where a stand holds its card, in the cell. */
const STAND: Record<string, React.CSSProperties> = {
  pedestal: { left: '31%', top: '-12%', width: '38%', height: '50%' },
  'crown-cushion': { left: '31%', top: '-20%', width: '38%', height: '50%' },
  'display-case': { left: '32%', top: '24%', width: '36%', height: '46%' },
  'card-reader': { left: '33%', top: '-14%', width: '34%', height: '46%' },
  podium: { left: '34%', top: '-14%', width: '32%', height: '52%' },
};

// The player's box, in cells, and how it moves.
/** Where you can sit (Down by it, or click it) and where you lie down to sleep (at night: morning comes, for you). */
const SEATS = new Set(['beanbag', 'reading-armchair', 'sofa', 'gold-throne']);
const BEDS = new Set(['cloud-bed']);
const restOf = (id: string | undefined): 'sit' | 'sleep' | null => (id && SEATS.has(id) ? 'sit' : id && BEDS.has(id) ? 'sleep' : null);
/** The next 7:00 on the player's clock (when the night ends). */
function nextMorning(d = new Date()): number {
  const m = new Date(d);
  m.setHours(7, 0, 0, 0);
  if (m.getTime() <= d.getTime()) m.setDate(m.getDate() + 1);
  return m.getTime();
}
/** Fishing: waiting for a bite, the float down (click now), then the reel bar (stop the marker in the green). */
type Fishing = { cell: number; phase: 'wait' | 'bite' | 'reel'; got: Catch; start: number; zone: number; at: number; fx: number; fy: number };

/** How many rows of the world the view shows (the camera follows the player up and down). */
const VIEW_ROWS = 15;
/** Riding: a minecart along rails (cells a second), and down (or up) a zipline. */
const CART = 9;
const ZIP_SPEED = 10;
type Ride = { kind: 'cart'; dir: number; x: number; row: number; y: number } | { kind: 'zip'; ax: number; ay: number; bx: number; by: number; t: number; len: number; to: number };

const PW = 0.78;
const PH = 0.92;
const SPEED = 6;
const GRAVITY = 32;
/** A jump's push: up 2.5 blocks (the owner's call), whatever the gravity. */
const JUMP = Math.sqrt(2 * GRAVITY * 2.5);
/** How far (cells) a TV is heard (or a speaker linked to it). */
const TV_HEAR = 12;
/** Climbing speed on a ladder. */
const CLIMB = 4.5;

export function IslandView({ shared, mode = 'own', act: shareAct, who, names = {}, live }: { shared?: Island; mode?: IslandMode; act?: Act; who?: Who; names?: Record<string, string>; live?: LiveCfg }) {
  const local = useProgress((s) => s.island) ?? null;
  const island = shared ?? local;
  const home = useMemo(() => upgradeIsland(island ?? newIsland()), [island]);
  /** Down in the week's dungeon (through the gate in the valley): its own world, mined but never built on. */
  const [inDungeon, setInDungeon] = useState(false);
  const week = weekOf(todayKey());
  const dungeonSave = useProgress((s) => s.dungeon);
  const dungeonFg = dungeonSave?.week === week ? dungeonSave.fg : undefined;
  const isl = useMemo(() => (inDungeon ? dungeonIsland(week, dungeonFg) : home), [inDungeon, week, dungeonFg, home]);
  const dungeonAct = useProgress((s) => s.dungeonAct);
  const openChest = useProgress((s) => s.openChest);
  const craft = useProgress((s) => s.craft);
  /** A furnace or a workbench whose recipes are open. */
  const [crafting, setCrafting] = useState<Station | null>(null);
  const helpReward = useProgress((s) => s.helpReward);
  const fishReward = useProgress((s) => s.fishReward);
  const items = useProgress((s) => s.islandItems ?? {});
  const seeds = useProgress((s) => s.seeds ?? {});
  const avatar = useProgress((s) => s.avatar);
  const owned = useProgress((s) => s.cards);
  const localAct = useProgress((s) => s.islandAct);
  const act: Act = inDungeon ? (move) => dungeonAct(move) : (shareAct ?? ((move) => localAct(move)));
  // In the dungeon: walk and the pickaxe only (nothing is built down there).
  const tools = TOOLS.filter((t) => (inDungeon ? t.id === 'walk' || t.id === 'dig' : mode !== 'visit' || t.id === 'walk'));

  const [tool, setTool] = useState<Tool>('walk');
  const [pick, setPick] = useState<string | null>(null);
  const [pair, setPair] = useState<string[]>([]);
  const [note, setNote] = useState<ReactNode>(null);
  const [framing, setFraming] = useState<number | null>(null);
  /** A ripe plot whose harvest the player is choosing. */
  const [reaping, setReaping] = useState<number | null>(null);
  const [hover, setHover] = useState<number | null>(null);
  /** The TV show on now (switched on here, or by someone else on the island: everyone there sees it). */
  const [tv, setTv] = useState<TvEvent | null>(null);
  /** This player's last TV and music switches, told to the others there (src/island/live.ts). */
  const myTv = useRef<TvEvent | null>(null);
  const myTune = useRef<TuneEvent | null>(null);
  const toolRef = useRef<Tool | 'fish'>('walk');
  /** Sitting or asleep: where the player is held (any move gets them up). */
  const pose = useRef<{ kind: 'sit' | 'sleep'; x: number; y: number } | null>(null);
  const [poseNow, setPoseNow] = useState<'sit' | 'sleep' | null>(null);
  /** Slept through the night: day for this player until then. */
  const [restUntil, setRestUntil] = useState(0);
  /** The emote wheel, this player's last emote (told to the others), and the bubbles over everyone's heads. */
  const [wheelOpen, setWheelOpen] = useState(false);
  const myEmote = useRef<EmoteEvent | null>(null);
  const [bubbles, setBubbles] = useState<Record<string, { e: string; until: number }>>({});
  const [fishing, setFishing] = useState<Fishing | null>(null);
  const fishRef = useRef(fishing);
  fishRef.current = fishing;
  /** The layer Build puts things in. */
  const [layer, setLayer] = useState<Layer>('mid');
  /** A record or CD player whose disc the player is choosing (its layer key and item). */
  const [discing, setDiscing] = useState<{ key: string; player: string } | null>(null);
  /** A speaker whose link the player is choosing (its layer key). */
  const [speaking, setSpeaking] = useState<string | null>(null);
  /** On a friend's island you only visit: the music you switch, heard by you only. */
  const [localTune, setLocalTune] = useState<Record<string, string | null>>({});
  /** Full screen: the island as big as the screen. */
  const root = useRef<HTMLDivElement>(null);
  const [big, setBig] = useState(false);
  useEffect(() => {
    const on = () => setBig(document.fullscreenElement === root.current && !!root.current);
    document.addEventListener('fullscreenchange', on);
    return () => document.removeEventListener('fullscreenchange', on);
  }, []);
  const toggleBig = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void root.current?.requestFullscreen?.().catch(() => say(tr('Full screen isn’t available here.', 'Le plein écran n’est pas disponible ici.')));
    box.current?.focus();
  };
  const backdrop = useProgress((s) => s.backdrop);
  // Day and night, by the clock (checked every minute), or forced to see it.
  const [sky, setSky] = useState<'auto' | 'day' | 'night'>('auto');
  const [clockDark, setClockDark] = useState(() => darknessAt());
  useEffect(() => {
    const t = window.setInterval(() => setClockDark(darknessAt()), 60_000);
    return () => window.clearInterval(t);
  }, []);
  const dark = inDungeon ? 0.62 : sky === 'auto' ? (Date.now() < restUntil ? 0 : clockDark) : sky === 'night' ? 0.7 : 0;

  // The tile size: about 22 cells across the viewport.
  const box = useRef<HTMLDivElement>(null);
  const [T, setT] = useState(32);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const fit = () =>
      setT(
        document.fullscreenElement && document.fullscreenElement === root.current
          ? Math.max(24, Math.floor(Math.min((window.innerHeight * 0.7) / VIEW_ROWS, el.clientWidth / 14)))
          : Math.max(24, Math.min(36, Math.floor(el.clientWidth / 22))),
      );
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    window.addEventListener('resize', fit);
    return () => (ro.disconnect(), window.removeEventListener('resize', fit));
  }, [big]);

  // The player: position and speed in refs, moved every frame without re-rendering the world.
  const spawn = () => ({ x: Math.floor(ISLAND.w / 2) + (1 - PW) / 2, y: surfaceAt(Math.floor(ISLAND.w / 2)) - PH - 0.01 });
  const pos = useRef(spawn());
  const vel = useRef({ x: 0, y: 0 });
  const ground = useRef(false);
  const keys = useRef(new Set<string>());
  const islRef = useRef(isl);
  islRef.current = isl;
  const world = useRef<HTMLDivElement>(null);
  const far = useRef<HTMLDivElement>(null);
  const me = useRef<HTMLDivElement>(null);
  const cam = useRef(0);
  const camY = useRef(-1);
  const skyEl = useRef<HTMLDivElement>(null);
  const ride = useRef<Ride | null>(null);
  const TRef = useRef(T);
  TRef.current = T;
  const facing = useRef(false);
  // Other players on this island, seen live (their latest spot; drawn gliding towards it).
  toolRef.current = fishing ? 'fish' : tool;
  const deepRef = useRef(false);
  deepRef.current = inDungeon;
  const gateSpot = { x: xy(ISLAND_GATE).x + (1 - PW) / 2, y: xy(ISLAND_GATE).y + 1 - PH - 0.01 };
  // Where you are: the island, or this week's dungeon (each player's own, from the same plan). Only those in the same
  // world are seen: down in the dungeon, the others down there.
  const myWorld = inDungeon ? `dungeon:${week}` : 'island';
  const myWorldRef = useRef(myWorld);
  myWorldRef.current = myWorld;
  const everyone = useLive(live, () => ({
    x: pos.current.x,
    y: pos.current.y,
    world: myWorldRef.current,
    away: gateSpot,
    left: facing.current,
    tool: toolRef.current,
    tv: myTv.current,
    tune: myTune.current,
    pose: pose.current?.kind ?? ride.current?.kind ?? null,
    emote: myEmote.current,
  }));
  const peers = useMemo(() => everyone.filter((p) => (p.world ?? 'island') === myWorld), [everyone, myWorld]);
  const peersRef = useRef<Peer[]>(peers);
  peersRef.current = peers;
  // Someone else switched a TV on or off, or a visitor changed the music: the same here (each switch once).
  const seen = useRef(new Set<string>());
  useEffect(() => {
    const tvs: TvEvent[] = [];
    const tunes: TuneEvent[] = [];
    const pops: Record<string, { e: string; until: number }> = {};
    for (const p of everyone) {
      if (p.emote && EMOTES.includes(p.emote.e) && !seen.current.has(`emote:${p.uid}:${p.emote.at}`)) {
        seen.current.add(`emote:${p.uid}:${p.emote.at}`);
        if (Math.abs(Date.now() - p.emote.at) < 15_000) pops[p.uid] = { e: p.emote.e, until: Date.now() + 3500 };
      }
      if (p.tv && !seen.current.has(`tv:${p.uid}:${p.tv.at}`)) seen.current.add(`tv:${p.uid}:${p.tv.at}`), tvs.push(p.tv);
      if (p.tune && !seen.current.has(`tune:${p.uid}:${p.tune.at}`)) seen.current.add(`tune:${p.uid}:${p.tune.at}`), tunes.push(p.tune);
    }
    const last = tvs.sort((a, b) => a.at - b.at).at(-1);
    if (last) {
      // Only a clip of the card on that screen (a show can't put anything else on).
      const fits = last.clip.startsWith(YT) ? tunesRef.current[String(last.cell)] === last.clip : screenClips(CARD_BY_ID.get(last.card)).includes(last.clip);
      if (last.on && fits && Date.now() - last.at < 10 * 60_000) setTv(last);
      if (!last.on) setTv((cur) => (cur && cur.cell === last.cell ? null : cur));
    }
    if (Object.keys(pops).length) setBubbles((b) => ({ ...b, ...pops }));
    if (tunes.length) {
      setLocalTune((m) => {
        const n = { ...m };
        for (const t of tunes.sort((a, b) => a.at - b.at)) n[t.key] = t.value;
        return n;
      });
    }
  }, [peers]);
  const peerEls = useRef(new Map<string, { el: HTMLDivElement; x: number; y: number }>());

  useEffect(() => {
    // Start on top of whatever is at the spawn column now.
    const cx = Math.floor(ISLAND.w / 2);
    let y = 0;
    while (y < ISLAND.h && !solidAt(islRef.current, cx, y)) y++;
    pos.current = { x: cx + (1 - PW) / 2, y: y - PH - 0.01 };
  }, []);
  // Dev only, for the browser checks: stand the player on top of column x.
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const w = window as unknown as { __islandPut?: (x: number, from?: number) => void };
    w.__islandPut = (x, from = 0) => {
      let y = from;
      while (y < ISLAND.h && !solidAt(islRef.current, x, y)) y++;
      pos.current = { x: x + (1 - PW) / 2, y: y - PH - 0.01 };
      vel.current = { x: 0, y: 0 };
    };
    return () => void delete w.__islandPut;
  }, []);

  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const hits = (x: number, y: number) => {
      const s = islRef.current;
      for (let cy = Math.floor(y); cy <= Math.floor(y + PH - 1e-6); cy++)
        for (let cx = Math.floor(x); cx <= Math.floor(x + PW - 1e-6); cx++) if (cx < 0 || cx >= ISLAND.w || solidAt(s, cx, cy)) return true;
      return false;
    };
    // What's in the cells the player's box covers.
    const touching = (x: number, y: number, kind: string, below = 0) => {
      const s = islRef.current;
      for (let cy = Math.floor(y); cy <= Math.floor(y + PH + below - 1e-6); cy++)
        for (let cx = Math.floor(x); cx <= Math.floor(x + PW - 1e-6); cx++) if (kindOf(fgAt(s, idx(cx, cy))) === kind) return idx(cx, cy);
      return -1;
    };
    let downWas = false;
    let upWas = false;
    const step = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const k = keys.current;
      const p = pos.current;
      const v = vel.current;
      const isl = islRef.current;
      const want = (k.has('right') ? SPEED : 0) - (k.has('left') ? SPEED : 0);
      // On ice (the frozen caves): you slide, slow to start and to stop.
      const under = fgAt(isl, idx(Math.floor(p.x + PW / 2), Math.floor(p.y + PH + 0.05)));
      v.x = isl.world && under === 'dungeon-ice' && ground.current ? v.x + (want - v.x) * Math.min(1, dt * 2.2) : want;
      // On a ladder (or standing right on top of one, so you can stop there and step off sideways).
      const ladder = touching(p.x, p.y, 'ladder', 0.15) >= 0;
      const down = k.has('down');
      if ((k.has('jump') || (k.has('up') && !ladder)) && (ground.current || ladder) && !(ladder && k.has('up'))) {
        v.y = -JUMP;
        ground.current = false;
      }
      // On a ladder: up and down climb, and you hang on (no falling).
      if (ladder && (k.has('up') || down || !ground.current) && !k.has('jump')) v.y = k.has('up') ? -CLIMB : down ? CLIMB : 0;
      else v.y = Math.min(20, v.y + GRAVITY * dt);
      // A warp pad underfoot, and Down pressed: off to the next pad.
      if (down && !downWas && !ladder) {
        const pad = touching(p.x, p.y, 'warp');
        if (pad >= 0) {
          const pads = Object.keys(isl.fg)
            .map(Number)
            .filter((c) => kindOf(isl.fg[c]) === 'warp')
            .sort((a, b) => a - b);
          const to = pads[(pads.indexOf(pad) + 1) % pads.length];
          if (to !== undefined && to !== pad) {
            const t = xy(to);
            p.x = t.x + (1 - PW) / 2;
            p.y = t.y + 1 - PH - 0.01;
            v.y = 0;
            sfx.select();
          }
        }
      }
      // Down on a rail: into a minecart. Down by a seat or a bed: sit, or lie down.
      if (down && !downWas && !ladder && !pose.current && !ride.current) {
        const rail = touching(p.x, p.y, 'rail');
        if (touching(p.x, p.y, 'gate') >= 0) goRef.current(!isl.world);
        else if (rail >= 0) {
          const r = xy(rail);
          ride.current = { kind: 'cart', dir: facing.current ? -1 : 1, x: p.x + PW / 2, row: r.y, y: r.y };
          sfx.select();
        } else {
          let rest = -1;
          for (let cy = Math.floor(p.y); cy <= Math.floor(p.y + PH - 1e-6); cy++)
            for (let cx = Math.floor(p.x); cx <= Math.floor(p.x + PW - 1e-6); cx++) if (rest < 0 && restOf(fgAt(isl, idx(cx, cy)))) rest = idx(cx, cy);
          if (rest >= 0) sitRef.current(rest);
        }
      }
      downWas = down;
      // Up at a zipline post: slide along its rope (the way you face, or the other way if there's none that way).
      const up = k.has('up');
      if (up && !upWas && !pose.current && !ride.current) {
        // (A post right below the feet counts: standing on the step beside it.)
        const post = touching(p.x, p.y, 'zip', 1);
        if (post >= 0) {
          const lines = zipLines(isl);
          const right = lines.find(([a]) => a === post)?.[1];
          const left = lines.find(([, b]) => b === post)?.[0];
          const to = facing.current ? (left ?? right) : (right ?? left);
          if (to !== undefined) {
            const a = xy(post);
            const b = xy(to);
            ride.current = { kind: 'zip', ax: a.x + 0.5, ay: a.y + 0.12, bx: b.x + 0.5, by: b.y + 0.12, t: 0, len: Math.hypot(b.x - a.x, b.y - a.y), to };
            sfx.whoosh();
          }
        }
      }
      upWas = up;
      // Across: blocked by a one-cell step on the ground → climb it.
      const nx = p.x + v.x * dt;
      if (!hits(nx, p.y)) p.x = nx;
      else if (ground.current && !hits(nx, p.y - 1)) {
        p.x = nx;
        p.y = Math.floor(p.y) - 1 + (1 - PH) - 0.01;
      } else p.x = v.x > 0 ? Math.floor(nx + PW) - PW - 0.001 : Math.ceil(nx) + 0.001;
      // Down (or up). A platform holds you from above (Down drops through it); a trampoline throws you up.
      const ny = p.y + v.y * dt;
      const feet = Math.floor(ny + PH);
      let platform = false;
      if (v.y > 0 && !down && p.y + PH <= feet + 0.02)
        for (let cx = Math.floor(p.x); cx <= Math.floor(p.x + PW - 1e-6); cx++) if (kindOf(fgAt(isl, idx(cx, feet))) === 'platform') platform = true;
      if (!hits(p.x, ny) && !platform) {
        p.y = ny;
        ground.current = false;
      } else {
        let bounce = false;
        if (v.y > 0) {
          p.y = feet - PH - 0.001;
          ground.current = true;
          for (let cx = Math.floor(p.x); cx <= Math.floor(p.x + PW - 1e-6); cx++) if (kindOf(fgAt(isl, idx(cx, feet))) === 'bounce') bounce = true;
        } else p.y = Math.ceil(ny) + 0.001;
        v.y = 0;
        if (bounce) {
          v.y = -JUMP * 1.45;
          ground.current = false;
          sfx.select();
        }
      }
      // In the sea: back to the middle.
      if (!isl.world && p.y > ISLAND.sea + 0.6 && (p.x < 4 || p.x > ISLAND.w - 5)) {
        const s = spawn();
        let y = 0;
        while (y < ISLAND.h && !solidAt(islRef.current, Math.floor(s.x), y)) y++;
        p.x = s.x;
        p.y = y - PH - 0.01;
        v.y = 0;
      }
      // The traps (in the dungeon): spikes, icicles, thorns, lava, a fire jet while it flares: back to the gate.
      const trap = isl.world ? touching(p.x, p.y, 'spikes') : -1;
      if (trap >= 0) {
        const what = fgAt(isl, trap);
        if (what !== 'fire-jet' || fireJetOn()) goRef.current(true, what ?? 'spikes');
      }
      // Sitting or asleep: held there, until a move gets them up.
      const seat = pose.current;
      if (seat) {
        if (k.has('left') || k.has('right') || k.has('jump') || k.has('up')) standRef.current();
        else {
          p.x = seat.x;
          p.y = seat.y;
          v.x = 0;
          v.y = 0;
          ground.current = true;
        }
      }
      // Riding: the cart runs along the rails (one cell up or down a step too) until they end; the zipline carries you
      // to the next post. Space jumps off.
      const r = ride.current;
      if (r) {
        if (k.has('jump')) {
          ride.current = null;
          v.y = r.kind === 'cart' ? -JUMP : 0;
          ground.current = false;
        } else if (r.kind === 'cart') {
          if (k.has('left')) r.dir = -1;
          else if (k.has('right')) r.dir = 1;
          const nx = r.x + r.dir * CART * dt;
          const col = Math.floor(nx);
          if (col !== Math.floor(r.x)) {
            const row = [r.row, r.row - 1, r.row + 1].find((yy) => yy >= 0 && yy < ISLAND.h && col >= 0 && col < ISLAND.w && kindOf(fgAt(isl, idx(col, yy))) === 'rail');
            if (row === undefined) ride.current = null;
            else (r.row = row), (r.x = nx);
          } else r.x = nx;
          r.y += (r.row - r.y) * Math.min(1, dt * 14);
          p.x = r.x - PW / 2;
          p.y = r.y + 1 - PH - 0.06;
          v.x = 0;
          v.y = 0;
          ground.current = true;
          facing.current = r.dir < 0;
          if (me.current) me.current.dataset.left = r.dir < 0 ? '1' : '';
        } else {
          r.t = Math.min(1, r.t + (ZIP_SPEED * dt) / Math.max(1, r.len));
          p.x = r.ax + (r.bx - r.ax) * r.t - PW / 2;
          p.y = r.ay + (r.by - r.ay) * r.t + 0.32;
          v.x = 0;
          v.y = 0;
          facing.current = r.bx < r.ax;
          if (me.current) me.current.dataset.left = r.bx < r.ax ? '1' : '';
          if (r.t >= 1) {
            const b = xy(r.to);
            p.x = b.x + (1 - PW) / 2;
            p.y = b.y + 1 - PH - 0.01;
            ride.current = null;
          }
        }
      }
      // The camera follows the player, across and (gently) up and down; the player is drawn where it is.
      const t = TRef.current;
      const view = box.current?.clientWidth ?? 600;
      const viewH = box.current?.clientHeight ?? VIEW_ROWS * t;
      cam.current = Math.max(0, Math.min(ISLAND.w * t - view, (p.x + PW / 2) * t - view / 2));
      const wantY = Math.max(0, Math.min(ISLAND.h * t - viewH, (p.y + PH / 2) * t - viewH * 0.55));
      camY.current = camY.current < 0 ? wantY : camY.current + (wantY - camY.current) * Math.min(1, dt * 8);
      if (world.current) world.current.style.transform = `translate(${-cam.current}px, ${-camY.current}px)`;
      if (far.current) far.current.style.transform = `translate(${-cam.current * 0.3}px, ${-camY.current}px)`;
      // Underground, no sky: the stars and the moon fade out over a few rows below the surface.
      if (skyEl.current) skyEl.current.style.opacity = String(Math.max(0, Math.min(1, 1 - (camY.current / t - (ISLAND.sea - 10)) / 6)));
      if (v.x) facing.current = v.x < 0;
      if (me.current) {
        me.current.style.transform = `translate(${p.x * t}px, ${p.y * t}px)`;
        me.current.dataset.walking = v.x !== 0 && ground.current ? '1' : '';
        me.current.dataset.pose = pose.current?.kind ?? ride.current?.kind ?? '';
        if (v.x) me.current.dataset.left = v.x < 0 ? '1' : '';
      }
      // The others glide to where they last said they were.
      const all: { x: number; y: number }[] = [p];
      for (const peer of peersRef.current) {
        const e = peerEls.current.get(peer.uid);
        if (!e) continue;
        const f = Math.min(1, dt * 8);
        if (Math.abs(peer.x - e.x) > 6 || Math.abs(peer.y - e.y) > 6) (e.x = peer.x), (e.y = peer.y);
        e.x += (peer.x - e.x) * f;
        e.y += (peer.y - e.y) * f;
        e.el.style.transform = `translate(${e.x * t}px, ${e.y * t}px)`;
        e.el.dataset.walking = Math.abs(peer.x - e.x) > 0.05 ? '1' : '';
        all.push(e);
      }
      // Doors open when someone stands by them.
      world.current?.querySelectorAll<HTMLElement>('[data-door]').forEach((d) => {
        const c = xy(Number(d.dataset.door));
        const open = all.some((q) => Math.abs(q.x + PW / 2 - (c.x + 0.5)) < 1.3 && Math.abs(q.y + PH / 2 - (c.y + 0.5)) < 1);
        if ((d.dataset.open === '1') !== open) d.dataset.open = open ? '1' : '';
      });
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, []);

  // The music makers near the player, heard every 100 ms (the band schedules a little ahead).
  const tunes = useMemo(() => {
    const t: Record<string, string> = { ...(isl.tune ?? {}) };
    for (const [k, v] of Object.entries(localTune)) {
      if (v) t[k] = v;
      else delete t[k];
    }
    return t;
  }, [isl, localTune]);
  const tunesRef = useRef(tunes);
  tunesRef.current = tunes;
  /** A device's volume (its setting: "vol:<key>", 0–100), 0–1. */
  const volOf = (key: string) => {
    const v = tunes[`vol:${key}`];
    return v === undefined ? 1 : Math.max(0, Math.min(1, Number(v) / 100 || 0));
  };
  /** What's at a device's key ("<cell>", "b<cell>", "t<cell>"), and where. */
  const itemAt = (key: string) => {
    const m = /^([bt]?)(\d+)$/.exec(key);
    if (!m) return undefined;
    const c = Number(m[2]);
    return m[1] === 'b' ? isl.bg[c] : m[1] === 't' ? isl.front?.[c] : fgAt(isl, c);
  };
  const spotOf = (key: string) => {
    const c = Number(/\d+$/.exec(key)?.[0] ?? -1);
    return { x: xy(c).x + 0.5, y: xy(c).y + 0.5 };
  };
  /** The speakers linked to each device (by the device's key): their keys. */
  const speakersOf = useMemo(() => {
    const by: Record<string, string[]> = {};
    for (const [k, v] of Object.entries(tunes)) if (k.startsWith('to:')) (by[v] ??= []).push(k.slice(3));
    return by;
  }, [tunes]);
  const sources = useMemo<Source[]>(() => {
    const out: Source[] = [];
    for (const [layerName, map] of [['mid', isl.fg], ['back', isl.bg], ['front', isl.front ?? {}]] as [Layer, Record<string, string>][])
      for (const [k, id] of Object.entries(map)) {
        if (kindOf(id) !== 'music') continue;
        const key = layerKey(layerName, Number(k));
        const t = tunes[key];
        // Off; a YouTube video (its own player plays it); a speaker linked to a radio or TV (it plays that).
        if (t === 'off' || ytOf(t) || tunes[`to:${key}`]) continue;
        out.push({ key, id: t ?? id, x: xy(Number(k)).x + 0.5, y: xy(Number(k)).y + 0.5, gain: volOf(key) });
      }
    // A speaker linked to a radio playing its tune or a disc: that, from the speaker too.
    for (const [target, speakers] of Object.entries(speakersOf)) {
      const id = itemAt(target);
      const t = tunes[target];
      if (!id || kindOf(id) !== 'music' || t === 'off' || ytOf(t)) continue;
      for (const sp of speakers) if (itemAt(sp)) out.push({ key: `spk:${sp}`, id: t ?? id, ...spotOf(sp), gain: volOf(target) * volOf(sp) });
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isl, tunes, speakersOf]);
  const srcRef = useRef(sources);
  srcRef.current = sources;
  useEffect(() => {
    const band = islandBand();
    const t = window.setInterval(() => {
      if (document.hidden) return;
      const p = pos.current;
      band.tick(srcRef.current, p.x + PW / 2, p.y + PH / 2);
    }, 100);
    return () => (window.clearInterval(t), band.stop());
  }, []);

  // What plays its own sound (a radio's YouTube video, the TV that's on): how near the player is to it, or to a speaker
  // linked to it (0–1), every quarter second.
  const loud = useMemo(() => {
    const out: { key: string; spots: { x: number; y: number }[]; reach: number }[] = [];
    for (const [k, v] of Object.entries(tunes)) {
      if (!ytOf(v) || !/^[bt]?\d+$/.test(k)) continue;
      const id = itemAt(k);
      if (id && kindOf(id) === 'music') out.push({ key: k, spots: [spotOf(k), ...(speakersOf[k] ?? []).filter((sp) => itemAt(sp)).map(spotOf)], reach: HEAR + 2 });
    }
    if (tv) {
      const k = String(tv.cell);
      out.push({ key: k, spots: [spotOf(k), ...(speakersOf[k] ?? []).filter((sp) => itemAt(sp)).map(spotOf)], reach: TV_HEAR });
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isl, tunes, speakersOf, tv]);
  const loudRef = useRef(loud);
  loudRef.current = loud;
  const [near, setNear] = useState<Record<string, number>>({});
  useEffect(() => {
    const t = window.setInterval(() => {
      if (document.hidden) return;
      const p = pos.current;
      const lx = p.x + PW / 2;
      const ly = p.y + PH / 2;
      const next: Record<string, number> = {};
      for (const d of loudRef.current)
        next[d.key] = Math.max(0, ...d.spots.map((s) => {
          const dist = Math.hypot(s.x - lx, s.y - ly);
          return dist >= d.reach ? 0 : (1 - dist / d.reach) ** 1.5;
        }));
      setNear((cur) => {
        const keys = new Set([...Object.keys(cur), ...Object.keys(next)]);
        for (const k of keys) if (Math.abs((cur[k] ?? 0) - (next[k] ?? 0)) > 0.03) return next;
        return cur;
      });
    }, 250);
    return () => window.clearInterval(t);
  }, []);
  const clipLevel = useProgress((s) => (s.sound ? s.clipVolume / 100 : 0));

  // The keys: arrows or WASD, Space to jump (while the island has the focus).
  const keyOf = (k: string) =>
    k === 'ArrowLeft' || k === 'a' || k === 'q' ? 'left' : k === 'ArrowRight' || k === 'd' ? 'right' : k === 'ArrowUp' || k === 'w' || k === 'z' ? 'up' : k === 'ArrowDown' || k === 's' ? 'down' : k === ' ' ? 'jump' : null;
  const onKey = (down: boolean) => (e: React.KeyboardEvent) => {
    const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    // E: the next tool; 1–5: a tool; F: the layer Build uses.
    if (down && !e.ctrlKey && !e.metaKey && !e.altKey) {
      // R: the emote wheel; while it's open, 1–8 pick one and Escape closes it.
      if (e.code === 'KeyR' && !e.repeat) return e.preventDefault(), setWheelOpen((o) => !o);
      if (wheelOpen) {
        const w = /^(?:Digit|Numpad)([1-8])$/.exec(e.code)?.[1];
        if (w) return e.preventDefault(), emote(EMOTES[Number(w) - 1]);
        if (key === 'Escape') return e.preventDefault(), setWheelOpen(false);
      }
      // Fishing: Space hooks and reels; walking off reels the line in.
      if (fishRef.current) {
        if (key === ' ') return e.preventDefault(), e.repeat ? undefined : fishAct();
        if (keyOf(key) === 'left' || keyOf(key) === 'right') setFishing(null), say(tr('🎣 Line reeled in.', '🎣 Ligne remontée.'));
      }
      if (key === 'e') return e.preventDefault(), chooseTool(tools[(tools.findIndex((t) => t.id === tool) + 1) % tools.length].id);
      // The digit keys by where they are (AZERTY types & é " ' ( there without Shift), or the number pad.
      const n = /^(?:Digit|Numpad)([1-5])$/.exec(e.code)?.[1];
      if (n && tools[Number(n) - 1]) return e.preventDefault(), chooseTool(tools[Number(n) - 1].id);
      if (key === 'f' && tool === 'build') return e.preventDefault(), setLayer((l) => LAYERS[(LAYERS.findIndex((x) => x.id === l) + 1) % LAYERS.length].id);
    }
    const k = keyOf(key);
    if (!k) return;
    e.preventDefault();
    if (down) keys.current.add(k);
    else keys.current.delete(k);
  };

  // Which cell is under the pointer, and whether it's in reach.
  const cellAt = (e: React.PointerEvent) => {
    const r = box.current!.getBoundingClientRect();
    const x = Math.floor((e.clientX - r.left + cam.current) / T);
    const y = Math.floor((e.clientY - r.top + Math.max(0, camY.current)) / T);
    return x >= 0 && y >= 0 && x < ISLAND.w && y < ISLAND.h ? idx(x, y) : null;
  };
  const inReach = (cell: number) => {
    const { x, y } = xy(cell);
    const p = pos.current;
    return Math.hypot(x + 0.5 - (p.x + PW / 2), y + 0.5 - (p.y + PH / 2)) <= ISLAND.reach;
  };
  const say = (msg: ReactNode) => setNote(msg);
  const chooseTool = (t: Tool) => (setTool(t), say(null), box.current?.focus());
  const run = (move: Move, ok: string, what?: string, then?: () => void) =>
    void Promise.resolve(act(move, what)).then((err) => {
      if (err) return say(`⚠️ ${err}`);
      say(ok);
      sfx.select();
      then?.();
    });

  const click = (cell: number) => {
    box.current?.focus();
    if (fishRef.current) return fishAct();
    if (!inReach(cell)) return say(tr('Too far: walk closer.', 'Trop loin : approche-toi.'));
    // The tool in hand swings.
    const m = me.current;
    if (m && tool !== 'walk') {
      m.dataset.swing = '';
      void m.offsetWidth;
      m.dataset.swing = '1';
    }
    const plot = isl.plots[cell];
    const front = fgAt(isl, cell);
    const mine = !!plot && (who ? (plot.by ? plot.by === who.uid : who.uid === who.owner) : true);
    if (plot && isReady(plot) && mine) return setReaping(cell);
    // A friend's plant still growing: water it (a day sooner), and get a seed for helping.
    if (plot && who && !mine && !plot.water && !isReady(plot)) {
      return run(
        (i) => water(i, cell, who),
        '',
        'water',
        () => {
          const seed = helpSeed(plot);
          const got = helpReward(seed);
          say(
            `💧 ${tr('Watered: it’ll be ready a day sooner.', 'Arrosé : prêt un jour plus tôt.')} ${got ? `+ ${nameOf(SEED_BY_ID.get(seed)!)} ${tr('for helping!', 'pour ton aide !')}` : tr('(No more helper seeds today.)', '(Plus de graines d’entraide aujourd’hui.)')}`,
          );
        },
      );
    }
    if (plot)
      return say(
        `🌱 ${plot.by && names[plot.by] ? `${names[plot.by]} · ` : ''}${isReady(plot) ? tr('Ready: theirs to harvest.', 'Prêt : à eux de récolter.') : `${tr('Growing: ready on', 'Pousse : prêt le')} ${readyOn(plot)}`}${plot.water ? ` · 💧 ${plot.waterBy && names[plot.waterBy] ? names[plot.waterBy] : ''}` : ''}`,
      );
    if (tool === 'walk') {
      const card = isl.shown[cell];
      if (!isl.world && isSea(xy(cell).x, xy(cell).y)) return cast(cell);
      if (front && kindOf(front) === 'gate') return go(!inDungeon);
      if (front && kindOf(front) === 'craft') return setCrafting(front as Station);
      if (front === 'dungeon-chest-open') return say(tr('🧰 Empty: you opened it already.', '🧰 Vide : tu l’as déjà ouvert.'));
      if (front === 'dungeon-chest') {
        const loot = openChest(cell);
        if (!loot) return;
        sfx.victory();
        return say(
          `🧰 +${loot.coins} Dle Coins${loot.seed ? ` · ${nameOf(SEED_BY_ID.get(loot.seed)!)}` : ''} · ${loot.items.map((id) => `${itemIcon(id)} ${itemName(id)}`).join(', ')}`,
        );
      }
      if (restOf(front)) return sitOn(cell);
      // Music: a record or CD player takes a disc; anything else switches on and off. Front first, then middle, then behind.
      const music = (['front', 'mid', 'back'] as Layer[])
        .map((l) => ({ l, id: l === 'front' ? isl.front?.[cell] : l === 'mid' ? front : isl.bg[cell] }))
        .find((m) => m.id && kindOf(m.id) === 'music');
      if (music?.id) {
        const key = layerKey(music.l, cell);
        if (DISC_PLAYERS[music.id]) return setDiscing({ key, player: music.id });
        if (music.id === 'speaker') return setSpeaking(key);
        const off = tunes[key] === 'off';
        tuneTo(key, off ? null : 'off');
        return say(`${off ? '🔊' : '🔇'} ${itemName(music.id)}: ${off ? tr('on', 'allumé') : tr('off', 'éteint')}${mode === 'visit' ? ` ${tr('(while you’re here)', '(tant que tu es là)')}` : ''}`);
      }
      if (front && kindOf(front) === 'reader') {
        const c = card ? CARD_BY_ID.get(card) : undefined;
        if (!c) return mode === 'visit' ? say(tr('No card in this reader.', 'Pas de carte dans ce lecteur.')) : setFraming(cell);
        playVoice(c, true);
        return say(
          <>
            📇 {shownName(c.name, c.set)}
            {c.voice ? <> : « {c.voice} »</> : null}{' '}
            {mode !== 'visit' && (
              <button type="button" className="font-semibold text-accent underline" onClick={() => setFraming(cell)}>
                {tr('Change the card', 'Changer de carte')}
              </button>
            )}
          </>,
        );
      }
      if (front && kindOf(front) === 'frame') {
        if (mode === 'visit') return card && CARD_BY_ID.get(card) ? say(`🖼️ ${shownName(CARD_BY_ID.get(card)!.name, CARD_BY_ID.get(card)!.set)}`) : undefined;
        return setFraming(cell);
      }
      if (front && kindOf(front) === 'screen') {
        // On already: off (for everyone there, like switching it on).
        if (tv && tv.cell === cell) {
          myTv.current = { ...tv, at: Date.now(), on: false };
          setTv(null);
          return say(tr('📺 Off.', '📺 Éteinte.'));
        }
        // A YouTube video set on it: that.
        const yt = ytOf(tunes[String(cell)]);
        if (yt) {
          const show: TvEvent = { cell, card: '', clip: `${YT}${yt}`, at: Date.now(), on: true };
          myTv.current = show;
          setTv(show);
          return say(
            <>
              📺 {tr('On air (click the TV again to switch it off; ⛶ for full screen).', 'À l’antenne (reclique la télé pour l’éteindre ; ⛶ pour le plein écran).')}{' '}
              {mode !== 'visit' && (
                <button type="button" className="font-semibold text-accent underline" onClick={() => setFraming(cell)}>
                  {tr('Change', 'Changer')}
                </button>
              )}
            </>,
          );
        }
        if (!card) return mode === 'visit' ? say(tr('Nothing on this screen.', 'Rien sur cet écran.')) : setFraming(cell);
        const clips = screenClips(CARD_BY_ID.get(card));
        if (!clips.length) return say(tr('This card has no clip to show.', 'Cette carte n’a pas de clip à passer.'));
        const show: TvEvent = { cell, card, clip: clips[Math.floor(Math.random() * clips.length)], at: Date.now(), on: true };
        myTv.current = show;
        setTv(show);
        return say(
          <>
            📺 {tr('On air (click the TV again to switch it off).', 'À l’antenne (reclique la télé pour l’éteindre).')}{' '}
            {mode !== 'visit' && (
              <button type="button" className="font-semibold text-accent underline" onClick={() => setFraming(cell)}>
                {tr('Change the card', 'Changer de carte')}
              </button>
            )}
          </>,
        );
      }
      return;
    }
    if (tool === 'build') {
      if (!pick) return say(tr('Pick something to build from your bag below.', 'Choisis quoi construire dans ton sac ci-dessous.'));
      const id = pick;
      const where = kindOf(id) === 'wall' ? 'back' : layer;
      if (!canLayer(id, where) && kindOf(id) !== 'wall')
        return say(`⚠️ ${where === 'back' ? tr('That can’t go behind: pick Middle.', 'Ça ne va pas derrière : choisis Milieu.') : tr('That can’t go in front: pick Middle.', 'Ça ne va pas devant : choisis Milieu.')}`);
      run((i, it) => place(i, it, cell, id, who, kindOf(id) === 'wall' ? 'mid' : layer), `${itemIcon(id)} ${itemName(id)}`, 'build', () => {
        if (where === 'mid' && (kindOf(id) === 'frame' || kindOf(id) === 'screen' || kindOf(id) === 'reader')) setFraming(cell);
      });
      if ((items[pick] ?? 0) <= 1) setPick(null);
      return;
    }
    if (tool === 'pick') return run((i, it) => pickUp(i, it, cell, who), tr('Back in your bag.', 'De retour dans ton sac.'), 'pick');
    if (tool === 'dig') {
      const got = fgAt(isl, cell);
      return run((i, it) => dig(i, it, cell), got ? `⛏️ +1 ${itemName(got)} ${tr('(in your bag)', '(dans ton sac)')}` : '', 'dig');
    }
    if (tool === 'plant') {
      if (pair.length < 2) return say(tr('Pick two seeds below first (the same one twice is fine).', 'Choisis d’abord deux graines ci-dessous (deux fois la même, ça marche).'));
      const [a, b] = pair;
      run((i, _it, sd) => plant(i, sd, cell, a, b, todayKey(), who), tr('Planted! Come back tomorrow.', 'Planté ! Reviens demain.'), 'plant', () => setPair([]));
    }
  };

  /** Through the gate: down to the week's dungeon, or back up to the island (or hurt by spikes: back to the dungeon's gate). */
  const go = (down: boolean, hurt: string | false = false) => {
    const cell = down ? dungeonOf(week).entry : ISLAND_GATE;
    const { x, y } = xy(cell);
    // The new place at once (the next frame mustn't run into the old one's walls).
    islRef.current = down ? dungeonIsland(week, dungeonFg) : home;
    pos.current = { x: x + (1 - PW) / 2, y: y + 1 - PH - 0.01 };
    vel.current = { x: 0, y: 0 };
    ride.current = null;
    pose.current = null;
    camY.current = -1;
    setPoseNow(null);
    setFishing(null);
    setTv(null);
    setInDungeon(down);
    if (!TOOLS.some((t) => t.id === tool && (!down || t.id === 'walk' || t.id === 'dig'))) setTool('walk');
    if (hurt) {
      sfx.wrong();
      const ouch: Record<string, [string, string]> = {
        icicles: ['🧊 An icicle! Back to the gate.', '🧊 Une stalactite de glace ! Retour à la porte.'],
        thorns: ['🌵 Thorns! Back to the gate.', '🌵 Des ronces ! Retour à la porte.'],
        lava: ['🌋 Lava! Back to the gate.', '🌋 De la lave ! Retour à la porte.'],
        'fire-jet': ['🔥 Burnt by a fire jet! Back to the gate.', '🔥 Brûlé par un jet de feu ! Retour à la porte.'],
      };
      const [en, fr] = ouch[hurt] ?? ['🔺 Ouch, spikes! Back to the gate.', '🔺 Aïe, des pics ! Retour à la porte.'];
      return say(tr(en, fr));
    }
    sfx.whoosh();
    say(
      down
        ? tr(
            '🕯️ This week’s dungeon. Open the chests (Dle Coins, a seed, ore), mine the ore in the walls. Deeper down: the frozen caves (ice you slide on, icicles), the overgrown ruins (thorns, vines to climb), the magma depths (lava, fire jets). The gate takes you back up; next week, a new dungeon.',
            '🕯️ Le donjon de la semaine. Ouvre les coffres (Dle Coins, une graine, du minerai), mine le minerai des murs. Plus bas : les grottes gelées (de la glace qui glisse, des stalactites), les ruines envahies (des ronces, des lianes à grimper), les profondeurs de magma (de la lave, des jets de feu). La porte te ramène en haut ; la semaine prochaine, un nouveau donjon.',
          )
        : tr('🏝️ Back on the island.', '🏝️ De retour sur l’île.'),
    );
  };
  const goRef = useRef(go);
  goRef.current = go;

  /** Sits on a seat, or lies down on a bed. */
  const sitOn = (cell: number) => {
    const kind = restOf(fgAt(islRef.current, cell));
    if (!kind) return;
    const { x, y } = xy(cell);
    pose.current = { kind, x: x + (1 - PW) / 2, y: y + 1 - PH - 0.01 + (kind === 'sit' ? 0.12 : 0.3) };
    setFishing(null);
    setPoseNow(kind);
    say(kind === 'sit' ? tr('🪑 Sitting. Move to get up.', '🪑 Assis. Bouge pour te lever.') : tr('💤 Lying down. Sleep at night and morning comes (for you). Move to get up.', '💤 Allongé. Dors la nuit et le matin arrive (pour toi). Bouge pour te lever.'));
  };
  const sitRef = useRef(sitOn);
  sitRef.current = sitOn;
  const standRef = useRef(() => {});
  standRef.current = () => {
    pose.current = null;
    setPoseNow(null);
  };
  // Asleep a moment at night: the night ends, for this player.
  useEffect(() => {
    if (poseNow !== 'sleep' || sky !== 'auto' || clockDark < 0.3 || Date.now() < restUntil) return;
    const t = window.setTimeout(() => {
      if (pose.current?.kind !== 'sleep') return;
      setRestUntil(nextMorning());
      say(tr('☀️ Good morning! The night is over (for you).', '☀️ Bonjour ! La nuit est finie (pour toi).'));
      sfx.correct();
    }, 2600);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [poseNow]);

  /** Pops an emote over the player's head (everyone there sees it). */
  const emote = (e: string) => {
    const at = Date.now();
    myEmote.current = { e, at };
    setBubbles((b) => ({ ...b, me: { e, until: at + 3500 } }));
    setWheelOpen(false);
    box.current?.focus();
  };
  // Bubbles go after a few seconds.
  useEffect(() => {
    const all = Object.values(bubbles);
    if (!all.length) return;
    const next = Math.min(...all.map((b) => b.until));
    const t = window.setTimeout(() => setBubbles((b) => Object.fromEntries(Object.entries(b).filter(([, v]) => v.until > Date.now()))), Math.max(50, next - Date.now()));
    return () => window.clearTimeout(t);
  }, [bubbles]);

  /** Casts the line into the sea (from the shore: the cell must be in reach). */
  const cast = (cell: number) => {
    if (pose.current) return;
    if (!ground.current) return say(tr('Stand still on the shore to fish.', 'Reste sur le rivage pour pêcher.'));
    const p = pos.current;
    const left = xy(cell).x + 0.5 < p.x + PW / 2;
    facing.current = left;
    if (me.current) me.current.dataset.left = left ? '1' : '';
    // From the rod's tip (drawn in the hand, on the side the player faces).
    const fx = left ? p.x - 0.44 * PW : p.x + 1.44 * PW;
    setFishing({ cell, phase: 'wait', got: rollCatch(), start: Date.now(), zone: 0, at: 0, fx, fy: p.y + 0.23 * PH });
    sfx.whoosh();
    say(tr('🎣 Cast! When the float dips, click (or Space).', '🎣 Lancé ! Quand le bouchon plonge, clique (ou Espace).'));
  };
  /** A click (or Space) while fishing: too soon, hooked, or the reel stopped. */
  const fishAct = () => {
    const f = fishRef.current;
    if (!f) return;
    if (f.phase === 'wait') {
      setFishing(null);
      return say(tr('💨 Too soon: it swam off.', '💨 Trop tôt : il s’est sauvé.'));
    }
    if (f.phase === 'bite') {
      const zone = zoneOf(f.got);
      setFishing({ ...f, phase: 'reel', start: Date.now(), zone, at: 0.08 + Math.random() * (0.84 - zone) });
      return say(tr('🎣 Hooked! Stop the marker in the green.', '🎣 Ferré ! Arrête le curseur dans le vert.'));
    }
    const m = markerAt(Date.now() - f.start);
    setFishing(null);
    if (m < f.at || m > f.at + f.zone) {
      sfx.wrong();
      return say(tr('💨 It slipped off the hook.', '💨 Il s’est décroché.'));
    }
    const got = fishReward(f.got);
    sfx.correct();
    say(
      got.kind === 'fish'
        ? `🎣 ${itemIcon(got.item)} ${itemName(got.item)}! ${tr('(In your bag.)', '(Dans ton sac.)')}`
        : got.kind === 'seed'
          ? `🍾 ${tr('A bottle with a seed inside:', 'Une bouteille avec une graine dedans :')} ${nameOf(SEED_BY_ID.get(got.seed)!)}`
          : `🪙 +${got.coins} ${tr('Dle Coins, fished up!', 'Dle Coins repêchés !')}`,
    );
  };
  // The fish bites after a while; the float stays down a moment; the reel doesn't wait forever.
  useEffect(() => {
    if (!fishing) return;
    const start = fishing.start;
    const later = (ms: number, then: () => void) => {
      const t = window.setTimeout(() => fishRef.current?.start === start && then(), ms);
      return () => window.clearTimeout(t);
    };
    if (fishing.phase === 'wait')
      return later(FISHING.waitMin + Math.random() * (FISHING.waitMax - FISHING.waitMin), () => {
        sfx.near();
        setFishing((f) => f && { ...f, phase: 'bite', start: Date.now() });
      });
    if (fishing.phase === 'bite') return later(FISHING.bite, () => (setFishing(null), say(tr('💨 It got away…', '💨 Il s’est échappé…'))));
    return later(6000, () => (setFishing(null), say(tr('💨 It slipped off the hook.', '💨 Il s’est décroché.'))));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fishing?.phase, fishing?.start]);

  /** A music maker's setting: saved on the island (yours, or one you build on); just for you when visiting. */
  const tuneTo = (key: string, t: string | null) => {
    if (mode === 'visit') {
      // Heard by everyone there now (not saved on the island).
      myTune.current = { key, value: t, at: Date.now() };
      return setLocalTune((m) => ({ ...m, [key]: t }));
    }
    // Saved on the island; a visitor's switch heard before gives way.
    setLocalTune((m) => {
      if (!(key in m)) return m;
      const n = { ...m };
      delete n[key];
      return n;
    });
    run((i) => setTune(i, key, t), '', 'build');
  };

  /** Several settings at once (one change on the island, not one each). */
  const tuneMany = (pairs: [string, string | null][]) => {
    if (mode === 'visit') {
      for (const [key, t] of pairs) myTune.current = { key, value: t, at: Date.now() };
      return setLocalTune((m) => ({ ...m, ...Object.fromEntries(pairs) }));
    }
    setLocalTune((m) => {
      if (!pairs.some(([k]) => k in m)) return m;
      const n = { ...m };
      for (const [k] of pairs) delete n[k];
      return n;
    });
    run((i) => pairs.reduce<Change>((ch, [k, t]) => setTune(ch.island, k, t), { island: i } as Change), '', 'build');
  };
  /** A device's volume (0–100): saved on the island, or just for you when visiting. */
  const setVolume = (key: string, v: number) => tuneTo(`vol:${key}`, v >= 100 ? null : String(Math.round(v)));

  /** Harvests a ripe plot, taking the thing the player picked. */
  const reap = (cell: number, pick: string) => {
    let got: ReturnType<typeof harvest>['got'] | null = null;
    void Promise.resolve(
      act((i, it, sd) => {
        const h = harvest(i, it, sd, cell, Math.random, todayKey(), who, pick);
        got = h.got;
        return h;
      }, 'harvest'),
    ).then((err) => {
      if (err || !got) return say(`⚠️ ${err}`);
      const g = got as ReturnType<typeof harvest>['got'];
      sfx.victory();
      say(
        [
          `🌿 ${tr('Harvested', 'Récolté')}: ${itemIcon(g.item)} ${itemName(g.item)}`,
          g.seed ? `+ ${nameOf(SEED_BY_ID.get(g.seed)!)}` : '',
          g.hybrid ? `🧬 ${tr('Hybrid', 'Hybride')}: ${nameOf(SEED_BY_ID.get(g.hybrid)!)}!` : '',
        ]
          .filter(Boolean)
          .join(' · '),
      );
    });
  };

  const avatarCard = avatar ? CARD_BY_ID.get(avatar) : undefined;
  const allBag = Object.entries(items).filter(([, n]) => n > 0);
  const bagItems = allBag.filter(([id]) => kindOf(id) !== 'disc');
  const discs = allBag.filter(([id]) => kindOf(id) === 'disc');
  /** Whether a thing from the bag can go in the chosen layer (a wallpaper always goes behind). */
  const fitsLayer = (id: string) => kindOf(id) === 'wall' || canLayer(id, layer);
  // Changing the layer drops a pick that doesn't fit it.
  useEffect(() => {
    if (pick && kindOf(pick) !== 'wall' && !canLayer(pick, layer)) setPick(null);
  }, [layer, pick]);
  const bagSeeds = SEEDS.filter((s) => (seeds[s.id] ?? 0) > 0);
  const left = (id: string) => (seeds[id] ?? 0) - pair.filter((x) => x === id).length;
  const hoverOk = hover !== null && inReach(hover);
  // The scroll wheel over the island, while building: the next (or previous) thing in the bag.
  const wheel = useRef({ tool, pick, ids: bagItems.map(([id]) => id) });
  wheel.current = { tool, pick, ids: bagItems.map(([id]) => id).filter(fitsLayer) };
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const on = (e: WheelEvent) => {
      const w = wheel.current;
      if (w.tool !== 'build' || !w.ids.length || !e.deltaY) return;
      e.preventDefault();
      const i = w.pick ? w.ids.indexOf(w.pick) : -1;
      const n = w.ids.length;
      const next = w.ids[(((i + (e.deltaY > 0 ? 1 : -1)) % n) + n) % n];
      setPick(next);
      document.getElementById(`bag-${next}`)?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    };
    el.addEventListener('wheel', on, { passive: false });
    return () => el.removeEventListener('wheel', on);
  }, []);

  return (
    <div ref={root} className={`island-root space-y-3 ${big ? 'island-big' : ''}`}>
      {/* The island. */}
      <div
        ref={box}
        tabIndex={0}
        onKeyDown={onKey(true)}
        onKeyUp={onKey(false)}
        onBlur={() => keys.current.clear()}
        onPointerMove={(e) => setHover(cellAt(e))}
        onPointerLeave={() => setHover(null)}
        onPointerDown={(e) => {
          const c = cellAt(e);
          if (c !== null) click(c);
        }}
        className={`${inDungeon ? 'island-deep' : 'island-sky'} relative touch-none select-none overflow-hidden rounded-md border border-rule outline-none focus-visible:ring-2 focus-visible:ring-accent`}
        style={{ height: VIEW_ROWS * T }}
        aria-label={tr('Your island. Arrows or WASD to walk, Space to jump; click a spot to use the tool.', 'Ton île. Flèches ou ZQSD pour marcher, Espace pour sauter ; clique un endroit pour utiliser l’outil.')}
      >
        <div ref={far} className="pointer-events-none absolute left-0 top-0" style={{ width: ISLAND.w * T, height: ISLAND.h * T }}>
          {!inDungeon && <Backdrop T={T} />}
          {!inDungeon && <Clouds T={T} />}
        </div>
        <div className="island-night pointer-events-none absolute inset-0 transition-opacity duration-1000" style={{ opacity: inDungeon ? 0 : dark / 0.7 }} />
        <div ref={world} className="absolute left-0 top-0" style={{ width: ISLAND.w * T, height: ISLAND.h * T }}>
          <World isl={isl} T={T} tunes={tunes} />
          {hover !== null && tool !== 'walk' && (
            <div
              className={`pointer-events-none absolute rounded-sm border-2 ${hoverOk ? 'border-white/80 bg-white/10' : 'border-coral/70'}`}
              style={{ left: xy(hover).x * T, top: xy(hover).y * T, width: T, height: T }}
            >
              {tool === 'build' && pick && hoverOk && <ItemArt id={pick} className={`size-full ${layer === 'back' ? 'opacity-40' : 'opacity-60'}`} style={{ fontSize: T * 0.8 }} />}
            </div>
          )}
          {/* Night: everything darker, the lights glowing through (you stay lit). */}
          {dark > 0 && <div key="night" className="pointer-events-none absolute inset-0 transition-opacity duration-1000" style={{ background: '#0b1030', opacity: dark }} />}
          {dark > 0 && <Glows isl={isl} T={T} dark={dark} />}
          {peers.map((p) => {
            const face = p.face ? CARD_BY_ID.get(p.face) : undefined;
            return (
              <div
                key={p.uid}
                ref={(el) => {
                  // Keep where it's drawn between updates (it glides from there).
                  const had = peerEls.current.get(p.uid);
                  if (el) peerEls.current.set(p.uid, had ? { ...had, el } : { el, x: p.x, y: p.y });
                }}
                data-left={p.left ? '1' : ''}
                data-pose={p.pose ?? ''}
                className="island-me island-peer pointer-events-none absolute left-0 top-0"
                style={{ width: PW * T, height: PH * T }}
              >
                <span className="island-me-shadow" />
                {face ? <CardAvatar card={face} className="island-me-face size-full" /> : <span className="island-me-face grid size-full place-items-center rounded-full bg-sky-300 text-lg">🙂</span>}
                <ToolInHand tool={p.pose ? undefined : p.tool} />
                <RideArt />
                <span className="island-peer-name">{p.name}</span>
                {bubbles[p.uid] && (
                  <span key={bubbles[p.uid].until} className="island-emote" style={{ fontSize: T * 0.62 }}>
                    {bubbles[p.uid].e}
                  </span>
                )}
              </div>
            );
          })}
          <div key="me" ref={me} className="island-me pointer-events-none absolute left-0 top-0" style={{ width: PW * T, height: PH * T }}>
            <span className="island-me-shadow" />
            {avatarCard ? <CardAvatar card={avatarCard} className="island-me-face size-full" /> : <span className="island-me-face grid size-full place-items-center rounded-full bg-ochre text-lg">🙂</span>}
            <ToolInHand tool={poseNow ? undefined : fishing ? 'fish' : tool} />
            <RideArt />
            {bubbles.me && (
              <span key={bubbles.me.until} className="island-emote" style={{ fontSize: T * 0.62 }}>
                {bubbles.me.e}
              </span>
            )}
          </div>
          {fishing && <FishLine f={fishing} T={T} />}
          <FrontLayer isl={isl} T={T} />
          {tv && (
            <TvShow
              key={tv.at}
              tv={tv}
              T={T}
              level={clipLevel * volOf(String(tv.cell)) * (near[String(tv.cell)] ?? 1)}
              vol={volOf(String(tv.cell))}
              onVol={(v) => setVolume(String(tv.cell), v)}
              onEnd={() => setTv(null)}
              onOff={() => {
                myTv.current = { ...tv, at: Date.now(), on: false };
                setTv(null);
              }}
            />
          )}
          {/* The radios playing a YouTube video, heard from near them (or a speaker linked to them): its video small over it. */}
          {Object.entries(tunes).map(([k, v]) => {
            const id = ytOf(v);
            const n = near[k] ?? 0;
            if (!id || n <= 0 || !/^[bt]?\d+$/.test(k) || kindOf(itemAt(k)) !== 'music') return null;
            const { x, y } = spotOf(k);
            const w = 3.6 * T;
            const h = (w * 9) / 16;
            return (
              <YouTubeShow
                key={`${k}:${id}`}
                id={id}
                loop
                volume={clipLevel * volOf(k) * n}
                vol={volOf(k)}
                onVol={(vv) => setVolume(k, vv)}
                label={itemName(itemAt(k) ?? 'radio')}
                className="absolute"
                style={{ left: Math.max(0, Math.min(ISLAND.w * T - w, x * T - w / 2)), top: Math.max(2, (y - 0.5) * T - h - 6), width: w, height: h }}
              />
            );
          })}
        </div>
        {/* The stars and the moon (faded out as the camera goes underground: see the frame loop). */}
        {dark > 0 && !inDungeon && (
          <div ref={skyEl} className="pointer-events-none absolute inset-x-0 top-0 h-[40%]">
            <div className="island-stars absolute inset-0 transition-opacity duration-1000" style={{ opacity: dark / 0.7 }} />
          </div>
        )}
        {/* Asleep at night: the screen goes dark, then morning. */}
        <div className="pointer-events-none absolute inset-0 bg-black transition-opacity duration-[2000ms]" style={{ opacity: poseNow === 'sleep' && sky === 'auto' && clockDark >= 0.3 && Date.now() >= restUntil ? 0.85 : 0 }} />
        {fishing?.phase === 'reel' && (
          <div className="pointer-events-none absolute inset-x-0 bottom-3 flex flex-col items-center gap-1">
            <span className="rounded bg-black/60 px-2 text-xs font-semibold text-white">{tr('Click or Space in the green!', 'Clique ou Espace dans le vert !')}</span>
            <div className="relative h-5 w-64 max-w-[80%] rounded-full border-2 border-white/80 bg-black/50">
              <div className="absolute inset-y-0 rounded-full bg-emerald-400/85" style={{ left: `${fishing.at * 100}%`, width: `${fishing.zone * 100}%` }} />
              <div key={fishing.start} className="island-reel-mark" style={{ animationDuration: `${FISHING.sweep}ms` }} />
            </div>
          </div>
        )}
        {wheelOpen && (
          <div
            className="absolute inset-0 z-10 grid place-items-center bg-black/25"
            onPointerDown={(e) => {
              e.stopPropagation();
              if (e.target === e.currentTarget) setWheelOpen(false);
            }}
          >
            <div className="relative size-48 rounded-full border-2 border-white/60 bg-black/45">
              {EMOTES.map((em, i) => {
                const a = (i / EMOTES.length) * Math.PI * 2 - Math.PI / 2;
                return (
                  <button
                    key={em}
                    type="button"
                    onClick={() => emote(em)}
                    title={String(i + 1)}
                    className="absolute grid size-11 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-2xl shadow transition hover:scale-110"
                    style={{ left: `${50 + Math.cos(a) * 37}%`, top: `${50 + Math.sin(a) * 37}%` }}
                  >
                    {em}
                  </button>
                );
              })}
              <span className="pointer-events-none absolute inset-0 grid place-items-center text-xs font-semibold text-white">{tr('Emotes · R', 'Émotes · R')}</span>
            </div>
          </div>
        )}
      </div>

      {/* Touch: walk and jump. */}
      <div className="flex justify-center gap-2 sm:hidden">
        {(['left', 'up', 'down', 'right'] as const).map((k) => (
          <button
            key={k}
            type="button"
            className="touch-none rounded-md border border-rule bg-card px-5 py-2 text-lg font-bold"
            onPointerDown={() => keys.current.add(k)}
            onPointerUp={() => keys.current.delete(k)}
            onPointerLeave={() => keys.current.delete(k)}
          >
            {k === 'left' ? '◀' : k === 'right' ? '▶' : k === 'up' ? '⤒' : '⤓'}
          </button>
        ))}
      </div>

      {/* The tools. */}
      <div className="flex flex-wrap items-center gap-1.5">
        {tools.map((t, i) => (
          <button
            key={t.id}
            type="button"
            onClick={() => chooseTool(t.id)}
            title={`${nameOf(t)} (${i + 1})`}
            className={`rounded-md border px-3 py-1 text-sm font-semibold transition ${tool === t.id ? 'border-accent bg-accent/15' : 'border-rule hover:bg-tile'}`}
          >
            {t.icon} {nameOf(t)} <span className="hidden text-[10px] font-normal text-ink-faint sm:inline">{i + 1}</span>
          </button>
        ))}
        <button type="button" onClick={() => setWheelOpen((o) => !o)} className={`rounded-md border px-2.5 py-1 text-sm hover:bg-tile ${wheelOpen ? 'border-accent bg-accent/15' : 'border-rule'}`} title={tr('Emotes (R)', 'Émotes (R)')}>
          😊 {tr('Emotes', 'Émotes')} <span className="hidden text-[10px] text-ink-faint sm:inline">R</span>
        </button>
        <button type="button" onClick={toggleBig} className="rounded-md border border-rule px-2.5 py-1 text-sm hover:bg-tile" title={tr('Full screen (Esc to leave)', 'Plein écran (Échap pour quitter)')}>
          {big ? '🗗' : '⛶'} {big ? tr('Smaller', 'Réduire') : tr('Full screen', 'Plein écran')}
        </button>
        <button
          type="button"
          onClick={() => setSky((s) => (s === 'auto' ? (clockDark > 0.35 ? 'day' : 'night') : 'auto'))}
          className="rounded-md border border-rule px-2.5 py-1 text-sm hover:bg-tile"
          title={tr('Day and night follow your clock; this shows the other one for a while.', 'Le jour et la nuit suivent ton horloge ; ceci montre l’autre un moment.')}
        >
          {sky === 'auto' ? (clockDark > 0.35 ? '🌙' : '☀️') : sky === 'night' ? '🌙' : '☀️'} {sky === 'auto' ? tr('Clock', 'Horloge') : tr('Preview', 'Aperçu')}
        </button>
        <span className="ml-auto text-xs text-ink-faint">
          {tr('Arrows/WASD walk · Space jumps · Up/Down: ladders, warp pads · Down on a rail: minecart · Up at a zipline post: slide · Down at the gate in the valley: the dungeon · click a furnace or a workbench: craft · Down on a seat or bed: sit, sleep · click the sea from the shore: fish · R: emotes · E or 1–5: tool · wheel: next thing to build · F: layer', 'Flèches/ZQSD marcher · Espace sauter · Haut/Bas : échelles, téléporteurs · Bas sur un rail : wagonnet · Haut à un poteau de tyrolienne : glisser · Bas à la porte dans la vallée : le donjon · clique un four ou un établi : fabriquer · Bas sur un siège ou un lit : s’asseoir, dormir · clique la mer depuis le rivage : pêcher · R : émotes · E ou 1–5 : outil · molette : objet suivant · F : couche')}
        </span>
      </div>
      {note && <p className="rounded-md bg-tile px-3 py-1.5 text-sm">{note}</p>}

      {/* What the tool needs: things to build, or two seeds to plant. */}
      {tool === 'build' && (
        <Panel title={tr('Your bag: pick something (or scroll the wheel over the island), then click a spot', 'Ton sac : choisis (ou tourne la molette sur l’île), puis clique un endroit')}>
          <div className="mb-2 flex flex-wrap items-center gap-1.5 text-sm">
            <span className="text-xs font-semibold text-ink-faint">{tr('Layer (F):', 'Couche (F) :')}</span>
            {LAYERS.map((l) => (
              <button key={l.id} type="button" onClick={() => (setLayer(l.id), box.current?.focus())} className={`rounded-md border px-2 py-0.5 ${layer === l.id ? 'border-accent bg-accent/15 font-semibold' : 'border-rule hover:bg-tile'}`}>
                {l.icon} {nameOf(l)}
              </button>
            ))}
            <span className="text-xs text-ink-faint">
              {layer === 'back'
                ? tr('Behind you, with the wallpapers: decoration only (a block or a fence there isn’t solid).', 'Derrière toi, avec les papiers peints : de la déco seulement (un bloc ou une barrière n’y est pas solide).')
                : layer === 'front'
                  ? tr('In front of you, decoration only: you walk behind it.', 'Devant toi, de la déco seulement : tu passes derrière.')
                  : tr('Where you walk: blocks, tools, furniture.', 'Là où tu marches : blocs, outils, meubles.')}
            </span>
          </div>
          {bagItems.length === 0 ? (
            <p className="text-sm text-ink-soft">{tr('Nothing yet: plant two seeds, harvest them tomorrow, and what grows lands here. Dig dirt to move the ground.', 'Rien pour l’instant : plante deux graines, récolte-les demain, et ce qui pousse arrive ici. Creuse la terre pour la déplacer.')}</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {bagItems.map(([id, n]) => (
                <button
                  key={id}
                  id={`bag-${id}`}
                  type="button"
                  disabled={!fitsLayer(id)}
                  title={fitsLayer(id) ? undefined : layer === 'back' ? tr('This one only goes in the middle.', 'Celui-ci va seulement au milieu.') : tr('This one can’t go in front.', 'Celui-ci ne va pas devant.')}
                  onClick={() => (setPick(id), box.current?.focus())}
                  className={`flex items-center gap-1 rounded-md border px-2 py-1 text-sm disabled:cursor-not-allowed disabled:opacity-35 ${pick === id ? 'border-accent bg-accent/15' : 'border-rule hover:bg-tile'}`}
                >
                  <ItemArt id={id} className="size-7 text-lg" /> {itemName(id)} <span className="text-xs text-ink-faint">×{n}</span>
                </button>
              ))}
            </div>
          )}
          {discs.length > 0 && (
            <p className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-ink-soft">
              {tr('Records & CDs (click a turntable, a CD player or a jukebox to play them):', 'Vinyles et CD (clique une platine, un lecteur CD ou un juke-box pour les jouer) :')}
              {discs.map(([id]) => (
                <span key={id} className="inline-flex items-center gap-0.5 rounded bg-tile px-1">
                  <ItemArt id={id} className="size-4" /> {itemName(id)}
                </span>
              ))}
            </p>
          )}
        </Panel>
      )}
      {tool === 'plant' && (
        <Panel title={tr('Pick two seeds, then click a spot on the dirt', 'Choisis deux graines, puis clique un endroit sur la terre')}>
          <div className="mb-2 flex items-center gap-2 text-sm">
            {[0, 1].map((k) => {
              const s = pair[k] ? SEED_BY_ID.get(pair[k]) : undefined;
              return (
                <span key={k} className="flex items-center gap-1 rounded-md border border-dashed border-rule px-2 py-1">
                  {s ? (
                    <>
                      <SeedArt seed={s} className="size-6" /> {nameOf(s)}
                    </>
                  ) : (
                    <span className="text-ink-faint">{tr('Seed', 'Graine')} {k + 1}</span>
                  )}
                </span>
              );
            })}
            {pair.length > 0 && (
              <button type="button" onClick={() => setPair([])} className="text-xs text-ink-soft underline">
                {tr('Clear', 'Effacer')}
              </button>
            )}
          </div>
          {bagSeeds.length === 0 ? (
            <p className="text-sm text-ink-soft">{tr('No seeds yet: play today’s games to collect some.', 'Pas encore de graines : joue aux jeux du jour pour en récolter.')}</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {bagSeeds.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  disabled={pair.length >= 2 || left(s.id) <= 0}
                  onClick={() => (setPair((p) => [...p, s.id]), box.current?.focus())}
                  className="flex items-center gap-1 rounded-md border border-rule px-2 py-1 text-sm hover:bg-tile disabled:opacity-40"
                >
                  <SeedArt seed={s} className="size-6" /> {nameOf(s)} <span className="text-xs text-ink-faint">×{left(s.id)}</span>
                </button>
              ))}
            </div>
          )}
          <p className="mt-2 text-xs text-ink-faint">
            {tr(
              'Two commons grow in a day; with a rare or a hybrid, two. Seeds from two different games may make a hybrid seed.',
              'Deux graines communes poussent en un jour ; avec une rare ou un hybride, deux. Deux graines de jeux différents peuvent donner une graine hybride.',
            )}
          </p>
        </Panel>
      )}

      {reaping !== null && isl.plots[reaping] && (
        <HarvestPicker
          choices={harvestChoices(isl.plots[reaping])}
          have={items}
          onPick={(id) => {
            reap(reaping, id);
            setReaping(null);
            box.current?.focus();
          }}
          onClose={() => (setReaping(null), box.current?.focus())}
        />
      )}
      {crafting && (
        <CraftPicker
          station={crafting}
          bag={items}
          onCraft={(out) => {
            if (!craft(out)) return;
            sfx.correct();
            say(`${crafting === 'furnace' ? '🔥' : '🪚'} ${itemIcon(out)} ${itemName(out)}! ${tr('(In your bag.)', '(Dans ton sac.)')}`);
          }}
          onClose={() => (setCrafting(null), box.current?.focus())}
        />
      )}
      {discing && (
        <DiscPicker
          player={discing.player}
          discs={discs.map(([id]) => id)}
          current={tunes[discing.key] ?? null}
          vol={volOf(discing.key) * 100}
          onVol={(v) => setVolume(discing.key, v)}
          onPick={(t) => {
            tuneTo(discing.key, t);
            say(t === 'off' ? `🔇 ${itemName(discing.player)}: ${tr('off', 'éteint')}` : ytOf(t) ? tr('▶️ YouTube: walk near it to hear it.', '▶️ YouTube : approche-toi pour l’entendre.') : t ? `🎶 ${itemName(t)}` : `🎶 ${itemName(discing.player)}`);
            setDiscing(null);
            box.current?.focus();
          }}
          onClose={() => (setDiscing(null), box.current?.focus())}
        />
      )}
      {speaking && (
        <SpeakerPicker
          isl={isl}
          speaker={speaking}
          current={tunes[`to:${speaking}`] ?? (tunes[speaking] === 'off' ? 'off' : null)}
          vol={volOf(speaking) * 100}
          onVol={(v) => setVolume(speaking, v)}
          onPick={(t) => {
            tuneMany(t === 'off' ? [[speaking, 'off'], [`to:${speaking}`, null]] : t ? [[speaking, null], [`to:${speaking}`, t]] : [[speaking, null], [`to:${speaking}`, null]]);
            say(t === 'off' ? `🔇 ${itemName('speaker')}: ${tr('off', 'éteinte')}` : t ? `🔊 ${tr('Linked to', 'Reliée à')} ${itemName(itemAt(t) ?? '')}` : `🔊 ${itemName('speaker')}`);
            setSpeaking(null);
            box.current?.focus();
          }}
          onClose={() => (setSpeaking(null), box.current?.focus())}
        />
      )}
      {framing !== null && (
        <CardPicker
          yt={kindOf(fgAt(isl, framing)) === 'screen' ? ytOf(tunes[String(framing)]) : undefined}
          onYt={(id) => {
            tuneTo(String(framing), id ? `${YT}${id}` : null);
            say(id ? tr('📺 YouTube set: click the screen to play it.', '📺 YouTube réglé : clique l’écran pour le lancer.') : tr('📺 Back to the card’s clip.', '📺 Retour au clip de la carte.'));
            setFraming(null);
            box.current?.focus();
          }}
          vol={volOf(String(framing)) * 100}
          onVol={(v) => setVolume(String(framing), v)}
          owned={owned}
          reader={kindOf(fgAt(isl, framing)) === 'reader'}
          screen={kindOf(fgAt(isl, framing)) === 'screen'}
          backdrop={backdrop}
          current={isl.shown[framing] ?? null}
          onPick={(id) => {
            const screen = kindOf(fgAt(isl, framing)) === 'screen';
            const reader = kindOf(fgAt(isl, framing)) === 'reader';
            run(
              (i) => showCard(i, framing, id, who),
              id ? (screen ? tr('Tuned in! Click the screen to play it.', 'Réglé ! Clique l’écran pour le lancer.') : reader ? tr('In the reader! Click it to hear the card.', 'Dans le lecteur ! Clique-le pour entendre la carte.') : tr('On display!', 'Exposée !')) : tr('Emptied.', 'Vidé.'),
              'build',
            );
            setFraming(null);
            box.current?.focus();
          }}
          onClose={() => setFraming(null)}
        />
      )}
    </div>
  );
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-md border border-rule bg-card/60 p-3">
      <p className="mb-2 text-xs font-bold uppercase tracking-wider text-ink-faint">{title}</p>
      {children}
    </div>
  );
}

/** The island itself: drawn again only when it changes (the player moves on top of it). */
const World = memo(function World({ isl, T, tunes }: { isl: Island; T: number; tunes: Record<string, string> }) {
  const today = todayKey();
  const out: ReactNode[] = [];
  // The sea at both ends.
  if (!isl.world) for (const x0 of [0, ISLAND.w - 4]) out.push(<div key={`sea${x0}`} className="island-sea absolute" style={{ left: x0 * T, top: ISLAND.sea * T, width: 4 * T, height: (ISLAND.h - ISLAND.sea) * T }} />);
  // Underground, where the ground is open (a cave, or dug): its back wall, darker.
  for (let cell = 0; cell < ISLAND.w * ISLAND.h; cell++) {
    const { x, y } = xy(cell);
    if (isl.world ? fgAt(isl, cell) && kindOf(fgAt(isl, cell)) === 'natural' : x < 4 || x >= ISLAND.w - 4 || y <= surfaceAt(x) || fgAt(isl, cell)) continue;
    if (isl.world) {
      out.push(<div key={`c${cell}`} className={`island-cave island-stone island-dungeon ${biomeAt(y).wall} absolute`} style={{ left: x * T, top: y * T, width: T, height: T }} />);
      continue;
    }
    out.push(<div key={`c${cell}`} className={`island-cave absolute ${y < surfaceAt(x) + 3 ? 'island-dirt' : 'island-stone'}`} style={{ left: x * T, top: y * T, width: T, height: T, backgroundColor: y < surfaceAt(x) + 3 ? dirtColor(y) : undefined }} />);
  }
  // Behind: wallpapers, and the things put behind (a little shaded, so they read as further away).
  for (const [k, id] of Object.entries(isl.bg)) {
    const { x, y } = xy(Number(k));
    const wall = kindOf(id) === 'wall';
    out.push(
      <div key={`b${k}`} className={`absolute ${wall ? 'island-wall' : 'island-behind'} ${kindOf(id) === 'music' && tunes[`b${k}`] !== 'off' ? 'island-music' : ''}`} style={{ left: x * T, top: y * T, width: T, height: T, fontSize: T * 0.6 }}>
        <ItemArt id={id} className="size-full" />
      </div>,
    );
  }
  const ground = (x: number, y: number) => x >= 0 && x < ISLAND.w && (y >= ISLAND.h || (y >= 0 && isSolid(fgAt(isl, idx(x, y)))));
  for (let cell = 0; cell < ISLAND.w * ISLAND.h; cell++) {
    const id = fgAt(isl, cell);
    if (!id) continue;
    const k = String(cell);
    const { x, y } = xy(cell);
    const style = { left: x * T, top: y * T, width: T, height: T };
    const kind = kindOf(id);
    if (kind === 'natural') {
      // Ground: stone, beach sand by the sea, or dirt (darker deeper down) with grass on top; its open sides shaded.
      const sand = id === 'dirt' && isBeach(x);
      const top = id === 'dirt' && !ground(x, y - 1) && !isl.plots[idx(x, y - 1)];
      const h = cellHash(x, y);
      const edges = [!ground(x - 1, y) && `inset ${T * 0.12}px 0 0 #0002`, !ground(x + 1, y) && `inset -${T * 0.12}px 0 0 #0003`, !ground(x, y + 1) && `inset 0 -${T * 0.1}px 0 #0003`]
        .filter(Boolean)
        .join(',');
      out.push(
        <div
          key={k}
          className={`absolute ${id !== 'dirt' ? 'island-stone' : sand ? 'island-sand' : 'island-dirt'} ${id === 'bedrock' ? 'island-bedrock' : id.startsWith('dungeon-') ? `island-dungeon ${id}` : ''}`}
          style={{ ...style, ...(!ground(x, y - 1) ? { borderTopLeftRadius: ground(x - 1, y) ? 0 : T * 0.3, borderTopRightRadius: ground(x + 1, y) ? 0 : T * 0.3 } : {}), backgroundColor: id === 'dirt' && !sand ? dirtColor(y) : undefined, backgroundPosition: `${(h % 4) * 8}px ${((h >> 3) % 4) * 8}px`, boxShadow: edges || undefined }}
        >
          {NATURAL[id] && id.endsWith('-ore') && <span className="island-ore" style={{ '--ore': NATURAL[id].color } as React.CSSProperties} />}
          {top && !sand && <span className={`island-tuft ${h % 5 === 0 ? 'island-tuft-flower' : h % 7 === 1 ? 'island-tuft-flower2' : ''}`} />}
          {top && sand && h % 6 === 0 && <span className="island-shell" />}
        </div>,
      );
    } else if (kind === 'screen') {
      const card = isl.shown[k] ? CARD_BY_ID.get(isl.shown[k]) : undefined;
      const clip = screenClip(card);
      const big = id === 'big-screen';
      out.push(
        <div key={k} className="absolute" style={style} title={card ? shownName(card.name, card.set) : ITEM_BY_ID.get(id)?.name}>
          <ItemArt id={id} className="absolute inset-0 size-full" />
          <span className="island-tv-glass absolute overflow-hidden" style={big ? { left: '9.4%', top: '21.9%', width: '81.2%', height: '46.9%' } : { left: '20.3%', top: '29.7%', width: '46.9%', height: '46.9%', borderRadius: T * 0.08 }}>
            {card && clip && GIF_CLIP.test(clip) ? (
              <GifLoop src={clip} className="size-full object-cover" />
            ) : card ? (
              <ShownPicture card={card} still className="size-full object-cover object-top" />
            ) : (
              <span className="island-tv-static block size-full" />
            )}
          </span>
        </div>,
      );
    } else if (kind === 'door') {
      out.push(
        <div key={k} data-door={k} className="island-door absolute" style={style} title={ITEM_BY_ID.get(id)?.name}>
          <ItemArt id={id} className="island-door-shut absolute inset-0 size-full" />
          <ItemArt id={`${id}-open`} className="island-door-open absolute inset-0 size-full" />
        </div>,
      );
    } else if (kind === 'stairs') {
      // Steps rise towards the higher side.
      const flip = ground(x - 1, y - 1) && !ground(x + 1, y - 1);
      out.push(
        <div key={k} className="absolute" style={style} title={ITEM_BY_ID.get(id)?.name}>
          <ItemArt id={id} className="size-full" style={flip ? { transform: 'scaleX(-1)' } : undefined} />
        </div>,
      );
    } else if (kind === 'reader') {
      const card = isl.shown[k] ? CARD_BY_ID.get(isl.shown[k]) : undefined;
      out.push(
        <div key={k} className="absolute" style={style} title={card ? shownName(card.name, card.set) : ITEM_BY_ID.get(id)?.name}>
          <ItemArt id={id} className="absolute inset-0 size-full" />
          {card && (
            <span className="island-stand-card absolute block overflow-hidden" style={STAND['card-reader']}>
              <ShownPicture card={card} still className="size-full object-cover object-top" />
            </span>
          )}
        </div>,
      );
    } else if (kind === 'frame') {
      const card = isl.shown[k] ? CARD_BY_ID.get(isl.shown[k]) : undefined;
      out.push(
        <div key={k} className="absolute grid place-items-center" style={style} title={card ? shownName(card.name, card.set) : ITEM_BY_ID.get(id)?.name}>
          {card && HUNG.has(id) ? (
            <span className={`island-frame ${id === 'gold-card-frame' || id === 'grand-card-frame' ? 'island-frame-gold' : ''} ${id === 'grand-card-frame' ? 'island-frame-grand' : ''} block overflow-hidden`} style={{ width: T * 0.7, height: T * 0.94 }}>
              <ShownPicture card={card} still className="size-full object-cover object-top" />
            </span>
          ) : (
            <>
              <ItemArt id={id} className="absolute inset-0 size-full" />
              {card && (
                <span className="island-stand-card absolute block overflow-hidden" style={STAND[id] ?? STAND.pedestal}>
                  <ShownPicture card={card} still className="size-full object-cover object-top" />
                </span>
              )}
            </>
          )}
        </div>,
      );
    } else {
      out.push(
        <div key={k} className={`absolute ${kind === 'light' ? 'island-light' : ''} ${kind === 'music' && tunes[k] !== 'off' ? 'island-music' : ''} ${kind === 'warp' ? 'island-warp' : ''} ${id === 'fire-jet' ? 'island-fire-jet' : id === 'lava' ? 'island-lava' : ''}`} style={{ ...style, fontSize: T * 0.8, lineHeight: 1, ...(id === 'fire-jet' ? { animationDelay: `-${Date.now() % FIRE_JET.period}ms` } : {}) }} title={ITEM_BY_ID.get(id)?.name}>
          <ItemArt id={id} className="size-full" />
        </div>,
      );
    }
  }
  for (const [k, p] of Object.entries(isl.plots)) {
    const { x, y } = xy(Number(k));
    const ready = isReady(p, today);
    out.push(
      <div key={`p${k}`} className="absolute" style={{ left: x * T, top: y * T, width: T, height: T }} title={ready ? tr('Ready!', 'Prêt !') : `${tr('Ready on', 'Prêt le')} ${readyOn(p)}`}>
        <PlotArt p={p} today={today} ready={ready} />
      </div>,
    );
  }
  // Waves over the sea's surface, foam where it meets the beach.
  if (!isl.world)
    for (const x0 of [0, ISLAND.w - 4])
      out.push(<div key={`w${x0}`} className="island-wave absolute" style={{ left: x0 * T, top: ISLAND.sea * T - T * 0.22, width: 4 * T, height: T * 0.4, backgroundSize: `${T}px 100%` }} />);
  if (!isl.world) for (const fx of [4 - 0.45, ISLAND.w - 4 - 0.15]) out.push(<div key={`f${fx}`} className="island-foam absolute" style={{ left: fx * T, top: ISLAND.sea * T - T * 0.14, width: T * 0.6, height: T * 0.32 }} />);
  // Ziplines: a rope from each post to the next one.
  const ropes = zipLines(isl);
  if (ropes.length)
    out.push(
      <svg key="ropes" className="pointer-events-none absolute left-0 top-0" width={ISLAND.w * T} height={ISLAND.h * T} aria-hidden="true">
        {ropes.map(([a, b]) => {
          const A = xy(a);
          const B = xy(b);
          return <line key={`${a}-${b}`} x1={(A.x + 0.5) * T} y1={(A.y + 0.12) * T} x2={(B.x + 0.5) * T} y2={(B.y + 0.12) * T} stroke="#3a2a32" strokeWidth={Math.max(1.5, T * 0.06)} strokeLinecap="round" />;
        })}
      </svg>,
    );
  return <>{out}</>;
});

/** The front layer: things drawn over the player (you walk behind them). */
const FrontLayer = memo(function FrontLayer({ isl, T }: { isl: Island; T: number }) {
  return (
    <>
      {Object.entries(isl.front ?? {}).map(([k, id]) => {
        const { x, y } = xy(Number(k));
        return (
          <div key={`t${k}`} className={`island-front pointer-events-none absolute ${kindOf(id) === 'light' ? 'island-light' : ''}`} style={{ left: x * T, top: y * T, width: T, height: T, fontSize: T * 0.8 }}>
            <ItemArt id={id} className="size-full" />
          </div>
        );
      })}
    </>
  );
});

/** A record or CD player: its own tune, off, or one of your discs that fits it. */
function DiscPicker({ player, discs, current, vol, onVol, onPick, onClose }: { player: string; discs: string[]; current: string | null; vol: number; onVol: (v: number) => void; onPick: (t: string | null) => void; onClose: () => void }) {
  const fits = discs.filter((d) => discFits(player, d));
  const tile = (key: string, art: ReactNode, label: string, value: string | null, on: boolean) => (
    <button key={key} type="button" onClick={() => onPick(value)} className={`flex flex-col items-center gap-1 rounded-md border p-2 text-xs hover:bg-tile ${on ? 'border-accent bg-accent/10' : 'border-rule'}`}>
      {art}
      <span className="text-center font-semibold leading-tight">{label}</span>
    </button>
  );
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4" onClick={onClose}>
      <div className="page max-h-[80vh] w-full max-w-lg space-y-3 overflow-y-auto rounded-md p-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2">
          <p className="font-display text-lg font-bold">🎶 {itemName(player)}</p>
          <button type="button" onClick={onClose} className="ml-auto text-ink-soft" aria-label={tr('Close', 'Fermer')}>
            ✕
          </button>
        </div>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {tile('own', <ItemArt id={player} className="size-12 text-3xl" />, tr('Its own tune', 'Son propre air'), null, current === null)}
          {tile('off', <span className="grid size-12 place-items-center text-3xl">🔇</span>, tr('Off', 'Éteint'), 'off', current === 'off')}
          {fits.map((d) => tile(d, <ItemArt id={d} className="size-12 text-3xl" />, itemName(d), d, current === d))}
        </div>
        {player === 'radio' && <YouTubeField current={ytOf(current)} onSet={(id) => onPick(id ? `${YT}${id}` : null)} />}
        <VolumeSlider value={vol} onChange={onVol} />
        {fits.length === 0 && (
          <p className="text-xs text-ink-soft">
            {DISC_PLAYERS[player] === 'cd'
              ? tr('No CD yet: some seeds grow CDs (Echo, Spark, Concert, Dream, Champion).', 'Pas encore de CD : certaines graines en font pousser (Écho, Étincelle, Concert, Rêve, Champion).')
              : tr('No record yet: some seeds grow them (Melody, Symphony, Gramophone).', 'Pas encore de vinyle : certaines graines en font pousser (Mélodie, Symphonie, Gramophone).')}
          </p>
        )}
      </div>
    </div>
  );
}

/** A furnace or a workbench: its recipes, what each needs (what you have of it), and Make. */
function CraftPicker({ station, bag, onCraft, onClose }: { station: Station; bag: Record<string, number>; onCraft: (out: string) => void; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4" onClick={onClose}>
      <div className="page max-h-[80vh] w-full max-w-lg space-y-3 overflow-y-auto rounded-md p-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2">
          <ItemArt id={station} className="size-8" />
          <p className="font-display text-lg font-bold">{itemName(station)}</p>
          <button type="button" onClick={onClose} className="ml-auto text-ink-soft" aria-label={tr('Close', 'Fermer')}>
            ✕
          </button>
        </div>
        <p className="text-xs text-ink-soft">
          {station === 'furnace'
            ? tr('Mine stone, dirt and ore with the pickaxe (on the island, and richer in the dungeon); the furnace refines them into blocks.', 'Mine de la pierre, de la terre et du minerai à la pioche (sur l’île, et plus riche dans le donjon) ; le four les raffine en blocs.')
            : tr('The workbench turns the furnace’s blocks into decorations you can’t grow.', 'L’établi transforme les blocs du four en décorations qu’on ne peut pas faire pousser.')}
        </p>
        <ul className="space-y-1.5">
          {RECIPES.filter((r) => r.at === station).map((r) => {
            const ok = canCraft(r, bag);
            return (
              <li key={r.out} className="flex items-center gap-2 rounded-md border border-rule p-1.5">
                <ItemArt id={r.out} className="size-9 shrink-0 text-2xl" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">
                    {itemName(r.out)}
                    {(r.n ?? 1) > 1 && <span className="text-ink-soft"> ×{r.n}</span>}
                  </span>
                  <span className="flex flex-wrap gap-x-2 text-[11px]">
                    {Object.entries(r.needs).map(([id, n]) => (
                      <span key={id} className={(bag[id] ?? 0) >= n ? 'text-ink-soft' : 'text-coral'}>
                        <ItemArt id={id} className="inline-block size-3.5 align-[-2px]" /> {itemName(id)} {bag[id] ?? 0}/{n}
                      </span>
                    ))}
                  </span>
                </span>
                <button type="button" disabled={!ok} onClick={() => onCraft(r.out)} className={`rounded-md border px-2.5 py-1 text-sm font-semibold ${ok ? 'border-accent bg-accent/15 hover:bg-accent/25' : 'cursor-not-allowed border-rule opacity-50'}`}>
                  {tr('Make', 'Fabriquer')}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

/** A ripe plant: choose which of the things its seeds grow you take. */
function HarvestPicker({ choices, have, onPick, onClose }: { choices: string[]; have: Record<string, number>; onPick: (id: string) => void; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4" onClick={onClose}>
      <div className="page max-h-[80vh] w-full max-w-lg space-y-3 overflow-y-auto rounded-md p-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2">
          <p className="font-display text-lg font-bold">🌿 {tr('It’s ripe! What do you harvest?', 'C’est mûr ! Que récoltes-tu ?')}</p>
          <button type="button" onClick={onClose} className="ml-auto text-ink-soft" aria-label={tr('Close', 'Fermer')}>
            ✕
          </button>
        </div>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {choices.map((id) => (
            <button key={id} type="button" onClick={() => onPick(id)} className="relative flex flex-col items-center gap-1 rounded-md border border-rule p-2 text-xs hover:border-accent hover:bg-tile">
              <ItemArt id={id} className="size-14 text-4xl" />
              <span className="text-center font-semibold leading-tight">{itemName(id)}</span>
              {!have[id] && <span className="absolute right-1 top-1 rounded bg-accent px-1 text-[10px] font-bold text-white">{tr('New', 'Nouveau')}</span>}
            </button>
          ))}
        </div>
        <p className="text-xs text-ink-faint">{tr('The other things stay in the seeds: plant them again to get them.', 'Les autres restent dans les graines : replante-les pour les avoir.')}</p>
      </div>
    </div>
  );
}

/** Picks one of your cards to show in a frame. */
function CardPicker({ owned, screen = false, reader = false, backdrop, current, onPick, onClose, yt, onYt, vol, onVol }: { owned: Record<string, number>; screen?: boolean; reader?: boolean; backdrop?: string | null; current: string | null; onPick: (id: string | null) => void; onClose: () => void; yt?: string | null; onYt?: (id: string | null) => void; vol?: number; onVol?: (v: number) => void }) {
  const [q, setQ] = useState('');
  const bg = screen && backdrop ? CARD_BY_ID.get(backdrop) : undefined;
  const cards = useMemo(
    () =>
      Object.keys(owned)
        .map((id) => CARD_BY_ID.get(id))
        .filter((c): c is Card => !!c)
        // A screen plays clips: only the cards that have one.
        .filter((c) => !screen || !!screenClip(c))
        // A reader: the Mythic and Omni cards with a line to say.
        .filter((c) => !reader || readable(c))
        .filter((c) => !q || shownName(c.name, c.set).toLowerCase().includes(q.toLowerCase()))
        .slice(0, 120),
    [owned, q, screen, reader],
  );
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4" onClick={onClose}>
      <div className="page max-h-[80vh] w-full max-w-lg space-y-2 overflow-hidden rounded-md p-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2">
          <p className="font-display text-lg font-bold">
            {screen ? `📺 ${tr('Put a card’s clip on the screen', 'Mettre le clip d’une carte à l’écran')}` : reader ? `📇 ${tr('Put a Mythic or Omni card in the reader', 'Mettre une carte Mythique ou Omni dans le lecteur')}` : `🖼️ ${tr('Show a card', 'Exposer une carte')}`}
          </p>
          <button type="button" onClick={onClose} className="ml-auto text-ink-soft" aria-label={tr('Close', 'Fermer')}>
            ✕
          </button>
        </div>
        {screen && onYt && <YouTubeField current={yt ?? null} onSet={onYt} />}
        {screen && onVol && vol !== undefined && <VolumeSlider value={vol} onChange={onVol} />}
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={tr('Search your cards', 'Cherche dans tes cartes')} className="w-full rounded-md border border-rule bg-card px-3 py-1.5 text-sm" autoFocus />
        <div className="grid max-h-[50vh] grid-cols-3 gap-2 overflow-y-auto sm:grid-cols-4">
          {bg && screenClip(bg) && (
            <button type="button" onClick={() => onPick(bg.id)} className={`flex flex-col items-center gap-1 rounded-md border p-2 text-xs hover:bg-tile ${current === bg.id ? 'border-accent' : 'border-accent/50'}`}>
              <CardAvatar card={bg} className="size-12" />
              <span className="w-full truncate text-center font-semibold">{tr('Your background', 'Ton fond')}</span>
            </button>
          )}
          {current && (
            <button type="button" onClick={() => onPick(null)} className="rounded-md border border-dashed border-rule p-2 text-xs text-ink-soft hover:bg-tile">
              {tr('Empty the frame', 'Vider le cadre')}
            </button>
          )}
          {cards.map((c) => (
            <button key={c.id} type="button" onClick={() => onPick(c.id)} className={`flex flex-col items-center gap-1 rounded-md border p-2 text-xs hover:bg-tile ${current === c.id ? 'border-accent' : 'border-rule'}`}>
              <CardAvatar card={c} className="size-12" />
              <span className="w-full truncate text-center">{shownName(c.name, c.set)}</span>
            </button>
          ))}
          {cards.length === 0 && (
            <p className="col-span-full text-sm text-ink-soft">
              {screen ? tr('None of your cards has a clip yet.', 'Aucune de tes cartes n’a encore de clip.') : reader ? tr('No Mythic or Omni card with a voice line yet.', 'Pas encore de carte Mythique ou Omni avec une réplique.') : tr('No card found.', 'Aucune carte trouvée.')}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

/** At night, each light's glow, and the light itself drawn bright over the dark. */
const Glows = memo(function Glows({ isl, T, dark }: { isl: Island; T: number; dark: number }) {
  return (
    <>
      {itemsIn(isl)
        .filter(([, id]) => kindOf(id) === 'light' || kindOf(id) === 'screen')
        .map(([k, id]) => {
          const { x, y } = xy(Number(k));
          const c = kindOf(id) === 'screen' ? '#93c5fd' : (GLOW[id] ?? '#fcd34d');
          const r = (kindOf(id) === 'screen' ? 1.6 : 2.8) * T;
          return (
            <div key={k} className="pointer-events-none absolute">
              <div className="island-glow absolute rounded-full" style={{ left: (x + 0.5) * T - r, top: (y + 0.5) * T - r, width: r * 2, height: r * 2, background: `radial-gradient(circle, ${c}cc 0%, ${c}55 35%, transparent 70%)`, opacity: Math.min(1, dark * 1.6) }} />
              {kindOf(id) === 'light' && (
                <ItemArt id={id} className="island-lit absolute" style={{ left: x * T, top: y * T, width: T, height: T, fontSize: T * 0.8 }} />
              )}
            </div>
          );
        })}
    </>
  );
});

/** The tool a player holds, drawn in their hand (32×32, like the items). */
const TOOL_ART: Record<string, string> = {
  fish: '<path d="M4 29 29 3" stroke="#3a2a32" stroke-width="4" stroke-linecap="round"/><path d="M4 29 29 3" stroke="#a16207" stroke-width="2.2" stroke-linecap="round"/><path d="M4 29 9 24" stroke="#1f2937" stroke-width="3.4" stroke-linecap="round"/><circle cx="10" cy="22" r="2.6" fill="#9aa4b4" stroke="#3a2a32" stroke-width="1.2"/><circle cx="10" cy="22" r=".8" fill="#3a2a32"/>',
  dig: '<path d="M16 9 30 27" stroke="#3a2a32" stroke-width="5" stroke-linecap="round"/><path d="M16 9 30 27" stroke="#b07a46" stroke-width="3" stroke-linecap="round"/><path d="M3 12C9 4 19 2 27 5c-7 0-14 3-19 9z" fill="#9aa4b4" stroke="#3a2a32" stroke-width="1.5" stroke-linejoin="round"/><path d="M8 10c5-4 11-6 17-5" stroke="#e6ecf4" stroke-width="1.2" fill="none"/>',
  build: '<path d="M14 12 29 28" stroke="#3a2a32" stroke-width="5" stroke-linecap="round"/><path d="M14 12 29 28" stroke="#c98b4f" stroke-width="3" stroke-linecap="round"/><rect x="3" y="5" width="17" height="9" rx="2" transform="rotate(42 11.5 9.5)" fill="#8d96a6" stroke="#3a2a32" stroke-width="1.5"/>',
  plant: '<path d="M9 12c-3 4-4 10-1 15h16c3-5 2-11-1-15z" fill="#d9b07a" stroke="#3a2a32" stroke-width="1.5" stroke-linejoin="round"/><path d="M9 12h14l-2-4H11z" fill="#c4945c" stroke="#3a2a32" stroke-width="1.5" stroke-linejoin="round"/><path d="M11 8c2-5 8-5 10 0" stroke="#3a2a32" stroke-width="1.5" fill="none"/><path d="M16 22c-3-1-4-4-2-6 2 1 3 3 2 6zm0 0c2-2 5-2 6 0-2 2-4 2-6 0z" fill="#5cb85c" stroke="#2d6a2d" stroke-width=".8"/>',
  pick: '<path d="M8 28V15c0-2 3-2 3 0v-6c0-2 3-2 3 0V7c0-2 3-2 3 0v2c0-2 3-2 3 0v7l2-3c1-2 4-1 3 1l-4 8c-1 3-3 6-6 6z" fill="#f2c94c" stroke="#3a2a32" stroke-width="1.5" stroke-linejoin="round"/><path d="M8 24h12" stroke="#d99a2b" stroke-width="2"/>',
};
/** A minecart and a zipline trolley, shown while riding (by the player's data-pose, see index.css). */
function RideArt() {
  return (
    <>
      <svg className="island-cart" viewBox="0 0 48 26" aria-hidden="true">
        <path d="M3 3h42l-4 15H7z" fill="#64748b" stroke="#3a2a32" strokeWidth="2" strokeLinejoin="round" />
        <path d="M6 8h36M8 13h32" stroke="#94a3b8" strokeWidth="1.6" />
        <path d="M2 3h44" stroke="#3a2a32" strokeWidth="3" strokeLinecap="round" />
        <circle cx="14" cy="20" r="4.5" fill="#27272a" stroke="#3a2a32" strokeWidth="1.5" />
        <circle cx="34" cy="20" r="4.5" fill="#27272a" stroke="#3a2a32" strokeWidth="1.5" />
        <circle cx="14" cy="20" r="1.5" fill="#9aa4b4" />
        <circle cx="34" cy="20" r="1.5" fill="#9aa4b4" />
      </svg>
      <svg className="island-trolley" viewBox="0 0 32 22" aria-hidden="true">
        <circle cx="16" cy="6" r="4.5" fill="#9aa4b4" stroke="#3a2a32" strokeWidth="1.5" />
        <circle cx="16" cy="6" r="1.4" fill="#3a2a32" />
        <path d="M16 10v7M6 18h20" stroke="#3a2a32" strokeWidth="3" strokeLinecap="round" />
        <path d="M6 18h20" stroke="#ef4444" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    </>
  );
}

function ToolInHand({ tool }: { tool?: string }) {
  const art = tool ? TOOL_ART[tool] : undefined;
  if (!art) return null;
  return <svg className="island-me-tool" viewBox="0 0 32 32" aria-hidden="true" dangerouslySetInnerHTML={{ __html: art }} />;
}

/** The fishing line from the rod's tip to the float on the sea (it dips when something bites). */
function FishLine({ f, T }: { f: Fishing; T: number }) {
  const x = xy(f.cell).x + 0.5;
  const y = ISLAND.sea - 0.08;
  const sag = Math.max(f.fy, y) + 0.5;
  return (
    <>
      <svg className="pointer-events-none absolute left-0 top-0" width={ISLAND.w * T} height={ISLAND.h * T} aria-hidden="true">
        <path d={`M${f.fx * T} ${f.fy * T} Q${((f.fx + x) / 2) * T} ${sag * T} ${x * T} ${y * T}`} stroke="#f8fafc" strokeWidth={1.2} fill="none" opacity={0.85} />
      </svg>
      <span className={`island-float ${f.phase === 'bite' ? 'island-float-bite' : ''}`} style={{ left: x * T - T * 0.17, top: y * T - T * 0.24, width: T * 0.34, height: T * 0.34 }} />
      {f.phase === 'bite' && (
        <span className="island-bite pointer-events-none absolute font-black text-coral" style={{ left: x * T - T * 0.2, top: y * T - T * 1.4, fontSize: T * 0.8 }}>
          !
        </span>
      )}
    </>
  );
}

/**
 * A screen switched on: the card's clip, big, above the TV. A video plays once with its sound (the owner's rule: card
 * videos play on a moment, with their own audio, never on a loop); a GIF loops until it's clicked off.
 */
function TvShow({ tv, T, level, vol, onVol, onEnd, onOff }: { tv: TvEvent; T: number; level: number; vol: number; onVol: (v: number) => void; onEnd: () => void; onOff: () => void }) {
  const card = CARD_BY_ID.get(tv.card);
  const clip = tv.clip;
  // Its sound: the clips' volume, the TV's own, and how near you stand to it or a speaker linked to it.
  const volume = level;
  const ref = useRef<HTMLVideoElement>(null);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (ref.current) {
      ref.current.volume = Math.max(0, Math.min(1, volume));
      ref.current.muted = volume <= 0;
    }
  }, [volume]);
  const { x, y } = xy(tv.cell);
  const w = 7 * T;
  const h = (w * 9) / 16;
  const left = Math.max(0, Math.min(ISLAND.w * T - w, (x + 0.5) * T - w / 2));
  const top = Math.max(2, y * T - h - 6);
  const yt = ytOf(clip);
  if (yt) return <YouTubeShow id={yt} volume={volume} start={(Date.now() - tv.at) / 1000} vol={vol} onVol={onVol} label="YouTube" onOff={onOff} className="island-tv-show absolute" style={{ left, top, width: w, height: h }} />;
  if (!card || !clip) return null;
  const full = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void box.current?.requestFullscreen?.().catch(() => {});
  };
  return (
    <div ref={box} className="island-tv-show absolute overflow-hidden rounded-md bg-black" style={{ left, top, width: w, height: h }} onPointerDown={(e) => (e.stopPropagation(), onOff())} title={tr('Click to switch off', 'Clique pour éteindre')}>
      {GIF_CLIP.test(clip) ? (
        <GifLoop src={clip} className="size-full object-cover" />
      ) : (
        <video
          ref={ref}
          src={clip}
          autoPlay
          playsInline
          muted={volume === 0}
          onLoadedMetadata={(e) => {
            // Switched on by someone a moment ago: in step with them (or already over).
            const v = e.currentTarget;
            const late = (Date.now() - tv.at) / 1000;
            if (late >= v.duration - 0.3) return onEnd();
            if (late > 0.5) v.currentTime = late;
          }}
          onEnded={onEnd}
          onError={onEnd}
          className="size-full object-cover"
        />
      )}
      <span className="absolute bottom-1 left-2 rounded bg-black/60 px-1.5 text-[11px] font-semibold text-white">{shownName(card.name, card.set)}</span>
      {!GIF_CLIP.test(clip) && <ShowBar onFull={full} vol={vol} onVol={onVol} />}
      {GIF_CLIP.test(clip) && <ShowBar onFull={full} />}
    </div>
  );
}

/** A speaker: its own tune, off, or linked to a radio or a TV on the island (it plays what that plays). */
function SpeakerPicker({ isl, speaker, current, vol, onVol, onPick, onClose }: { isl: Island; speaker: string; current: string | null; vol: number; onVol: (v: number) => void; onPick: (t: string | null) => void; onClose: () => void }) {
  const at = (k: string) => xy(Number(/\d+$/.exec(k)?.[0] ?? 0));
  const here = at(speaker);
  // The radios and screens, nearest first.
  const devices = useMemo(() => {
    const out: { key: string; id: string; d: number }[] = [];
    for (const [layerName, map] of [['mid', isl.fg], ['back', isl.bg], ['front', isl.front ?? {}]] as [Layer, Record<string, string>][])
      for (const [k, id] of Object.entries(map)) {
        if (id !== 'radio' && kindOf(id) !== 'screen') continue;
        const key = layerKey(layerName, Number(k));
        const p = at(key);
        out.push({ key, id, d: Math.round(Math.hypot(p.x - here.x, p.y - here.y)) });
      }
    return out.sort((a, b) => a.d - b.d);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isl, speaker]);
  const tile = (key: string, art: ReactNode, label: string, value: string | null, on: boolean) => (
    <button key={key} type="button" onClick={() => onPick(value)} className={`flex flex-col items-center gap-1 rounded-md border p-2 text-xs hover:bg-tile ${on ? 'border-accent bg-accent/10' : 'border-rule'}`}>
      {art}
      <span className="text-center font-semibold leading-tight">{label}</span>
    </button>
  );
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4" onClick={onClose}>
      <div className="page max-h-[80vh] w-full max-w-lg space-y-3 overflow-y-auto rounded-md p-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2">
          <p className="font-display text-lg font-bold">🔊 {itemName('speaker')}</p>
          <button type="button" onClick={onClose} className="ml-auto text-ink-soft" aria-label={tr('Close', 'Fermer')}>
            ✕
          </button>
        </div>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {tile('own', <ItemArt id="speaker" className="size-12 text-3xl" />, tr('Its own tune', 'Son propre air'), null, current === null)}
          {tile('off', <span className="grid size-12 place-items-center text-3xl">🔇</span>, tr('Off', 'Éteinte'), 'off', current === 'off')}
        </div>
        <p className="font-display text-sm font-bold">{tr('Connect it to', 'La relier à')}</p>
        {devices.length ? (
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {devices.map((dv) => tile(dv.key, <ItemArt id={dv.id} className="size-12 text-3xl" />, `${itemName(dv.id)} · ${dv.d} ${tr('away', 'cases')}`, dv.key, current === dv.key))}
          </div>
        ) : (
          <p className="text-xs text-ink-soft">{tr('No radio or TV on the island yet.', 'Pas encore de radio ni de télé sur l’île.')}</p>
        )}
        <p className="text-xs text-ink-soft">{tr('Linked, it plays what the radio or TV plays: heard near the speaker too.', 'Reliée, elle joue ce que joue la radio ou la télé : on l’entend aussi près de l’enceinte.')}</p>
        <VolumeSlider value={vol} onChange={onVol} />
      </div>
    </div>
  );
}

/** A YouTube link for a radio or a TV: pasted, checked, set (or taken off). */
function YouTubeField({ current, onSet }: { current: string | null; onSet: (id: string | null) => void }) {
  const [text, setText] = useState(current ? `https://youtu.be/${current}` : '');
  const id = ytId(text);
  return (
    <div className="space-y-1 rounded-md border border-rule p-2">
      <p className="font-display text-sm font-bold">▶️ YouTube</p>
      <div className="flex gap-2">
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder={tr('Paste a YouTube link', 'Colle un lien YouTube')} className="min-w-0 flex-1 rounded-md border border-rule bg-card px-2 py-1 text-sm" />
        <button type="button" disabled={!id} onClick={() => onSet(id)} className="btn-accent rounded-md px-3 text-sm font-semibold disabled:opacity-40">
          {tr('Play it', 'Le passer')}
        </button>
        {current && (
          <button type="button" onClick={() => onSet(null)} className="btn-paper rounded-md px-2 text-sm" title={tr('No more YouTube', 'Plus de YouTube')}>
            ✕
          </button>
        )}
      </div>
      {text.trim() && !id && <p className="text-xs text-coral">{tr('That’s not a YouTube link.', 'Ce n’est pas un lien YouTube.')}</p>}
    </div>
  );
}
