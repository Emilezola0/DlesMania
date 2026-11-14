import { useEffect, useId, useMemo, useRef, type PointerEvent } from 'react';

/**
 * The drawn pack wrappers (the Boutique's Prestige and Ascended collections), each an SVG over the pack, the size
 * of the pack (300 × 400): Dragon Scale (scales rippling like a dragon on the move; one flips, gold side up, under
 * the pointer), Black Hole (a disc of fire turning, lensed over its shadow, stars falling in), Event Horizon (its
 * Ascended cousin, violet and cyan, space rippling into it), Big Bang (a point of light about to become everything),
 * Crystal (cut facets, light running across them), Phoenix (a bird of flame beating its wings, embers rising) and
 * Gilded Deco (gold Art Deco fans, light running up the rays). Their animations are in src/index.css (.wa-*);
 * still under reduced motion. The Thunderstorm has its own (src/gacha/StormWrap.tsx).
 */
const W = 300;
const H = 400;

/** The same "random" every time for a given seed: a wrapper looks the same each time it's drawn. */
function seeded(seed: number) {
  let s = seed;
  return () => (s = (s * 9301 + 49297) % 233280) / 233280;
}

/** A unique, CSS-safe prefix for the ids inside one drawing (several packs on a page). */
const useUid = () => useId().replace(/[^a-zA-Z0-9]/g, '');

function Svg({ children, onPointerOver }: { children: React.ReactNode; onPointerOver?: (e: PointerEvent<SVGSVGElement>) => void }) {
  return (
    <svg className="pointer-events-none absolute inset-0 size-full" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid slice" aria-hidden onPointerOver={onPointerOver}>
      {children}
    </svg>
  );
}

