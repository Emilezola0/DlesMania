import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { BOSSES } from '../data/bosses';
import { todayKey } from '../lib/date';
import { shownName } from '../lib/french';
import { hashString } from '../lib/rng';
import { sfx } from '../lib/sfx';
import { CLUE_EVERY, Fight, H, W, type FightEvent, type Input } from '../stickfight/engine';
import { FIGHTERS, HERO_NAMES, cluesOf, type Fighter } from '../stickfight/fighters';
import { rankBySearch } from '../utils/textMatcher';

const MAX_GUESSES = 6;
const KEYS: Record<string, keyof Input> = {
  ArrowLeft: 'left',
  KeyA: 'left',
  ArrowRight: 'right',
  KeyD: 'right',
  ArrowUp: 'jump',
  KeyW: 'jump',
  Space: 'jump',
  KeyJ: 'attack',
  KeyK: 'block',
  KeyL: 'dodge',
};
const TOUCH: { key: keyof Input; label: string }[] = [
  { key: 'left', label: '◀' },
  { key: 'right', label: '▶' },
  { key: 'jump', label: 'Jump' },
  { key: 'attack', label: 'Hit' },
  { key: 'block', label: 'Block' },
  { key: 'dodge', label: 'Dodge' },
];

const overwatch = BOSSES.find((b) => b.id === 'overwatch');
const HEROES = HERO_NAMES.map((name) => {
  const known = overwatch && [...overwatch.finale, ...overwatch.radar.members].find((c) => c.label === name);
  return { name, aliases: known?.aliases ?? [], image: known?.image ?? (overwatch?.boss.name === name ? overwatch.boss.image : undefined) };
});

const clock = (seconds: number) => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;

interface Result {
  won: boolean;
  time: number;
  hitsTaken: number;
  knockouts: number;
  clues: number;
}

/** The name box: suggestions from the whole roster. Typing slows the fight down. */
function GuessBox({ exclude, onGuess, onFocus, onBlur, boxRef }: { exclude: string[]; onGuess: (name: string) => void; onFocus: () => void; onBlur: () => void; boxRef: React.RefObject<HTMLInputElement> }) {
  const [query, setQuery] = useState('');
  const results = useMemo(() => (query.trim() ? rankBySearch(query, HEROES.filter((h) => !exclude.includes(h.name)), (h) => [h.name, ...h.aliases], 5) : []), [query, exclude]);
  const send = (name: string) => {
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
        onFocus={onFocus}
        onBlur={onBlur}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === 'Enter' && results[0]) send(results[0].name);
          if (e.key === 'Escape') boxRef.current?.blur();
        }}
        placeholder="Who is it? The fight slows while you type"
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

