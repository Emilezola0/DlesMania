// Friends → Daily Doodle: pick a franchise and one of its characters, draw them in 10, 20 or 30 seconds (the less time, the more it pays); friends see the
// drawing (played back stroke by stroke) and guess who it is, 3 tries each. A right guess pays the guesser, and
// the artist more for every friend who got it (src/cloud/doodles.ts, the numbers in economy.json `doodle`).
import { useEffect, useMemo, useRef, useState } from 'react';
import type { DoodleDoc, GuessDoc, Stroke } from '../cloud/doodles';
import type { ScoreDoc } from '../cloud/friends';
import { DleCoin } from '../components/DleCoin';
import T from '../data/tuning/economy.json';
import { COLLECTIBLE, SETS, type Card } from '../gacha/cards';
import { addDays, todayKey } from '../lib/date';
import { celebrate } from '../lib/fx';
import { sfx } from '../lib/sfx';
import { useProgress } from '../store/progress';

const D = T.doodle;
type DoodleTime = (typeof D.times)[number];
/** A drawing's time and what it pays (a drawing from before there was a choice: the first, 10 seconds). */
const timeOf = (secs?: number): DoodleTime => D.times.find((t) => t.seconds === secs) ?? D.times[0];
const cloud = () => import('../cloud/doodles');

/** The pens: colours and widths (a share of the drawing's width). */
export const INKS = ['#111827', '#ffffff', '#ef4444', '#f97316', '#facc15', '#22c55e', '#3b82f6', '#a855f7', '#92400e', '#fcd5b5'];
export const WIDTHS = [0.012, 0.028, 0.06];

/** The characters a franchise can be drawn as: its cards that are someone (not places or techniques), by name. */
const BY_SET = new Map<string, Card[]>();
for (const c of COLLECTIBLE) if (!c.place && !c.technique) BY_SET.set(c.set, [...(BY_SET.get(c.set) ?? []), c]);
export const namesOf = (set: string) => [...new Set((BY_SET.get(set) ?? []).map((c) => c.name))].sort((a, b) => a.localeCompare(b));
export const cardNamed = (set: string, name: string) => (BY_SET.get(set) ?? []).find((c) => c.name === name);
/** The franchises to draw from: ones with characters (not the Japanese words). */
export const FRANCHISES = SETS.filter((s) => s.id !== 'jlpt' && namesOf(s.id).length >= 8).sort((a, b) => a.franchise.localeCompare(b.franchise));
export const franchiseOf = (set: string) => SETS.find((s) => s.id === set)?.franchise ?? set;

type Raw = { c: number; w: number; pts: [number, number][] };
/** A stroke's width index that means "fill": the bucket, poured at its one point (a stroke like any other, so drawings keep their shape). */
export const FILL = 9;

const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));

/**
 * The bucket: fills the area around (x, y) (0 to 1) that has the colour found there, up to the lines around it, then
 * one pixel more so the soft edges of the lines leave no pale ring.
 */
export function floodFill(canvas: HTMLCanvasElement, x: number, y: number, color: string) {
  const g = canvas.getContext('2d')!;
  const W = canvas.width;
  const H = canvas.height;
  const img = g.getImageData(0, 0, W, H);
  const d = img.data;
  const sx = Math.min(W - 1, Math.max(0, Math.round(x * W)));
  const sy = Math.min(H - 1, Math.max(0, Math.round(y * H)));
  const i0 = (sy * W + sx) * 4;
  const [tr, tg, tb] = [d[i0], d[i0 + 1], d[i0 + 2]];
  const [fr, fg, fb] = rgb(color);
  if (Math.abs(fr - tr) + Math.abs(fg - tg) + Math.abs(fb - tb) < 8) return;
  const near = (k: number) => Math.abs(d[k * 4] - tr) + Math.abs(d[k * 4 + 1] - tg) + Math.abs(d[k * 4 + 2] - tb) <= 90;
  const mask = new Uint8Array(W * H);
  const stack = [sx, sy];
  while (stack.length) {
    const py = stack.pop()!;
    let px = stack.pop()!;
    if (mask[py * W + px]) continue;
    while (px > 0 && !mask[py * W + px - 1] && near(py * W + px - 1)) px--;
    let up = false;
    let down = false;
    for (; px < W && !mask[py * W + px] && near(py * W + px); px++) {
      mask[py * W + px] = 1;
      if (py > 0) {
        const k = (py - 1) * W + px;
        const open = !mask[k] && near(k);
        if (open && !up) stack.push(px, py - 1);
        up = open;
      }
      if (py < H - 1) {
        const k = (py + 1) * W + px;
        const open = !mask[k] && near(k);
        if (open && !down) stack.push(px, py + 1);
        down = open;
      }
    }
  }
  const paintPx = (j: number) => {
    d[j * 4] = fr;
    d[j * 4 + 1] = fg;
    d[j * 4 + 2] = fb;
    d[j * 4 + 3] = 255;
  };
  for (let k = 0; k < W * H; k++) {
    if (!mask[k]) continue;
    const px = k % W;
    paintPx(k);
    if (px > 0) paintPx(k - 1);
    if (px < W - 1) paintPx(k + 1);
    if (k >= W) paintPx(k - W);
    if (k < W * H - W) paintPx(k + W);
  }
  g.putImageData(img, 0, 0);
}

