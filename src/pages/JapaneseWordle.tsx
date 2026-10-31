import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { JA_LETTERS, JA_TRIES, JA_WORDS, isJaWord, jaWordOfTheDay } from '../arcade/wordleJa';
import { markGuess, type LetterMark } from '../arcade/wordle';
import { shortMeaning } from '../arcade/jlpt';
import { formatLong, todayKey } from '../lib/date';
import { celebrateBig, shake } from '../lib/fx';
import { kanaFromRomaji } from '../lib/romaji';
import { sfx } from '../lib/sfx';
import { useProgress } from '../store/progress';

const MARK_CLASS: Record<LetterMark, string> = {
  hit: 'border-hit bg-hit text-on-strong',
  near: 'border-near bg-near text-on-pastel',
  miss: 'border-rule bg-tile text-ink-faint opacity-70',
};
const RANK: Record<LetterMark, number> = { miss: 0, near: 1, hit: 2 };
/** The day's guesses, kept on this device (the word is the same for everyone). */
const storeKey = (date: string) => `omnidle-wordle-ja:${date}`;
const readGuesses = (date: string): string[] => {
  try {
    const v = JSON.parse(localStorage.getItem(storeKey(date)) ?? '[]');
    return Array.isArray(v) ? v.filter((x) => typeof x === 'string') : [];
  } catch {
    return [];
  }
};