const pt = (cx: number, cy: number, r: number, a: number) => [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
/** An arc of a circle around (0, 0), from angle a0 to a1 (radians). */
function arc(r: number, a0: number, a1: number) {
  const [x0, y0] = pt(0, 0, r, a0);
  const [x1, y1] = pt(0, 0, r, a1);
  return `M${x0.toFixed(1)} ${y0.toFixed(1)}A${r.toFixed(1)} ${r.toFixed(1)} 0 ${a1 - a0 > Math.PI ? 1 : 0} 1 ${x1.toFixed(1)} ${y1.toFixed(1)}`;
}
/** A flame or a feather: a leaf from `from` to `to`, `w` wide, its tip curling by `curl`. */
function leaf(from: [number, number], to: [number, number], w: number, curl = 0) {
  const [x0, y0] = from;
  const [x1, y1] = to;
  const dx = x1 - x0;
  const dy = y1 - y0;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  const mx = x0 + dx * 0.45;
  const my = y0 + dy * 0.45;
  const tx = x1 + nx * curl;
  const ty = y1 + ny * curl;
  return `M${x0.toFixed(1)} ${y0.toFixed(1)}Q${(mx + nx * w).toFixed(1)} ${(my + ny * w).toFixed(1)} ${tx.toFixed(1)} ${ty.toFixed(1)}Q${(mx - nx * w * 0.7).toFixed(1)} ${(my - ny * w * 0.7).toFixed(1)} ${x0.toFixed(1)} ${y0.toFixed(1)}Z`;
}

// ---------------------------------------------------------------------------------------------- Dragon Scale

/**
 * One scale, hanging point down from (0, 0): an armour plate, its sides bowing out to a sharp point, a raised keel
 * down its middle (one face catching the light, the other in shade), its shadow on the row below.
 */
const SCALE = 'M-14 0L14 0C14 11 9 22 0 33C-9 22-14 11-14 0Z';
const SCALE_LIT = 'M0 1L-13 1C-13 11-8 21 0 31Z';
const SCALE_SHADE = 'M0 1L13 1C13 11 8 21 0 31Z';

/** Flips the scale under the pointer (gold side up), then back: a trail of flipping scales where the pointer goes. */
function flipScale(e: PointerEvent<SVGSVGElement>) {
  const scale = (e.target as Element).closest?.('.wa-scale');
  if (!scale || scale.classList.contains('wa-flip')) return;
  scale.classList.add('wa-flip');
  window.setTimeout(() => scale.classList.remove('wa-flip'), 1500);
}

/**
 * How the dragon slithers: its body lies along a long, soft S and glides down it, its scales going by like a snake's.
 * It moves as a snake does: it stops, sets off again, slow or fast, for a moment or for long, easing from one pace
 * to the next; the S sways only as it moves. Each row sits where the S passes its height; the rows move down two
 * rows' height, then start again two rows higher, where the same scales were.
 */
const DRAGON = { amp: 40, wave: 560, loop: 38, swayPerPx: 1 / 90 };
const dragonX = (y: number, phase: number) =>
  DRAGON.amp * Math.sin((2 * Math.PI * y) / DRAGON.wave + phase) + DRAGON.amp * 0.18 * Math.sin((4 * Math.PI * y) / DRAGON.wave - phase * 0.7);

function useSlither(svg: React.RefObject<SVGGElement | null>) {
  useEffect(() => {
    const root = svg.current;
    if (!root) return;
    const rows = [...root.querySelectorAll<SVGGElement>('[data-y]')].map((el) => ({ el, y: Number(el.dataset.y) }));
    let went = Math.random() * 2000; // how far it has gone (px): each pack's dragon somewhere else along its way
    const draw = () => {
      const s = went % DRAGON.loop;
      const phase = went * DRAGON.swayPerPx;
      for (const { el, y } of rows) el.setAttribute('transform', `translate(${dragonX(y + s, phase).toFixed(1)} ${s.toFixed(1)})`);
    };
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return draw();
    // Its pace: a new one every so often (a stop now and then), for a moment or for a while.
    let speed = 0;
    let target = 0;
    let until = 0;
    let frame = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      if (now >= until) {
        target = Math.random() < 0.28 ? 0 : 6 + Math.random() ** 1.6 * 70;
        until = now + (target === 0 ? 400 + Math.random() * 1800 : 600 + Math.random() * 4200);
      }
      speed += (target - speed) * (1 - Math.exp(-dt * 1.8));
      went += speed * dt;
      draw();
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [svg]);
}

export function DragonWrap() {
  const id = useUid();
  const body = useRef<SVGGElement>(null);
  useSlither(body);
  const rows = useMemo(() => {
    // The dragon's body, winding down the pack: a little over half the pack wide, the same all the way down, and two
    // rows more above it to glide down into view. Nothing else: no background, the pack is see-through around it (index.css).
    const out: { r: number; y: number; xs: number[]; half: number }[] = [];
    for (let r = 0; r < 25; r++) {
      const half = 98;
      const xs: number[] = [];
      for (let x = W / 2 - 168 + (r % 2 ? 14 : 0); x <= W / 2 + 168; x += 28) if (Math.abs(x - W / 2) <= half - 4) xs.push(x);
      out.push({ r, y: -52 + r * 19, xs, half });
    }
    // The lower rows first: each row hangs over the one below, like tiles.
    return out.reverse();
  }, []);
  return (
    <Svg onPointerOver={flipScale}>
      <defs>
        <radialGradient id={`${id}r`} cx="0.5" cy="0.75" r="0.8">
          <stop offset="0" stopColor="#f87171" />
          <stop offset="0.3" stopColor="#b91c1c" />
          <stop offset="0.7" stopColor="#5f0a0a" />
          <stop offset="1" stopColor="#1c0303" />
        </radialGradient>
        <radialGradient id={`${id}u`} cx="0.4" cy="0.25" r="0.9">
          <stop offset="0" stopColor="#fffbeb" />
          <stop offset="0.35" stopColor="#fbbf24" />
          <stop offset="1" stopColor="#78350f" />
        </radialGradient>
        <linearGradient id={`${id}g`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fef3c7" />
          <stop offset="0.5" stopColor="#d97706" />
          <stop offset="1" stopColor="#713f12" />
        </linearGradient>
        <linearGradient id={`${id}b`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#000" stopOpacity="0.75" />
          <stop offset="0.3" stopColor="#000" stopOpacity="0.1" />
          <stop offset="0.5" stopColor="#fde68a" stopOpacity="0.12" />
          <stop offset="0.7" stopColor="#000" stopOpacity="0.1" />
          <stop offset="1" stopColor="#000" stopOpacity="0.75" />
        </linearGradient>
        <radialGradient id={`${id}h`} cx="0.5" cy="1" r="0.9">
          <stop offset="0" stopColor="#f97316" stopOpacity="0.9" />
          <stop offset="0.5" stopColor="#7c2d12" stopOpacity="0.5" />
          <stop offset="1" stopColor="#000" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`${id}l`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0" />
          <stop offset="0.5" stopColor="#fde68a" stopOpacity="0.55" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
      </defs>
      {/* Each row sits on the S (useSlither): the body's round shading (dark flanks, a lit spine) goes with it, so the S shows. */}
      <g ref={body}>
      {rows.map(({ r, y, xs, half }) => (
        <g key={r} data-y={y}>
          {/* The body under the scales, its edge round. */}
          <rect x={W / 2 - half - 3} y={y - 4} width={2 * half + 6} height={30} rx={14} fill="#2a0404" />
          {xs.map((x) => (
            <g key={x} transform={`translate(${x} ${y})`}>
              <path d={SCALE} transform="translate(0 4)" fill="#000" opacity={0.55} />
              <g className="wa-scale">
                <path d={SCALE} fill={`url(#${id}r)`} stroke={`url(#${id}g)`} strokeWidth={1.1} />
                <path d={SCALE_LIT} fill="#fff" opacity={0.13} />
                <path d={SCALE_SHADE} fill="#000" opacity={0.28} />
                <path d="M0 2L0 30" stroke="#fecaca" strokeOpacity={0.55} strokeWidth={1} strokeLinecap="round" />
                <path className="wa-scale-under" d={SCALE} fill={`url(#${id}u)`} stroke="#fef3c7" strokeWidth={1.3} />
              </g>
            </g>
          ))}
          <rect x={W / 2 - half - 4} y={y - 2} width={2 * half + 8} height={21} fill={`url(#${id}b)`} />
        </g>
      ))}
      {/* The spines down its back, gold, swinging with the body. */}
      {rows.map(({ r, y, half }) =>
        r % 2 || half < 20 ? null : (
          <g key={`s${r}`} data-y={y}>
            <path d={`M${W / 2 - 7} ${y + 22}L${W / 2} ${y - 8}L${W / 2 + 7} ${y + 22}Z`} fill={`url(#${id}g)`} stroke="#451a03" strokeWidth={0.8} />
          </g>
        ),
      )}
      </g>
    </Svg>
  );
}

// ---------------------------------------------------------------------------------------------- Black Hole

const BH = {
  gold: { hot: '#fffbeb', mid: '#fdba74', deep: '#ea580c', rim: '#7c2d12', glow: '#fb923c', jet: '#bfdbfe', neb: ['#4c1d95', '#1e3a8a', '#831843'], infall: 6 },
  violet: { hot: '#f0f9ff', mid: '#a5f3fc', deep: '#8b5cf6', rim: '#2e1065', glow: '#a78bfa', jet: '#e0e7ff', neb: ['#312e81', '#0e7490', '#701a75'], infall: 14 },
};
const CX = 150;
const CY = 150;
/** The black hole's centre: above the pack's icon, so the shadow shows; drawn 1.3 times life size around it. */
const BY = 106;
const BS = 1.3;
const TILT = -8;

/**
 * A black hole: a disc of fire seen nearly edge-on, its inner rings turning faster than the outer ones, the far
 * side bent up over the shadow by its gravity, a thin ring of light around the shadow, brighter on the side coming
 * toward us; stars falling in, faint jets, nebulae far behind. `violet`: the Event Horizon (Ascended), space itself
 * rippling in toward it.
 */
export function BlackHoleWrap({ variant = 'gold' }: { variant?: 'gold' | 'violet' }) {
  const id = useUid();
  const p = BH[variant];
  const art = useMemo(() => {
    const rnd = seeded(variant === 'gold' ? 7 : 19);
    const pick = () => {
      const c = rnd();
      return c < 0.3 ? p.hot : c < 0.7 ? p.mid : p.deep;
    };
    const arcs = (n: number, r0: number, r1: number) =>
      Array.from({ length: n }, () => {
        const r = r0 + rnd() * (r1 - r0);
        const a = rnd() * Math.PI * 2;
        return { d: arc(r, a, a + 0.25 + rnd() * 1.3), w: 0.8 + rnd() * 3.2, o: 0.35 + rnd() * 0.6, c: pick() };
      });
    const stars = Array.from({ length: 110 }, () => ({ x: rnd() * W, y: rnd() * H, r: 0.3 + rnd() * 1.1, o: 0.35 + rnd() * 0.65, tw: rnd() < 0.18, d: rnd() * 4 }));
    const infall = Array.from({ length: p.infall }, () => {
      const a = rnd() * Math.PI * 2;
      const dist = 105 + rnd() * 110;
      return { x: CX + Math.cos(a) * dist, y: CY + Math.sin(a) * dist, dx: -Math.cos(a) * dist, dy: -Math.sin(a) * dist, d: -rnd() * 6, t: 2.6 + rnd() * 3.4 };
    });
    return { stars, inner: arcs(24, 50, 74), mid: arcs(28, 70, 102), outer: arcs(26, 98, 138), infall };
  }, [variant, p]);
  // The line through the shadow along the disc: what's above it is the far side (behind), below the near side.
  const t = Math.tan((TILT * Math.PI) / 180);
  const back = `0,0 ${W},0 ${W},${CY + t * (W - CX)} 0,${CY - t * CX}`;
  const front = `0,${CY - t * CX} ${W},${CY + t * (W - CX)} ${W},${H} 0,${H}`;
  const disc = (
    <g transform={`translate(${CX} ${CY}) rotate(${TILT}) scale(1 0.21)`}>
      <circle r={94} fill="none" stroke={`url(#${id}d)`} strokeWidth={88} />
      {(['inner', 'mid', 'outer'] as const).map((ring, k) => (
        <g key={ring} className={`wa-bh-spin wa-bh-spin-${k + 1}`}>
          {art[ring].map((a, i) => (
            <path key={i} d={a.d} fill="none" stroke={a.c} strokeWidth={a.w} strokeOpacity={a.o} strokeLinecap="round" />
          ))}
        </g>
      ))}
    </g>
  );
  return (
    <Svg>
      <defs>
        <radialGradient id={`${id}d`} gradientUnits="userSpaceOnUse" cx="0" cy="0" r="138">
          <stop offset="0.36" stopColor={p.hot} />
          <stop offset="0.5" stopColor={p.mid} stopOpacity="0.9" />
          <stop offset="0.75" stopColor={p.deep} stopOpacity="0.5" />
          <stop offset="1" stopColor={p.rim} stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`${id}lens`} gradientUnits="userSpaceOnUse" x1="0" y1={CY - 64} x2="0" y2={CY + 40}>
          <stop offset="0" stopColor={p.hot} />
          <stop offset="0.35" stopColor={p.mid} />
          <stop offset="0.75" stopColor={p.deep} stopOpacity="0.6" />
          <stop offset="1" stopColor={p.deep} stopOpacity="0" />
        </linearGradient>
        <radialGradient id={`${id}shade`} gradientUnits="userSpaceOnUse" cx={CX} cy={CY} r="78">
          <stop offset="0.55" stopColor="#000" />
          <stop offset="1" stopColor="#000" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`${id}halo`} gradientUnits="userSpaceOnUse" cx={CX} cy={CY} r="150">
          <stop offset="0.3" stopColor={p.glow} stopOpacity="0.45" />
          <stop offset="1" stopColor={p.glow} stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`${id}jet`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={p.jet} stopOpacity="0" />
          <stop offset="1" stopColor={p.jet} stopOpacity="0.8" />
        </linearGradient>
        {/* Brighter on the side turning toward us. */}
        <linearGradient id={`${id}dop`} gradientUnits="userSpaceOnUse" x1="40" y1="0" x2="260" y2="0">
          <stop offset="0" stopColor="#fff" />
          <stop offset="1" stopColor="#fff" stopOpacity="0.38" />
        </linearGradient>
        <mask id={`${id}m`} maskUnits="userSpaceOnUse" x="0" y="0" width={W} height={H}>
          <rect width={W} height={H} fill={`url(#${id}dop)`} />
        </mask>
        <clipPath id={`${id}b`}>
          <polygon points={back} />
        </clipPath>
        <clipPath id={`${id}f`}>
          <polygon points={front} />
        </clipPath>
        <filter id={`${id}soft`} x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="1.6" />
        </filter>
        <filter id={`${id}glow`} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="2.5" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter id={`${id}neb`} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="22" />
        </filter>
      </defs>
      {/* Far behind: nebulae drifting, and the stars, turning slowly around the hole. */}
      <g filter={`url(#${id}neb)`} opacity={0.55}>
        <ellipse className="wa-drift" cx={60} cy={70} rx={90} ry={60} fill={p.neb[0]} />
        <ellipse className="wa-drift wa-drift-b" cx={250} cy={300} rx={100} ry={70} fill={p.neb[1]} />
        <ellipse className="wa-drift" cx={230} cy={60} rx={60} ry={45} fill={p.neb[2]} style={{ animationDelay: '-7s' }} />
      </g>
      <g className="wa-bh-sky">
        {art.stars.map((s, i) => (
          <circle key={i} cx={s.x} cy={s.y} r={s.r} fill="#fff" opacity={s.o} className={s.tw ? 'wa-twinkle' : undefined} style={s.tw ? { animationDelay: `${-s.d}s` } : undefined} />
        ))}
      </g>
      {/* The Event Horizon: space rippling in toward it. */}
      {variant === 'violet' &&
        [0, 1, 2].map((k) => <circle key={k} className="wa-bh-ripple" cx={CX} cy={BY} r={170} fill="none" stroke={p.mid} strokeWidth={1.2} style={{ animationDelay: `${-k * 1.2}s` }} />)}
      <g transform={`translate(${CX} ${BY}) scale(${BS}) translate(${-CX} ${-CY})`}>
      <circle className="wa-pulse" cx={CX} cy={CY} r={150} fill={`url(#${id}halo)`} />
      {/* Stars falling in. */}
      {art.infall.map((s, i) => (
        <circle
          key={i}
          className="wa-bh-infall"
          cx={s.x}
          cy={s.y}
          r={1.4}
          fill={p.hot}
          filter={`url(#${id}glow)`}
          style={{ ['--dx' as string]: `${s.dx}px`, ['--dy' as string]: `${s.dy}px`, animationDelay: `${s.d}s`, animationDuration: `${s.t}s` }}
        />
      ))}
      {/* Jets out of the poles. */}
      <g className="wa-bh-jet" filter={`url(#${id}soft)`}>
        <rect x={CX - 1.5} y={CY - 150} width={3} height={110} fill={`url(#${id}jet)`} transform={`rotate(${TILT} ${CX} ${CY})`} />
        <rect x={CX - 1.5} y={CY + 40} width={3} height={110} fill={`url(#${id}jet)`} transform={`rotate(${TILT + 180} ${CX} ${CY})`} />
      </g>
      <g mask={`url(#${id}m)`}>
        {/* The disc's far side, behind the shadow… */}
        <g clipPath={`url(#${id}b)`} filter={`url(#${id}soft)`}>
          {disc}
        </g>
        {/* …bent up over it by the hole's pull: a ring of light streaming around the shadow. */}
        <circle cx={CX} cy={CY} r={78} fill={`url(#${id}shade)`} />
        <g filter={`url(#${id}soft)`}>
          <circle cx={CX} cy={CY} r={58} fill="none" stroke={`url(#${id}lens)`} strokeWidth={14} />
          <circle className="wa-bh-flow" cx={CX} cy={CY} r={59} fill="none" stroke={p.hot} strokeOpacity={0.55} strokeWidth={5} strokeLinecap="round" strokeDasharray="30 12 8 20 46 10 16" />
        </g>
        <circle cx={CX} cy={CY} r={51} fill="none" stroke={p.mid} strokeWidth={3} strokeOpacity={0.55} filter={`url(#${id}soft)`} />
        <circle className="wa-bh-flow-fast" cx={CX} cy={CY} r={51} fill="none" stroke={p.hot} strokeWidth={1.6} strokeOpacity={0.9} strokeLinecap="round" strokeDasharray="14 6 4 10 18" filter={`url(#${id}glow)`} />
        {/* The shadow, and the thin ring of light at its edge. */}
        <circle cx={CX} cy={CY} r={43} fill="#000" />
        <circle className="wa-pulse" cx={CX} cy={CY} r={44} fill="none" stroke={p.hot} strokeWidth={1.3} filter={`url(#${id}glow)`} />
        {/* The near side, in front of it. */}
        <g clipPath={`url(#${id}f)`} filter={`url(#${id}soft)`}>
          {disc}
        </g>
        <g clipPath={`url(#${id}f)`} opacity={0.7}>
          {disc}
        </g>
      </g>
      </g>
    </Svg>
  );
}

// ---------------------------------------------------------------------------------------------- Big Bang

/** The Big Bang (Ascended): a point of white light, the plasma of a young universe turning around it, rings of light rushing out, sparks streaming away. */
export function BigBangWrap() {
  const id = useUid();
  const art = useMemo(() => {
    const rnd = seeded(41);
    const sparks = Array.from({ length: 34 }, () => {
      const a = rnd() * Math.PI * 2;
      const dist = 90 + rnd() * 170;
      return { dx: Math.cos(a) * dist, dy: Math.sin(a) * dist, d: -rnd() * 4, t: 2.4 + rnd() * 2.4, r: 0.6 + rnd() * 1.4, c: ['#fff', '#fde68a', '#f0abfc', '#a5f3fc', '#fca5a5'][Math.floor(rnd() * 5)] };
    });
    return { sparks };
  }, []);
  const blobs = [
    { c: '#f472b6', r: 85, x: -40, y: -30, t: 14 },
    { c: '#60a5fa', r: 95, x: 45, y: 35, t: 18 },
    { c: '#facc15', r: 60, x: 20, y: -55, t: 11 },
    { c: '#a78bfa', r: 90, x: -30, y: 60, t: 22 },
    { c: '#34d399', r: 55, x: 55, y: -20, t: 16 },
  ];
  return (
    <Svg>
      <defs>
        <filter id={`${id}p`} x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="20" />
        </filter>
        <filter id={`${id}g`} x="-200%" y="-200%" width="500%" height="500%">
          <feGaussianBlur stdDeviation="5" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <linearGradient id={`${id}f`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#fff" stopOpacity="0" />
          <stop offset="0.5" stopColor="#fff" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
      </defs>
      <g filter={`url(#${id}p)`} opacity={0.6}>
        {blobs.map((b, i) => (
          <circle key={i} className="wa-bb-orbit" cx={CX + b.x} cy={CY + b.y} r={b.r} fill={b.c} style={{ animationDuration: `${b.t}s`, animationDirection: i % 2 ? 'reverse' : 'normal' }} />
        ))}
      </g>
      {[0, 1, 2].map((k) => (
        <circle key={k} className="wa-bb-ring" cx={CX} cy={CY} r={18} fill="none" stroke="#fff" strokeWidth={1.4} vectorEffect="non-scaling-stroke" style={{ animationDelay: `${-k * 1.4}s` }} />
      ))}
      {art.sparks.map((s, i) => (
        <circle
          key={i}
          className="wa-bb-spark"
          cx={CX}
          cy={CY}
          r={s.r}
          fill={s.c}
          style={{ ['--dx' as string]: `${s.dx}px`, ['--dy' as string]: `${s.dy}px`, animationDelay: `${s.d}s`, animationDuration: `${s.t}s` }}
        />
      ))}
      <g className="wa-bb-core">
        <ellipse cx={CX} cy={CY} rx={110} ry={1.6} fill={`url(#${id}f)`} opacity={0.85} />
        <ellipse cx={CX} cy={CY} rx={1.2} ry={46} fill="#fff" opacity={0.5} />
        <circle cx={CX} cy={CY} r={7} fill="#fff" filter={`url(#${id}g)`} />
      </g>
    </Svg>
  );
}

// ---------------------------------------------------------------------------------------------- Crystal

/** A crystal's facets, each turned its own way to the light: [angle of the light across it, lit side, far side]. */
const CRYSTAL_FACES: [number, string, string][] = [
  [20, '#ffffff', '#c7d2fe'],
  [200, '#f0f9ff', '#93c5fd'],
  [70, '#e0e7ff', '#475569'],
  [140, '#bae6fd', '#1e293b'],
  [300, '#ffffff', '#a5b4fc'],
  [100, '#cbd5e1', '#0f172a'],
  [250, '#f5f3ff', '#c4b5fd'],
  [330, '#e0f2fe', '#334155'],
];

/** Crystal: cut glass, clear and icy, each facet catching the light its own way, light running across them, sparkles at their corners, rainbows breaking through. */
export function CrystalWrap() {
  const id = useUid();
  const art = useMemo(() => {
    const rnd = seeded(23);
    const cols = 6;
    const rows = 8;
    const p: [number, number][][] = [];
    for (let r = 0; r <= rows; r++) {
      p.push([]);
      for (let c = 0; c <= cols; c++) {
        const edge = r === 0 || r === rows || c === 0 || c === cols;
        p[r].push([(c * W) / cols + (edge ? 0 : (rnd() - 0.5) * 34), (r * H) / rows + (edge ? 0 : (rnd() - 0.5) * 34)]);
      }
    }
    // Each facet of cut glass turned its own way to the light: clear and pale, bright white, or deep in shadow, its
    // light falling across it (CRYSTAL_FACES), some edges splitting the light into a rainbow.
    const tris: { pts: string; face: number; delay: number; rainbow: string | null }[] = [];
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++) {
        const a = p[r][c];
        const b = p[r][c + 1];
        const d = p[r + 1][c];
        const e = p[r + 1][c + 1];
        const halves = (r + c) % 2 ? [[a, b, e], [a, e, d]] : [[a, b, d], [b, e, d]];
        for (const t of halves) {
          const cx = (t[0][0] + t[1][0] + t[2][0]) / 3;
          const cy = (t[0][1] + t[1][1] + t[2][1]) / 3;
          const edge = rnd() < 0.3 ? `M${t[0][0].toFixed(1)} ${t[0][1].toFixed(1)}L${t[1][0].toFixed(1)} ${t[1][1].toFixed(1)}` : null;
          tris.push({ pts: t.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' '), face: Math.floor(rnd() * CRYSTAL_FACES.length), delay: (cx / W) * 1.1 + (cy / H) * 0.9, rainbow: edge });
        }
      }
    const sparks = Array.from({ length: 10 }, () => {
      const r = 1 + Math.floor(rnd() * (rows - 1));
      const c = 1 + Math.floor(rnd() * (cols - 1));
      return { x: p[r][c][0], y: p[r][c][1], d: -rnd() * 3, s: 0.7 + rnd() * 0.8 };
    });
    return { tris, sparks };
  }, []);
  return (
    <Svg>
      <defs>
        <linearGradient id={`${id}rb`} x1="0" y1="0" x2="1" y2="0">
          {['#f472b6', '#facc15', '#4ade80', '#38bdf8', '#a78bfa'].map((c, i) => (
            <stop key={c} offset={i / 4} stopColor={c} />
          ))}
        </linearGradient>
        {CRYSTAL_FACES.map(([a, from, to], i) => (
          <linearGradient key={i} id={`${id}f${i}`} gradientTransform={`rotate(${a} 0.5 0.5)`}>
            <stop offset="0" stopColor={from} />
            <stop offset="1" stopColor={to} />
          </linearGradient>
        ))}
      </defs>
      {art.tris.map((t, i) => (
        <polygon key={i} points={t.pts} fill={`url(#${id}f${t.face})`} fillOpacity={0.9} stroke="#fff" strokeOpacity={0.8} strokeWidth={0.7} strokeLinejoin="round" />
      ))}
      {/* The light split into colours along some edges, as a cut crystal does. */}
      <g style={{ mixBlendMode: 'screen' }} opacity={0.75}>
        {art.tris.map((t, i) => (t.rainbow ? <path key={`r${i}`} d={t.rainbow} stroke={`url(#${id}rb)`} strokeWidth={1.6} strokeLinecap="round" /> : null))}
      </g>
      {art.tris.map((t, i) => (
        <polygon key={`g${i}`} className="wa-glint" points={t.pts} fill="#fff" style={{ animationDelay: `${t.delay}s` }} />
      ))}
      <g className="wa-crystal-beams" opacity={0.55} style={{ mixBlendMode: 'screen' }}>
        <rect x={-100} y={110} width={500} height={7} fill={`url(#${id}rb)`} transform="rotate(-32 150 200)" />
        <rect x={-100} y={250} width={500} height={4} fill={`url(#${id}rb)`} transform="rotate(-32 150 200)" />
      </g>
      {art.sparks.map((s, i) => (
        <path key={i} className="wa-spark" d="M0 -9L1.6 -1.6L9 0L1.6 1.6L0 9L-1.6 1.6L-9 0L-1.6 -1.6Z" fill="#fff" transform={`translate(${s.x} ${s.y}) scale(${s.s})`} style={{ animationDelay: `${s.d}s` }} />
      ))}
    </Svg>
  );
}

// ---------------------------------------------------------------------------------------------- Phoenix

/** Phoenix: a bird of flame beating its wings, its tail flickering, a sun behind it, embers rising all around. */
export function PhoenixWrap() {
  const id = useUid();
  const art = useMemo(() => {
    const rnd = seeded(31);
    // A wing raised high: its leading edge from the shoulder up to the tip, and the feathers hanging from it,
    // short near the body, long and sweeping at the tip.
    const shoulder: [number, number] = [156, 150];
    const tip: [number, number] = [276, 62];
    const wing = [leaf(shoulder, tip, 11, -8)];
    for (let k = 0; k < 9; k++) {
      const t = 0.12 + (k / 8) * 0.88;
      const base: [number, number] = [shoulder[0] + (tip[0] - shoulder[0]) * t, shoulder[1] + (tip[1] - shoulder[1]) * t];
      const a = (95 - t * 75) * (Math.PI / 180);
      const len = 34 + t * 78;
      wing.push(leaf(base, [base[0] + Math.cos(a) * len, base[1] + Math.sin(a) * len], 7 + t * 5, 7));
    }
    const tail = [80, 93, 106].map((deg, k) => {
      const a = deg * (Math.PI / 180);
      const len = 150 + (k === 1 ? 30 : 0);
      return leaf([150, 200], [150 + Math.cos(a) * len, 200 + Math.sin(a) * len], 15, k === 1 ? 0 : (k - 1) * 22);
    });
    const crest = [-120, -95, -70].map((deg) => {
      const a = deg * (Math.PI / 180);
      return leaf([150, 102], [150 + Math.cos(a) * 34, 102 + Math.sin(a) * 34], 5, 6);
    });
    const embers = Array.from({ length: 28 }, () => ({ x: rnd() * W, d: -rnd() * 5, t: 3 + rnd() * 3, r: 0.8 + rnd() * 1.8, dx: (rnd() - 0.5) * 50, c: rnd() < 0.5 ? '#fde047' : '#fb923c' }));
    return { wing, tail, crest, embers };
  }, []);
  return (
    <Svg>
      <defs>
        <radialGradient id={`${id}f`} gradientUnits="userSpaceOnUse" cx="152" cy="150" r="190">
          <stop offset="0" stopColor="#fffbeb" />
          <stop offset="0.2" stopColor="#fde047" />
          <stop offset="0.5" stopColor="#f97316" />
          <stop offset="0.85" stopColor="#dc2626" stopOpacity="0.7" />
          <stop offset="1" stopColor="#7f1d1d" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`${id}sun`} gradientUnits="userSpaceOnUse" cx="150" cy="150" r="110">
          <stop offset="0" stopColor="#fff7ed" stopOpacity="0.9" />
          <stop offset="0.4" stopColor="#fdba74" stopOpacity="0.45" />
          <stop offset="1" stopColor="#ea580c" stopOpacity="0" />
        </radialGradient>
        <filter id={`${id}g`} x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="3" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <circle className="wa-pulse" cx={150} cy={150} r={110} fill={`url(#${id}sun)`} />
      <g filter={`url(#${id}g)`} opacity={0.88}>
        {art.tail.map((d, k) => (
          <path key={k} className="wa-tail" d={d} fill={`url(#${id}f)`} style={{ animationDelay: `${-k * 0.45}s` }} />
        ))}
        <g className="wa-wing">
          {art.wing.map((d, k) => (
            <path key={k} d={d} fill={`url(#${id}f)`} />
          ))}
        </g>
        <g transform={`translate(${W} 0) scale(-1 1)`}>
          <g className="wa-wing">
            {art.wing.map((d, k) => (
              <path key={k} d={d} fill={`url(#${id}f)`} />
            ))}
          </g>
        </g>
        <path d="M150 96C163 108 165 150 157 196L150 214L143 196C135 150 137 108 150 96Z" fill={`url(#${id}f)`} />
        {art.crest.map((d, k) => (
          <path key={k} className="wa-tail" d={d} fill="#fde047" style={{ animationDelay: `${-k * 0.3}s` }} />
        ))}
        <path d="M150 99L144 108L150 106Z" fill="#fff7ed" />
      </g>
      {art.embers.map((e, i) => (
        <circle
          key={i}
          className="wa-ember"
          cx={e.x}
          cy={H + 5}
          r={e.r}
          fill={e.c}
          style={{ ['--dx' as string]: `${e.dx}px`, animationDelay: `${e.d}s`, animationDuration: `${e.t}s`, filter: `drop-shadow(0 0 3px ${e.c})` }}
        />
      ))}
    </Svg>
  );
}

