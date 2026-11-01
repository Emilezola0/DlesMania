// Stick Fight (a test): the duel itself, on a canvas, at a fixed 60 steps a second. Knows nothing of React:
// the page feeds it `input` and draws what `draw` paints; `onEvent` tells it what to play and when things change.
import { hashString, mulberry32 } from '../lib/rng';
import type { Fighter, Move, Shape, Weapon } from './fighters';

export const W = 780;
export const H = 380;
const FLOOR = 328;
const GRAVITY = 1600;
const STEP = 1 / 60;
const PLAYER_HP = 100;
const ENEMY_HP = 120;
/** Damage dealt for each clue. */
export const CLUE_EVERY = 15;
const PUNCHES = [
  { damage: 5, kb: 70 },
  { damage: 5, kb: 70 },
  { damage: 9, kb: 280 },
];
const PUNCH_TIME = 0.26;
const PUNCH_REACH = 62;
const DODGE_TIME = 0.26;
const DODGE_COOLDOWN = 0.9;

export type FightEvent = 'hit' | 'hurt' | 'block' | 'dodge' | 'blast' | 'clue' | 'ko' | 'stagger' | 'finish' | 'done';
export interface Input {
  left: boolean;
  right: boolean;
  jump: boolean;
  attack: boolean;
  block: boolean;
  dodge: boolean;
}

interface Body {
  x: number;
  y: number;
  vx: number;
  vy: number;
  face: number;
  hp: number;
  scale: number;
  hurtT: number;
  walk: number;
}

interface Shot {
  x: number;
  y: number;
  vx: number;
  vy: number;
  g: number;
  move: Move;
  shape: Shape;
  hook?: boolean;
  life: number;
}

interface Fx {
  kind: 'line' | 'ring';
  x: number;
  y: number;
  x2?: number;
  y2?: number;
  r0?: number;
  r1?: number;
  color: string;
  width: number;
  t: number;
  dur: number;
}

interface Spark {
  x: number;
  y: number;
  vx: number;
  vy: number;
  t: number;
  color: string;
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const SKIN = '#f5efe0';
const FOE = '#ff7d6e';

export class Fight {
  input: Input = { left: false, right: false, jump: false, attack: false, block: false, dodge: false };
  /** Slowed right down while the player types a guess. */
  timeScale = 1;
  state: 'playing' | 'finishing' | 'done' = 'playing';
  won = false;
  time = 0;
  hitsTaken = 0;
  knockouts = 0;
  dealt = 0;

  private player: Body = { x: 180, y: FLOOR, vx: 0, vy: 0, face: 1, hp: PLAYER_HP, scale: 1, hurtT: 0, walk: 0 };
  private maxHp = PLAYER_HP;
  private punch: { t: number; step: number; hit: boolean } | null = null;
  private comboT = 0;
  private comboStep = 0;
  private dodgeT = 0;
  private dodgeCd = 0;
  private slowT = 0;
  private koT = 0;
  private held: 'carried' | 'pulled' | null = null;
  private prev = { jump: false, attack: false, dodge: false };

  private enemy: Body;
  private move: Move | null = null;
  private phase: 'windup' | 'active' | 'recover' = 'windup';
  private phaseT = 0;
  private idleT = 0.9;
  private cooldowns: Record<string, number> = {};
  private staggerT = 0;
  private rage = 0;
  private poise = 0;
  private poiseT = 0;
  private burstT = 0;
  private tickT = 0;
  private struck = false;
  private aim = { x: 0, y: 0 };
  private forced: string | null = null;
  private trail: { x: number; y: number }[] = [];
  private trailT = 0;
  private landed = false;
  private hookLine: Shot | null = null;

  private shots: Shot[] = [];
  private mines: { x: number; t: number }[] = [];
  private walls: { x: number; t: number; side: number; sideFoe: number }[] = [];
  private fx: Fx[] = [];
  private sparks: Spark[] = [];
  private shake = 0;
  private hitStop = 0;
  private flash = 0;
  private endT = 0;
  private acc = 0;
  private rand: () => number;

  constructor(
    private fighter: Fighter,
    seed: string,
    private onEvent: (e: FightEvent) => void,
  ) {
    this.rand = mulberry32(hashString(seed));
    this.enemy = { x: W - 180, y: fighter.hover ? FLOOR - fighter.hover : FLOOR, vx: 0, vy: 0, face: -1, hp: ENEMY_HP, scale: fighter.scale, hurtT: 0, walk: 0 };
  }

  get hp() {
    return { player: this.player.hp / this.maxHp, playerMax: this.maxHp / PLAYER_HP, enemy: this.enemy.hp / ENEMY_HP };
  }

  /** A wrong name: it heals, and comes back faster. */
  wrongGuess() {
    this.enemy.hp = Math.min(ENEMY_HP, this.enemy.hp + 24);
    this.rage++;
    this.staggerT = 0;
    this.ring(this.enemy.x, this.enemy.y - 45, 20, 120, FOE, 0.4);
    this.shake = 6;
  }

  /** The end: the right name lands the finishing blow; out of guesses, it walks away the winner. */
  finish(won: boolean) {
    if (this.state !== 'playing') return;
    this.won = won;
    this.state = 'finishing';
    this.endT = won ? 1.5 : 1.1;
    this.shots = [];
    this.move = null;
    this.timeScale = 1;
    if (won) {
      this.koT = 0;
      this.held = null;
      this.player.x = clamp(this.enemy.x + this.enemy.face * 70, 30, W - 30);
      this.player.y = FLOOR;
      this.player.face = this.enemy.x > this.player.x ? 1 : -1;
      this.punch = { t: 0.08, step: 2, hit: true };
      this.enemy.vx = this.player.face * 900;
      this.enemy.vy = -620;
      this.enemy.hp = 0;
      this.flash = 1;
      this.shake = 22;
      this.hitStop = 0.28;
      this.burst(this.enemy.x, this.enemy.y - 45, 46, '#fff');
      this.ring(this.enemy.x, this.enemy.y - 45, 10, 260, '#fff', 0.55);
      this.onEvent('finish');
    } else {
      this.player.hp = 0;
      this.koT = 99;
    }
  }

  /** Runs the fight on by this much real time. */
  update(real: number) {
    if (this.state === 'done') return;
    if (this.state === 'playing') this.time += real;
    this.acc += Math.min(real, 0.1) * this.timeScale;
    while (this.acc >= STEP) {
      this.acc -= STEP;
      this.step();
    }
  }

