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
import { dig, harvest, helpSeed, idx, isReady, isSolid, ISLAND, kindOf, NATURAL, newIsland, pickUp, place, plant, readyOn, showCard, solidAt, surfaceAt, water, xy, type Bag, type Change, type Island, type Who } from './island';
import { islandBand, type Source } from './music';
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
const nameOf = (x: { name: string; fr: string }) => tr(x.name, x.fr);
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
  'firefly-jar': '#bef264',
  'stained-window': '#fca5a5',
  spotlight: '#fffbeb',
  fireplace: '#fb923c',
};

const itemIcon = (id: string) => (id === 'dirt' ? '🟫' : (ITEM_BY_ID.get(id)?.icon ?? '❔'));
/** Frames hung on the wall (the card fills them); the others are stands that hold a card up. */
const HUNG = new Set(['card-frame', 'gold-card-frame', 'grand-card-frame']);
/** Where a stand holds its card, in the cell. */
const STAND: Record<string, React.CSSProperties> = {
  pedestal: { left: '31%', top: '-12%', width: '38%', height: '50%' },
  'crown-cushion': { left: '31%', top: '-20%', width: '38%', height: '50%' },
  'display-case': { left: '32%', top: '24%', width: '36%', height: '46%' },
  podium: { left: '34%', top: '-14%', width: '32%', height: '52%' },
};

// The player's box, in cells, and how it moves.
const PW = 0.78;
const PH = 0.92;
const SPEED = 6;
const GRAVITY = 32;
const JUMP = 11.5;

