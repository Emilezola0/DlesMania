import { useEffect, useRef, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { TimerBar } from '../boss/TimerBar';
import { FlameIcon } from '../components/Layout';
import { JLPT_LEVELS, JLPT_SOURCE, JLPT_THEMES, jlptDeck, jlptEntry, kanjiOfWord, nextQuestion, ofTheDay, reviewDeck, shortMeaning, type JlptDeck, type JlptEntry, type JlptQuestion } from '../arcade/jlpt';
import { addDays, formatLong, todayKey } from '../lib/date';
import { NAME_LISTS } from '../arcade/lists';
import { Customise, useCustomPicks } from '../components/Customise';
import { celebrateBig, shake } from '../lib/fx';
import { sfx } from '../lib/sfx';
import { JLPT_LEARNED, useProgress } from '../store/progress';

/** How long a right answer stays shown before the next question. */
const REVEAL_MS = 900;
/** Entries not drawn again within this many questions (fewer in a short review list). */
const MEMORY = 40;
/** Seconds per question: 12 at first, a fifth of a second less each right answer, down to 4. */
const secondsFor = (streak: number) => Math.max(4, 12 - streak * 0.2);

/** The star that puts a word on the review list, or takes it off. */
function KeepButton({ id }: { id: string }) {
  const kept = useProgress((s) => id in s.jlptReview);
  const add = useProgress((s) => s.addJlptReview);
  const remove = useProgress((s) => s.removeJlptReview);
  return (
    <button
      type="button"
      onClick={() => (kept ? remove(id) : add([id]))}
      aria-pressed={kept}
      className={`rounded-full border px-3 py-1 font-display text-xs font-bold transition ${kept ? 'border-ochre bg-ochre/15 text-ochre' : 'border-rule-strong text-ink-soft hover:text-ink'}`}
    >
      {kept ? '★ In my review list' : '☆ Add to my review list'}
    </button>
  );
}

/**
 * One deck's quiz. A level or theme deck is a streak with a clock, over at the first mistake; every miss
 * goes on the review list. The review deck has no clock and goes on after a miss: a right answer counts
 * towards learning the word (JLPT_LEARNED in a row and it leaves the list), a wrong one starts it over.
 */
function Game({ deck }: { deck: JlptDeck }) {
  const review = deck.kind === 'review';
  const key = `jlpt:${deck.id}`;
  const best = useProgress((s) => s.bests[key] ?? 0);
  const recordBest = useProgress((s) => s.recordBest);
  const addReview = useProgress((s) => s.addJlptReview);
  const reviewJlpt = useProgress((s) => s.reviewJlpt);
  const list = useProgress((s) => s.jlptReview);
  const recent = useRef<string[]>([]);
  const draw = () => {
    // The review list as it is now: learned words have left it.
    const d = review ? reviewDeck(Object.keys(useProgress.getState().jlptReview)) : deck;
    if (!d.entries.length) return null;
    const q = nextQuestion(d, new Set(recent.current));
    recent.current = [q.entry.id, ...recent.current].slice(0, Math.min(MEMORY, Math.floor(d.entries.length / 2)));
    return q;
  };
  const [q, setQ] = useState<JlptQuestion | null>(() => draw());
  const [picked, setPicked] = useState<string | null>(null);
  const [score, setScore] = useState(0);
  const [missed, setMissed] = useState(0);
  const [state, setState] = useState<'guess' | 'right' | 'wrong'>('guess');
  const arena = useRef<HTMLDivElement>(null);

  const next = () => {
    setQ(draw());
    setPicked(null);
    setState('guess');
  };
  const fail = (choice: string | null) => {
    if (!q) return;
    sfx.wrong();
    shake(arena.current, 10, 420);
    setPicked(choice);
    setState('wrong');
    if (review) {
      reviewJlpt(q.entry.id, false);
      setMissed((m) => m + 1);
      return;
    }
    addReview([q.entry.id]);
    if (score > best) window.setTimeout(() => (sfx.streak(), celebrateBig()), 500);
    recordBest(key, score, { reached: score / 2 });
  };
  const answer = (choice: string) => {
    if (!q || state !== 'guess') return;
    if (choice !== q.answer) return fail(choice);
    sfx.correct();
    setPicked(choice);
    setState('right');
    setScore(score + 1);
    if (review) reviewJlpt(q.entry.id, true);
    window.setTimeout(next, REVEAL_MS);
  };
  const restart = () => {
    sfx.click();
    setScore(0);
    setMissed(0);
    next();
  };

  // 1–4 on the keyboard pick an answer; Enter goes on after a miss in Review.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!q) return;
      if (review && state === 'wrong' && e.key === 'Enter') return next();
      const i = Number(e.key) - 1;
      if (i >= 0 && i < q.options.length) answer(q.options[i]);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  if (!q) {
    return (
      <div className="page space-y-3 rounded-md p-8 text-center">
        <p className="font-serif text-5xl">🎉</p>
        <p className="font-display text-xl font-bold">{score ? 'Your review list is empty — every word learned!' : 'Your review list is empty.'}</p>
        <p className="text-sm text-ink-soft">The words you miss in the other decks land here, and so do the ones you star.</p>
        <Link to="/jlpt" className="btn-ink inline-block rounded-md px-6 py-3 font-display font-bold tracking-wider">
          Back to the decks
        </Link>
      </div>
    );
  }

  const tone = (o: string) => {
    if (state === 'guess') return 'btn-paper';
    if (o === q.answer) return 'border-hit bg-hit/20';
    if (o === picked) return 'border-miss bg-miss/20';
    return 'btn-paper opacity-60';
  };
  const left = Object.keys(list).length;
  const learning = list[q.entry.id] ?? 0;

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between">
        <p className="font-serif text-lg italic text-ink-soft">{q.ask === 'meaning' ? 'What does it mean?' : 'How is it read?'}</p>
        {review ? (
          <p className="font-display text-sm text-ink-soft">
            ✓ <span className="font-serif text-2xl font-bold text-ink">{score}</span> · ✗ {missed} · {left} to learn
          </p>
        ) : (
          <p className="font-display text-sm text-ink-soft">
            Streak <span className="font-serif text-2xl font-bold text-ink">{score}</span> · best {Math.max(best, state === 'wrong' ? score : 0)}
          </p>
        )}
      </div>
      {!review && (
        <TimerBar total={secondsFor(score) * 1000} running={state === 'guess'} resetKey={`${score}:${q.entry.id}:${state === 'wrong'}`} onExpire={() => state === 'guess' && fail(null)} />
      )}
      <div ref={arena} className="page relative flex flex-col items-center gap-2 rounded-md p-6 text-center sm:p-8">
        {deck.level === 'All' && <span className="absolute left-3 top-3 rounded-full border border-rule-strong px-2 py-0.5 font-display text-xs text-ink-faint">{q.entry.level}</span>}
        {review && (
          <span className="absolute right-3 top-3 font-display text-xs text-ink-faint" title={`${JLPT_LEARNED} right in a row and it's learned`}>
            {'●'.repeat(learning)}
            {'○'.repeat(Math.max(0, JLPT_LEARNED - learning))}
          </span>
        )}
        <p key={q.entry.id} lang="ja" className="animate-round-in font-serif text-6xl font-bold leading-tight sm:text-7xl">
          {q.entry.text}
        </p>
        {/* The reading shows, except when it's the question. */}
        <p lang="ja" className={`min-h-7 text-lg text-ink-soft ${state === 'guess' && q.ask === 'reading' ? 'invisible' : ''}`}>
          {q.entry.reading !== q.entry.text && q.entry.reading}
        </p>
        {state !== 'guess' && <p className="animate-pop text-sm text-ink-faint">{shortMeaning(q.entry.meaning, 6)}</p>}
        <KeepButton id={q.entry.id} />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {q.options.map((o, i) => (
          <button
            key={o}
            type="button"
            lang={q.ask === 'reading' ? 'ja' : undefined}
            disabled={state !== 'guess'}
            onClick={() => answer(o)}
            className={`flex items-center gap-3 rounded-md border px-4 py-3 text-left font-display font-semibold ${tone(o)}`}
          >
            <span className="text-xs text-ink-faint">{i + 1}</span>
            <span className={q.ask === 'reading' ? 'text-xl' : ''}>{o}</span>
          </button>
        ))}
      </div>
      {state === 'wrong' &&
        (review ? (
          <div className="animate-pop flex items-center justify-between gap-3 rounded-md border border-miss/50 bg-miss/10 p-4">
            <p className="text-sm text-ink-soft">Not this time — it stays on your list, and starts over.</p>
            <button type="button" onClick={next} className="btn-ink rounded-md px-5 py-2 font-display font-bold tracking-wider">
              Next ↵
            </button>
          </div>
        ) : (
          <div className="animate-pop space-y-3 rounded-md border border-miss/50 bg-miss/10 p-5 text-center">
            <p className="font-display text-sm uppercase tracking-widest text-ink-soft">{picked ? 'Streak over' : "Time's up"}</p>
            <p className="font-serif text-5xl font-bold">{score}</p>
            {score > best ? <p className="font-display text-sm font-bold text-ochre">★ New best</p> : <p className="text-sm text-ink-soft">Best: {best}</p>}
            <p className="text-xs text-ink-faint">{q.entry.text} is now on your review list.</p>
            <button type="button" onClick={restart} className="btn-ink rounded-md px-6 py-3 font-display font-bold tracking-wider">
              Play again
            </button>
          </div>
        ))}
    </div>
  );
}

