// Stick Fight (a test): the duel, one turn at a time, on a canvas. Knows nothing of React: the page calls
// `choose` and `guess`, and `onEvent` says when there's something new to show. A turn is worked out at once
// (`resolve`), then played back for the eye: the timeline only moves the stickmen and sets off the sparks.
import { hashString, mulberry32 } from '../lib/rng';
import { TELLS, type Fighter, type Move, type Range, type Tell, type Weapon } from './fighters';

export const W = 780;
export const H = 380;
export const MAX_TURNS = 15;
const FLOOR = 328;
const FAR = 120;
const PLAYER_HP = 100;
const ENEMY_HP = 100;
const STRIKE = 20;
const GUARD_KEEPS = 0.25;
const OPEN_TAKES = 1.25;
const KO_LOSS = 15;
const MINE_DAMAGE = 10;
/** Back on its feet after kneeling, this healthy. */
const KNEEL_HEAL = 40;
const TURN_TIME = 1.35;
const FIRE = 0.45;
const IMPACT = 0.72;

export type Action = 'strike' | 'rush' | 'guard' | 'dodge';
export type FightEvent = 'hit' | 'hurt' | 'block' | 'whoosh' | 'blast' | 'ko' | 'finish' | 'turn' | 'done';

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
interface Slide {
  from: number;
  to: number;
  value: number;
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const SKIN = '#f5efe0';
const FOE = '#ff7d6e';
const closeness = (r: Range) => (r === 'close' ? 1 : 0);

export class Duel {
  state: 'choosing' | 'playing' | 'finishing' | 'done' = 'choosing';
  range: Range = 'far';
  turn = 1;
  /** One square per turn played, for the result. */
  squares: string[] = [];
  /** Strikes landed: one clue each. */
  landed = 0;
  hitsTaken = 0;
  knockouts = 0;
  won = false;
  /** What just happened, in words. */
  lines: string[] = ['It watches you from across the arena.'];
  /** What it's about to do: nothing, when it's on one knee. */
  intent: Move | null = null;
  playerHp = PLAYER_HP;
  maxHp = PLAYER_HP;
  foeHp = ENEMY_HP;

  private lastAction: Action | null = null;
  private chilled = false;
  private chillNext = false;
  private mine = false;
  private down = false;
  private kneeling = false;
  private forced: string | null = null;
  private prevRange: Range = 'far';
  private cooldowns: Record<string, number> = {};
  private lastMove = '';
  private rand: () => number;

  // Playback
  private t = 0;
  private clock = 0;
  private action: Action | null = null;
  private pos = 0;
  private slides: Slide[] = [];
  private bounce = false;
  private events: { at: number; run: () => void }[] = [];
  private connected = false;
  private shownPlayer = PLAYER_HP;
  private shownFoe = ENEMY_HP;
  private hurtP = 0;
  private hurtE = 0;
  private fx: Fx[] = [];
  private sparks: Spark[] = [];
  private shake = 0;
  private flash = 0;
  private endT = 0;
  private flight: { x: number; y: number; vx: number; vy: number } | null = null;

  constructor(
    private fighter: Fighter,
    seed: string,
    private onEvent: (e: FightEvent) => void,
  ) {
    this.rand = mulberry32(hashString(seed));
    this.intent = this.pickIntent();
  }

  /** What the player sees it doing, in words. */
  get tell() {
    if (this.kneeling) return 'It is down on one knee. Name it now, or hit it while you can!';
    return this.intent ? TELLS[this.intent.tell] : '';
  }

  /** Whether this action can be chosen now. */
  can(a: Action) {
    if (this.state !== 'choosing') return false;
    if (a === 'strike') return this.range === 'close';
    if (a === 'rush') return this.range === 'far';
    if (a === 'dodge') return this.lastAction !== 'dodge' && !this.chilled;
    return true;
  }

  choose(a: Action) {
    if (this.can(a)) this.resolve(a);
  }

  /** A wrong name: the turn is lost, and it heals. */
  wrongGuess() {
    if (this.state !== 'choosing') return;
    this.foeHp = Math.min(ENEMY_HP, this.foeHp + 20);
    this.resolve(null);
    this.lines.unshift('Wrong name: it heals while you think.');
    this.squares[this.squares.length - 1] = '❌';
  }

