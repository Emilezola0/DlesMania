// The dungeon's rock (src/island/IslandView.tsx, World): its walls and the back wall of its rooms, drawn once on a few
// canvases instead of thousands of tiles. Each tile used to carry a CSS filter (the biome's tint), and the browser
// painted them all again as the camera moved: the dungeon lagged. Here the tint is worked out once per biome (the same
// colour maths as CSS's sepia / hue-rotate / saturate / brightness) and baked into a few small tiles that are stamped.
// Only the plain walls (dungeon-*) and the open cells are drawn here; ores, traps, chests and the rest stay as before.
import { memo, useEffect, useRef } from 'react';
import { biomeAt } from './dungeon';
import { fgAt, idx, isSolid, ISLAND, kindOf, type Island } from './island';
import { cellHash } from './scenery';

/** The stone's picture (src/index.css, .island-stone). */
const STONE_BG = '#565b63';
const STONE_SVG =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Cg fill='%23746c63' stroke='%23423b35' stroke-width='1'%3E%3Crect x='1' y='1' width='13' height='9' rx='3'/%3E%3Crect x='16' y='1' width='15' height='9' rx='3'/%3E%3Crect x='1' y='12' width='8' height='9' rx='3'/%3E%3Crect x='11' y='12' width='12' height='9' rx='3'/%3E%3Crect x='25' y='12' width='6' height='9' rx='2.5'/%3E%3Crect x='1' y='23' width='15' height='8' rx='3'/%3E%3Crect x='18' y='23' width='13' height='8' rx='3'/%3E%3C/g%3E%3Cg stroke='%238d857b' stroke-width='1.1' stroke-linecap='round'%3E%3Cpath d='M4 3.5h6M19 3.5h8M13 14.5h6M4 25.5h7M21 25.5h6'/%3E%3C/g%3E%3C/svg%3E";

type F = ['sepia' | 'hue' | 'sat' | 'bright', number];
/** Each biome's tint, as in src/index.css (.island-dungeon…): the wall, and the darker back wall of a room. */
const TINT: Record<string, { wall: F[]; cave: F[] }> = {
  'dungeon-brick': { wall: [['hue', 230], ['sat', 0.55], ['bright', 0.62]], cave: [['hue', 230], ['sat', 0.45], ['bright', 0.3]] },
  'dungeon-ice': { wall: [['sepia', 0.7], ['hue', 160], ['sat', 2.4], ['bright', 1.15]], cave: [['sepia', 0.7], ['hue', 165], ['sat', 1.8], ['bright', 0.45]] },
  'dungeon-moss': { wall: [['sepia', 0.8], ['hue', 45], ['sat', 1.9], ['bright', 0.7]], cave: [['sepia', 0.8], ['hue', 45], ['sat', 1.4], ['bright', 0.3]] },
  'dungeon-basalt': { wall: [['sepia', 0.9], ['hue', -25], ['sat', 2.6], ['bright', 0.48]], cave: [['sepia', 0.9], ['hue', -25], ['sat', 2.2], ['bright', 0.26]] },
};