/** /stick-fight (a test): everyone fights the same mystery stickman each day. Its moves are the clue. */
export default function StickFight() {
  const date = todayKey();
  const daily = useMemo(() => FIGHTERS[hashString(`stick:${date}`) % FIGHTERS.length], [date]);
  const [fighter, setFighter] = useState<Fighter>(daily);
  const [run, setRun] = useState(0);
  const [started, setStarted] = useState(false);
  const [wrong, setWrong] = useState<string[]>([]);
  const [clueCount, setClueCount] = useState(0);
  const [result, setResult] = useState<Result | null>(null);
  const [copied, setCopied] = useState(false);
  const canvas = useRef<HTMLCanvasElement>(null);
  const box = useRef<HTMLInputElement>(null);
  const game = useRef<Fight | null>(null);
  const clues = useMemo(() => cluesOf(fighter), [fighter]);
  const practice = fighter !== daily || run > 0;

  // The fight, for as long as it's on.
  useEffect(() => {
    if (!started) return;
    const onEvent = (e: FightEvent) => {
      const g = game.current;
      if (!g) return;
      if (e === 'hit') sfx.hit();
      else if (e === 'hurt') sfx.hurt();
      else if (e === 'block') sfx.tick();
      else if (e === 'dodge') sfx.whoosh();
      else if (e === 'blast') sfx.tear();
      else if (e === 'ko') sfx.lose();
      else if (e === 'stagger') sfx.near();
      else if (e === 'finish') sfx.clash();
      else if (e === 'clue') {
        sfx.pop();
        setClueCount(Math.min(cluesOf(fighter).length, Math.floor(g.dealt / CLUE_EVERY)));
      } else if (e === 'done') {
        setResult({ won: g.won, time: g.time, hitsTaken: g.hitsTaken, knockouts: g.knockouts, clues: Math.min(cluesOf(fighter).length, Math.floor(g.dealt / CLUE_EVERY)) });
        (g.won ? sfx.victory : sfx.lose)();
      }
    };
    const g = new Fight(fighter, `stick:${date}:${fighter.name}:${run}`, onEvent);
    game.current = g;
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

    const typing = (e: KeyboardEvent) => e.target instanceof HTMLInputElement;
    const down = (e: KeyboardEvent) => {
      if (typing(e)) return;
      if (e.code === 'Enter') {
        e.preventDefault();
        box.current?.focus({ preventScroll: true });
        return;
      }
      const key = KEYS[e.code];
      if (key) {
        e.preventDefault();
        g.input[key] = true;
      }
    };
    const up = (e: KeyboardEvent) => {
      const key = KEYS[e.code];
      if (key) g.input[key] = false;
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      game.current = null;
    };
  }, [started, fighter, run, date]);

  const guess = useCallback(
    (name: string) => {
      const g = game.current;
      if (!g || g.state !== 'playing') return;
      if (name === fighter.name) {
        g.finish(true);
        return;
      }
      sfx.wrong();
      const next = [...wrong, name];
      setWrong(next);
      g.wrongGuess();
      if (next.length >= MAX_GUESSES) g.finish(false);
    },
    [fighter, wrong],
  );

  const slow = (on: boolean) => {
    const g = game.current;
    if (!g) return;
    g.timeScale = on ? 0.15 : 1;
    // Keys held when the box took over never get their release.
    if (on) g.input = { left: false, right: false, jump: false, attack: false, block: false, dodge: false };
  };

  const fightAgain = (next: Fighter) => {
    sfx.click();
    setFighter(next);
    setRun((r) => r + 1);
    setWrong([]);
    setClueCount(0);
    setResult(null);
    setCopied(false);
    setStarted(true);
  };

  const randomFighter = () => {
    const others = FIGHTERS.filter((f) => f !== fighter);
    fightAgain(others[Math.floor(Math.random() * others.length)]);
  };

  const shareText = result && [
    `Omnidle Stick Fight${practice ? ' (practice)' : ` ${date}`}`,
    `${'❌'.repeat(wrong.length)}${result.won ? '🥊' : '💀'} ${result.won ? `KO in ${clock(result.time)}` : `Lost after ${clock(result.time)}`}`,
    `${result.hitsTaken} hit${result.hitsTaken === 1 ? '' : 's'} taken · ${result.knockouts} knockdown${result.knockouts === 1 ? '' : 's'} · ${result.clues} clue${result.clues === 1 ? '' : 's'} earned`,
  ].join('\n');

  const portrait = HEROES.find((h) => h.name === fighter.name)?.image;

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
          A mystery Overwatch hero, as a stickman. The way it fights is your first clue, every few hits earn another, and only its name can finish the fight.
        </p>
      </div>

      {!started ? (
        <div className="page space-y-4 rounded-md p-6">
          <ul className="space-y-1 text-sm text-ink-soft">
            <li><b className="text-ink">Move</b> A D or ← → · <b className="text-ink">Jump</b> W, ↑ or Space</li>
            <li><b className="text-ink">Hit</b> J · <b className="text-ink">Block</b> K · <b className="text-ink">Dodge</b> L (you pass through attacks)</li>
            <li><b className="text-ink">Guess</b> Enter: the fight goes into slow motion while you type. A wrong name heals it and makes it faster, and you have {MAX_GUESSES} tries.</li>
            <li>Knocked down? You get back up with less health, so anyone can still finish.</li>
          </ul>
          <button type="button" onClick={() => (sfx.click(), setStarted(true))} className="btn-accent rounded-md px-6 py-3 font-display font-bold">
            Fight today&apos;s stickman
          </button>
        </div>
      ) : (
        <>
          <canvas ref={canvas} width={W} height={H} className="w-full rounded-md border border-ink-faint/30 touch-none" />

          {!result && (
            <>
              <div className="hidden grid-cols-6 gap-2 select-none [@media(pointer:coarse)]:grid">
                {TOUCH.map((t) => (
                  <button
                    key={t.key}
                    type="button"
                    onPointerDown={() => game.current && (game.current.input[t.key] = true)}
                    onPointerUp={() => game.current && (game.current.input[t.key] = false)}
                    onPointerLeave={() => game.current && (game.current.input[t.key] = false)}
                    className="btn-paper touch-none rounded-md py-4 text-sm font-bold"
                  >
                    {t.label}
                  </button>
                ))}
              </div>
              <GuessBox exclude={wrong} onGuess={guess} onFocus={() => slow(true)} onBlur={() => slow(false)} boxRef={box} />
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

          {result && (
            <div className="page flex flex-col gap-5 rounded-md p-6 sm:flex-row">
              {portrait && <img src={portrait} alt="" className="mx-auto h-48 w-40 object-contain" />}
              <div className="min-w-0 flex-1 space-y-3">
                <h2 className="text-3xl font-bold">
                  {result.won ? 'Knocked out!' : 'It got away.'} It was {shownName(fighter.name, 'overwatch')}.
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
                  <button type="button" onClick={() => void navigator.clipboard?.writeText(shareText ?? '').then(() => setCopied(true))} className="btn-paper rounded-md px-4 py-2 font-display font-bold">
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