/** Draws the points numbered `from` to `to` (counting every stroke's points in order) on top of what's there. */
export function paintRange(canvas: HTMLCanvasElement, strokes: Raw[], from: number, to: number) {
  const g = canvas.getContext('2d')!;
  const W = canvas.width;
  g.lineCap = 'round';
  g.lineJoin = 'round';
  let o = 0;
  for (const s of strokes) {
    if (o >= to) break;
    const color = INKS[s.c] ?? INKS[0];
    if (s.w === FILL) {
      if (o >= from && s.pts[0]) floodFill(canvas, s.pts[0][0], s.pts[0][1], color);
      o += s.pts.length;
      continue;
    }
    g.strokeStyle = color;
    g.fillStyle = color;
    g.lineWidth = (WIDTHS[s.w] ?? WIDTHS[1]) * W;
    for (let k = Math.max(0, from - o); k < s.pts.length && o + k < to; k++) {
      g.beginPath();
      if (k === 0) {
        if (s.pts.length > 1) continue;
        g.arc(s.pts[0][0] * W, s.pts[0][1] * W, g.lineWidth / 2, 0, Math.PI * 2);
        g.fill();
        continue;
      }
      g.moveTo(s.pts[k - 1][0] * W, s.pts[k - 1][1] * W);
      g.lineTo(s.pts[k][0] * W, s.pts[k][1] * W);
      g.stroke();
    }
    o += s.pts.length;
  }
}

/** Paints strokes on a blank canvas, up to `upTo` points in all (Infinity: the whole drawing). */
export function paint(canvas: HTMLCanvasElement, strokes: Raw[], upTo = Infinity) {
  const g = canvas.getContext('2d')!;
  g.fillStyle = '#fffdf7';
  g.fillRect(0, 0, canvas.width, canvas.height);
  paintRange(canvas, strokes, 0, upTo);
}

/** A drawing played back stroke by stroke, as it was drawn (again on a tap); the bucket's fills pour in their turn. */
export function Replay({ strokes, className = '' }: { strokes: Stroke[]; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [run, setRun] = useState(0);
  const [unpacked, setUnpacked] = useState<Raw[]>([]);
  useEffect(() => {
    void cloud().then((c) => setUnpacked(strokes.map((s) => ({ c: s.c, w: s.w, pts: c.unpack(s.p) }))));
  }, [strokes]);
  useEffect(() => {
    const c = ref.current;
    if (!c || !unpacked.length) return;
    const total = unpacked.reduce((t, s) => t + s.pts.length, 0);
    paint(c, []);
    let done = 0;
    const t0 = performance.now();
    let raf = 0;
    const step = (now: number) => {
      const n = Math.min(total, Math.ceil((total * (now - t0)) / 2600));
      if (n > done) paintRange(c, unpacked, done, n);
      done = Math.max(done, n);
      if (n < total) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    // Shown whole at once if animation frames don't come (a hidden tab).
    const fallback = window.setTimeout(() => {
      if (done < total) {
        done = total;
        paint(c, unpacked);
      }
    }, 3000);
    return () => (cancelAnimationFrame(raf), window.clearTimeout(fallback));
  }, [unpacked, run]);
  return (
    <button type="button" onClick={() => setRun((r) => r + 1)} title="Play it again" className={`block overflow-hidden rounded-md border border-rule-strong ${className}`}>
      <canvas ref={ref} width={480} height={480} className="block aspect-square w-full" />
    </button>
  );
}

/** A drawing pad's pens and strokes: draws as the finger moves (only what's new), or pours the bucket on a tap. */
export function usePad(limit = 380) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const strokes = useRef<Raw[]>([]);
  const drawing = useRef(false);
  /** Strokes taken back (Ctrl + Z), the last one on top: Ctrl + Y puts them back, a new stroke forgets them. */
  const undone = useRef<Raw[]>([]);
  /** Bumped when the strokes change, so the undo and redo buttons know. */
  const [, setVersion] = useState(0);
  const changed = () => setVersion((v) => v + 1);
  const [ink, setInk] = useState(0);
  const [width, setWidth] = useState(1);
  const [bucket, setBucket] = useState(false);
  const total = () => strokes.current.reduce((t, s) => t + s.pts.length, 0);
  const at = (e: React.PointerEvent<HTMLCanvasElement>): [number, number] => {
    const r = e.currentTarget.getBoundingClientRect();
    return [Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), Math.min(1, Math.max(0, (e.clientY - r.top) / r.height))];
  };
  /** The canvas's pointer handlers; nothing happens unless `active` (the clock is running). */
  const handlers = (active: boolean) => ({
    onPointerDown: (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (!active || strokes.current.length >= limit) return;
      const n = total();
      undone.current = [];
      if (bucket) {
        strokes.current.push({ c: ink, w: FILL, pts: [at(e)] });
        paintRange(e.currentTarget, strokes.current, n, n + 1);
        changed();
        return;
      }
      e.currentTarget.setPointerCapture(e.pointerId);
      drawing.current = true;
      strokes.current.push({ c: ink, w: width, pts: [at(e)] });
      paintRange(e.currentTarget, strokes.current, n, n + 1);
    },
    onPointerMove: (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (!drawing.current || !active) return;
      const s = strokes.current[strokes.current.length - 1];
      const p = at(e);
      const last = s.pts[s.pts.length - 1];
      if (Math.hypot(p[0] - last[0], p[1] - last[1]) < 0.004) return;
      s.pts.push(p);
      const n = total();
      paintRange(e.currentTarget, strokes.current, n - 1, n);
    },
    onPointerUp: () => {
      if (drawing.current) changed();
      drawing.current = false;
    },
    onPointerCancel: () => {
      if (drawing.current) changed();
      drawing.current = false;
    },
  });
  /** A blank page. */
  const reset = () => {
    strokes.current = [];
    undone.current = [];
    drawing.current = false;
    if (canvas.current) paint(canvas.current, []);
    changed();
  };
  const stop = () => void (drawing.current = false);
  /** Takes the last stroke (or fill) back, or puts the last one taken back again; not in the middle of a stroke. */
  const undo = () => {
    const s = strokes.current;
    if (drawing.current || !s.length) return false;
    undone.current.push(s.pop()!);
    if (canvas.current) paint(canvas.current, s);
    changed();
    return true;
  };
  const redo = () => {
    if (drawing.current || !undone.current.length || strokes.current.length >= limit) return false;
    strokes.current.push(undone.current.pop()!);
    if (canvas.current) paint(canvas.current, strokes.current);
    changed();
    return true;
  };
  const canUndo = strokes.current.length > 0;
  const canRedo = undone.current.length > 0;
  return { canvas, strokes, handlers, reset, stop, undo, redo, canUndo, canRedo, ink, setInk, width, setWidth, bucket, setBucket };
}