  private step() {
    const dt = STEP;
    this.flash = Math.max(0, this.flash - dt * 2.5);
    this.shake = Math.max(0, this.shake - dt * 40);
    if (this.hitStop > 0) {
      this.hitStop -= dt;
      return;
    }
    for (const f of this.fx) f.t += dt;
    this.fx = this.fx.filter((f) => f.t < f.dur);
    for (const s of this.sparks) {
      s.t -= dt;
      s.vy += GRAVITY * 0.5 * dt;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
    }
    this.sparks = this.sparks.filter((s) => s.t > 0);
    if (this.state === 'finishing') {
      this.endT -= dt;
      this.fall(this.enemy, dt);
      this.fall(this.player, dt);
      if (this.endT <= 0) {
        this.state = 'done';
        this.onEvent('done');
      }
      return;
    }
    this.stepPlayer(dt);
    this.stepEnemy(dt);
    this.stepWorld(dt);
  }

  private fall(b: Body, dt: number) {
    b.vy += GRAVITY * dt;
    b.x = clamp(b.x + b.vx * dt, 20, W - 20);
    b.y += b.vy * dt;
    if (b.y >= FLOOR) {
      b.y = FLOOR;
      b.vy = 0;
      b.vx *= 0.8;
    }
  }

  private stepPlayer(dt: number) {
    const p = this.player;
    const e = this.enemy;
    const inp = this.input;
    const press = { jump: inp.jump && !this.prev.jump, attack: inp.attack && !this.prev.attack, dodge: inp.dodge && !this.prev.dodge };
    this.prev = { jump: inp.jump, attack: inp.attack, dodge: inp.dodge };
    p.hurtT = Math.max(0, p.hurtT - dt);
    this.dodgeT = Math.max(0, this.dodgeT - dt);
    this.dodgeCd = Math.max(0, this.dodgeCd - dt);
    this.slowT = Math.max(0, this.slowT - dt);
    this.comboT = Math.max(0, this.comboT - dt);

    if (this.koT > 0) {
      this.koT -= dt;
      this.fall(p, dt);
      if (this.koT <= 0) {
        // Back up, weaker: the fight never ends on a knockout.
        this.maxHp = Math.max(40, this.maxHp - 15);
        p.hp = this.maxHp;
        this.dodgeT = 0.8;
        p.vx = 0;
      }
      return;
    }
    if (this.held) {
      if (this.held === 'pulled') {
        const to = e.x + e.face * 58 * e.scale;
        p.x += (to - p.x) * Math.min(1, dt * 14);
        p.y += (FLOOR - p.y) * Math.min(1, dt * 14);
        if (Math.abs(p.x - to) < 8) {
          this.held = null;
          p.hurtT = 0.25;
        }
      }
      return;
    }

    const stunned = p.hurtT > 0;
    const blocking = inp.block && !stunned && !this.punch && p.y >= FLOOR && this.dodgeT <= 0;
    const speed = 275 * (this.slowT > 0 ? 0.55 : 1) * (blocking ? 0.35 : 1);
    if (this.dodgeT > 0) {
      p.vx = p.face * 620;
    } else if (!stunned) {
      const dir = (inp.right ? 1 : 0) - (inp.left ? 1 : 0);
      p.vx = dir * speed * (this.punch ? 0.45 : 1);
      if (dir) p.face = dir;
      else if (!this.punch) p.face = e.x > p.x ? 1 : -1;
      if (blocking) p.face = e.x > p.x ? 1 : -1;
      if (press.jump && p.y >= FLOOR) p.vy = -660;
      if (press.dodge && this.dodgeCd <= 0) {
        this.dodgeT = DODGE_TIME;
        this.dodgeCd = DODGE_COOLDOWN;
        this.punch = null;
        this.onEvent('dodge');
      }
      if (press.attack && !this.punch && this.dodgeT <= 0) {
        const step = this.comboT > 0 ? (this.comboStep + 1) % PUNCHES.length : 0;
        this.comboStep = step;
        this.comboT = 0.55;
        this.punch = { t: 0, step, hit: false };
        p.face = e.x > p.x ? 1 : -1;
      }
    } else {
      p.vx *= 0.92;
    }
    p.vy += GRAVITY * dt;
    p.x = this.blocked(p.x + p.vx * dt, 'side');
    p.x = clamp(p.x, 20, W - 20);
    p.y += p.vy * dt;
    if (p.y >= FLOOR) {
      p.y = FLOOR;
      p.vy = 0;
    }
    if (Math.abs(p.vx) > 10 && p.y >= FLOOR) p.walk += Math.abs(p.vx) * dt * 0.05;

    if (this.punch) {
      this.punch.t += dt;
      const pu = this.punch;
      if (!pu.hit && pu.t > 0.07 && pu.t < 0.16) {
        const dx = (e.x - p.x) * p.face;
        const fist = p.y - 58;
        const top = e.y - 98 * e.scale - 16;
        if (dx > -14 && dx < PUNCH_REACH + 16 * e.scale && fist > top && fist < e.y + 16) {
          pu.hit = true;
          this.hitEnemy(PUNCHES[pu.step].damage, PUNCHES[pu.step].kb);
        }
      }
      if (pu.t >= PUNCH_TIME) this.punch = null;
    }
    // Mines go off under the player's feet.
    this.mines = this.mines.filter((m) => {
      if (p.y < FLOOR - 4 || Math.abs(m.x - p.x) > 26 || this.dodgeT > 0) return true;
      this.hurtPlayer(this.fighter.moves.find((x) => x.kind === 'mine')?.damage ?? 8, { fromX: m.x, kb: 80, slow: true, unblockable: true });
      this.ring(m.x, FLOOR, 6, 70, '#a855f7', 0.4);
      return false;
    });
  }

  /** Stops at an ice wall. */
  private blocked(to: number, side: 'side' | 'sideFoe') {
    for (const w of this.walls) {
      const s = w[side];
      if (s > 0 && to < w.x + 24) return Math.max(to, w.x + 24);
      if (s < 0 && to > w.x - 24) return Math.min(to, w.x - 24);
    }
    return to;
  }

  private hitEnemy(damage: number, kb: number) {
    const e = this.enemy;
    const p = this.player;
    const dir = e.x > p.x ? 1 : -1;
    const guard = this.move?.kind === 'guard' && this.phase === 'active' ? this.move : null;
    if (guard?.counter) {
      const counter = this.fighter.moves.find((m) => m.name === guard.counter);
      this.ring(e.x, e.y - 45 * e.scale, 12, 80, '#7dffb0', 0.3);
      this.onEvent('block');
      if (counter) {
        this.cooldowns[counter.name] = 0;
        this.begin(counter);
      }
      return;
    }
    if (guard?.look === 'ice') {
      this.burst(p.x + p.face * 50, p.y - 58, 6, '#bfefff');
      this.onEvent('block');
      return;
    }
    if (guard?.look === 'shield' && e.face === -dir) {
      this.burst(p.x + p.face * 50, p.y - 58, 6, '#7dd3fc');
      this.onEvent('block');
      return;
    }
    if (guard?.look === 'dome') damage *= 0.5;

    const before = Math.floor(this.dealt / CLUE_EVERY);
    this.dealt += damage;
    e.hp = Math.max(0, e.hp - damage);
    e.hurtT = 0.12;
    this.burst(e.x, e.y - 55 * e.scale, 7, '#ffd9a0');
    this.hitStop = 0.045;
    this.shake = Math.max(this.shake, 4);
    this.onEvent('hit');
    if (Math.floor(this.dealt / CLUE_EVERY) > before) this.onEvent('clue');

    this.poise += 1;
    this.poiseT = 1.5;
    const stops = !this.fighter.armored && this.poise < 3;
    if (stops) {
      e.vx = dir * kb;
      if (this.phase === 'windup' && this.move) {
        this.cooldowns[this.move.name] = this.move.cooldown * 0.5;
        this.move = null;
        this.idleT = 0.3;
      }
    } else if (this.fighter.armored) {
      e.vx = dir * kb * 0.2;
    }
    if (e.hp <= 0 && this.staggerT <= 0) {
      // It can't be beaten with fists: it drops to one knee and waits for its name.
      this.staggerT = 3;
      this.move = null;
      this.onEvent('stagger');
    }
  }

