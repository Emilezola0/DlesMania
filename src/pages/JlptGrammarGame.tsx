import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { TimerBar } from '../boss/TimerBar';
import { hiddenKana, lastItems, lastRight, maskPattern } from '../arcade/toTheLast';
import { GrammarNote } from '../components/JlptGrammarNote';
import { celebrateBig, shake } from '../lib/fx';
import { romajiSpellings, toHiragana } from '../lib/romaji';
import { sfx } from '../lib/sfx';
import { useProgress } from '../store/progress';

/** Seconds per formula: 30 at first, half a second less each right answer, down to 15. */
const secondsFor = (streak: number) => Math.max(15, 30 - streak * 0.5);

/**
 * A level's grammar (/jlpt/n5-grammar): one of its grammar points with about half its kana hidden
 * ("～ん＿＿"), to fill in — typed in romaji or kana, the missing kana alone or the whole pattern (as in To
 * the Last). A streak with a clock, over at the first mistake. Every answer shows the whole pattern, what
 * it means and sentences that use it.
 */
function GrammarGame({ level }: { level: string }) {
  const items = useMemo(() => lastItems(level, 'grammar'), [level]);
  const key = `jlpt:${level.toLowerCase()}-grammar`;
  const best = useProgress((s) => s.bests[key] ?? 0);
  const recordBest = useProgress((s) => s.recordBest);
  const recent = useRef<string[]>([]);
  const draw = () => {
    const fresh = items.filter((e) => !recent.current.includes(e.id));
    const pool = fresh.length ? fresh : items;
    const entry = pool[Math.floor(Math.random() * pool.length)];
    recent.current = [entry.id, ...recent.current].slice(0, Math.floor(items.length / 2));
    return { entry, shown: maskPattern(entry.text, Math.floor(Math.random() * 1e9)) };
  };
  const [q, setQ] = useState(draw);
  const [typed, setTyped] = useState('');
  const [score, setScore] = useState(0);
  const [state, setState] = useState<'guess' | 'right' | 'wrong'>('guess');
  const field = useRef<HTMLInputElement>(null);
  const arena = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (state === 'guess') field.current?.focus();
  }, [state, q]);

  const fail = () => {
    sfx.wrong();
    shake(arena.current, 10, 420);
    setState('wrong');
    if (score > best) window.setTimeout(() => (sfx.streak(), celebrateBig()), 500);
    recordBest(key, score, { reached: score / 2 });
  };
  const submit = () => {
    if (state !== 'guess' || !typed.trim()) return;
    if (!lastRight(q.entry, 'pattern', typed, q.shown)) return fail();
    sfx.correct();
    setScore(score + 1);
    setState('right');
  };
  const next = () => {
    setQ(draw());
    setTyped('');
    setState('guess');
  };
  const restart = () => {
    sfx.click();
    setScore(0);
    next();
  };

  // The missing kana, and how they're typed in romaji.
  const gap = hiddenKana(q.entry.text, q.shown);
  const gapRomaji = gap && /^[ぁ-ゖァ-ヶー]+$/.test(gap) ? romajiSpellings(toHiragana(gap))[0] : '';

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between">
        <p className="font-serif text-lg italic text-ink-soft">Fill in the gaps — or write it all out</p>
        <p className="font-display text-sm text-ink-soft">
          Streak <span className="font-serif text-2xl font-bold text-ink">{score}</span> · best {Math.max(best, state === 'wrong' ? score : 0)}
        </p>
      </div>
      <TimerBar total={secondsFor(score) * 1000} running={state === 'guess'} resetKey={`${score}:${q.entry.id}:${state === 'wrong'}`} onExpire={() => state === 'guess' && fail()} />
      <div ref={arena} className="page flex flex-col items-center gap-2 rounded-md p-6 text-center sm:p-8">
        <p key={`${q.entry.id}:${q.shown}`} lang="ja" className="animate-round-in font-serif text-5xl font-bold leading-tight sm:text-6xl">
          {state === 'guess' ? q.shown : q.entry.text}
        </p>
        {state === 'right' && <p className="animate-pop font-display text-sm font-bold text-hit">✓ Right</p>}
        {state === 'wrong' && gap && (
          <p className="animate-pop text-sm">
            <span className="text-ink-faint">The gaps: </span>
            <span lang="ja" className="font-semibold">
              {gap}
            </span>
            {gapRomaji && <span className="text-ink-soft"> ({gapRomaji})</span>}
          </p>
        )}
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (state === 'right') next();
          else if (state === 'wrong') restart();
          else submit();
        }}
        className="flex gap-2"
      >
        <input
          ref={field}
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          disabled={state !== 'guess'}
          lang="ja"
          placeholder="The missing kana or the whole pattern, in kana or romaji…"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          name="jlpt-grammar"
          className={`min-w-0 flex-1 rounded-md border-2 bg-card px-4 py-3 text-lg outline-none focus:border-ink ${state === 'right' ? 'border-hit' : state === 'wrong' ? 'border-miss' : 'border-rule-strong'}`}
        />
        {state === 'guess' ? (
          <button type="submit" disabled={!typed.trim()} className="btn-ink rounded-md px-5 font-display font-bold tracking-wider disabled:opacity-50">
            ↵
          </button>
        ) : (
          <button type="submit" autoFocus data-next className="btn-ink rounded-md px-5 font-display font-bold tracking-wider">
            {state === 'right' ? 'Next ↵' : 'Play again'}
          </button>
        )}
      </form>
      {/* Right or wrong: what the grammar point means, and sentences that use it. */}
      {state !== 'guess' && (
        <div className="page rounded-md p-4">
          <GrammarNote level={level} pattern={q.entry.text} />
        </div>
      )}
      {state === 'wrong' && (
        <div className="animate-pop space-y-1 rounded-md border border-miss/50 bg-miss/10 p-5 text-center">
          <p className="font-display text-sm uppercase tracking-widest text-ink-soft">Streak over</p>
          <p className="font-serif text-5xl font-bold">{score}</p>
          {score > best ? <p className="font-display text-sm font-bold text-ochre">★ New best</p> : <p className="text-sm text-ink-soft">Best: {best}</p>}
        </div>
      )}
    </div>
  );
}

/** A level's grammar page: a title, then the game. */
export function GrammarPage({ level }: { level: string }) {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <Link to="/jlpt" className="font-display text-sm font-semibold tracking-wider text-ink-soft hover:text-ink">
          ← JLPT
        </Link>
        <h1 className="text-4xl font-bold">文 {level} Grammar</h1>
        <p className="text-sm text-ink-soft">
          {level}&apos;s grammar points with gaps: type the missing kana (or the whole pattern), in romaji or kana. A streak until the first mistake; every answer shows what the
          grammar point means.
        </p>
      </div>
      <GrammarGame key={level} level={level} />
    </div>
  );
}