/**
 * The keyboard's shortcuts for the pens (on a computer): the top row of letters picks a colour (by where the key is,
 * so A Z E R T Y… on a French keyboard, Q W E R T Y… on an English one), 1 2 3 the pen's width, 4 the bucket. The
 * wheel over the drawing (or the pens) turns through the colours; with Shift held, through the widths.
 */
const COLOUR_KEYS = ['KeyQ', 'KeyW', 'KeyE', 'KeyR', 'KeyT', 'KeyY', 'KeyU', 'KeyI', 'KeyO', 'KeyP'];
const TOOL_KEYS = ['Digit1', 'Digit2', 'Digit3', 'Digit4'];
/** What's printed on those keys: the keyboard's own letters where the browser tells them (Chrome), else a guess from the language (Firefox). */
function useKeyLabels() {
  const guess = (typeof navigator !== 'undefined' && /^fr|^be/i.test(navigator.language) ? 'AZERTYUIOP' : 'QWERTYUIOP').split('');
  const [labels, setLabels] = useState(guess);
  useEffect(() => {
    const kb = (navigator as Navigator & { keyboard?: { getLayoutMap?: () => Promise<Map<string, string>> } }).keyboard;
    kb?.getLayoutMap?.()
      .then((m) => setLabels(COLOUR_KEYS.map((code, k) => (m.get(code) ?? guess[k]).toUpperCase())))
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return labels;
}
const typing = (t: EventTarget | null) => t instanceof HTMLElement && (t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName));

/** The pad's tools: colours, the pen's widths, and the bucket, with their keys and the wheel on a computer. */
export function PenBar({ pad, history = true }: { pad: ReturnType<typeof usePad>; history?: boolean }) {
  const labels = useKeyLabels();
  const bar = useRef<HTMLDivElement>(null);
  // The latest pens, for the listeners added once.
  const now = useRef(pad);
  now.current = pad;
  const pickInk = (k: number) => (now.current.ink !== k && sfx.select(), now.current.setInk(k));
  const pickTool = (k: number) => {
    sfx.select();
    if (k === WIDTHS.length) return now.current.setBucket(true);
    now.current.setWidth(k);
    now.current.setBucket(false);
  };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (typing(e.target)) return;
      // Ctrl + Z takes the last stroke back, Ctrl + Y (or Ctrl + Shift + Z) puts it back; Cmd on a Mac. By the letter
      // printed on the key, as everywhere else.
      if ((e.ctrlKey || e.metaKey) && !e.altKey) {
        const k = e.key.toLowerCase();
        const redo = k === 'y' || (k === 'z' && e.shiftKey);
        if (k !== 'z' && k !== 'y') return;
        e.preventDefault();
        if (!history) return;
        if (redo ? now.current.redo() : now.current.undo()) sfx.click();
        return;
      }
      if (e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
      const ink = COLOUR_KEYS.indexOf(e.code);
      const tool = TOOL_KEYS.indexOf(e.code.replace('Numpad', 'Digit'));
      if (ink >= 0) pickInk(ink);
      else if (tool >= 0) pickTool(tool);
      else return;
      e.preventDefault();
    };
    // Over the drawing or the pens, the wheel turns the pens instead of the page.
    const onWheel = (e: WheelEvent) => {
      if (!e.deltaY) return;
      e.preventDefault();
      const dir = e.deltaY > 0 ? 1 : -1;
      const p = now.current;
      if (e.shiftKey) {
        const at = p.bucket ? WIDTHS.length : p.width;
        pickTool((at + dir + WIDTHS.length + 1) % (WIDTHS.length + 1));
      } else pickInk((p.ink + dir + INKS.length) % INKS.length);
    };
    const places: HTMLElement[] = [];
    if (bar.current) places.push(bar.current);
    if (pad.canvas.current) places.push(pad.canvas.current);
    window.addEventListener('keydown', onKey);
    for (const el of places) el.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      window.removeEventListener('keydown', onKey);
      for (const el of places) el.removeEventListener('wheel', onWheel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const key = (k: string) => <kbd className="pointer-events-none absolute -bottom-1.5 -right-1.5 hidden min-w-4 rounded border border-rule-strong bg-card px-0.5 text-center font-mono text-[9px] font-bold leading-[14px] text-ink-soft pointer-fine:block">{k}</kbd>;
  return (
    <div ref={bar} className="space-y-1">
      <div className="flex flex-wrap items-center gap-1.5">
        {INKS.map((c, k) => (
          <button key={c} type="button" onClick={() => pickInk(k)} aria-label={`Colour ${k + 1} (key ${labels[k]})`} aria-pressed={pad.ink === k} className={`relative size-7 rounded-full border-2 ${pad.ink === k ? 'scale-110 border-accent' : 'border-rule-strong'}`} style={{ background: c }}>
            {key(labels[k])}
          </button>
        ))}
        <span className="mx-1 h-6 w-px bg-rule" />
        {WIDTHS.map((w, k) => (
          <button key={w} type="button" onClick={() => pickTool(k)} aria-label={`${['Thin pen', 'Medium pen', 'Thick pen'][k]} (key ${k + 1})`} aria-pressed={!pad.bucket && pad.width === k} className={`relative grid size-8 place-items-center rounded-md border ${!pad.bucket && pad.width === k ? 'border-accent bg-tile' : 'border-rule-strong'}`}>
            <span className="rounded-full bg-ink" style={{ width: 4 + k * 5, height: 4 + k * 5 }} />
            {key(String(k + 1))}
          </button>
        ))}
        <button type="button" onClick={() => pickTool(WIDTHS.length)} aria-label={`Bucket: fill an area (key ${WIDTHS.length + 1})`} title="Bucket: tap inside a shape to fill it" aria-pressed={pad.bucket} className={`relative grid size-8 place-items-center rounded-md border text-base ${pad.bucket ? 'border-accent bg-tile' : 'border-rule-strong'}`}>
          🪣
          {key(String(WIDTHS.length + 1))}
        </button>
        {history && (
          <>
            <span className="mx-1 h-6 w-px bg-rule" />
            <button type="button" onClick={() => pad.undo() && sfx.click()} disabled={!pad.canUndo} aria-label="Undo the last stroke (Ctrl + Z)" title="Undo (Ctrl + Z)" className="grid size-8 place-items-center rounded-md border border-rule-strong text-base font-bold disabled:opacity-30">
              ↶
            </button>
            <button type="button" onClick={() => pad.redo() && sfx.click()} disabled={!pad.canRedo} aria-label="Redo (Ctrl + Y)" title="Redo (Ctrl + Y)" className="grid size-8 place-items-center rounded-md border border-rule-strong text-base font-bold disabled:opacity-30">
              ↷
            </button>
          </>
        )}
      </div>
      <p className="hidden text-[11px] text-ink-faint pointer-fine:block">
        Keys: {labels.join(' ')} for the colours, 1 2 3 for the pen, 4 for the bucket{history ? ', Ctrl + Z to undo, Ctrl + Y to redo' : ''}. Wheel: colour (Shift + wheel: pen).
      </p>
    </div>
  );
}

/** The pen chosen, as a stroke on paper: what the first line will look like. */
function PenPreview({ pad }: { pad: ReturnType<typeof usePad> }) {
  const ink = INKS[pad.ink] ?? INKS[0];
  return (
    <svg viewBox="0 0 240 60" className="h-14 w-full rounded-md border border-rule-strong bg-[#fffdf7]" aria-hidden>
      {pad.bucket ? (
        <path d="M30 10 h180 v40 h-180 z" fill={ink} stroke="#111827" strokeWidth={2} />
      ) : (
        <path d="M20 40 C 60 5, 90 55, 130 30 S 200 15, 220 35" fill="none" stroke={ink} strokeWidth={WIDTHS[pad.width] * 240} strokeLinecap="round" />
      )}
    </svg>
  );
}

/** A small picture of a card, to draw from (or to see who it was). */
export function CardPic({ card, className = '' }: { card?: Card; className?: string }) {
  if (!card?.image) return null;
  return <img src={card.image} alt={card.name} loading="lazy" className={`rounded-md border border-rule object-cover ${className}`} />;
}

type DrawStep = 'pick' | 'count' | 'drawing' | 'done' | 'posted';

/** Your drawing of the day: pick, draw against the clock, post. */
function DrawPanel({ demo, posted, onPosted }: { demo: boolean; posted: DoodleDoc | null; onPosted: (d: DoodleDoc) => void }) {
  const [set, setSet] = useState(FRANCHISES[0]?.id ?? '');
  const names = useMemo(() => namesOf(set), [set]);
  const [ideas, setIdeas] = useState<string[]>([]);
  const [who, setWho] = useState('');
  const [step, setStep] = useState<DrawStep>(posted ? 'posted' : 'pick');
  const [count, setCount] = useState(3);
  const [secs, setSecs] = useState(D.times[0].seconds);
  const [left, setLeft] = useState(secs);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pad = usePad();
  const { strokes, canvas } = pad;

  useEffect(() => {
    if (posted) setStep('posted');
  }, [posted]);
  // Four characters to pick from, again with each franchise (or a shuffle).
  const shuffle = () => setIdeas([...names].sort(() => Math.random() - 0.5).slice(0, 4));
  useEffect(() => {
    shuffle();
    setWho('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [names]);

  // 3, 2, 1… then the clock.
  useEffect(() => {
    if (step !== 'count') return;
    if (count <= 0) {
      pad.reset();
      setLeft(secs);
      setStep('drawing');
      sfx.whoosh();
      return;
    }
    sfx.tick();
    const t = window.setTimeout(() => setCount((c) => c - 1), 700);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, count]);
  useEffect(() => {
    if (step !== 'drawing') return;
    const end = Date.now() + secs * 1000;
    const t = window.setInterval(() => {
      const s = Math.max(0, (end - Date.now()) / 1000);
      setLeft(s);
      if (s <= 0) {
        window.clearInterval(t);
        pad.stop();
        sfx.wrong();
        setStep('done');
      }
    }, 100);
    return () => window.clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);
  useEffect(() => {
    if ((step === 'drawing' || step === 'done') && canvas.current) paint(canvas.current, strokes.current);
  }, [step]);


  const post = async () => {
    setBusy(true);
    setError(null);
    try {
      const c = await cloud();
      const packed: Stroke[] = strokes.current.map((s) => ({ c: s.c, w: s.w, p: c.pack(s.pts) }));
      const d = demo
        ? { uid: 'demo-0', name: 'You', day: todayKey(), set, secs, answer: await c.answerHash(`demo-0_${todayKey()}`, who), strokes: packed, solvers: [], at: Date.now() }
        : await c.postDoodle(todayKey(), set, who, packed, secs);
      sfx.victory();
      celebrate();
      onPosted(d);
    } catch (e) {
      sfx.wrong();
      setError((e as { code?: string })?.code === 'permission-denied' ? "The Daily Doodle isn't switched on in the database yet: its rules need the doodles section (firestore.rules) published." : e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  if (step === 'posted' && posted) return <MyDrawing d={posted} />;

  const card = who ? cardNamed(set, who) : undefined;
  if (step === 'pick')
    return (
      <div className="space-y-3">
        <label className="block text-sm">
          <span className="mb-1 block text-xs uppercase tracking-widest text-ink-faint">1 · A franchise</span>
          <select value={set} onChange={(e) => setSet(e.target.value)} className="w-full rounded-md border border-rule-strong bg-card px-3 py-2 font-semibold">
            {FRANCHISES.map((s) => (
              <option key={s.id} value={s.id}>
                {s.franchise}
              </option>
            ))}
          </select>
        </label>
        <div className="text-sm">
          <span className="mb-1 flex items-center justify-between text-xs uppercase tracking-widest text-ink-faint">
            2 · Who to draw
            <button type="button" onClick={() => (sfx.select(), shuffle())} className="normal-case tracking-normal text-accent">
              ↻ Other ideas
            </button>
          </span>
          <div className="flex flex-wrap gap-1.5">
            {ideas.map((n) => (
              <button key={n} type="button" onClick={() => (sfx.select(), setWho(n))} aria-pressed={who === n} className={`rounded-full border px-3 py-1 font-semibold ${who === n ? 'border-accent bg-accent text-white' : 'border-rule-strong hover:bg-tile'}`}>
                {n}
              </button>
            ))}
          </div>
          <input list="doodle-names" value={who} onChange={(e) => setWho(e.target.value)} placeholder="…or type any of them" className="mt-2 w-full rounded-md border border-rule-strong bg-card px-3 py-2" />
          <datalist id="doodle-names">
            {names.map((n) => (
              <option key={n} value={n} />
            ))}
          </datalist>
        </div>
        {card && (
          <div className="flex items-center gap-3 rounded-md bg-tile p-2">
            <CardPic card={card} className="h-20 w-16" />
            <p className="text-sm">
              <b>{card.name}</b>: you&apos;ll have <b>{secs} seconds</b> to draw them. Your friends see only the drawing and the franchise.
            </p>
          </div>
        )}
        <div className="text-sm">
          <span className="mb-1 block text-xs uppercase tracking-widest text-ink-faint">3 · Your time: the less, the more it pays</span>
          <div className="grid grid-cols-3 gap-1.5">
            {D.times.map((t) => (
              <button key={t.seconds} type="button" onClick={() => (sfx.select(), setSecs(t.seconds))} aria-pressed={secs === t.seconds} className={`rounded-md border px-2 py-1.5 text-center ${secs === t.seconds ? 'border-accent bg-accent text-white' : 'border-rule-strong hover:bg-tile'}`}>
                <span className="block font-display text-lg font-black">{t.seconds} s</span>
                <span className={`block text-[11px] leading-tight ${secs === t.seconds ? 'text-white/85' : 'text-ink-soft'}`}>
                  you {t.artist} a friend · them up to {t.guess[0]}
                </span>
              </button>
            ))}
          </div>
        </div>
        <div className="space-y-1.5 text-sm">
          <span className="block text-xs uppercase tracking-widest text-ink-faint">4 · Your pen to start with (you can change it while drawing)</span>
          <PenBar pad={pad} history={false} />
          <PenPreview pad={pad} />
        </div>
        <button
          type="button"
          disabled={!names.includes(who)}
          onClick={() => {
            setCount(3);
            setStep('count');
          }}
          className="btn-accent w-full rounded-md px-4 py-2.5 font-display font-bold disabled:opacity-40"
        >
          🎨 Draw!
        </button>
      </div>
    );

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <CardPic card={card} className="h-14 w-11" />
        <div className="min-w-0 flex-1">
          <p className="truncate font-display font-bold">{who}</p>
          <div className="mt-1 h-2 overflow-hidden rounded-full bg-tile">
            <div className={`h-full rounded-full ${left < 3 ? 'bg-coral' : 'bg-accent'}`} style={{ width: `${(step === 'drawing' ? left / secs : step === 'count' ? 1 : 0) * 100}%`, transition: 'width 0.1s linear' }} />
          </div>
        </div>
        <span className="w-12 text-right font-display text-2xl font-black tabular-nums">{step === 'count' ? count : Math.ceil(left)}</span>
      </div>
      <div className="relative">
        <canvas ref={canvas} width={480} height={480} {...pad.handlers(step === 'drawing')} className="block aspect-square w-full touch-none rounded-md border-2 border-rule-strong bg-[#fffdf7]" />
        {step === 'count' && <div className="absolute inset-0 grid place-items-center rounded-md bg-black/40 font-display text-7xl font-black text-white">{count}</div>}
      </div>
      {(step === 'count' || step === 'drawing') && <PenBar pad={pad} />}
      {step === 'done' && (
        <div className="space-y-2">
          <p className="text-center font-display text-lg font-bold">⏰ Time&apos;s up!</p>
          {error && <p className="rounded-md border border-coral/50 bg-coral/10 p-2 text-sm font-semibold text-coral">{error}</p>}
          <div className="flex gap-2">
            <button type="button" onClick={() => setStep('pick')} className="btn-paper flex-1 rounded-md px-3 py-2 font-semibold">
              Start again
            </button>
            <button type="button" disabled={busy || !strokes.current.length} onClick={() => void post()} className="btn-accent flex-1 rounded-md px-3 py-2 font-display font-bold disabled:opacity-40">
              {busy ? 'Posting…' : 'Show my friends'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/** Your posted drawing: who got it, what it earned. */
function MyDrawing({ d }: { d: DoodleDoc }) {
  return (
    <div className="space-y-2">
      <Replay strokes={d.strokes} className="mx-auto max-w-xs" />
      <p className="text-center text-sm">
        Today&apos;s drawing is up ({franchiseOf(d.set)}).{' '}
        {d.solvers.length ? (
          <>
            <b>{d.solvers.length}</b> {d.solvers.length === 1 ? 'friend has' : 'friends have'} guessed it: +{(d.solvers.length * timeOf(d.secs).artist).toLocaleString('en')} <DleCoin className="inline size-3.5 align-[-2px]" />
          </>
        ) : (
          'Nobody has guessed it yet.'
        )}
      </p>
      <p className="text-center text-xs text-ink-faint">
        Drawn in {timeOf(d.secs).seconds} seconds: you get {timeOf(d.secs).artist} DleCoins for every friend who guesses it right. Come back tomorrow to draw another.
      </p>
    </div>
  );
}

/** A friend's drawing to guess: 3 tries, then who it was. */
function GuessCard({ d, artist, demo }: { d: DoodleDoc; artist?: ScoreDoc; demo: boolean }) {
  const names = useMemo(() => namesOf(d.set), [d.set]);
  const [guess, setGuess] = useState<GuessDoc | null>(null);
  const [loaded, setLoaded] = useState(demo);
  const [text, setText] = useState('');
  const [wrong, setWrong] = useState<string[]>([]);
  const [answer, setAnswer] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [paid, setPaid] = useState(0);
  const reward = useProgress((s) => s.rewardDoodleGuess);
  const pays = timeOf(d.secs);
  const done = !!guess && (guess.right || guess.tries >= D.tries);

  useEffect(() => {
    if (demo) return;
    void cloud()
      .then((c) => c.myGuess(d))
      .then((g) => setGuess(g))
      .finally(() => setLoaded(true));
  }, [d, demo]);
  // Once it's over: who it was.
  useEffect(() => {
    if (done && !answer) void cloud().then((c) => c.findAnswer(d, names).then(setAnswer));
  }, [done, answer, d, names]);

  const send = async () => {
    const name = names.find((n) => n.toLowerCase() === text.trim().toLowerCase());
    if (!name || done) return;
    setBusy(true);
    try {
      const c = await cloud();
      let next: GuessDoc;
      if (demo) next = { tries: (guess?.tries ?? 0) + 1, right: (await c.answerHash(c.doodleId(d.uid, d.day), name)) === d.answer, at: Date.now() };
      else next = await c.guessDoodle(d, guess, name);
      setGuess(next);
      setText('');
      if (next.right) {
        const coins = pays.guess[Math.min(next.tries, pays.guess.length) - 1] ?? 0;
        if (!demo) setPaid(reward(c.doodleId(d.uid, d.day), coins));
        else setPaid(coins);
        setAnswer(name);
        sfx.victory();
        celebrate();
      } else {
        setWrong((w) => [...w, name]);
        sfx.wrong();
      }
    } catch {
      sfx.wrong();
    } finally {
      setBusy(false);
    }
  };

  const triesLeft = D.tries - (guess?.tries ?? 0);
  const card = answer ? cardNamed(d.set, answer) : undefined;
  return (
    <div className="space-y-2 rounded-md border border-rule bg-card p-3">
      <div className="flex items-baseline justify-between gap-2">
        <p className="truncate font-display font-bold">{artist?.name ?? d.name}</p>
        <p className="shrink-0 text-xs text-ink-faint">{d.day === todayKey() ? 'Today' : 'Yesterday'}</p>
      </div>
      <p className="text-xs font-semibold uppercase tracking-wider text-accent">
        {franchiseOf(d.set)} <span className="text-ink-faint">· drawn in {pays.seconds} s</span>
      </p>
      <Replay strokes={d.strokes} />
      <p className="text-xs text-ink-faint">Guessed by {d.solvers.length} so far</p>
      {!loaded ? null : done ? (
        <div className="flex items-center gap-2 rounded-md bg-tile p-2">
          <CardPic card={card} className="h-14 w-11" />
          <div className="min-w-0 text-sm">
            <p className="font-display font-bold">{guess?.right ? `✅ ${answer ?? ''}` : `It was ${answer ?? '…'}`}</p>
            {guess?.right ? (
              <p className="text-ink-soft">
                {paid ? (
                  <>
                    +{paid} <DleCoin className="inline size-3.5 align-[-2px]" />, and {pays.artist} for {artist?.name ?? d.name}
                  </>
                ) : (
                  'Got it.'
                )}
              </p>
            ) : (
              <p className="text-ink-soft">No more guesses on this one.</p>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-1.5">
          <div className="flex gap-1.5">
            <input
              list={`doodle-guess-${d.uid}-${d.day}`}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && void send()}
              placeholder="Who is it?"
              className="min-w-0 flex-1 rounded-md border border-rule-strong bg-paper px-3 py-1.5"
            />
            <datalist id={`doodle-guess-${d.uid}-${d.day}`}>
              {names.map((n) => (
                <option key={n} value={n} />
              ))}
            </datalist>
            <button type="button" disabled={busy || !names.some((n) => n.toLowerCase() === text.trim().toLowerCase())} onClick={() => void send()} className="btn-accent rounded-md px-3 py-1.5 font-semibold disabled:opacity-40">
              Guess
            </button>
          </div>
          <p className="text-xs text-ink-soft">
            {triesLeft} {triesLeft === 1 ? 'guess' : 'guesses'} left · right on the {['first', 'second', 'third'][(guess?.tries ?? 0)] ?? 'next'} try: +{pays.guess[guess?.tries ?? 0] ?? 0} DleCoins
            {wrong.length > 0 && <span className="text-coral"> · not {wrong.join(', not ')}</span>}
          </p>
        </div>
      )}
    </div>
  );
}

/** Dev only (#/friends?demo): two friends' scribbles to guess (random lines, no real drawing), their answers among the real names. */
async function demoDoodles(friends: ScoreDoc[]): Promise<DoodleDoc[]> {
  const c = await cloud();
  const out: DoodleDoc[] = [];
  for (const [k, f] of friends.slice(0, 2).entries()) {
    const set = FRANCHISES[(k * 7) % FRANCHISES.length].id;
    const day = k ? addDays(todayKey(), -1) : todayKey();
    const strokes: Stroke[] = Array.from({ length: 6 }, (_, i) => {
      let x = 0.2 + Math.random() * 0.6;
      let y = 0.2 + Math.random() * 0.6;
      const pts: [number, number][] = Array.from({ length: 25 }, () => [(x = Math.min(0.95, Math.max(0.05, x + (Math.random() - 0.5) * 0.08))), (y = Math.min(0.95, Math.max(0.05, y + (Math.random() - 0.5) * 0.08)))]);
      return { c: i % INKS.length, w: i % 3, p: c.pack(pts) };
    });
    const answer = namesOf(set)[3];
    out.push({ uid: f.uid, name: f.name, day, set, secs: k ? 30 : 10, answer: await c.answerHash(c.doodleId(f.uid, day), answer), strokes, solvers: k ? ['demo-3'] : [], at: Date.now() - k * 1000 });
  }
  return out;
}

/** The Daily Doodle on the Friends page: draw, or guess the friends' drawings of today and yesterday. */
export function DailyDoodle({ me, friends, demo }: { me: ScoreDoc; friends: ScoreDoc[]; demo: boolean }) {
  const [tab, setTab] = useState<'guess' | 'draw'>('guess');
  const [mine, setMine] = useState<DoodleDoc | null>(null);
  const [theirs, setTheirs] = useState<DoodleDoc[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [earned, setEarned] = useState(0);
  const rewardArt = useProgress((s) => s.rewardDoodleArt);
  const today = todayKey();
  const days = useMemo(() => Array.from({ length: D.days }, (_, k) => addDays(today, -k)), [today]);
  const friendIds = me.friends.join(',');

  useEffect(() => {
    let live = true;
    void (async () => {
      try {
        if (demo) {
          const docs = await demoDoodles(friends);
          if (live) setTheirs(docs);
          return;
        }
        const c = await cloud();
        // My drawings of the last days: what friends who guessed them have earned me.
        const own = await Promise.all(days.map((d) => getMine(c, d)));
        let got = 0;
        for (const d of own) if (d) got += rewardArt(c.doodleId(d.uid, d.day), d.solvers.length, timeOf(d.secs).artist);
        if (!live) return;
        setMine(own[0]);
        setEarned(got);
        if (!own[0]) setTab('draw');
        const docs = await c.friendDoodles(me.friends, days);
        if (live) setTheirs(docs);
      } catch (e) {
        if (live) setError((e as { code?: string })?.code === 'permission-denied' ? "The Daily Doodle isn't switched on in the database yet: its rules need the doodles section (firestore.rules) published." : e instanceof Error ? e.message : String(e));
      }
    })();
    return () => void (live = false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demo, friendIds, today]);

  const byUid = new Map(friends.map((f) => [f.uid, f]));
  return (
    <section className="page space-y-4 rounded-md p-5">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="font-display text-lg font-bold">🎨 Daily Doodle</h2>
          <p className="text-sm text-ink-soft">
            Draw a character in {D.times.map((t) => t.seconds).join(', ').replace(/, (?=[^,]*$)/, ' or ')} seconds; your friends guess who it is ({D.tries} tries). The quicker the drawing, the more a right guess pays: them up to {D.times[0].guess[0]}, and you up to {D.times[0].artist} for each friend who got it.
          </p>
        </div>
        <div className="flex gap-1 rounded-lg border border-rule bg-tile p-1">
          {(['guess', 'draw'] as const).map((t) => (
            <button key={t} type="button" onClick={() => (sfx.select(), setTab(t))} aria-pressed={tab === t} className={`rounded-md px-3 py-1 font-display text-sm font-bold ${tab === t ? 'bg-paper shadow' : 'text-ink-soft'}`}>
              {t === 'guess' ? `Guess${theirs?.length ? ` (${theirs.length})` : ''}` : mine ? 'Your drawing' : 'Draw'}
            </button>
          ))}
        </div>
      </div>
      {earned > 0 && (
        <p className="rounded-md border border-hit/50 bg-hit/10 p-2 text-sm font-semibold">
          🎉 Friends guessed your drawings: +{earned.toLocaleString('en')} <DleCoin className="inline size-3.5 align-[-2px]" />
        </p>
      )}
      {error && <p className="rounded-md border border-coral/50 bg-coral/10 p-2 text-sm font-semibold text-coral">{error}</p>}
      {tab === 'draw' ? (
        <div className="mx-auto max-w-md">
          <DrawPanel demo={demo} posted={mine} onPosted={setMine} />
        </div>
      ) : theirs === null ? (
        <p className="text-sm text-ink-soft">Loading your friends&apos; drawings…</p>
      ) : theirs.length === 0 ? (
        <p className="text-sm text-ink-soft">{me.friends.length ? 'None of your friends has drawn today yet. Draw yours, and tell them!' : 'Add friends to guess their drawings.'}</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {theirs.map((d) => (
            <GuessCard key={`${d.uid}-${d.day}`} d={d} artist={byUid.get(d.uid)} demo={demo} />
          ))}
        </div>
      )}
    </section>
  );
}

async function getMine(c: Awaited<ReturnType<typeof cloud>>, day: string): Promise<DoodleDoc | null> {
  try {
    return await c.myDoodle(day);
  } catch (e) {
    if ((e as { code?: string })?.code === 'permission-denied') throw e;
    return null;
  }
}
