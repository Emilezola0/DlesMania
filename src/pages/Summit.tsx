import { useEffect, useReducer, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ANGLE_INFO,
  BAR_STAMINA,
  CHALK_MOVES,
  HOLD_INFO,
  ITEM_INFO,
  LEDGE_EVERY,
  MAX_STAMINA,
  REACH,
  REVEAL_MS,
  ROPES,
  SLIP_COST,
  WALL_W,
  angleOf,
  compact,
  crossed,
  dist,
  drainRate,
  holdNamed,
  holdsStarting,
  ledgeInReach,
  makeSection,
  moveCost,
  poseFactor,
  reachable,
  sectionOf,
  type Grip,
  type Hold,
  type HoldKind,
  type Item,
} from '../arcade/climb';
import { celebrate, celebrateBig, shake } from '../lib/fx';
import { useTypeToFocus } from '../lib/focus';
import { getImage, isReady, preload } from '../lib/images';
import { sfx } from '../lib/sfx';
import { useProgress } from '../store/progress';

/** Best height, in tenths of a metre. */
const BEST_KEY = 'climb:height';
const HAND_MS = 220;
const FALL_MS = 1300;
const KIND_COLOR: Record<HoldKind, string> = { jug: '#34d399', pinch: '#60a5fa', crimp: '#fb923c', sloper: '#f472b6' };
const ITEMS: Item[] = ['chalk', 'piton', 'bar'];

type Hand = 'L' | 'R';
type Phase = 'ready' | 'climb' | 'rest' | 'fell' | 'over';

interface State {
  phase: Phase;
  seed: number;
  L: Grip;
  R: Grip;
  mover: Hand;
  anim: { hand: Hand; from: Grip; t0: number } | null;
  stamina: number;
  ropes: number;
  chalk: number;
  items: Item[];
  checkpoint: { L: Grip; R: Grip; mover: Hand };
  holds: Hold[];
  sections: number;
  maxH: number;
  /** When each lit hold lit up, for its name to show after a while. */
  litSince: Map<number, number>;
  slipUntil: number;
  fellAt: number;
  camY: number;
  typed: string;
}

const START_L: Grip = { x: 1.55, y: 0, kind: 'jug' };
const START_R: Grip = { x: 2.45, y: 0, kind: 'jug' };

function freshState(): State {
  const seed = Math.floor(Math.random() * 1e9);
  return {
    phase: 'ready',
    seed,
    L: START_L,
    R: START_R,
    mover: 'L',
    anim: null,
    stamina: MAX_STAMINA,
    ropes: ROPES,
    chalk: 0,
    items: [],
    checkpoint: { L: START_L, R: START_R, mover: 'L' },
    holds: [...makeSection(0, seed, 1), ...makeSection(1, seed, 100_000)],
    sections: 2,
    maxH: 0,
    litSince: new Map(),
    slipUntil: 0,
    fellAt: 0,
    camY: -1.2,
    typed: '',
  };
}

const bodyY = (g: State) => (g.L.y + g.R.y) / 2;
const anchorOf = (g: State) => (g.mover === 'L' ? g.R : g.L);
const moverOf = (g: State) => (g.mover === 'L' ? g.L : g.R);

/** Why the drain is what it is, for the bar's caption. */
function drainReasons(g: State): string[] {
  const out: string[] = [];
  const d = dist(g.L, g.R);
  if (crossed(g.L, g.R)) out.push('hands crossed');
  if (d > 1.1) out.push('arms wide');
  if (d < 0.35) out.push('hands bunched');
  for (const k of new Set([g.L.kind, g.R.kind])) if (k === 'crimp' || k === 'sloper') out.push(HOLD_INFO[k].name.toLowerCase());
  const angle = angleOf(sectionOf(bodyY(g)), g.seed);
  if (angle !== 'vertical') out.push(ANGLE_INFO[angle].name.toLowerCase());
  return out;
}

// ── Drawing ───────────────────────────────────────────────────────────
function drawFace(ctx: CanvasRenderingContext2D, src: string, x: number, y: number, r: number) {
  const im = getImage(src);
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.clip();
  ctx.fillStyle = '#00000022';
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
  if (im.complete && im.naturalWidth) {
    // Cover the circle, keeping the top of the picture (faces are there).
    const side = Math.min(im.naturalWidth, im.naturalHeight);
    ctx.drawImage(im, (im.naturalWidth - side) / 2, 0, side, side, x - r, y - r, r * 2, r * 2);
  }
  ctx.restore();
}

