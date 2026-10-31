import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { JA_LENGTHS, JA_TRIES, JA_WORDS, isJaWord, jaWord, jaWordOfTheDay, type JaWord } from '../arcade/wordleJa';
import { Customise, useCustomPicks } from '../components/Customise';
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
/** The day's guesses, kept on this device (the word is the same for everyone), by its word. */
const storeKey = (date: string, kana: string) => `omnidle-wordle-ja:${date}:${kana}`;
const readGuesses = (date: string, kana: string): string[] => {
  try {
    const v = JSON.parse(localStorage.getItem(storeKey(date, kana)) ?? '[]');
    return Array.isArray(v) ? v.filter((x) => typeof x === 'string') : [];
  } catch {
    return [];
  }
};

/** /wordle/japanese — 日本語 Wordle: the day's word, any word of the JLPT list. */
export default function JapaneseWordle() {
  const date = todayKey();
  // Customise: the lengths the word can have (every length by default — the same word for everyone).
  const { picks, setPicks, custom } = useCustomPicks('omnidle-custom-wordle-ja', LENGTH_OPTIONS);
  const word = jaWordOfTheDay(date, picks.map(Number));
  return (
    <JaGame key={word.kana} date={date} word={word} custom={custom}>
      <Customise options={LENGTH_OPTIONS} picks={picks} onChange={setPicks} noun="length" />
    </JaGame>
  );
}

/** Customise's choices: each length a word can have. */
const LENGTH_OPTIONS = JA_LENGTHS.map((n) => ({ key: String(n), label: `${n} kana`, hint: `${JA_WORDS.filter((w) => [...w.kana].length === n).length} words` }));

function JaGame({ date, word, custom, children }: { date: string; word: JaWord; custom: boolean; children: React.ReactNode }) {
  const recordBest = useProgress((s) => s.recordBest);
  const addReview = useProgress((s) => s.addJlptReview);
  const [guesses, setGuesses] = useState<string[]>(() => readGuesses(date, word.kana));
  // What's typed, as typed (romaji or kana): shown as kana, converted like an IME would.
  const [typed, setTyped] = useState('');
  const [note, setNote] = useState<string | null>(null);
  const field = useRef<HTMLInputElement>(null);
  const won = guesses.at(-1) === word.kana;
  /** The day's word's length: as many tiles, and every guess as long. */
  const wordLen = [...word.kana].length;
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
    if ([...g].length !== wordLen || /[a-z]/.test(g)) {
      setNote(`${wordLen} kana: small ones (ゃ, っ…) and ー count as one each.`);
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
      localStorage.setItem(storeKey(date, word.kana), JSON.stringify(next));
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
  const size = `min(3.25rem, calc((min(100vw, 36rem) - 3rem) / ${Math.max(5, wordLen)} - 0.375rem))`;
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
          {formatLong(date)} · a new word every day, the same for everyone{custom ? ' who picks the same lengths' : ''} · {JA_WORDS.length} words of the JLPT list
        </p>
        <p className="mt-2 max-w-xl text-sm text-ink-soft">
          Find the word in six tries — today it&apos;s {wordLen} kana long. Every kana is a tile, small ones too: a contracted sound like きゃ or しょ takes two,
          and so does a long vowel (とう, ー). Type in romaji (<i>kyou</i> → きょう) or in kana. Green: right kana, right place; yellow: elsewhere in the word.
        </p>
        <div className="mt-3">{children}</div>
      </div>

      <div className="mx-auto grid w-fit gap-1.5">
        {rows.map((letters, row) => {
          const g = row < guesses.length ? letters : null;
          const marks = g ? markGuess(g, word.kana) : null;
          const chars = [...letters];
          return (
            <div key={row} id={g ? undefined : 'wordle-ja-row'} className="relative flex gap-1.5">
              {/* A word tried: what it means, small, to its left. */}
              {g && (
                <span className="absolute right-full top-1/2 mr-2 line-clamp-2 w-[min(7rem,calc((100vw-100%)/2-1.25rem))] -translate-y-1/2 text-right text-[11px] leading-tight text-ink-faint">
                  {shortMeaning(jaWord(g)?.entry.meaning ?? '', 2)}
                </span>
              )}
              {Array.from({ length: wordLen }, (_, i) => (
                <span
                  key={i}
                  lang="ja"
                  className={`grid aspect-square place-items-center rounded-md border-2 font-serif text-[clamp(1rem,5vw,1.6rem)] font-bold ${
                    marks ? `animate-pop ${MARK_CLASS[marks[i]]}` : chars[i] ? (i >= wordLen ? 'border-miss' : 'border-ink') : 'border-dashed border-rule'
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
              {Array.from({ length: wordLen }, (_, i) => (
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
