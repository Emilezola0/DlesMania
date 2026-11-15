// Friends → Island → My island (stage 2a): your icon walks on a small island seen from the side. Plant two seeds,
// harvest what grows a day or two later, and build with it: blocks, wallpapers, lights, music, furniture, and frames
// that show your cards. The rules of each move are in src/island/island.ts; the save is the progress store's.
import { memo, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { CARD_BY_ID, type Card } from '../gacha/cards';
import { CardAvatar, ShownPicture } from '../gacha/Perks';
import { shownName } from '../lib/french';
import { tr } from '../lib/i18n';
import { sfx } from '../lib/sfx';
import { todayKey } from '../lib/date';
import { useProgress } from '../store/progress';
import { dig, grassy, harvest, idx, isReady, ISLAND, isSea, kindOf, NATURAL, newIsland, pickUp, place, plant, readyOn, showCard, solidAt, surfaceAt, xy, type Island } from './island';
import { SeedArt } from './SeedBook';
import { ITEM_BY_ID, SEED_BY_ID, SEEDS } from './seeds';

type Tool = 'walk' | 'build' | 'plant' | 'pick' | 'dig';
const TOOLS: { id: Tool; icon: string; name: string; fr: string }[] = [
  { id: 'walk', icon: '🚶', name: 'Walk', fr: 'Marcher' },
  { id: 'build', icon: '🧱', name: 'Build', fr: 'Construire' },
  { id: 'plant', icon: '🌱', name: 'Plant', fr: 'Planter' },
  { id: 'pick', icon: '✋', name: 'Pick up', fr: 'Ramasser' },
  { id: 'dig', icon: '⛏️', name: 'Dig', fr: 'Creuser' },
];
const nameOf = (x: { name: string; fr: string }) => tr(x.name, x.fr);
const itemName = (id: string) => (NATURAL[id] ? nameOf(NATURAL[id]) : nameOf(ITEM_BY_ID.get(id)!));
const itemIcon = (id: string) => (id === 'dirt' ? '🟫' : (ITEM_BY_ID.get(id)?.icon ?? '❔'));

// The player's box, in cells, and how it moves.
const PW = 0.78;
const PH = 0.92;
const SPEED = 6;
const GRAVITY = 32;
const JUMP = 11.5;

export function IslandView() {
  const island = useProgress((s) => s.island) ?? null;
  const isl = useMemo(() => island ?? newIsland(), [island]);
  const items = useProgress((s) => s.islandItems ?? {});
  const seeds = useProgress((s) => s.seeds ?? {});
  const avatar = useProgress((s) => s.avatar);
  const owned = useProgress((s) => s.cards);
  const act = useProgress((s) => s.islandAct);

  const [tool, setTool] = useState<Tool>('walk');
  const [pick, setPick] = useState<string | null>(null);
  const [pair, setPair] = useState<string[]>([]);
  const [note, setNote] = useState<string | null>(null);
  const [framing, setFraming] = useState<number | null>(null);
  const [hover, setHover] = useState<number | null>(null);

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
  const say = (msg: string | null) => setNote(msg);
  const run = (move: Parameters<typeof act>[0], ok: string, sound: 'select' | 'victory' = 'select') => {
    const err = act(move);
    if (err) say(`⚠️ ${err}`);
    else {
      say(ok);
      sfx[sound]();
    }
    return !err;
  };

  const click = (cell: number) => {
    box.current?.focus();
    if (!inReach(cell)) return say(tr('Too far: walk closer.', 'Trop loin : approche-toi.'));
    const plot = isl.plots[cell];
    const front = isl.fg[cell];
    if (plot && isReady(plot)) {
      let got: ReturnType<typeof harvest>['got'] | null = null;
      const err = act((i, it, sd) => {
        const h = harvest(i, it, sd, cell);
        got = h.got;
        return h;
      });
      if (err || !got) return say(`⚠️ ${err}`);
      const g = got as ReturnType<typeof harvest>['got'];
      sfx.victory();
      return say(
        [
          `🌿 ${tr('Harvested', 'Récolté')}: ${itemIcon(g.item)} ${itemName(g.item)}`,
          g.seed ? `+ ${nameOf(SEED_BY_ID.get(g.seed)!)}` : '',
          g.hybrid ? `🧬 ${tr('Hybrid', 'Hybride')}: ${nameOf(SEED_BY_ID.get(g.hybrid)!)}!` : '',
        ]
          .filter(Boolean)
          .join(' · '),
      );
    }
    if (plot) return say(`🌱 ${tr('Growing: ready on', 'Pousse : prêt le')} ${readyOn(plot)}.`);
    if (tool === 'walk') {
      if (front && kindOf(front) === 'frame') return setFraming(cell);
      return;
    }
    if (tool === 'build') {
      if (!pick) return say(tr('Pick something to build from your bag below.', 'Choisis quoi construire dans ton sac ci-dessous.'));
      if (run((i, it) => place(i, it, cell, pick), `${itemIcon(pick)} ${itemName(pick)}`) && kindOf(pick) === 'frame') setFraming(cell);
      if ((items[pick] ?? 0) <= 1) setPick(null);
      return;
    }
    if (tool === 'pick') return run((i, it) => pickUp(i, it, cell), tr('Back in your bag.', 'De retour dans ton sac.'));
    if (tool === 'dig') return run((i, it) => dig(i, it, cell), tr('+1 dirt (build it elsewhere).', '+1 terre (à reposer ailleurs).'));
    if (tool === 'plant') {
      if (pair.length < 2) return say(tr('Pick two seeds below first (the same one twice is fine).', 'Choisis d’abord deux graines ci-dessous (deux fois la même, ça marche).'));
      if (run((i, _it, sd) => plant(i, sd, cell, pair[0], pair[1]), tr('Planted! Come back tomorrow.', 'Planté ! Reviens demain.'))) setPair([]);
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
        <div ref={world} className="absolute left-0 top-0" style={{ width: ISLAND.w * T, height: ISLAND.h * T }}>
          <World isl={isl} T={T} />
          {hover !== null && tool !== 'walk' && (
            <div
              className={`pointer-events-none absolute rounded-sm border-2 ${hoverOk ? 'border-white/80 bg-white/10' : 'border-coral/70'}`}
              style={{ left: xy(hover).x * T, top: xy(hover).y * T, width: T, height: T }}
            />
          )}
          <div ref={me} className="island-me pointer-events-none absolute left-0 top-0" style={{ width: PW * T, height: PH * T }}>
            {avatarCard ? <CardAvatar card={avatarCard} className="size-full" /> : <span className="grid size-full place-items-center rounded-full bg-ochre text-lg">🙂</span>}
          </div>
        </div>
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
        {TOOLS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => (setTool(t.id), say(null), box.current?.focus())}
            className={`rounded-md border px-3 py-1 text-sm font-semibold transition ${tool === t.id ? 'border-accent bg-accent/15' : 'border-rule hover:bg-tile'}`}
          >
            {t.icon} {nameOf(t)}
          </button>
        ))}
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
                  <span className="text-lg leading-none">{itemIcon(id)}</span> {itemName(id)} <span className="text-xs text-ink-faint">×{n}</span>
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
          current={isl.shown[framing] ?? null}
          onPick={(id) => {
            run((i) => showCard(i, framing, id), id ? tr('On display!', 'Exposée !') : tr('Frame emptied.', 'Cadre vidé.'));
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
  for (const [k, id] of Object.entries(isl.bg)) {
    const { x, y } = xy(Number(k));
    out.push(
      <div key={`b${k}`} className="island-wall absolute grid place-items-center" style={{ left: x * T, top: y * T, width: T, height: T, fontSize: T * 0.6 }}>
        {ITEM_BY_ID.get(id)?.icon}
      </div>,
    );
  }
  for (const [k, id] of Object.entries(isl.fg)) {
    const cell = Number(k);
    const { x, y } = xy(cell);
    const style = { left: x * T, top: y * T, width: T, height: T };
    const kind = kindOf(id);
    if (kind === 'natural') {
      out.push(<div key={k} className={`absolute ${id === 'stone' ? 'island-stone' : 'island-dirt'} ${grassy(isl, x, y) ? 'island-grass' : ''}`} style={style} />);
    } else if (kind === 'frame') {
      const card = isl.shown[k] ? CARD_BY_ID.get(isl.shown[k]) : undefined;
      out.push(
        <div key={k} className="absolute grid place-items-center" style={style} title={card ? shownName(card.name, card.set) : ITEM_BY_ID.get(id)?.name}>
          {card ? (
            <span className={`island-frame ${id.includes('gold') || id === 'grand-card-frame' ? 'island-frame-gold' : ''} block overflow-hidden`} style={{ width: T * 0.86, height: T * 0.96 }}>
              <ShownPicture card={card} still className="size-full object-cover object-top" />
            </span>
          ) : (
            <span style={{ fontSize: T * 0.8 }}>{ITEM_BY_ID.get(id)?.icon}</span>
          )}
        </div>,
      );
    } else {
      const block = kind === 'block' || kind === 'floor';
      out.push(
        <div
          key={k}
          className={`absolute grid ${block ? 'island-block place-items-center' : 'place-items-end justify-center'} ${kind === 'light' ? 'island-light' : ''}`}
          style={{ ...style, fontSize: T * (block ? 0.72 : 0.82), lineHeight: 1 }}
          title={ITEM_BY_ID.get(id)?.name}
        >
          {ITEM_BY_ID.get(id)?.icon}
        </div>,
      );
    }
  }
  for (const [k, p] of Object.entries(isl.plots)) {
    const { x, y } = xy(Number(k));
    const ready = isReady(p, today);
    out.push(
      <div key={`p${k}`} className={`absolute grid place-items-end justify-center ${ready ? 'island-ready' : ''}`} style={{ left: x * T, top: y * T, width: T, height: T, fontSize: T * 0.7, lineHeight: 1 }} title={ready ? 'Ready!' : `Ready on ${readyOn(p)}`}>
        <span className="island-mound absolute bottom-0 left-[10%] h-[22%] w-[80%] rounded-t-full" />
        <span className="relative">{ready ? '🌿' : '🌱'}</span>
      </div>,
    );
  }
  // Waves over the sea's surface.
  for (let x = 0; x < ISLAND.w; x++) if (isSea(x, ISLAND.sea)) out.push(<div key={`w${x}`} className="island-wave absolute" style={{ left: x * T, top: ISLAND.sea * T - 3, width: T, height: 6 }} />);
  return <>{out}</>;
});

/** Picks one of your cards to show in a frame. */
function CardPicker({ owned, current, onPick, onClose }: { owned: Record<string, number>; current: string | null; onPick: (id: string | null) => void; onClose: () => void }) {
  const [q, setQ] = useState('');
  const cards = useMemo(
    () =>
      Object.keys(owned)
        .map((id) => CARD_BY_ID.get(id))
        .filter((c): c is Card => !!c)
        .filter((c) => !q || shownName(c.name, c.set).toLowerCase().includes(q.toLowerCase()))
        .slice(0, 120),
    [owned, q],
  );
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4" onClick={onClose}>
      <div className="page max-h-[80vh] w-full max-w-lg space-y-2 overflow-hidden rounded-md p-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2">
          <p className="font-display text-lg font-bold">🖼️ {tr('Show a card', 'Exposer une carte')}</p>
          <button type="button" onClick={onClose} className="ml-auto text-ink-soft" aria-label={tr('Close', 'Fermer')}>
            ✕
          </button>
        </div>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={tr('Search your cards', 'Cherche dans tes cartes')} className="w-full rounded-md border border-rule bg-card px-3 py-1.5 text-sm" autoFocus />
        <div className="grid max-h-[50vh] grid-cols-3 gap-2 overflow-y-auto sm:grid-cols-4">
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
          {cards.length === 0 && <p className="col-span-full text-sm text-ink-soft">{tr('No card found.', 'Aucune carte trouvée.')}</p>}
        </div>
      </div>
    </div>
  );
}
