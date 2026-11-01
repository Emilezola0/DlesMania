import { useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { aiMove, compile, land, newField, play, winnerOf, type Level, type LogLine, type World } from '../arcade/curveClash';
import { CLASH_PLAYERS, ClashField, ClashLog, LevelPicker } from '../components/ClashField';
import { shake } from '../lib/fx';
import { sfx } from '../lib/sfx';
import { CurveClashOnline } from './CurveClashOnline';

/** How long a shot takes to be drawn out (the .clash-shot animation), then a breath before the next. */
const SHOT_MS = 1300;

/**
 * A game on this device: two players taking turns, or a player against the computer — the player fires
 * first, then the computer answers with a curve it worked out to hit them (shown, to learn from).
 */
function Duel({ vsComputer }: { vsComputer: boolean }) {
  const [level, setLevel] = useState<Level>('medium');
  const [seed, setSeed] = useState(() => Math.floor(Math.random() * 1e9));
  const fresh = useMemo(() => newField(seed, level), [seed, level]);
  const [world, setWorld] = useState<World>(fresh);
  const [fieldOf, setFieldOf] = useState(fresh);
  const [turn, setTurn] = useState<0 | 1>(0);
  const [picked, setPicked] = useState<string | undefined>();
  const [src, setSrc] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [shots, setShots] = useState<{ path: [number, number][]; player: 0 | 1 }[]>([]);
  const [shotsKey, setShotsKey] = useState(0);
  const [log, setLog] = useState<LogLine[]>([]);
  const [busy, setBusy] = useState(false);
  const board = useRef<HTMLDivElement>(null);
  const field = useRef<HTMLInputElement>(null);

  // A new field (another seed or level): a new game.
  if (fieldOf !== fresh) {
    setFieldOf(fresh);
    setWorld(fresh);
    setTurn(0);
    setPicked(undefined);
    setShots([]);
    setLog([]);
    setSrc('');
    setBusy(false);
  }

  const winner = winnerOf(world);
  const mine = world.gunners.filter((g) => g.player === turn && g.alive);
  const from = mine.find((g) => g.id === picked) ?? mine[0];

  /** A move played: its shot drawn, then its hit or hole lands. Returns the field after it. */
  const shoot = (w: World, player: 0 | 1, f: string, g: string | undefined) => {
    const { shot, line } = play(w, player, { f, g });
    sfx.whoosh();
    setShots(shot ? [{ path: shot.path, player }] : []);
    setShotsKey((k) => k + 1);
    setLog((l) => [line, ...l].slice(0, 12));
    const after = land(w, shot ? [shot] : []);
    window.setTimeout(() => {
      setWorld(after);
      if (shot?.hit) (sfx.streak(), shake(board.current, 10, 400));
    }, SHOT_MS - 300);
    return after;
  };

  const fire = () => {
    if (busy || winner !== null || !from) return;
    try {
      compile(src);
    } catch (e) {
      setError((e as Error).message);
      sfx.wrong();
      return;
    }
    setError(null);
    setBusy(true);
    const after = shoot(world, turn, src.trim(), from.id);
    window.setTimeout(() => {
      setSrc('');
      if (vsComputer) {
        // The computer answers, if it still has a gunner standing.
        if (winnerOf(after) !== null) return setBusy(false);
        const m = aiMove(after, 1);
        shoot(after, 1, m.f ?? '0', m.g);
        window.setTimeout(() => (setBusy(false), field.current?.focus()), SHOT_MS + 200);
      } else {
        setTurn(turn === 0 ? 1 : 0);
        setPicked(undefined);
        setBusy(false);
        field.current?.focus();
      }
    }, SHOT_MS + 200);
  };

  const names = vsComputer ? ['You', 'The computer'] : CLASH_PLAYERS.map((p) => p.name);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <LevelPicker level={level} onChange={setLevel} />
        <button type="button" onClick={() => (sfx.click(), setSeed(Math.floor(Math.random() * 1e9)))} className="btn-paper rounded-md px-4 py-2 font-display text-sm font-bold">
          New field
        </button>
      </div>
      <p className="font-display text-lg font-bold" style={{ color: winner === null || winner === 'draw' ? CLASH_PLAYERS[turn].color : CLASH_PLAYERS[winner].color }}>
        {winner === 'draw' ? 'A draw!' : winner !== null ? `🏆 ${names[winner]} ${vsComputer && winner === 0 ? 'win' : 'wins'}!` : busy && vsComputer ? 'The computer is aiming…' : vsComputer ? 'Your turn' : `${names[turn]}'s turn`}
      </p>
      <div ref={board} className="page overflow-hidden rounded-md">
        <ClashField world={world} shots={shots} shotsKey={shotsKey} mine={busy || winner !== null ? null : turn} picked={from?.id} onPick={setPicked} />
      </div>
      {winner === null ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            fire();
          }}
          className="space-y-1"
        >
          <div className="flex gap-2">
            <span className="self-center font-display font-bold" style={{ color: CLASH_PLAYERS[turn].color }}>
              y =
            </span>
            <input
              ref={field}
              value={src}
              onChange={(e) => setSrc(e.target.value)}
              disabled={busy}
              placeholder="e.g. 0.3x, sin(x)*4, x^2/20, -abs(x-10)+5…"
              autoComplete="off"
              spellCheck={false}
              className="min-w-0 flex-1 rounded-md border-2 border-rule-strong bg-card px-4 py-3 font-mono text-lg outline-none focus:border-ink"
            />
            <button type="submit" disabled={busy || !src.trim()} className="btn-ink rounded-md px-5 font-display font-bold tracking-wider disabled:opacity-50">
              Fire ↵
            </button>
          </div>
          {error && <p className="text-sm font-semibold text-coral">{error}</p>}
          <p className="text-xs text-ink-faint">
            Tap one of your gunners to fire from it. x counts forward from your gunner (the curve is moved to start on it). A shot into an island blows a hole in it. Allowed: + − × /
            ^, brackets, pi, e, sin, cos, tan, abs, sqrt, ln, log, exp.
            {vsComputer && ' The computer writes its own curves to hit you — read them in the history to see how it aimed.'}
          </p>
        </form>
      ) : (
        <div className="text-center">
          <button type="button" onClick={() => (sfx.click(), setSeed(Math.floor(Math.random() * 1e9)))} className="btn-ink rounded-md px-6 py-3 font-display font-bold tracking-wider">
            Play again
          </button>
        </div>
      )}
      <ClashLog lines={log} />
    </div>
  );
}

