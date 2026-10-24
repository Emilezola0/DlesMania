// Rail Rush's renderer: a pseudo-3D view drawn on a 2D canvas, no library. The world is metres:
// x across (tracks at -LANE, 0, +LANE), z ahead of the camera. Everything is projected onto the
// screen with a fixed horizon, so straight rails stay straight and things grow as they come close.

export const LANE = 3.3;
export const LANES = [-1, 0, 1] as const;
// High enough to look over the train at the gates ahead.
const CAM_HEIGHT = 5;
const FAR = 140;
const SLEEPER_GAP = 2.2;

export interface Gate {
  /** Distance along the line where the gate stands. */
  at: number;
  /** Per lane (left, center, right): a barricade? */
  blocked: [boolean, boolean, boolean];
  /** Per lane: the sign's picture. */
  images: [HTMLImageElement | null, HTMLImageElement | null, HTMLImageElement | null];
  /** Set when the train went through it (passed or smashed). */
  done?: 'passed' | 'smashed';
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
  size: number;
}

export interface Scene {
  w: number;
  h: number;
  /** Distance travelled. */
  dist: number;
  speed: number;
  maxSpeed: number;
  /** The train's x in metres (it slides between tracks), and its lean while sliding. */
  trainX: number;
  lean: number;
  gates: Gate[];
  particles: Particle[];
  /** 0..1: screen shake and red flash after a crash. */
  shake: number;
  flash: number;
  palette: [string, string, string, string];
  /** Hard mode: signs are blurred. */
  blurSigns: boolean;
  /** The next station, when one is coming: the train stops with its middle at `at`. */
  station: { at: number; name: string } | null;
  time: number;
}

/** Train position ahead of the camera. */
export const TRAIN_Z = 9;

function geometry(s: Scene) {
  const horizon = s.h * 0.3;
  const focal = s.h * 1.05;
  // The camera follows the train sideways, a little behind it, so switching tracks swings the view.
  const camX = s.trainX * 0.55;
  const project = (x: number, y: number, z: number) => ({
    x: s.w / 2 + ((x - camX) * focal) / z,
    y: horizon + ((CAM_HEIGHT - y) * focal) / z,
    scale: focal / z,
  });
  const nearZ = (CAM_HEIGHT * focal) / (s.h - horizon);
  return { horizon, focal, project, nearZ };
}

/** Mixes a colour toward the fog (the sky's lower colour) with distance. */
function fogAlpha(z: number) {
  return Math.max(0, Math.min(1, 1 - (z - 20) / (FAR - 20)));
}