  /** The right name lands the finishing blow; out of turns or names, it walks away. */
  finish(won: boolean) {
    if (this.state === 'finishing' || this.state === 'done') return;
    this.won = won;
    this.state = 'finishing';
    this.endT = won ? 1.5 : 1.1;
    this.events = [];
    this.slides = [];
    this.t = TURN_TIME;
    this.intent = null;
    this.action = null;
    if (won) {
      this.foeHp = 0;
      this.kneeling = false;
      this.pos = 1;
      const x = this.foeX();
      this.flight = { x, y: 0, vx: 800, vy: -600 };
      this.flash = 1;
      this.shake = 22;
      this.burst(x, this.foeY() - 45, 46, '#fff');
      this.ring(x, this.foeY() - 45, 10, 260, '#fff', 0.55);
      this.lines = ['One last blow, with its name on it.'];
      this.onEvent('finish');
    } else {
      this.pos = closeness(this.range);
      this.down = true;
      this.lines = ['It turns its back and walks away.'];
    }
    this.onEvent('turn');
  }

  private pickIntent(): Move | null {
    if (this.kneeling) return null;
    const moves = this.fighter.moves.filter((m) => m.from === 'any' || m.from === this.range);
    if (this.forced) {
      const forced = moves.find((m) => m.name === this.forced);
      this.forced = null;
      if (forced) return this.commit(forced);
    }
    const ready = moves.filter((m) => (this.cooldowns[m.name] ?? 0) <= this.turn);
    const fresh = ready.filter((m) => m.name !== this.lastMove);
    const pool = fresh.length ? fresh : ready.length ? ready : moves;
    return this.commit(pool[Math.floor(this.rand() * pool.length)]);
  }

  private commit(m: Move) {
    this.lastMove = m.name;
    if (m.cooldown) this.cooldowns[m.name] = this.turn + m.cooldown + 1;
    return m;
  }

  /** The whole turn, worked out now; `null` is a turn thrown away on a wrong name. */
  private resolve(a: Action | null) {
    const m = this.intent;
    const lines: string[] = [];
    const startRange = this.range;
    let range = startRange;
    let playerDamage = 0;
    let took = false;
    let landed = false;
    this.begin(a, startRange);

    if (a === 'rush') {
      if (m?.kind === 'wall') {
        this.bounce = true;
        lines.push('You run straight into it.');
      } else {
        this.slide(0, 0.25, 'far', 'close');
        range = 'close';
        lines.push('You rush in.');
        if (this.mine) {
          this.mine = false;
          playerDamage += MINE_DAMAGE;
          took = true;
          this.at(0.14, () => this.blastAt(this.playerX(), FLOOR - 6, '#a855f7'));
          lines.push('Something goes off under your feet!');
        }
      }
    }

    // Your strike goes first.
    let counter = 0;
    if (a === 'strike') {
      const walled = m?.kind === 'guard' && m.look && m.look !== 'gas' && m.look !== 'dome';
      if (m?.evades) {
        lines.push('Your strike hits nothing: it has already gone.');
        this.at(0.38, () => this.onEvent('whoosh'));
      } else if (walled) {
        counter = m.counter ?? 0;
        lines.push(counter ? 'Your strike is turned back on you!' : 'Your strike bounces off.');
        this.at(0.38, () => {
          this.burst(this.playerX() + 46, this.playerY() - 58, 8, '#9ad8ff');
          this.onEvent('block');
        });
      } else {
        landed = true;
        const dome = m?.look === 'dome';
        this.foeHp = Math.max(0, this.foeHp - (dome ? STRIKE / 2 : STRIKE));
        this.landed++;
        lines.push(dome ? 'Your strike lands, softened by the dome.' : 'Your strike lands!');
        this.at(0.38, () => {
          this.hurtE = 0.25;
          this.burst(this.foeX(), this.foeY() - 55, 10, '#ffd9a0');
          this.shake = Math.max(this.shake, 5);
          this.onEvent('hit');
        });
      }
    }

    // Then whatever it was about to do.
    let connected = false;
    if (m) {
      lines.push(m.line);
      if (m.damage) {
        if (a === 'dodge') {
          lines.push('You dodge it.');
        } else {
          connected = true;
          let damage = m.damage;
          if (a === 'guard') {
            if (m.breaks) {
              took = true;
              lines.push('It goes straight through your guard!');
            } else {
              damage *= GUARD_KEEPS;
              lines.push('Your guard takes most of it.');
            }
          } else {
            took = true;
            if (a === 'rush' || a === 'strike') damage *= OPEN_TAKES;
          }
          playerDamage += damage;
          if (m.chills) this.chillNext = true;
        }
      }
      if (m.heal) this.foeHp = Math.min(ENEMY_HP, this.foeHp + m.heal);
      if (m.kind === 'mine') this.mine = true;

      let to = m.to;
      if (m.kind === 'hook' && !connected) to = undefined;
      if (m.kind === 'blink') to = range === 'close' ? 'far' : 'close';
      if (m.kind === 'recall') to = this.prevRange;
      if (to && to !== range) {
        this.slide(FIRE, IMPACT + 0.03, range, to);
        range = to;
      }
      if (m.then && connected) this.forced = m.then;
      this.playMove(m, connected, a === 'guard' && !m.breaks);
    }
    this.connected = connected;

    if (counter) {
      playerDamage += counter;
      took = true;
    }
    if (took) this.hitsTaken++;
    this.playerHp = Math.max(0, this.playerHp - playerDamage);

    this.squares.push(landed ? (took ? '🟨' : '🟩') : took ? '🟥' : '🟨');
    if (this.playerHp <= 0) {
      this.knockouts++;
      this.down = true;
      range = 'far';
      lines.push('You are knocked down!');
      this.at(IMPACT + 0.1, () => this.onEvent('ko'));
    }
    this.lines = lines;
    this.prevRange = startRange;
    this.range = range;
    this.lastAction = a;
    this.at(TURN_TIME, () => this.endTurn());
    this.onEvent('turn');
  }

