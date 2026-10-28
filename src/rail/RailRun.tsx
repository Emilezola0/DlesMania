import { useEffect, useRef, useState } from 'react';
import { celebrateBig } from '../lib/fx';
import { shuffle } from '../lib/rng';
import { sfx } from '../lib/sfx';
import { useTypeToFocus } from '../lib/focus';
import { useProgress } from '../store/progress';
import { compactText, findBestMatch } from '../utils/textMatcher';
import { LANE, TRAIN_Z, drawScene, stepParticles, wheelPoint, type Gate, type Scene } from './draw';
import { GATES_PER_STATION, MAX_WAGONS, NEW_LINE_BONUS, RAIL_ITEMS, stationOffer, type RailItemId } from './items';
import { RAIL_LINES, type RailCharacter, type RailLine } from './rosters';

export type RailDifficulty = 'easy' | 'normal' | 'hard';

/** Speeds in m/s; reaction is the time from a gate appearing to reaching it, shrinking as you go. */
export const RAIL_DIFFICULTY: Record<RailDifficulty, { label: string; wagons: number; start: number; gain: number; max: number; react: number; minReact: number; blur: boolean; blurb: string }> = {
  easy: { label: 'Easy', wagons: 3, start: 9, gain: 0.35, max: 22, react: 6, minReact: 3.4, blur: false, blurb: '3 wagons, a gentle climb in speed.' },
  normal: { label: 'Normal', wagons: 2, start: 11, gain: 0.45, max: 28, react: 5, minReact: 2.8, blur: false, blurb: '2 wagons, faster and faster.' },
  hard: { label: 'Hard', wagons: 1, start: 13, gain: 0.55, max: 34, react: 4.2, minReact: 2.3, blur: true, blurb: 'One wagon, top speed, and blurred signs.' },
};

const LANE_ARROWS = ['←', '↑', '→'];
const laneIndex = (x: number) => Math.max(0, Math.min(2, Math.round(x / LANE) + 1));
/** How hard the train brakes into a station, in m/s². */
const STATION_BRAKING = 7;

type Phase = 'countdown' | 'running' | 'paused' | 'station' | 'over';

interface Hud {
  line: RailLine;
  signs: RailCharacter[];
  blocked: [boolean, boolean, boolean];
  wagons: number;
  passed: number;
  score: number;
  mult: number;
  speed: number;
  lane: number;
  stations: number;
  airbags: number;
  brake: boolean;
  lantern: boolean;
  longView: boolean;
  /** The station the train is braking for, when there's one. */
  approaching: string | null;
}

function loadImage(src: string) {
  const img = new Image();
  img.decoding = 'async';
  img.referrerPolicy = 'no-referrer';
  img.src = src;
  return img;
}

/** A gate the train hit: what was on the free tracks, to learn from at the end. */
interface Crash {
  gate: number;
  line: RailLine;
  /** The character on the track the train was on, and those on the free tracks. */
  hit: RailCharacter;
  free: RailCharacter[];
  airbag: boolean;
}

const freshGame = (line: RailLine, wagons: number) => ({
  line,
  linesUsed: new Set([line.id]),
  deck: [] as RailCharacter[],
  signs: [] as RailCharacter[],
  gate: null as Gate | null,
  lane: 1,
  wagons,
  passed: 0,
  score: 0,
  mult: 1,
  sectionGates: 0,
  stations: 0,
  airbags: 0,
  brake: false,
  lantern: false,
  longView: false,
  crashes: [] as Crash[],
  /** Gates reached, passed or not. */
  reached: 0,
});

/**
 * One run: three tracks, picture signs, name a free track's character to switch to it. Every
 * GATES_PER_STATION gates the train brakes into a station, where the player picks an item.
 */
