import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { HeartIcon } from '../boss/BossHeader';
import {
  COL_W,
  CROSS_LIVES,
  FAST_BONUS,
  FAST_FACTOR,
  HEIGHT,
  MIN_LINES,
  ROUNDS_PER_BOARD,
  TOP,
  boardGoals,
  CROSS_FRANCHISES,
  fallPoint,
  fallSpeed,
  fallStart,
  franchiseName,
  lineX,
  linesFor,
  nextTraveller,
  pairChance,
  pairGap,
  tripleChance,
  planBridges,
  stepFall,
  travellerName,
  waitFor,
  type Bridge,
  type Fall,
  type Traveller,
} from '../arcade/crossroads';
import { Spinner } from '../components/Spinner';
import { celebrate, celebrateBig, shake } from '../lib/fx';
import { useImagesReady } from '../lib/images';
import { sfx } from '../lib/sfx';
import { Customise, useCustomPicks } from '../components/Customise';
import { franchiseOptions } from '../lib/customOptions';
import { useProgress } from '../store/progress';

const BEST_KEY = 'cross:score';
const CROSS_OPTIONS = franchiseOptions(new Set(CROSS_FRANCHISES));
const PAUSE_MS = 1100;

/** 'waiting': the character at the top, about to fall — time to see who it is and to build. */
type Phase = 'ready' | 'waiting' | 'falling' | 'landed' | 'over';

interface Board {
  goals: string[];
  bridges: Bridge[];
  /** Rounds played on this board so far. */
  played: number;
}

/** One falling character of the round (later rounds have two). */
interface Runner {
  who: Traveller;
  fall: Fall;
  /** How long after the round's fall starts it sets off (ms): the second of a pair waits a moment. */
  delay: number;
  /** Sped up by the player: falls faster, worth a bonus point home. */
  fast: boolean;
  landed: { line: number; right: boolean } | null;
}

const newBoard = (home: number, allowed?: string[]): Board => ({ goals: boardGoals(linesFor(home), Math.random, allowed), bridges: [], played: 0 });
const randomLine = (lines: number, not?: number) => {
  const pick = Math.floor(Math.random() * (not === undefined ? lines : lines - 1));
  return not !== undefined && pick >= not ? pick + 1 : pick;
};

/** The round's characters: one, or (later on) two on different lines, the second a moment behind. */
function newRunners(goals: string[], recent: string[], home: number): Runner[] {
  const first = nextTraveller(goals, recent);
  const line = randomLine(goals.length);
  const runners: Runner[] = [{ who: first, fall: fallStart(line), delay: 0, fast: false, landed: null }];
  if (Math.random() < pairChance(home)) {
    const second = nextTraveller(goals, [first.name, ...recent]);
    const line2 = randomLine(goals.length, line);
    if (second.name !== first.name) runners.push({ who: second, fall: fallStart(line2), delay: pairGap(home), fast: false, landed: null });
    // Later still, a third, on a line of its own.
    if (runners.length === 2 && goals.length >= 3 && Math.random() < tripleChance(home)) {
      const third = nextTraveller(goals, [first.name, second.name, ...recent]);
      const free = Array.from({ length: goals.length }, (_, k) => k).filter((k) => k !== line && k !== line2);
      if (third.name !== first.name && third.name !== second.name) runners.push({ who: third, fall: fallStart(free[Math.floor(Math.random() * free.length)]), delay: 2 * pairGap(home), fast: false, landed: null });
    }
  }
  return runners;
}

