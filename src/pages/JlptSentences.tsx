import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { TimerBar } from '../boss/TimerBar';
import { JLPT_LEVELS, jlptEntry, shortMeaning } from '../arcade/jlpt';
import { audioUrl, nextSentence, pieces, sentencesOf, tatoebaUrl, wordsIn, type JlptSentence, type SentenceQuestion } from '../arcade/jlptSentences';
import { KeepButton } from '../components/JlptKeep';
import { GrammarNote } from '../components/JlptGrammarNote';
import { celebrateBig, shake } from '../lib/fx';
import { sfx } from '../lib/sfx';
import { useProgress } from '../store/progress';

/** Seconds per sentence: 30 at first, half a second less each right answer, down to 15. */
const secondsFor = (streak: number) => Math.max(15, 30 - streak * 0.5);
/** Sentences not drawn again within this many. */
const MEMORY = 60;
const LEVEL_RANK = Object.fromEntries(JLPT_LEVELS.map((l, i) => [l.level, i]));
/** Each kanji's level in the list. */
const KANJI_LEVEL = (() => {
  const m = new Map<string, string>();
  for (const l of JLPT_LEVELS) for (const e of l.decks[1].entries) if (!m.has(e.text)) m.set(e.text, l.level);
  return m;
})();

/** Plays a sentence's recording (the effects' volume; a tap on the button is never silent). */
function useRecording() {
  const current = useRef<HTMLAudioElement | null>(null);
  useEffect(() => () => current.current?.pause(), []);
  return (s: JlptSentence, asked: boolean) => {
    if (!s.audio) return;
    const level = useProgress.getState().sfxVolume / 100;
    if (!asked && level <= 0) return;
    current.current?.pause();
    const a = new Audio(audioUrl(s));
    a.volume = Math.min(1, asked ? Math.max(0.6, level) : level);
    current.current = a;
    a.play().catch(() => {});
  };
}

/**
 * The sentence, its blank as a gap (or, once answered, the answer in it), and its furigana under the kanji:
 * all of them once it's answered; while it's asked, only for kanji above the level (or outside the list).
 */
function Sentence({ s, level, answered, tone }: { s: JlptSentence; level: string; answered: boolean; tone: 'right' | 'wrong' | null }) {
  const [b0, b1] = s.blank;
  const parts = useMemo(() => {
    // Plain runs cut where the blank starts and ends.
    const out: { text: string; reading?: string; inBlank: boolean }[] = [];
    for (const p of pieces(s.furigana)) {
      const end = p.start + p.text.length;
      if (p.reading || end <= b0 || p.start >= b1) {
        out.push({ text: p.text, reading: p.reading, inBlank: p.start >= b0 && end <= b1 });
        continue;
      }
      for (const [from, to] of [
        [p.start, Math.max(p.start, b0)],
        [Math.max(p.start, b0), Math.min(end, b1)],
        [Math.min(end, b1), end],
      ])
        if (to > from) out.push({ text: p.text.slice(from - p.start, to - p.start), inBlank: from >= b0 && to <= b1 });
    }
    return out;
  }, [s, b0, b1]);
  const hard = (text: string) => [...text].some((c) => /\p{Script=Han}/u.test(c) && (!KANJI_LEVEL.has(c) || LEVEL_RANK[KANJI_LEVEL.get(c)!] > LEVEL_RANK[level]));
  const blankText = s.ja.slice(b0, b1);
  const ruby = (text: string, reading: string | undefined, show: boolean, key: number) =>
    reading && show ? (
      <ruby key={key}>
        {text}
        <rt>{reading}</rt>
      </ruby>
    ) : (
      <span key={key}>{text}</span>
    );
  const out: React.ReactNode[] = [];
  let blankDone = false;
  parts.forEach((p, i) => {
    if (!p.inBlank) return out.push(ruby(p.text, p.reading, answered || hard(p.text), i));
    if (blankDone) return;
    blankDone = true;
    const inside = parts.filter((x) => x.inBlank);
    out.push(
      answered ? (
        <span key={i} className={`rounded px-1 ${tone === 'right' ? 'bg-hit/25' : 'bg-miss/25'}`}>
          {inside.map((x, j) => ruby(x.text, x.reading, true, j))}
        </span>
      ) : (
        <span key={i} className="mx-1 inline-block h-[1.05em] border-b-[3px] border-ink align-[-0.12em]" style={{ minWidth: `${Math.max(2, blankText.length) * 0.9}em` }} aria-label="blank" />
      ),
    );
  });
  return (
    <p lang="ja" className="ruby-under font-serif text-3xl font-bold leading-[2.4] sm:text-4xl">
      {out}
    </p>
  );
}

