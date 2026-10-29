import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { MAX_LETTERS, WORDLE_SETS, WORDLE_TRIES, didYouMean, lengthHint, markGuess, namesIn, wordleSet, type LetterMark, type WordleName } from '../arcade/wordle';
import { NameLangSwitch } from '../components/NameLangSwitch';
import { celebrateBig, shake } from '../lib/fx';
import { sfx } from '../lib/sfx';
import { useProgress } from '../store/progress';

const KEYS = ['QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM'];
const MARK_CLASS: Record<LetterMark, string> = {
  hit: 'border-hit bg-hit text-on-strong',
  near: 'border-near bg-near text-on-pastel',
  // Grey, and quiet: only the letters that are in the name should catch the eye.
  miss: 'border-rule bg-tile text-ink-faint opacity-70',
};
const RANK: Record<LetterMark, number> = { miss: 0, near: 1, hit: 2 };
const HINT = {
  longer: { icon: '▲', text: 'The name is longer', className: 'text-accent' },
  shorter: { icon: '▼', text: 'The name is shorter', className: 'text-coral' },
  same: { icon: '=', text: 'Same length', className: 'text-hit' },
};
/** Rows are as long as their guess: tiles shrink so the longest still fits a phone. */
const tileSize = (cols: number) => `min(2.75rem, calc((min(100vw, 36rem) - 4.5rem) / ${cols} - 0.375rem))`;

function Game({ id, label, names }: { id: string; label: string; names: WordleName[] }) {
  const key = `wordle:${id}`;
  const best = useProgress((s) => s.bests[key] ?? 0);
  const recordBest = useProgress((s) => s.recordBest);
  const [run, setRun] = useState(0);
  const answer = useMemo(() => names[Math.floor(Math.random() * names.length)], [names, run]);
  const valid = useMemo(() => new Set(names.map((n) => n.word)), [names]);
  const [guesses, setGuesses] = useState<string[]>([]);
  const [typed, setTyped] = useState('');
  const [note, setNote] = useState<string | null>(null);
  // A name the guess was close to (or another spelling of): one click, or Tab, puts it in the row.
  const [suggest, setSuggest] = useState<WordleName | null>(null);
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
      const near = didYouMean(names, typed);
      setSuggest(near?.name ?? null);
      // Another spelling of a name (the other language, a nickname, the full name) is told apart from a near-miss.
      setNote(near?.why === 'alt' ? 'Right one, other spelling.' : `Not a ${label.toLowerCase()} name.`);
      shake(document.getElementById('wordle-row'), 6, 300);
      return sfx.wrong();
    }
    setSuggest(null);
    const next = [...guesses, typed];
    setGuesses(next);
    setTyped('');
    setNote(null);
    if (typed === answer.word) {
      sfx.streak();
      const s = streak + 1;
      setStreak(s);
      recordBest(key, s, { won: true });
      if (s > best) window.setTimeout(() => celebrateBig(), 300);
    } else if (next.length >= WORDLE_TRIES) {
      sfx.wrong();
      // A lost word still counts as a game played (the best streak stays).
      recordBest(key, 0, { won: false });
      setStreak(0);
    } else sfx.click();
  };

  const press = (k: string) => {
    if (done) return;
    if (k === 'ENTER') return submit();
    setNote(null);
    setSuggest(null);
    if (k === 'BACK') return setTyped((t) => t.slice(0, -1));
    if (/^[A-Z]$/.test(k)) setTyped((t) => (t.length < MAX_LETTERS ? t + k : t));
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === 'Tab' && suggest) (e.preventDefault(), takeSuggestion());
      else if (e.key === 'Enter') press('ENTER');
      else if (e.key === 'Backspace') press('BACK');
      else if (/^[a-z]$/i.test(e.key)) press(e.key.toUpperCase());
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const takeSuggestion = () => {
    if (!suggest) return;
    sfx.select();
    setTyped(suggest.word);
    setSuggest(null);
    setNote(null);
  };

  const next = () => {
    sfx.click();
    setSuggest(null);
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
      <div className="flex min-h-7 flex-wrap items-center justify-center gap-2 text-center text-sm font-semibold">
        {note && <span className="text-coral">{note}</span>}
        {suggest && !done && (
          <button type="button" onClick={takeSuggestion} className="btn-paper animate-pop rounded-md px-2.5 py-1 text-sm" title="Tab">
            Did you mean <span className="font-bold text-accent">{suggest.name}</span>? <span className="text-xs text-ink-faint">⇥ Tab</span>
          </button>
        )}
      </div>
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
  const lang = useProgress((s) => s.nameLang);
  if (id) {
    const set = wordleSet(id);
    if (!set) return <Navigate to="/wordle" replace />;
    return (
      <div className="space-y-6">
        <div className="mx-auto max-w-xl">
          <Link to="/wordle" className="font-display text-sm font-semibold tracking-wider text-ink-soft hover:text-ink">
            ← Franchise Wordle
          </Link>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h1 className="text-4xl font-bold">
              {set.icon} {set.label}
            </h1>
            {set.namesFr && <NameLangSwitch />}
          </div>
        </div>
        {/* A new name when the language changes: the board was for the other spelling. */}
        <Game key={`${set.id}:${lang}`} id={set.id} label={set.label} names={namesIn(set, lang)} />
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
        <div className="mt-3 flex items-center gap-2 text-sm text-ink-soft">
          Names in <NameLangSwitch /> <span className="text-ink-faint">— Pokémon and Minecraft have their French names; the others are the same in both.</span>
        </div>
      </div>
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {WORDLE_SETS.map((s) => (
          <li key={s.id}>
            <Link to={`/wordle/${s.id}`} className="page flex h-full flex-col gap-1 rounded-md p-5 ring-2 ring-accent/40 transition hover:-translate-y-0.5">
              <span className="text-3xl">{s.icon}</span>
              <span className="font-display text-xl font-bold">{s.label}</span>
              <span className="text-xs text-ink-faint">
                {namesIn(s, lang).length} names{s.namesFr && lang === 'fr' ? ' · en français' : ''}{(bests[`wordle:${s.id}`] ?? 0) > 0 ? ` · best streak ${bests[`wordle:${s.id}`]}` : ''}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