  private begin(a: Action | null, r: Range) {
    this.state = 'playing';
    this.action = a;
    this.t = 0;
    this.pos = closeness(r);
    this.slides = [];
    this.bounce = false;
    this.events = [];
    this.connected = false;
    if (a === 'dodge') this.at(0.05, () => this.onEvent('whoosh'));
    if (a === 'rush') this.at(0.02, () => this.onEvent('whoosh'));
  }

  private endTurn() {
    this.pos = closeness(this.range);
    this.slides = [];
    this.turn++;
    if (this.turn > MAX_TURNS) {
      this.finish(false);
      return;
    }
    if (!this.down) {
      this.nextChoice();
      return;
    }
    // Getting up costs a turn.
    this.down = false;
    this.maxHp = Math.max(40, this.maxHp - KO_LOSS);
    this.playerHp = this.maxHp;
    this.squares.push('⬛');
    this.lines = ['You get back up, weaker.'];
    this.lastAction = null;
    this.intent = null;
    this.begin(null, this.range);
    this.at(0.9, () => {
      this.turn++;
      if (this.turn > MAX_TURNS) this.finish(false);
      else this.nextChoice();
    });
    this.onEvent('turn');
  }

  private nextChoice() {
    // Brought to zero, it spends one turn on one knee, then gets up.
    if (this.kneeling) {
      this.kneeling = false;
      this.foeHp = Math.max(this.foeHp, KNEEL_HEAL);
    } else if (this.foeHp <= 0) {
      this.kneeling = true;
    }
    this.chilled = this.chillNext;
    this.chillNext = false;
    this.intent = this.pickIntent();
    this.state = 'choosing';
    this.onEvent('turn');
  }

  private slide(from: number, to: number, a: Range, b: Range) {
    if (a !== b) this.slides.push({ from, to, value: closeness(b) });
  }

  private at(at: number, run: () => void) {
    this.events.push({ at, run });
  }

  /** Sets off the sights and sounds of the move. */
  private playMove(m: Move, connected: boolean, guarded: boolean) {
    if (m.kind === 'dash' || m.kind === 'leap' || m.kind === 'retreat' || m.kind === 'blink' || m.kind === 'hook' || m.kind === 'shot') this.at(FIRE, () => this.onEvent('whoosh'));
    if (m.kind === 'snipe') {
      this.at(IMPACT, () => {
        const from = this.muzzle();
        const px = this.playerX();
        const py = this.playerY() - 50;
        const k = 1400 / (Math.hypot(px - from.x, py - from.y) || 1);
        this.line(from.x, from.y, from.x + (px - from.x) * k, from.y + (py - from.y) * k, '#ff4d6d', 3, 0.18);
        this.onEvent('blast');
      });
    }
    if (m.kind === 'blink') this.at(FIRE + 0.1, () => this.line(this.foeX(), this.foeY() - 50, this.foeX() + 90, this.foeY() - 50, '#7dd3fc', 5, 0.2));
    if (m.kind === 'recall') this.at(FIRE, () => this.ring(this.foeX(), this.foeY() - 45, 50, 8, '#7dd3fc', 0.35));
    if (m.kind === 'shock') this.at(IMPACT, () => this.ring(this.foeX(), this.foeY() - 40, 16, 180, '#fff', 0.3));
    if (m.kind === 'wall') this.at(FIRE + 0.1, () => this.burst(W / 2, FLOOR - 60, 14, '#bfefff'));
    if (m.kind === 'leap') {
      this.at(IMPACT, () => {
        this.ring(this.foeX(), FLOOR - 4, 14, 130, '#ffb86b', 0.3);
        this.burst(this.foeX(), FLOOR, 14, '#ffb86b');
        this.shake = Math.max(this.shake, 12);
        this.onEvent('blast');
      });
    }
    if (m.damage) {
      this.at(IMPACT, () => {
        if (m.blast) this.blastAt(this.playerX(), this.playerY() - 50, '#ffb86b');
        if (!connected) return;
        if (guarded) {
          this.burst(this.playerX() + 18, this.playerY() - 60, 8, '#9ad8ff');
          this.onEvent('block');
        } else {
          this.hurtP = 0.3;
          this.burst(this.playerX(), this.playerY() - 55, 11, '#ff6a5a');
          this.shake = Math.max(this.shake, 8 + (m.damage ?? 0) / 3);
          this.onEvent('hurt');
        }
      });
    }
  }