export function IslandView({ shared, mode = 'own', act: shareAct, who, names = {} }: { shared?: Island; mode?: IslandMode; act?: Act; who?: Who; names?: Record<string, string> }) {
  const local = useProgress((s) => s.island) ?? null;
  const island = shared ?? local;
  const isl = useMemo(() => island ?? newIsland(), [island]);
  const helpReward = useProgress((s) => s.helpReward);
  const items = useProgress((s) => s.islandItems ?? {});
  const seeds = useProgress((s) => s.seeds ?? {});
  const avatar = useProgress((s) => s.avatar);
  const owned = useProgress((s) => s.cards);
  const localAct = useProgress((s) => s.islandAct);
  const act: Act = shareAct ?? ((move) => localAct(move));
  const tools = TOOLS.filter((t) => mode !== 'visit' || t.id === 'walk');

  const [tool, setTool] = useState<Tool>('walk');
  const [pick, setPick] = useState<string | null>(null);
  const [pair, setPair] = useState<string[]>([]);
  const [note, setNote] = useState<ReactNode>(null);
  const [framing, setFraming] = useState<number | null>(null);
  const [hover, setHover] = useState<number | null>(null);
  const [tv, setTv] = useState<{ cell: number; card: string } | null>(null);
  const backdrop = useProgress((s) => s.backdrop);
  // Day and night, by the clock (checked every minute), or forced to see it.
  const [sky, setSky] = useState<'auto' | 'day' | 'night'>('auto');
  const [clockDark, setClockDark] = useState(() => darknessAt());
  useEffect(() => {
    const t = window.setInterval(() => setClockDark(darknessAt()), 60_000);
    return () => window.clearInterval(t);
  }, []);
  const dark = sky === 'auto' ? clockDark : sky === 'night' ? 0.7 : 0;

  // The tile size: about 22 cells across the viewport.
  const box = useRef<HTMLDivElement>(null);
  const [T, setT] = useState(32);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const fit = () => setT(Math.max(24, Math.min(36, Math.floor(el.clientWidth / 22))));
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

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
  const TRef = useRef(T);
  TRef.current = T;

  useEffect(() => {
    // Start on top of whatever is at the spawn column now.
    const cx = Math.floor(ISLAND.w / 2);
    let y = 0;
    while (y < ISLAND.h && !solidAt(islRef.current, cx, y)) y++;
    pos.current = { x: cx + (1 - PW) / 2, y: y - PH - 0.01 };
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
    const step = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const k = keys.current;
      const p = pos.current;
      const v = vel.current;
      v.x = (k.has('right') ? SPEED : 0) - (k.has('left') ? SPEED : 0);
      if (k.has('jump') && ground.current) {
        v.y = -JUMP;
        ground.current = false;
      }
      v.y = Math.min(20, v.y + GRAVITY * dt);
      // Across: blocked by a one-cell step on the ground → climb it.
      const nx = p.x + v.x * dt;
      if (!hits(nx, p.y)) p.x = nx;
      else if (ground.current && !hits(nx, p.y - 1)) {
        p.x = nx;
        p.y = Math.floor(p.y) - 1 + (1 - PH) - 0.01;
      } else p.x = v.x > 0 ? Math.floor(nx + PW) - PW - 0.001 : Math.ceil(nx) + 0.001;
      // Down (or up).
      const ny = p.y + v.y * dt;
      if (!hits(p.x, ny)) {
        p.y = ny;
        ground.current = false;
      } else {
        if (v.y > 0) {
          p.y = Math.floor(ny + PH) - PH - 0.001;
          ground.current = true;
        } else p.y = Math.ceil(ny) + 0.001;
        v.y = 0;
      }
      // In the sea: back to the middle.
      if (p.y > ISLAND.sea + 0.6 && (p.x < 4 || p.x > ISLAND.w - 5)) {
        const s = spawn();
        let y = 0;
        while (y < ISLAND.h && !solidAt(islRef.current, Math.floor(s.x), y)) y++;
        p.x = s.x;
        p.y = y - PH - 0.01;
        v.y = 0;
      }
      // The camera follows across; the player is drawn where it is.
      const t = TRef.current;
      const view = box.current?.clientWidth ?? 600;
      cam.current = Math.max(0, Math.min(ISLAND.w * t - view, (p.x + PW / 2) * t - view / 2));
      if (world.current) world.current.style.transform = `translateX(${-cam.current}px)`;
      if (far.current) far.current.style.transform = `translateX(${-cam.current * 0.3}px)`;
      if (me.current) {
        me.current.style.transform = `translate(${p.x * t}px, ${p.y * t}px)`;
        me.current.dataset.walking = v.x !== 0 && ground.current ? '1' : '';
        if (v.x) me.current.dataset.left = v.x < 0 ? '1' : '';
      }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, []);

  // The music makers near the player, heard every 100 ms (the band schedules a little ahead).
  const sources = useMemo<Source[]>(
    () =>
      Object.entries(isl.fg)
        .filter(([, id]) => kindOf(id) === 'music')
        .map(([k, id]) => ({ cell: Number(k), id, x: xy(Number(k)).x + 0.5, y: xy(Number(k)).y + 0.5 })),
    [isl],
  );
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

  // The keys: arrows or WASD, Space to jump (while the island has the focus).
  const keyOf = (k: string) => (k === 'ArrowLeft' || k === 'a' || k === 'q' ? 'left' : k === 'ArrowRight' || k === 'd' ? 'right' : k === 'ArrowUp' || k === 'w' || k === 'z' || k === ' ' ? 'jump' : null);
  const onKey = (down: boolean) => (e: React.KeyboardEvent) => {
    const k = keyOf(e.key.length === 1 ? e.key.toLowerCase() : e.key);
    if (!k) return;
    e.preventDefault();
    if (down) keys.current.add(k);
    else keys.current.delete(k);
  };

  // Which cell is under the pointer, and whether it's in reach.
  const cellAt = (e: React.PointerEvent) => {
    const r = box.current!.getBoundingClientRect();
    const x = Math.floor((e.clientX - r.left + cam.current) / T);
    const y = Math.floor((e.clientY - r.top) / T);
    return x >= 0 && y >= 0 && x < ISLAND.w && y < ISLAND.h ? idx(x, y) : null;
  };
  const inReach = (cell: number) => {
    const { x, y } = xy(cell);
    const p = pos.current;
    return Math.hypot(x + 0.5 - (p.x + PW / 2), y + 0.5 - (p.y + PH / 2)) <= ISLAND.reach;
  };
  const say = (msg: ReactNode) => setNote(msg);
  const run = (move: Move, ok: string, what?: string, then?: () => void) =>
    void Promise.resolve(act(move, what)).then((err) => {
      if (err) return say(`⚠️ ${err}`);
      say(ok);
      sfx.select();
      then?.();
    });

  const click = (cell: number) => {
    box.current?.focus();
    if (!inReach(cell)) return say(tr('Too far: walk closer.', 'Trop loin : approche-toi.'));
    const plot = isl.plots[cell];
    const front = isl.fg[cell];
    const mine = !!plot && (who ? (plot.by ? plot.by === who.uid : who.uid === who.owner) : true);
    if (plot && isReady(plot) && mine) {
      let got: ReturnType<typeof harvest>['got'] | null = null;
      void Promise.resolve(
        act((i, it, sd) => {
          const h = harvest(i, it, sd, cell, Math.random, todayKey(), who);
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
      return;
    }
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
      if (front && kindOf(front) === 'frame') {
        if (mode === 'visit') return card && CARD_BY_ID.get(card) ? say(`🖼️ ${shownName(CARD_BY_ID.get(card)!.name, CARD_BY_ID.get(card)!.set)}`) : undefined;
        return setFraming(cell);
      }
      if (front && kindOf(front) === 'screen') {
        if (!card) return mode === 'visit' ? say(tr('Nothing on this screen.', 'Rien sur cet écran.')) : setFraming(cell);
        setTv({ cell, card });
        return say(
          <>
            📺 {tr('On air.', 'À l’antenne.')}{' '}
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
      run((i, it) => place(i, it, cell, id, who), `${itemIcon(id)} ${itemName(id)}`, 'build', () => {
        if (kindOf(id) === 'frame' || kindOf(id) === 'screen') setFraming(cell);
      });
      if ((items[pick] ?? 0) <= 1) setPick(null);
      return;
    }
    if (tool === 'pick') return run((i, it) => pickUp(i, it, cell, who), tr('Back in your bag.', 'De retour dans ton sac.'), 'pick');
    if (tool === 'dig') return run((i, it) => dig(i, it, cell), tr('+1 dirt (build it elsewhere).', '+1 terre (à reposer ailleurs).'), 'dig');
    if (tool === 'plant') {
      if (pair.length < 2) return say(tr('Pick two seeds below first (the same one twice is fine).', 'Choisis d’abord deux graines ci-dessous (deux fois la même, ça marche).'));
      const [a, b] = pair;
      run((i, _it, sd) => plant(i, sd, cell, a, b, todayKey(), who), tr('Planted! Come back tomorrow.', 'Planté ! Reviens demain.'), 'plant', () => setPair([]));
    }
  };

  const avatarCard = avatar ? CARD_BY_ID.get(avatar) : undefined;
  const bagItems = Object.entries(items).filter(([, n]) => n > 0);
  const bagSeeds = SEEDS.filter((s) => (seeds[s.id] ?? 0) > 0);
  const left = (id: string) => (seeds[id] ?? 0) - pair.filter((x) => x === id).length;
  const hoverOk = hover !== null && inReach(hover);

  return (
    <div className="space-y-3">
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
        className="island-sky relative touch-none select-none overflow-hidden rounded-md border border-rule outline-none focus-visible:ring-2 focus-visible:ring-accent"
        style={{ height: ISLAND.h * T }}
        aria-label={tr('Your island. Arrows or WASD to walk, Space to jump; click a spot to use the tool.', 'Ton île. Flèches ou ZQSD pour marcher, Espace pour sauter ; clique un endroit pour utiliser l’outil.')}
      >
        <div ref={far} className="pointer-events-none absolute left-0 top-0" style={{ width: ISLAND.w * T, height: ISLAND.h * T }}>
          <Backdrop T={T} />
          <Clouds T={T} />
        </div>
        <div className="island-night pointer-events-none absolute inset-0 transition-opacity duration-1000" style={{ opacity: dark / 0.7 }} />
        <div ref={world} className="absolute left-0 top-0" style={{ width: ISLAND.w * T, height: ISLAND.h * T }}>
          <World isl={isl} T={T} />
          {hover !== null && tool !== 'walk' && (
            <div
              className={`pointer-events-none absolute rounded-sm border-2 ${hoverOk ? 'border-white/80 bg-white/10' : 'border-coral/70'}`}
              style={{ left: xy(hover).x * T, top: xy(hover).y * T, width: T, height: T }}
            />
          )}
          {/* Night: everything darker, the lights glowing through (you stay lit). */}
          {dark > 0 && <div key="night" className="pointer-events-none absolute inset-0 transition-opacity duration-1000" style={{ background: '#0b1030', opacity: dark }} />}
          {dark > 0 && <Glows isl={isl} T={T} dark={dark} />}
          <div key="me" ref={me} className="island-me pointer-events-none absolute left-0 top-0" style={{ width: PW * T, height: PH * T }}>
            <span className="island-me-shadow" />
            {avatarCard ? <CardAvatar card={avatarCard} className="island-me-face size-full" /> : <span className="island-me-face grid size-full place-items-center rounded-full bg-ochre text-lg">🙂</span>}
          </div>
          {tv && <TvShow tv={tv} T={T} onEnd={() => setTv(null)} />}
        </div>
        {dark > 0 && <div className="island-stars pointer-events-none absolute inset-x-0 top-0 h-[40%] transition-opacity duration-1000" style={{ opacity: dark / 0.7 }} />}
      </div>

      {/* Touch: walk and jump. */}
      <div className="flex justify-center gap-2 sm:hidden">
        {(['left', 'jump', 'right'] as const).map((k) => (
          <button
            key={k}
            type="button"
            className="touch-none rounded-md border border-rule bg-card px-5 py-2 text-lg font-bold"
            onPointerDown={() => keys.current.add(k)}
            onPointerUp={() => keys.current.delete(k)}
            onPointerLeave={() => keys.current.delete(k)}
          >
            {k === 'left' ? '◀' : k === 'right' ? '▶' : '⤒'}
          </button>
        ))}
      </div>

      {/* The tools. */}
      <div className="flex flex-wrap items-center gap-1.5">
        {tools.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => (setTool(t.id), say(null), box.current?.focus())}
            className={`rounded-md border px-3 py-1 text-sm font-semibold transition ${tool === t.id ? 'border-accent bg-accent/15' : 'border-rule hover:bg-tile'}`}
          >
            {t.icon} {nameOf(t)}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setSky((s) => (s === 'auto' ? (clockDark > 0.35 ? 'day' : 'night') : 'auto'))}
          className="rounded-md border border-rule px-2.5 py-1 text-sm hover:bg-tile"
          title={tr('Day and night follow your clock; this shows the other one for a while.', 'Le jour et la nuit suivent ton horloge ; ceci montre l’autre un moment.')}
        >
          {sky === 'auto' ? (clockDark > 0.35 ? '🌙' : '☀️') : sky === 'night' ? '🌙' : '☀️'} {sky === 'auto' ? tr('Clock', 'Horloge') : tr('Preview', 'Aperçu')}
        </button>
        <span className="ml-auto text-xs text-ink-faint">{tr('Arrows/WASD walk · Space jumps · reach: 5 cells', 'Flèches/ZQSD marcher · Espace sauter · portée : 5 cases')}</span>
      </div>
      {note && <p className="rounded-md bg-tile px-3 py-1.5 text-sm">{note}</p>}

      {/* What the tool needs: things to build, or two seeds to plant. */}
      {tool === 'build' && (
        <Panel title={tr('Your bag: pick something, then click a spot', 'Ton sac : choisis, puis clique un endroit')}>
          {bagItems.length === 0 ? (
            <p className="text-sm text-ink-soft">{tr('Nothing yet: plant two seeds, harvest them tomorrow, and what grows lands here. Dig dirt to move the ground.', 'Rien pour l’instant : plante deux graines, récolte-les demain, et ce qui pousse arrive ici. Creuse la terre pour la déplacer.')}</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {bagItems.map(([id, n]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => (setPick(id), box.current?.focus())}
                  className={`flex items-center gap-1 rounded-md border px-2 py-1 text-sm ${pick === id ? 'border-accent bg-accent/15' : 'border-rule hover:bg-tile'}`}
                >
                  <ItemArt id={id} className="size-7 text-lg" /> {itemName(id)} <span className="text-xs text-ink-faint">×{n}</span>
                </button>
              ))}
            </div>
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

      {framing !== null && (
        <CardPicker
          owned={owned}
          screen={kindOf(isl.fg[framing]) === 'screen'}
          backdrop={backdrop}
          current={isl.shown[framing] ?? null}
          onPick={(id) => {
            const screen = kindOf(isl.fg[framing]) === 'screen';
            run((i) => showCard(i, framing, id, who), id ? (screen ? tr('Tuned in! Click the screen to play it.', 'Réglé ! Clique l’écran pour le lancer.') : tr('On display!', 'Exposée !')) : tr('Emptied.', 'Vidé.'), 'build');
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
const World = memo(function World({ isl, T }: { isl: Island; T: number }) {
  const today = todayKey();
  const out: ReactNode[] = [];
  // The sea at both ends.
  for (const x0 of [0, ISLAND.w - 4]) out.push(<div key={`sea${x0}`} className="island-sea absolute" style={{ left: x0 * T, top: ISLAND.sea * T, width: 4 * T, height: (ISLAND.h - ISLAND.sea) * T }} />);
  // Walls behind, a little shaded.
  for (const [k, id] of Object.entries(isl.bg)) {
    const { x, y } = xy(Number(k));
    out.push(<ItemArt key={`b${k}`} id={id} className="island-wall absolute" style={{ left: x * T, top: y * T, width: T, height: T, fontSize: T * 0.6 }} />);
  }
  const ground = (x: number, y: number) => isSolid(isl.fg[idx(x, y)]) || (x >= 0 && x < ISLAND.w && y >= ISLAND.h);
  for (const [k, id] of Object.entries(isl.fg)) {
    const cell = Number(k);
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
          className={`absolute ${id === 'stone' ? 'island-stone' : sand ? 'island-sand' : 'island-dirt'}`}
          style={{ ...style, ...(!ground(x, y - 1) ? { borderTopLeftRadius: ground(x - 1, y) ? 0 : T * 0.3, borderTopRightRadius: ground(x + 1, y) ? 0 : T * 0.3 } : {}), backgroundColor: id === 'dirt' && !sand ? dirtColor(y) : undefined, backgroundPosition: `${(h % 4) * 8}px ${((h >> 3) % 4) * 8}px`, boxShadow: edges || undefined }}
        >
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
        <div key={k} className={`absolute ${kind === 'light' ? 'island-light' : ''} ${kind === 'music' ? 'island-music' : ''}`} style={{ ...style, fontSize: T * 0.8, lineHeight: 1 }} title={ITEM_BY_ID.get(id)?.name}>
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
  for (const x0 of [0, ISLAND.w - 4])
    out.push(<div key={`w${x0}`} className="island-wave absolute" style={{ left: x0 * T, top: ISLAND.sea * T - T * 0.22, width: 4 * T, height: T * 0.4, backgroundSize: `${T}px 100%` }} />);
  for (const fx of [4 - 0.45, ISLAND.w - 4 - 0.15]) out.push(<div key={`f${fx}`} className="island-foam absolute" style={{ left: fx * T, top: ISLAND.sea * T - T * 0.14, width: T * 0.6, height: T * 0.32 }} />);
  return <>{out}</>;
});

/** Picks one of your cards to show in a frame. */
function CardPicker({ owned, screen = false, backdrop, current, onPick, onClose }: { owned: Record<string, number>; screen?: boolean; backdrop?: string | null; current: string | null; onPick: (id: string | null) => void; onClose: () => void }) {
  const [q, setQ] = useState('');
  const bg = screen && backdrop ? CARD_BY_ID.get(backdrop) : undefined;
  const cards = useMemo(
    () =>
      Object.keys(owned)
        .map((id) => CARD_BY_ID.get(id))
        .filter((c): c is Card => !!c)
        // A screen plays clips: only the cards that have one.
        .filter((c) => !screen || !!screenClip(c))
        .filter((c) => !q || shownName(c.name, c.set).toLowerCase().includes(q.toLowerCase()))
        .slice(0, 120),
    [owned, q, screen],
  );
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4" onClick={onClose}>
      <div className="page max-h-[80vh] w-full max-w-lg space-y-2 overflow-hidden rounded-md p-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2">
          <p className="font-display text-lg font-bold">{screen ? `📺 ${tr('Put a card’s clip on the screen', 'Mettre le clip d’une carte à l’écran')}` : `🖼️ ${tr('Show a card', 'Exposer une carte')}`}</p>
          <button type="button" onClick={onClose} className="ml-auto text-ink-soft" aria-label={tr('Close', 'Fermer')}>
            ✕
          </button>
        </div>
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
          {cards.length === 0 && <p className="col-span-full text-sm text-ink-soft">{screen ? tr('None of your cards has a clip yet.', 'Aucune de tes cartes n’a encore de clip.') : tr('No card found.', 'Aucune carte trouvée.')}</p>}
        </div>
      </div>
    </div>
  );
}

/** At night, each light's glow, and the light itself drawn bright over the dark. */
const Glows = memo(function Glows({ isl, T, dark }: { isl: Island; T: number; dark: number }) {
  return (
    <>
      {Object.entries(isl.fg)
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

/**
 * A screen switched on: the card's clip, big, above the TV. A video plays once with its sound (the owner's rule: card
 * videos play on a moment, with their own audio, never on a loop); a GIF loops until it's clicked off.
 */
function TvShow({ tv, T, onEnd }: { tv: { cell: number; card: string }; T: number; onEnd: () => void }) {
  const card = CARD_BY_ID.get(tv.card);
  // One of its clips, picked when switched on.
  const [clip] = useState(() => {
    const all = screenClips(card);
    return all[Math.floor(Math.random() * all.length)];
  });
  const volume = useProgress((s) => (s.sound ? s.clipVolume / 100 : 0));
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.volume = Math.min(1, volume);
  }, [volume]);
  if (!card || !clip) return null;
  const { x, y } = xy(tv.cell);
  const w = 7 * T;
  const h = (w * 9) / 16;
  const left = Math.max(0, Math.min(ISLAND.w * T - w, (x + 0.5) * T - w / 2));
  const top = Math.max(2, y * T - h - 6);
  return (
    <div className="island-tv-show absolute overflow-hidden rounded-md" style={{ left, top, width: w, height: h }} onPointerDown={(e) => (e.stopPropagation(), onEnd())} title={tr('Click to switch off', 'Clique pour éteindre')}>
      {GIF_CLIP.test(clip) ? (
        <GifLoop src={clip} className="size-full object-cover" />
      ) : (
        <video ref={ref} src={clip} autoPlay playsInline muted={volume === 0} onEnded={onEnd} onError={onEnd} className="size-full object-cover" />
      )}
      <span className="absolute bottom-1 left-2 rounded bg-black/60 px-1.5 text-[11px] font-semibold text-white">{shownName(card.name, card.set)}</span>
    </div>
  );
}