  private hurtPlayer(damage: number, o: { fromX: number; kb?: number; slow?: boolean; unblockable?: boolean; stun?: number; again?: boolean }) {
    const p = this.player;
    if (this.koT > 0 || this.dodgeT > 0 || this.state !== 'playing') return false;
    const dir = p.x >= o.fromX ? 1 : -1;
    const blocking = this.input.block && p.hurtT <= 0 && !this.punch && p.y >= FLOOR && p.face === -dir;
    if (blocking && !o.unblockable) {
      p.hp -= damage * 0.2;
      p.vx = dir * (o.kb ?? 0) * 0.35;
      this.burst(p.x + p.face * 18, p.y - 60, 5, '#9ad8ff');
      this.onEvent('block');
    } else {
      if (!o.again) this.hitsTaken++;
      p.hp -= damage;
      p.hurtT = o.stun ?? 0.28;
      p.vx = dir * (o.kb ?? 60);
      if ((o.kb ?? 0) > 200) p.vy = -(o.kb ?? 0) * 0.55;
      this.punch = null;
      this.burst(p.x, p.y - 55, 9, '#ff6a5a');
      this.hitStop = 0.06;
      this.shake = Math.max(this.shake, 7 + damage / 3);
      this.onEvent('hurt');
    }
    if (o.slow) this.slowT = 1.1;
    if (p.hp <= 0) {
      p.hp = 0;
      this.knockouts++;
      this.koT = 1.7;
      this.held = null;
      this.input.block = false;
      this.onEvent('ko');
    }
    return true;
  }

  private begin(m: Move) {
    this.move = m;
    this.phase = 'windup';
    this.phaseT = m.windup / (1 + this.rage * 0.12);
    this.struck = false;
    this.burstT = 0;
    this.tickT = 0;
    this.landed = false;
    const p = this.player;
    this.aim = { x: p.x, y: p.y - 50 };
  }

  private stepEnemy(dt: number) {
    const e = this.enemy;
    const p = this.player;
    const f = this.fighter;
    e.hurtT = Math.max(0, e.hurtT - dt);
    this.poiseT -= dt;
    if (this.poiseT <= 0) this.poise = 0;
    for (const k of Object.keys(this.cooldowns)) this.cooldowns[k] = Math.max(0, this.cooldowns[k] - dt);

    this.trailT -= dt;
    if (this.trailT <= 0) {
      this.trailT = 0.1;
      this.trail.push({ x: e.x, y: e.y });
      if (this.trail.length > 25) this.trail.shift();
    }

    if (this.staggerT > 0) {
      this.staggerT -= dt;
      e.vx *= 0.9;
      e.x = clamp(e.x + e.vx * dt, 30, W - 30);
      if (this.staggerT <= 0) {
        e.hp = ENEMY_HP * 0.3;
        this.idleT = 0.3;
      }
      this.gravityFor(e, dt);
      return;
    }

    const d = Math.abs(p.x - e.x);
    if (this.move) this.stepMove(this.move, dt);
    else {
      e.face = p.x > e.x ? 1 : -1;
      this.idleT -= dt;
      // Keep to its favourite distance.
      let want = 0;
      if (d > f.keep[1]) want = e.face;
      else if (d < f.keep[0]) want = -e.face;
      const pace = f.speed * (1 + this.rage * 0.08);
      const target = want * pace;
      e.vx += (target - e.vx) * Math.min(1, dt * 10);
      if (this.koT <= 0 && this.idleT <= 0) {
        const next = this.forced ? f.moves.find((m) => m.name === this.forced) : this.choose(d);
        this.forced = null;
        if (next) this.begin(next);
        else this.idleT = 0.12;
      }
    }

    const mv = this.move;
    const moving = mv && (mv.kind === 'dash' || mv.kind === 'leap') && this.phase === 'active';
    if (!moving) e.vx *= mv ? 0.85 : 1;
    e.x = clamp(this.blocked(e.x + e.vx * dt, 'sideFoe'), 30, W - 30);
    if (Math.abs(e.vx) > 10 && (e.y >= FLOOR || f.hover)) e.walk += Math.abs(e.vx) * dt * 0.05;
    this.gravityFor(e, dt);
  }

  private gravityFor(e: Body, dt: number) {
    const f = this.fighter;
    if (f.hover) {
      // Staggered, it sinks in reach; otherwise it bobs at its height.
      const to = this.staggerT > 0 ? FLOOR : FLOOR - f.hover - Math.sin(this.time * 1.7) * 14;
      e.y += (to - e.y) * Math.min(1, dt * 3);
      return;
    }
    e.vy += GRAVITY * dt;
    e.y += e.vy * dt;
    if (e.y >= FLOOR) {
      e.y = FLOOR;
      e.vy = 0;
    }
  }

  /** The next move: one it can use from here, by chance (seeded: the same fighter fights the same way). */
  private choose(d: number): Move | undefined {
    const ok = this.fighter.moves.filter((m) => !this.cooldowns[m.name] && d >= (m.min ?? 0) && d <= (m.max ?? Infinity));
    if (!ok.length) return undefined;
    return ok[Math.floor(this.rand() * ok.length)];
  }

  private stepMove(m: Move, dt: number) {
    const e = this.enemy;
    const p = this.player;
    this.phaseT -= dt;
    if (this.phase === 'windup') {
      e.face = p.x > e.x ? 1 : -1;
      // A sniper's aim follows until the last moment.
      if (m.kind !== 'snipe' || this.phaseT > 0.22) this.aim = { x: p.x, y: p.y - 50 };
      if (this.phaseT <= 0) {
        this.phase = 'active';
        this.phaseT = m.active;
        this.fire(m);
      }
      return;
    }
    if (this.phase === 'active') {
      this.during(m, dt);
      if (this.phaseT <= 0 && this.move === m) this.endActive(m);
      return;
    }
    if (this.phaseT <= 0) {
      this.cooldowns[m.name] = m.cooldown;
      this.move = null;
      this.idleT = (m.then ? 0 : 0.22 + this.rand() * 0.3) / (1 + this.rage * 0.12);
      if (m.kind === 'hook' && this.struck && m.then) this.forced = m.then;
    }
  }