  private blastAt(x: number, y: number, color: string) {
    this.ring(x, y, 10, 80, color, 0.28);
    this.burst(x, y, 12, color);
    this.shake = Math.max(this.shake, 8);
    this.onEvent('blast');
  }

  /** Runs the playback on by this much real time. */
  update(real: number) {
    const dt = Math.min(real, 0.1);
    this.clock += dt;
    this.flash = Math.max(0, this.flash - dt * 2.5);
    this.shake = Math.max(0, this.shake - dt * 40);
    this.hurtP = Math.max(0, this.hurtP - dt);
    this.hurtE = Math.max(0, this.hurtE - dt);
    this.shownPlayer += (this.playerHp - this.shownPlayer) * Math.min(1, dt * 7);
    this.shownFoe += (this.foeHp - this.shownFoe) * Math.min(1, dt * 7);
    for (const f of this.fx) f.t += dt;
    this.fx = this.fx.filter((f) => f.t < f.dur);
    for (const s of this.sparks) {
      s.t -= dt;
      s.vy += 800 * dt;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
    }
    this.sparks = this.sparks.filter((s) => s.t > 0);

    if (this.state === 'playing') {
      this.t += dt;
      const due = this.events.filter((e) => e.at <= this.t);
      this.events = this.events.filter((e) => e.at > this.t);
      for (const e of due) e.run();
    } else if (this.state === 'finishing') {
      this.endT -= dt;
      if (this.flight) {
        this.flight.vy += 1600 * dt;
        this.flight.x = clamp(this.flight.x + this.flight.vx * dt, 20, W - 20);
        this.flight.y += this.flight.vy * dt;
        if (this.flight.y >= 0) {
          this.flight.y = 0;
          this.flight.vy = 0;
          this.flight.vx *= 0.85;
        }
      }
      if (this.endT <= 0) {
        this.state = 'done';
        this.onEvent('done');
      }
    }
  }

  // ---- Where everyone is ----

  /** 0 far, 1 close, at this moment of the playback. */
  private closenessNow() {
    if (this.state !== 'playing') return this.state === 'finishing' ? this.pos : closeness(this.range);
    let v = this.pos;
    for (const s of this.slides) {
      if (this.t >= s.to) v = s.value;
      else if (this.t > s.from) {
        const k = (this.t - s.from) / (s.to - s.from);
        v += (s.value - v) * (k * k * (3 - 2 * k));
      }
    }
    return v;
  }

  private gap() {
    return 48 + 20 * this.fighter.scale;
  }

  private playerX() {
    const c = this.closenessNow();
    let x = FAR + (W / 2 - this.gap() - FAR) * c;
    if (this.state === 'playing') {
      const t = this.t;
      if (this.bounce) x += Math.sin(clamp(t / 0.5, 0, 1) * Math.PI) * 230;
      if (this.action === 'strike' && t > 0.2 && t < 0.55) x += Math.sin(((t - 0.2) / 0.35) * Math.PI) * 26;
      if (this.action === 'dodge' && t > FIRE - 0.15 && t < IMPACT + 0.25) x -= Math.sin(((t - FIRE + 0.15) / 0.67) * Math.PI) * 54;
    }
    if (this.hurtP > 0) x -= this.hurtP * 60;
    return x;
  }

  private playerY() {
    if (this.state === 'playing' && this.action === 'dodge' && this.t > FIRE - 0.15 && this.t < IMPACT + 0.25) return FLOOR - Math.sin(((this.t - FIRE + 0.15) / 0.67) * Math.PI) * 26;
    if (this.state === 'playing' && this.action === 'strike' && this.fighter.hover && this.t > 0.15 && this.t < 0.6) return FLOOR - Math.sin(((this.t - 0.15) / 0.45) * Math.PI) * 54;
    return FLOOR;
  }