/** /wordle/japanese — 日本語 Wordle: the day's six-kana word. */
export default function JapaneseWordle() {
  const date = todayKey();
  const word = jaWordOfTheDay(date);
  const recordBest = useProgress((s) => s.recordBest);
  const addReview = useProgress((s) => s.addJlptReview);
  const [guesses, setGuesses] = useState<string[]>(() => readGuesses(date));
  // What's typed, as typed (romaji or kana): shown as kana, converted like an IME would.
  const [typed, setTyped] = useState('');
  const [note, setNote] = useState<string | null>(null);
  const field = useRef<HTMLInputElement>(null);
  const won = guesses.at(-1) === word.kana;
  const done = won || guesses.length >= JA_TRIES;
  const kana = kanaFromRomaji(typed);
  const tiles = [...kana];

  useEffect(() => {
    if (!done) field.current?.focus();
  }, [done]);

  // Best mark seen for each kana, for the list of kana tried.
  const kanaMarks = new Map<string, LetterMark>();
  for (const g of guesses) {
    markGuess(g, word.kana).forEach((m, i) => {
      const prev = kanaMarks.get(g[i]);
      if (!prev || RANK[m] > RANK[prev]) kanaMarks.set(g[i], m);
    });
  }

  const submit = () => {
    if (done) return;
    const g = kanaFromRomaji(typed, true);
    if ([...g].length !== JA_LETTERS || /[a-z]/.test(g)) {
      setNote(`Six kana: small ones (ゃ, っ…) and ー count as one each.`);
      shake(document.getElementById('wordle-ja-row'), 6, 300);
      return sfx.wrong();
    }
    if (!isJaWord(g)) {
      setNote('Not a word of the JLPT list.');
      shake(document.getElementById('wordle-ja-row'), 6, 300);
      return sfx.wrong();
    }
    const next = [...guesses, g];
    setGuesses(next);
    setTyped('');
    setNote(null);
    try {
      localStorage.setItem(storeKey(date), JSON.stringify(next));
    } catch {
      // Not kept, that's all.
    }
    if (g === word.kana) {
      sfx.streak();
      recordBest('wordle:ja', 1, { won: true });
      window.setTimeout(() => celebrateBig(), 300);
    } else if (next.length >= JA_TRIES) {
      sfx.wrong();
      recordBest('wordle:ja', 0, { won: false });
      // A missed word goes on the JLPT review list.
      addReview([word.entry.id]);
    } else sfx.click();
  };

  const rows = [...guesses, ...(done ? [] : [kana])];
  const size = 'min(3.25rem, calc((min(100vw, 36rem) - 3rem) / 6 - 0.375rem))';
  return (
    <div className="mx-auto max-w-xl space-y-5">
      <div>
        <Link to="/wordle" className="font-display text-sm font-semibold tracking-wider text-ink-soft hover:text-ink">
          ← Franchise Wordle
        </Link>
        <h1 className="text-4xl font-bold">
          🇯🇵 <span lang="ja">日本語</span> Wordle
        </h1>
        <p className="text-sm text-ink-soft">
          {formatLong(date)} · a new word every day, the same for everyone · {JA_WORDS.length} words of the JLPT list
        </p>
        <p className="mt-2 max-w-xl text-sm text-ink-soft">
          Find the word in six tries. It&apos;s six kana long: every kana is a tile, small ones too — a contracted sound like きゃ or しょ takes two,
          and so does a long vowel (とう, ー). Type in romaji (<i>kyou</i> → きょう) or in kana. Green: right kana, right place; yellow: elsewhere in the word.
        </p>
      </div>

      <div className="mx-auto grid w-fit gap-1.5">
        {rows.map((letters, row) => {
          const g = row < guesses.length ? letters : null;
          const marks = g ? markGuess(g, word.kana) : null;
          const chars = [...letters];
          return (
            <div key={row} id={g ? undefined : 'wordle-ja-row'} className="flex gap-1.5">
              {Array.from({ length: JA_LETTERS }, (_, i) => (
                <span
                  key={i}
                  lang="ja"
                  className={`grid aspect-square place-items-center rounded-md border-2 font-serif text-[clamp(1rem,5vw,1.6rem)] font-bold ${
                    marks ? `animate-pop ${MARK_CLASS[marks[i]]}` : chars[i] ? (i >= JA_LETTERS ? 'border-miss' : 'border-ink') : 'border-dashed border-rule'
                  }`}
                  style={{ width: size, ...(marks ? { animationDelay: `${i * 70}ms` } : {}) }}
                >
                  {chars[i] ?? ''}
                </span>
              ))}
            </div>
          );
        })}
        {!done &&
          Array.from({ length: JA_TRIES - rows.length }, (_, r) => (
            <div key={`e${r}`} className="flex gap-1.5 opacity-40">
              {Array.from({ length: JA_LETTERS }, (_, i) => (
                <span key={i} className="aspect-square rounded-md border-2 border-dashed border-rule" style={{ width: size }} />
              ))}
            </div>
          ))}
      </div>

      {done ? (
        <div className={`animate-pop space-y-1 rounded-md border p-5 text-center ${won ? 'border-hit/50 bg-hit/10' : 'border-miss/50 bg-miss/10'}`}>
          <p className="font-display text-sm uppercase tracking-widest text-ink-soft">{won ? `Found in ${guesses.length}` : 'Out of tries'}</p>
          {/* The word, its reading under it, and its meaning (the point is to learn it). */}
          <p lang="ja" className="font-serif text-5xl font-bold">
            {word.entry.text}
          </p>
          <p lang="ja" className="text-xl text-ink-soft">
            {word.kana}
          </p>
          <p className="text-sm text-ink-soft">
            {shortMeaning(word.entry.meaning, 6)} · {word.entry.level}
          </p>
          {!won && <p className="text-xs text-ink-faint">It&apos;s on your JLPT review list now.</p>}
          <p className="pt-2 text-sm text-ink-faint">A new word tomorrow.</p>
        </div>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
          className="space-y-2"
        >
          <div className="flex gap-2">
            <input
              ref={field}
              value={typed}
              onChange={(e) => (setTyped(e.target.value), setNote(null))}
              placeholder="Type in romaji or kana…"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              name="wordle-ja"
              className="min-w-0 flex-1 rounded-md border-2 border-rule-strong bg-card px-4 py-3 text-lg outline-none focus:border-ink"
            />
            <button type="submit" disabled={tiles.length === 0} className="btn-ink rounded-md px-5 font-display font-bold tracking-wider disabled:opacity-50">
              ↵
            </button>
          </div>
          <p className="min-h-5 text-center text-sm font-semibold text-coral">{note}</p>
        </form>
      )}

      {kanaMarks.size > 0 && (
        <div className="flex flex-wrap justify-center gap-1">
          {[...kanaMarks].map(([k, m]) => (
            <span key={k} lang="ja" className={`grid size-9 place-items-center rounded-md border font-serif text-lg font-bold ${MARK_CLASS[m]}`}>
              {k}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
