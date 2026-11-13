import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { TimerBar } from '../boss/TimerBar';
import { hiddenKana, lastItems, lastRight, maskPattern, type GapLevel } from '../arcade/toTheLast';
import { grammarMeaning } from '../arcade/jlptGrammar';
import { GrammarNote } from '../components/JlptGrammarNote';
import { celebrateBig, shake } from '../lib/fx';
import { romajiSpellings, toHiragana } from '../lib/romaji';
import { sfx } from '../lib/sfx';
import { JLPT_LEARNED, REVIEW_DAY_COINS, useProgress } from '../store/progress';

/** Seconds per formula: 30 at first, half a second less each right answer, down to 15. */
const secondsFor = (streak: number) => Math.max(15, 30 - streak * 0.5);

/**
 * A level's grammar (/jlpt/n5-grammar): one of its grammar points with about half its kana hidden
 * ("～ん＿＿"), to fill in — typed in romaji or kana, the missing kana alone or the whole pattern (as in To
 * the Last). A streak with a clock, over at the first mistake. Every answer shows the whole pattern, what
 * it means and sentences that use it.
 */
function GrammarGame({ level, gaps }: { level: string; gaps: GapLevel }) {
  const items = useMemo(() => lastItems(level, 'grammar'), [level]);
  // Each difficulty keeps its own best (medium keeps the one from before there were difficulties).
  const key = `jlpt:${level.toLowerCase()}-grammar${gaps === 'medium' ? '' : `-${gaps}`}`;
  const best = useProgress((s) => s.bests[key] ?? 0);
  const recordBest = useProgress((s) => s.recordBest);
  const lang = useProgress((s) => s.nameLang);
  const recent = useRef<string[]>([]);
  const draw = () => {
    const fresh = items.filter((e) => !recent.current.includes(e.id));
    const pool = fresh.length ? fresh : items;
    const entry = pool[Math.floor(Math.random() * pool.length)];
    recent.current = [entry.id, ...recent.current].slice(0, Math.floor(items.length / 2));
    return { entry, shown: maskPattern(entry.text, Math.floor(Math.random() * 1e9), gaps) };
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

  const hint = grammarMeaning(level, q.entry.text, lang);
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
        {/* The hint: what it means (a one-kana particle, all hidden, can't be guessed without it). */}
        {state === 'guess' && hint && <p className="text-sm text-ink-soft">💡 {hint.text}</p>}
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
const GAP_LEVELS: { id: GapLevel; label: string; help: string }[] = [
  { id: 'easy', label: 'Easy', help: 'at least two kana shown' },
  { id: 'medium', label: 'Medium', help: 'some kana shown' },
  { id: 'hard', label: 'Hard', help: 'no kana shown' },
];
const GAPS_KEY = 'omnidle-jlpt-grammar-gaps';

export function GrammarPage({ level }: { level: string }) {
  const [gaps, setGaps] = useState<GapLevel>(() => {
    try {
      const v = localStorage.getItem(GAPS_KEY);
      return v === 'easy' || v === 'hard' ? v : 'medium';
    } catch {
      return 'medium';
    }
  });
  const pick = (g: GapLevel) => {
    sfx.click();
    setGaps(g);
    try {
      localStorage.setItem(GAPS_KEY, g);
    } catch {
      // Not remembered, that's all.
    }
  };
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <Link to="/jlpt" className="font-display text-sm font-semibold tracking-wider text-ink-soft hover:text-ink">
          ← Japanese
        </Link>
        <h1 className="text-4xl font-bold">文 {level} Grammar</h1>
        <p className="text-sm text-ink-soft">
          {level}&apos;s grammar points with gaps: type the missing kana (or the whole pattern), in romaji or kana. A streak until the first mistake; every answer shows what the
          grammar point means.
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {GAP_LEVELS.map((g) => (
          <button key={g.id} type="button" aria-pressed={gaps === g.id} onClick={() => pick(g.id)} className={`rounded-full border-2 px-3 py-1 text-sm font-semibold ${gaps === g.id ? 'border-ink bg-ink text-paper' : 'border-rule-strong bg-card text-ink-soft hover:border-ink'}`} title={g.help}>
            {g.label}
          </button>
        ))}
        <span className="text-xs text-ink-faint">{GAP_LEVELS.find((g) => g.id === gaps)!.help}</span>
      </div>
      <GrammarGame key={`${level}-${gaps}`} level={level} gaps={gaps} />
    </div>
  );
}

/**
 * Grammar Review (/jlpt/grammar-review): the grammar points kept on their own review list, with gaps
 * (medium), no clock, and a miss doesn't end it. JLPT_LEARNED right in a row and a point is learned
 * (it leaves the list); a wrong one starts it over. Every answer shows the note, as in the game.
 */
export function GrammarReview() {
  const list = useProgress((s) => s.jlptGrammarReview);
  const review = useProgress((s) => s.reviewJlptGrammar);
  const recent = useRef<string[]>([]);
  const draw = () => {
    const keys = Object.keys(useProgress.getState().jlptGrammarReview);
    if (!keys.length) return null;
    const fresh = keys.filter((k) => !recent.current.includes(k));
    const pool = fresh.length ? fresh : keys;
    const key = pool[Math.floor(Math.random() * pool.length)];
    recent.current = [key, ...recent.current].slice(0, Math.floor(keys.length / 2));
    const [level, ...rest] = key.split('|');
    const pattern = rest.join('|');
    const entry = lastItems(level, 'grammar').find((e) => e.text === pattern) ?? { id: key, text: pattern, reading: '', meaning: '', level };
    return { key, level, entry, shown: maskPattern(pattern, Math.floor(Math.random() * 1e9), 'medium') };
  };
  const [q, setQ] = useState(draw);
  const [typed, setTyped] = useState('');
  const [state, setState] = useState<'guess' | 'right' | 'wrong'>('guess');
  const [right, setRight] = useState(0);
  const [wrong, setWrong] = useState(0);
  const [dayGift, setDayGift] = useState(false);
  const lang = useProgress((s) => s.nameLang);
  const field = useRef<HTMLInputElement>(null);
  const arena = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (state === 'guess') field.current?.focus();
  }, [state, q]);

  if (!q) {
    return (
      <div className="page space-y-3 rounded-md p-8 text-center">
        <p className="font-serif text-5xl">🎉</p>
        <p className="font-display text-xl font-bold">{right ? 'Your grammar review list is empty — every point learned!' : 'Your grammar review list is empty.'}</p>
        <p className="text-sm text-ink-soft">Star (☆) a grammar point after answering it, in Grammar or To the Last, and it lands here.</p>
        <Link to="/jlpt" className="btn-ink inline-block rounded-md px-6 py-3 font-display font-bold tracking-wider">
          Back to the decks
        </Link>
      </div>
    );
  }
  const submit = () => {
    if (state !== 'guess' || !typed.trim()) return;
    const ok = lastRight(q.entry, 'pattern', typed, q.shown);
    review(q.key, ok);
    // Each grammar point's first right answer of the day pays its reward.
    setDayGift(ok && !!useProgress.getState().payReviewDay('grammar', q.key));
    if (ok) (sfx.correct(), setRight(right + 1), setState('right'));
    else (sfx.wrong(), shake(arena.current, 10, 420), setWrong(wrong + 1), setState('wrong'));
  };
  const next = () => {
    setQ(draw());
    setTyped('');
    setState('guess');
    setDayGift(false);
  };
  const hint = grammarMeaning(q.level, q.entry.text, lang);
  const gap = hiddenKana(q.entry.text, q.shown);
  const learning = list[q.key] ?? JLPT_LEARNED;
  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between">
        <p className="font-serif text-lg italic text-ink-soft">Fill in the gaps — or write it all out</p>
        <p className="font-display text-sm text-ink-soft">
          ✓ <span className="font-serif text-2xl font-bold text-ink">{right}</span> · ✗ {wrong} · {Object.keys(list).length} to learn
        </p>
      </div>
      {dayGift && <p className="animate-pop text-center font-display text-sm font-bold text-hit">+{REVIEW_DAY_COINS} DleCoins — this point’s review reward for today</p>}
      <div ref={arena} className="page relative flex flex-col items-center gap-2 rounded-md p-6 text-center sm:p-8">
        <span className="absolute left-3 top-3 rounded-full border border-rule-strong px-2 py-0.5 font-display text-xs text-ink-faint">{q.level}</span>
        <span className="absolute right-3 top-3 font-display text-xs text-ink-faint" title={`${JLPT_LEARNED} right in a row and it's learned`}>
          {'●'.repeat(Math.min(learning, JLPT_LEARNED))}
          {'○'.repeat(Math.max(0, JLPT_LEARNED - learning))}
        </span>
        <p key={`${q.key}:${q.shown}`} lang="ja" className="animate-round-in font-serif text-5xl font-bold leading-tight sm:text-6xl">
          {state === 'guess' ? q.shown : q.entry.text}
        </p>
        {state === 'guess' && hint && <p className="text-sm text-ink-soft">💡 {hint.text}</p>}
        {state === 'right' && <p className="animate-pop font-display text-sm font-bold text-hit">✓ Right</p>}
        {state === 'wrong' && gap && (
          <p className="animate-pop text-sm">
            <span className="text-ink-faint">The gaps: </span>
            <span lang="ja" className="font-semibold">
              {gap}
            </span>
          </p>
        )}
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (state === 'guess') submit();
          else next();
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
          name="jlpt-grammar-review"
          className={`min-w-0 flex-1 rounded-md border-2 bg-card px-4 py-3 text-lg outline-none focus:border-ink ${state === 'right' ? 'border-hit' : state === 'wrong' ? 'border-miss' : 'border-rule-strong'}`}
        />
        {state === 'guess' ? (
          <button type="submit" disabled={!typed.trim()} className="btn-ink rounded-md px-5 font-display font-bold tracking-wider disabled:opacity-50">
            ↵
          </button>
        ) : (
          <button type="submit" autoFocus data-next className="btn-ink rounded-md px-5 font-display font-bold tracking-wider">
            Next ↵
          </button>
        )}
      </form>
      {state === 'wrong' && <p className="animate-pop text-center text-sm text-ink-soft">Not this time — it stays on your list, and starts over.</p>}
      {state !== 'guess' && (
        <div className="page rounded-md p-4">
          <GrammarNote level={q.level} pattern={q.entry.text} />
        </div>
      )}
    </div>
  );
}