/** A CSS filter function as a colour matrix (Filter Effects spec). */
function matrix([f, a]: F): number[] {
  if (f === 'bright') return [a, 0, 0, 0, a, 0, 0, 0, a];
  if (f === 'sepia') {
    const b = 1 - a;
    return [0.393 + 0.607 * b, 0.769 - 0.769 * b, 0.189 - 0.189 * b, 0.349 - 0.349 * b, 0.686 + 0.314 * b, 0.168 - 0.168 * b, 0.272 - 0.272 * b, 0.534 - 0.534 * b, 0.131 + 0.869 * b];
  }
  if (f === 'sat') return [0.213 + 0.787 * a, 0.715 - 0.715 * a, 0.072 - 0.072 * a, 0.213 - 0.213 * a, 0.715 + 0.285 * a, 0.072 - 0.072 * a, 0.213 - 0.213 * a, 0.715 - 0.715 * a, 0.072 + 0.928 * a];
  const r = (a * Math.PI) / 180;
  const c = Math.cos(r);
  const s = Math.sin(r);
  return [
    0.213 + c * 0.787 - s * 0.213, 0.715 - c * 0.715 - s * 0.715, 0.072 - c * 0.072 + s * 0.928,
    0.213 - c * 0.213 + s * 0.143, 0.715 + c * 0.285 + s * 0.14, 0.072 - c * 0.072 - s * 0.283,
    0.213 - c * 0.213 - s * 0.787, 0.715 - c * 0.715 + s * 0.715, 0.072 + c * 0.928 + s * 0.072,
  ];
}
/** Tints a canvas in place, function after function (clamped between them, as the browser does). */
function tint(cv: HTMLCanvasElement, fs: F[]) {
  const ctx = cv.getContext('2d')!;
  const im = ctx.getImageData(0, 0, cv.width, cv.height);
  const d = im.data;
  const ms = fs.map(matrix);
  for (let i = 0; i < d.length; i += 4) {
    let r = d[i] / 255;
    let g = d[i + 1] / 255;
    let b = d[i + 2] / 255;
    for (const m of ms) {
      const R = m[0] * r + m[1] * g + m[2] * b;
      const G = m[3] * r + m[4] * g + m[5] * b;
      const B = m[6] * r + m[7] * g + m[8] * b;
      r = Math.min(1, Math.max(0, R));
      g = Math.min(1, Math.max(0, G));
      b = Math.min(1, Math.max(0, B));
    }
    d[i] = r * 255;
    d[i + 1] = g * 255;
    d[i + 2] = b * 255;
  }
  ctx.putImageData(im, 0, 0);
}

let stone: Promise<HTMLImageElement> | null = null;
function stoneImage(): Promise<HTMLImageElement> {
  stone ??= new Promise((res, rej) => {
    const im = new Image();
    im.onload = () => res(im);
    im.onerror = rej;
    im.src = STONE_SVG;
  });
  return stone;
}

/** The tinted stone, P pixels square, shifted by (dx, dy) quarters as the tiles were (backgroundPosition). */
function stamp(im: HTMLImageElement, P: number, fs: F[], dx: number, dy: number): HTMLCanvasElement {
  const cv = document.createElement('canvas');
  cv.width = cv.height = P;
  const ctx = cv.getContext('2d')!;
  ctx.fillStyle = STONE_BG;
  ctx.fillRect(0, 0, P, P);
  const ox = (dx * P) / 4;
  const oy = (dy * P) / 4;
  for (const sx of [ox - P, ox]) for (const sy of [oy - P, oy]) ctx.drawImage(im, sx, sy, P, P);
  tint(cv, fs);
  return cv;
}

/** The tinted stamps made so far (by size, biome and shift): made once a visit, not at every change. */
const STAMPS = new Map<string, HTMLCanvasElement>();
/** How many columns each canvas holds (a few canvases, not one huge one). */
const STRIP = 40;

