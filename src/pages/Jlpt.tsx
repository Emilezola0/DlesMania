import { useEffect, useRef, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { TimerBar } from '../boss/TimerBar';
import { FlameIcon } from '../components/Layout';
import { JLPT_LEVELS, JLPT_SOURCE, jlptDeck, nextQuestion, shortMeaning, type JlptDeck, type JlptQuestion } from '../arcade/jlpt';
import { celebrateBig, shake } from '../lib/fx';
import { sfx } from '../lib/sfx';
import { useProgress } from '../store/progress';

/** How long a right answer stays shown before the next question. */
const REVEAL_MS = 900;
/** Entries not drawn again within this many questions. */
const MEMORY = 40;
/** Seconds per question: 12 at first, a fifth of a second less each right answer, down to 4. */
const secondsFor = (streak: number) => Math.max(4, 12 - streak * 0.2);

function Game({ deck }: { deck: JlptDeck }) {
  const key = `jlpt:${deck.id}`;
  const best = useProgress((s) => s.bests[key] ?? 0);
  const recordBest = useProgress((s) => s.recordBest);
  const recent = useRef<string[]>([]);
  const draw = () => {
    const q = nextQuestion(deck, new Set(recent.current));
    recent.current = [q.entry.id, ...recent.current].slice(0, MEMORY);
    return q;
  };
  const [q, setQ] = useState<JlptQuestion>(() => draw());
  const [picked, setPicked] = useState<string | null>(null);
  const [score, setScore] = useState(0);
  const [state, setState] = useState<'guess' | 'right' | 'wrong'>('guess');
  const arena = useRef<HTMLDivElement>(null);

  const fail = (choice: string | null) => {
    sfx.wrong();
    shake(arena.current, 10, 420);
    setPicked(choice);
    setState('wrong');
    if (score > best) window.setTimeout(() => (sfx.streak(), celebrateBig()), 500);
    recordBest(key, score, { reached: score / 2 });
  };
  const answer = (choice: string) => {
    if (state !== 'guess') return;
    if (choice !== q.answer) return fail(choice);
    sfx.correct();
    setPicked(choice);
    setState('right');
    setScore(score + 1);
    window.setTimeout(() => {
      setQ(draw());
      setPicked(null);
      setState('guess');
    }, REVEAL_MS);
  };
  const restart = () => {
    sfx.click();
    setQ(draw());
    setPicked(null);
    setScore(0);
    setState('guess');
  };

  // 1–4 on the keyboard pick an answer.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const i = Number(e.key) - 1;
      if (i >= 0 && i < q.options.length) answer(q.options[i]);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const tone = (o: string) => {
    if (state === 'guess') return 'btn-paper';
    if (o === q.answer) return 'border-hit bg-hit/20';
    if (o === picked) return 'border-miss bg-miss/20';
    return 'btn-paper opacity-60';
  };

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between">
        <p className="font-serif text-lg italic text-ink-soft">{q.ask === 'meaning' ? 'What does it mean?' : 'How is it read?'}</p>
        <p className="font-display text-sm text-ink-soft">
          Streak <span className="font-serif text-2xl font-bold text-ink">{score}</span> · best {Math.max(best, state === 'wrong' ? score : 0)}
        </p>
      </div>
      <TimerBar total={secondsFor(score) * 1000} running={state === 'guess'} resetKey={`${score}:${q.entry.id}:${state === 'wrong'}`} onExpire={() => state === 'guess' && fail(null)} />
      <div ref={arena} className="page flex flex-col items-center gap-2 rounded-md p-6 text-center sm:p-8">
        <p key={q.entry.id} lang="ja" className="animate-round-in font-serif text-6xl font-bold leading-tight sm:text-7xl">
          {q.entry.text}
        </p>
        {/* The reading shows, except when it's the question. */}
        <p lang="ja" className={`min-h-7 text-lg text-ink-soft ${state === 'guess' && q.ask === 'reading' ? 'invisible' : ''}`}>
          {q.entry.reading !== q.entry.text && q.entry.reading}
        </p>
        {state !== 'guess' && <p className="animate-pop text-sm text-ink-faint">{shortMeaning(q.entry.meaning, 6)}</p>}
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
      {state === 'wrong' && (
        <div className="animate-pop space-y-3 rounded-md border border-miss/50 bg-miss/10 p-5 text-center">
          <p className="font-display text-sm uppercase tracking-widest text-ink-soft">{picked ? 'Streak over' : "Time's up"}</p>
          <p className="font-serif text-5xl font-bold">{score}</p>
          {score > best ? <p className="font-display text-sm font-bold text-ochre">★ New best</p> : <p className="text-sm text-ink-soft">Best: {best}</p>}
          <button type="button" onClick={restart} className="btn-ink rounded-md px-6 py-3 font-display font-bold tracking-wider">
            Play again
          </button>
        </div>
      )}
    </div>
  );
}

/** /jlpt and /jlpt/:deck */
export default function Jlpt() {
  const { deck: id } = useParams();
  const bests = useProgress((s) => s.bests);
  const [grammar, setGrammar] = useState<string | null>(null);
  if (id) {
    const deck = jlptDeck(id);
    if (!deck) return <Navigate to="/jlpt" replace />;
    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <div>
          <Link to="/jlpt" className="font-display text-sm font-semibold tracking-wider text-ink-soft hover:text-ink">
            ← JLPT
          </Link>
          <h1 className="text-4xl font-bold">{deck.label}</h1>
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
      {JLPT_LEVELS.map((l) => (
        <section key={l.level} className="space-y-3">
          <h2 className="font-display text-sm uppercase tracking-[0.25em] text-ink-faint">{l.level}</h2>
          <ul className="grid gap-4 sm:grid-cols-3">
            {l.decks.map((d) => (
              <li key={d.id}>
                <Link to={`/jlpt/${d.id}`} className="page flex h-full flex-col gap-1 rounded-md p-5 ring-2 ring-accent/40 transition hover:-translate-y-0.5">
                  <span lang="ja" className="font-serif text-3xl font-bold">
                    {d.kind === 'vocab' ? '語' : '字'}
                  </span>
                  <span className="font-display text-xl font-bold">{d.kind === 'vocab' ? 'Vocabulary' : 'Kanji'}</span>
                  <span className="mt-auto flex items-center justify-between pt-3 text-xs text-ink-faint">
                    {d.entries.length.toLocaleString('en')} {d.kind === 'vocab' ? 'words' : 'kanji'}
                    {(bests[`jlpt:${d.id}`] ?? 0) > 0 && (
                      <span className="inline-flex items-center gap-1 font-bold text-coral">
                        <FlameIcon /> best {bests[`jlpt:${d.id}`]}
                      </span>
                    )}
                  </span>
                </Link>
              </li>
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
