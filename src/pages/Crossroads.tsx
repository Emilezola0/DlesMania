import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { HeartIcon } from '../boss/BossHeader';
import {
  BOTTOM,
  COL_W,
  CROSS_LIVES,
  HEIGHT,
  ROUNDS_PER_BOARD,
  TOP,
  boardGoals,
  crowded,
  fallPoint,
  fallSpeed,
  fallStart,
  franchiseName,
  lineX,
  linesFor,
  nextTraveller,
  stepFall,
  travellerName,
  type Bridge,
  type Fall,
  type Traveller,
} from '../arcade/crossroads';
import { Spinner } from '../components/Spinner';
import { celebrate, celebrateBig, shake } from '../lib/fx';
import { useImagesReady } from '../lib/images';
import { sfx } from '../lib/sfx';
import { useProgress } from '../store/progress';

const BEST_KEY = 'cross:score';
/** How close to a line a stroke has to start and end to count, in SVG units. */
const SNAP = 42;
const PAUSE_MS = 1100;

type Phase = 'ready' | 'falling' | 'landed' | 'over';

interface Board {
  goals: string[];
  bridges: Bridge[];
  /** Characters played on this board so far. */
  played: number;
}

const newBoard = (score: number): Board => ({ goals: boardGoals(linesFor(score)), bridges: [], played: 0 });
const randomLine = (lines: number) => Math.floor(Math.random() * lines);