  private endActive(m: Move) {
    const e = this.enemy;
    if (m.kind === 'dash') e.vx = 0;
    if (this.held === 'carried') {
      this.held = null;
      this.player.hurtT = 0.35;
      this.player.vx = e.face * 320;
      this.player.vy = -260;
      this.shake = 12;
    }
    this.phase = 'recover';
    this.phaseT = m.recover / (1 + this.rage * 0.12);
  }

  /** The moment a move goes off. */
  private fire(m: Move) {
    const e = this.enemy;
    const p = this.player;
    const dir = p.x > e.x ? 1 : -1;
    switch (m.kind) {
      case 'shot':
        if (!m.burst) this.spawnShots(m);
        break;
      case 'hook':
        this.spawnShots(m);
        break;
      case 'snipe': {
        const from = this.muzzle();
        const dx = this.aim.x - from.x;
        const dy = this.aim.y - from.y;
        const len = Math.hypot(dx, dy) || 1;
        const t = ((p.x - from.x) * dx + (p.y - 50 - from.y) * dy) / (len * len);
        const near = Math.hypot(from.x + dx * t - p.x, from.y + dy * t - (p.y - 50));
        const far = 1400 / len;
        this.line(from.x, from.y, from.x + dx * far, from.y + dy * far, '#ff4d6d', 3, 0.16);
        if (t > 0 && near < 26) this.hurtPlayer(m.damage ?? 0, { fromX: e.x, kb: m.kb });
        this.onEvent('blast');
        break;
      }
      case 'dash':
        e.face = dir;
        this.onEvent('dodge');
        break;
      case 'leap': {
        const far = e.x < p.x ? 60 : W - 60;
        const to = m.away ? (Math.abs(far - e.x) < 200 ? (far === 60 ? W - 60 : 60) : far) : clamp(p.x, 40, W - 40);
        const t = m.active;
        e.vx = (to - e.x) / t;
        e.vy = -0.5 * GRAVITY * t;
        if (m.grapple) this.line(e.x, e.y - 70, to, 0, '#d9d4ff', 2, t);
        this.onEvent('dodge');
        break;
      }
      case 'blink': {
        const from = e.x;
        const near = Math.abs(p.x - e.x) < 120;
        const away = e.x > p.x ? 1 : -1;
        // Close: gets out. Far: closes in, sometimes right past the player.
        const to = near ? e.x + away * (m.dist ?? 150) : p.x + (this.rand() < 0.5 ? 1 : -1) * 120;
        e.x = clamp(to, 40, W - 40);
        this.line(from, e.y - 50, e.x, e.y - 50, '#7dd3fc', 5, 0.18);
        this.onEvent('dodge');
        break;
      }
      case 'recall': {
        const back = this.trail[0];
        if (back) {
          this.trail.forEach((b, i) => i && this.line(this.trail[i - 1].x, this.trail[i - 1].y - 50, b.x, b.y - 50, '#7dd3fc', 2, 0.5));
          e.x = back.x;
          e.y = back.y;
        }
        e.hp = Math.min(ENEMY_HP, e.hp + (m.heal ?? 0));
        this.ring(e.x, e.y - 45, 50, 8, '#7dd3fc', 0.35);
        this.onEvent('dodge');
        break;
      }
      case 'shock': {
        this.ring(e.x, e.y - 40, 16, m.reach ?? 120, '#fff', 0.3);
        if (Math.hypot(p.x - e.x, p.y - e.y) < (m.reach ?? 120)) this.hurtPlayer(m.damage ?? 0, { fromX: e.x, kb: m.kb, unblockable: true });
        e.vx = -dir * 180;
        this.onEvent('blast');
        break;
      }
      case 'mine':
        if (this.mines.length >= 2) this.mines.shift();
        this.mines.push({ x: e.x, t: 12 });
        break;
      case 'wall': {
        const x = (e.x + p.x) / 2;
        if (Math.abs(p.x - x) > 34 && Math.abs(e.x - x) > 34) this.walls = [{ x, t: 3.2, side: p.x > x ? 1 : -1, sideFoe: e.x > x ? 1 : -1 }];
        this.burst(x, FLOOR - 60, 14, '#bfefff');
        this.onEvent('block');
        break;
      }
      default:
        break;
    }
  }

  /** What a move does while it lasts. */
  private during(m: Move, dt: number) {
    const e = this.enemy;
    const p = this.player;
    const reachY = 110 * e.scale;
    switch (m.kind) {
      case 'melee': {
        const dx = (p.x - e.x) * e.face;
        if (!this.struck && dx > -18 && dx < (m.reach ?? 80) && Math.abs(p.y - e.y) < reachY) {
          this.struck = true;
          this.hurtPlayer(m.damage ?? 0, { fromX: e.x, kb: m.kb });
        }
        break;
      }
      case 'shot':
        if (m.burst) {
          this.burstT -= dt;
          if (this.burstT <= 0) {
            this.burstT = m.burst;
            this.aim = { x: p.x, y: p.y - 50 };
            this.spawnShots(m);
          }
        }
        break;
      case 'dash': {
        e.vx = e.face * (m.speed ?? 700);
        if (this.held === 'carried') {
          p.x = clamp(e.x + e.face * 56 * e.scale, 20, W - 20);
          p.y = FLOOR;
        }
        if (!this.struck && Math.abs(p.x - e.x) < 46 * e.scale && Math.abs(p.y - e.y) < reachY) {
          this.struck = true;
          if (this.hurtPlayer(m.damage ?? 0, { fromX: m.through ? e.x - e.face * 40 : e.x, kb: m.kb }) && m.carry && this.koT <= 0 && this.player.hurtT > 0) this.held = 'carried';
          if (!m.through && !m.carry) this.phaseT = 0;
        }
        if (e.x <= 31 || e.x >= W - 31) {
          this.shake = 10;
          this.phaseT = 0;
        }
        break;
      }
      case 'leap':
        e.vx = e.vx || 0;
        if (e.y >= FLOOR && e.vy >= 0 && !this.landed && this.phaseT < m.active - 0.1) {
          this.landed = true;
          e.vx = 0;
          if (m.shock) {
            this.ring(e.x, FLOOR - 4, 14, m.shock, '#ffb86b', 0.3);
            this.burst(e.x, FLOOR, 14, '#ffb86b');
            this.shake = 13;
            this.onEvent('blast');
            if (Math.abs(p.x - e.x) < m.shock && p.y > FLOOR - 40) this.hurtPlayer(m.damage ?? 0, { fromX: e.x, kb: m.kb });
          }
          this.phaseT = 0;
        }
        break;
      case 'stream':
        this.tickT -= dt;
        if (this.tickT <= 0) {
          this.tickT = 0.15;
          const dx = (p.x - e.x) * e.face;
          // One beam is one hit taken, however long the player stays in it.
          if (dx > 0 && dx < (m.reach ?? 180) && Math.abs(p.y - e.y) < 90 && this.hurtPlayer(m.damage ?? 0, { fromX: e.x, slow: m.slow, stun: 0.04, again: this.struck })) this.struck = true;
        }
        break;
      case 'guard':
        e.face = p.x > e.x ? 1 : -1;
        if (m.heal) e.hp = Math.min(ENEMY_HP, e.hp + m.heal * dt);
        break;
      default:
        break;
    }
    if (m.kind === 'hook' && this.hookLine && !this.shots.includes(this.hookLine)) {
      // Waits for its chain to come back.
      this.hookLine = null;
    } else if (m.kind === 'hook' && this.hookLine) this.phaseT = Math.max(this.phaseT, 0.02);
  }

