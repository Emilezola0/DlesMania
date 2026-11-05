import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { TimerBar } from '../boss/TimerBar';
import { LEVELS, compile, replay, type Level } from '../arcade/curveClash';
import { CLASH_PLAYERS as PLAYER, ClashField, ClashLog, LevelPicker } from '../components/ClashField';
import type { ClashGame } from '../cloud/clash';
import { startCloud, useCloud } from '../cloud/state';
import { shake } from '../lib/fx';
import { sfx } from '../lib/sfx';

/** The Firestore side, loaded only when it's needed. */
const clash = () => import('../cloud/clash');

/** Seconds to write a function each round (CLASH_SECONDS in src/cloud/clash.ts). */
const ROUND_SECONDS = 45;
/** One online game, followed live: both players write a function at once, both shots fly together. */
function Game({ code, onLeave }: { code: string; onLeave: () => void }) {
  const [g, setG] = useState<ClashGame | null>(null);
  const [uid, setUid] = useState<string | null>(null);
  const [src, setSrc] = useState('');
  const [picked, setPicked] = useState<string | undefined>();
  const [error, setError] = useState<string | null>(null);
  const [errorLine, setErrorLine] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const board = useRef<HTMLDivElement>(null);
  const seenRounds = useRef(-1);

  useEffect(() => {
    let stop = () => {};
    void clash().then((c) => {
      setUid(c.clashUid());
      stop = c.watchClash(code, setG, (e) => setError(e.message));
    });
    return () => stop();
  }, [code]);

  const game = useMemo(() => (g ? replay(g.seed, g.rounds, g.level ?? 'medium') : null), [g]);
  const me: 0 | 1 | null = g && uid ? (g.host === uid ? 0 : g.guest === uid ? 1 : null) : null;
  const round = g ? g.rounds.length - 1 : 0;
  const current = g?.rounds[round] ?? {};
  const sent = me !== null && !!(me === 0 ? current.a : current.b);
  const ready = !!g?.guest && game?.winner === null;

  // A round just resolved: its shots land.
  useEffect(() => {
    if (!game) return;
    if (seenRounds.current >= 0 && game.played > seenRounds.current) {
      sfx.whoosh();
      if (game.last.length) window.setTimeout(() => shake(board.current, 8, 350), 600);
      setSrc('');
    }
    seenRounds.current = game.played;
  }, [game]);
  useEffect(() => {
    if (game?.winner !== null && game?.winner !== undefined) (game.winner === me ? sfx.streak : sfx.wrong)();
  }, [game?.winner, me]);

  // The other player too slow: their move is skipped, so the game goes on.
  useEffect(() => {
    if (!g || !ready || me === null) return;
    const t = window.setInterval(() => {
      void clash().then((c) => {
        const other = me === 0 ? 1 : 0;
        const r = g.rounds[g.rounds.length - 1];
        if (c.isLate(g) && !(other === 0 ? r.a : r.b)) void c.sendMove(code, g.rounds.length - 1, other, { pass: true });
      });
    }, 2000);
    return () => window.clearInterval(t);
  }, [g, ready, me, code]);

  if (error) return <p className="page rounded-md p-4 text-coral">{error}</p>;
  if (!g || !game) return <p className="page rounded-md p-4 text-ink-soft">Loading the game…</p>;

  const mine = game.world.gunners.filter((x) => x.player === me && x.alive);
  const from = mine.find((x) => x.id === picked) ?? mine[0];
  const fire = async () => {
    if (me === null || sent || !from) return;
    try {
      compile(src);
    } catch (e) {
      sfx.wrong();
      return setErrorLine((e as Error).message);
    }
    setErrorLine(null);
    sfx.click();
    await (await clash()).sendMove(code, round, me, { f: src.trim(), g: from.id });
  };
  const timeUp = () => me !== null && !sent && void clash().then((c) => c.sendMove(code, round, me, { pass: true }));

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-display text-sm text-ink-soft">
          Game <span className="font-mono text-lg font-bold text-ink">{code}</span> · {LEVELS[g.level ?? 'medium'].label} ·{' '}
          <span style={{ color: PLAYER[0].color }}>{g.hostName}</span> vs <span style={{ color: PLAYER[1].color }}>{g.guestName ?? '…'}</span>
          {me !== null && <span> · you are {PLAYER[me].name}</span>}
        </p>
        <button type="button" onClick={onLeave} className="btn-paper rounded-md px-3 py-1.5 text-sm font-bold">
          Leave
        </button>
      </div>
      {!g.guest && (
        <div className="page space-y-2 rounded-md p-4 text-center">
          <p>Waiting for someone to join. Give them this code:</p>
          <button
            type="button"
            onClick={() => void navigator.clipboard?.writeText(code).then(() => setCopied(true))}
            className="font-mono text-4xl font-bold tracking-[0.3em]"
            title="Copy"
          >
            {code}
          </button>
          {copied && <p className="text-xs text-hit">Copied</p>}
        </div>
      )}
      {game.winner !== null && (
        <p className="animate-pop text-center font-display text-2xl font-bold" style={{ color: game.winner === 'draw' ? undefined : PLAYER[game.winner].color }}>
          {game.winner === 'draw' ? 'A draw: both sides fell together!' : game.winner === me ? '🏆 You win!' : `${PLAYER[game.winner].name} wins`}
        </p>
      )}
      <div ref={board} className="page overflow-hidden rounded-md">
        <ClashField shotsKey={game.played} world={game.world} shots={game.last} mine={ready ? me : null} picked={from?.id} onPick={setPicked} />
      </div>
      {ready && me !== null && (
        <>
          <TimerBar key={g.roundAt} total={Math.max(1000, g.roundAt + ROUND_SECONDS * 1000 - Date.now())} running={!sent} resetKey={`${round}`} onExpire={timeUp} noWait />
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void fire();
            }}
            className="space-y-1"
          >
            <div className="flex gap-2">
              <span className="self-center font-display font-bold" style={{ color: PLAYER[me].color }}>
                y =
              </span>
              <input
                value={src}
                onChange={(e) => setSrc(e.target.value)}
                disabled={sent}
                placeholder={sent ? 'Sent — waiting for the other player…' : 'e.g. 0.3x, sin(x)*4, x^2/20…'}
                autoComplete="off"
                spellCheck={false}
                className="min-w-0 flex-1 rounded-md border-2 border-rule-strong bg-card px-4 py-3 font-mono text-lg outline-none focus:border-ink"
              />
              <button type="submit" disabled={sent || !src.trim()} className="btn-ink rounded-md px-5 font-display font-bold tracking-wider disabled:opacity-50">
                {sent ? '✓ Sent' : 'Fire ↵'}
              </button>
            </div>
            {errorLine && <p className="text-sm font-semibold text-coral">{errorLine}</p>}
            <p className="text-xs text-ink-faint">Round {round + 1}: both players write at once, both shots fly when both are in. Tap one of your gunners to fire from it.</p>
          </form>
        </>
      )}
      <ClashLog lines={game.log} />
    </div>
  );
}