function drawHoldShape(ctx: CanvasRenderingContext2D, kind: HoldKind, x: number, y: number, s: number) {
  ctx.fillStyle = KIND_COLOR[kind];
  ctx.beginPath();
  if (kind === 'jug') ctx.roundRect(x - 0.17 * s, y - 0.06 * s, 0.34 * s, 0.13 * s, 0.06 * s);
  else if (kind === 'pinch') ctx.ellipse(x, y, 0.07 * s, 0.12 * s, 0, 0, Math.PI * 2);
  else if (kind === 'crimp') ctx.roundRect(x - 0.15 * s, y - 0.025 * s, 0.3 * s, 0.05 * s, 0.02 * s);
  else ctx.arc(x, y + 0.05 * s, 0.15 * s, Math.PI, 0);
  ctx.fill();
}

/** A two-bone arm from shoulder to hand, the elbow bent outward. */
function arm(ctx: CanvasRenderingContext2D, sx: number, sy: number, hx: number, hy: number, out: number, len: number) {
  const d = Math.hypot(hx - sx, hy - sy);
  ctx.beginPath();
  ctx.moveTo(sx, sy);
  if (d < len * 2) {
    const h = Math.sqrt(len * len - (d / 2) ** 2);
    const mx = (sx + hx) / 2;
    const my = (sy + hy) / 2;
    const nx = -(hy - sy) / d;
    const ny = (hx - sx) / d;
    const sign = nx * out > 0 ? 1 : -1;
    ctx.lineTo(mx + nx * h * sign, my + ny * h * sign);
  }
  ctx.lineTo(hx, hy);
  ctx.stroke();
}

function cssVar(name: string, fallback: string) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}

