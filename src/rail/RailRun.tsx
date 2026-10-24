import { useEffect, useRef, useState } from 'react';
import { celebrateBig } from '../lib/fx';
import { shuffle } from '../lib/rng';
import { sfx } from '../lib/sfx';
import { useProgress } from '../store/progress';
import { compactText, findBestMatch } from '../utils/textMatcher';
import { LANE, TRAIN_Z, drawScene, stepParticles, wheelPoint, type Gate, type Scene } from './draw';
import type { RailCharacter, RailLine } from './rosters';

export type RailDifficulty = 'easy' | 'normal' | 'hard';

/** Speeds in m/s; reaction is the time from a gate appearing to reaching it, shrinking as you go. */
export const RAIL_DIFFICULTY: Record<RailDifficulty, { label: string; wagons: number; start: number; gain: number; max: number; react: number; minReact: number; blur: boolean; blurb: string }> = {
  easy: { label: 'Easy', wagons: 3, start: 9, gain: 0.35, max: 22, react: 6, minReact: 3.4, blur: false, blurb: '3 wagons, a gentle climb in speed.' },
  normal: { label: 'Normal', wagons: 2, start: 11, gain: 0.45, max: 28, react: 5, minReact: 2.8, blur: false, blurb: '2 wagons, faster and faster.' },
  hard: { label: 'Hard', wagons: 1, start: 13, gain: 0.55, max: 34, react: 4.2, minReact: 2.3, blur: true, blurb: 'One wagon, top speed, and blurred signs.' },
};

const LANE_ARROWS = ['←', '↑', '→'];
const laneIndex = (x: number) => Math.max(0, Math.min(2, Math.round(x / LANE) + 1));

interface Hud {
  signs: RailCharacter[];
  blocked: [boolean, boolean, boolean];
  wagons: number;
  passed: number;
  speed: number;
  lane: number;
}

function loadImage(src: string) {
  const img = new Image();
  img.decoding = 'async';
  img.referrerPolicy = 'no-referrer';
  img.src = src;
  return img;
}