/** The review list: every word kept, to look over or take off. */
function ReviewList() {
  const list = useProgress((s) => s.jlptReview);
  const remove = useProgress((s) => s.removeJlptReview);
  const [open, setOpen] = useState(false);
  const ids = Object.keys(list).filter((id) => jlptEntry(id));
  return (
    <section className="page space-y-4 rounded-md p-5 ring-2 ring-ochre/50">
      <div className="flex flex-wrap items-center gap-4">
        <span className="text-4xl">🔁</span>
        <div className="min-w-0 flex-1">
          <p className="font-display text-xl font-bold">My review list</p>
          <p className="text-sm text-ink-soft">
            {ids.length
              ? `${ids.length} word${ids.length === 1 ? '' : 's'} that give you trouble. Get one right ${JLPT_LEARNED} times in a row in Review and it's learned.`
              : 'Empty for now: the words you miss land here, and so do the ones you star (☆) while playing.'}
          </p>
        </div>
        {ids.length > 0 && (
          <>
            <button type="button" onClick={() => setOpen(!open)} className="btn-paper rounded-md px-4 py-2 font-display text-sm font-bold">
              {open ? 'Hide the list' : 'See the list'}
            </button>
            <Link to="/jlpt/review" className="btn-accent rounded-md px-5 py-2 font-display font-bold tracking-wider">
              Review
            </Link>
          </>
        )}
      </div>
      {open && (
        <ul className="grid gap-2 sm:grid-cols-2">
          {ids.map((id) => {
            const e = jlptEntry(id)!;
            return (
              <li key={id} className="flex items-center gap-3 rounded-md border border-rule px-3 py-2">
                <span lang="ja" className="font-serif text-2xl font-bold">
                  {e.text}
                </span>
                <span className="min-w-0 flex-1 text-sm">
                  <span lang="ja" className="block text-ink-soft">
                    {e.reading !== e.text && e.reading} <span className="text-xs text-ink-faint">· {e.level}</span>
                  </span>
                  <span className="block truncate text-ink-faint">{shortMeaning(e.meaning)}</span>
                </span>
                <span className="font-display text-xs text-ink-faint">
                  {'●'.repeat(list[id])}
                  {'○'.repeat(Math.max(0, JLPT_LEARNED - list[id]))}
                </span>
                <button type="button" onClick={() => remove(id)} aria-label={`Take ${e.text} off the list`} className="px-1 text-ink-faint hover:text-miss">
                  ✕
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function DeckCard({ deck, glyph, title }: { deck: JlptDeck; glyph: string; title: string }) {
  const best = useProgress((s) => s.bests[`jlpt:${deck.id}`] ?? 0);
  return (
    <li>
      <Link to={`/jlpt/${deck.id}`} className="page flex h-full flex-col gap-1 rounded-md p-5 ring-2 ring-accent/40 transition hover:-translate-y-0.5">
        <span lang="ja" className="font-serif text-3xl font-bold">
          {glyph}
        </span>
        <span className="font-display text-xl font-bold">{title}</span>
        <span className="mt-auto flex items-center justify-between pt-3 text-xs text-ink-faint">
          {deck.entries.length.toLocaleString('en')} {deck.kind === 'kanji' ? 'kanji' : 'words'}
          {best > 0 && (
            <span className="inline-flex items-center gap-1 font-bold text-coral">
              <FlameIcon /> best {best}
            </span>
          )}
        </span>
      </Link>
    </li>
  );
}

/** A kanji's readings as the list gives them, split: on'yomi in katakana, kun'yomi in hiragana. */
function readingsOf(reading: string) {
  const parts = reading.split(/[・、\s]+/).filter(Boolean);
  return { on: parts.filter((p) => /^[\u30a0-\u30ff]/.test(p)), kun: parts.filter((p) => !/^[\u30a0-\u30ff]/.test(p)) };
}

function DayCard({ kind, entry }: { kind: 'word' | 'kanji'; entry: JlptEntry }) {
  const r = readingsOf(entry.reading);
  return (
    <div className="page flex flex-col items-center gap-2 rounded-md p-6 text-center ring-2 ring-coral/50">
      <p className="font-display text-xs uppercase tracking-[0.25em] text-coral">{kind === 'word' ? 'Word of the day' : 'Kanji of the day'}</p>
      <p lang="ja" className="font-serif text-6xl font-bold leading-tight">
        {entry.text}
      </p>
      {kind === 'word' ? (
        <p lang="ja" className="text-xl text-ink-soft">
          {entry.reading}
        </p>
      ) : (
        <div lang="ja" className="space-y-0.5 text-ink-soft">
          {r.on.length > 0 && (
            <p>
              <span className="font-display text-xs text-ink-faint">On </span>
              {r.on.join('・')}
            </p>
          )}
          {r.kun.length > 0 && (
            <p>
              <span className="font-display text-xs text-ink-faint">Kun </span>
              {r.kun.join('・')}
            </p>
          )}
        </div>
      )}
      <p className="font-display text-lg font-semibold">{shortMeaning(entry.meaning, 5)}</p>
      <p className="text-xs text-ink-faint">JLPT {entry.level}</p>
      {/* A word written with kanji: what each of them means (the ones the list has). */}
      {kind === 'word' && kanjiOfWord(entry.text).length > 0 && (
        <ul className="mt-1 w-full space-y-1 border-t border-rule pt-2 text-left text-sm">
          {kanjiOfWord(entry.text).map((k) => (
            <li key={k.id} className="flex items-baseline gap-3">
              <span lang="ja" className="font-serif text-2xl font-bold">
                {k.text}
              </span>
              <span className="min-w-0 flex-1">
                <span className="font-semibold">{shortMeaning(k.meaning, 3)}</span>
                <span lang="ja" className="block text-xs text-ink-faint">
                  {k.reading} · {k.level}
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}
      <KeepButton id={entry.id} />
    </div>
  );
}

/**
 * The word and the kanji of the day (not a daily to play: something new to learn each day), with the
 * days before to look back on.
 */
function OfTheDay() {
  const today = todayKey();
  const [date, setDate] = useState(today);
  const { word, kanji } = ofTheDay(date);
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-display text-sm uppercase tracking-[0.25em] text-ink-faint">{date === today ? 'Today' : formatLong(date)}</h2>
        <div className="flex gap-2">
          <button type="button" onClick={() => setDate(addDays(date, -1))} className="btn-paper rounded-md px-3 py-1 font-display text-sm font-bold" aria-label="The day before">
            ←
          </button>
          <button type="button" disabled={date >= today} onClick={() => setDate(addDays(date, 1))} className="btn-paper rounded-md px-3 py-1 font-display text-sm font-bold disabled:opacity-40" aria-label="The day after">
            →
          </button>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <DayCard kind="word" entry={word} />
        <DayCard kind="kanji" entry={kanji} />
      </div>
    </section>
  );
}

const PAGE = 120;

/** /jlpt/list/:level — everything the list has for one level: its kanji, its words and its grammar. */
function LevelList({ level }: { level: string }) {
  const l = JLPT_LEVELS.find((x) => x.level === level)!;
  const [tab, setTab] = useState<'kanji' | 'vocab' | 'grammar'>('kanji');
  const [query, setQuery] = useState('');
  const [shown, setShown] = useState(PAGE);
  const q = query.trim().toLowerCase();
  const entries = tab === 'grammar' ? [] : l.decks.find((d) => d.kind === tab)!.entries.filter((e) => !q || e.text.includes(q) || e.reading.includes(q) || e.meaning.toLowerCase().includes(q));
  const grammar = tab === 'grammar' ? l.grammar.filter((g) => !q || g.includes(q)) : [];
  const count = tab === 'grammar' ? grammar.length : entries.length;
  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div>
        <Link to="/jlpt" className="font-display text-sm font-semibold tracking-wider text-ink-soft hover:text-ink">
          ← JLPT
        </Link>
        <h1 className="text-4xl font-bold">{level} — everything on the list</h1>
        <p className="text-sm text-ink-soft">
          {l.decks[1].entries.length} kanji · {l.decks[0].entries.length.toLocaleString('en')} words · {l.grammar.length} grammar points
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {JLPT_LEVELS.map((x) => (
          <Link key={x.level} to={`/jlpt/list/${x.level.toLowerCase()}`} className={`rounded-full px-3 py-1 font-display text-sm font-bold ${x.level === level ? 'btn-ink' : 'btn-paper'}`}>
            {x.level}
          </Link>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {(['kanji', 'vocab', 'grammar'] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => (setTab(t), setShown(PAGE))}
            className={`rounded-md px-4 py-2 font-display text-sm font-bold ${tab === t ? 'btn-accent' : 'btn-paper'}`}
          >
            {t === 'kanji' ? 'Kanji' : t === 'vocab' ? 'Vocabulary' : 'Grammar'}
          </button>
        ))}
        <input
          value={query}
          onChange={(e) => (setQuery(e.target.value), setShown(PAGE))}
          placeholder="Search (kanji, kana or English)…"
          className="min-w-0 flex-1 rounded-md border border-rule-strong bg-card px-3 py-2"
        />
      </div>
      <p className="text-xs text-ink-faint">{count.toLocaleString('en')} shown</p>
      {tab === 'grammar' ? (
        <ul lang="ja" className="grid gap-2 sm:grid-cols-2">
          {grammar.map((g) => (
            <li key={g} className="page rounded-md px-4 py-2 text-lg">
              {g}
            </li>
          ))}
        </ul>
      ) : (
        <>
          <ul className="space-y-2">
            {entries.slice(0, shown).map((e) => {
              const r = readingsOf(e.reading);
              return (
                <li key={e.id} className="page flex items-center gap-4 rounded-md px-4 py-2">
                  <span lang="ja" className={`font-serif font-bold ${tab === 'kanji' ? 'w-14 text-4xl' : 'min-w-24 text-2xl'}`}>
                    {e.text}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span lang="ja" className="block text-ink-soft">
                      {tab === 'kanji' ? [r.on.join('・'), r.kun.join('・')].filter(Boolean).join(' · ') : e.reading !== e.text && e.reading}
                    </span>
                    <span className="block text-sm">{e.meaning}</span>
                  </span>
                  <KeepButton id={e.id} />
                </li>
              );
            })}
          </ul>
          {shown < entries.length && (
            <button type="button" onClick={() => setShown(shown + PAGE)} className="btn-paper w-full rounded-md py-2 font-display font-bold">
              Show more ({(entries.length - shown).toLocaleString('en')} left)
            </button>
          )}
        </>
      )}
      <p className="text-xs text-ink-faint">From {JLPT_SOURCE}.</p>
    </div>
  );
}

/** Name Them All, in Japanese: every word of a theme against the clock (src/arcade/lists.ts). */
function NameThemAllRow() {
  const bests = useProgress((s) => s.bests);
  const lists = NAME_LISTS.filter((l) => l.franchise === 'JLPT');
  return (
    <section className="space-y-3">
      <h2 className="font-display text-sm uppercase tracking-[0.25em] text-ink-faint">Name them all · in Japanese</h2>
      <p className="max-w-xl text-sm text-ink-soft">Name as many words of a theme as you can before the clock runs out — in romaji (inu), in kana (いぬ) or in kanji (犬).</p>
      <ul className="flex flex-wrap gap-2">
        {lists.map((l) => (
          <li key={l.id}>
            <Link to={`/name-them-all/${l.id}`} className="btn-paper inline-flex items-center gap-2 rounded-full px-4 py-2 font-display text-sm font-bold">
              {l.title.replace(' in Japanese', '')}
              <span className="text-xs font-normal text-ink-faint">
                {bests[`ntl:${l.id}`] ? `${bests[`ntl:${l.id}`]}/` : ''}
                {l.answers.length}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** "Your deck" (Customise): the levels and kinds picked, mixed. */
const JLPT_OPTIONS = [
  ...JLPT_LEVELS.map((l) => ({ key: l.level, label: l.level, group: 'Levels' })),
  { key: 'vocab', label: '語 Words', group: 'Kinds' },
  { key: 'kanji', label: '字 Kanji', group: 'Kinds' },
];
function customDeck(picks: string[]): JlptDeck | undefined {
  const entries = JLPT_LEVELS.filter((l) => picks.includes(l.level)).flatMap((l) => l.decks.filter((d) => picks.includes(d.kind)).flatMap((d) => d.entries));
  return entries.length ? { id: 'custom', level: 'All', kind: 'theme', label: 'Your deck', icon: '🎛', entries } : undefined;
}

/** /jlpt and /jlpt/:deck ("review": the review list) */
export default function Jlpt() {
  const { deck: id, level } = useParams();
  const { picks, setPicks } = useCustomPicks('omnidle-custom-jlpt', JLPT_OPTIONS);
  const [grammar, setGrammar] = useState<string | null>(null);
  if (level) {
    const l = JLPT_LEVELS.find((x) => x.level.toLowerCase() === level.toLowerCase());
    return l ? <LevelList key={l.level} level={l.level} /> : <Navigate to="/jlpt" replace />;
  }
  if (id) {
    const deck = id === 'review' ? reviewDeck([]) : id === 'custom' ? customDeck(picks) : jlptDeck(id);
    if (!deck) return <Navigate to="/jlpt" replace />;
    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <div>
          <Link to="/jlpt" className="font-display text-sm font-semibold tracking-wider text-ink-soft hover:text-ink">
            ← JLPT
          </Link>
          <h1 className="text-4xl font-bold">
            {deck.icon && `${deck.icon} `}
            {deck.label}
          </h1>
          {deck.kind === 'review' && <p className="text-sm text-ink-soft">No clock, and a miss doesn&apos;t end it. {JLPT_LEARNED} right in a row and a word is learned.</p>}
        </div>
        <Game key={deck.id} deck={deck} />
      </div>
    );
  }
  return (
    <div className="space-y-8">
      <div>
        <Link to="/games" className="font-display text-sm font-semibold tracking-wider text-ink-soft hover:text-ink">
          ← Games
        </Link>
        <h1 className="text-5xl font-bold">JLPT</h1>
        <p className="max-w-xl text-ink-soft">
          Japanese from N5 to N1: a word or a kanji, four answers — its meaning or its reading. Faster and faster, until the first mistake. Keys 1–4 answer.
        </p>
      </div>
      <OfTheDay />
      <section className="space-y-3">
        <h2 className="font-display text-sm uppercase tracking-[0.25em] text-ink-faint">The list, level by level</h2>
        <ul className="flex flex-wrap gap-2">
          {JLPT_LEVELS.map((l) => (
            <li key={l.level}>
              <Link to={`/jlpt/list/${l.level.toLowerCase()}`} className="btn-paper inline-flex items-center gap-2 rounded-full px-4 py-2 font-display text-sm font-bold">
                📖 {l.level}
                <span className="text-xs font-normal text-ink-faint">
                  {l.decks[1].entries.length} kanji · {l.decks[0].entries.length} words · {l.grammar.length} grammar
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
      <section className="space-y-3">
        <h2 className="font-display text-sm uppercase tracking-[0.25em] text-ink-faint">Your deck</h2>
        <Customise options={JLPT_OPTIONS} picks={picks} onChange={setPicks} noun="filter" problem={(customDeck(picks)?.entries.length ?? 0) < 8 ? 'Pick at least one level and one kind (words or kanji).' : null} />
        {(customDeck(picks)?.entries.length ?? 0) >= 8 && (
          <ul className="grid gap-4 sm:grid-cols-3">
            <DeckCard deck={customDeck(picks)!} glyph="🎛" title="Your deck" />
          </ul>
        )}
      </section>
      <ReviewList />
      <section className="space-y-3">
        <h2 className="font-display text-sm uppercase tracking-[0.25em] text-ink-faint">Themes · every level</h2>
        <ul className="grid gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {JLPT_THEMES.map((d) => (
            <DeckCard key={d.id} deck={d} glyph={d.icon!} title={d.label} />
          ))}
        </ul>
      </section>
      <NameThemAllRow />
      {JLPT_LEVELS.map((l) => (
        <section key={l.level} className="space-y-3">
          <h2 className="font-display text-sm uppercase tracking-[0.25em] text-ink-faint">{l.level}</h2>
          <ul className="grid gap-4 sm:grid-cols-3">
            {l.decks.map((d) => (
              <DeckCard key={d.id} deck={d} glyph={d.kind === 'vocab' ? '語' : '字'} title={d.kind === 'vocab' ? 'Vocabulary' : 'Kanji'} />
            ))}
            <li>
              <button
                type="button"
                onClick={() => setGrammar(grammar === l.level ? null : l.level)}
                className="page flex h-full w-full flex-col gap-1 rounded-md p-5 text-left ring-2 ring-rule-strong/40 transition hover:-translate-y-0.5"
              >
                <span lang="ja" className="font-serif text-3xl font-bold">
                  文
                </span>
                <span className="font-display text-xl font-bold">Grammar</span>
                <span className="mt-auto pt-3 text-xs text-ink-faint">
                  {l.grammar.length} points · {grammar === l.level ? 'hide' : 'show the list'}
                </span>
              </button>
            </li>
          </ul>
          {grammar === l.level && (
            <ul lang="ja" className="page animate-pop flex flex-wrap gap-2 rounded-md p-4">
              {l.grammar.map((g) => (
                <li key={g} className="rounded-full border border-rule-strong px-3 py-1 text-sm">
                  {g}
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}
      <p className="text-xs text-ink-faint">Lists: {JLPT_SOURCE}.</p>
    </div>
  );
}