  private foeX() {
    if (this.flight) return this.flight.x;
    const c = this.closenessNow();
    let x = W - FAR - (W - FAR - (W / 2 + this.gap())) * c;
    const m = this.intent;
    if (this.state === 'playing' && m) {
      if (m.kind === 'melee' && this.t > FIRE - 0.1 && this.t < IMPACT + 0.2) x -= Math.sin(((this.t - FIRE + 0.1) / 0.57) * Math.PI) * 18;
    }
    if (this.hurtE > 0) x += this.hurtE * 60;
    return x;
  }

  private foeY() {
    if (this.flight) return FLOOR + this.flight.y;
    const hover = this.fighter.hover && !this.kneeling ? this.fighter.hover + Math.sin(this.clock * 1.7) * 8 : 0;
    const m = this.intent;
    let lift = 0;
    if (this.state === 'playing' && m && (m.kind === 'leap' || m.kind === 'retreat') && this.t > FIRE && this.t < IMPACT + 0.03) lift = Math.sin(((this.t - FIRE) / (IMPACT + 0.03 - FIRE)) * Math.PI) * (m.kind === 'leap' ? 165 : 120);
    return FLOOR - hover - lift;
  }

  private muzzle() {
    const s = this.fighter.scale;
    return { x: this.foeX() - 34 * s, y: this.foeY() - 66 * s };
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

    const m = this.intent;
    const walling = this.state === 'playing' && m?.kind === 'wall' && this.t > FIRE;
    if (walling) {
      const k = clamp((this.t - FIRE) / 0.12, 0, 1);
      c.fillStyle = 'rgba(160,225,255,0.65)';
      c.strokeStyle = '#e4f8ff';
      c.fillRect(W / 2 - 18, FLOOR - 190 * k, 36, 190 * k);
      c.strokeRect(W / 2 - 18, FLOOR - 190 * k, 36, 190 * k);
    }
    if (this.mine || (this.state === 'playing' && m?.kind === 'mine' && this.t > FIRE)) {
      c.fillStyle = '#a855f7';
      c.beginPath();
      c.arc(W / 2 + 30, FLOOR - 4, 7, Math.PI, 0);
      c.fill();
    }

    this.drawEnemy(c);
    this.drawPlayer(c);
    if (this.state === 'playing' && m) this.drawShots(c, m);

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
      c.fillRect(x, 18, w, 14);
      c.fillStyle = color;
      const fill = w * clamp(k, 0, 1);
      c.fillRect(right ? x + w - fill : x, 18, fill, 14);
      c.strokeStyle = 'rgba(255,255,255,0.5)';
      c.strokeRect(x, 18, w, 14);
      c.fillStyle = '#fff';
      c.font = 'bold 13px sans-serif';
      c.textAlign = right ? 'right' : 'left';
      c.fillText(label, right ? x + w : x, 50);
    };
    bar(24, 300 * (this.maxHp / PLAYER_HP), this.shownPlayer / this.maxHp, '#5eead4', 'You', false);
    bar(W - 324, 300, this.shownFoe / ENEMY_HP, FOE, this.state === 'done' || (this.state === 'finishing' && this.won) ? this.fighter.name : '???', true);
    c.textAlign = 'center';
    c.font = 'bold 16px sans-serif';
    c.fillStyle = '#fff';
    c.fillText(`${Math.min(this.turn, MAX_TURNS)}/${MAX_TURNS}`, W / 2, 31);
  }

  private drawPlayer(c: CanvasRenderingContext2D) {
    const x = this.playerX();
    const y = this.playerY();
    const a = this.state === 'playing' ? this.action : null;
    const t = this.t;
    if (a === 'dodge' && t > FIRE - 0.15 && t < IMPACT + 0.25) c.globalAlpha = 0.45;
    let front = 0.5;
    let back = 1;
    if (a === 'strike') {
      if (t < 0.28) front = 1.5;
      else if (t < 0.52) {
        front = -0.1;
        back = 1.4;
      }
    } else if (a === 'guard') {
      front = -1.1;
      back = -0.9;
    } else if (a === 'rush' && t < 0.25) {
      front = 1;
      back = 1.3;
    }
    const down = this.down && (this.state !== 'playing' || t > IMPACT + 0.05 || this.action === null);
    this.drawStick(c, x, y, 1, 1, SKIN, front, back, down, this.hurtP > 0, 1, false, y < FLOOR - 2, a === 'rush' && t < 0.25);
    c.globalAlpha = 1;
    if (a === 'guard') {
      c.strokeStyle = 'rgba(154,216,255,0.85)';
      c.lineWidth = 3;
      c.beginPath();
      c.arc(x, y - 52, 40, -1, 1);
      c.stroke();
    }
  }

