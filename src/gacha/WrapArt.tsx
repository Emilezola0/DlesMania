import { useEffect, useId, useMemo, useRef, type PointerEvent } from 'react';
import { sfx } from '../lib/sfx';

/**
 * The drawn pack wrappers (the Boutique's Prestige and Ascended collections), each an SVG over the pack, the size
 * of the pack (300 × 400): Dragon Scale (scales rippling like a dragon on the move; one flips, gold side up, under
 * the pointer), Black Hole (a disc of fire turning, lensed over its shadow, stars falling in), Event Horizon (its
 * Ascended cousin, violet and cyan, space rippling into it), Big Bang (a point of light about to become everything),
 * Crystal (cut facets, light running across them; touched, it rings and a star flashes), Phoenix (a bird of living
 * fire, reborn every so often) and
 * Gilded Deco (gold Art Deco fans, light running up the rays), Clockwork (brass gears meshing, a clock ticking) and
 * Chronos (its Ascended cousin: an astrolabe turning, hands racing, an hourglass turning over). Their animations are in src/index.css (.wa-*);
 * still under reduced motion. Dragon Scale and Phoenix are canvases, their animations drawn there (a dozen of them
 * as SVGs made the Boutique lag). The Thunderstorm has its own (src/gacha/StormWrap.tsx).
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

/** A wrapper's drawing over the pack. With `onPointerDown`, it answers the pointer (the click still goes on to the pack). */
function Svg({ children, onPointerDown }: { children: React.ReactNode; onPointerDown?: (e: PointerEvent<SVGSVGElement>) => void }) {
  return (
    <svg className={`${onPointerDown ? '' : 'pointer-events-none '}absolute inset-0 size-full`} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid slice" aria-hidden onPointerDown={onPointerDown}>
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
/** Two rows of scales: what the body slides by before the rows start again (DRAGON.loop). */
const DRAGON_LOOP = 38;
const ROW_Y0 = -52;
const ROW_STEP = 19;

/** The dragon's body: a little over half the pack wide, the same all the way down. */
const BODY_HALF = 98;
/** Where the scales of a row hang (even rows, odd rows set half a scale over). */
const rowXs = (odd: number) => {
  const xs: number[] = [];
  for (let x = W / 2 - 168 + (odd ? 14 : 0); x <= W / 2 + 168; x += 28) if (Math.abs(x - W / 2) <= BODY_HALF - 4) xs.push(x);
  return xs;
};
const ROW_XS = [rowXs(0), rowXs(1)];
const ROWS = 25;
/** A row's picture, around its scales' top (0): from 6 above to 40 below (their shadow on the row under). */
const ROW_TOP = -6;
const ROW_H = 46;
/** One scale as SVG markup: the plate, its lit and shaded faces, its keel. */
const scaleMarkup = `<path d="${SCALE}" fill="url(#dr)" stroke="url(#dg)" stroke-width="1.1"/>` +
  `<path d="${SCALE_LIT}" fill="#fff" opacity="0.13"/><path d="${SCALE_SHADE}" opacity="0.28"/>` +
  `<path d="M0 2L0 30" stroke="#fecaca" stroke-opacity="0.55" stroke-linecap="round"/>`;
const DRAGON_DEFS =
  `<radialGradient id="dr" cx="0.5" cy="0.75" r="0.8"><stop offset="0" stop-color="#f87171"/><stop offset="0.3" stop-color="#b91c1c"/><stop offset="0.7" stop-color="#5f0a0a"/><stop offset="1" stop-color="#1c0303"/></radialGradient>` +
  `<radialGradient id="du" cx="0.4" cy="0.25" r="0.9"><stop offset="0" stop-color="#fffbeb"/><stop offset="0.35" stop-color="#fbbf24"/><stop offset="1" stop-color="#78350f"/></radialGradient>` +
  `<linearGradient id="dg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fef3c7"/><stop offset="0.5" stop-color="#d97706"/><stop offset="1" stop-color="#713f12"/></linearGradient>` +
  `<linearGradient id="db" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-opacity="0.75"/><stop offset="0.3" stop-opacity="0.1"/><stop offset="0.5" stop-color="#fde68a" stop-opacity="0.12"/><stop offset="0.7" stop-opacity="0.1"/><stop offset="1" stop-opacity="0.75"/></linearGradient>` +
  `<radialGradient id="dl"><stop offset="0" stop-color="#fb923c" stop-opacity="0.85"/><stop offset="0.35" stop-color="#ef4444" stop-opacity="0.55"/><stop offset="1" stop-color="#7f1d1d" stop-opacity="0"/></radialGradient>`;

/** A sprite: SVG markup (in a box x, y, w, h) drawn once onto a canvas, at 3× for sharp screens. */
type Sprite = { img: HTMLCanvasElement; x: number; y: number; w: number; h: number };
async function sprite(x: number, y: number, w: number, h: number, markup: string): Promise<Sprite> {
  const k = 3;
  const img = new Image();
  img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w * k}" height="${h * k}" viewBox="${x} ${y} ${w} ${h}"><defs>${DRAGON_DEFS}</defs>${markup}</svg>`,
  )}`;
  await img.decode();
  const canvas = document.createElement('canvas');
  canvas.width = w * k;
  canvas.height = h * k;
  canvas.getContext('2d')?.drawImage(img, 0, 0);
  return { img: canvas, x, y, w, h };
}

/**
 * Everything the dragon is made of, each drawn once for every Dragon Scale on the page: the two kinds of row (even,
 * odd), a spine, a scale and its gold underside (for the flip), the fire's light. The dragon itself is a canvas that
 * lays these down, 30 times a second: as an SVG, its thousand shapes redrawn at every move, a dozen dragons made the
 * Boutique lag.
 */
type DragonSprites = { rows: Sprite[]; spine: Sprite; scale: Sprite; gold: Sprite; light: Sprite };
let dragonSprites: Promise<DragonSprites> | null = null;
function drawDragonSprites() {
  dragonSprites ??= (async () => ({
    rows: await Promise.all(
      [0, 1].map((odd) =>
        sprite(
          0,
          ROW_TOP,
          W,
          ROW_H,
          `<rect x="${W / 2 - BODY_HALF - 3}" y="-4" width="${2 * BODY_HALF + 6}" height="30" rx="14" fill="#2a0404"/>` +
            ROW_XS[odd].map((x) => `<path d="${SCALE}" transform="translate(${x} 4)" opacity="0.55"/><g transform="translate(${x} 0)">${scaleMarkup}</g>`).join('') +
            `<rect x="${W / 2 - BODY_HALF - 4}" y="-2" width="${2 * BODY_HALF + 8}" height="21" fill="url(#db)"/>`,
        ),
      ),
    ),
    spine: await sprite(-8, -9, 16, 32, `<path d="M-7 22L0-8L7 22Z" fill="url(#dg)" stroke="#451a03" stroke-width="0.8"/>`),
    scale: await sprite(-15, -1, 30, 35, scaleMarkup),
    gold: await sprite(-15, -1, 30, 35, `<path d="${SCALE}" fill="url(#du)" stroke="#fef3c7" stroke-width="1.3"/>`),
    light: await sprite(-50, -18, 100, 80, `<ellipse cx="0" cy="22" rx="50" ry="40" fill="url(#dl)"/>`),
  }))();
  return dragonSprites;
}

/** How far the fire travels with the body before coming round again (a whole number of loops of rows). */
const FIRE_TRAVEL = DRAGON_LOOP * 15;
/**
 * The fire inside it, now and then, here and there: no flames drawn (the owner's call), only its light through the
 * scales, red, as through a hand held up to a lamp, and a few sparks. Each fire travels with its scale, all the way down.
 */
const DRAGON_FIRES = (() => {
  const rnd = seeded(41);
  return Array.from({ length: 9 }, (_, i) => {
    const odd = rnd() < 0.5 ? 1 : 0;
    const cols = Array.from({ length: 13 }, (_, j) => W / 2 - 168 + odd * 14 + 28 * j).filter((x) => Math.abs(x - W / 2) <= 70);
    return {
      y: ROW_Y0 - 38 + odd * ROW_STEP,
      x: cols[Math.floor(rnd() * cols.length)],
      off: DRAGON_LOOP * Math.floor((i / 9) * 15 + rnd() * 1.4),
      dur: 4 + rnd() * 6,
      delay: -rnd() * 10,
      sparks: Array.from({ length: 3 }, () => ({ dx: (rnd() - 0.5) * 30, dy: 10 + rnd() * 30, d: rnd() * 0.6 })),
    };
  });
})();

/** A value along keyframes ([at, value], at from 0 to 1), eased in and out between them. */
function along(keys: [number, number][], t: number) {
  for (let i = 1; i < keys.length; i++) {
    const [a, va] = keys[i - 1];
    const [b, vb] = keys[i];
    if (t <= b) {
      const u = b > a ? (t - a) / (b - a) : 1;
      return va + (vb - va) * (u * u * (3 - 2 * u));
    }
  }
  return keys[keys.length - 1][1];
}
/** The fire's light flickering up, and its sparks flying out, along its own beat. */
const LIGHT_KEYS: [number, number][] = [[0, 0], [0.5, 0], [0.58, 0.9], [0.63, 0.65], [0.68, 1], [0.74, 0.7], [0.8, 0.9], [0.94, 0], [1, 0]];
const SPARK_ALPHA: [number, number][] = [[0, 0], [0.6, 0], [0.63, 1], [0.8, 0.8], [0.86, 0], [1, 0]];
const SPARK_GO: [number, number][] = [[0, 0], [0.6, 0], [0.86, 1], [1, 1]];
/** A scale flipping over (1.4 s): squeezed edge-on, its gold side up and glowing a while, then back. */
const FLIP_TIME = 1400;
const FLIP_SX: [number, number][] = [[0, 1], [0.22, 0.05], [0.4, 1.12], [0.7, 1.12], [0.86, 0.05], [1, 1]];
const FLIP_SY: [number, number][] = [[0, 1], [0.22, 1.18], [0.4, 1.12], [0.7, 1.12], [0.86, 1.12], [1, 1]];
const FLIP_UP: [number, number][] = [[0, 0], [0.22, -3], [0.7, -3], [0.86, 0], [1, 0]];
const FLIP_GLOW: [number, number][] = [[0, 0], [0.22, 0], [0.4, 1], [0.7, 1], [0.86, 0], [1, 0]];

/**
 * How the dragon slithers: its body lies along a long, soft S and glides down it, its scales going by like a snake's.
 * It moves as a snake does: it stops, sets off again, slow or fast, for a moment or for long, easing from one pace
 * to the next; the S sways only as it moves. Each row sits where the S passes its height; the rows move down two
 * rows' height, then start again two rows higher, where the same scales were.
 */
const DRAGON = { amp: 40, wave: 560, loop: DRAGON_LOOP, swayPerPx: 1 / 90 };
const dragonX = (y: number, phase: number) =>
  DRAGON.amp * Math.sin((2 * Math.PI * y) / DRAGON.wave + phase) + DRAGON.amp * 0.18 * Math.sin((4 * Math.PI * y) / DRAGON.wave - phase * 0.7);

/** At most 30 frames a second: a snake's glide looks just as smooth, for half the work. */
const DRAGON_STEP = 1000 / 30;

export function DragonWrap() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    let art: DragonSprites | null = null;
    const still = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    let went = Math.random() * 2000; // how far it has gone (px): each pack's dragon somewhere else along its way
    // The pack's size, and how the 300 × 400 drawing covers it (as an SVG's "slice" would).
    let k = 1;
    let ox = 0;
    let oy = 0;
    const fit = () => {
      const dpr = window.devicePixelRatio || 1;
      const cw = canvas.clientWidth;
      const ch = canvas.clientHeight;
      canvas.width = Math.max(1, Math.round(cw * dpr));
      canvas.height = Math.max(1, Math.round(ch * dpr));
      const s = Math.max(cw / W, ch / H);
      k = s * dpr;
      ox = ((cw - W * s) / 2) * dpr;
      oy = ((ch - H * s) / 2) * dpr;
    };
    fit();
    const sized = new ResizeObserver(() => {
      fit();
      draw(performance.now());
    });
    sized.observe(canvas);
    // The scales flipping under the pointer: row and column, and when they started.
    const flips = new Map<string, { r: number; x: number; at: number }>();
    const put = (s: Sprite, x: number, y: number) => ctx.drawImage(s.img, x + s.x, y + s.y, s.w, s.h);
    const draw = (now: number) => {
      if (!art) return;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.setTransform(k, 0, 0, k, ox, oy);
      const s = went % DRAGON.loop;
      const phase = went * DRAGON.swayPerPx;
      // The rows, the lower ones first: each row hangs over the one below, like tiles. Then the flipping scales of
      // that row, over it.
      for (let r = ROWS - 1; r >= 0; r--) {
        const y = ROW_Y0 + r * ROW_STEP;
        const tx = dragonX(y + s, phase);
        put(art.rows[r % 2], tx, y + s);
        for (const [key, f] of flips) {
          if (f.r !== r) continue;
          const t = (now - f.at) / FLIP_TIME;
          if (t >= 1) {
            flips.delete(key);
            continue;
          }
          ctx.save();
          ctx.translate(f.x + tx, y + s + 13.2 + along(FLIP_UP, t));
          ctx.scale(along(FLIP_SX, t), along(FLIP_SY, t));
          const glow = along(FLIP_GLOW, t);
          if (glow > 0) {
            ctx.shadowColor = `rgba(253, 224, 71, ${glow})`;
            ctx.shadowBlur = 4 * k;
          }
          put(t >= 0.22 && t < 0.86 ? art.gold : art.scale, 0, -13.2);
          ctx.restore();
        }
      }
      // The spines down its back, gold, swinging with the body.
      for (let r = 0; r < ROWS; r += 2) {
        const y = ROW_Y0 + r * ROW_STEP;
        put(art.spine, W / 2 + dragonX(y + s, phase), y + s);
      }
      // The fire's light through the scales, and its sparks.
      const sec = now / 1000;
      for (const f of still ? [] : DRAGON_FIRES) {
        const y = f.y + ((went + f.off) % FIRE_TRAVEL);
        const x = f.x + dragonX(y, phase);
        const beat = (((sec - f.delay) / f.dur) % 1 + 1) % 1;
        const a = along(LIGHT_KEYS, beat);
        if (a > 0.01) {
          ctx.globalAlpha = a;
          ctx.globalCompositeOperation = 'screen';
          put(art.light, x, y);
          ctx.globalCompositeOperation = 'source-over';
        }
        for (const p of f.sparks) {
          const b = (((sec - f.delay - p.d) / f.dur) % 1 + 1) % 1;
          const pa = along(SPARK_ALPHA, b);
          if (pa <= 0.01) continue;
          const go = 1 - (1 - along(SPARK_GO, b)) ** 2;
          ctx.globalAlpha = pa;
          ctx.fillStyle = '#fde68a';
          ctx.beginPath();
          ctx.arc(x + p.dx * go, y + 34 + p.dy * go, 1.3, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
      }
    };
    // Flips the scale under the pointer (gold side up), then back: a trail of flipping scales where the pointer goes.
    // The top row first: each row hangs over the one below.
    const point = (e: globalThis.PointerEvent) => {
      const box = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      const px = ((e.clientX - box.left) * dpr - ox) / k;
      const py = ((e.clientY - box.top) * dpr - oy) / k;
      const s = went % DRAGON.loop;
      const phase = went * DRAGON.swayPerPx;
      for (let r = 0; r < ROWS; r++) {
        const y = ROW_Y0 + r * ROW_STEP;
        const dy = py - (y + s);
        if (dy < 0 || dy > 32) continue;
        const reach = dy < 11 ? 14 : (14 * (33 - dy)) / 22;
        const lx = px - dragonX(y + s, phase);
        const x = ROW_XS[r % 2].find((sx) => Math.abs(lx - sx) <= reach);
        if (x === undefined) continue;
        const key = `${r}:${x}`;
        if (!flips.has(key)) flips.set(key, { r, x, at: performance.now() });
        return;
      }
    };
    canvas.addEventListener('pointermove', point);
    // Its pace: a new one every so often (a stop now and then), for a moment or for a while.
    let speed = 0;
    let target = 0;
    let until = 0;
    let frame = 0;
    let last = performance.now();
    const tick = (now: number) => {
      frame = requestAnimationFrame(tick);
      if (now - last < DRAGON_STEP - 2) return;
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      if (!still) {
        if (now >= until) {
          // A stop only now and then, and short (the owner found it stopped too often).
          target = Math.random() < 0.1 ? 0 : 10 + Math.random() ** 1.6 * 66;
          until = now + (target === 0 ? 300 + Math.random() * 900 : 1200 + Math.random() * 4800);
        }
        speed += (target - speed) * (1 - Math.exp(-dt * 1.8));
        went += speed * dt;
      }
      draw(now);
    };
    let on = true;
    drawDragonSprites().then(
      (a) => {
        if (!on) return;
        art = a;
        draw(performance.now());
        // Under reduced motion it lies still (only a scale flipping under the pointer moves).
        frame = requestAnimationFrame(tick);
      },
      () => undefined,
    );
    return () => {
      on = false;
      cancelAnimationFrame(frame);
      sized.disconnect();
      canvas.removeEventListener('pointermove', point);
    };
  }, []);
  // The dragon's body, winding down the pack. Nothing else: no background, the pack is see-through around it (index.css).
  return <canvas ref={ref} className="absolute inset-0 size-full" aria-hidden />;
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

/**
 * How a crystal's facets catch the light, each turned its own way: [angle of the light across it, how bright its lit
 * side, how deep its shadow]. Laid over each facet's own colour, so the colours stay and the glass looks cut.
 */
const CRYSTAL_FACES: [number, number, number][] = [
  [20, 0.7, 0.15],
  [200, 0.5, 0.3],
  [70, 0.35, 0.55],
  [140, 0.25, 0.65],
  [300, 0.75, 0.1],
  [100, 0.2, 0.7],
  [250, 0.6, 0.2],
  [330, 0.4, 0.5],
];

/**
 * Touching the crystal: it rings (a glass ting), shivers, and a star of light flashes where it was touched, a ring
 * of light spreading from it, glints of every colour flying off.
 */
function tapCrystal(e: PointerEvent<SVGSVGElement>) {
  const svg = e.currentTarget;
  const m = svg.getScreenCTM();
  if (!m) return;
  const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse());
  const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  g.setAttribute('transform', `translate(${p.x.toFixed(1)} ${p.y.toFixed(1)})`);
  g.setAttribute('pointer-events', 'none');
  const star = 'M0 -30L3.2 -3.2L30 0L3.2 3.2L0 30L-3.2 3.2L-30 0L-3.2 -3.2Z';
  const glints = Array.from({ length: 8 }, (_, i) => {
    const a = (i / 8) * Math.PI * 2 + Math.random() * 0.5;
    const r = 26 + Math.random() * 22;
    return `<circle class="wa-cry-glint" r="${(1.2 + Math.random() * 1.2).toFixed(1)}" fill="hsl(${[190, 300, 260, 50, 140, 330, 210][i % 7]} 90% 80%)" style="--gx:${(Math.cos(a) * r).toFixed(1)}px;--gy:${(Math.sin(a) * r).toFixed(1)}px"/>`;
  }).join('');
  g.innerHTML =
    `<circle class="wa-cry-ring" r="12" fill="none" stroke="#a5f3fc" stroke-width="1.6"/>` +
    `<g class="wa-cry-star"><path d="${star}" fill="#fff" stroke="#a78bfa" stroke-width="0.8"/><path d="${star}" fill="#cffafe" stroke="#67e8f9" stroke-width="0.8" transform="rotate(45) scale(0.5)"/><circle r="3.5" fill="#fff"/></g>` +
    glints;
  svg.appendChild(g);
  window.setTimeout(() => g.remove(), 1100);
  // The whole crystal shivers, its light flaring (all of it: the drawing under this one too, where there is one).
  const all = svg.parentElement?.hasAttribute('data-tingle') ? svg.parentElement : svg;
  all.classList.remove('wa-tingle');
  void all.getBoundingClientRect();
  all.classList.add('wa-tingle');
  sfx.crystal();
}

/** Crystal: cut glass in every colour, each facet catching the light its own way, light running across them, sparkles at their corners, rainbows breaking through; touched, it rings and a star flashes (tapCrystal). */
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
    // (Their own random, so each facet keeps the colour it had.)
    const light = seeded(97);
    const hues = [190, 300, 260, 50, 140, 330, 210];
    const tris: { pts: string; fill: string; face: number; delay: number; rainbow: string | null }[] = [];
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
          const h = hues[Math.floor(rnd() * hues.length)];
          const fill = `hsl(${h} 80% ${50 + rnd() * 36}%)`;
          const edge = light() < 0.3 ? `M${t[0][0].toFixed(1)} ${t[0][1].toFixed(1)}L${t[1][0].toFixed(1)} ${t[1][1].toFixed(1)}` : null;
          tris.push({ pts: t.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' '), fill, face: Math.floor(light() * CRYSTAL_FACES.length), delay: (cx / W) * 1.1 + (cy / H) * 0.9, rainbow: edge });
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
    <Svg onPointerDown={tapCrystal}>
      <defs>
        <linearGradient id={`${id}rb`} x1="0" y1="0" x2="1" y2="0">
          {['#f472b6', '#facc15', '#4ade80', '#38bdf8', '#a78bfa'].map((c, i) => (
            <stop key={c} offset={i / 4} stopColor={c} />
          ))}
        </linearGradient>
        {CRYSTAL_FACES.map(([a, lit, shade], i) => (
          <linearGradient key={i} id={`${id}f${i}`} gradientTransform={`rotate(${a} 0.5 0.5)`}>
            <stop offset="0" stopColor="#fff" stopOpacity={lit} />
            <stop offset="0.45" stopColor="#fff" stopOpacity={0} />
            <stop offset="1" stopColor="#0f172a" stopOpacity={shade} />
          </linearGradient>
        ))}
      </defs>
      {art.tris.map((t, i) => (
        <g key={i}>
          <polygon points={t.pts} fill={t.fill} fillOpacity={0.62} />
          <polygon points={t.pts} fill={`url(#${id}f${t.face})`} stroke="#fff" strokeOpacity={0.8} strokeWidth={0.7} strokeLinejoin="round" />
        </g>
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

/** A frame of a canvas wrapper: drawn in the pack's 300 × 400, `dt` the seconds since the last one (0 at the first). */
type WrapFrame = (ctx: CanvasRenderingContext2D, now: number, dt: number) => void;

/**
 * A wrapper drawn on canvases, the same few drawings for every pack showing it: `variants` of it are drawn (each its
 * own, at its own moment), 30 times a second, and each pack's canvas copies one, covering the pack (as an SVG's
 * "slice" would). However many packs are on screen, the work is the same (a dozen phoenixes, each its own fire, made
 * the Boutique lag). Drawn as sharp as the sharpest pack needs. Under reduced motion, still.
 * Gives the hook a wrapper's component calls with its canvas.
 */
function sharedCanvasWrap(make: () => WrapFrame, variants = 3) {
  type Pack = { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D; k: number; ox: number; oy: number; v: number };
  type Stage = { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D; frame: WrapFrame; k: number };
  const packs = new Set<Pack>();
  const stages: Stage[] = [];
  let count = 0;
  let raf = 0;
  let last = 0;
  const still = () => !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const render = (now: number, dt: number) => {
    const sharp = Math.min(3, Math.max(1, ...[...packs].map((p) => p.k)));
    const used = new Set([...packs].map((p) => p.v));
    for (const v of used) {
      let st = stages[v];
      if (!st) {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) continue;
        st = stages[v] = { canvas, ctx, frame: make(), k: 0 };
      }
      if (st.k !== sharp) {
        st.k = sharp;
        st.canvas.width = Math.round(W * sharp);
        st.canvas.height = Math.round(H * sharp);
      }
      const { ctx } = st;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
      ctx.clearRect(0, 0, st.canvas.width, st.canvas.height);
      ctx.setTransform(sharp, 0, 0, sharp, 0, 0);
      st.frame(ctx, now, dt);
    }
    for (const p of packs) {
      const st = stages[p.v];
      if (!st) continue;
      p.ctx.setTransform(1, 0, 0, 1, 0, 0);
      p.ctx.clearRect(0, 0, p.canvas.width, p.canvas.height);
      p.ctx.drawImage(st.canvas, p.ox, p.oy, W * p.k, H * p.k);
    }
  };
  const tick = (now: number) => {
    raf = requestAnimationFrame(tick);
    if (now - last < 1000 / 30 - 2) return;
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    render(now, dt);
  };
  return function useSharedCanvas(ref: React.RefObject<HTMLCanvasElement | null>) {
    useEffect(() => {
      const canvas = ref.current;
      const ctx = canvas?.getContext('2d');
      if (!canvas || !ctx) return;
      const pack: Pack = { canvas, ctx, k: 1, ox: 0, oy: 0, v: count++ % variants };
      const fit = () => {
        const dpr = window.devicePixelRatio || 1;
        const cw = canvas.clientWidth;
        const ch = canvas.clientHeight;
        canvas.width = Math.max(1, Math.round(cw * dpr));
        canvas.height = Math.max(1, Math.round(ch * dpr));
        const s = Math.max(cw / W, ch / H);
        pack.k = s * dpr;
        pack.ox = ((cw - W * s) / 2) * dpr;
        pack.oy = ((ch - H * s) / 2) * dpr;
      };
      fit();
      packs.add(pack);
      const sized = new ResizeObserver(() => {
        fit();
        if (still() || !raf) render(performance.now(), 0);
      });
      sized.observe(canvas);
      if (still()) render(performance.now(), 0);
      else if (!raf) {
        last = performance.now();
        raf = requestAnimationFrame(tick);
      }
      return () => {
        sized.disconnect();
        packs.delete(pack);
        if (!packs.size && raf) {
          cancelAnimationFrame(raf);
          raf = 0;
        }
      };
    }, [ref]);
  };
}