// ---------------------------------------------------------------------------------------------- Gilded Deco

/** Gilded Deco: gold Art Deco fans rising from the bottom and hanging from the top, light running up the rays like a marquee, stepped corners, a gleam sweeping across. */
export function DecoWrap() {
  const id = useUid();
  const rays = useMemo(
    () =>
      Array.from({ length: 17 }, (_, k) => {
        const a = (195 + (k * 150) / 16) * (Math.PI / 180);
        const [x0, y0] = pt(150, 400, 48, a);
        const [x1, y1] = pt(150, 400, 250, a);
        return { k, d: `M${x0.toFixed(1)} ${y0.toFixed(1)}L${x1.toFixed(1)} ${y1.toFixed(1)}` };
      }),
    [],
  );
  const top = useMemo(
    () =>
      Array.from({ length: 11 }, (_, k) => {
        const a = (30 + (k * 120) / 10) * (Math.PI / 180);
        const [x0, y0] = pt(150, 0, 26, a);
        const [x1, y1] = pt(150, 0, 92, a);
        return `M${x0.toFixed(1)} ${y0.toFixed(1)}L${x1.toFixed(1)} ${y1.toFixed(1)}`;
      }),
    [],
  );
  const corner = 'M14 60V30L30 30V14H60';
  return (
    <Svg>
      <defs>
        <linearGradient id={`${id}g`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fef3c7" />
          <stop offset="0.35" stopColor="#d4a017" />
          <stop offset="0.65" stopColor="#fde68a" />
          <stop offset="1" stopColor="#92400e" />
        </linearGradient>
        <linearGradient id={`${id}s`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#fde68a" stopOpacity="0" />
          <stop offset="0.45" stopColor="#fde68a" stopOpacity="0.55" />
          <stop offset="0.5" stopColor="#fff" stopOpacity="0.8" />
          <stop offset="0.55" stopColor="#fde68a" stopOpacity="0.55" />
          <stop offset="1" stopColor="#fde68a" stopOpacity="0" />
        </linearGradient>
      </defs>
      {/* The fan rising from the bottom: its rays, and light running up them one after the other. */}
      {rays.map((r) => (
        <path key={r.k} d={r.d} stroke={`url(#${id}g)`} strokeWidth={1.3} strokeOpacity={0.6} />
      ))}
      {rays.map((r) => (
        <path key={`l${r.k}`} className="wa-deco-run" d={r.d} pathLength={100} stroke="#fff7d6" strokeWidth={2.2} strokeLinecap="round" style={{ animationDelay: `${-Math.abs(r.k - 8) * 0.12}s`, filter: 'drop-shadow(0 0 2px #fde68a)' }} />
      ))}
      {[48, 78, 108, 250].map((r) => (
        <path key={r} d={`M${150 - r} 400A${r} ${r} 0 0 1 ${150 + r} 400`} fill="none" stroke={`url(#${id}g)`} strokeWidth={r === 250 ? 1 : 1.6} strokeOpacity={0.85} />
      ))}
      <path d="M150 352L162 376L150 400L138 376Z" fill={`url(#${id}g)`} />
      {/* The small fan hanging from the top. */}
      {top.map((d, k) => (
        <path key={k} d={d} stroke={`url(#${id}g)`} strokeWidth={1.1} strokeOpacity={0.55} />
      ))}
      <path d="M124 0A26 26 0 0 0 176 0" fill="none" stroke={`url(#${id}g)`} strokeWidth={1.6} />
      <path d="M58 0A92 92 0 0 0 242 0" fill="none" stroke={`url(#${id}g)`} strokeWidth={1} strokeOpacity={0.7} />
      {/* Stepped corners, a diamond twinkling in each. */}
      {[
        [0, 0, 1, 1],
        [W, 0, -1, 1],
        [0, H, 1, -1],
        [W, H, -1, -1],
      ].map(([x, y, sx, sy], k) => (
        <g key={k} transform={`translate(${x} ${y}) scale(${sx} ${sy})`}>
          <path d={corner} fill="none" stroke={`url(#${id}g)`} strokeWidth={2} />
          <path d="M22 66V38H38V22H66" fill="none" stroke="#d4a017" strokeWidth={0.8} strokeOpacity={0.8} />
          <path className="wa-spark" d="M0 -5L2 0L0 5L-2 0Z" fill="#fff7d6" transform="translate(30 30)" style={{ animationDelay: `${-k * 0.7}s` }} />
        </g>
      ))}
      <rect className="wa-deco-sweep" x={-W} y={0} width={W} height={H} fill={`url(#${id}s)`} />
    </Svg>
  );
}

/** The wrappers drawn here. */
export const DRAWN = new Set(['wrap:dragon', 'wrap:blackhole', 'wrap:eventhorizon', 'wrap:bigbang', 'wrap:crystal', 'wrap:phoenix', 'wrap:deco']);

/** The drawn wrapper for a wrapper id, if it has one. */
export function WrapArt({ id }: { id: string }) {
  switch (id) {
    case 'wrap:dragon':
      return <DragonWrap />;
    case 'wrap:blackhole':
      return <BlackHoleWrap />;
    case 'wrap:eventhorizon':
      return <BlackHoleWrap variant="violet" />;
    case 'wrap:bigbang':
      return <BigBangWrap />;
    case 'wrap:crystal':
      return <CrystalWrap />;
    case 'wrap:phoenix':
      return <PhoenixWrap />;
    case 'wrap:deco':
      return <DecoWrap />;
    default:
      return null;
  }
}