  private drawEnemy(c: CanvasRenderingContext2D) {
    const f = this.fighter;
    const m = this.intent;
    const s = f.scale;
    const x = this.foeX();
    const y = this.foeY();
    const sy = y - 78 * s;
    const aiming = Math.atan2(this.playerY() - 50 - sy, x - this.playerX());
    const pose = this.posed(m, aiming);
    const dead = this.state === 'finishing' && this.won;
    const flickers = this.state === 'choosing' && m?.tell === 'flicker';
    if (flickers) c.globalAlpha = 0.55 + Math.sin(this.clock * 26) * 0.35;
    if (this.state === 'playing' && m?.kind === 'blink' && this.t > FIRE && this.t < FIRE + 0.12) c.globalAlpha = 0;

    if (f.hover && !this.kneeling) {
      c.strokeStyle = 'rgba(255,190,110,0.8)';
      c.lineWidth = 2;
      for (const o of [-9, 9]) {
        c.beginPath();
        c.moveTo(x + o, y + 2);
        c.lineTo(x + o + (Math.random() - 0.5) * 8, y + 22 + Math.random() * 16);
        c.stroke();
      }
    }
    if (this.state === 'playing' && m?.kind === 'dash' && this.t > FIRE && this.t < IMPACT + 0.03) {
      c.strokeStyle = 'rgba(255,255,255,0.4)';
      c.lineWidth = 3;
      for (const o of [-60, -35, -10]) {
        c.beginPath();
        c.moveTo(x + 30, y + o * s);
        c.lineTo(x + 90 + Math.random() * 60, y + o * s);
        c.stroke();
      }
    }
    if (this.state === 'playing' && m?.grapple && this.t > FIRE && this.t < IMPACT + 0.03) {
      c.strokeStyle = '#d9d4ff';
      c.lineWidth = 2;
      c.beginPath();
      c.moveTo(x, y - 70);
      c.lineTo(W - FAR, 0);
      c.stroke();
    }
    // A sniper's laser, tracking the player while it waits.
    if (f.weapon === 'rifle' && m?.tell === 'aim' && (this.state === 'choosing' || (this.state === 'playing' && this.t < IMPACT))) {
      const from = this.muzzle();
      const px = this.playerX();
      const py = this.playerY() - 50;
      const k = 1400 / (Math.hypot(px - from.x, py - from.y) || 1);
      c.strokeStyle = 'rgba(255,77,109,0.6)';
      c.lineWidth = 1.2;
      c.beginPath();
      c.moveTo(from.x, from.y);
      c.lineTo(from.x + (px - from.x) * k, from.y + (py - from.y) * k);
      c.stroke();
    }

    this.drawStick(c, x, y, -1, s, FOE, pose.front, pose.back, dead, this.hurtE > 0, 1 + (s - 1) * 1.6, this.kneeling, y < FLOOR - 2 && !f.hover, pose.lean, pose.crouch);
    if (!dead) this.drawWeapon(c, f.weapon, x, y, pose.front, pose.back, pose.crouch, pose.lean);
    c.globalAlpha = 1;

    if (this.state === 'choosing' && m?.tell === 'spin') {
      const hx = x - Math.cos(pose.front) * 40 * s;
      const hy = sy + 6 * s + Math.sin(pose.front) * 40 * s;
      c.strokeStyle = '#b8b2c8';
      c.lineWidth = 3;
      c.setLineDash([6, 4]);
      c.beginPath();
      c.arc(hx, hy - 16, 22, this.clock * 10, this.clock * 10 + 4.6);
      c.stroke();
      c.setLineDash([]);
    }
    if (this.state === 'playing' && m) {
      if (m.kind === 'stream' && this.t > FIRE && this.t < IMPACT + 0.25) {
        const from = this.muzzle();
        const tesla = f.weapon === 'tesla';
        const to = this.playerX();
        c.strokeStyle = tesla ? '#9dd9ff' : '#d5f6ff';
        c.lineWidth = tesla ? 2 : 6;
        c.globalAlpha = 0.85;
        c.beginPath();
        c.moveTo(from.x, from.y);
        for (let i = 1; i <= 7; i++) c.lineTo(from.x + ((to - from.x) * i) / 7, from.y + (Math.random() - 0.5) * (tesla ? 30 : 8) + i * 2);
        c.stroke();
        c.globalAlpha = 1;
      }
      if (m.kind === 'guard' && this.t > 0.15) this.drawGuard(c, m);
      if (m.kind === 'hook' && this.t > FIRE && this.t < IMPACT + 0.1) {
        const from = this.muzzle();
        const k = clamp((this.t - FIRE) / 0.16, 0, 1);
        c.strokeStyle = '#b8b2c8';
        c.lineWidth = 3;
        c.setLineDash([6, 4]);
        c.beginPath();
        c.moveTo(from.x, from.y);
        c.lineTo(from.x + (this.playerX() - from.x) * k, from.y + (this.playerY() - 50 - from.y) * k);
        c.stroke();
        c.setLineDash([]);
      }
    }
  }