function Game() {
  const best = useProgress((s) => s.bests[BEST_KEY] ?? 0);
  const recordBest = useProgress((s) => s.recordBest);
  const lang = useProgress((s) => s.nameLang);
  const [board, setBoardState] = useState<Board>(() => newBoard(0));
  const [who, setWho] = useState<Traveller>(() => nextTraveller(board.goals, []));
  const [fall, setFall] = useState<Fall>(() => fallStart(randomLine(board.goals.length)));
  const [phase, setPhase] = useState<Phase>('ready');
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(CROSS_LIVES);
  const [landed, setLanded] = useState<{ line: number; right: boolean } | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [drag, setDrag] = useState<{ a: { x: number; y: number }; b: { x: number; y: number } } | null>(null);
  const svg = useRef<SVGSVGElement>(null);
  const recent = useRef<string[]>([]);
  const nextId = useRef(1);
  // The best before this run, for "a new best!" (the store's best moves as the score grows).
  const bestBefore = useRef(best);
  // The fall loop and its timers read the latest board (bridges drawn mid-fall included) from here.
  const boardRef = useRef(board);
  const setBoard = (b: Board) => ((boardRef.current = b), setBoardState(b));

  // The fall waits for the face: no one should be falling before you can see who it is.
  const ready = useImagesReady([who.image]);
  const readyRef = useRef(ready);
  readyRef.current = ready;

  const lines = board.goals.length;
  const width = lines * COL_W;
  const speed = fallSpeed(score);

  // The fall itself.
  useEffect(() => {
    if (phase !== 'falling') return;
    let id = 0;
    let last = performance.now();
    let cur = fall;
    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (!readyRef.current) return void (id = requestAnimationFrame(frame));
      const { fall: f, landed: line } = stepFall(cur, boardRef.current.bridges, speed * dt);
      cur = f;
      setFall(f);
      if (line === null) id = requestAnimationFrame(frame);
      else land(line);
    };
    id = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  const land = (line: number) => {
    const right = boardRef.current.goals[line] === who.franchise;
    setLanded({ line, right });
    setPhase('landed');
    if (right) {
      sfx.correct();
      celebrate();
      const s = score + 1;
      setScore(s);
      recordBest(BEST_KEY, s, { save: true });
      window.setTimeout(() => nextRound(s), PAUSE_MS);
      return;
    }
    sfx.hurt();
    shake(svg.current?.parentElement ?? null, 8, 380);
    const l = lives - 1;
    setLives(l);
    if (l > 0) return void window.setTimeout(() => nextRound(score), PAUSE_MS);
    window.setTimeout(() => {
      setPhase('over');
      // The run's end: a coin a couple of landings.
      recordBest(BEST_KEY, score, { reached: score / 2 });
      if (score > bestBefore.current) (sfx.streak(), celebrateBig());
    }, PAUSE_MS);
  };

  const nextRound = (s: number) => {
    recent.current = [who.name, ...recent.current].slice(0, 8);
    let b = { ...boardRef.current, played: boardRef.current.played + 1 };
    if (b.played >= ROUNDS_PER_BOARD) {
      b = newBoard(s);
      setNote('New crossroads: the bridges are cleared.');
    } else setNote(null);
    setBoard(b);
    setWho(nextTraveller(b.goals, recent.current));
    setFall(fallStart(randomLine(b.goals.length)));
    setLanded(null);
    setPhase('falling');
  };

  const start = () => {
    sfx.click();
    setPhase('falling');
  };
  const restart = () => {
    sfx.click();
    const b = newBoard(0);
    recent.current = [];
    bestBefore.current = Math.max(bestBefore.current, score);
    setBoard(b);
    setWho(nextTraveller(b.goals, []));
    setFall(fallStart(randomLine(b.goals.length)));
    setScore(0);
    setLives(CROSS_LIVES);
    setLanded(null);
    setNote(null);
    setPhase('falling');
  };

  // ── Drawing ─────────────────────────────────────────────────────────
  const toSvg = (e: React.PointerEvent) => {
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(svg.current!.getScreenCTM()!.inverse());
    return { x: p.x, y: p.y };
  };
  const lineNear = (x: number) => {
    const col = Math.round((x - COL_W / 2) / COL_W);
    return col >= 0 && col < lines && Math.abs(x - lineX(col)) <= SNAP ? col : null;
  };
  const clampY = (y: number) => Math.max(TOP + 14, Math.min(BOTTOM - 14, y));

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
    // A tap does nothing: bridges are there to stay — the board fills up, and that's the game.
    if (Math.hypot(b.x - a.x, b.y - a.y) < 14) return;
    const la = lineNear(a.x);
    const lb = lineNear(b.x);
    if (la === null || lb === null || la === lb) return setNote('A bridge starts on one line and ends on the next one.');
    // Only neighbouring lines: from line 1 to line 3 takes two bridges, 1 to 2 and 2 to 3.
    if (Math.abs(la - lb) !== 1) return (sfx.wrong(), setNote('A bridge only joins two neighbouring lines.'));
    const ya = clampY(a.y);
    const yb = clampY(b.y);
    if (crowded(cur.bridges, la, ya) || crowded(cur.bridges, lb, yb)) return (sfx.wrong(), setNote('Too close to another bridge on that line.'));
    sfx.click();
    setNote(null);
    setBoard({ ...cur, bridges: [...cur.bridges, { id: nextId.current++, a: la, ya, b: lb, yb }] });
  };

  const at = fallPoint(fall);
  const left = ROUNDS_PER_BOARD - board.played;
  return (
    <div className="mx-auto space-y-3" style={{ maxWidth: Math.max(360, lines * 104) }}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          {Array.from({ length: CROSS_LIVES }, (_, i) => (
            <HeartIcon key={i} full={i < lives} className="size-5" />
          ))}
        </div>
        <p className="font-display text-sm text-ink-soft">
          Score <span className="font-serif text-2xl font-bold text-ink">{score}</span> · best {Math.max(best, score)}
        </p>
        <p className="font-display text-xs text-ink-soft" title="Each point makes the fall a little quicker">
          ⚡ ×{(speed / fallSpeed(0)).toFixed(1)} · 🌉 cleared in {left}
        </p>
      </div>

      <div className="flex items-center justify-center gap-3 rounded-md border border-rule-strong bg-card px-3 py-2">
        {ready ? <img src={who.image} alt="" className="size-10 rounded-full bg-tile object-cover object-top" /> : <span className="grid size-10 place-items-center rounded-full bg-tile"><Spinner /></span>}
        <p className="font-display font-bold">
          Lead <span className="text-accent">{travellerName(who, lang)}</span> home
        </p>
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
          <line x1={drag.a.x} y1={drag.a.y} x2={drag.b.x} y2={drag.b.y} className="stroke-accent" strokeWidth={4} strokeDasharray="8 6" strokeLinecap="round" opacity={0.7} />
        )}
        <defs>
          <clipPath id="cross-face">
            <circle r={21} />
          </clipPath>
        </defs>
        <g transform={`translate(${at.x} ${Math.min(at.y, HEIGHT - 24)})`}>
          <circle r={24} className={landed ? (landed.right ? 'fill-hit' : 'fill-miss') : 'fill-accent'} />
          <image href={who.image} x={-21} y={-21} width={42} height={42} clipPath="url(#cross-face)" preserveAspectRatio="xMidYMin slice" />
        </g>
      </svg>

      <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${lines}, 1fr)` }}>
        {board.goals.map((g, c) => {
          const tone = landed?.line === c ? (landed.right ? 'border-hit bg-hit/15' : 'border-miss bg-miss/15') : 'border-rule-strong bg-card';
          return (
            <div key={g} className={`flex min-h-12 items-center justify-center rounded-md border-2 p-1 text-center transition ${tone}`}>
              <p className="text-[11px] font-bold leading-tight sm:text-xs">{franchiseName(g, lang)}</p>
            </div>
          );
        })}
      </div>

      <p className="h-5 text-center text-sm font-semibold text-coral">{landed && !landed.right ? `${travellerName(who, lang)} is from ${franchiseName(who.franchise, lang)}.` : note}</p>

      {phase === 'ready' && (
        <div className="text-center">
          <button type="button" onClick={start} className="btn-accent rounded-md px-8 py-3 font-display text-lg font-bold tracking-widest">
            Start
          </button>
          <p className="mt-2 text-xs text-ink-faint">You can draw bridges before you start, too.</p>
        </div>
      )}
      {phase === 'over' && (
        <div className="animate-pop space-y-2 rounded-md border border-miss/50 bg-miss/10 p-4 text-center">
          <p className="font-display text-xl font-bold">Out of hearts</p>
          <p className="text-ink-soft">
            {score} brought home{score > bestBefore.current ? ' — a new best!' : ''}
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
  return (
    <div className="space-y-6">
      <div className="mx-auto max-w-2xl">
        <Link to="/games" className="font-display text-sm font-semibold tracking-wider text-ink-soft hover:text-ink">
          ← Games
        </Link>
        <h1 className="text-5xl font-bold">Crossroads</h1>
        <p className="text-ink-soft">
          A character falls down one of the lines: lead them to their own franchise at the bottom. Draw a bridge between two neighbouring lines,
          at any angle — whoever meets its end takes it, across to the other line, and keeps falling. A bridge can&apos;t be taken back: your
          bridges stay for the next characters, and are cleared every {ROUNDS_PER_BOARD}; every point makes the fall a little quicker.
        </p>
      </div>
      <Game />
    </div>
  );
}
