import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { TimerBar } from '../boss/TimerBar';
import { Glyph } from '../components/Glyph';
import { domainInfo } from '../data';
import { ALL_PREFIX, SILHOUETTES, deckFor, silhouetteDomains, type SilhouetteEntry, type SilhouetteSeries } from '../data/silhouettes';
import { celebrateBig, shake } from '../lib/fx';
import { shuffle } from '../lib/rng';
import { sfx } from '../lib/sfx';
import { useProgress } from '../store/progress';
import { compactText, isFuzzyMatch } from '../utils/textMatcher';

/** Round length, points for a right answer, and the cost of a wrong one. */
const ROUND_MS = 60_000;
const POINTS = 10;
const PENALTY = 5;
/** Extra points per correct answer in a row (capped), so streaks pay off. */
const STREAK_BONUS = 2;
const STREAK_CAP = 5;
/** How long a named or skipped silhouette stays revealed. */
const REVEAL_MS = 650;

type Card = SilhouetteEntry & { series: SilhouetteSeries };

const spellings = (c: Card) => [c.name, ...c.aliases];

/** "champions", "mobs" — but "Pokémon" stays the same in the plural. */
const plural = (noun: string, n: number) => (n === 1 || /mon$|s$/.test(noun) ? noun : `${noun}s`);