function draw(ctx: CanvasRenderingContext2D, g: State, w: number, h: number, now: number) {
  const s = w / WALL_W;
  const Y = (y: number) => h - (y - g.camY) * s;
  const ink = cssVar('--color-ink', '#222');
  const tile = cssVar('--color-tile', '#ddd');
  const accent = cssVar('--color-accent', '#6366f1');
  const faint = cssVar('--color-ink-faint', '#999');
  ctx.clearRect(0, 0, w, h);

  // The wall, section by section: darker where it overhangs.
  const lo = g.camY;
  const hi = g.camY + h / s;
  for (let k = Math.max(0, sectionOf(lo)); k <= sectionOf(hi); k++) {
    const angle = angleOf(k, g.seed);
    const top = Y((k + 1) * LEDGE_EVERY);
    const bottom = Y(k * LEDGE_EVERY);
    ctx.fillStyle = tile;
    ctx.fillRect(0, top, w, bottom - top);
    if (angle !== 'vertical') {
      ctx.fillStyle = angle === 'overhang' ? 'rgba(0,0,0,0.16)' : 'rgba(255,255,255,0.07)';
      ctx.fillRect(0, top, w, bottom - top);
    }
    ctx.fillStyle = faint;
    ctx.font = '600 11px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(ANGLE_INFO[angle].name.toUpperCase(), 8, bottom - 10);
  }
  if (lo < 0) {
    ctx.fillStyle = cssVar('--color-rule-strong', '#888');
    ctx.fillRect(0, Y(-0.4), w, h - Y(-0.4));
  }
  // Metre marks.
  ctx.fillStyle = faint;
  ctx.textAlign = 'right';
  ctx.font = '10px system-ui, sans-serif';
  for (let m = Math.max(0, Math.ceil(lo)); m <= hi; m++) {
    ctx.globalAlpha = 0.5;
    ctx.fillRect(w - 14, Y(m), 10, 1);
    ctx.fillText(`${m} m`, w - 18, Y(m) + 3);
  }
  ctx.globalAlpha = 1;
  // Ledges.
  for (let k = Math.max(1, sectionOf(lo)); k <= sectionOf(hi) + 1; k++) {
    const y = Y(k * LEDGE_EVERY);
    ctx.fillStyle = cssVar('--color-rule-strong', '#888');
    ctx.fillRect(0, y - 0.04 * s, w, 0.14 * s);
    ctx.fillStyle = ink;
    ctx.textAlign = 'center';
    ctx.font = '700 11px system-ui, sans-serif';
    ctx.fillText(`LEDGE · ${k * LEDGE_EVERY} m`, w / 2, y - 0.08 * s);
  }

  const climbing = g.phase === 'climb' && !g.anim;
  const anchor = anchorOf(g);
  const mover = moverOf(g);
  const lit = g.phase === 'climb' ? reachable(g.holds, anchor, mover) : [];
  const litIds = new Set(lit.map((x) => x.id));
  const matching = new Set(holdsStarting(lit, g.typed).map((x) => x.id));
  const typing = compact(g.typed).length > 0;
  const fr = Math.max(15, Math.min(28, 0.19 * s));

  // Reach, around the hand that stays.
  if (climbing) {
    ctx.strokeStyle = accent;
    ctx.globalAlpha = 0.25;
    ctx.setLineDash([6, 6]);
    ctx.beginPath();
    ctx.arc(anchor.x * s, Y(anchor.y), REACH * s, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
  }

  // Holds: the lit ones big, with their face; the rest small and grey, to plan ahead.
  for (const hd of g.holds) {
    const x = hd.x * s;
    const y = Y(hd.y);
    if (y < -40 || y > h + 40) continue;
    const isLit = litIds.has(hd.id);
    drawHoldShape(ctx, hd.kind, x, y, s);
    if (!isLit) {
      ctx.globalAlpha = 0.3;
      ctx.filter = 'grayscale(1)';
      drawFace(ctx, hd.face.image, x, y - fr * 0.9, fr * 0.6);
      ctx.filter = 'none';
      ctx.globalAlpha = 1;
      continue;
    }
    const on = !typing || matching.has(hd.id);
    ctx.globalAlpha = on ? 1 : 0.3;
    drawFace(ctx, hd.face.image, x, y - fr * 1.1, fr);
    ctx.strokeStyle = typing && on ? accent : KIND_COLOR[hd.kind];
    ctx.lineWidth = typing && on ? 4 : 2.5;
    ctx.beginPath();
    ctx.arc(x, y - fr * 1.1, fr, 0, Math.PI * 2);
    ctx.stroke();
    const since = g.litSince.get(hd.id) ?? now;
    if (now - since > REVEAL_MS) {
      ctx.font = '700 11px system-ui, sans-serif';
      ctx.textAlign = 'center';
      const label = hd.face.name;
      const tw = ctx.measureText(label).width + 8;
      ctx.fillStyle = 'rgba(0,0,0,0.65)';
      ctx.fillRect(x - tw / 2, y - fr * 2.2 - 14, tw, 15);
      ctx.fillStyle = '#fff';
      ctx.fillText(label, x, y - fr * 2.2 - 3);
    }
    ctx.globalAlpha = 1;
  }

  // The two jugs everyone starts on.
  for (const st of [START_L, START_R]) drawHoldShape(ctx, 'jug', st.x * s, Y(st.y), s);

  // The ledge as a target, when it's in reach.
  const ledge = g.phase === 'climb' ? ledgeInReach(anchor, mover) : null;
  if (ledge !== null && climbing) {
    ctx.strokeStyle = accent;
    ctx.lineWidth = 3;
    ctx.strokeRect(4, Y(ledge) - 0.06 * s, w - 8, 0.18 * s);
    ctx.fillStyle = accent;
    ctx.font = '700 12px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Press Enter to pull up onto the ledge', w / 2, Y(ledge) + 0.32 * s);
  }

  // The climber.
  const handAt = (hand: Hand): { x: number; y: number } => {
    const to = hand === 'L' ? g.L : g.R;
    if (!g.anim || g.anim.hand !== hand) return to;
    const k = Math.min(1, (now - g.anim.t0) / HAND_MS);
    return { x: g.anim.from.x + (to.x - g.anim.from.x) * k, y: g.anim.from.y + (to.y - g.anim.from.y) * k + Math.sin(Math.PI * k) * 0.12 };
  };
  let hl = handAt('L');
  let hr = handAt('R');
  let drop = 0;
  if (g.phase === 'fell') {
    const k = Math.min(1, (now - g.fellAt) / FALL_MS);
    drop = k * k * 4;
    hl = { x: hl.x - 0.15 * k, y: hl.y - drop };
    hr = { x: hr.x + 0.15 * k, y: hr.y - drop };
  }
  const shakeAmt = (g.stamina < 25 && g.phase === 'climb' ? (25 - g.stamina) / 25 : 0) * 0.025 + (now < g.slipUntil ? 0.03 : 0);
  const jx = (Math.random() - 0.5) * shakeAmt * s;
  const jy = (Math.random() - 0.5) * shakeAmt * s;
  const cx = ((hl.x + hr.x) / 2) * s + jx;
  const sy = Math.min(Math.min(hl.y, hr.y) - 0.18, (hl.y + hr.y) / 2 - 0.5);
  const shoulderY = Y(sy) + jy;
  const sw = 0.17 * s;
  ctx.strokeStyle = ink;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.lineWidth = Math.max(4, 0.07 * s);
  arm(ctx, cx - sw, shoulderY, hl.x * s + jx, Y(hl.y) + jy, -1, 0.42 * s);
  arm(ctx, cx + sw, shoulderY, hr.x * s + jx, Y(hr.y) + jy, 1, 0.42 * s);
  ctx.beginPath();
  ctx.moveTo(cx - sw, shoulderY);
  ctx.lineTo(cx + sw, shoulderY);
  ctx.moveTo(cx, shoulderY);
  ctx.lineTo(cx, shoulderY + 0.55 * s);
  // Legs, feet pressed to the wall.
  ctx.moveTo(cx, shoulderY + 0.55 * s);
  ctx.lineTo(cx - 0.22 * s, shoulderY + 0.78 * s);
  ctx.lineTo(cx - 0.2 * s, shoulderY + 1.02 * s);
  ctx.moveTo(cx, shoulderY + 0.55 * s);
  ctx.lineTo(cx + 0.22 * s, shoulderY + 0.8 * s);
  ctx.lineTo(cx + 0.24 * s, shoulderY + 1.0 * s);
  ctx.stroke();
  ctx.fillStyle = ink;
  ctx.beginPath();
  ctx.arc(cx, shoulderY - 0.15 * s, 0.11 * s, 0, Math.PI * 2);
  ctx.fill();
  // The hand that moves next, glowing.
  if (climbing) {
    const m = g.mover === 'L' ? hl : hr;
    ctx.fillStyle = accent;
    ctx.beginPath();
    ctx.arc(m.x * s + jx, Y(m.y) + jy, Math.max(6, 0.06 * s), 0, Math.PI * 2);
    ctx.fill();
  }

  // Running out: the edges go red.
  if (g.phase === 'climb' && g.stamina < 30) {
    const a = ((30 - g.stamina) / 30) * 0.45;
    const grad = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.max(w, h) * 0.75);
    grad.addColorStop(0, 'rgba(239,68,68,0)');
    grad.addColorStop(1, `rgba(239,68,68,${a})`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
  }
}