  private muzzle() {
    const e = this.enemy;
    return { x: e.x + e.face * 34 * e.scale, y: e.y - 66 * e.scale };
  }

  private spawnShots(m: Move) {
    const from = this.muzzle();
    const dx = this.aim.x - from.x;
    const dy = this.aim.y - from.y;
    const speed = m.speed ?? 500;
    const count = m.count ?? 1;
    const base = Math.atan2(dy, dx);
    for (let i = 0; i < count; i++) {
      const off = count > 1 ? ((i / (count - 1)) * 2 - 1) * (m.spread ?? 0) : (this.rand() * 2 - 1) * (m.spread ?? 0);
      const a = base + off;
      let vx = Math.cos(a) * speed;
      let vy = Math.sin(a) * speed;
      const g = m.arc ? GRAVITY * 0.45 : 0;
      if (m.arc) {
        // Lobbed: drops onto the target.
        const t = Math.abs(dx) / speed || 0.1;
        vx = Math.sign(dx) * speed;
        vy = dy / t - 0.5 * g * t;
      }
      const shot: Shot = { x: from.x, y: from.y, vx, vy, g, move: m, shape: m.shape ?? 'pellet', life: 3, hook: m.kind === 'hook' };
      this.shots.push(shot);
      if (shot.hook) this.hookLine = shot;
    }
    this.onEvent('dodge');
  }

  private stepWorld(dt: number) {
    const p = this.player;
    const e = this.enemy;
    for (const w of this.walls) w.t -= dt;
    this.walls = this.walls.filter((w) => w.t > 0);
    for (const m of this.mines) m.t -= dt;
    this.mines = this.mines.filter((m) => m.t > 0);

    this.shots = this.shots.filter((s) => {
      s.vy += s.g * dt;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.life -= dt;
      const gone = s.life <= 0 || s.x < -40 || s.x > W + 40 || (s.shape !== 'wave' && s.y >= FLOOR);
      const walled = this.walls.some((w) => Math.abs(s.x - w.x) < 18);
      if (gone || walled) {
        if (s.move.blast && !walled) this.explode(s);
        return false;
      }
      const near = Math.hypot(s.x - p.x, s.y - (p.y - 48));
      if (near < (s.shape === 'wave' ? 44 : 28) && this.koT <= 0 && this.dodgeT <= 0) {
        if (s.move.blast) {
          this.explode(s);
          return false;
        }
        if (this.hurtPlayer(s.move.damage ?? 0, { fromX: s.x - Math.sign(s.vx), kb: s.move.kb ?? 50, slow: s.move.slow })) {
          if (s.hook && this.koT <= 0) {
            this.held = 'pulled';
            this.struck = true;
            e.face = p.x > e.x ? 1 : -1;
          }
          return s.shape === 'wave';
        }
      }
      return true;
    });
  }

  private explode(s: Shot) {
    const p = this.player;
    const r = s.move.blast ?? 60;
    this.ring(s.x, s.y, 10, r, '#ffb86b', 0.28);
    this.burst(s.x, s.y, 12, '#ffb86b');
    this.shake = Math.max(this.shake, 8);
    this.onEvent('blast');
    if (Math.hypot(s.x - p.x, s.y - (p.y - 48)) < r + 12) this.hurtPlayer(s.move.damage ?? 0, { fromX: s.x, kb: s.move.kb });
  }

  private line(x: number, y: number, x2: number, y2: number, color: string, width: number, dur: number) {
    this.fx.push({ kind: 'line', x, y, x2, y2, color, width, t: 0, dur });
  }

  private ring(x: number, y: number, r0: number, r1: number, color: string, dur: number) {
    this.fx.push({ kind: 'ring', x, y, r0, r1, color, width: 3, t: 0, dur });
  }

