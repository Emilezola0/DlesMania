import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { Glyph } from '../components/Glyph';
import { domainInfo } from '../data';
import { ALL_PREFIX, SILHOUETTES, deckFor, silhouetteDomains, type SilhouetteEntry, type SilhouetteSeries } from '../data/silhouettes';
import { celebrateBig, shake } from '../lib/fx';
import { shuffle } from '../lib/rng';
import { sfx } from '../lib/sfx';
import { useProgress } from '../store/progress';
import { compactText, isFuzzyMatch } from '../utils/textMatcher';

/** How long a named silhouette stays revealed, and how long the one that ended the run does. */
const REVEAL_MS = 650;
const MISS_MS = 1600;
/** Rising mode: the silhouette gets harder every this many names, up to MAX_LEVEL. */
const LEVEL_EVERY = 4;
const MAX_LEVEL = 5;

type Card = SilhouetteEntry & { series: SilhouetteSeries };
type Mode = 'easy' | 'rising';

const MODES: Record<Mode, { label: string; blurb: string }> = {
  easy: { label: 'Easy', blurb: 'The plain silhouette, all run long.' },
  rising: { label: 'Rising', blurb: `Every ${LEVEL_EVERY} names it gets harder: turned, then zoomed in, mirrored, cropped, and finally spinning.` },
};

/** Best streaks are kept per mode ("easy:pokemon"), apart from the old timed scores. */
const bestKey = (mode: Mode, key: string) => `${mode}:${key}`;

const spellings = (c: Card) => [c.name, ...c.aliases];

/** "champions", "mobs" — but "Pokémon" stays the same in the plural. */
const plural = (noun: string, n: number) => (n === 1 || /mon$|s$/.test(noun) ? noun : `${noun}s`);

/** How one silhouette is shown at a Rising level (0 = plain). */
interface Look {
  transform: string;
  transformOrigin: string;
  clipPath?: string;
  spin: boolean;
}

/** Level 1 turns it, 2 also zooms in on part of it, 3 may mirror it, 4 crops a side away, 5 sets it spinning. */
function drawLook(level: number, rand: () => number): Look {
  const sign = rand() < 0.5 ? -1 : 1;
  const turn = level >= 1 ? sign * Math.min(180, 25 + level * 20 + rand() * 30) : 0;
  const zoom = level >= 2 ? 1.25 + (level - 2) * 0.1 + rand() * 0.15 : 1;
  const mirror = level >= 3 && rand() < 0.5;
  const origin = level >= 2 ? `${35 + Math.round(rand() * 30)}% ${30 + Math.round(rand() * 35)}%` : '50% 50%';
  let clipPath: string | undefined;
  if (level >= 4) {
    // Hide a big slice of one side and a smaller one of the opposite side.
    const big = 30 + Math.round(rand() * 12);
    const small = 8 + Math.round(rand() * 10);
    const side = Math.floor(rand() * 4);
    const cut = [0, 0, 0, 0];
    cut[side] = big;
    cut[(side + 2) % 4] = small;
    clipPath = `inset(${cut.map((c) => `${c}%`).join(' ')})`;
  }
  return {
    transform: `rotate(${Math.round(turn)}deg) scale(${(mirror ? -zoom : zoom).toFixed(2)}, ${zoom.toFixed(2)})`,
    transformOrigin: origin,
    clipPath,
    spin: level >= 5,
  };
}