export function RailRun({ line: startLine, difficulty, onExit }: { line: RailLine; difficulty: RailDifficulty; onExit: () => void }) {
  const d = RAIL_DIFFICULTY[difficulty];
  const bestKey = `rail:${startLine.id}:${difficulty}`;
  const best = useProgress((s) => s.bests[bestKey] ?? 0);
  const recordBest = useProgress((s) => s.recordBest);
  const canvas = useRef<HTMLCanvasElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const [phase, setPhase] = useState<Phase>('countdown');
  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  const [count, setCount] = useState(3);
  const [text, setText] = useState('');
  const [miss, setMiss] = useState(false);
  const [hud, setHud] = useState<Hud | null>(null);
  const [offer, setOffer] = useState<RailItemId[]>([]);
  const [choosingLine, setChoosingLine] = useState(false);
  const [toast, setToast] = useState<{ text: string; key: number } | null>(null);

  // Everything the frame loop touches lives in refs: React only redraws the HUD.
  const game = useRef(freshGame(startLine, d.wagons));
  const scene = useRef<Scene>({
    w: 800, h: 450, dist: 0, speed: d.start, maxSpeed: d.max, trainX: 0, lean: 0, gates: [], particles: [], shake: 0, flash: 0,
    palette: startLine.palette, blurSigns: d.blur, time: 0, station: null,
  });

  const say = (text: string) => {
    setToast({ text, key: Date.now() });
    window.setTimeout(() => setToast((t) => (t?.text === text ? null : t)), 1600);
  };

  const targetSpeed = () => {
    const g = game.current;
    return Math.min(d.max, d.start + g.passed * d.gain) * (g.brake ? 0.75 : 1);
  };

  /** The next characters, never repeating until the whole roster has come up. */
  const drawCharacters = (n: number) => {
    const g = game.current;
    const out: RailCharacter[] = [];
    while (out.length < n) {
      if (!g.deck.length) g.deck = shuffle(g.line.characters, Math.random);
      const c = g.deck.pop()!;
      if (!out.some((x) => x.id === c.id)) out.push(c);
    }
    return out;
  };

  const syncHud = () => {
    const g = game.current;
    const s = scene.current;
    setHud({
      line: g.line,
      signs: g.gate ? g.signs : [],
      blocked: g.gate?.blocked ?? [false, false, false],
      wagons: g.wagons,
      passed: g.passed,
      score: g.score,
      mult: g.mult,
      speed: s.speed,
      lane: g.lane,
      stations: g.stations,
      airbags: g.airbags,
      brake: g.brake,
      lantern: g.lantern,
      longView: g.longView,
      approaching: !g.gate && s.station ? s.station.name : null,
    });
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
    const react = Math.max(d.minReact, d.react - g.passed * 0.08) + (g.longView ? 1.5 : 0);
    // Leaving a station the train is still slow: place the gate by the speed it's heading for.
    g.gate = { at: s.dist + TRAIN_Z + Math.max(s.speed, targetSpeed() * 0.8) * react, blocked, images: g.signs.map((c) => loadImage(c.image)) as Gate['images'] };
    // Only gates already gone through stay (for a moment); an unpassed one is replaced.
    s.gates = [...s.gates.filter((x) => x.done && x.at > s.dist - 2), g.gate];
    syncHud();
  };

  /** The next station comes into sight; the train will brake to stop at it. */
  const spawnStation = () => {
    const g = game.current;
    const s = scene.current;
    g.gate = null;
    const stops = g.line.stations;
    s.station = { at: s.dist + TRAIN_Z + Math.max(55, s.speed * 4), name: stops[g.stations % stops.length] };
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
    if (phaseRef.current !== 'running' || !game.current.gate) return;
    const q = compactText(value);
    const i = game.current.signs.findIndex((c) => [c.name, ...c.aliases].some((n) => compactText(n) === q));
    if (q && i >= 0) switchTo(i);
  };
  const onEnter = () => {
    if (phaseRef.current !== 'running' || !game.current.gate || !text.trim()) return;
    const m = findBestMatch(text, game.current.signs, (c) => [c.name, ...c.aliases]);
    if (m) return switchTo(game.current.signs.indexOf(m.item));
    setText('');
    setMiss(true);
    window.setTimeout(() => setMiss(false), 400);
    sfx.wrong();
  };

  /** Off again: the section's items wear off at the next station, the next gate comes up. */
  const depart = () => {
    const g = game.current;
    g.sectionGates = 0;
    setOffer([]);
    setChoosingLine(false);
    setPhase('running');
    spawnGate();
  };

  const pick = (item: RailItemId) => {
    const g = game.current;
    sfx.correct();
    if (item === 'switch') return setChoosingLine(true);
    if (item === 'airbag') g.airbags += 1;
    if (item === 'wagon') g.wagons = Math.min(MAX_WAGONS, g.wagons + 1);
    if (item === 'brake') g.brake = true;
    if (item === 'lantern') g.lantern = true;
    if (item === 'longview') g.longView = true;
    say(`${RAIL_ITEMS[item].icon} ${RAIL_ITEMS[item].name}`);
    depart();
  };

  const changeLine = (next: RailLine) => {
    const g = game.current;
    const isNew = !g.linesUsed.has(next.id);
    g.linesUsed.add(next.id);
    if (isNew) g.mult += NEW_LINE_BONUS;
    g.line = next;
    g.deck = [];
    scene.current.palette = next.palette;
    say(isNew ? `🔀 ${next.label} · ×${g.mult}` : `🔀 ${next.label}`);
    depart();
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
          return 0;
        }
        sfx.click();
        return c - 1;
      });
    }, 700);
    return () => window.clearInterval(t);
  }, [phase === 'countdown']);

  // While the train runs, the name box keeps the focus: given back after the countdown, a station or
  // a pause (once React has enabled it), taken back after a click on the track, and any key typed
  // elsewhere goes into it.
  const focusInput = () => input.current?.focus({ preventScroll: true });
  useEffect(() => {
    if (phase === 'running') focusInput();
  }, [phase]);
  useTypeToFocus(input, phase === 'running');
  const onBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    // Leaving for a link or a button (the back link, a menu) is fine; anything else gives it back.
    const to = e.relatedTarget as HTMLElement | null;
    if (phaseRef.current === 'running' && !to?.closest('a, button, input, select, textarea')) requestAnimationFrame(focusInput);
  };

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
        s.speed += (targetSpeed() - s.speed) * Math.min(1, dt * 1.5);
        // Braking for a station: never faster than what still lets the train stop at it.
        if (s.station && !g.gate) {
          const left = s.station.at - s.dist - TRAIN_Z;
          s.speed = Math.min(s.speed, Math.sqrt(2 * STATION_BRAKING * Math.max(0, left)));
          if (left <= 0.25) {
            s.speed = 0;
            g.stations += 1;
            g.brake = g.lantern = g.longView = false;
            setOffer(stationOffer(g.wagons));
            setPhase('station');
            sfx.streak();
            syncHud();
          }
        }
      } else if (over) {
        s.speed = Math.max(0, s.speed - dt * 18);
      }
      if (running || over) s.dist += s.speed * dt;
      // The station stays behind once the train has left it.
      if (s.station && g.gate && s.dist > s.station.at + 20) s.station = null;
      // Slide toward the chosen track, leaning into it.
      const dx = (g.lane - 1) * LANE - s.trainX;
      s.trainX += dx * Math.min(1, dt * 9);
      s.lean = Math.max(-1, Math.min(1, dx / LANE));

      if (running && g.gate && g.gate.at - s.dist <= TRAIN_Z) {
        const here = laneIndex(s.trainX);
        if (g.gate.blocked[here]) {
          g.gate.done = 'smashed';
          const gate = g.gate;
          g.crashes.push({
            gate: g.reached + 1,
            line: g.line,
            hit: g.signs[here],
            free: g.signs.filter((_, i) => !gate.blocked[i]),
            airbag: g.airbags > 0,
          });
          const p = wheelPoint(s);
          if (g.airbags > 0) {
            // The air bag takes it: a jolt, no wagon lost, and the gate still counts (points too).
            // That's what sets it apart from an extra wagon, which only takes the hit.
            g.airbags -= 1;
            g.passed += 1;
            g.score += g.mult;
            s.shake = 0.5;
            sfx.hit();
            say('🎈 Air bag!');
            for (let k = 0; k < 24; k++) s.particles.push({ x: p.x, y: p.y - 40, vx: (Math.random() - 0.5) * 300, vy: -100 - Math.random() * 200, life: 1, color: '245,240,230', size: 3 + Math.random() * 3 });
          } else {
            g.wagons -= 1;
            s.shake = 1;
            s.flash = 1;
            sfx.hurt();
            for (let k = 0; k < 30; k++) {
              s.particles.push({ x: p.x, y: p.y - 40, vx: (Math.random() - 0.5) * 420, vy: -120 - Math.random() * 260, life: 1, color: Math.random() < 0.5 ? '198,40,40' : '245,240,230', size: 3 + Math.random() * 3 });
            }
          }
        } else {
          g.gate.done = 'passed';
          g.passed += 1;
          g.score += g.mult;
          sfx.correct();
        }
        g.sectionGates += 1;
        g.reached += 1;
        setText('');
        if (g.wagons <= 0) {
          setPhase('over');
          const points = Math.round(g.score);
          recordBest(bestKey, points);
          if (points > best && points > 0) window.setTimeout(() => (sfx.streak(), celebrateBig()), 600);
          syncHud();
        } else if (g.sectionGates >= GATES_PER_STATION) spawnStation();
        else spawnGate();
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
    game.current = freshGame(startLine, d.wagons);
    Object.assign(scene.current, { dist: 0, speed: d.start, trainX: 0, lean: 0, gates: [], particles: [], shake: 0, flash: 0, station: null, palette: startLine.palette });
    setText('');
    setOffer([]);
    setChoosingLine(false);
    setCount(3);
    setPhase('countdown');
  };

  const wagons = hud?.wagons ?? d.wagons;
  const effects = [
    hud?.airbags ? `🎈×${hud.airbags}` : null,
    hud?.brake ? '🛑' : null,
    hud?.lantern ? '🏮' : null,
    hud?.longView ? '🔭' : null,
  ].filter(Boolean);
  const g = game.current;

  return (
    <div className="space-y-3">
      <div ref={box} className="relative aspect-[4/3] w-full overflow-hidden rounded-xl border border-rule-strong bg-black shadow-2xl sm:aspect-[16/9]">
        <canvas ref={canvas} className="absolute inset-0 size-full" />
        {/* HUD: score, wagons, speed and the items at work. */}
        <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between p-3 font-display text-white drop-shadow">
          <div>
            <p className="text-[10px] uppercase tracking-[0.3em] opacity-80">
              Score{(hud?.mult ?? 1) > 1 && <span className="ml-1 font-bold text-amber-300">×{hud!.mult}</span>}
            </p>
            <p className="font-serif text-3xl font-bold tabular-nums">{Math.round(hud?.score ?? 0)}</p>
            {effects.length > 0 && <p className="text-sm">{effects.join(' ')}</p>}
          </div>
          <div className="flex items-center gap-1" aria-label={`${wagons} wagons left`}>
            <span className="text-2xl">🚂</span>
            {Array.from({ length: Math.max(d.wagons, wagons) }, (_, i) => (
              <span key={i} className={`h-4 w-6 rounded-sm border border-white/70 transition ${i < wagons ? 'bg-amber-500' : 'bg-transparent opacity-40'}`} />
            ))}
          </div>
          <div className="text-right">
            <p className="text-[10px] uppercase tracking-[0.3em] opacity-80">Speed</p>
            <p className="font-serif text-xl font-bold tabular-nums">{Math.round((hud?.speed ?? d.start) * 3.6)} km/h</p>
            <p className="text-[11px] opacity-80">
              {hud?.line.icon} {hud?.line.label}
            </p>
          </div>
        </div>
        {toast && (
          <p key={toast.key} className="animate-pop pointer-events-none absolute inset-x-0 top-1/3 text-center font-display text-2xl font-bold text-white drop-shadow-lg">
            {toast.text}
          </p>
        )}
        {phase === 'countdown' && count > 0 && (
          <div className="absolute inset-0 grid place-items-center">
            <span key={count} className="animate-pop font-serif text-8xl font-bold text-white drop-shadow-lg">
              {count}
            </span>
          </div>
        )}
        {phase === 'paused' && (
          <button type="button" onClick={() => setPhase('running')} className="absolute inset-0 grid place-items-center bg-black/50 font-display text-2xl font-bold text-white">
            ▶ Paused — tap to go on
          </button>
        )}
        {phase === 'station' && (
          <div className="animate-pop absolute inset-0 grid place-items-center overflow-y-auto bg-black/45 p-3">
            <div className="w-full max-w-xl space-y-3 rounded-lg bg-paper/95 p-4 text-center shadow-2xl sm:p-5">
              <p className="font-display text-xs uppercase tracking-[0.3em] text-ink-faint">
                Station {hud?.stations} · {hud?.passed} gates
              </p>
              <p className="font-serif text-2xl font-bold">🚉 {scene.current.station?.name}</p>
              {!choosingLine ? (
                <>
                  <p className="text-sm text-ink-soft">Pick one before you leave:</p>
                  <div className="grid gap-2 sm:grid-cols-3">
                    {offer.map((id) => (
                      <button key={id} type="button" onClick={() => pick(id)} className="flex flex-col items-center gap-1 rounded-md border border-rule-strong bg-card p-3 transition hover:-translate-y-0.5 hover:border-ink">
                        <span className="text-3xl">{RAIL_ITEMS[id].icon}</span>
                        <span className="font-display font-bold">{RAIL_ITEMS[id].name}</span>
                        <span className="text-xs text-ink-soft">{RAIL_ITEMS[id].blurb}</span>
                      </button>
                    ))}
                  </div>
                </>
              ) : (
                <>
                  <p className="text-sm text-ink-soft">Which line from here?</p>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {RAIL_LINES.filter((l) => l.id !== g.line.id).map((l) => (
                      <button
                        key={l.id}
                        type="button"
                        onClick={() => changeLine(l)}
                        className="flex flex-col items-start gap-0.5 rounded-md p-2.5 text-left transition hover:-translate-y-0.5"
                        style={{ background: `linear-gradient(160deg, ${l.palette[0]}, ${l.palette[1]})` }}
                      >
                        <span className="font-display text-sm font-bold text-white drop-shadow">
                          {l.icon} {l.label}
                        </span>
                        <span className="text-[11px] font-semibold text-amber-200 drop-shadow">{g.linesUsed.has(l.id) ? 'Ridden already' : `New line: +×${NEW_LINE_BONUS}`}</span>
                      </button>
                    ))}
                  </div>
                  <button type="button" onClick={() => setChoosingLine(false)} className="text-sm font-semibold text-ink-soft hover:text-ink">
                    ← Back to the items
                  </button>
                </>
              )}
            </div>
          </div>
        )}
        {phase === 'over' && (
          <div className="animate-pop absolute inset-0 grid place-items-center bg-black/55 p-4">
            <div className="space-y-3 rounded-lg bg-paper/95 p-6 text-center shadow-2xl">
              <p className="font-display text-sm uppercase tracking-widest text-ink-soft">End of the line</p>
              <p className="font-serif text-6xl font-bold">{Math.round(hud?.score ?? 0)}</p>
              <p className="text-sm text-ink-soft">
                {hud?.passed ?? 0} gates · {hud?.stations ?? 0} station{hud?.stations === 1 ? '' : 's'} · {g.linesUsed.size} line{g.linesUsed.size === 1 ? '' : 's'}
              </p>
              <p className="text-sm font-semibold">{Math.round(hud?.score ?? 0) > best ? '★ New best!' : `Best: ${best}`}</p>
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

      {/* Once it's over: every crash, with the names that would have saved it. */}
      {phase === 'over' && g.crashes.length > 0 && (
        <section className="animate-round-in space-y-2">
          <h3 className="font-display text-sm uppercase tracking-[0.25em] text-ink-faint">Where you crashed — and who would have got you through</h3>
          <ol className="space-y-2">
            {g.crashes.map((c, k) => (
              <li key={k} className={`rounded-md border p-3 ${c.airbag ? 'border-rule-strong bg-card' : 'border-miss/50 bg-miss/10'}`}>
                <p className="mb-2 font-display text-xs font-bold uppercase tracking-widest text-ink-soft">
                  Gate {c.gate} · {c.line.icon} {c.line.label} · {c.airbag ? '🎈 saved by an air bag' : '💥 a wagon lost'}
                </p>
                <div className="flex flex-wrap gap-2">
                  {c.free.map((x) => (
                    <div key={x.id} className="flex min-w-0 flex-1 basis-56 items-center gap-2 rounded-md border border-hit/50 bg-hit/10 p-1.5">
                      <img src={x.image} alt="" className="size-12 shrink-0 rounded object-cover object-top" />
                      <div className="min-w-0 text-sm">
                        <p className="font-semibold">{x.name}</p>
                        {x.aliases.length > 0 && <p className="text-xs text-ink-soft">also: {x.aliases.join(', ')}</p>}
                      </div>
                    </div>
                  ))}
                  <div className="flex min-w-0 basis-40 items-center gap-2 rounded-md border border-miss/40 p-1.5 opacity-70">
                    <img src={c.hit.image} alt="" className="size-10 shrink-0 rounded object-cover object-top grayscale" />
                    <p className="min-w-0 text-xs">
                      <span className="text-ink-faint">You were under</span> <span className="font-semibold">{c.hit.name}</span>
                    </p>
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </section>
      )}

      {/* The signs, big and readable: name a free track's character to switch to it. */}
      {phase === 'over' ? null : hud?.approaching ? (
        <p className="animate-round-in rounded-md border border-rule-strong bg-card p-4 text-center font-display font-bold">
          {phase === 'station' ? `🚉 ${hud.approaching} — pick an item to leave` : `🚉 Next station: ${hud.approaching} — braking…`}
        </p>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          {(hud?.signs ?? []).map((c, i) => {
            const blocked = hud!.blocked[i];
            const here = hud!.lane === i;
            return (
              <div
                key={`${c.id}-${i}`}
                className={`animate-round-in flex items-center gap-2 rounded-md border p-1.5 transition ${blocked ? 'border-miss/70 bg-miss/15' : 'border-hit/60 bg-hit/10'} ${here ? 'ring-2 ring-ink ring-offset-2 ring-offset-paper' : ''}`}
              >
                <div className="relative shrink-0">
                  <img src={c.image} alt="" draggable={false} className="size-12 rounded object-cover object-top sm:size-16" style={d.blur ? { filter: 'blur(3px)' } : undefined} />
                  {hud!.lantern && <span className="absolute bottom-0 right-0 rounded-tl bg-ink px-1 font-display text-sm font-bold text-paper">{c.name[0]}…</span>}
                </div>
                <div className="min-w-0 font-display text-xs font-bold leading-tight">
                  <p className="text-lg">{LANE_ARROWS[i]}</p>
                  <p className={blocked ? 'text-miss' : 'text-hit'}>{blocked ? 'Blocked' : 'Free'}</p>
                  {here && <p className="text-ink-faint">You</p>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <input
        ref={input}
        value={text}
        disabled={phase === 'over' || phase === 'station'}
        onChange={(e) => onType(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && onEnter()}
        onBlur={onBlur}
        placeholder="Name a free track's character…"
        autoComplete="off"
        autoCapitalize="off"
        spellCheck={false}
        className={`w-full rounded-xl border border-rule-strong bg-card/90 px-4 py-3 text-lg outline-none ring-accent/30 transition placeholder:text-ink-faint focus:border-accent focus:ring-4 ${miss ? 'animate-shake' : ''}`}
      />
    </div>
  );
}