function Game({ allowed, bestKey }: { allowed: string[]; bestKey: string }) {
  const best = useProgress((s) => s.bests[bestKey] ?? 0);
  const recordBest = useProgress((s) => s.recordBest);
  const lang = useProgress((s) => s.nameLang);
  const [board, setBoardState] = useState<Board>(() => newBoard(0, allowed));
  const [runners, setRunnersState] = useState<Runner[]>(() => newRunners(board.goals, [], 0));
  const [phase, setPhase] = useState<Phase>('ready');
  // Points (a sped-up landing is worth more), and characters brought home (what the difficulty follows).
  const [score, setScoreState] = useState(0);
  const [home, setHomeState] = useState(0);
  const [lives, setLivesState] = useState(CROSS_LIVES);
  const [note, setNote] = useState<string | null>(null);
  const [drag, setDrag] = useState<{ a: { x: number; y: number }; b: { x: number; y: number } } | null>(null);
  /** The last bonus earned, floating up from where it landed. */
  const [bonus, setBonus] = useState<{ x: number; key: number } | null>(null);
  const svg = useRef<SVGSVGElement>(null);
  const gameBox = useRef<HTMLDivElement>(null);
  const recent = useRef<string[]>([]);
  const nextId = useRef(1);
  // The best before this run, for "a new best!" (the store's best moves as the score grows).
  const bestBefore = useRef(best);
  // The fall loop and its timers read the latest state from these.
  const boardRef = useRef(board);
  const setBoard = (b: Board) => ((boardRef.current = b), setBoardState(b));
  const runnersRef = useRef(runners);
  const setRunners = (r: Runner[]) => ((runnersRef.current = r), setRunnersState(r));
  const scoreRef = useRef(0);
  const setScore = (n: number) => ((scoreRef.current = n), setScoreState(n));
  const homeRef = useRef(0);
  const setHome = (n: number) => ((homeRef.current = n), setHomeState(n));
  const livesRef = useRef(CROSS_LIVES);
  const setLives = (n: number) => ((livesRef.current = n), setLivesState(n));

  // The fall waits for the faces: no one should be falling before you can see who it is.
  const ready = useImagesReady(runners.map((r) => r.who.image));
  const readyRef = useRef(ready);
  readyRef.current = ready;

  const lines = board.goals.length;
  const width = lines * COL_W;
  const speed = fallSpeed(home);
  const wait = waitFor(home);
  // Each round's wait, for its countdown ring.
  const [round, setRound] = useState(0);

  // The wait at the top: it starts once the faces have loaded, so the whole wait is spent seeing them.
  useEffect(() => {
    if (phase !== 'waiting' || !ready) return;
    const t = window.setTimeout(() => setPhase('falling'), wait);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, ready, round]);
  /** Drop the characters now, without waiting. */
  const dropNow = () => {
    if (phase !== 'waiting' || !ready) return;
    sfx.whoosh();
    setPhase('falling');
  };
  /** Speed up the falling characters (one, or all of them): you're sure of the way, and it's worth a bonus. */
  const speedUp = (only?: number) => {
    if (phase !== 'falling') return;
    const rs = runnersRef.current;
    if (!rs.some((r, i) => !r.landed && !r.fast && (only === undefined || only === i))) return;
    sfx.whoosh();
    setRunners(rs.map((r, i) => (!r.landed && (only === undefined || only === i) ? { ...r, fast: true } : r)));
  };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== ' ' && e.key !== 'Enter') return;
      if (phase === 'waiting') (e.preventDefault(), dropNow());
      else if (phase === 'falling') (e.preventDefault(), speedUp());
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  // The fall itself: every character of the round, the second setting off a moment after the first.
  useEffect(() => {
    if (phase !== 'falling') return;
    let id = 0;
    let last = performance.now();
    let elapsed = 0;
    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (!readyRef.current) return void (id = requestAnimationFrame(frame));
      elapsed += dt * 1000;
      const cur = runnersRef.current;
      const landings: number[] = [];
      const next = cur.map((r, i) => {
        if (r.landed || elapsed < r.delay) return r;
        const { fall, landed } = stepFall(r.fall, boardRef.current.bridges, speed * (r.fast ? FAST_FACTOR : 1) * dt);
        if (landed === null) return { ...r, fall };
        landings.push(i);
        return { ...r, fall, landed: { line: landed, right: boardRef.current.goals[landed] === r.who.franchise } };
      });
      setRunners(next);
      landings.forEach((i) => land(next[i]));
      if (next.every((r) => r.landed)) return void endRound();
      id = requestAnimationFrame(frame);
    };
    id = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  /** One character reaching the bottom: a point (two if sped up), or a heart lost. */
  const land = (r: Runner) => {
    if (r.landed!.right) {
      sfx.correct();
      celebrate();
      const s = scoreRef.current + 1 + (r.fast ? FAST_BONUS : 0);
      setScore(s);
      setHome(homeRef.current + 1);
      if (r.fast) setBonus({ x: lineX(r.landed!.line), key: Date.now() });
      recordBest(bestKey, s, { save: true });
      return;
    }
    sfx.hurt();
    shake(svg.current?.parentElement ?? null, 8, 380);
    setLives(Math.max(0, livesRef.current - 1));
  };

  /** Everyone has landed: the next round, or the end of the run. */
  const endRound = () => {
    setPhase('landed');
    if (livesRef.current > 0) return void window.setTimeout(nextRound, PAUSE_MS);
    window.setTimeout(() => {
      setPhase('over');
      // The run's end: a step for every character home, half a step for each bonus point (a sped-up landing).
      recordBest(bestKey, scoreRef.current, { reached: homeRef.current + (scoreRef.current - homeRef.current) / 2 });
      if (scoreRef.current > bestBefore.current) (sfx.streak(), celebrateBig());
    }, PAUSE_MS);
  };

  const nextRound = () => {
    recent.current = [...runnersRef.current.map((r) => r.who.name), ...recent.current].slice(0, 8);
    let b = { ...boardRef.current, played: boardRef.current.played + 1 };
    if (b.played >= ROUNDS_PER_BOARD) {
      b = newBoard(homeRef.current, allowed);
      setNote('New crossroads: the bridges are cleared.');
    } else setNote(null);
    setBoard(b);
    setRunners(newRunners(b.goals, recent.current, homeRef.current));
    setBonus(null);
    setRound((r) => r + 1);
    setPhase('waiting');
  };

  const start = () => {
    sfx.click();
    // The whole board in view, from the tops of the lines to the franchises.
    gameBox.current?.scrollIntoView({ block: 'start', behavior: 'smooth' });
    setRound((r) => r + 1);
    setPhase('waiting');
  };
  const restart = () => {
    sfx.click();
    const b = newBoard(0, allowed);
    recent.current = [];
    bestBefore.current = Math.max(bestBefore.current, scoreRef.current);
    setBoard(b);
    setRunners(newRunners(b.goals, [], 0));
    setScore(0);
    setHome(0);
    setLives(CROSS_LIVES);
    setNote(null);
    setBonus(null);
    setRound((r) => r + 1);
    setPhase('waiting');
  };

  // ── Drawing ─────────────────────────────────────────────────────────
  const toSvg = (e: React.PointerEvent) => {
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(svg.current!.getScreenCTM()!.inverse());
    return { x: p.x, y: p.y };
  };
  // What the stroke being drawn would build, shown as it's drawn.
  const longEnough = (d: { a: { x: number; y: number }; b: { x: number; y: number } }) => Math.hypot(d.b.x - d.a.x, d.b.y - d.a.y) >= 14;
  const plan = drag && longEnough(drag) ? planBridges(drag.a, drag.b, lines, board.bridges) : null;

  const onDown = (e: React.PointerEvent) => {
    if (phase === 'over') return;
    (e.target as Element).setPointerCapture?.(e.pointerId);
    const p = toSvg(e);
    setDrag({ a: p, b: p });
  };
  const onMove = (e: React.PointerEvent) => drag && setDrag({ ...drag, b: toSvg(e) });
  const onUp = () => {
    if (!drag) return;
    setDrag(null);
    const { a, b } = drag;
    const cur = boardRef.current;
    // A tap builds nothing (bridges are there to stay): on a waiting character it drops them, on a falling
    // one it speeds them up.
    if (!longEnough(drag)) {
      const hit = runnersRef.current.findIndex((r) => {
        const at = fallPoint(r.fall);
        return !r.landed && Math.hypot(a.x - at.x, a.y - at.y) < 40;
      });
      if (hit >= 0 && phase === 'waiting') dropNow();
      else if (hit >= 0 && phase === 'falling') speedUp(hit);
      return;
    }
    const p = planBridges(a, b, lines, cur.bridges);
    if (!p.ok) return (sfx.wrong(), setNote(p.reason));
    sfx.click();
    setNote(null);
    setBoard({ ...cur, bridges: [...cur.bridges, ...p.bridges.map((br) => ({ ...br, id: nextId.current++ }))] });
  };

  const left = ROUNDS_PER_BOARD - board.played;
  const canSpeed = phase === 'falling' && runners.some((r) => !r.landed && !r.fast);
  const wrong = runners.find((r) => r.landed && !r.landed.right);
  const names = runners.map((r) => travellerName(r.who, lang));
  return (
    // The whole game fits the screen's height: no scrolling mid-fall, and the tops of the lines never
    // slip under the site's header (where a stroke can't reach).
    <div ref={gameBox} className="mx-auto scroll-mt-16 space-y-3" style={{ maxWidth: `max(260px, min(${Math.max(360, lines * 104)}px, calc((100dvh - 290px) * ${width / HEIGHT})))` }}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          {Array.from({ length: CROSS_LIVES }, (_, i) => (
            <HeartIcon key={i} full={i < lives} className="size-5" />
          ))}
        </div>
        <p className="font-display text-sm text-ink-soft">
          Score <span className="font-serif text-2xl font-bold text-ink">{score}</span> · best {Math.max(best, score)}
        </p>
        <p className="font-display text-xs text-ink-soft" title="Each character brought home makes the fall a little quicker">
          ⚡ ×{(speed / fallSpeed(0)).toFixed(1)} · 🌉 cleared in {left}
        </p>
      </div>

      <div className="flex items-center justify-center gap-3 rounded-md border border-rule-strong bg-card px-3 py-2">
        <span className="flex -space-x-3">
          {runners.map((r, i) =>
            ready ? (
              <img key={i} src={r.who.image} alt="" className="size-10 rounded-full border-2 border-card bg-tile object-cover object-top" />
            ) : (
              <span key={i} className="grid size-10 place-items-center rounded-full bg-tile">
                <Spinner />
              </span>
            ),
          )}
        </span>
        <p className={`font-display font-bold ${phase === 'waiting' ? 'animate-pop' : ''}`} key={round}>
          Lead{' '}
          {names.map((n, k) => (
            <span key={k}>
              {k > 0 && (k === names.length - 1 ? ' and ' : ', ')}
              <span className="text-accent">{n}</span>
            </span>
          ))}{' '}
          home
        </p>
        {phase === 'waiting' && ready && (
          <button type="button" onClick={dropNow} className="btn-paper rounded-md px-3 py-1 font-display text-xs font-bold tracking-wider" title="Or tap the character, or press Space">
            Drop now ⏬
          </button>
        )}
        {canSpeed && (
          <button type="button" onClick={() => speedUp()} className="btn-accent rounded-md px-3 py-1 font-display text-xs font-bold tracking-wider" title="Sure of the way? Speed them up for a bonus point each (or tap one, or press Space)">
            Faster ⏩ +{FAST_BONUS}
          </button>
        )}
      </div>

      <svg
        ref={svg}
        viewBox={`0 0 ${width} ${HEIGHT}`}
        className={`block w-full touch-none select-none ${phase !== 'over' ? 'cursor-crosshair' : ''}`}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={() => setDrag(null)}
        aria-label="The crossroads: draw from one line to the next to build a bridge"
      >
        {Array.from({ length: lines }, (_, i) => (
          <line key={i} x1={lineX(i)} y1={TOP - 10} x2={lineX(i)} y2={HEIGHT} className="stroke-ink-soft" strokeWidth={4} strokeLinecap="round" />
        ))}
        {/* Bridges pass over the lines between their ends: a paper edge shows it. */}
        {board.bridges.map((br) => (
          <g key={br.id}>
            <line x1={lineX(br.a)} y1={br.ya} x2={lineX(br.b)} y2={br.yb} className="stroke-paper" strokeWidth={12} strokeLinecap="round" />
            <line x1={lineX(br.a)} y1={br.ya} x2={lineX(br.b)} y2={br.yb} className="stroke-accent" strokeWidth={6} strokeLinecap="round" />
            <circle cx={lineX(br.a)} cy={br.ya} r={5} className="fill-accent" />
            <circle cx={lineX(br.b)} cy={br.yb} r={5} className="fill-accent" />
          </g>
        ))}
        {drag && Math.hypot(drag.b.x - drag.a.x, drag.b.y - drag.a.y) > 6 && (
          <line x1={drag.a.x} y1={drag.a.y} x2={drag.b.x} y2={drag.b.y} className="stroke-ink-faint" strokeWidth={3} strokeDasharray="6 6" strokeLinecap="round" opacity={0.6} />
        )}
        {/* What the stroke will build, where it will go: green if it can, red if it can't. */}
        {plan?.bridges.map((br, k) => (
          <g key={k} opacity={0.75}>
            <line x1={lineX(br.a)} y1={br.ya} x2={lineX(br.b)} y2={br.yb} className={plan.ok ? 'stroke-hit' : 'stroke-miss'} strokeWidth={6} strokeLinecap="round" />
            <circle cx={lineX(br.a)} cy={br.ya} r={6} className={plan.ok ? 'fill-hit' : 'fill-miss'} />
            <circle cx={lineX(br.b)} cy={br.yb} r={6} className={plan.ok ? 'fill-hit' : 'fill-miss'} />
          </g>
        ))}
        <defs>
          <clipPath id="cross-face">
            <circle r={21} />
          </clipPath>
        </defs>
        {runners.map((r, i) => {
          const at = fallPoint(r.fall);
          return (
            <g key={`${round}-${i}`} transform={`translate(${at.x} ${Math.min(at.y, HEIGHT - 24)})`}>
              {/* Its countdown: the second of a pair waits a moment longer than the first. */}
              {phase === 'waiting' && ready && (
                <circle r={31} className="cross-wait fill-none stroke-accent" strokeWidth={4} pathLength={100} strokeDasharray="100" transform="rotate(-90)" style={{ animationDuration: `${wait + r.delay}ms` }} />
              )}
              {/* Sped up: a trail of speed lines above it. */}
              {r.fast && !r.landed && (
                <g className="stroke-accent" strokeWidth={3} strokeLinecap="round" opacity={0.7}>
                  <line x1={-10} y1={-30} x2={-10} y2={-52} />
                  <line x1={0} y1={-32} x2={0} y2={-60} />
                  <line x1={10} y1={-30} x2={10} y2={-52} />
                </g>
              )}
              <circle r={24} className={r.landed ? (r.landed.right ? 'fill-hit' : 'fill-miss') : r.fast ? 'fill-ochre' : 'fill-accent'} />
              <image href={r.who.image} x={-21} y={-21} width={42} height={42} clipPath="url(#cross-face)" preserveAspectRatio="xMidYMin slice" />
            </g>
          );
        })}
        {bonus && (
          <text key={bonus.key} x={bonus.x} y={HEIGHT - 60} textAnchor="middle" className="cross-bonus fill-ochre font-display text-[26px] font-black">
            +{1 + FAST_BONUS}
          </text>
        )}
      </svg>

      <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${lines}, 1fr)` }}>
        {board.goals.map((g, c) => {
          const here = runners.filter((r) => r.landed?.line === c);
          const tone = here.length ? (here.every((r) => r.landed!.right) ? 'border-hit bg-hit/15' : 'border-miss bg-miss/15') : 'border-rule-strong bg-card';
          return (
            <div key={g} className={`flex min-h-12 items-center justify-center rounded-md border-2 p-1 text-center transition ${tone}`}>
              <p className="text-[11px] font-bold leading-tight sm:text-xs">{franchiseName(g, lang)}</p>
            </div>
          );
        })}
      </div>

      <p className="h-5 text-center text-sm font-semibold text-coral">{wrong ? `${travellerName(wrong.who, lang)} is from ${franchiseName(wrong.who.franchise, lang)}.` : note}</p>

      {phase === 'ready' && (
        <div className="text-center">
          <button type="button" onClick={start} className="btn-accent rounded-md px-8 py-3 font-display text-lg font-bold tracking-widest">
            Start
          </button>
          <p className="mt-2 text-xs text-ink-faint">You can draw bridges before you start, too. Each character waits a moment at the top before falling.</p>
        </div>
      )}
      {phase === 'over' && (
        <div className="animate-pop space-y-2 rounded-md border border-miss/50 bg-miss/10 p-4 text-center">
          <p className="font-display text-xl font-bold">Out of hearts</p>
          <p className="text-ink-soft">
            {score} point{score === 1 ? '' : 's'}, {home} brought home{score > bestBefore.current ? ' — a new best!' : ''}
          </p>
          <button type="button" onClick={restart} className="btn-ink rounded-md px-6 py-2.5 font-display font-bold tracking-wider">
            Play again
          </button>
        </div>
      )}
    </div>
  );
}

/** /crossroads */
export default function Crossroads() {
  const { picks, setPicks, custom } = useCustomPicks('omnidle-custom-crossroads', CROSS_OPTIONS);
  return (
    <div className="space-y-6">
      <div className="mx-auto max-w-2xl">
        <Link to="/games" className="font-display text-sm font-semibold tracking-wider text-ink-soft hover:text-ink">
          ← Games
        </Link>
        <h1 className="text-5xl font-bold">Crossroads</h1>
        <p className="text-ink-soft">
          A character falls down one of the lines: lead them to their own franchise at the bottom. Draw a bridge between two neighbouring lines,
          at any angle — whoever meets its end takes it, across to the other line, and keeps falling. A stroke across several lines builds a
          bridge over each gap, and you see where it will go as you draw. Each character waits a moment at the top first. A bridge can&apos;t be taken back: your
          bridges stay for the next characters, and are cleared every {ROUNDS_PER_BOARD} rounds; every character brought home makes the fall a little quicker,
          and later on two of them fall at once, a moment apart. Sure of the way? Speed a falling character up (the button, a tap on them, or Space)
          for +{FAST_BONUS} point if they land home.
        </p>
      </div>
      <div className="mx-auto max-w-2xl">
        <Customise options={CROSS_OPTIONS} picks={picks} onChange={setPicks} min={MIN_LINES} />
      </div>
      {picks.length >= MIN_LINES && <Game key={picks.join(',')} allowed={picks} bestKey={custom ? 'cross:custom' : BEST_KEY} />}
    </div>
  );
}