/** A soft round glow of one colour, drawn once: the grain of the canvas fires. */
function glowSprite(rgb: string, size = 64) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  if (g) {
    const r = size / 2;
    const gr = g.createRadialGradient(r, r, 0, r, r, r);
    gr.addColorStop(0, `rgba(${rgb},1)`);
    gr.addColorStop(0.3, `rgba(${rgb},0.6)`);
    gr.addColorStop(1, `rgba(${rgb},0)`);
    g.fillStyle = gr;
    g.fillRect(0, 0, size, size);
  }
  return c;
}

/**
 * A feather of flame, drawn once, lying along x (its quill at 0, its tip at 128): a wide red-orange glow, a narrow
 * white-hot heart. `bright` for the short feathers over the long ones. Each feather is this, turned and stretched.
 */
function featherSprite(bright: boolean) {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 64;
  const g = c.getContext('2d');
  if (g) {
    g.scale(2, 2);
    const shape = (w: number) => {
      g.beginPath();
      g.moveTo(0, 16);
      g.quadraticCurveTo(52, 16 - w, 128, 16 - w * 0.15);
      g.quadraticCurveTo(52, 16 + w * 0.7, 0, 16);
      g.closePath();
    };
    const glow = g.createLinearGradient(0, 0, 128, 0);
    glow.addColorStop(0, 'rgba(251,146,60,0.85)');
    glow.addColorStop(0.55, 'rgba(234,88,12,0.6)');
    glow.addColorStop(1, 'rgba(185,28,28,0)');
    g.fillStyle = glow;
    shape(15);
    g.fill();
    const core = g.createLinearGradient(0, 0, 128, 0);
    core.addColorStop(0, 'rgba(255,251,235,0.95)');
    core.addColorStop(0.4, bright ? 'rgba(254,240,138,0.85)' : 'rgba(253,224,71,0.7)');
    core.addColorStop(0.85, 'rgba(249,115,22,0)');
    g.fillStyle = core;
    shape(5.5);
    g.fill();
  }
  return c;
}