  /** How it stands: on its tell while the player chooses, then through the move. */
  private posed(m: Move | null, aiming: number) {
    const armed = this.fighter.weapon;
    const rest = armed === 'katana' || armed === 'hammer' || armed === 'gauntlet' ? 0.7 : 0.15;
    const pose = { front: rest, back: armed === 'pistols' ? rest : 1.1, lean: false, crouch: false };
    if (!m) return pose;
    const moving = this.state === 'playing' && this.t >= FIRE;
    if (!moving) {
      const byTell: Record<Tell, () => void> = {
        raise: () => (pose.front = -2.3),
        aim: () => {
          pose.front = aiming;
          if (armed === 'pistols' || armed === 'bow') pose.back = aiming;
        },
        crouch: () => {
          pose.crouch = true;
          pose.front = 0.9;
        },
        brace: () => {
          pose.front = -0.9;
          pose.back = -1.1;
        },
        lean: () => {
          pose.lean = true;
          pose.front = 2.7;
        },
        spin: () => (pose.front = -1.3),
        still: () => {
          pose.front = 0.9;
          pose.back = 1;
        },
        flicker: () => undefined,
      };
      byTell[m.tell]();
      return pose;
    }
    switch (m.kind) {
      case 'melee':
        pose.front = this.t < IMPACT ? -2.3 + 3 * ((this.t - FIRE) / (IMPACT - FIRE)) : 0.8;
        break;
      case 'shot':
      case 'snipe':
      case 'hook':
      case 'stream':
        pose.front = aiming;
        if (armed === 'pistols' || armed === 'bow') pose.back = aiming;
        break;
      case 'dash':
        pose.front = 0;
        pose.lean = true;
        break;
      case 'guard':
        pose.front = -0.9;
        pose.back = -1.1;
        break;
      case 'leap':
        pose.front = -1.6;
        break;
      case 'shock':
        pose.front = 0;
        pose.back = 0;
        break;
      default:
        break;
    }
    return pose;
  }

  private drawGuard(c: CanvasRenderingContext2D, m: Move) {
    const x = this.foeX();
    const y = this.foeY();
    const s = this.fighter.scale;
    const cy = y - 52 * s;
    c.lineWidth = 3;
    switch (m.look) {
      case 'shield':
        c.strokeStyle = '#7dd3fc';
        c.fillStyle = 'rgba(125,211,252,0.25)';
        c.beginPath();
        c.ellipse(x - 62 * s, cy, 16, 90 * s, 0, 0, Math.PI * 2);
        c.fill();
        c.stroke();
        break;
      case 'dome':
        c.strokeStyle = '#a5b4fc';
        c.fillStyle = 'rgba(165,180,252,0.18)';
        c.beginPath();
        c.arc(x, y, 112 * s, Math.PI, 0);
        c.fill();
        c.stroke();
        break;
      case 'ice':
        c.fillStyle = 'rgba(180,235,255,0.6)';
        c.strokeStyle = '#e4f8ff';
        c.fillRect(x - 38, y - 108 * s, 76, 108 * s);
        c.strokeRect(x - 38, y - 108 * s, 76, 108 * s);
        break;
      case 'gas':
        c.fillStyle = 'rgba(180,230,120,0.22)';
        for (let i = 0; i < 6; i++) {
          c.beginPath();
          c.arc(x + Math.sin(this.clock * 3 + i) * 34, cy - 40 - i * 7, 14 + i * 2, 0, Math.PI * 2);
          c.fill();
        }
        break;
      case 'deflect':
        c.strokeStyle = '#7dffb0';
        for (const o of [0, 3.1]) {
          c.beginPath();
          c.arc(x - 22, cy, 34, this.clock * 24 + o, this.clock * 24 + o + 2.4);
          c.stroke();
        }
        break;
      default:
        c.strokeStyle = '#ffb86b';
        c.beginPath();
        c.arc(x - 28, cy, 30 * s, Math.PI - 1.1, Math.PI + 1.1);
        c.stroke();
    }
  }