type Mode = 'online' | 'computer' | 'local';
const MODES: { id: Mode; label: string }[] = [
  { id: 'online', label: '🌐 Online, at the same time' },
  { id: 'computer', label: '🤖 Against the computer' },
  { id: 'local', label: '🖥 One screen, turn by turn' },
];

/** /curve-clash: online (both at once, each on their own device), against the computer, or on one screen. */
export default function CurveClash() {
  const [mode, setMode] = useState<Mode>('online');
  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div>
        <Link to="/games" className="font-display text-sm font-semibold tracking-wider text-ink-soft hover:text-ink">
          ← Games
        </Link>
        <h1 className="text-5xl font-bold">Curve Clash</h1>
        <p className="max-w-2xl text-sm text-ink-soft">
          Pick one of your gunners and write a function of x: the shot follows its curve from your gunner towards the other side. Islands stand in the way — a shot that hits one
          blows a hole in it. Knock out both enemy gunners to win, and mind your own.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {MODES.map((m) => (
          <button key={m.id} type="button" aria-pressed={mode === m.id} onClick={() => (sfx.click(), setMode(m.id))} className={`rounded-full border-2 px-4 py-1.5 text-sm font-semibold ${mode === m.id ? 'border-ink bg-ink text-paper' : 'border-rule-strong bg-card text-ink-soft hover:border-ink'}`}>
            {m.label}
          </button>
        ))}
      </div>
      {mode === 'online' ? <CurveClashOnline /> : <Duel key={mode} vsComputer={mode === 'computer'} />}
    </div>
  );
}