type Pt = [number, number];
/** A fire's colours as it burns out: white-hot, yellow, orange, red, ember. */
const FIRE_RGB = ['255,250,230', '253,224,71', '251,146,60', '234,88,12', '185,28,28'];
/** One wingbeat (s): a quick, strong downstroke, a slower stroke back up. */
const PHOENIX_BEAT = 1.7;
/** Every so often it burns down to a ball of fire and is reborn from it (s). */
const PHOENIX_LIFE = 12;
const PHOENIX_C: Pt = [150, 150];
/** How high its wings are (1 raised, -1 lowered) at a moment of the beat. */
const wingLift = (u: number) => (u < 0.38 ? Math.cos((Math.PI * u) / 0.38) : -Math.cos((Math.PI * (u - 0.38)) / 0.62));
const deg = (d: number) => (d * Math.PI) / 180;

/** The bird at a moment: its wings' feathers (right wing; the left is its mirror), its tail's flames, its body's rise. */
function phoenixPose(t: number) {
  const u = (t / PHOENIX_BEAT) % 1;
  const lift = wingLift(u);
  // The tip of the wing a beat behind the arm: it whips.
  const lag = wingLift((u + 0.91) % 1) - lift;
  const bob = 7 * lift;
  const s: Pt = [157, 146 + bob];
  const armA = deg(-20 - 38 * lift);
  const e: Pt = [s[0] + Math.cos(armA) * 46, s[1] + Math.sin(armA) * 46];
  const handA = armA - deg(10) - deg(26 * lag);
  const tip: Pt = [e[0] + Math.cos(handA) * 62, e[1] + Math.sin(handA) * 62];
  const feathers: { base: Pt; end: Pt; w: number; s: number }[] = [];
  const N = 13;
  for (let i = 0; i < N; i++) {
    const f = 0.05 + (i / (N - 1)) * 0.95;
    const onArm = f < 0.42;
    const g = onArm ? f / 0.42 : (f - 0.42) / 0.58;
    const base: Pt = onArm ? [s[0] + (e[0] - s[0]) * g, s[1] + (e[1] - s[1]) * g] : [e[0] + (tip[0] - e[0]) * g, e[1] + (tip[1] - e[1]) * g];
    const edge = onArm ? armA : handA;
    // Fanned out: hanging down near the body, sweeping out towards the tip; each flickering.
    const a = edge + deg(104 - f * 66 - 24 * lag * f + Math.sin(t * 7 + i) * 3);
    const len = (26 + 78 * f ** 1.1) * (1 + Math.sin(t * 13 + i * 1.7) * 0.06);
    feathers.push({ base, end: [base[0] + Math.cos(a) * len, base[1] + Math.sin(a) * len], w: 4 + f * 5, s: f });
  }
  // Its tail: long ribbons of flame trailing down, waving, the waves running down them.
  const tail: Pt[][] = [0, 1, 2, 3, 4].map((k) => {
    const a = deg(90 + (k - 2) * 15);
    const len = 120 + (k === 2 ? 48 : k % 2 ? 24 : 0);
    const dir: Pt = [Math.cos(a), Math.sin(a)];
    const nrm: Pt = [-dir[1], dir[0]];
    return Array.from({ length: 15 }, (_, j) => {
      const q = j / 14;
      const wave = Math.sin(2 * Math.PI * (q * 0.9 - t * 0.7) + k * 1.4) * 9 * q + (k - 2) * q * q * 22;
      return [150 + dir[0] * len * q + nrm[0] * wave, 192 + bob + dir[1] * len * q + nrm[1] * wave] as Pt;
    });
  });
  return { feathers, tail, bob, lift };
}