/** One run on one line: three tracks, picture signs, name a free track's character to switch to it. */
export function RailRun({ line, difficulty, onExit }: { line: RailLine; difficulty: RailDifficulty; onExit: () => void }) {
  const d = RAIL_DIFFICULTY[difficulty];
  const bestKey = `rail:${line.id}:${difficulty}`;
  const best = useProgress((s) => s.bests[bestKey] ?? 0);
  const recordBest = useProgress((s) => s.recordBest);
  const canvas = useRef<HTMLCanvasElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const [phase, setPhase] = useState<'countdown' | 'running' | 'paused' | 'over'>('countdown');
  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  const [count, setCount] = useState(3);
  const [text, setText] = useState('');
  const [miss, setMiss] = useState(false);
  const [hud, setHud] = useState<Hud | null>(null);

  // Everything the frame loop touches lives in refs: React only redraws the HUD.
  const game = useRef({
    deck: [] as RailCharacter[],
    signs: [] as RailCharacter[],
    gate: null as Gate | null,
    lane: 1,
    wagons: d.wagons,
    passed: 0,
  });
  const scene = useRef<Scene>({
    w: 800, h: 450, dist: 0, speed: d.start, maxSpeed: d.max, trainX: 0, lean: 0, gates: [], particles: [], shake: 0, flash: 0,
    palette: line.palette, blurSigns: d.blur, time: 0,
  });

  /** The next characters, never repeating until the whole roster has come up. */
  const drawCharacters = (n: number) => {
    const g = game.current;
    const out: RailCharacter[] = [];
    while (out.length < n) {
      if (!g.deck.length) g.deck = shuffle(line.characters, Math.random);
      const c = g.deck.pop()!;
      if (!out.some((x) => x.id === c.id)) out.push(c);
    }
    return out;
  };

  const syncHud = () => {
    const g = game.current;
    setHud({ signs: g.signs, blocked: g.gate?.blocked ?? [false, false, false], wagons: g.wagons, passed: g.passed, speed: scene.current.speed, lane: g.lane });
  };

  /** A new gate far ahead: the train's own track is usually blocked, never all three. */
  const spawnGate = () => {
    const g = game.current;
    const s = scene.current;
    const blocked: [boolean, boolean, boolean] = [false, false, false];
    const twoBlocked = Math.random() < Math.min(0.55, 0.1 + g.passed * 0.03);
    const order = shuffle([0, 1, 2], Math.random);
    if (Math.random() < 0.8) {
      blocked[g.lane] = true;
      if (twoBlocked) blocked[order.find((i) => i !== g.lane)!] = true;
    } else {
      blocked[order[0]] = true;
      if (twoBlocked) blocked[order[1]] = true;
    }
    g.signs = drawCharacters(3);
    // Preload what comes next, so the signs are there when the gate is.
    if (g.deck.length > 3) g.deck.slice(-3).forEach((c) => loadImage(c.image));
    const react = Math.max(d.minReact, d.react - g.passed * 0.08);
    g.gate = { at: s.dist + TRAIN_Z + s.speed * react, blocked, images: g.signs.map((c) => loadImage(c.image)) as Gate['images'] };
    // Only gates already gone through stay (for a moment); an unpassed one is replaced.
    s.gates = [...s.gates.filter((x) => x.done && x.at > s.dist - 2), g.gate];
    syncHud();
  };

  const switchTo = (lane: number) => {
    const g = game.current;
    if (lane === g.lane) return;
    g.lane = lane;
    setText('');
    sfx.click();
    // Sparks from the wheels as the train jumps tracks.
    const s = scene.current;
    const p = wheelPoint(s);
    for (let k = 0; k < 18; k++) {
      s.particles.push({ x: p.x, y: p.y, vx: (Math.random() - 0.5) * 260, vy: -80 - Math.random() * 160, life: 0.8, color: '255,190,80', size: 2 + Math.random() * 2 });
    }
    syncHud();
  };

  // Names count as soon as they're spelled exactly; Enter forgives a typo.
  const onType = (value: string) => {
    setText(value);
    if (phaseRef.current !== 'running') return;
    const q = compactText(value);
    const i = game.current.signs.findIndex((c) => [c.name, ...c.aliases].some((n) => compactText(n) === q));
    if (q && i >= 0) switchTo(i);
  };
  const onEnter = () => {
    if (phaseRef.current !== 'running' || !text.trim()) return;
    const m = findBestMatch(text, game.current.signs, (c) => [c.name, ...c.aliases]);
    if (m) return switchTo(game.current.signs.indexOf(m.item));
    setMiss(true);
    window.setTimeout(() => setMiss(false), 400);
    sfx.wrong();
  };

  // Countdown, then go.
  useEffect(() => {
    if (phase !== 'countdown') return;
    spawnGate();
    const t = window.setInterval(() => {
      setCount((c) => {
        if (c <= 1) {
          window.clearInterval(t);
          setPhase('running');
          window.setTimeout(() => input.current?.focus({ preventScroll: true }), 0);
          return 0;
        }
        sfx.click();
        return c - 1;
      });
    }, 700);
    return () => window.clearInterval(t);
  }, [phase === 'countdown']);

  // Pause when the tab is hidden.
  useEffect(() => {
    const onHide = () => document.hidden && phaseRef.current === 'running' && setPhase('paused');
    document.addEventListener('visibilitychange', onHide);
    return () => document.removeEventListener('visibilitychange', onHide);
  }, []);

  // The canvas follows its box, at the screen's pixel density.
  useEffect(() => {
    const el = box.current;
    const c = canvas.current;
    if (!el || !c) return;
    const fit = () => {
      const ratio = Math.min(2, window.devicePixelRatio || 1);
      const { width, height } = el.getBoundingClientRect();
      c.width = Math.round(width * ratio);
      c.height = Math.round(height * ratio);
      scene.current.w = c.width;
      scene.current.h = c.height;
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // The frame loop.
  useEffect(() => {
    const ctx = canvas.current?.getContext('2d');
    if (!ctx) return;
    let raf = 0;
    let last = performance.now();
    let hudTick = 0;
    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const s = scene.current;
      const g = game.current;
      s.time += dt;
      const running = phaseRef.current === 'running';
      const over = phaseRef.current === 'over';
      if (running) {
        const target = Math.min(d.max, d.start + g.passed * d.gain);
        s.speed += (target - s.speed) * Math.min(1, dt * 1.5);
      } else if (over) {
        s.speed = Math.max(0, s.speed - dt * 18);
      }
      if (running || over) s.dist += s.speed * dt;
      // Slide toward the chosen track, leaning into it.
      const dx = (g.lane - 1) * LANE - s.trainX;
      s.trainX += dx * Math.min(1, dt * 9);
      s.lean = Math.max(-1, Math.min(1, dx / LANE));

      if (running && g.gate && g.gate.at - s.dist <= TRAIN_Z) {
        const here = laneIndex(s.trainX);
        if (g.gate.blocked[here]) {
          g.gate.done = 'smashed';
          g.wagons -= 1;
          s.shake = 1;
          s.flash = 1;
          sfx.hurt();
          const p = wheelPoint(s);
          for (let k = 0; k < 30; k++) {
            s.particles.push({ x: p.x, y: p.y - 40, vx: (Math.random() - 0.5) * 420, vy: -120 - Math.random() * 260, life: 1, color: Math.random() < 0.5 ? '198,40,40' : '245,240,230', size: 3 + Math.random() * 3 });
          }
        } else {
          g.gate.done = 'passed';
          g.passed += 1;
          sfx.correct();
        }
        setText('');
        if (g.wagons <= 0) {
          setPhase('over');
          recordBest(bestKey, g.passed);
          if (g.passed > best && g.passed > 0) window.setTimeout(() => (sfx.streak(), celebrateBig()), 600);
          syncHud();
        } else spawnGate();
      }
      s.shake = Math.max(0, s.shake - dt * 2.2);
      s.flash = Math.max(0, s.flash - dt * 2.5);
      stepParticles(s, dt);
      drawScene(ctx, s);
      if ((hudTick += dt) > 0.25) {
        hudTick = 0;
        if (running) setHud((h) => (h ? { ...h, speed: s.speed } : h));
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, []);

  const restart = () => {
    sfx.click();
    game.current = { deck: [], signs: [], gate: null, lane: 1, wagons: d.wagons, passed: 0 };
    Object.assign(scene.current, { dist: 0, speed: d.start, trainX: 0, lean: 0, gates: [], particles: [], shake: 0, flash: 0 });
    setText('');
    setCount(3);
    setPhase('countdown');
  };

  return (
    <div className="space-y-3">
      <div ref={box} className="relative aspect-[4/3] w-full overflow-hidden rounded-xl border border-rule-strong bg-black shadow-2xl sm:aspect-[16/9]">
        <canvas ref={canvas} className="absolute inset-0 size-full" />
        {/* HUD: distance, speed and the wagons left. */}
        <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between p-3 font-display text-white drop-shadow">
          <div>
            <p className="text-[10px] uppercase tracking-[0.3em] opacity-80">Gates</p>
            <p className="font-serif text-3xl font-bold tabular-nums">{hud?.passed ?? 0}</p>
          </div>
          <div className="flex items-center gap-1" aria-label={`${hud?.wagons ?? d.wagons} wagons left`}>
            <span className="text-2xl">🚂</span>
            {Array.from({ length: d.wagons }, (_, i) => (
              <span key={i} className={`h-4 w-6 rounded-sm border border-white/70 transition ${i < (hud?.wagons ?? d.wagons) ? 'bg-amber-500' : 'bg-transparent opacity-40'}`} />
            ))}
          </div>
          <div className="text-right">
            <p className="text-[10px] uppercase tracking-[0.3em] opacity-80">Speed</p>
            <p className="font-serif text-xl font-bold tabular-nums">{Math.round((hud?.speed ?? d.start) * 3.6)} km/h</p>
          </div>
        </div>
        {phase === 'countdown' && count > 0 && (
          <div className="absolute inset-0 grid place-items-center">
            <span key={count} className="animate-pop font-serif text-8xl font-bold text-white drop-shadow-lg">
              {count}
            </span>
          </div>
        )}
        {phase === 'paused' && (
          <button type="button" onClick={() => (setPhase('running'), input.current?.focus())} className="absolute inset-0 grid place-items-center bg-black/50 font-display text-2xl font-bold text-white">
            ▶ Paused — tap to go on
          </button>
        )}
        {phase === 'over' && (
          <div className="animate-pop absolute inset-0 grid place-items-center bg-black/55 p-4">
            <div className="space-y-3 rounded-lg bg-paper/95 p-6 text-center shadow-2xl">
              <p className="font-display text-sm uppercase tracking-widest text-ink-soft">End of the line</p>
              <p className="font-serif text-6xl font-bold">{hud?.passed ?? 0}</p>
              <p className="text-sm text-ink-soft">{(hud?.passed ?? 0) > best ? '★ New best!' : `gates · best ${best}`}</p>
              <div className="flex justify-center gap-2">
                <button type="button" onClick={restart} className="btn-ink rounded-md px-5 py-2.5 font-display font-bold tracking-wider">
                  Go again
                </button>
                <button type="button" onClick={onExit} className="btn-paper rounded-md px-5 py-2.5 font-display font-bold tracking-wider">
                  Change line
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* The signs, big and readable: name a free track's character to switch to it. */}
      <div className="grid grid-cols-3 gap-2">
        {(hud?.signs ?? []).map((c, i) => {
          const blocked = hud!.blocked[i];
          const here = hud!.lane === i;
          return (
            <div
              key={`${c.id}-${i}`}
              className={`animate-round-in flex items-center gap-2 rounded-md border p-1.5 transition ${blocked ? 'border-miss/70 bg-miss/15' : 'border-hit/60 bg-hit/10'} ${here ? 'ring-2 ring-ink ring-offset-2 ring-offset-paper' : ''}`}
            >
              <img src={c.image} alt="" draggable={false} className="size-12 shrink-0 rounded object-cover object-top sm:size-16" style={d.blur ? { filter: 'blur(3px)' } : undefined} />
              <div className="min-w-0 font-display text-xs font-bold leading-tight">
                <p className="text-lg">{LANE_ARROWS[i]}</p>
                <p className={blocked ? 'text-miss' : 'text-hit'}>{blocked ? 'Blocked' : 'Free'}</p>
                {here && <p className="text-ink-faint">You</p>}
              </div>
            </div>
          );
        })}
      </div>

      <input
        ref={input}
        value={text}
        disabled={phase === 'over'}
        onChange={(e) => onType(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && onEnter()}
        placeholder="Name a free track's character…"
        autoComplete="off"
        autoCapitalize="off"
        spellCheck={false}
        className={`w-full rounded-xl border border-rule-strong bg-card/90 px-4 py-3 text-lg outline-none ring-accent/30 transition placeholder:text-ink-faint focus:border-accent focus:ring-4 ${miss ? 'animate-shake' : ''}`}
      />
    </div>
  );
}
