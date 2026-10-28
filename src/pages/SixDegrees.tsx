import { useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { SIX_ROUNDS, SIX_THEMES, sixGraph, sixPuzzle, sixStars } from '../arcade/sixDegrees';
import { celebrateBig, shake } from '../lib/fx';
import { sfx } from '../lib/sfx';
import { useProgress } from '../store/progress';
import { compactText } from '../utils/textMatcher';

function Tile({ label, image, tone = '', small = false }: { label: string; image?: string; tone?: string; small?: boolean }) {
  return (
    <span className={`flex flex-col overflow-hidden rounded-md border-2 bg-card ${tone} ${small ? 'w-16 sm:w-20' : 'w-20 sm:w-24'}`}>
      <span className="aspect-square bg-tile">{image && <img src={image} alt="" draggable={false} className="size-full object-cover object-top" />}</span>
      <span className="truncate px-1 py-0.5 text-center text-[10px] font-semibold sm:text-xs">{label}</span>
    </span>
  );
}

function Run({ themeId, label, onExit }: { themeId: string; label: string; onExit: () => void }) {
  const key = `six:${themeId}`;
  const best = useProgress((s) => s.bests[key] ?? 0);
  const recordBest = useProgress((s) => s.recordBest);
  const g = sixGraph(themeId);
  const images = useMemo(() => new Map(g.cards.map((c) => [c.label, c.image])), [g]);
  const [index, setIndex] = useState(0);
  const [puzzle, setPuzzle] = useState(() => sixPuzzle(themeId));
  const [chain, setChain] = useState<string[]>(() => [puzzle.from]);
  const [wrong, setWrong] = useState(0);
  const [stars, setStars] = useState<number[]>([]);
  const [gaveUp, setGaveUp] = useState(false);
  const [filter, setFilter] = useState('');
  const [note, setNote] = useState<string | null>(null);
  const grid = useRef<HTMLDivElement>(null);
  const current = chain.at(-1)!;
  const solved = current === puzzle.to;
  const finished = solved || gaveUp;
  const total = stars.reduce((a, b) => a + b, 0);
  const over = stars.length === SIX_ROUNDS;

  const end = (s: number) => {
    const all = [...stars, s];
    setStars(all);
    if (all.length === SIX_ROUNDS) {
      const sum = all.reduce((a, b) => a + b, 0);
      recordBest(key, sum);
      if (sum > best) window.setTimeout(() => (sfx.streak(), celebrateBig()), 300);
    }
  };

  const step = (card: string) => {
    if (finished || chain.includes(card)) return;
    const via = g.links.get(current)?.get(card);
    if (!via) {
      sfx.wrong();
      setWrong((w) => w + 1);
      setNote(`${card} and ${current} share no group.`);
      shake(grid.current, 6, 300);
      return;
    }
    sfx.correct();
    setNote(null);
    setFilter('');
    const next = [...chain, card];
    setChain(next);
    if (card === puzzle.to) end(sixStars(next.length - 1, puzzle.par, wrong));
  };
  const undo = () => {
    if (finished || chain.length < 2) return;
    sfx.click();
    setChain((c) => c.slice(0, -1));
  };
  const giveUp = () => {
    sfx.wrong();
    setGaveUp(true);
    end(0);
  };
  /** A new puzzle, its chain starting from its own first card. */
  const newPuzzle = () => {
    const p = sixPuzzle(themeId);
    setPuzzle(p);
    setChain([p.from]);
    setWrong(0);
    setGaveUp(false);
    setNote(null);
    setFilter('');
  };
  const next = () => {
    sfx.click();
    setIndex((i) => i + 1);
    newPuzzle();
  };
  const again = () => {
    sfx.click();
    setIndex(0);
    setStars([]);
    newPuzzle();
  };

  const q = compactText(filter);
  const choices = g.cards.filter((c) => c.label !== current && !chain.includes(c.label) && (!q || compactText(c.label).includes(q)));

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div className="flex items-end justify-between">
        <button type="button" onClick={onExit} className="font-display text-sm font-semibold tracking-wider text-ink-soft hover:text-ink">
          ← {label}
        </button>
        <p className="font-display text-sm text-ink-soft">
          Puzzle {Math.min(index + 1, SIX_ROUNDS)}/{SIX_ROUNDS} · <span className="font-serif text-2xl font-bold text-ink">{total}</span> / {SIX_ROUNDS * 3} ★
        </p>
      </div>

      <div className="page space-y-3 rounded-md p-4">
        <p className="text-center text-ink-soft">
          Go from <span className="font-bold text-ink">{puzzle.from}</span> to <span className="font-bold text-ink">{puzzle.to}</span>, one shared group at a time — par is{' '}
          <span className="font-bold text-ink">{puzzle.par}</span> steps.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-1.5">
          {chain.map((c, i) => (
            <span key={c} className="flex items-center gap-1.5">
              {i > 0 && <span className="max-w-24 text-center text-[10px] font-semibold leading-tight text-accent">→ {g.links.get(chain[i - 1])?.get(c)?.[0]} →</span>}
              <Tile label={c} image={images.get(c)} tone={c === puzzle.to ? 'border-hit' : 'border-ink'} />
            </span>
          ))}
          {!solved && (
            <>
              <span className="px-1 text-xl text-ink-faint">⋯</span>
              <Tile label={puzzle.to} image={images.get(puzzle.to)} tone="border-dashed border-hit/70 opacity-80" />
            </>
          )}
        </div>
        {!finished && (
          <div className="flex justify-center gap-2">
            <button type="button" onClick={undo} disabled={chain.length < 2} className="btn-paper rounded-md px-4 py-1.5 font-display text-sm font-semibold disabled:opacity-40">
              ↶ Undo
            </button>
            <button type="button" onClick={giveUp} className="btn-paper rounded-md px-4 py-1.5 font-display text-sm font-semibold">
              Give up
            </button>
          </div>
        )}
      </div>

      {finished ? (
        <div className={`animate-pop space-y-2 rounded-md border p-4 text-center ${solved ? 'border-hit/50 bg-hit/10' : 'border-miss/50 bg-miss/10'}`}>
          <p className="font-display text-sm uppercase tracking-widest text-ink-soft">
            {solved ? `${'★'.repeat(stars[index] ?? 0)}${'☆'.repeat(3 - (stars[index] ?? 0))} · ${chain.length - 1} steps (par ${puzzle.par}) · ${wrong} wrong` : 'Given up'}
          </p>
          <p className="text-sm text-ink-soft">
            A shortest chain:{' '}
            {puzzle.path.map((c, i) => (
              <span key={c}>
                {i > 0 && <span className="text-accent"> → {g.links.get(puzzle.path[i - 1])?.get(c)?.[0]} → </span>}
                <span className="font-semibold text-ink">{c}</span>
              </span>
            ))}
          </p>
          {!over ? (
            <button type="button" onClick={next} className="btn-ink rounded-md px-6 py-2.5 font-display font-bold tracking-wider">
              Next puzzle →
            </button>
          ) : (
            <div className="space-y-1">
              <p className="font-display font-bold">
                {total} / {SIX_ROUNDS * 3} ★ {total > best ? <span className="text-ochre">· New best</span> : <span className="text-ink-soft">· best {best}</span>}
              </p>
              <button type="button" onClick={again} className="btn-ink rounded-md px-6 py-2.5 font-display font-bold tracking-wider">
                Play again
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-center text-sm text-ink-soft">
            Pick someone who shares a group with <span className="font-bold text-ink">{current}</span>:
          </p>
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter by name…"
            autoComplete="off"
            spellCheck={false}
            className="w-full rounded-xl border border-rule-strong bg-card/90 px-4 py-2 outline-none ring-accent/30 focus:border-accent focus:ring-4"
          />
          <p className="h-5 text-center text-sm font-semibold text-coral">{note}</p>
          <div ref={grid} className="flex flex-wrap justify-center gap-1.5">
            {choices.map((c) => (
              <button key={c.label} type="button" onClick={() => step(c.label)} className="transition hover:-translate-y-0.5">
                <Tile label={c.label} image={c.image} small tone={c.label === puzzle.to ? 'border-hit/70' : 'border-rule'} />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/** /six-degrees */
export default function SixDegrees() {
  const bests = useProgress((s) => s.bests);
  const [theme, setTheme] = useState<(typeof SIX_THEMES)[number] | null>(null);
  if (theme) return <Run key={theme.id} themeId={theme.id} label={theme.theme} onExit={() => setTheme(null)} />;
  return (
    <div className="space-y-8">
      <div>
        <Link to="/games" className="font-display text-sm font-semibold tracking-wider text-ink-soft hover:text-ink">
          ← Games
        </Link>
        <h1 className="text-5xl font-bold">Six Degrees</h1>
        <p className="max-w-xl text-ink-soft">
          Link two characters through the groups they share — Luffy → Straw Hats → Zoro → master swordsmen → Mihawk. Each step must share a group
          with the last. Reach the target in as few steps as par for three stars. {SIX_ROUNDS} puzzles a run.
        </p>
      </div>
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {SIX_THEMES.map((t) => (
          <li key={t.id}>
            <button type="button" onClick={() => (sfx.click(), setTheme(t))} className="page flex h-full w-full flex-col items-start gap-1 rounded-md p-4 text-left ring-2 ring-accent/40 transition hover:-translate-y-0.5">
              <span className="font-display text-lg font-bold">{t.theme}</span>
              <span className="text-xs text-ink-faint">{(bests[`six:${t.id}`] ?? 0) > 0 ? `Best: ${bests[`six:${t.id}`]} / ${SIX_ROUNDS * 3} ★` : 'Not played yet'}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