/** A ribbon along a line of points, `w` wide at its start, to a point at its end. */
function ribbon(ctx: CanvasRenderingContext2D, pts: Pt[], w: number) {
  const left: Pt[] = [];
  const right: Pt[] = [];
  pts.forEach((p, j) => {
    const a = pts[Math.max(0, j - 1)];
    const b = pts[Math.min(pts.length - 1, j + 1)];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    const nx = -(b[1] - a[1]) / len;
    const ny = (b[0] - a[0]) / len;
    const half = (w * (1 - j / (pts.length - 1)) ** 0.75 + 0.6) / 2;
    left.push([p[0] + nx * half, p[1] + ny * half]);
    right.push([p[0] - nx * half, p[1] - ny * half]);
  });
  ctx.beginPath();
  ctx.moveTo(left[0][0], left[0][1]);
  for (let j = 1; j < left.length; j++) ctx.quadraticCurveTo(left[j - 1][0], left[j - 1][1], (left[j - 1][0] + left[j][0]) / 2, (left[j - 1][1] + left[j][1]) / 2);
  ctx.lineTo(left[left.length - 1][0], left[left.length - 1][1]);
  for (let j = right.length - 1; j >= 0; j--) ctx.lineTo(right[j][0], right[j][1]);
  ctx.closePath();
}

const PHOENIX_BODY = new Path2D('M150 94C164 108 166 150 157 196L150 216L143 196C134 150 136 108 150 94Z');

/**
 * Phoenix: a bird of living fire. Its wings beat (a strong stroke down, the tips whipping after), every feather a
 * flame; its tail streams long ribbons of fire, waving; fire rises off it all the time, white-hot to red; embers
 * drift up around it. Every twelve seconds it burns down into a ball of fire, and is reborn from it in a flash, a
 * ring of fire and a burst of sparks.
 */
