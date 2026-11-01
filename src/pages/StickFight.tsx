import { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { BOSSES } from '../data/bosses';
import { todayKey } from '../lib/date';
import { shownName } from '../lib/french';
import { hashString } from '../lib/rng';
import { sfx } from '../lib/sfx';
import { Duel, H, MAX_TURNS, W, type Action, type FightEvent } from '../stickfight/engine';
import { FIGHTERS, HERO_NAMES, cluesOf, type Fighter } from '../stickfight/fighters';
import { rankBySearch } from '../utils/textMatcher';

const MAX_GUESSES = 6;
const ACTIONS: { id: Action; label: string; blurb: string }[] = [
  { id: 'strike', label: 'Strike', blurb: 'Close only. A clue, but you stay open' },
  { id: 'rush', label: 'Rush', blurb: 'Far only. Get close, but stay open' },
  { id: 'guard', label: 'Guard', blurb: 'Grabs and charges break it' },
  { id: 'dodge', label: 'Dodge', blurb: 'Avoids it all. Not twice running' },
];

const overwatch = BOSSES.find((b) => b.id === 'overwatch');
const HEROES = HERO_NAMES.map((name) => {
  const known = overwatch && [...overwatch.finale, ...overwatch.radar.members].find((c) => c.label === name);
  return { name, aliases: known?.aliases ?? [], image: known?.image ?? (overwatch?.boss.name === name ? overwatch.boss.image : undefined) };
});

/** The name box: suggestions from the whole roster. */
function GuessBox({ exclude, ready, onGuess, boxRef }: { exclude: string[]; ready: boolean; onGuess: (name: string) => void; boxRef: React.RefObject<HTMLInputElement> }) {
  const [query, setQuery] = useState('');
  const results = useMemo(() => (query.trim() ? rankBySearch(query, HEROES.filter((h) => !exclude.includes(h.name)), (h) => [h.name, ...h.aliases], 5) : []), [query, exclude]);
  const send = (name: string) => {
    if (!ready) return;
    setQuery('');
    onGuess(name);
    boxRef.current?.blur();
  };
  return (
    <div className="relative">
      <input
        ref={boxRef}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === 'Enter' && results[0]) send(results[0].name);
          if (e.key === 'Escape') boxRef.current?.blur();
        }}
        placeholder="Who is it? A wrong name costs the turn"
        className="w-full rounded-md border-2 border-ink-faint/40 bg-card px-4 py-3 text-ink outline-none focus:border-accent"
      />
      {results.length > 0 && (
        <ul className="absolute bottom-full z-20 mb-1 w-full overflow-hidden rounded-md border border-ink-faint/40 bg-card shadow-lg">
          {results.map((h) => (
            <li key={h.name}>
              {/* Pressed, not clicked: a click would blur the box first and close this list. */}
              <button type="button" onPointerDown={(e) => (e.preventDefault(), send(h.name))} className="w-full px-4 py-2 text-left hover:bg-accent/20">
                {shownName(h.name, 'overwatch')}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** /stick-fight (a test): everyone fights the same mystery stickman each day, a turn at a time. Its moves are the clue. */
export default function StickFight() {
  const date = todayKey();
  const daily = useMemo(() => FIGHTERS[hashString(`stick:${date}`) % FIGHTERS.length], [date]);
  const [fighter, setFighter] = useState<Fighter>(daily);
  const [run, setRun] = useState(0);
  const [started, setStarted] = useState(false);
  const [wrong, setWrong] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);
  const [, refresh] = useReducer((n: number) => n + 1, 0);
  const canvas = useRef<HTMLCanvasElement>(null);
  const box = useRef<HTMLInputElement>(null);
  const game = useRef<Duel | null>(null);
  const clues = useMemo(() => cluesOf(fighter), [fighter]);
  const practice = fighter !== daily || run > 0;

  const act = (a: Action) => {
    const g = game.current;
    if (g?.can(a)) {
      sfx.click();
      g.choose(a);
    }
  };

  // The duel, for as long as it's on.
  useEffect(() => {
    if (!started) return;
    const onEvent = (e: FightEvent) => {
      if (e === 'hit') sfx.hit();
      else if (e === 'hurt') sfx.hurt();
      else if (e === 'block') sfx.tick();
      else if (e === 'whoosh') sfx.whoosh();
      else if (e === 'blast') sfx.tear();
      else if (e === 'ko') sfx.lose();
      else if (e === 'finish') sfx.clash();
      else if (e === 'done') (g.won ? sfx.victory : sfx.lose)();
      if (e === 'turn' || e === 'done') refresh();
    };
    const g = new Duel(fighter, `stick:${date}:${fighter.name}:${run}`, onEvent);
    game.current = g;
    refresh();
    const c = canvas.current?.getContext('2d');
    let raf = 0;
    let last = performance.now();
    const frame = (now: number) => {
      g.update((now - last) / 1000);
      last = now;
      if (c) g.draw(c);
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    const down = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      if (e.code === 'Enter') {
        e.preventDefault();
        box.current?.focus({ preventScroll: true });
        return;
      }
      const digit = /^(?:Digit|Numpad)([1-4])$/.exec(e.code);
      if (digit) act(ACTIONS[Number(digit[1]) - 1].id);
    };
    window.addEventListener('keydown', down);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('keydown', down);
      game.current = null;
    };
  }, [started, fighter, run, date]);

  const g = game.current;
  const over = g?.state === 'done';
  const ready = g?.state === 'choosing';

  const guess = (name: string) => {
    if (!g || g.state !== 'choosing') return;
    if (name === fighter.name) {
      g.finish(true);
      return;
    }
    sfx.wrong();
    const next = [...wrong, name];
    setWrong(next);
    g.wrongGuess();
    if (next.length >= MAX_GUESSES) g.finish(false);
  };

  const fightAgain = (next: Fighter) => {
    sfx.click();
    setFighter(next);
    setRun((r) => r + 1);
    setWrong([]);
    setCopied(false);
    setStarted(true);
  };

  const randomFighter = () => {
    const others = FIGHTERS.filter((f) => f !== fighter);
    fightAgain(others[Math.floor(Math.random() * others.length)]);
  };

  const shareText =
    g &&
    over &&
    [
      `Omnidle Stick Fight${practice ? ' (practice)' : ` ${date}`}`,
      `${g.squares.join('')}${g.won ? '🥊' : '💀'} ${g.won ? `KO on turn ${g.turn}` : 'It got away'}`,
      `${g.hitsTaken} hit${g.hitsTaken === 1 ? '' : 's'} taken · ${g.knockouts} knockdown${g.knockouts === 1 ? '' : 's'} · ${Math.min(g.landed, clues.length)} clue${g.landed === 1 ? '' : 's'} earned`,
    ].join('\n');

  const portrait = HEROES.find((h) => h.name === fighter.name)?.image;
  const clueCount = g?.landed ?? 0;

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div>
        <Link to="/games" className="font-display text-sm font-semibold tracking-wider text-ink-soft hover:text-ink">
          ← Games
        </Link>
        <h1 className="text-5xl font-bold">
          Stick Fight <span className="align-middle text-sm font-semibold text-coral">test</span>
        </h1>
        <p className="max-w-2xl text-ink-soft">
          A mystery Overwatch hero, as a stickman, one turn at a time. Watch what it's about to do and choose your answer. The way it fights is your first clue, every strike you land earns another, and only its name can finish the fight.
        </p>
      </div>

      {!started ? (
        <div className="page space-y-4 rounded-md p-6">
          <ul className="space-y-1 text-sm text-ink-soft">
            {ACTIONS.map((a, i) => (
              <li key={a.id}>
                <b className="text-ink">{i + 1} · {a.label}</b>: {a.blurb}.
              </li>
            ))}
            <li><b className="text-ink">Enter · Guess</b> whenever you like. The right name wins at once. A wrong one costs the turn and heals it, and you have {MAX_GUESSES} tries.</li>
            <li>You have {MAX_TURNS} turns before it gets away. Knocked down? You lose a turn getting up, with less health.</li>
          </ul>
          <button type="button" onClick={() => (sfx.click(), setStarted(true))} className="btn-accent rounded-md px-6 py-3 font-display font-bold">
            Fight today&apos;s stickman
          </button>
        </div>
      ) : (
        <>
          <canvas ref={canvas} width={W} height={H} className="w-full rounded-md border border-ink-faint/30" />

          {g && !over && (
            <>
              <div className="page rounded-md px-4 py-3" aria-live="polite">
                <p className="text-sm text-ink-soft">{g.lines.join(' ')}</p>
                {ready && <p className="mt-1 font-display text-lg font-bold">{g.tell}</p>}
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {ACTIONS.map((a, i) => (
                  <button
                    key={a.id}
                    type="button"
                    disabled={!g.can(a.id)}
                    onClick={() => act(a.id)}
                    className="btn-paper flex flex-col items-center rounded-md px-2 py-3 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <span className="font-display font-bold">{i + 1} · {a.label}</span>
                    <span className="text-center text-xs font-normal normal-case tracking-normal">{a.blurb}</span>
                  </button>
                ))}
              </div>
              <GuessBox exclude={wrong} ready={!!ready} onGuess={guess} boxRef={box} />
              <div className="flex flex-wrap items-center gap-1.5 text-xs">
                <span className="text-ink-faint">Clues:</span>
                {clues.map((c, i) =>
                  i < clueCount ? (
                    <span key={c.label} className="rounded-md bg-accent/20 px-2 py-1 font-semibold">
                      {c.label}: {c.value}
                    </span>
                  ) : (
                    <span key={c.label} className="rounded-md border border-dashed border-ink-faint/40 px-2 py-1 text-ink-faint">
                      {c.label}
                    </span>
                  ),
                )}
              </div>
              {wrong.length > 0 && (
                <ul className="flex flex-wrap items-center gap-1.5 text-xs">
                  {wrong.map((n) => (
                    <li key={n} className="rounded-md border border-miss/50 bg-miss/10 px-2 py-1 font-semibold line-through">
                      {shownName(n, 'overwatch')}
                    </li>
                  ))}
                  <li className="px-1 text-ink-faint">{MAX_GUESSES - wrong.length} left</li>
                </ul>
              )}
            </>
          )}

          {g && over && (
            <div className="page flex flex-col gap-5 rounded-md p-6 sm:flex-row">
              {portrait && <img src={portrait} alt="" className="mx-auto h-48 w-40 object-contain" />}
              <div className="min-w-0 flex-1 space-y-3">
                <h2 className="text-3xl font-bold">
                  {g.won ? 'Knocked out!' : 'It got away.'} It was {shownName(fighter.name, 'overwatch')}.
                </h2>
                <div>
                  <p className="text-xs uppercase tracking-widest text-ink-faint">Its moves</p>
                  <p className="text-sm">{[...(fighter.passive ?? []), ...fighter.moves.map((m) => m.name)].join(' · ')}</p>
                </div>
                <pre className="whitespace-pre-wrap font-sans text-sm text-ink-soft">{shareText}</pre>
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={randomFighter} className="btn-accent rounded-md px-4 py-2 font-display font-bold">
                    Fight someone else
                  </button>
                  <button type="button" onClick={() => void navigator.clipboard?.writeText(shareText || '').then(() => setCopied(true))} className="btn-paper rounded-md px-4 py-2 font-display font-bold">
                    {copied ? 'Copied!' : 'Copy result'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