export const DungeonRock = memo(function DungeonRock({ isl, T }: { isl: Island; T: number }) {
  const boxes = useRef<(HTMLCanvasElement | null)[]>([]);
  /** What the canvases show now (to draw again only the cells that changed: a block mined, a door opened). */
  const drawn = useRef<{ isl: Island; P: number } | null>(null);
  useEffect(() => {
    let gone = false;
    void stoneImage().then((im) => {
      if (gone) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      const P = Math.max(1, Math.round(T * dpr));
      const get = (wall: string, cave: boolean, h: number) => {
        const t = TINT[wall] ?? TINT['dungeon-brick'];
        const key = cave ? `${P}:${wall}:c` : `${P}:${wall}:${h % 4}:${(h >> 3) % 4}`;
        let s = STAMPS.get(key);
        if (!s) {
          s = cave ? stamp(im, P, t.cave, 0, 0) : stamp(im, P, t.wall, h % 4, (h >> 3) % 4);
          STAMPS.set(key, s);
        }
        return s;
      };
      const ground = (x: number, y: number) => x >= 0 && x < ISLAND.w && (y >= ISLAND.h || (y >= 0 && isSolid(fgAt(isl, idx(x, y)))));
      const r = P * 0.3;
      const cell = (ctx: CanvasRenderingContext2D, x: number, y: number, x0: number) => {
        const id = fgAt(isl, idx(x, y));
        const px = (x - x0) * P;
        const py = y * P;
        // The room's back wall under everything (open, an ore drawn as a tile over it, a free-standing top).
        ctx.drawImage(get(biomeAt(y).wall, true, 0), px, py);
        if (!id || kindOf(id) !== 'natural' || !id.startsWith('dungeon-')) return;
        const tile = get(id, false, cellHash(x, y));
        const up = !ground(x, y - 1);
        if (up && (!ground(x - 1, y) || !ground(x + 1, y))) {
          // Its top corners rounded where it stands free.
          ctx.save();
          ctx.beginPath();
          const rl = ground(x - 1, y) ? 0 : r;
          const rr = ground(x + 1, y) ? 0 : r;
          ctx.moveTo(px, py + P);
          ctx.lineTo(px, py + rl);
          ctx.arcTo(px, py, px + rl, py, rl);
          ctx.lineTo(px + P - rr, py);
          ctx.arcTo(px + P, py, px + P, py + rr, rr);
          ctx.lineTo(px + P, py + P);
          ctx.closePath();
          ctx.clip();
          ctx.drawImage(tile, px, py);
          ctx.restore();
        } else ctx.drawImage(tile, px, py);
        // Its open sides shaded.
        if (!ground(x - 1, y)) {
          ctx.fillStyle = '#0002';
          ctx.fillRect(px, py, P * 0.12, P);
        }
        if (!ground(x + 1, y)) {
          ctx.fillStyle = '#0003';
          ctx.fillRect(px + P - P * 0.12, py, P * 0.12, P);
        }
        if (!ground(x, y + 1)) {
          ctx.fillStyle = '#0003';
          ctx.fillRect(px, py + P - P * 0.1, P, P * 0.1);
        }
      };
      const before = drawn.current;
      if (before && before.P === P && before.isl.world === isl.world && boxes.current.every((cv, s) => !cv || cv.width === Math.min(STRIP, ISLAND.w - s * STRIP) * P)) {
        // Only what changed, and the cells around it (their edges and corners depend on it).
        const keys = new Set([...Object.keys(before.isl.fg), ...Object.keys(isl.fg)]);
        const todo = new Set<number>();
        for (const k of keys) {
          const c = Number(k);
          if (fgAt(before.isl, c) === fgAt(isl, c)) continue;
          const { x, y } = { x: c % ISLAND.w, y: Math.floor(c / ISLAND.w) };
          for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (x + dx >= 0 && x + dx < ISLAND.w && y + dy >= 0 && y + dy < ISLAND.h) todo.add(idx(x + dx, y + dy));
        }
        for (const c of todo) {
          const x = c % ISLAND.w;
          const y = Math.floor(c / ISLAND.w);
          const s = Math.floor(x / STRIP);
          const ctx = boxes.current[s]?.getContext('2d');
          if (ctx) cell(ctx, x, y, s * STRIP);
        }
      } else
        for (let s = 0; s * STRIP < ISLAND.w; s++) {
          const cv = boxes.current[s];
          if (!cv) continue;
          const x0 = s * STRIP;
          const cols = Math.min(STRIP, ISLAND.w - x0);
          cv.width = cols * P;
          cv.height = ISLAND.h * P;
          const ctx = cv.getContext('2d')!;
          for (let y = 0; y < ISLAND.h; y++) for (let x = x0; x < x0 + cols; x++) cell(ctx, x, y, x0);
        }
      drawn.current = { isl, P };
    });
    return () => {
      gone = true;
    };
  }, [isl, T]);
  const strips = Math.ceil(ISLAND.w / STRIP);
  return (
    <>
      {Array.from({ length: strips }, (_, s) => (
        <canvas
          key={s}
          ref={(el) => {
            boxes.current[s] = el;
          }}
          className="pointer-events-none absolute"
          style={{ left: s * STRIP * T, top: 0, width: Math.min(STRIP, ISLAND.w - s * STRIP) * T, height: ISLAND.h * T }}
        />
      ))}
    </>
  );
});

