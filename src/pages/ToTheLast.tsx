import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { shortMeaning } from '../arcade/jlpt';
import { LAST_KINDS, LAST_KIND_LABEL, afterAnswer, askFor, freshLast, lastItems, lastRight, loadLast, maskPattern, saveLast, type LastKind } from '../arcade/toTheLast';
import { hashString } from '../lib/rng';
import { celebrateBig, shake } from '../lib/fx';
import { sfx } from '../lib/sfx';
import { useProgress } from '../store/progress';

const REVEAL_MS = 1100;
const QUESTION: Record<string, string> = { meaning: 'What does it mean?', reading: 'How is it read?', pattern: 'Write the grammar point out in full' };
const PLACEHOLDER: Record<string, string> = { meaning: 'The meaning, in English…', reading: 'The reading, in kana or romaji…', pattern: 'The whole pattern, in kana or romaji…' };

/** /jlpt-last/:level/:kind — To the Last: every item of a level, until none is left (a fresh game for each level and kind). */
export default function ToTheLast() {
  const { level = '', kind = '' } = useParams();
  return <LastGame key={`${level}-${kind}`} level={level} kind={kind} />;
}

function LastGame({ level, kind }: { level: string; kind: string }) {
  const valid = /^N[1-5]$/.test(level) && (LAST_KINDS as string[]).includes(kind);
  const items = useMemo(() => (valid ? lastItems(level, kind as LastKind) : []), [valid, level, kind]);
  const byId = useMemo(() => new Map(items.map((e) => [e.id, e])), [items]);
  const recordBest = useProgress((s) => s.recordBest);
  const [progress, setProgress] = useState(() => (valid ? loadLast(level, kind as LastKind) : { left: [], right: 0, wrong: 0 }));
  const [typed, setTyped] = useState('');
  const [state, setState] = useState<'guess' | 'right' | 'wrong'>('guess');
  const field = useRef<HTMLInputElement>(null);
  const arena = useRef<HTMLDivElement>(null);

  const entry = byId.get(progress.left[0] ?? '');
  // The same item is asked the same way until it's answered (seeded by its id and how many answers so far).
  const seed = hashString(`${entry?.id}:${progress.right + progress.wrong}`);
  const ask = entry ? askFor(entry, kind as LastKind, seed) : 'meaning';
  const shown = entry && ask === 'pattern' ? maskPattern(entry.text, seed) : entry?.text;

  useEffect(() => {
    if (state === 'guess') field.current?.focus();
  }, [state, entry]);

  if (!valid) return <Navigate to="/jlpt" replace />;
  const k = kind as LastKind;
  const total = items.length;

  const move = (right: boolean) => {
    const next = afterAnswer(progress, right);
    setProgress(next);
    saveLast(level, k, next);
    setTyped('');
    setState('guess');
    if (!next.left.length) {
      sfx.streak();
      celebrateBig();
      recordBest(`jlpt-last:${level}-${kind}`, total, { won: true });
    }
  };
  const submit = () => {
    if (!entry || state !== 'guess' || !typed.trim()) return;
    if (lastRight(entry, ask, typed)) {
      sfx.correct();
      setState('right');
      window.setTimeout(() => move(true), REVEAL_MS);
    } else {
      sfx.wrong();
      shake(arena.current, 8, 380);
      setState('wrong');
    }
  };
  const restart = () => {
    sfx.click();
    const p = freshLast(level, k);
    setProgress(p);
    saveLast(level, k, p);
    setState('guess');
    setTyped('');
  };

  const done = total - progress.left.length;
  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div>
        <Link to="/jlpt" className="font-display text-sm font-semibold tracking-wider text-ink-soft hover:text-ink">
          ← JLPT
        </Link>
        <h1 className="text-4xl font-bold">
          To the Last · {level} {LAST_KIND_LABEL[k]}
        </h1>
        <p className="text-sm text-ink-soft">
          Every {k === 'vocab' ? 'word' : k === 'kanji' ? 'kanji' : 'grammar point'} of {level}, one at a time. Right, and it&apos;s gone for good; wrong, and it comes back a
          little later. Clear them all to finish — your progress is kept on this device.
        </p>
      </div>
      <div className="space-y-1">
        <div className="flex items-end justify-between font-display text-sm text-ink-soft">
          <span>
            <span className="font-serif text-2xl font-bold text-ink">{done}</span> / {total} cleared · {progress.left.length} left
          </span>
          <span>
            ✓ {progress.right} · ✗ {progress.wrong}
          </span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-tile">
          <div className="h-full rounded-full bg-hit transition-all" style={{ width: `${(done / Math.max(1, total)) * 100}%` }} />
        </div>
      </div>

      {!entry ? (
        <div className="page space-y-3 rounded-md p-8 text-center">
          <p className="font-serif text-5xl">🎉</p>
          <p className="font-display text-xl font-bold">
            All {total} cleared — {level} {LAST_KIND_LABEL[k]}, to the last.
          </p>
          <p className="text-sm text-ink-soft">
            {progress.right} right answers, {progress.wrong} misses along the way.
          </p>
          <button type="button" onClick={restart} className="btn-ink rounded-md px-6 py-3 font-display font-bold tracking-wider">
            Start over
          </button>
        </div>
      ) : (
        <>
          <p className="font-serif text-lg italic text-ink-soft">{QUESTION[ask]}</p>
          <div ref={arena} className="page flex flex-col items-center gap-2 rounded-md p-6 text-center sm:p-8">
            <p key={entry.id} lang="ja" className="animate-round-in font-serif text-5xl font-bold leading-tight sm:text-6xl">
              {state === 'guess' ? shown : entry.text}
            </p>
            {/* Once answered: the reading under it and the meaning (grammar: the pattern in full, above). */}
            {state !== 'guess' && ask !== 'pattern' && (
              <>
                {entry.reading !== entry.text && (
                  <p lang="ja" className="animate-pop text-lg text-ink-soft">
                    {entry.reading}
                  </p>
                )}
                <p className="animate-pop text-sm text-ink-faint">{shortMeaning(entry.meaning, 6)}</p>
              </>
            )}
            {state === 'right' && <p className="animate-pop font-display text-sm font-bold text-hit">✓ Cleared</p>}
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (state === 'wrong') move(false);
              else submit();
            }}
            className="flex gap-2"
          >
            <input
              ref={field}
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              disabled={state !== 'guess'}
              lang={ask === 'meaning' ? 'en' : 'ja'}
              placeholder={PLACEHOLDER[ask]}
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              name="jlpt-last"
              className={`min-w-0 flex-1 rounded-md border-2 bg-card px-4 py-3 text-lg outline-none focus:border-ink ${state === 'right' ? 'border-hit' : state === 'wrong' ? 'border-miss' : 'border-rule-strong'}`}
            />
            {state === 'wrong' ? (
              <button type="submit" autoFocus className="btn-ink rounded-md px-5 font-display font-bold tracking-wider">
                Next ↵
              </button>
            ) : (
              <button type="submit" disabled={state !== 'guess' || !typed.trim()} className="btn-ink rounded-md px-5 font-display font-bold tracking-wider disabled:opacity-50">
                ↵
              </button>
            )}
          </form>
          {state === 'wrong' && <p className="animate-pop text-center text-sm text-ink-soft">Not this time — it comes back a little later.</p>}
          <div className="text-right">
            <button type="button" onClick={restart} className="text-xs text-ink-faint underline hover:text-ink">
              Start this level over
            </button>
          </div>
        </>
      )}
    </div>
  );
}
