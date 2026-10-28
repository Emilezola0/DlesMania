import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { MAX_LETTERS, WORDLE_SETS, WORDLE_TRIES, lengthHint, markGuess, wordleSet, type LetterMark, type WordleSet } from '../arcade/wordle';
import { celebrateBig, shake } from '../lib/fx';
import { sfx } from '../lib/sfx';
import { useProgress } from '../store/progress';

const KEYS = ['QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM'];
const MARK_CLASS: Record<LetterMark, string> = {
  hit: 'border-hit bg-hit text-on-strong',
  near: 'border-near bg-near text-on-pastel',
  miss: 'border-miss/60 bg-miss/40 text-ink-soft',
};
const RANK: Record<LetterMark, number> = { miss: 0, near: 1, hit: 2 };
const HINT = {
  longer: { icon: '▲', text: 'The name is longer', className: 'text-accent' },
  shorter: { icon: '▼', text: 'The name is shorter', className: 'text-coral' },
  same: { icon: '=', text: 'Same length', className: 'text-hit' },
};
/** Rows are as long as their guess: tiles shrink so the longest still fits a phone. */
const tileSize = (cols: number) => `min(2.75rem, calc((min(100vw, 36rem) - 4.5rem) / ${cols} - 0.375rem))`;

function Game({ set }: { set: WordleSet }) {
  const key = `wordle:${set.id}`;
  const best = useProgress((s) => s.bests[key] ?? 0);
  const recordBest = useProgress((s) => s.recordBest);
  const [run, setRun] = useState(0);
  const answer = useMemo(() => set.names[Math.floor(Math.random() * set.names.length)], [set, run]);
  const valid = useMemo(() => new Set(set.names.map((n) => n.word)), [set]);
  const [guesses, setGuesses] = useState<string[]>([]);
  const [typed, setTyped] = useState('');
  const [note, setNote] = useState<string | null>(null);
  const [streak, setStreak] = useState(0);
  const won = guesses.at(-1) === answer.word;
  const done = won || guesses.length >= WORDLE_TRIES;

  // Best mark seen for each letter, for the keyboard.
  const keyMarks = new Map<string, LetterMark>();
  for (const g of guesses) {
    markGuess(g, answer.word).forEach((m, i) => {
      const prev = keyMarks.get(g[i]);
      if (!prev || RANK[m] > RANK[prev]) keyMarks.set(g[i], m);
    });
  }

  const submit = () => {
    if (!typed) return;
    if (!valid.has(typed)) {
      setNote(`Not a ${set.label.toLowerCase()} name`);
      shake(document.getElementById('wordle-row'), 6, 300);
      return sfx.wrong();
    }
    const next = [...guesses, typed];
    setGuesses(next);
    setTyped('');
    setNote(null);
    if (typed === answer.word) {
      sfx.streak();
      const s = streak + 1;
      setStreak(s);
      recordBest(key, s);
      if (s > best) window.setTimeout(() => celebrateBig(), 300);
    } else if (next.length >= WORDLE_TRIES) {
      sfx.wrong();
      setStreak(0);
    } else sfx.click();
  };

  const press = (k: string) => {
    if (done) return;
    if (k === 'ENTER') return submit();
    setNote(null);
    if (k === 'BACK') return setTyped((t) => t.slice(0, -1));
    if (/^[A-Z]$/.test(k)) setTyped((t) => (t.length < MAX_LETTERS ? t + k : t));
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === 'Enter') press('ENTER');
      else if (e.key === 'Backspace') press('BACK');
      else if (/^[a-z]$/i.test(e.key)) press(e.key.toUpperCase());
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const next = () => {
    sfx.click();
    setRun((r) => r + 1);
    setGuesses([]);
    setTyped('');
    setNote(null);
  };

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <div className="flex items-end justify-between">
        <p className="font-serif text-lg italic text-ink-soft">Any name · {WORDLE_TRIES - guesses.length} {WORDLE_TRIES - guesses.length === 1 ? 'try' : 'tries'} left</p>
        <p className="font-display text-sm text-ink-soft">
          Streak <span className="font-serif text-2xl font-bold text-ink">{streak}</span> · best {Math.max(best, streak)}
        </p>
      </div>
      <div className="mx-auto grid w-fit gap-1.5">
        {[...guesses, ...(done ? [] : [typed])].map((letters, row) => {
          const g = row < guesses.length ? letters : null;
          const marks = g ? markGuess(g, answer.word) : null;
          const hint = g && !(won && row === guesses.length - 1) ? HINT[lengthHint(g, answer.word)] : null;
          const size = tileSize(Math.max(5, ...guesses.map((x) => x.length), typed.length) + 1);
          return (
            <div key={row} id={g ? undefined : 'wordle-row'} className="flex items-center gap-1.5">
              {Array.from({ length: Math.max(letters.length, g ? 0 : 1) }, (_, i) => (
                <span
                  key={i}
                  className={`grid aspect-square place-items-center rounded-md border-2 font-display text-[clamp(0.7rem,4vw,1.25rem)] font-bold ${
                    marks ? `animate-pop ${MARK_CLASS[marks[i]]}` : letters[i] ? 'border-ink' : 'border-dashed border-rule'
                  }`}
                  style={{ width: size, ...(marks ? { animationDelay: `${i * 70}ms` } : {}) }}
                >
                  {letters[i] ?? ''}
                </span>
              ))}
              <span title={hint?.text} aria-label={hint?.text} className={`grid place-items-center font-display text-lg font-bold ${hint?.className ?? ''}`} style={{ width: size }}>
                {hint?.icon ?? ''}
              </span>
            </div>
          );
        })}
      </div>
      <p className="h-5 text-center text-sm font-semibold text-coral">{note}</p>
      {done ? (
        <div className={`animate-pop space-y-2 rounded-md border p-4 text-center ${won ? 'border-hit/50 bg-hit/10' : 'border-miss/50 bg-miss/10'}`}>
          <p className="font-display text-sm uppercase tracking-widest text-ink-soft">{won ? `Found in ${guesses.length}` : 'Out of tries'}</p>
          <p className="text-2xl font-bold">{answer.name}</p>
          <button type="button" onClick={next} className="btn-ink rounded-md px-6 py-2.5 font-display font-bold tracking-wider">
            {won ? 'Next name →' : 'Try another'}
          </button>
        </div>
      ) : (
        <div className="space-y-1.5">
          {KEYS.map((row, r) => (
            <div key={row} className="flex justify-center gap-1">
              {r === 2 && (
                <button type="button" onClick={() => press('ENTER')} className="rounded-md border border-rule-strong bg-card px-2 font-display text-xs font-bold sm:px-3">
                  Enter
                </button>
              )}
              {[...row].map((k) => {
                const m = keyMarks.get(k);
                return (
                  <button key={k} type="button" onClick={() => press(k)} className={`h-11 w-7 rounded-md border font-display text-sm font-bold sm:w-9 ${m ? MARK_CLASS[m] : 'border-rule-strong bg-card'}`}>
                    {k}
                  </button>
                );
              })}
              {r === 2 && (
                <button type="button" onClick={() => press('BACK')} aria-label="Delete" className="rounded-md border border-rule-strong bg-card px-2 font-display text-sm font-bold sm:px-3">
                  ⌫
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** /wordle and /wordle/:set */
export default function FranchiseWordle() {
  const { set: id } = useParams();
  const bests = useProgress((s) => s.bests);
  if (id) {
    const set = wordleSet(id);
    if (!set) return <Navigate to="/wordle" replace />;
    return (
      <div className="space-y-6">
        <div className="mx-auto max-w-xl">
          <Link to="/wordle" className="font-display text-sm font-semibold tracking-wider text-ink-soft hover:text-ink">
            ← Franchise Wordle
          </Link>
          <h1 className="text-4xl font-bold">
            {set.icon} {set.label}
          </h1>
        </div>
        <Game key={set.id} set={set} />
      </div>
    );
  }
  return (
    <div className="space-y-8">
      <div>
        <Link to="/games" className="font-display text-sm font-semibold tracking-wider text-ink-soft hover:text-ink">
          ← Games
        </Link>
        <h1 className="text-5xl font-bold">Franchise Wordle</h1>
        <p className="max-w-xl text-ink-soft">
          Wordle with names: guess the Pokémon, the champion or the character in six tries. The name's length is hidden and any name of the set
          can be a guess: green is the right letter in the right place, yellow is elsewhere in the name, and ▲ ▼ tell you whether the name is
          longer or shorter.
        </p>
      </div>
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {WORDLE_SETS.map((s) => (
          <li key={s.id}>
            <Link to={`/wordle/${s.id}`} className="page flex h-full flex-col gap-1 rounded-md p-5 ring-2 ring-accent/40 transition hover:-translate-y-0.5">
              <span className="text-3xl">{s.icon}</span>
              <span className="font-display text-xl font-bold">{s.label}</span>
              <span className="text-xs text-ink-faint">
                {s.names.length} names{(bests[`wordle:${s.id}`] ?? 0) > 0 ? ` · best streak ${bests[`wordle:${s.id}`]}` : ''}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