/** Online, both at the same time: make a game and share its code, or join one. */
export function CurveClashOnline() {
  const { status, email, actions } = useCloud();
  const signedIn = !!email && status !== 'signedOut' && !!actions;
  const [code, setCode] = useState<string | null>(null);
  const [typed, setTyped] = useState('');
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [level, setLevel] = useState<Level>('medium');
  useEffect(() => void startCloud(), []);

  if (!signedIn)
    return (
      <p className="page rounded-md p-4 text-ink-soft">
        <Link to="/account" className="font-semibold text-accent">
          Sign in
        </Link>{' '}
        to play online against someone else.
      </p>
    );
  if (code) return <Game key={code} code={code} onLeave={() => setCode(null)} />;
  const run = async (f: () => Promise<string>) => {
    setBusy(true);
    setNote(null);
    try {
      setCode(await f());
    } catch (e) {
      setNote((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="page space-y-3 rounded-md p-4">
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" disabled={busy} onClick={() => run(async () => (await clash()).createClash(level))} className="btn-ink rounded-md px-5 py-2.5 font-display font-bold tracking-wider">
          New online game
        </button>
        <LevelPicker level={level} onChange={setLevel} />
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void run(async () => {
            const c = await clash();
            const k = c.cleanClashCode(typed);
            await c.joinClash(k);
            return k;
          });
        }}
        className="flex gap-2"
      >
        <input value={typed} onChange={(e) => setTyped(e.target.value)} placeholder="A game's code" className="w-40 rounded-md border-2 border-rule-strong bg-card px-3 py-2 font-mono uppercase outline-none focus:border-ink" />
        <button type="submit" disabled={busy || !typed.trim()} className="btn-paper rounded-md px-4 font-display font-bold disabled:opacity-50">
          Join
        </button>
      </form>
      {note && <p className="text-sm font-semibold text-coral">{note}</p>}
    </div>
  );
}