/** Picker: one card per series, plus "All" for each domain. */
export function WhosThatHub() {
  const best = useProgress((s) => s.whosThat);
  return (
    <div className="space-y-8">
      <div>
        <p className="font-display text-xs uppercase tracking-[0.3em] text-ink-faint">One mistake and it&apos;s over</p>
        <h1 className="text-5xl font-bold">Who&apos;s That?</h1>
        <p className="max-w-xl text-ink-soft">
          Silhouettes appear one after another — keep naming them for as long as you can. A wrong name or a pass ends the run; your score is your streak.
          Play Easy (always the plain silhouette) or Rising (it gets harder as you go).
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
                    <span className="mt-auto pt-2 text-xs text-ink-faint">
                      {(['easy', 'rising'] as Mode[]).some((m) => best[bestKey(m, o.key)])
                        ? (['easy', 'rising'] as Mode[]).map((m) => `${MODES[m].label}: ${best[bestKey(m, o.key)] ?? 0}`).join(' · ')
                        : 'Not played yet'}
                    </span>
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

/** How the run ended: the silhouette missed and what was typed (nothing for a pass), or the deck ran out. */
interface Miss {
  card: Card;
  typed: string | null;
}

function WhosThatGame({ playKey, deck }: { playKey: string; deck: Card[] }) {
  const recordBest = useProgress((s) => s.recordWhosThat);
  const bests = useProgress((s) => s.whosThat);
  const [mode, setMode] = useState<Mode>('easy');
  const best = bests[bestKey(mode, playKey)] ?? 0;
  const [run, setRun] = useState(0);
  const order = useMemo(() => shuffle(deck, Math.random), [deck, run]);
  const [stage, setStage] = useState<Stage>('ready');
  const [index, setIndex] = useState(0);
  const [named, setNamed] = useState<Card[]>([]);
  const [reveal, setReveal] = useState<'right' | 'miss' | null>(null);
  const [miss, setMiss] = useState<Miss | null>(null);
  const [text, setText] = useState('');
  const [newBest, setNewBest] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const frame = useRef<HTMLDivElement>(null);
  const timer = useRef<number>();
  useEffect(() => () => window.clearTimeout(timer.current), []);
  const card = order[index];
  const isAll = playKey.startsWith(ALL_PREFIX);
  const score = named.length;
  const level = mode === 'rising' ? Math.min(MAX_LEVEL, Math.floor(score / LEVEL_EVERY)) : 0;
  const look = useMemo(() => drawLook(level, Math.random), [level, index, run]);

  // Keep the next few pictures loading ahead.
  useEffect(() => {
    for (let k = 1; k <= 3; k++) {
      const next = order[index + k];
      if (next) new Image().src = next.image;
    }
  }, [index, order]);

  useEffect(() => {
    if (stage === 'playing') input.current?.focus({ preventScroll: true });
  }, [stage, index]);

  const finish = (total: number, ended: Miss | null) => {
    setStage('done');
    setReveal(null);
    setMiss(ended);
    const isBest = total > best;
    setNewBest(isBest && total > 0);
    recordBest(bestKey(mode, playKey), total);
    if (isBest && total > 0) {
      sfx.victory();
      celebrateBig();
    } else sfx.lose();
  };

  const right = () => {
    if (!card || reveal) return;
    const now = [...named, card];
    setNamed(now);
    setReveal('right');
    sfx.correct();
    timer.current = window.setTimeout(() => {
      setReveal(null);
      setText('');
      // Named every silhouette: a perfect run.
      if (index + 1 >= order.length) return finish(now.length, null);
      setIndex((i) => i + 1);
    }, REVEAL_MS);
  };

  /** A wrong name or a pass: show the answer, then the results. */
  const fail = (typed: string | null) => {
    if (!card || reveal) return;
    setReveal('miss');
    setMiss({ card, typed });
    sfx.wrong();
    shake(frame.current, 6, 300);
    timer.current = window.setTimeout(() => finish(named.length, { card, typed }), MISS_MS);
  };

  const submit = (value: string) => {
    if (stage !== 'playing' || reveal || !value.trim()) return;
    if (isFuzzyMatch(value, spellings(card))) right();
    else fail(value.trim());
  };

  const start = (m: Mode) => {
    window.clearTimeout(timer.current);
    setMode(m);
    setRun((r) => r + 1);
    setIndex(0);
    setNamed([]);
    setReveal(null);
    setMiss(null);
    setText('');
    setNewBest(false);
    setStage('playing');
    sfx.click();
  };

  const title = isAll ? `All ${domainInfo(order[0].series.domain).label}` : order[0].series.label;
  const modeBest = (m: Mode) => bests[bestKey(m, playKey)] ?? 0;

  return (
    <div className="mx-auto max-w-xl space-y-5">
      <div className="flex items-center justify-between gap-2">
        <Link to="/whos-that" className="font-display text-sm font-semibold tracking-wider text-ink-soft hover:text-ink">
          ← All series
        </Link>
        <span className="font-display text-xs uppercase tracking-widest text-ink-faint">
          {title}
          {stage !== 'ready' && ` · ${MODES[mode].label}`}
        </span>
      </div>

      {stage === 'ready' && (
        <div className="page animate-round-in space-y-5 rounded-md p-6 text-center">
          <p className="font-display text-xs uppercase tracking-[0.3em] text-ink-faint">Who&apos;s That?</p>
          <h1 className="text-4xl font-bold">{title}</h1>
          <p className="text-ink-soft">
            {deck.length} silhouettes. Name them one after another — a wrong name or a pass ends the run, and your score is your streak. English and French
            names both count, typos are forgiven.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            {(['easy', 'rising'] as Mode[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => start(m)}
                className={`${m === 'easy' ? 'btn-accent' : 'btn-paper'} flex flex-col items-center gap-1 rounded-md px-4 py-3.5`}
              >
                <span className="font-display text-lg font-bold tracking-[0.2em]">{MODES[m].label.toUpperCase()}</span>
                <span className="text-xs opacity-80">{MODES[m].blurb}</span>
                {modeBest(m) > 0 && <span className="text-xs font-semibold opacity-80">Best: {modeBest(m)}</span>}
              </button>
            ))}
          </div>
        </div>
      )}

      {stage === 'playing' && card && (
        <div className="space-y-4">
          <div className="flex items-center justify-between font-display">
            <span className="text-2xl font-bold tabular-nums">🔥 {score}</span>
            <span className="text-sm tracking-wider text-ink-soft">
              {mode === 'rising' && <span className="mr-3 font-bold text-ochre">Level {level}</span>}
              Best {best}
            </span>
          </div>

          <div
            ref={frame}
            className="relative mx-auto aspect-square w-full max-w-sm overflow-hidden rounded-xl border-2 border-rule-strong"
            style={{ background: 'radial-gradient(circle at 50% 45%, #fde68a 0%, #f59e0b 35%, #1d4ed8 75%)' }}
          >
            {/* Rising: the turn, zoom and crop sit on one layer, the spin on another; a reveal shows it plain. */}
            <div className={`absolute inset-0 ${look.spin && !reveal ? 'whos-spin' : ''}`}>
              <div
                className="absolute inset-0 transition-transform duration-300"
                style={reveal ? undefined : { transform: look.transform, transformOrigin: look.transformOrigin, clipPath: look.clipPath }}
              >
                <img
                  key={`${run}-${index}`}
                  src={card.image}
                  alt={reveal ? card.name : 'Silhouette'}
                  draggable={false}
                  onError={() => {
                    // A broken picture shouldn't end the run: move on to the next one.
                    if (index + 1 >= order.length) finish(named.length, null);
                    else setIndex((i) => i + 1);
                  }}
                  onContextMenu={(e) => e.preventDefault()}
                  className="animate-pop absolute inset-0 size-full select-none object-contain p-6 transition-[filter] duration-300"
                  style={{ filter: reveal ? 'none' : 'brightness(0) drop-shadow(0 4px 10px rgb(0 0 0 / 0.35))' }}
                />
              </div>
            </div>
            {reveal && (
              <span
                className={`animate-pop absolute inset-x-0 bottom-0 px-3 py-2 text-center font-display text-lg font-bold text-on-strong ${reveal === 'right' ? 'bg-hit' : 'bg-coral'}`}
              >
                {reveal === 'right' ? '✓' : '✗ It was'} {card.name}
                {isAll && <span className="ml-2 text-xs opacity-80">· {card.series.label}</span>}
              </span>
            )}
            {reveal === 'miss' && <span className="boss-hit-flash pointer-events-none absolute inset-0 bg-coral/60" />}
          </div>

          <div className="flex gap-2">
            <input
              ref={input}
              value={text}
              disabled={reveal === 'miss'}
              onChange={(e) => {
                setText(e.target.value);
                // An exact name (accents, case and punctuation aside) counts as soon as it's typed.
                if (!reveal && spellings(card).some((s) => compactText(s) === compactText(e.target.value))) right();
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') submit(text);
              }}
              placeholder={`Name this ${isAll ? 'one' : card.series.noun}…`}
              autoComplete="off"
              autoCapitalize="off"
              spellCheck={false}
              className="min-w-0 flex-1 rounded-xl border border-rule-strong bg-card/90 px-4 py-3 text-base outline-none ring-accent/30 transition placeholder:text-ink-faint focus:border-accent focus:ring-4 disabled:opacity-60"
            />
            <button
              type="button"
              onClick={() => fail(null)}
              disabled={!!reveal}
              className="btn-paper shrink-0 rounded-md px-4 font-display text-sm font-bold tracking-wider"
            >
              Pass
            </button>
          </div>
          <p className="text-center text-xs text-ink-faint">Enter to guess · a wrong name or a pass ends the run</p>
        </div>
      )}

      {stage === 'done' && (
        <div className="page animate-round-in space-y-5 rounded-md p-6 text-center">
          <p className="font-display text-xs uppercase tracking-[0.3em] text-ink-faint">{miss ? 'Run over' : 'Perfect run — you named them all!'}</p>
          <h2 className="boss-phase-title font-display text-5xl font-bold">
            {score} <span className="text-2xl">{score === 1 ? 'name' : 'names'}</span>
          </h2>
          {newBest ? (
            <p className="font-display font-bold tracking-wider text-ochre">★ New best streak</p>
          ) : (
            best > 0 && <p className="text-sm text-ink-faint">Your best ({MODES[mode].label}): {best}</p>
          )}
          {miss && (
            <div className="flex items-center gap-4 rounded-md border border-coral/50 bg-coral/10 p-3 text-left">
              <img src={miss.card.image} alt="" className="size-20 shrink-0 object-contain" />
              <div className="min-w-0">
                <p className="font-display text-[11px] uppercase tracking-widest text-ink-faint">The one that got you</p>
                <p className="font-display text-xl font-bold">
                  {miss.card.name}
                  {isAll && <span className="ml-2 text-xs font-normal text-ink-soft">{miss.card.series.label}</span>}
                </p>
                {miss.card.aliases.length > 0 && <p className="text-xs text-ink-soft">Also: {miss.card.aliases.join(', ')}</p>}
                <p className="text-sm text-coral">{miss.typed ? `You answered “${miss.typed}”` : 'You passed'}</p>
              </div>
            </div>
          )}
          {named.length > 0 && (
            <ul className="flex flex-wrap justify-center gap-1.5">
              {named.map((c, i) => (
                <li key={i} className="flex items-center gap-1 rounded-md border border-hit/50 bg-hit/10 px-1.5 py-1 text-xs font-semibold">
                  <img src={c.image} alt="" className="size-6 object-contain" />
                  {c.name}
                </li>
              ))}
            </ul>
          )}
          <div className="flex flex-col gap-3 sm:flex-row">
            <button type="button" onClick={() => start(mode)} className="btn-accent flex-1 rounded-md py-3 font-display font-bold tracking-widest">
              Play again
            </button>
            <button type="button" onClick={() => setStage('ready')} className="btn-paper flex-1 rounded-md py-3 font-display font-bold tracking-widest">
              Change mode
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