  private drawShots(c: CanvasRenderingContext2D, m: Move) {
    if (m.kind !== 'shot' || this.t < FIRE) return;
    const from = this.muzzle();
    const toX = this.playerX();
    const toY = this.playerY() - 50;
    const count = m.count ?? 1;
    for (let i = 0; i < count; i++) {
      // Flying past a dodging player; otherwise gone on impact.
      const stagger = m.shape === 'bullet' || m.arc ? i * 0.04 : 0;
      const k = (this.t - FIRE - stagger) / (IMPACT - FIRE);
      if (k < 0 || (k > 1 && this.connected)) continue;
      if (k > 1.5) continue;
      const spread = count > 1 ? ((i / (count - 1)) * 2 - 1) * (m.shape === 'bullet' ? 8 : 28) * k : 0;
      const x = from.x + (toX - from.x) * k;
      const y = from.y + (toY - from.y) * k + spread - (m.arc ? Math.sin(Math.min(k, 1) * Math.PI) * 70 : 0);
      const a = Math.atan2(toY - from.y + (m.arc ? (k - 0.5) * 200 : 0), toX - from.x);
      c.save();
      c.translate(x, y);
      c.rotate(a);
      switch (m.shape) {
        case 'star':
          c.rotate(this.clock * 30);
          c.fillStyle = '#dfe7f0';
          for (let j = 0; j < 4; j++) {
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
          c.fillStyle = m.shape === 'bullet' ? '#7dd3fc' : '#ffd38a';
          c.fillRect(-5, -1.5, 10, 3);
      }
      c.restore();
    }
  }

  /** A stickman. Arm angles are local: 0 straight ahead, negative up, positive down. */
  private drawStick(c: CanvasRenderingContext2D, x: number, y: number, f: number, s: number, color: string, front: number, back: number, down: boolean, hurt: boolean, thick: number, kneel = false, air = false, leaning = false, crouching = false) {
    c.save();
    c.translate(x, y);
    if (down) {
      c.rotate(-f * 1.45);
      c.translate(0, 8);
    }
    const lean = leaning ? f * 12 * s : kneel ? f * 12 * s : 0;
    const hipY = kneel || crouching ? -28 * s : -44 * s;
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

    let footA = { x: f * 15 * s, y: 0 };
    let footB = { x: -f * 13 * s, y: 0 };
    if (kneel) {
      footA = { x: f * 22 * s, y: 0 };
      footB = { x: -f * 20 * s, y: 0 };
    } else if (air) {
      footA = { x: f * 16 * s, y: hipY + 30 * s };
      footB = { x: -f * 12 * s, y: hipY + 36 * s };
    } else if (leaning) {
      footA = { x: f * 24 * s, y: 0 };
      footB = { x: -f * 24 * s, y: 0 };
    } else if (crouching) {
      footA = { x: f * 24 * s, y: 0 };
      footB = { x: -f * 22 * s, y: 0 };
    }
    limb(hip, footA, 25 * s, f);
    limb(hip, footB, 25 * s, f);

    c.beginPath();
    c.moveTo(hip.x, hip.y);
    c.lineTo(neck.x, neck.y);
    c.stroke();
    c.beginPath();
    c.arc(neck.x + lean * 0.3, neck.y - 13 * s, 11.5 * s, 0, Math.PI * 2);
    c.fill();

    const shoulder = { x: neck.x, y: neck.y + 6 * s };
    const hand = (ang: number) => ({ x: shoulder.x + Math.cos(ang) * f * 40 * s, y: shoulder.y + Math.sin(ang) * 40 * s });
    limb(shoulder, hand(back), 21 * s, -f);
    limb(shoulder, hand(front), 21 * s, -f);
    c.restore();
  }

  private drawWeapon(c: CanvasRenderingContext2D, w: Weapon, x: number, y: number, front: number, back: number, crouching: boolean, leaning: boolean) {
    const s = this.fighter.scale;
    const f = -1;
    const hipY = this.kneeling || crouching ? -28 * s : -44 * s;
    const lean = leaning || this.kneeling ? f * 12 * s : 0;
    const sx = lean;
    const sy = hipY - 34 * s;
    const at = (ang: number) => ({ x: x + sx + Math.cos(ang) * f * 40 * s, y: y + sy + Math.sin(ang) * 40 * s });
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
        c.arc(h.x, h.y, 34 * s, Math.PI - front - 1.1, Math.PI - front + 1.1);
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
}