  private burst(x: number, y: number, n: number, color: string) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = 60 + Math.random() * 300;
      this.sparks.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 80, t: 0.2 + Math.random() * 0.3, color });
    }
  }

  // ---- Drawing ----

  draw(c: CanvasRenderingContext2D) {
    c.clearRect(0, 0, W, H);
    const sky = c.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, '#191525');
    sky.addColorStop(1, '#0c0a12');
    c.fillStyle = sky;
    c.fillRect(0, 0, W, H);
    c.save();
    if (this.shake > 0) c.translate((Math.random() - 0.5) * this.shake, (Math.random() - 0.5) * this.shake);
    c.fillStyle = '#231e32';
    c.fillRect(-20, FLOOR, W + 40, H - FLOOR + 20);
    c.strokeStyle = '#6d6490';
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(-20, FLOOR);
    c.lineTo(W + 20, FLOOR);
    c.stroke();

    for (const w of this.walls) {
      c.fillStyle = 'rgba(160,225,255,0.65)';
      c.strokeStyle = '#e4f8ff';
      c.fillRect(w.x - 18, FLOOR - 190, 36, 190);
      c.strokeRect(w.x - 18, FLOOR - 190, 36, 190);
    }
    for (const m of this.mines) {
      c.fillStyle = '#a855f7';
      c.beginPath();
      c.arc(m.x, FLOOR - 4, 7, Math.PI, 0);
      c.fill();
    }

    this.drawEnemy(c);
    this.drawPlayer(c);

    for (const s of this.shots) this.drawShot(c, s);
    for (const f of this.fx) {
      const k = f.t / f.dur;
      c.globalAlpha = 1 - k;
      c.strokeStyle = f.color;
      c.lineWidth = f.width;
      c.beginPath();
      if (f.kind === 'line') {
        c.moveTo(f.x, f.y);
        c.lineTo(f.x2 ?? f.x, f.y2 ?? f.y);
      } else {
        c.arc(f.x, f.y, (f.r0 ?? 0) + ((f.r1 ?? 0) - (f.r0 ?? 0)) * k, 0, Math.PI * 2);
      }
      c.stroke();
    }
    c.globalAlpha = 1;
    for (const s of this.sparks) {
      c.fillStyle = s.color;
      c.fillRect(s.x - 1.5, s.y - 1.5, 3, 3);
    }
    c.restore();

    if (this.flash > 0) {
      c.fillStyle = `rgba(255,255,255,${this.flash * 0.8})`;
      c.fillRect(0, 0, W, H);
    }
    this.drawHud(c);
  }

  private drawHud(c: CanvasRenderingContext2D) {
    const bar = (x: number, w: number, k: number, color: string, label: string, right: boolean) => {
      c.fillStyle = 'rgba(0,0,0,0.55)';
      c.fillRect(x, 20, w, 14);
      c.fillStyle = color;
      const fill = w * clamp(k, 0, 1);
      c.fillRect(right ? x + w - fill : x, 20, fill, 14);
      c.strokeStyle = 'rgba(255,255,255,0.5)';
      c.strokeRect(x, 20, w, 14);
      c.fillStyle = '#fff';
      c.font = 'bold 13px sans-serif';
      c.textAlign = right ? 'right' : 'left';
      c.fillText(label, right ? x + w : x, 52);
    };
    bar(24, 340 * (this.maxHp / PLAYER_HP), this.player.hp / this.maxHp, '#5eead4', 'You', false);
    bar(W - 364, 340, this.enemy.hp / ENEMY_HP, FOE, this.state === 'done' || (this.state === 'finishing' && this.won) ? this.fighter.name : '???', true);
    c.textAlign = 'center';
    c.font = 'bold 20px sans-serif';
    c.fillStyle = '#fff';
    const s = Math.floor(this.time);
    c.fillText(`${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`, W / 2, 34);
    if (this.timeScale < 1) {
      c.font = 'bold 14px sans-serif';
      c.fillStyle = '#7dd3fc';
      c.fillText('slow motion: who is it?', W / 2, 56);
    }
    if (this.koT > 0 && this.state === 'playing') {
      c.font = 'bold 34px sans-serif';
      c.fillStyle = FOE;
      c.fillText('KNOCKED DOWN', W / 2, 150);
      c.font = '15px sans-serif';
      c.fillStyle = '#fff';
      c.fillText('You get back up, but weaker', W / 2, 176);
    } else if (this.staggerT > 0 && this.state === 'playing') {
      c.font = 'bold 30px sans-serif';
      c.fillStyle = '#ffe28a';
      c.fillText('NAME THEM TO FINISH THE FIGHT!', W / 2, 150);
    }
  }

  private drawPlayer(c: CanvasRenderingContext2D) {
    const p = this.player;
    if (this.dodgeT > 0) c.globalAlpha = 0.45;
    const blocking = this.input.block && p.hurtT <= 0 && !this.punch && p.y >= FLOOR && this.koT <= 0;
    let front = 0.5;
    let back = 1;
    if (this.punch) {
      const k = this.punch.t / PUNCH_TIME;
      front = k < 0.3 ? 1.5 : k < 0.7 ? (this.punch.step === 2 ? -0.5 : -0.1) : 0.7;
      back = this.punch.step === 1 ? -0.1 : 1.4;
    } else if (blocking) {
      front = -1.1;
      back = -0.9;
    }
    this.drawStick(c, p, SKIN, front, back, this.koT > 0, p.hurtT > 0, 1);
    c.globalAlpha = 1;
    if (blocking) {
      c.strokeStyle = 'rgba(154,216,255,0.8)';
      c.lineWidth = 3;
      c.beginPath();
      c.arc(p.x, p.y - 52, 40, -1, 1);
      if (p.face < 0) {
        c.beginPath();
        c.arc(p.x, p.y - 52, 40, Math.PI - 1, Math.PI + 1);
      }
      c.stroke();
    }
  }

  private drawEnemy(c: CanvasRenderingContext2D) {
    const e = this.enemy;
    const m = this.move;
    const f = this.fighter;
    const sx = e.x + e.face * 8 * e.scale;
    const sy = e.y - 78 * e.scale;
    const aiming = Math.atan2(this.aim.y - sy, (this.aim.x - sx) * e.face);
    let front = f.weapon === 'katana' || f.weapon === 'hammer' || f.weapon === 'gauntlet' ? 0.7 : 0.15;
    let back = f.weapon === 'pistols' ? front : 1.1;
    if (m) {
      const ranged = m.kind === 'shot' || m.kind === 'snipe' || m.kind === 'hook' || m.kind === 'stream';
      if (ranged) {
        front = aiming;
        if (f.weapon === 'pistols' || f.weapon === 'bow') back = aiming;
      } else if (m.kind === 'melee') {
        if (this.phase === 'windup') front = -2.3;
        else if (this.phase === 'active') front = -2.3 + 3 * (1 - this.phaseT / m.active);
        else front = 0.8;
      } else if (m.kind === 'dash') {
        front = this.phase === 'windup' ? 2.7 : 0;
      } else if (m.kind === 'guard') {
        front = -0.9;
        back = -1.1;
      } else if (m.kind === 'leap') {
        front = m.shock && this.phase === 'active' ? -1.6 : 0.2;
      }
    } else if (f.weapon === 'rifle' || f.weapon === 'launcher' || f.weapon === 'shotgun' || f.weapon === 'blaster' || f.weapon === 'tesla' || f.weapon === 'bow') {
      front = aiming * 0.6;
    }

    // The tell: anything about to strike glows.
    if (m && this.phase === 'windup' && m.kind !== 'blink' && m.windup > 0.12) {
      c.fillStyle = 'rgba(255,90,70,0.2)';
      c.beginPath();
      c.arc(e.x, e.y - 50 * e.scale, 62 * e.scale, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = '#ffdf6b';
      c.font = 'bold 24px sans-serif';
      c.textAlign = 'center';
      c.fillText('!', e.x, e.y - 118 * e.scale);
    }
    if (f.hover && this.staggerT <= 0) {
      c.strokeStyle = 'rgba(255,190,110,0.8)';
      c.lineWidth = 2;
      for (const o of [-9, 9]) {
        c.beginPath();
        c.moveTo(e.x + o, e.y + 2);
        c.lineTo(e.x + o + (Math.random() - 0.5) * 8, e.y + 22 + Math.random() * 16);
        c.stroke();
      }
    }
    if (m?.kind === 'dash' && this.phase === 'active') {
      c.strokeStyle = 'rgba(255,255,255,0.4)';
      c.lineWidth = 3;
      for (const o of [-60, -35, -10]) {
        c.beginPath();
        c.moveTo(e.x - e.face * 30, e.y + o * e.scale);
        c.lineTo(e.x - e.face * (90 + Math.random() * 60), e.y + o * e.scale);
        c.stroke();
      }
    }
    if (m?.kind === 'snipe' && this.phase === 'windup') {
      const from = this.muzzle();
      const locked = this.phaseT <= 0.22;
      const dx = this.aim.x - from.x;
      const dy = this.aim.y - from.y;
      const len = Math.hypot(dx, dy) || 1;
      c.strokeStyle = locked ? '#ff4d6d' : 'rgba(255,77,109,0.55)';
      c.lineWidth = locked ? 2.5 : 1;
      c.beginPath();
      c.moveTo(from.x, from.y);
      c.lineTo(from.x + (dx / len) * 1400, from.y + (dy / len) * 1400);
      c.stroke();
    }

    const kneeling = this.staggerT > 0;
    this.drawStick(c, e, FOE, front, back, this.state === 'finishing' && this.won, e.hurtT > 0, 1 + (e.scale - 1) * 1.6, kneeling);
    this.drawWeapon(c, f.weapon, e, front, back);

    if (m?.kind === 'stream' && this.phase === 'active') {
      const from = this.muzzle();
      c.strokeStyle = f.weapon === 'tesla' ? '#9dd9ff' : '#d5f6ff';
      c.lineWidth = f.weapon === 'tesla' ? 2 : 6;
      c.globalAlpha = 0.85;
      c.beginPath();
      c.moveTo(from.x, from.y);
      const reach = m.reach ?? 180;
      for (let i = 1; i <= 7; i++) c.lineTo(from.x + e.face * (reach * i) / 7, from.y + 12 + (Math.random() - 0.5) * (f.weapon === 'tesla' ? 30 : 8));
      c.stroke();
      c.globalAlpha = 1;
    }
    if (m?.kind === 'guard' && this.phase === 'active') this.drawGuard(c, m);
    if (this.hookLine) {
      const from = this.muzzle();
      c.strokeStyle = '#b8b2c8';
      c.lineWidth = 3;
      c.setLineDash([6, 4]);
      c.beginPath();
      c.moveTo(from.x, from.y);
      c.lineTo(this.hookLine.x, this.hookLine.y);
      c.stroke();
      c.setLineDash([]);
    }
    if (this.held === 'pulled') {
      const from = this.muzzle();
      c.strokeStyle = '#b8b2c8';
      c.lineWidth = 3;
      c.setLineDash([6, 4]);
      c.beginPath();
      c.moveTo(from.x, from.y);
      c.lineTo(this.player.x, this.player.y - 50);
      c.stroke();
      c.setLineDash([]);
    }
  }

  private drawGuard(c: CanvasRenderingContext2D, m: Move) {
    const e = this.enemy;
    const cy = e.y - 52 * e.scale;
    c.lineWidth = 3;
    switch (m.look) {
      case 'shield':
        c.strokeStyle = '#7dd3fc';
        c.fillStyle = 'rgba(125,211,252,0.25)';
        c.beginPath();
        c.ellipse(e.x + e.face * 64 * e.scale, cy, 16, 92 * e.scale, 0, 0, Math.PI * 2);
        c.fill();
        c.stroke();
        break;
      case 'dome':
        c.strokeStyle = '#a5b4fc';
        c.fillStyle = 'rgba(165,180,252,0.18)';
        c.beginPath();
        c.arc(e.x, e.y, 112 * e.scale, Math.PI, 0);
        c.fill();
        c.stroke();
        break;
      case 'ice':
        c.fillStyle = 'rgba(180,235,255,0.6)';
        c.strokeStyle = '#e4f8ff';
        c.fillRect(e.x - 38, e.y - 108 * e.scale, 76, 108 * e.scale);
        c.strokeRect(e.x - 38, e.y - 108 * e.scale, 76, 108 * e.scale);
        break;
      case 'gas':
        c.fillStyle = 'rgba(180,230,120,0.22)';
        for (let i = 0; i < 6; i++) {
          c.beginPath();
          c.arc(e.x + Math.sin(this.time * 3 + i) * 34, cy - 40 - i * 7, 14 + i * 2, 0, Math.PI * 2);
          c.fill();
        }
        break;
      case 'deflect':
        c.strokeStyle = '#7dffb0';
        c.beginPath();
        c.arc(e.x + e.face * 22, cy, 34, this.time * 24, this.time * 24 + 2.4);
        c.stroke();
        c.beginPath();
        c.arc(e.x + e.face * 22, cy, 34, this.time * 24 + 3.1, this.time * 24 + 5.5);
        c.stroke();
        break;
      default:
        c.strokeStyle = '#ffb86b';
        c.beginPath();
        c.arc(e.x + e.face * 28, cy, 30 * e.scale, -1.1, 1.1);
        if (e.face < 0) {
          c.beginPath();
          c.arc(e.x + e.face * 28, cy, 30 * e.scale, Math.PI - 1.1, Math.PI + 1.1);
        }
        c.stroke();
    }
  }

  /** A stickman. Arm angles are local: 0 straight ahead, negative up, positive down. */
  private drawStick(c: CanvasRenderingContext2D, b: Body, color: string, front: number, back: number, down: boolean, hurt: boolean, thick: number, kneel = false) {
    const s = b.scale;
    c.save();
    c.translate(b.x, b.y);
    if (down) {
      c.rotate(-b.face * 1.45);
      c.translate(0, 8);
    }
    const f = b.face;
    const air = b.y < FLOOR - 2 && !this.fighter.hover;
    const running = Math.abs(b.vx) > 20 && !air;
    const lean = running ? f * 7 * s : kneel ? f * 12 * s : 0;
    const hipY = kneel ? -28 * s : -44 * s;
    const neck = { x: lean, y: hipY - 40 * s };
    const hip = { x: 0, y: hipY };
    c.strokeStyle = hurt ? '#ffffff' : color;
    c.fillStyle = hurt ? '#ffffff' : color;
    c.lineCap = 'round';
    c.lineJoin = 'round';
    c.lineWidth = 4.5 * thick;

    const limb = (from: { x: number; y: number }, to: { x: number; y: number }, len: number, bend: number) => {
      const dx = to.x - from.x;
      const dy = to.y - from.y;
      const d = Math.min(Math.hypot(dx, dy), len * 2 - 0.01);
      const h = Math.sqrt(Math.max(0, len * len - (d * d) / 4));
      const a = Math.atan2(dy, dx);
      const mx = from.x + Math.cos(a) * d * 0.5 - Math.sin(a) * h * bend;
      const my = from.y + Math.sin(a) * d * 0.5 + Math.cos(a) * h * bend;
      c.beginPath();
      c.moveTo(from.x, from.y);
      c.lineTo(mx, my);
      c.lineTo(from.x + Math.cos(a) * d, from.y + Math.sin(a) * d);
      c.stroke();
    };

    // Legs
    let footA: { x: number; y: number };
    let footB: { x: number; y: number };
    if (kneel) {
      footA = { x: f * 22 * s, y: 0 };
      footB = { x: -f * 20 * s, y: 0 };
    } else if (air) {
      footA = { x: f * 16 * s, y: hipY + 30 * s };
      footB = { x: -f * 12 * s, y: hipY + 36 * s };
    } else if (this.fighter.hover && b === this.enemy) {
      footA = { x: f * 6 * s, y: -2 };
      footB = { x: -f * 6 * s, y: -2 };
    } else if (running) {
      footA = { x: Math.sin(b.walk) * 24 * s, y: -Math.max(0, Math.cos(b.walk)) * 12 * s };
      footB = { x: -Math.sin(b.walk) * 24 * s, y: -Math.max(0, -Math.cos(b.walk)) * 12 * s };
    } else {
      footA = { x: f * 15 * s, y: 0 };
      footB = { x: -f * 13 * s, y: 0 };
    }
    limb(hip, footA, 25 * s, f);
    limb(hip, footB, 25 * s, f);

    // Body and head
    c.beginPath();
    c.moveTo(hip.x, hip.y);
    c.lineTo(neck.x, neck.y);
    c.stroke();
    c.beginPath();
    c.arc(neck.x + lean * 0.3, neck.y - 13 * s, 11.5 * s, 0, Math.PI * 2);
    c.fill();

    // Arms
    const shoulder = { x: neck.x, y: neck.y + 6 * s };
    const hand = (ang: number) => ({ x: shoulder.x + Math.cos(ang) * f * 40 * s, y: shoulder.y + Math.sin(ang) * 40 * s });
    limb(shoulder, hand(back), 21 * s, -f);
    limb(shoulder, hand(front), 21 * s, -f);
    c.restore();
  }

  private drawWeapon(c: CanvasRenderingContext2D, w: Weapon, e: Body, front: number, back: number) {
    const s = e.scale;
    const down = this.state === 'finishing' && this.won;
    if (down) return;
    const kneel = this.staggerT > 0;
    const hipY = kneel ? -28 * s : -44 * s;
    const lean = Math.abs(e.vx) > 20 && e.y >= FLOOR ? e.face * 7 * s : kneel ? e.face * 12 * s : 0;
    const sx = lean;
    const sy = hipY - 34 * s;
    const f = e.face;
    const at = (ang: number) => ({ x: e.x + sx + Math.cos(ang) * f * 40 * s, y: e.y + sy + Math.sin(ang) * 40 * s });
    const stroke = (color: string, width: number, ang: number, from: number, to: number, base = at(front)) => {
      c.strokeStyle = color;
      c.lineWidth = width;
      c.beginPath();
      c.moveTo(base.x + Math.cos(ang) * f * from * s, base.y + Math.sin(ang) * from * s);
      c.lineTo(base.x + Math.cos(ang) * f * to * s, base.y + Math.sin(ang) * to * s);
      c.stroke();
    };
    const h = at(front);
    c.lineCap = 'butt';
    switch (w) {
      case 'katana':
        stroke('#dfe7f0', 3, front - 0.5, 0, 56);
        stroke('#7dffb0', 4, front - 0.5, -2, 6);
        break;
      case 'hammer':
        stroke('#8d8799', 5, front - 0.7, -14, 70);
        stroke('#c6c0d4', 24, front - 0.7, 56, 80);
        break;
      case 'rifle':
        stroke('#9c8fd1', 4, front, -18, 64);
        stroke('#d9d4ff', 7, front, 6, 22);
        break;
      case 'launcher':
        stroke('#7aa2d6', 13, front, -16, 44);
        stroke('#ffb86b', 15, front, 40, 46);
        break;
      case 'pistols':
        stroke('#7dd3fc', 5, front, 0, 15);
        stroke('#7dd3fc', 5, back, 0, 15, at(back));
        break;
      case 'bow':
        c.strokeStyle = '#d6b78a';
        c.lineWidth = 3;
        c.beginPath();
        c.arc(h.x, h.y, 34 * s, front - 1.1 + (f < 0 ? Math.PI : 0), front + 1.1 + (f < 0 ? Math.PI : 0));
        c.stroke();
        break;
      case 'shotgun':
        stroke('#8d8799', 9, front, -8, 44);
        stroke('#b8b2c8', 4, front + 0.9, 0, 18);
        break;
      case 'gauntlet':
        c.fillStyle = '#ffb86b';
        c.beginPath();
        c.arc(h.x, h.y, 13 * s, 0, Math.PI * 2);
        c.fill();
        break;
      case 'blaster':
        stroke('#bfefff', 11, front, -6, 26);
        stroke('#6fb6e6', 5, front, 26, 34);
        break;
      case 'tesla':
        stroke('#a5b4fc', 9, front, -6, 32);
        stroke('#fff', 3, front, 32, 42);
        break;
    }
    c.lineCap = 'round';
  }

  private drawShot(c: CanvasRenderingContext2D, s: Shot) {
    const a = Math.atan2(s.vy, s.vx);
    c.save();
    c.translate(s.x, s.y);
    c.rotate(a);
    switch (s.shape) {
      case 'star':
        c.rotate(this.time * 30);
        c.fillStyle = '#dfe7f0';
        for (let i = 0; i < 4; i++) {
          c.rotate(Math.PI / 2);
          c.beginPath();
          c.moveTo(0, -2.5);
          c.lineTo(9, 0);
          c.lineTo(0, 2.5);
          c.fill();
        }
        break;
      case 'arrow':
        c.strokeStyle = '#e8d8b4';
        c.lineWidth = 2;
        c.beginPath();
        c.moveTo(-18, 0);
        c.lineTo(12, 0);
        c.stroke();
        c.fillStyle = '#7dd3fc';
        c.beginPath();
        c.moveTo(16, 0);
        c.lineTo(9, -3.5);
        c.lineTo(9, 3.5);
        c.fill();
        break;
      case 'rocket':
        c.fillStyle = '#d7dde8';
        c.fillRect(-10, -4, 20, 8);
        c.fillStyle = '#ffb86b';
        c.beginPath();
        c.moveTo(-10, -4);
        c.lineTo(-22 - Math.random() * 8, 0);
        c.lineTo(-10, 4);
        c.fill();
        break;
      case 'wave':
        c.strokeStyle = '#ff9d5c';
        c.lineWidth = 6;
        c.beginPath();
        c.arc(-20, 0, 36, -1, 1);
        c.stroke();
        break;
      case 'ice':
        c.fillStyle = '#d5f6ff';
        c.beginPath();
        c.moveTo(18, 0);
        c.lineTo(-10, -4);
        c.lineTo(-10, 4);
        c.fill();
        break;
      default:
        if (s.hook) {
          c.strokeStyle = '#d9d4e4';
          c.lineWidth = 4;
          c.beginPath();
          c.arc(0, 0, 10, -1.6, 1.6);
          c.stroke();
        } else {
          c.fillStyle = s.shape === 'bullet' ? '#7dd3fc' : '#ffd38a';
          c.fillRect(-5, -1.5, 10, 3);
        }
    }
    c.restore();
  }
}