/** Rolling hills: layered sine noise, scrolling slowly for parallax. */
function hills(ctx: CanvasRenderingContext2D, s: Scene, horizon: number, offset: number, amp: number, color: string, seed: number) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, horizon + 2);
  for (let x = 0; x <= s.w; x += 8) {
    const t = (x + offset) / s.w;
    const y = Math.sin(t * 6.1 + seed) * 0.5 + Math.sin(t * 13.7 + seed * 2.3) * 0.3 + Math.sin(t * 29.3 + seed * 5.1) * 0.2;
    ctx.lineTo(x, horizon - amp * (0.55 + y * 0.45));
  }
  ctx.lineTo(s.w, horizon + 2);
  ctx.closePath();
  ctx.fill();
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawGate(ctx: CanvasRenderingContext2D, s: Scene, g: Gate, project: ReturnType<typeof geometry>['project']) {
  const z = g.at - s.dist;
  if (z <= 0.6 || z > FAR) return;
  const alpha = fogAlpha(z);
  ctx.save();
  ctx.globalAlpha = alpha;
  // The gantry carrying the signs.
  const left = project(-LANE * 1.6, 6.3, z);
  const right = project(LANE * 1.6, 6.3, z);
  const footL = project(-LANE * 1.6, 0, z);
  const footR = project(LANE * 1.6, 0, z);
  ctx.strokeStyle = '#2b2622';
  ctx.lineWidth = Math.max(1, 0.18 * left.scale);
  ctx.beginPath();
  ctx.moveTo(footL.x, footL.y);
  ctx.lineTo(left.x, left.y);
  ctx.lineTo(right.x, right.y);
  ctx.lineTo(footR.x, footR.y);
  ctx.stroke();

  LANES.forEach((lane, i) => {
    const cx = lane * LANE;
    // The sign: a framed picture hanging from the gantry.
    const tl = project(cx - 1.35, 6.0, z);
    const br = project(cx + 1.35, 3.4, z);
    const sw = br.x - tl.x;
    const sh = br.y - tl.y;
    ctx.fillStyle = g.blocked[i] ? '#7a2020' : '#f4ead2';
    roundRect(ctx, tl.x - sw * 0.06, tl.y - sh * 0.06, sw * 1.12, sh * 1.12, Math.max(2, sw * 0.08));
    ctx.fill();
    const img = g.images[i];
    if (img?.complete && img.naturalWidth) {
      ctx.save();
      roundRect(ctx, tl.x, tl.y, sw, sh, Math.max(1, sw * 0.05));
      ctx.clip();
      if (s.blurSigns) ctx.filter = `blur(${Math.max(1, sw * 0.04)}px)`;
      // Cover-fit, top-aligned (faces are near the top).
      const r = Math.max(sw / img.naturalWidth, sh / img.naturalHeight);
      ctx.drawImage(img, tl.x + (sw - img.naturalWidth * r) / 2, tl.y, img.naturalWidth * r, img.naturalHeight * r);
      ctx.restore();
    }
    // The barricade: a striped buffer stop across the track.
    if (g.blocked[i]) {
      const a = project(cx - 1.4, 1.4, z);
      const b = project(cx + 1.4, 0, z);
      const bw = b.x - a.x;
      const bh = b.y - a.y;
      ctx.fillStyle = '#c62828';
      ctx.fillRect(a.x, a.y, bw, bh);
      ctx.fillStyle = '#f5f0e6';
      const stripes = 5;
      for (let k = 0; k < stripes; k += 2) ctx.fillRect(a.x + (bw / stripes) * k, a.y + bh * 0.25, bw / stripes, bh * 0.35);
      ctx.fillStyle = '#ffcc33';
      const lamp = Math.max(1.5, bw * 0.06);
      const blink = Math.sin(s.time * 8 + i) > 0 ? 1 : 0.35;
      ctx.globalAlpha = alpha * blink;
      ctx.beginPath();
      ctx.arc(a.x + bw * 0.2, a.y - lamp, lamp, 0, Math.PI * 2);
      ctx.arc(a.x + bw * 0.8, a.y - lamp, lamp, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = alpha;
    }
  });
  ctx.restore();
}

/** Platforms on both sides, a canopy on pillars, and the station's name on a board over the tracks. */
function drawStation(ctx: CanvasRenderingContext2D, s: Scene, project: ReturnType<typeof geometry>['project']) {
  const st = s.station;
  if (!st) return;
  const near = Math.max(0.8, st.at - 16 - s.dist);
  const far = st.at + 16 - s.dist;
  if (far <= 0.8 || near > FAR) return;
  const quad = (pts: { x: number; y: number }[], color: string) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    pts.forEach((p, k) => (k ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
    ctx.closePath();
    ctx.fill();
  };
  ctx.save();
  ctx.globalAlpha = fogAlpha(Math.max(near, 1));
  const edge = LANE * 1.55;
  for (const side of [-1, 1]) {
    const inner = side * edge;
    const outer = side * (edge + 5);
    // The platform's top, then its face toward the tracks.
    quad([project(inner, 1.1, near), project(outer, 1.1, near), project(outer, 1.1, far), project(inner, 1.1, far)], '#cbbfa6');
    quad([project(inner, 0, near), project(inner, 1.1, near), project(inner, 1.1, far), project(inner, 0, far)], '#7d6e58');
    // A yellow safety line along the edge.
    quad([project(inner, 1.11, near), project(inner + side * 0.35, 1.11, near), project(inner + side * 0.35, 1.11, far), project(inner, 1.11, far)], '#e8c547');
    // Pillars and the canopy.
    ctx.fillStyle = '#3a3029';
    for (let z = Math.ceil((st.at - 15) / 6) * 6; z <= st.at + 15; z += 6) {
      const rz = z - s.dist;
      if (rz < 0.8) continue;
      const a = project(side * (edge + 2.5) - 0.15, 5.2, rz);
      const b = project(side * (edge + 2.5) + 0.15, 1.1, rz);
      ctx.fillRect(Math.min(a.x, b.x), a.y, Math.max(1, Math.abs(b.x - a.x)), b.y - a.y);
    }
    quad([project(inner - side * 0.4, 5.2, near), project(outer, 5.6, near), project(outer, 5.6, far), project(inner - side * 0.4, 5.2, far)], '#8c2f2f');
  }
  // The name board, hanging over the far end of the platforms (ahead of a train stopped at the station).
  const bz = st.at + 15 - s.dist;
  // Fades out as the train runs under it, so it never covers the view.
  if (bz > 6) {
    ctx.globalAlpha = Math.min(fogAlpha(bz), (bz - 6) / 6);
    const tl = project(-LANE * 1.2, 7.4, bz);
    const br = project(LANE * 1.2, 5.6, bz);
    const w = br.x - tl.x;
    const h = br.y - tl.y;
    ctx.fillStyle = '#1d2b3a';
    roundRect(ctx, tl.x, tl.y, w, h, Math.max(2, h * 0.15));
    ctx.fill();
    ctx.strokeStyle = '#e8c547';
    ctx.lineWidth = Math.max(1, h * 0.06);
    ctx.stroke();
    ctx.fillStyle = '#f4ead2';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `bold ${Math.max(6, h * 0.42)}px Georgia, serif`;
    ctx.fillText(st.name.toUpperCase(), tl.x + w / 2, tl.y + h / 2, w * 0.92);
  }
  ctx.restore();
}

function drawTrain(ctx: CanvasRenderingContext2D, s: Scene, project: ReturnType<typeof geometry>['project']) {
  const base = project(s.trainX, 0, TRAIN_Z);
  const top = project(s.trainX, 2.7, TRAIN_Z);
  const height = base.y - top.y;
  const width = height * 0.95;
  ctx.save();
  ctx.translate(base.x, base.y);
  ctx.rotate(s.lean * 0.12);
  // Shadow.
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath();
  ctx.ellipse(0, 0, width * 0.62, height * 0.06, 0, 0, Math.PI * 2);
  ctx.fill();
  // Body.
  const body = ctx.createLinearGradient(-width / 2, 0, width / 2, 0);
  body.addColorStop(0, '#1b2a3a');
  body.addColorStop(0.5, '#2f4a63');
  body.addColorStop(1, '#16222f');
  ctx.fillStyle = body;
  roundRect(ctx, -width / 2, -height, width, height * 0.92, width * 0.12);
  ctx.fill();
  // Roof and chimney.
  ctx.fillStyle = '#10181f';
  roundRect(ctx, -width * 0.42, -height * 1.05, width * 0.84, height * 0.16, width * 0.08);
  ctx.fill();
  ctx.fillRect(-width * 0.09, -height * 1.25, width * 0.18, height * 0.22);
  // Brass stripe and window.
  ctx.fillStyle = '#c9a227';
  ctx.fillRect(-width / 2, -height * 0.42, width, height * 0.06);
  ctx.fillStyle = '#f7d774';
  ctx.globalAlpha = 0.85;
  roundRect(ctx, -width * 0.28, -height * 0.84, width * 0.56, height * 0.26, width * 0.05);
  ctx.fill();
  ctx.globalAlpha = 1;
  // Red tail lamps.
  ctx.fillStyle = '#ff4d4d';
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.arc(side * width * 0.34, -height * 0.24, width * 0.055, 0, Math.PI * 2);
    ctx.fill();
  }
  // Wheels.
  ctx.fillStyle = '#0b0f14';
  for (const side of [-1, 1]) ctx.fillRect(side * width * 0.32 - width * 0.09, -height * 0.1, width * 0.18, height * 0.12);
  ctx.restore();
  return { x: base.x, chimneyY: base.y - height * 1.25, width };
}

/** Draws one frame. */
export function drawScene(ctx: CanvasRenderingContext2D, s: Scene) {
  const { horizon, project, nearZ } = geometry(s);
  const [skyTop, skyLow, hillColor, ground] = s.palette;
  ctx.save();
  if (s.shake > 0) ctx.translate((Math.random() - 0.5) * 18 * s.shake, (Math.random() - 0.5) * 12 * s.shake);

  // Sky, a low sun, and two layers of hills moving at different speeds.
  const sky = ctx.createLinearGradient(0, 0, 0, horizon);
  sky.addColorStop(0, skyTop);
  sky.addColorStop(1, skyLow);
  ctx.fillStyle = sky;
  ctx.fillRect(-20, -20, s.w + 40, horizon + 22);
  ctx.fillStyle = 'rgba(255,240,200,0.55)';
  ctx.beginPath();
  ctx.arc(s.w * 0.72 - s.trainX * 4, horizon - s.h * 0.06, s.h * 0.07, 0, Math.PI * 2);
  ctx.fill();
  hills(ctx, s, horizon, s.dist * 0.6 - s.trainX * 6, s.h * 0.11, hillColor + 'aa', 1.3);
  hills(ctx, s, horizon, s.dist * 1.4 - s.trainX * 14, s.h * 0.07, hillColor, 4.1);

  // Ground, darker toward the viewer.
  const g = ctx.createLinearGradient(0, horizon, 0, s.h);
  g.addColorStop(0, skyLow);
  g.addColorStop(0.08, ground);
  g.addColorStop(1, '#1a1612');
  ctx.fillStyle = g;
  ctx.fillRect(-20, horizon, s.w + 40, s.h - horizon + 20);

  // Ballast beds under each track.
  for (const lane of LANES) {
    const cx = lane * LANE;
    const a = project(cx - 1.3, 0, nearZ);
    const b = project(cx + 1.3, 0, nearZ);
    const c = project(cx + 1.3, 0, FAR);
    const d = project(cx - 1.3, 0, FAR);
    ctx.fillStyle = 'rgba(40,34,30,0.55)';
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.lineTo(c.x, c.y);
    ctx.lineTo(d.x, d.y);
    ctx.fill();
  }

  // Sleepers scroll toward the viewer, fading into the distance.
  const first = SLEEPER_GAP - (s.dist % SLEEPER_GAP);
  for (let z = first; z < FAR; z += SLEEPER_GAP) {
    if (z < nearZ * 0.9) continue;
    const alpha = fogAlpha(z);
    ctx.fillStyle = `rgba(92,64,44,${alpha})`;
    for (const lane of LANES) {
      const cx = lane * LANE;
      const corners = [project(cx - 1.0, 0, z), project(cx + 1.0, 0, z), project(cx + 1.0, 0, z + 0.35), project(cx - 1.0, 0, z + 0.35)];
      ctx.beginPath();
      corners.forEach((p, k) => (k ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
      ctx.fill();
    }
  }

  // Rails: straight lines from the bottom edge to the horizon.
  ctx.strokeStyle = '#c8ccd2';
  for (const lane of LANES) {
    for (const side of [-0.72, 0.72]) {
      const x = lane * LANE + side;
      const a = project(x, 0.12, nearZ);
      const b = project(x, 0.12, FAR);
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
  }

  drawStation(ctx, s, project);
  // Gates, far to near, then the train.
  [...s.gates].sort((a, b) => b.at - a.at).forEach((gate) => !gate.done && drawGate(ctx, s, gate, project));
  const train = drawTrain(ctx, s, project);

  // Smoke puffs from the chimney.
  if (Math.random() < 0.35) {
    s.particles.push({ x: train.x, y: train.chimneyY, vx: (Math.random() - 0.5) * 30, vy: -40 - Math.random() * 30, life: 1, color: '200,200,200', size: train.width * 0.07 });
  }
  for (const p of s.particles) {
    ctx.fillStyle = `rgba(${p.color},${Math.max(0, p.life) * (p.color === '200,200,200' ? 0.18 : 1)})`;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size * (p.color === '200,200,200' ? 2 - p.life : p.life), 0, Math.PI * 2);
    ctx.fill();
  }

  // Speed lines once it gets fast.
  const fast = Math.max(0, (s.speed / s.maxSpeed - 0.45) / 0.55);
  if (fast > 0) {
    ctx.strokeStyle = `rgba(255,255,255,${0.25 * fast})`;
    ctx.lineWidth = 2;
    for (let k = 0; k < 14; k++) {
      const angle = (k / 14) * Math.PI * 2 + s.time * 0.7;
      const r0 = s.h * (0.55 + ((s.time * 3 + k * 0.37) % 1) * 0.35);
      ctx.beginPath();
      ctx.moveTo(s.w / 2 + Math.cos(angle) * r0, horizon + Math.sin(angle) * r0 * 0.6);
      ctx.lineTo(s.w / 2 + Math.cos(angle) * (r0 + s.h * 0.12), horizon + Math.sin(angle) * (r0 + s.h * 0.12) * 0.6);
      ctx.stroke();
    }
  }
  ctx.restore();

  if (s.flash > 0) {
    ctx.fillStyle = `rgba(220,40,40,${0.45 * s.flash})`;
    ctx.fillRect(0, 0, s.w, s.h);
  }
}

/** The screen point under the train's wheels (sparks start there). */
export function wheelPoint(s: Scene) {
  const { project } = geometry(s);
  return project(s.trainX, 0, TRAIN_Z);
}

/** Moves particles along; gravity for sparks, drift for smoke. */
export function stepParticles(s: Scene, dt: number) {
  for (const p of s.particles) {
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    if (p.color !== '200,200,200') p.vy += 420 * dt;
    p.life -= dt * (p.color === '200,200,200' ? 0.9 : 1.8);
  }
  s.particles = s.particles.filter((p) => p.life > 0);
}