function makePhoenix(): WrapFrame {
  const fire = FIRE_RGB.map((c) => glowSprite(c));
  const plume = [featherSprite(false), featherSprite(true)];
  const white = glowSprite('255,255,255');
  type Flame = { x: number; y: number; vx: number; vy: number; age: number; life: number; size: number; drag: number };
  const flames: Flame[] = [];
  const rnd = seeded(31);
  const embers = Array.from({ length: 26 }, () => ({ x: rnd() * W, phase: rnd(), period: 3 + rnd() * 3.5, r: 0.8 + rnd() * 1.2, dx: (rnd() - 0.5) * 50, hot: rnd() < 0.5 }));
  let clock = Math.random() * PHOENIX_LIFE; // each drawing's bird somewhere else in its life
  let spawn = 0;
  let lastLife = -1;
  const draw = (ctx: CanvasRenderingContext2D, t: number, dt: number) => {
    const life = t % PHOENIX_LIFE;
    // Its size: burning down at the end of its life, reborn (overshooting a little) at the start.
    const dying = Math.max(0, (life - (PHOENIX_LIFE - 1.3)) / 1.3);
    const born = Math.min(1, life / 0.9);
    const back = 1 + 2.2 * (born - 1) ** 3 + 1.2 * (born - 1) ** 2;
    // (A little smaller than the pack, so its wings stay in it as they beat.)
    const scale = 0.86 * (dying > 0 ? 1 - 0.85 * dying ** 1.6 : 0.15 + 0.85 * back);
    const pose = phoenixPose(t);
    const at = (p: Pt): Pt => [PHOENIX_C[0] + (p[0] - PHOENIX_C[0]) * scale, PHOENIX_C[1] + (p[1] - PHOENIX_C[1]) * scale];
    // Reborn: a burst of sparks all round.
    if (life < lastLife)
      for (let i = 0; i < 70; i++) {
        const a = Math.random() * Math.PI * 2;
        const v = 110 + Math.random() * 190;
        flames.push({ x: 150, y: 150, vx: Math.cos(a) * v, vy: Math.sin(a) * v, age: 0, life: 0.6 + Math.random() * 0.6, size: 2 + Math.random() * 3.5, drag: 2.2 });
      }
    lastLife = life;
    // Fire rising off it: from its wings (most at their tips), its tail, its body, its crest.
    spawn += dt * 170 * (0.4 + 0.6 * scale);
    while (spawn >= 1) {
      spawn -= 1;
      const r = Math.random();
      let p: Pt;
      if (r < 0.5) {
        const f = pose.feathers[Math.floor(pose.feathers.length * Math.sqrt(Math.random()))];
        const q = 0.35 + Math.random() * 0.65;
        p = [f.base[0] + (f.end[0] - f.base[0]) * q, f.base[1] + (f.end[1] - f.base[1]) * q];
        if (Math.random() < 0.5) p = [W - p[0], p[1]];
      } else if (r < 0.78) {
        const line = pose.tail[Math.floor(Math.random() * 5)];
        p = line[2 + Math.floor(Math.random() * 12)];
      } else if (r < 0.94) p = [150 + (Math.random() - 0.5) * 16, 110 + pose.bob + Math.random() * 100];
      else p = [150 + (Math.random() - 0.5) * 14, 84 + pose.bob + Math.random() * 14];
      const [x, y] = at(p);
      flames.push({ x, y, vx: (Math.random() - 0.5) * 20, vy: -(30 + Math.random() * 50), age: 0, life: 0.3 + Math.random() * 0.45, size: (4 + Math.random() * 8) * (0.5 + 0.5 * scale), drag: 0 });
    }
    if (flames.length > 190) flames.splice(0, flames.length - 190);

    ctx.globalCompositeOperation = 'lighter';
    // The sun behind it, breathing, and the white heat of its rebirth.
    const flash = Math.max(dying * 0.9, 1 - life / 0.5);
    if (flash > 0) {
      ctx.globalAlpha = Math.min(1, flash);
      ctx.drawImage(white, 150 - 90 * (1.3 - dying * 0.6), 150 - 90 * (1.3 - dying * 0.6), 180 * (1.3 - dying * 0.6), 180 * (1.3 - dying * 0.6));
    }
    // A ring of fire spreading out as it's reborn.
    if (life < 1.1) {
      const q = life / 1.1;
      for (const [w, c, a] of [[16, '234,88,12', 0.35], [6, '251,146,60', 0.6], [2, '254,240,138', 1]] as const) {
        ctx.globalAlpha = a * (1 - q) ** 1.5;
        ctx.strokeStyle = `rgb(${c})`;
        ctx.lineWidth = w * (1 - q * 0.7);
        ctx.beginPath();
        ctx.arc(150, 150, 20 + q * 250, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    // The bird.
    ctx.save();
    ctx.translate(PHOENIX_C[0], PHOENIX_C[1]);
    ctx.scale(scale, scale);
    ctx.translate(-PHOENIX_C[0], -PHOENIX_C[1]);
    ctx.globalAlpha = 0.9;
    // Its tail, behind it.
    pose.tail.forEach((line, k) => {
      const end = line[line.length - 1];
      const g = ctx.createLinearGradient(line[0][0], line[0][1], end[0], end[1]);
      g.addColorStop(0, 'rgba(254,240,138,0)');
      g.addColorStop(0.08, 'rgba(254,240,138,0.85)');
      g.addColorStop(0.28, 'rgba(249,115,22,0.8)');
      g.addColorStop(0.6, 'rgba(220,38,38,0.4)');
      g.addColorStop(0.9, 'rgba(127,29,29,0)');
      ctx.fillStyle = g;
      ribbon(ctx, line, k === 2 ? 22 : 17);
      ctx.fill();
      // Its bright heart, a flame inside the flame.
      const h = ctx.createLinearGradient(line[0][0], line[0][1], end[0], end[1]);
      h.addColorStop(0, 'rgba(255,251,235,0)');
      h.addColorStop(0.12, 'rgba(255,251,235,0.75)');
      h.addColorStop(0.4, 'rgba(253,224,71,0.45)');
      h.addColorStop(0.6, 'rgba(253,224,71,0)');
      ctx.fillStyle = h;
      ribbon(ctx, line, k === 2 ? 8 : 6);
      ctx.fill();
    });
    // Its wings: the long flight feathers, then the shorter ones over them, then the bright arm.
    for (const side of [1, -1]) {
      ctx.save();
      if (side < 0) {
        ctx.translate(W, 0);
        ctx.scale(-1, 1);
      }
      // Each feather a flame: its glow, wide and red-orange, and its heart, narrow and white-hot. The long flight
      // feathers first, the short ones over them.
      for (const row of [1, 0.55]) {
        for (const f of pose.feathers) {
          const dx = f.end[0] - f.base[0];
          const dy = f.end[1] - f.base[1];
          ctx.save();
          ctx.translate(f.base[0], f.base[1]);
          ctx.rotate(Math.atan2(dy, dx));
          ctx.scale((Math.hypot(dx, dy) * row) / 128, f.w / 10);
          ctx.drawImage(plume[row < 1 ? 1 : 0], 0, -16, 128, 32);
          ctx.restore();
        }
      }
      ctx.restore();
    }
    // Its body, its crest, its eye.
    ctx.translate(0, pose.bob);
    const body = ctx.createRadialGradient(150, 135, 2, 150, 150, 70);
    body.addColorStop(0, '#fffbeb');
    body.addColorStop(0.35, '#fde047');
    body.addColorStop(0.8, '#f97316');
    body.addColorStop(1, 'rgba(220,38,38,0)');
    ctx.fillStyle = body;
    ctx.fill(PHOENIX_BODY);
    ctx.fillStyle = 'rgba(254,240,138,0.9)';
    [-118, -94, -70].forEach((a, i) => {
      const len = 30 + Math.sin(t * 9 + i * 2) * 5;
      ctx.fill(new Path2D(leaf([150, 100], [150 + Math.cos(deg(a)) * len, 100 + Math.sin(deg(a)) * len], 5, 6)));
    });
    // Its head, turned up, its beak, its burning eye.
    const head = ctx.createRadialGradient(149, 102, 1, 150, 104, 10);
    head.addColorStop(0, '#fffbeb');
    head.addColorStop(0.6, '#fde047');
    head.addColorStop(1, 'rgba(249,115,22,0.6)');
    ctx.fillStyle = head;
    ctx.beginPath();
    ctx.ellipse(150, 104, 7.5, 9, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff7ed';
    ctx.fill(new Path2D('M146 98L150 84L154 98Z'));
    ctx.globalAlpha = 0.85 + 0.15 * Math.sin(t * 11);
    ctx.drawImage(white, 146 - 5, 104 - 5, 10, 10);
    ctx.drawImage(white, 154 - 5, 104 - 5, 10, 10);
    ctx.restore();

    // The fire rising off it, white-hot going red.
    for (let i = flames.length - 1; i >= 0; i--) {
      const f = flames[i];
      f.age += dt;
      if (f.age >= f.life) {
        flames.splice(i, 1);
        continue;
      }
      if (f.drag) {
        const d = Math.exp(-f.drag * dt);
        f.vx *= d;
        f.vy = f.vy * d - 30 * dt;
      } else f.vy -= 40 * dt;
      f.x += f.vx * dt;
      f.y += f.vy * dt;
      const a = f.age / f.life;
      const size = f.size * (1 - 0.55 * a);
      ctx.globalAlpha = 0.6 * (1 - a) ** 1.1;
      ctx.drawImage(fire[Math.min(4, 1 + Math.floor(a * 4))], f.x - size, f.y - size, size * 2, size * 2);
    }
    // Embers drifting up all round.
    for (const e of embers) {
      const q = (t / e.period + e.phase) % 1;
      ctx.globalAlpha = Math.min(1, q * 6) * (1 - q);
      const x = e.x + e.dx * q + Math.sin(q * 9 + e.phase * 6) * 5;
      const y = H + 6 - q * 430;
      ctx.drawImage(fire[e.hot ? 1 : 2], x - e.r * 3, y - e.r * 3, e.r * 6, e.r * 6);
      ctx.drawImage(fire[0], x - e.r, y - e.r, e.r * 2, e.r * 2);
    }
  };
  // It starts already burning (a second of fire run ahead).
  let started = false;
  return (ctx, now, dt) => {
    if (!started) {
      started = true;
      for (let i = 0; i < 30; i++) {
        clock += 1 / 30;
        ctx.save();
        draw(ctx, clock, 1 / 30);
        ctx.restore();
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
        ctx.restore();
      }
    }
    clock += dt;
    void now;
    draw(ctx, clock, dt);
  };
}
const usePhoenix = sharedCanvasWrap(makePhoenix);

export function PhoenixWrap() {
  const ref = useRef<HTMLCanvasElement>(null);
  usePhoenix(ref);
  return <canvas ref={ref} className="pointer-events-none absolute inset-0 size-full" aria-hidden />;
}

// ---------------------------------------------------------------------------------------------- Diamond Heart

type V3 = [number, number, number];
/**
 * A brilliant-cut diamond, its girdle a circle of radius 1 at height 0: the table (an octagon) on top, the crown's
 * facets from the table down to the girdle, the pavilion's from the girdle down to the culet, a point. Each facet a
 * list of its corners (which way it faces is worked out when drawn: away from the middle).
 */
const DIAMOND_FACETS: V3[][] = (() => {
  const ring = (n: number, r: number, y: number, off: number) =>
    Array.from({ length: n }, (_, k) => {
      const a = ((k + off) / n) * Math.PI * 2;
      return [Math.cos(a) * r, y, Math.sin(a) * r] as V3;
    });
  const g = ring(16, 1, 0, 0);
  const t = ring(8, 0.56, 0.36, 0.5);
  const p = ring(8, 0.5, -0.42, 0);
  const culet: V3 = [0, -0.92, 0];
  const out: V3[][] = [[...t].reverse()];
  for (let j = 0; j < 8; j++) {
    const g0 = g[2 * j];
    const g1 = g[2 * j + 1];
    const g2 = g[(2 * j + 2) % 16];
    // The crown: two facets under each table corner, a star facet between two corners.
    out.push([g0, t[j], g1], [g1, t[j], g2], [t[j], t[(j + 1) % 8], g2]);
    // The pavilion: two facets from the girdle down to a ring, a long one from the ring to the point.
    const gm = g[(2 * j + 15) % 16];
    out.push([gm, g0, p[j]], [g0, g1, p[j]], [p[j], g1, p[(j + 1) % 8]], [p[j], p[(j + 1) % 8], culet]);
  }
  return out;
})();

/**
 * Diamond Heart (Ascended, Crystal's): a great brilliant-cut diamond turning slowly in the middle of the pack, each
 * facet catching the light as it turns, white, ice or a flash of colour (a diamond's fire); light broken into a
 * rainbow streaming out from it; shards of crystal drifting round it; stars twinkling. Touched, it rings like the
 * Crystal (tapCrystal), the whole pack shivering.
 */
function makeDiamond(): WrapFrame {
  const glow = [glowSprite('165,243,252'), glowSprite('216,180,254'), glowSprite('255,255,255')];
  const rnd = seeded(53);
  const shards = Array.from({ length: 13 }, (_, i) => {
    const a = (i / 13) * Math.PI * 2 + rnd() * 0.4;
    const d = 110 + rnd() * 70;
    return { a, d, size: 5 + rnd() * 8, spin: (rnd() - 0.5) * 1.2, bob: rnd() * 6, phase: rnd() * 6, hue: [190, 260, 300, 210, 170][i % 5] };
  });
  const twinkles = Array.from({ length: 22 }, () => ({ x: rnd() * W, y: rnd() * H, s: 2 + rnd() * 4, period: 1.8 + rnd() * 2.6, phase: rnd() }));
  const RAYS = ['#ff4fd8', '#facc15', '#4ade80', '#38bdf8', '#a855f7', '#f472b6', '#22d3ee'];
  const CX = 150;
  const CY = 150;
  const S = 98;
  const L = (() => {
    const v = [-0.45, 0.65, 0.62];
    const n = Math.hypot(v[0], v[1], v[2]);
    return v.map((c) => c / n);
  })();
  let clock = Math.random() * 100;
  const star = (ctx: CanvasRenderingContext2D, x: number, y: number, r: number) => {
    ctx.beginPath();
    ctx.moveTo(x, y - r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.quadraticCurveTo(x, y, x, y + r);
    ctx.quadraticCurveTo(x, y, x - r, y);
    ctx.quadraticCurveTo(x, y, x, y - r);
    ctx.fill();
  };
  return (ctx, _now, dt) => {
    clock += dt;
    const t = clock;
    ctx.globalCompositeOperation = 'lighter';
    // The light it breaks into colours, streaming out from it, the beams turning slowly and flickering.
    RAYS.forEach((c, i) => {
      const a = t * 0.12 + (i / RAYS.length) * Math.PI * 2 + Math.sin(t * 0.7 + i) * 0.15;
      const len = 260;
      const w = 0.05 + 0.03 * Math.sin(t * 1.3 + i * 2);
      const g = ctx.createLinearGradient(CX, CY, CX + Math.cos(a) * len, CY + Math.sin(a) * len);
      g.addColorStop(0, `${c}00`);
      g.addColorStop(0.18, `${c}aa`);
      g.addColorStop(1, `${c}00`);
      ctx.globalAlpha = 0.28 + 0.14 * Math.sin(t * 2.1 + i * 1.7);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(CX, CY);
      ctx.lineTo(CX + Math.cos(a - w) * len, CY + Math.sin(a - w) * len);
      ctx.lineTo(CX + Math.cos(a + w) * len, CY + Math.sin(a + w) * len);
      ctx.closePath();
      ctx.fill();
    });
    // Its glow.
    ctx.globalAlpha = 0.55 + 0.15 * Math.sin(t * 1.6);
    ctx.drawImage(glow[0], CX - 120, CY - 120, 240, 240);
    ctx.globalAlpha = 0.35;
    ctx.drawImage(glow[1], CX - 90, CY - 70, 180, 180);
    // The stars round it, twinkling.
    ctx.fillStyle = '#fff';
    for (const s of twinkles) {
      const q = (t / s.period + s.phase) % 1;
      const a = Math.max(0, Math.sin(q * Math.PI * 2)) ** 3;
      if (a < 0.02) continue;
      ctx.globalAlpha = a;
      star(ctx, s.x, s.y, s.s * (0.6 + 0.4 * a));
    }
    ctx.globalCompositeOperation = 'source-over';
    // The shards drifting round it, each turning.
    for (const s of shards) {
      const a = s.a + t * 0.08;
      const x = CX + Math.cos(a) * s.d * 0.85;
      const y = CY + Math.sin(a) * s.d + Math.sin(t * 1.2 + s.phase) * s.bob;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(t * s.spin + s.phase);
      const g = ctx.createLinearGradient(-s.size, -s.size * 1.6, s.size, s.size * 1.6);
      g.addColorStop(0, '#f0f9ff');
      g.addColorStop(0.5, `hsl(${s.hue} 80% 75%)`);
      g.addColorStop(1, `hsl(${s.hue} 70% 40%)`);
      ctx.globalAlpha = 0.85;
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(0, -s.size * 1.7);
      ctx.lineTo(s.size * 0.7, -s.size * 0.4);
      ctx.lineTo(s.size * 0.5, s.size * 1.2);
      ctx.lineTo(-s.size * 0.5, s.size * 1.2);
      ctx.lineTo(-s.size * 0.7, -s.size * 0.4);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.75)';
      ctx.lineWidth = 0.7;
      ctx.stroke();
      ctx.restore();
    }
    // The diamond, turning: its facets facing us, each lit by how it meets the light, and its fire.
    const turn = t * 0.45;
    const tilt = -0.3 + Math.sin(t * 0.5) * 0.06;
    const ct = Math.cos(turn);
    const st = Math.sin(turn);
    const cx = Math.cos(tilt);
    const sx = Math.sin(tilt);
    const view = ([x, y, z]: V3): V3 => {
      const x1 = x * ct + z * st;
      const z1 = -x * st + z * ct;
      return [x1, y * cx - z1 * sx, y * sx + z1 * cx];
    };
    const sparks: [number, number, number][] = [];
    ctx.globalAlpha = 1;
    DIAMOND_FACETS.forEach((f, i) => {
      const v = f.map(view);
      const ax = v[1][0] - v[0][0];
      const ay = v[1][1] - v[0][1];
      const az = v[1][2] - v[0][2];
      const bx = v[2][0] - v[0][0];
      const by = v[2][1] - v[0][1];
      const bz = v[2][2] - v[0][2];
      let nx = ay * bz - az * by;
      let ny = az * bx - ax * bz;
      let nz = ax * by - ay * bx;
      const nl = Math.hypot(nx, ny, nz) || 1;
      nx /= nl;
      ny /= nl;
      nz /= nl;
      // Facing out, away from the middle.
      const mx0 = v.reduce((a, q) => a + q[0], 0);
      const my0 = v.reduce((a, q) => a + q[1], 0);
      const mz0 = v.reduce((a, q) => a + q[2], 0);
      if (nx * mx0 + ny * my0 + nz * mz0 < 0) {
        nx = -nx;
        ny = -ny;
        nz = -nz;
      }
      if (nz <= 0.01) return;
      const diff = Math.max(0, nx * L[0] + ny * L[1] + nz * L[2]);
      // How near it sends the light straight at us: a flash.
      const rz = 2 * (nx * L[0] + ny * L[1] + nz * L[2]) * nz - L[2];
      const spec = Math.max(0, rz) ** 10;
      const fire = (Math.sin(i * 2.3 + turn * 3 + nx * 4) + 1) / 2;
      // Ice-white and pale blue, bright against dark as a diamond is (the light thrown back from inside it, which
      // changes as it turns), darker down the pavilion; here and there a tint of its fire, every colour. Each facet
      // shaded across, like glass.
      const hue = (i * 53 + turn * 140) % 360;
      const inner = 0.45 + 0.75 * ((Math.sin(i * 1.7 + turn * 2.2) + 1) / 2);
      const below = ny < -0.2 ? 0.8 : 1;
      const tinted = fire > 0.8;
      const light = tinted ? 62 + 22 * diff : Math.min(97, (30 + diff * 55 + spec * 30) * inner * below);
      const h = tinted ? hue : 205 + nx * 25;
      const sat = tinted ? 80 : 45;
      const shade = ctx.createLinearGradient(CX + v[0][0] * S, CY - v[0][1] * S, CX + v[2][0] * S, CY - v[2][1] * S);
      shade.addColorStop(0, `hsl(${h} ${sat}% ${Math.min(98, light + 18)}%)`);
      shade.addColorStop(1, `hsl(${h} ${sat}% ${Math.max(8, light - 14)}%)`);
      ctx.fillStyle = shade;
      ctx.beginPath();
      v.forEach(([x, y], k) => (k ? ctx.lineTo(CX + x * S, CY - y * S) : ctx.moveTo(CX + x * S, CY - y * S)));
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = `rgba(255,255,255,${0.35 + diff * 0.4})`;
      ctx.lineWidth = 0.8;
      ctx.stroke();
      if (spec > 0.25) {
        const mx = v.reduce((a, p) => a + p[0], 0) / v.length;
        const my = v.reduce((a, p) => a + p[1], 0) / v.length;
        sparks.push([CX + mx * S, CY - my * S, spec]);
      }
    });
    // Its glints, where a facet throws the light right at us.
    ctx.globalCompositeOperation = 'lighter';
    for (const [x, y, s] of sparks) {
      ctx.globalAlpha = Math.min(1, s);
      ctx.drawImage(glow[2], x - 16, y - 16, 32, 32);
      ctx.fillStyle = '#fff';
      star(ctx, x, y, 10 + s * 10);
    }
    // A slow glint crossing its girdle now and then.
    const sweep = (t % 5) / 5;
    if (sweep < 0.3) {
      ctx.globalAlpha = Math.sin((sweep / 0.3) * Math.PI);
      ctx.fillStyle = '#fff';
      star(ctx, CX - S + (sweep / 0.3) * 2 * S, CY, 14);
    }
  };
}
const useDiamond = sharedCanvasWrap(makeDiamond);

export function DiamondWrap() {
  const ref = useRef<HTMLCanvasElement>(null);
  useDiamond(ref);
  return (
    <div className="absolute inset-0" data-tingle>
      <canvas ref={ref} className="pointer-events-none absolute inset-0 size-full" aria-hidden />
      <Svg onPointerDown={tapCrystal}>{null}</Svg>
    </div>
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

/** A gear around (0, 0): `n` teeth on a wheel of radius `r`, teeth `t` deep, a hub and round holes cut out (even-odd). */
function gear(n: number, r: number, t: number) {
  const pts: string[] = [];
  for (let k = 0; k < n; k++) {
    const a = (k / n) * Math.PI * 2;
    const s = (Math.PI * 2) / n;
    for (const [da, rr] of [
      [0, r],
      [s * 0.12, r + t],
      [s * 0.38, r + t],
      [s * 0.5, r],
    ] as const) {
      const [x, y] = pt(0, 0, rr, a + da);
      pts.push(`${x.toFixed(1)} ${y.toFixed(1)}`);
    }
  }
  const hole = (cx: number, cy: number, rr: number) => `M${(cx + rr).toFixed(1)} ${cy.toFixed(1)}a${rr} ${rr} 0 1 0 ${(-2 * rr).toFixed(1)} 0a${rr} ${rr} 0 1 0 ${(2 * rr).toFixed(1)} 0Z`;
  const holes = [0, 1, 2, 3, 4]
    .map((k) => {
      const [x, y] = pt(0, 0, r * 0.58, (k / 5) * Math.PI * 2);
      return hole(x, y, r * 0.2);
    })
    .join('');
  return `M${pts.join('L')}Z${holes}${hole(0, 0, r * 0.14)}`;
}

/**
 * A brass gear turning (`dir` 1 clockwise, -1 the other way), drawn at (x, y). `shadow`: only its shadow (cast down
 * and right, turning with it). `jewel`: its hub, a cap set with a ruby, as in a watch movement.
 */
function Gear({ x, y, n, r, dur, dir, fill, delay = 0, shadow = false, jewel }: { x: number; y: number; n: number; r: number; dur: number; dir: 1 | -1; fill: string; delay?: number; shadow?: boolean; jewel?: { cap: string; ruby: string } }) {
  const d = useMemo(() => gear(n, r, r * 0.16), [n, r]);
  return (
    <g transform={`translate(${x + (shadow ? 3 : 0)} ${y + (shadow ? 5 : 0)})`}>
      <g className="wa-gear" style={{ animationDuration: `${dur}s`, animationDirection: dir > 0 ? 'normal' : 'reverse', animationDelay: `${delay}s` }}>
        {shadow ? (
          <path d={d} fill="#000" fillRule="evenodd" opacity={0.45} />
        ) : (
          <>
            <path d={d} fill={fill} fillRule="evenodd" stroke="#3b2208" strokeWidth={1} strokeOpacity={0.6} />
            <circle r={r * 0.36} fill="none" stroke="#fff7d6" strokeOpacity={0.35} strokeWidth={1} />
            {/* The rim's inner edge, cut into the metal. */}
            <circle r={r * 0.8} fill="none" stroke="#3b2208" strokeOpacity={0.35} strokeWidth={1.2} />
            {jewel && (
              <>
                <circle r={r * 0.2} fill={jewel.cap} stroke="#3b2208" strokeWidth={0.8} />
                <circle r={r * 0.09} fill={jewel.ruby} />
                <circle cx={-r * 0.03} cy={-r * 0.03} r={r * 0.03} fill="#fff" opacity={0.85} />
              </>
            )}
          </>
        )}
      </g>
    </g>
  );
}

/** A hairspring: a fine steel spiral, four turns, from the balance's staff out. */
const HAIRSPRING = (() => {
  const pts: string[] = [];
  for (let i = 0; i <= 96; i++) {
    const a = (i / 96) * Math.PI * 8;
    const r = 2.5 + (i / 96) * 13;
    pts.push(`${(Math.cos(a) * r).toFixed(2)} ${(Math.sin(a) * r).toFixed(2)}`);
  }
  return `M${pts.join('L')}`;
})();

/**
 * Clockwork's gear train: each gear set beside the one that drives it (at an angle, as far as their two radii and
 * half their teeth), turning the other way. [driver index, angle in degrees, teeth, radius, copper?]
 */
const TRAIN = (() => {
  const plan: [number, number, number, number, boolean][] = [
    [-1, 0, 14, 52, false],
    [0, 35, 9, 30, true],
    [1, -30, 12, 44, false],
    [1, 60, 16, 60, false],
    [3, 160, 8, 26, true],
    [4, 115, 13, 48, false],
    [3, 75, 7, 22, true],
    [6, 70, 11, 40, false],
  ];
  const out: { x: number; y: number; n: number; r: number; dir: 1 | -1; copper: boolean }[] = [];
  for (const [from, deg, n, r, copper] of plan) {
    if (from < 0) {
      out.push({ x: 66, y: 86, n, r, dir: 1, copper });
      continue;
    }
    const d = out[from];
    const dist = d.r + r + (d.r * 0.16 + r * 0.16) / 2;
    const [x, y] = pt(d.x, d.y, dist, (deg * Math.PI) / 180);
    out.push({ x, y, n, r, dir: (d.dir * -1) as 1 | -1, copper });
  }
  return out;
})();

const ROMAN_HOURS = ['XII', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI'];

/**
 * Clockwork (Prestige): brass gears meshing and turning, each casting its shadow, their hubs set with rubies; a clock
 * face ticking its seconds, its minute hand creeping on; the balance wheel swinging back and forth on its hairspring,
 * the heart of the movement; a warm light breathing; a gleam of brass sweeping by.
 */
export function ClockworkWrap() {
  const id = useUid();
  const brass = `url(#${id}b)`;
  const copper = `url(#${id}c)`;
  return (
    <Svg>
      <defs>
        <linearGradient id={`${id}b`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fef3c7" />
          <stop offset="0.3" stopColor="#d4a017" />
          <stop offset="0.6" stopColor="#a16207" />
          <stop offset="1" stopColor="#fde68a" />
        </linearGradient>
        <linearGradient id={`${id}c`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fed7aa" />
          <stop offset="0.45" stopColor="#c2410c" />
          <stop offset="1" stopColor="#7c2d12" />
        </linearGradient>
        <linearGradient id={`${id}s`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#fde68a" stopOpacity="0" />
          <stop offset="0.5" stopColor="#fff7d6" stopOpacity="0.45" />
          <stop offset="1" stopColor="#fde68a" stopOpacity="0" />
        </linearGradient>
        <radialGradient id={`${id}r`} cx="0.35" cy="0.35" r="0.75">
          <stop offset="0" stopColor="#fda4af" />
          <stop offset="0.45" stopColor="#e11d48" />
          <stop offset="1" stopColor="#4c0519" />
        </radialGradient>
        <radialGradient id={`${id}l`} cx="0.5" cy="0.45" r="0.6">
          <stop offset="0" stopColor="#fde68a" stopOpacity="0.22" />
          <stop offset="1" stopColor="#fde68a" stopOpacity="0" />
        </radialGradient>
      </defs>
      {/* A warm light on the movement, breathing. */}
      <rect className="wa-clk-glow" width={W} height={H} fill={`url(#${id}l)`} />
      {/* The train of gears, meshing: each turns the other way from the one it drives, the small ones faster (a turn
          takes as long as its teeth count). Their shadows first, under all of them. */}
      {TRAIN.map((g, k) => (
        <Gear key={`s${k}`} x={g.x} y={g.y} n={g.n} r={g.r} dur={g.n * 1.15} dir={g.dir} fill="#000" shadow />
      ))}
      {TRAIN.map((g, k) => (
        <Gear key={k} x={g.x} y={g.y} n={g.n} r={g.r} dur={g.n * 1.15} dir={g.dir} fill={g.copper ? copper : brass} jewel={{ cap: g.copper ? brass : copper, ruby: `url(#${id}r)` }} />
      ))}
      {/* The balance wheel: swinging one way and back on its hairspring (coiling and uncoiling), each swing a tick. */}
      <g transform="translate(150 348)">
        <circle cx={3} cy={5} r={30} fill="none" stroke="#000" strokeOpacity={0.4} strokeWidth={5} />
        <g className="wa-balance">
          <circle r={28} fill="none" stroke={brass} strokeWidth={4.5} />
          <circle r={28} fill="none" stroke="#3b2208" strokeOpacity={0.5} strokeWidth={0.8} />
          {[0, 120, 240].map((a) => {
            const [x, y] = pt(0, 0, 26, (a * Math.PI) / 180 - Math.PI / 2);
            return <path key={a} d={`M0 0L${x.toFixed(1)} ${y.toFixed(1)}`} stroke={brass} strokeWidth={2.6} strokeLinecap="round" />;
          })}
          {Array.from({ length: 10 }, (_, k) => {
            const [x, y] = pt(0, 0, 30.5, (k / 10) * Math.PI * 2);
            return <circle key={k} cx={x} cy={y} r={1.9} fill={copper} stroke="#3b2208" strokeWidth={0.5} />;
          })}
          <g className="wa-hairspring">
            <path d={HAIRSPRING} fill="none" stroke="#e2e8f0" strokeOpacity={0.85} strokeWidth={0.7} />
          </g>
        </g>
        <circle r={4} fill={brass} stroke="#3b2208" strokeWidth={0.6} />
        <circle r={1.8} fill={`url(#${id}r)`} />
      </g>
      {/* A clock face, its second hand ticking. */}
      <g transform={`translate(${TRAIN[1].x} ${TRAIN[1].y})`}>
        <circle r={24} fill="#fff7e6" stroke={brass} strokeWidth={3} />
        {ROMAN_HOURS.map((_, k) => {
          const [x0, y0] = pt(0, 0, 19, (k / 12) * Math.PI * 2);
          const [x1, y1] = pt(0, 0, 22, (k / 12) * Math.PI * 2);
          return <path key={k} d={`M${x0.toFixed(1)} ${y0.toFixed(1)}L${x1.toFixed(1)} ${y1.toFixed(1)}`} stroke="#3b2208" strokeWidth={k % 3 ? 0.8 : 1.6} />;
        })}
        <path d="M0 2V-12" stroke="#3b2208" strokeWidth={2} strokeLinecap="round" transform="rotate(-50)" />
        <path className="wa-clk-min" d="M0 3V-17" stroke="#3b2208" strokeWidth={1.3} strokeLinecap="round" />
        <path className="wa-clk-tick" d="M0 4V-19" stroke="#b91c1c" strokeWidth={0.9} strokeLinecap="round" />
        <circle r={1.8} fill="#3b2208" />
      </g>
      <rect className="wa-deco-sweep" x={-W} y={0} width={W} height={H} fill={`url(#${id}s)`} />
    </Svg>
  );
}

/** Chronos (Ascended): time itself. An astrolabe of gold rings turning against each other, Roman hours round it, its
 *  hands racing; an hourglass that empties and turns over; gears at the corners; motes of time spiralling in. */
export function ChronosWrap() {
  const id = useUid();
  const gold = `url(#${id}g)`;
  const motes = useMemo(() => {
    const r = seeded(7);
    return Array.from({ length: 22 }, (_, k) => ({ k, rad: 40 + r() * 120, a: r() * 360, dur: 6 + r() * 8, size: 0.8 + r() * 1.8, delay: -r() * 10 }));
  }, []);
  const ticks = useMemo(
    () =>
      Array.from({ length: 60 }, (_, k) => {
        const a = (k / 60) * Math.PI * 2;
        const [x0, y0] = pt(0, 0, k % 5 ? 104 : 98, a);
        const [x1, y1] = pt(0, 0, 110, a);
        return `M${x0.toFixed(1)} ${y0.toFixed(1)}L${x1.toFixed(1)} ${y1.toFixed(1)}`;
      }).join(''),
    [],
  );
  return (
    <Svg>
      <defs>
        <linearGradient id={`${id}g`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fff7d6" />
          <stop offset="0.4" stopColor="#fbbf24" />
          <stop offset="0.7" stopColor="#b45309" />
          <stop offset="1" stopColor="#fde68a" />
        </linearGradient>
        <radialGradient id={`${id}h`}>
          <stop offset="0" stopColor="#fde68a" stopOpacity="0.55" />
          <stop offset="1" stopColor="#fde68a" stopOpacity="0" />
        </radialGradient>
        <path id={`${id}r`} d={arc(84, -Math.PI / 2, Math.PI * 1.5 - 0.001)} />
      </defs>
      {/* Gears at the corners, quietly turning. */}
      <g opacity={0.55}>
        <Gear x={0} y={0} n={16} r={58} dur={30} dir={1} fill={gold} />
        <Gear x={300} y={0} n={12} r={42} dur={24} dir={-1} fill={gold} />
        <Gear x={0} y={400} n={12} r={44} dur={24} dir={-1} fill={gold} />
        <Gear x={300} y={400} n={16} r={58} dur={30} dir={1} fill={gold} />
      </g>
      {/* Motes of time, spiralling round the face. */}
      <g transform="translate(150 178)">
        {motes.map((m) => (
          <g key={m.k} transform={`rotate(${m.a.toFixed(0)})`}>
            <g className="wa-chr-orbit" style={{ animationDuration: `${m.dur.toFixed(1)}s`, animationDelay: `${m.delay.toFixed(1)}s` }}>
              <circle cx={m.rad.toFixed(1)} r={m.size.toFixed(1)} fill="#fde68a" className="wa-spark" style={{ animationDelay: `${m.delay.toFixed(1)}s` }} />
            </g>
          </g>
        ))}
      </g>
      {/* The astrolabe: a glow, rings turning against each other, the hours, and the hands racing. */}
      <g transform="translate(150 178)">
        <circle r={128} fill={`url(#${id}h)`} />
        <g className="wa-gear" style={{ animationDuration: '60s' }}>
          <circle r={110} fill="none" stroke={gold} strokeWidth={2} />
          <path d={ticks} stroke={gold} strokeWidth={1.2} />
        </g>
        <g className="wa-gear" style={{ animationDuration: '40s', animationDirection: 'reverse' }}>
          <circle r={92} fill="none" stroke={gold} strokeWidth={1} strokeDasharray="2 5" />
          <text fill="#fde68a" fontSize={12} fontFamily="serif" fontWeight={700} letterSpacing={1}>
            <textPath href={`#${id}r`} textLength={520}>
              {ROMAN_HOURS.join(' · ')} ·
            </textPath>
          </text>
          <circle r={74} fill="none" stroke={gold} strokeWidth={1.6} />
        </g>
        <g className="wa-gear" style={{ animationDuration: '24s' }}>
          <ellipse rx={66} ry={22} fill="none" stroke="#fde68a" strokeOpacity={0.6} strokeWidth={1} transform="rotate(30)" />
          <ellipse rx={66} ry={22} fill="none" stroke="#fde68a" strokeOpacity={0.6} strokeWidth={1} transform="rotate(-30)" />
        </g>
        <path className="wa-chr-hand wa-chr-hour" d="M0 6L-3 0L0 -42L3 0Z" fill={gold} />
        <path className="wa-chr-hand wa-chr-minute" d="M0 8L-2 0L0 -64L2 0Z" fill="#fff7d6" />
        <circle r={5} fill={gold} stroke="#fff7d6" strokeWidth={1} />
      </g>
      {/* The hourglass: sand running down, then it turns over. */}
      <g transform="translate(150 344)">
        <g className="wa-chr-glass">
          <path d="M-20 -34H20M-20 34H20" stroke={gold} strokeWidth={3} strokeLinecap="round" />
          <path d="M-16 -32C-16 -8 -3 -6 -3 0C-3 6 -16 8 -16 32H16C16 8 3 6 3 0C3 -6 16 -8 16 -32Z" fill="rgba(255,247,214,0.12)" stroke="#fde68a" strokeWidth={1.2} />
          <path className="wa-chr-sand-top" d="M-12 -26H12C10 -12 2 -8 0 -2C-2 -8 -10 -12 -12 -26Z" fill="#fbbf24" />
          <path className="wa-chr-sand-fall" d="M0 -2V30" stroke="#fde68a" strokeWidth={1.2} strokeDasharray="2 3" />
          <path className="wa-chr-sand-bottom" d="M-14 31H14C12 22 4 18 0 16C-4 18 -12 22 -14 31Z" fill="#fbbf24" />
        </g>
      </g>
    </Svg>
  );
}

/** The wrappers drawn here. */
export const DRAWN = new Set(['wrap:dragon', 'wrap:blackhole', 'wrap:eventhorizon', 'wrap:bigbang', 'wrap:crystal', 'wrap:diamond', 'wrap:phoenix', 'wrap:deco', 'wrap:clockwork', 'wrap:chronos']);

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
    case 'wrap:diamond':
      return <DiamondWrap />;
    case 'wrap:phoenix':
      return <PhoenixWrap />;
    case 'wrap:deco':
      return <DecoWrap />;
    case 'wrap:clockwork':
      return <ClockworkWrap />;
    case 'wrap:chronos':
      return <ChronosWrap />;
    default:
      return null;
  }
}