/**
 * Sentences with a blank, one level (/jlpt/n5-sentences): a real sentence and its translation, a gap where one
 * of the level's grammar points (or words) was, four answers. A streak with a clock, over at the first
 * mistake; every answer shows the whole sentence with its furigana, plays its recording, and lists the
 * list's words in it (a missed word goes on the review list).
 */
export function SentenceGame({ level }: { level: string }) {
  const key = `jlpt:${level.toLowerCase()}-sentences`;
  const best = useProgress((s) => s.bests[key] ?? 0);
  const recordBest = useProgress((s) => s.recordBest);
  const addReview = useProgress((s) => s.addJlptReview);
  const lang = useProgress((s) => s.nameLang);
  const recent = useRef<number[]>([]);
  const play = useRecording();
  const draw = () => {
    const q = nextSentence(level, new Set(recent.current));
    if (q) recent.current = [q.s.id, ...recent.current].slice(0, Math.min(MEMORY, Math.floor(sentencesOf(level).length / 2)));
    return q;
  };
  const [q, setQ] = useState<SentenceQuestion | null>(() => draw());
  const [picked, setPicked] = useState<string | null>(null);
  const [score, setScore] = useState(0);
  const [state, setState] = useState<'guess' | 'right' | 'wrong'>('guess');
  const arena = useRef<HTMLDivElement>(null);

  const reveal = (choice: string | null, right: boolean) => {
    if (!q) return;
    setPicked(choice);
    setState(right ? 'right' : 'wrong');
    play(q.s, false);
  };
  const answer = (choice: string) => {
    if (!q || state !== 'guess') return;
    if (choice === q.answer) {
      sfx.correct();
      setScore(score + 1);
      return reveal(choice, true);
    }
    fail(choice);
  };
  const fail = (choice: string | null) => {
    if (!q) return;
    sfx.wrong();
    shake(arena.current, 10, 420);
    reveal(choice, false);
    if (q.s.word) addReview([q.s.word]);
    if (score > best) window.setTimeout(() => (sfx.streak(), celebrateBig()), 500);
    recordBest(key, score, { reached: score / 2 });
  };
  const next = () => {
    setQ(draw());
    setPicked(null);
    setState('guess');
  };
  const restart = () => {
    sfx.click();
    setScore(0);
    next();
  };

  // 1–4 answer (Space or Enter go on: the site-wide next key).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const i = Number(e.key) - 1;
      if (q && state === 'guess' && i >= 0 && i < q.options.length) answer(q.options[i]);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  if (!q) return <p className="page rounded-md p-6 text-center text-ink-soft">No sentences for {level} yet.</p>;
  const s = q.s;
  const word = s.word ? jlptEntry(s.word) : undefined;
  const words = state === 'guess' ? [] : wordsIn(s);
  const tone = (o: string) => {
    if (state === 'guess') return 'btn-paper';
    if (o === q.answer) return 'border-hit bg-hit/20';
    if (o === picked) return 'border-miss bg-miss/20';
    return 'btn-paper opacity-60';
  };

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between">
        <p className="font-serif text-lg italic text-ink-soft">What goes in the gap?</p>
        <p className="font-display text-sm text-ink-soft">
          Streak <span className="font-serif text-2xl font-bold text-ink">{score}</span> · best {Math.max(best, state === 'wrong' ? score : 0)}
        </p>
      </div>
      <TimerBar total={secondsFor(score) * 1000} running={state === 'guess'} resetKey={`${score}:${s.id}:${state === 'wrong'}`} onExpire={() => state === 'guess' && fail(null)} />
      <div ref={arena} className="page flex flex-col items-center gap-3 rounded-md p-6 text-center sm:p-8">
        <Sentence key={s.id} s={s} level={level} answered={state !== 'guess'} tone={state === 'guess' ? null : state} />
        <p className="text-ink-soft">“{(lang === 'fr' && s.fr) || s.en}”</p>
        {s.audio && state !== 'guess' && (
          <button type="button" onClick={() => play(s, true)} className="rounded-full border border-rule-strong px-3 py-1 font-display text-xs font-bold text-ink-soft hover:text-ink">
            🔊 Listen again
          </button>
        )}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {q.options.map((o, i) => (
          <button key={o} type="button" lang="ja" disabled={state !== 'guess'} onClick={() => answer(o)} className={`flex items-center gap-3 rounded-md border px-4 py-3 text-left font-display font-semibold ${tone(o)}`}>
            <span className="text-xs text-ink-faint">{i + 1}</span>
            <span className="text-xl">{o}</span>
          </button>
        ))}
      </div>
      {state !== 'guess' && (
        <section className="page animate-pop space-y-3 rounded-md p-4">
          {s.grammar ? (
            <p className="text-sm">
              <span className="font-display font-bold">Grammar point</span> ·{' '}
              <span lang="ja" className="font-semibold">
                {s.grammar}
              </span>{' '}
              <span className="text-ink-faint">({level})</span>
            </p>
          ) : null}
          {/* What the grammar point means, and other sentences that use it. */}
          {s.grammar && <GrammarNote level={level} pattern={s.grammar} not={s.id} />}
          {!s.grammar && word && (
            <p className="text-sm">
              <span className="font-display font-bold">Word</span> ·{' '}
              <span lang="ja" className="font-semibold">
                {word.text}
              </span>{' '}
              <span lang="ja" className="text-ink-soft">
                {word.reading}
              </span>{' '}
              — {shortMeaning(word.meaning, 4)}
            </p>
          )}
          {words.length > 0 && (
            <ul className="space-y-1.5">
              {words.map((e) => (
                <li key={e.id} className="flex items-center gap-3 rounded-md border border-rule px-3 py-1.5">
                  <span lang="ja" className="min-w-12 font-serif text-xl font-bold">
                    {e.text}
                  </span>
                  <span className="min-w-0 flex-1 text-sm">
                    <span lang="ja" className="block text-ink-soft">
                      {e.reading !== e.text && e.reading} <span className="text-xs text-ink-faint">· {e.level}</span>
                    </span>
                    <span className="block">{shortMeaning(e.meaning, 4)}</span>
                  </span>
                  <KeepButton id={e.id} />
                </li>
              ))}
            </ul>
          )}
          <p className="text-xs text-ink-faint">
            Sentence{' '}
            <a href={tatoebaUrl(s)} target="_blank" rel="noreferrer" className="underline">
              #{s.id}
            </a>{' '}
            from Tatoeba (CC BY 2.0 FR){s.audio && ` · read by ${s.audio.by} (${s.audio.license})`}
          </p>
        </section>
      )}
      {state === 'right' && (
        <div className="flex justify-end">
          <button type="button" data-next onClick={next} className="btn-ink rounded-md px-6 py-3 font-display font-bold tracking-wider">
            Next ↵
          </button>
        </div>
      )}
      {state === 'wrong' && (
        <div className="animate-pop space-y-3 rounded-md border border-miss/50 bg-miss/10 p-5 text-center">
          <p className="font-display text-sm uppercase tracking-widest text-ink-soft">{picked ? 'Streak over' : "Time's up"}</p>
          <p className="font-serif text-5xl font-bold">{score}</p>
          {score > best ? <p className="font-display text-sm font-bold text-ochre">★ New best</p> : <p className="text-sm text-ink-soft">Best: {best}</p>}
          {word && <p className="text-xs text-ink-faint">{word.text} is now on your review list.</p>}
          <button type="button" data-next onClick={restart} className="btn-ink rounded-md px-6 py-3 font-display font-bold tracking-wider">
            Play again
          </button>
        </div>
      )}
    </div>
  );
}

/** The level's page for its sentences: a title, then the game. */
export function SentencePage({ level }: { level: string }) {
  const all = sentencesOf(level);
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <Link to="/jlpt" className="font-display text-sm font-semibold tracking-wider text-ink-soft hover:text-ink">
          ← JLPT
        </Link>
        <h1 className="text-4xl font-bold">文 {level} Grammar · sentences</h1>
        <p className="text-sm text-ink-soft">
          Real sentences with a gap where one of {level}&apos;s grammar points — or one of its words — was: pick what goes in it. Every answer shows the whole
          sentence with its readings{all.some((s) => s.audio) ? ' and plays it aloud, when someone recorded it' : ''}. {all.length} sentences.
        </p>
      </div>
      <SentenceGame key={level} level={level} />
    </div>
  );
}