/** Picker: one card per series, plus "All" for each domain. */
export function WhosThatHub() {
  const best = useProgress((s) => s.whosThat);
  return (
    <div className="space-y-8">
      <div>
        <p className="font-display text-xs uppercase tracking-[0.3em] text-ink-faint">One minute on the clock</p>
        <h1 className="text-5xl font-bold">Who&apos;s That?</h1>
        <p className="max-w-xl text-ink-soft">
          Silhouettes appear one after another — name as many as you can in 60 seconds. Each right answer scores {POINTS} points (more on a streak),
          each wrong one costs {PENALTY}. Skipping is free but loses your streak.
        </p>
      </div>
      {silhouetteDomains().map((domain) => {
        const d = domainInfo(domain);
        const series = SILHOUETTES.filter((s) => s.domain === domain);
        const total = series.reduce((n, s) => n + s.entries.length, 0);
        const options = [
          { key: `${ALL_PREFIX}${domain}`, title: `All ${d.label}`, sub: series.map((s) => s.label).join(' · '), count: total },
          ...series.map((s) => ({ key: s.id, title: s.label, sub: `${s.entries.length} ${plural(s.noun, s.entries.length)}`, count: s.entries.length })),
        ];
        return (
          <section key={domain} className="space-y-3">
            <h2 className="flex items-center gap-2 font-display text-sm uppercase tracking-widest text-ink-faint">
              <Glyph seed={domain} size={16} className={d.tone} /> {d.label}
            </h2>
            <ul className="grid gap-3 sm:grid-cols-3">
              {options.map((o, i) => (
                <li key={o.key}>
                  <Link to={`/whos-that/${o.key}`} className={`page flex h-full flex-col rounded-md p-4 transition hover:-translate-y-0.5 ${i === 0 ? 'ring-2 ring-accent/40' : ''}`}>
                    <span className="font-display text-lg font-bold">{o.title}</span>
                    <span className="text-sm text-ink-soft">{o.sub}</span>
                    <span className="mt-auto pt-2 text-xs text-ink-faint">{best[o.key] ? `Best: ${best[o.key]} pts` : 'Not played yet'}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

export default function WhosThatPage() {
  const { key = '' } = useParams();
  const deck = useMemo(() => deckFor(key), [key]);
  if (!deck?.length) return <Navigate to="/whos-that" replace />;
  return <WhosThatGame key={key} playKey={key} deck={deck} />;
}

type Stage = 'ready' | 'playing' | 'done';
interface Result {
  card: Card;
  outcome: 'right' | 'skipped';
}

function WhosThatGame({ playKey, deck }: { playKey: string; deck: Card[] }) {
  const recordBest = useProgress((s) => s.recordWhosThat);
  const best = useProgress((s) => s.whosThat[playKey] ?? 0);
  const [run, setRun] = useState(0);
  const order = useMemo(() => shuffle(deck, Math.random), [deck, run]);
  const [stage, setStage] = useState<Stage>('ready');
  const [index, setIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [wrong, setWrong] = useState(0);
  const [results, setResults] = useState<Result[]>([]);
  const [reveal, setReveal] = useState<'right' | 'skipped' | null>(null);
  const [text, setText] = useState('');
  const [flashKey, setFlashKey] = useState(0);
  const [newBest, setNewBest] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const frame = useRef<HTMLDivElement>(null);
  const card = order[index % order.length];
  const isAll = playKey.startsWith(ALL_PREFIX);

  // Keep the next few pictures loading ahead.
  useEffect(() => {
    for (let k = 1; k <= 3; k++) {
      const next = order[(index + k) % order.length];
      if (next) new Image().src = next.image;
    }
  }, [index, order]);

  useEffect(() => {
    if (stage === 'playing') input.current?.focus({ preventScroll: true });
  }, [stage, index]);

  const next = (outcome: 'right' | 'skipped') => {
    setReveal(outcome);
    setResults((r) => [...r, { card, outcome }]);
    window.setTimeout(() => {
      setReveal(null);
      setText('');
      setIndex((i) => i + 1);
    }, REVEAL_MS);
  };

  const right = () => {
    const bonus = Math.min(streak, STREAK_CAP) * STREAK_BONUS;
    setScore((s) => s + POINTS + bonus);
    setStreak((s) => s + 1);
    sfx.correct();
    next('right');
  };

  const submit = (value: string) => {
    if (stage !== 'playing' || reveal || !value.trim()) return;
    if (isFuzzyMatch(value, spellings(card))) return right();
    setScore((s) => s - PENALTY);
    setStreak(0);
    setWrong((w) => w + 1);
    setFlashKey((k) => k + 1);
    sfx.wrong();
    shake(frame.current, 6, 300);
    setText('');
  };

  const skip = () => {
    if (stage !== 'playing' || reveal) return;
    setStreak(0);
    sfx.whoosh();
    next('skipped');
  };

  const finish = () => {
    setStage('done');
    setReveal(null);
    const isBest = score > best;
    setNewBest(isBest && score > 0);
    recordBest(playKey, score);
    if (isBest && score > 0) {
      sfx.victory();
      celebrateBig();
    } else sfx.lose();
  };

  const start = () => {
    setRun((r) => r + 1);
    setIndex(0);
    setScore(0);
    setStreak(0);
    setWrong(0);
    setResults([]);
    setReveal(null);
    setText('');
    setNewBest(false);
    setStage('playing');
    sfx.click();
  };

  const named = results.filter((r) => r.outcome === 'right').length;
  const title = isAll ? `All ${domainInfo(order[0].series.domain).label}` : order[0].series.label;

  return (
    <div className="mx-auto max-w-xl space-y-5">
      <div className="flex items-center justify-between gap-2">
        <Link to="/whos-that" className="font-display text-sm font-semibold tracking-wider text-ink-soft hover:text-ink">
          ← All series
        </Link>
        <span className="font-display text-xs uppercase tracking-widest text-ink-faint">{title}</span>
      </div>

      {stage === 'ready' && (
        <div className="page animate-round-in space-y-5 rounded-md p-6 text-center">
          <p className="font-display text-xs uppercase tracking-[0.3em] text-ink-faint">Who&apos;s That?</p>
          <h1 className="text-4xl font-bold">{title}</h1>
          <p className="text-ink-soft">
            {deck.length} silhouettes. 60 seconds. +{POINTS} for each name (+{STREAK_BONUS} per streak step), −{PENALTY} for a wrong guess. English and French names
            both count, typos are forgiven.
          </p>
          {best > 0 && <p className="text-sm text-ink-faint">Your best: {best} pts</p>}
          <button type="button" onClick={start} className="btn-accent w-full rounded-md py-3.5 font-display text-lg font-bold tracking-[0.2em]">
            START
          </button>
        </div>
      )}

      {stage === 'playing' && card && (
        <div className="space-y-4">
          <div className="flex items-center justify-between font-display">
            <span className="text-2xl font-bold tabular-nums">{score} pts</span>
            <span className="text-sm tracking-wider text-ink-soft">
              {named} named{streak > 1 && <span className="ml-2 font-bold text-ochre">🔥 ×{streak}</span>}
            </span>
          </div>
          <TimerBar total={ROUND_MS} running onExpire={finish} />

          <div
            ref={frame}
            className="relative mx-auto aspect-square w-full max-w-sm overflow-hidden rounded-xl border-2 border-rule-strong"
            style={{ background: 'radial-gradient(circle at 50% 45%, #fde68a 0%, #f59e0b 35%, #1d4ed8 75%)' }}
          >
            <img
              key={`${run}-${index}`}
              src={card.image}
              alt={reveal ? card.name : 'Silhouette'}
              draggable={false}
              onError={() => next('skipped')}
              onContextMenu={(e) => e.preventDefault()}
              className="animate-pop absolute inset-0 size-full select-none object-contain p-6 transition-[filter] duration-300"
              style={{ filter: reveal ? 'none' : 'brightness(0) drop-shadow(0 4px 10px rgb(0 0 0 / 0.35))' }}
            />
            {reveal && (
              <span
                className={`animate-pop absolute inset-x-0 bottom-0 px-3 py-2 text-center font-display text-lg font-bold text-on-strong ${reveal === 'right' ? 'bg-hit' : 'bg-ink-soft'}`}
              >
                {reveal === 'right' ? '✓' : 'It was'} {card.name}
                {isAll && <span className="ml-2 text-xs opacity-80">· {card.series.label}</span>}
              </span>
            )}
            {flashKey > 0 && <span key={flashKey} className="boss-hit-flash pointer-events-none absolute inset-0 bg-coral/60" />}
          </div>

          <div className="flex gap-2">
            <input
              ref={input}
              value={text}
              onChange={(e) => {
                setText(e.target.value);
                // An exact name (accents, case and punctuation aside) counts as soon as it's typed.
                if (!reveal && spellings(card).some((s) => compactText(s) === compactText(e.target.value))) right();
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') submit(text);
                else if (e.key === 'Escape' || e.key === 'Tab') {
                  e.preventDefault();
                  skip();
                }
              }}
              placeholder={`Name this ${isAll ? 'one' : card.series.noun}…`}
              autoComplete="off"
              autoCapitalize="off"
              spellCheck={false}
              className="min-w-0 flex-1 rounded-xl border border-rule-strong bg-card/90 px-4 py-3 text-base outline-none ring-accent/30 transition placeholder:text-ink-faint focus:border-accent focus:ring-4"
            />
            <button type="button" onClick={skip} className="btn-paper shrink-0 rounded-md px-4 font-display text-sm font-bold tracking-wider">
              Skip
            </button>
          </div>
          <p className="text-center text-xs text-ink-faint">Enter to guess · Esc or Tab to skip</p>
        </div>
      )}

      {stage === 'done' && (
        <div className="page animate-round-in space-y-5 rounded-md p-6 text-center">
          <p className="font-display text-xs uppercase tracking-[0.3em] text-ink-faint">Time&apos;s up!</p>
          <h2 className="boss-phase-title font-display text-5xl font-bold">{score} pts</h2>
          {newBest && <p className="font-display font-bold tracking-wider text-ochre">★ New best score</p>}
          <dl className="grid grid-cols-3 gap-3">
            {[
              ['Named', named],
              ['Wrong', wrong],
              ['Skipped', results.length - named],
            ].map(([k, v]) => (
              <div key={k} className="rounded-md border border-rule bg-card/70 px-3 py-2">
                <dt className="font-display text-[11px] uppercase tracking-widest text-ink-faint">{k}</dt>
                <dd className="font-display text-2xl font-bold tabular-nums">{v}</dd>
              </div>
            ))}
          </dl>
          {results.length > 0 && (
            <ul className="flex flex-wrap justify-center gap-1.5">
              {results.map((r, i) => (
                <li key={i} className={`flex items-center gap-1 rounded-md border px-1.5 py-1 text-xs font-semibold ${r.outcome === 'right' ? 'border-hit/50 bg-hit/10' : 'border-rule bg-tile'}`}>
                  <img src={r.card.image} alt="" className="size-6 object-contain" />
                  {r.card.name}
                </li>
              ))}
            </ul>
          )}
          <div className="flex flex-col gap-3 sm:flex-row">
            <button type="button" onClick={start} className="btn-accent flex-1 rounded-md py-3 font-display font-bold tracking-widest">
              Play again
            </button>
            <Link to="/whos-that" className="btn-paper flex-1 rounded-md py-3 text-center font-display font-bold tracking-widest">
              Other series
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