// ── The game ──────────────────────────────────────────────────────────
function Game() {
  const best = useProgress((s) => s.bests[BEST_KEY] ?? 0);
  const recordBest = useProgress((s) => s.recordBest);
  const g = useRef<State>(freshState());
  const [, redraw] = useReducer((x: number) => x + 1, 0);
  const [text, setText] = useState('');
  const [offer, setOffer] = useState<Item[] | null>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const bestBefore = useRef(best);
  useTypeToFocus(input, g.current.phase === 'climb');

  const save = () => recordBest(BEST_KEY, Math.round(g.current.maxH * 10));

  // The loop: stamina, the camera, the wall ahead, and the picture.
  useEffect(() => {
    let id = 0;
    let last = performance.now();
    let hud = 0;
    const frame = (now: number) => {
      const st = g.current;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (st.anim && now - st.anim.t0 > HAND_MS) st.anim = null;
      if (st.phase === 'climb') {
        const sec = sectionOf(bodyY(st));
        const lit = reachable(st.holds, anchorOf(st), moverOf(st));
        // Stamina holds while a face in reach is still loading: you can't name what you can't see.
        const waiting = lit.some((h) => !isReady(h.face.image));
        if (!waiting) st.stamina -= drainRate(st.L, st.R, angleOf(sec, st.seed), sec, st.chalk > 0) * dt;
        if (st.stamina <= 0) fall(now);
        // The lit holds' clocks, for the names that show after a while: from when the face is there.
        for (const h of lit) if (!st.litSince.has(h.id) && isReady(h.face.image)) st.litSince.set(h.id, now);
      }
      // More wall above, two sections ahead.
      while (st.sections <= sectionOf(Math.max(st.L.y, st.R.y)) + 2) {
        const more = makeSection(st.sections, st.seed, (st.sections + 1) * 100_000);
        // Faces load ahead, so they are there by the time the hands are.
        more.forEach((h) => void preload(h.face.image));
        st.holds.push(...more);
        st.sections++;
      }
      const c = canvas.current;
      if (c) {
        const w = c.clientWidth;
        const h = c.clientHeight;
        const dpr = window.devicePixelRatio || 1;
        if (c.width !== Math.round(w * dpr) || c.height !== Math.round(h * dpr)) {
          c.width = Math.round(w * dpr);
          c.height = Math.round(h * dpr);
        }
        const target = bodyY(st) - (0.32 * h) / (w / WALL_W);
        st.camY += (target - st.camY) * Math.min(1, dt * 4);
        const ctx = c.getContext('2d')!;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        draw(ctx, st, w, h, now);
      }
      if (now - hud > 100) ((hud = now), redraw());
      id = requestAnimationFrame(frame);
    };
    id = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fall = (now: number) => {
    const st = g.current;
    st.phase = 'fell';
    st.fellAt = now;
    st.stamina = 0;
    st.ropes -= 1;
    sfx.hurt();
    shake(box.current, 10, 450);
    save();
    setText('');
    st.typed = '';
    window.setTimeout(() => {
      if (st.ropes <= 0) {
        st.phase = 'over';
        if (Math.round(st.maxH * 10) > bestBefore.current) (sfx.streak(), celebrateBig());
      } else {
        st.L = st.checkpoint.L;
        st.R = st.checkpoint.R;
        st.mover = st.checkpoint.mover;
        st.stamina = MAX_STAMINA;
        st.chalk = 0;
        st.litSince.clear();
        st.phase = 'climb';
        input.current?.focus({ preventScroll: true });
      }
      redraw();
    }, FALL_MS);
  };

  const grab = (h: Hold) => {
    const st = g.current;
    const anchor = anchorOf(st);
    const from = moverOf(st);
    const to: Grip = { x: h.x, y: h.y, kind: h.kind, holdId: h.id };
    st.stamina = Math.max(0.5, st.stamina - moveCost(anchor, h));
    st.anim = { hand: st.mover, from, t0: performance.now() };
    if (st.mover === 'L') st.L = to;
    else st.R = to;
    st.mover = st.mover === 'L' ? 'R' : 'L';
    if (st.chalk > 0) st.chalk -= 1;
    st.maxH = Math.max(st.maxH, bodyY(st));
    st.litSince.clear();
    sfx.select();
  };

  const takeLedge = (y: number) => {
    const st = g.current;
    st.anim = { hand: st.mover, from: moverOf(st), t0: performance.now() };
    st.L = { x: 1.6, y, kind: 'ledge' };
    st.R = { x: 2.4, y, kind: 'ledge' };
    st.stamina = MAX_STAMINA;
    st.checkpoint = { L: st.L, R: st.R, mover: 'L' };
    st.mover = 'L';
    st.chalk = 0;
    st.maxH = Math.max(st.maxH, y);
    st.litSince.clear();
    st.phase = 'rest';
    save();
    sfx.correct();
    celebrate();
    setOffer(ITEMS);
  };

  const slip = () => {
    const st = g.current;
    st.stamina = Math.max(0.5, st.stamina - SLIP_COST);
    st.slipUntil = performance.now() + 350;
    sfx.wrong();
  };

  const setTyped = (v: string) => {
    setText(v);
    g.current.typed = v;
  };

  const onType = (v: string) => {
    const st = g.current;
    if (st.phase !== 'climb' || st.anim) return setTyped(v.replace(/\d/g, ''));
    const lit = reachable(st.holds, anchorOf(st), moverOf(st));
    const h = holdNamed(lit, v);
    if (h) return (grab(h), setTyped(''));
    setTyped(v);
  };

  const applyItem = (i: number) => {
    const st = g.current;
    const it = st.items[i];
    if (!it || st.phase !== 'climb') return;
    st.items = st.items.filter((_, j) => j !== i);
    if (it === 'bar') st.stamina = Math.min(MAX_STAMINA, st.stamina + BAR_STAMINA);
    if (it === 'chalk') st.chalk = CHALK_MOVES;
    if (it === 'piton') st.checkpoint = { L: st.L, R: st.R, mover: st.mover };
    sfx.correct();
    redraw();
  };

  const onKey = (e: React.KeyboardEvent) => {
    const st = g.current;
    if (/^[1-9]$/.test(e.key)) {
      e.preventDefault();
      if (st.phase === 'rest' && offer) return pickItem(offer[Number(e.key) - 1]);
      return applyItem(Number(e.key) - 1);
    }
    if (e.key !== 'Enter') return;
    if (st.phase === 'ready') return start();
    if (st.phase !== 'climb' || st.anim) return;
    const anchor = anchorOf(st);
    const mover = moverOf(st);
    const ledge = ledgeInReach(anchor, mover);
    const t = compact(text);
    if (ledge !== null && (!t || 'ledge'.startsWith(t))) return (takeLedge(ledge), setTyped(''));
    if (!t) return;
    const fits = holdsStarting(reachable(st.holds, anchor, mover), text);
    if (fits.length === 1) grab(fits[0]);
    else slip();
    setTyped('');
  };

  const pickItem = (it: Item | undefined) => {
    if (!it) return;
    const st = g.current;
    st.items = [...st.items, it].slice(-3);
    setOffer(null);
    st.phase = 'climb';
    sfx.click();
    input.current?.focus({ preventScroll: true });
    redraw();
  };

  const start = () => {
    sfx.click();
    g.current.phase = 'climb';
    input.current?.focus({ preventScroll: true });
    redraw();
  };

  const again = () => {
    bestBefore.current = Math.max(bestBefore.current, Math.round(g.current.maxH * 10));
    g.current = freshState();
    g.current.phase = 'climb';
    setTyped('');
    setOffer(null);
    input.current?.focus({ preventScroll: true });
    redraw();
  };

  const st = g.current;
  const sec = sectionOf(bodyY(st));
  const rate = drainRate(st.L, st.R, angleOf(sec, st.seed), sec, st.chalk > 0);
  const reasons = drainReasons(st);
  const stam = Math.max(0, st.stamina);
  const barColor = stam > 55 ? 'bg-hit' : stam > 25 ? 'bg-ochre' : 'bg-coral';
  const height = (st.phase === 'climb' || st.phase === 'rest' ? Math.max(0, bodyY(st)) : st.maxH).toFixed(1);

  return (
    <div ref={box} className="mx-auto max-w-xl space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <p className="font-display text-sm text-ink-soft">
          <span className="font-serif text-4xl font-bold text-ink">{height}</span> m · top {st.maxH.toFixed(1)} m · best {(Math.max(best, Math.round(st.maxH * 10)) / 10).toFixed(1)} m
        </p>
        <p className="font-display text-sm" title="Ropes: a fall costs one">
          {Array.from({ length: ROPES }, (_, i) => (
            <span key={i} className={i < st.ropes ? '' : 'opacity-25 grayscale'}>
              🪢
            </span>
          ))}
        </p>
      </div>

      <div>
        <div className="h-3 overflow-hidden rounded-full bg-tile">
          <div className={`h-full ${barColor} transition-[width] duration-100`} style={{ width: `${stam}%` }} />
        </div>
        <p className="mt-1 flex justify-between text-xs text-ink-soft">
          <span>
            Stamina −{rate.toFixed(1)}/s{poseFactor(st.L, st.R) > 1.05 || reasons.length ? ` · ${reasons.join(', ')}` : ''}
          </span>
          {st.chalk > 0 && <span>🧂 chalk ×{st.chalk}</span>}
        </p>
      </div>

      <div className="relative">
        <canvas ref={canvas} className="block h-[min(62vh,600px)] min-h-[420px] w-full rounded-md border border-rule-strong" />
        {st.phase === 'ready' && (
          <div className="absolute inset-0 grid place-items-center rounded-md bg-paper/60 backdrop-blur-[2px]">
            <button type="button" onClick={start} className="btn-accent rounded-md px-8 py-3 font-display text-lg font-bold tracking-widest">
              Climb
            </button>
          </div>
        )}
        {st.phase === 'rest' && offer && (
          <div className="absolute inset-x-3 bottom-3 animate-pop space-y-2 rounded-md border border-rule-strong bg-card p-3 text-center shadow-xl">
            <p className="font-display font-bold">Ledge at {Math.round(bodyY(st))} m — stamina restored. Take one:</p>
            <div className="grid gap-2 sm:grid-cols-3">
              {offer.map((it, i) => (
                <button key={it} type="button" onClick={() => pickItem(it)} className="btn-paper flex flex-col items-center gap-0.5 rounded-md p-2 text-sm">
                  <span className="text-2xl">{ITEM_INFO[it].icon}</span>
                  <span className="font-display font-bold">
                    {i + 1}. {ITEM_INFO[it].name}
                  </span>
                  <span className="text-xs text-ink-soft">{ITEM_INFO[it].blurb}</span>
                </button>
              ))}
            </div>
          </div>
        )}
        {st.phase === 'over' && (
          <div className="absolute inset-0 grid place-items-center rounded-md bg-paper/70 backdrop-blur-[2px]">
            <div className="animate-pop space-y-2 text-center">
              <p className="font-display text-sm uppercase tracking-[0.3em] text-ink-faint">Out of rope</p>
              <p className="font-serif text-6xl font-bold">{st.maxH.toFixed(1)} m</p>
              <p className="text-ink-soft">{Math.round(st.maxH * 10) > bestBefore.current ? 'A new best!' : `Best ${(best / 10).toFixed(1)} m`}</p>
              <button type="button" onClick={again} className="btn-ink rounded-md px-6 py-2.5 font-display font-bold tracking-wider">
                Climb again
              </button>
            </div>
          </div>
        )}
      </div>

      <input
        ref={input}
        value={text}
        onChange={(e) => onType(e.target.value)}
        onKeyDown={onKey}
        disabled={st.phase === 'over'}
        placeholder={st.phase === 'rest' ? 'Pick 1, 2 or 3…' : `${st.mover === 'L' ? 'Left' : 'Right'} hand: type a name…`}
        autoComplete="off"
        spellCheck={false}
        className="w-full rounded-xl border border-rule-strong bg-card/90 px-4 py-3 text-lg outline-none ring-accent/30 focus:border-accent focus:ring-4"
      />

      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-ink-soft">
        <div className="flex gap-2">
          {st.items.length ? (
            st.items.map((it, i) => (
              <button key={i} type="button" onClick={() => applyItem(i)} title={ITEM_INFO[it].blurb} className="btn-paper rounded-md px-2 py-1 font-semibold">
                {i + 1} · {ITEM_INFO[it].icon} {ITEM_INFO[it].name}
              </button>
            ))
          ) : (
            <span>No items yet — the ledges have some.</span>
          )}
        </div>
        <span className="flex flex-wrap gap-x-2">
          {(Object.keys(KIND_COLOR) as HoldKind[]).map((k) => (
            <span key={k}>
              <span className="inline-block size-2 rounded-full" style={{ background: KIND_COLOR[k] }} /> {HOLD_INFO[k].name}
            </span>
          ))}
        </span>
      </div>
    </div>
  );
}

/** /summit */
export default function Summit() {
  return (
    <div className="space-y-6">
      <div className="mx-auto max-w-xl">
        <Link to="/games" className="font-display text-sm font-semibold tracking-wider text-ink-soft hover:text-ink">
          ← Games
        </Link>
        <h1 className="text-5xl font-bold">Summit</h1>
        <p className="text-ink-soft">
          Climb one hand at a time: the holds within reach show a face — type the name to grab it (the name shows if you wait, but the clock
          runs). Stamina drains all the time, faster on crimps and slopers, on overhangs, and with your arms wide or crossed. Pull up onto
          a ledge every {LEDGE_EVERY} m to rest and pick an item. Out of stamina, you fall back to the last ledge and lose a rope. Your score is
          the height you reach.
        </p>
      </div>
      <Game />
    </div>
  );
}
