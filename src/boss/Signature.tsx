import { useEffect, useRef, useState } from 'react';
import { useTypeToFocus } from '../lib/focus';
import { AudioClip } from '../components/AudioClip';
import type { SignaturePhase } from '../lib/boss';
import { shownName, withFrench } from '../lib/french';
import { sfx } from '../lib/sfx';
import { isFuzzyMatch, suggestNames } from '../utils/textMatcher';
import { DidYouMean } from './DidYouMean';
import type { ChainResult } from './NameChain';
import { TimerBar } from './TimerBar';

interface Props {
  signature: SignaturePhase;
  bossName: string;
  okLines: string[];
  onSay: (text: string, mood: 'taunt' | 'hit' | 'hurt') => void;
  /** A wrong answer while chances remain: the battle takes every heart. */
  onLastChance: () => void;
  onDone: (result: ChainResult) => void;
}

/** A sound clue gets a few more seconds: the clip has to load and play first. */
const AUDIO_EXTRA_SECONDS = 8;

/**
 * Hard's secret phase. The boss shows a clue on one very specific side of the franchise (a laugh,
 * an item's stats, a Patronus...): `toWin` right answers win the fight. A wrong answer or running
 * out of time uses a chance — the first one takes every heart and brings a new clue, the last one
 * loses. No suggestions — the name has to be known.
 */
export function Signature({ signature, bossName, okLines, onSay, onLastChance, onDone }: Props) {
  const { clues, toWin, chances, seconds, label, prompt } = signature;
  const [index, setIndex] = useState(0);
  const [right, setRight] = useState(0);
  const [missed, setMissed] = useState(0);
  const [text, setText] = useState('');
  /** A half-typed answer ("Kakashi"): asked about, not counted as a miss. */
  const [maybe, setMaybe] = useState<string | null>(null);
  const [state, setState] = useState<'answer' | 'ok' | 'miss' | 'over'>('answer');
  const [message, setMessage] = useState<{ text: string; good: boolean } | null>(null);
  const input = useRef<HTMLInputElement>(null);
  useTypeToFocus(input);
  const timers = useRef<number[]>([]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  useEffect(() => {
    if (state === 'answer') input.current?.focus({ preventScroll: true });
  }, [state, index]);
  const clue = clues[Math.min(index, clues.length - 1)];
  const answer = clue.answer;
  const lastChance = missed > 0;

  const end = (won: boolean, reason: string, score: number) => {
    setState('over');
    timers.current.push(window.setTimeout(() => onDone({ won, score, reason }), won ? 1200 : 1800));
  };

  const nextClue = (after: 'ok' | 'miss') => {
    setState(after);
    timers.current.push(
      window.setTimeout(() => {
        setIndex((i) => i + 1);
        setMessage(null);
        setState('answer');
      }, after === 'miss' ? 1800 : 900),
    );
  };

  const miss = (reason: string) => {
    if (state !== 'answer') return;
    const used = missed + 1;
    setMissed(used);
    setText('');
    setMessage({ text: reason, good: false });
    sfx.hurt();
    if (used >= chances) return end(false, reason, right);
    onLastChance();
    nextClue('miss');
  };

  const submit = (value = text) => {
    if (state !== 'answer' || !value.trim()) return;
    setMaybe(null);
    if (!isFuzzyMatch(value, withFrench([answer.name, ...answer.aliases]))) {
      // Part of the name: ask before calling it a miss.
      if (suggestNames(value, [answer], (a) => withFrench([a.name, ...a.aliases])).length) {
        setText('');
        return setMaybe(answer.name);
      }
      return miss(`“${value.trim()}” — it was ${shownName(answer.name)}`);
    }
    setText('');
    sfx.correct();
    const got = right + 1;
    setRight(got);
    setMessage({ text: shownName(answer.name), good: true });
    if (got >= toWin) {
      sfx.streak();
      return end(true, toWin === 1 ? `named ${shownName(answer.name)}` : `${toWin} ${label.toLowerCase()} clues answered`, got);
    }
    onSay(okLines[got % Math.max(1, okLines.length)] ?? 'Next.', 'hit');
    nextClue('ok');
  };

  return (
    <div className="space-y-4">
      <div className="text-center">
        <p className="boss-secret-title font-display text-xs font-bold uppercase tracking-[0.4em] text-coral">Secret phase · Signature — {label}</p>
        <h3 className="mt-1 font-display text-lg font-bold sm:text-xl">{prompt}</h3>
      </div>

      <p className={`text-center font-display text-xs font-bold uppercase tracking-widest ${lastChance ? 'animate-pop text-coral' : 'text-ink-faint'}`}>
        {lastChance ? 'Last chance — no hearts left!' : `${toWin === 1 ? 'One right answer wins' : `${right} of ${toWin} answered`} · ${chances - missed} ${chances - missed === 1 ? 'try' : 'tries'} left`}
      </p>

      <div key={index} className="animate-pop rounded-md border-2 border-coral/60 bg-card/70 p-4">
        <p className="mb-2 text-center font-display text-[11px] uppercase tracking-widest text-ink-faint">
          {bossName} · clue {index + 1}
        </p>
        {clue.audio ? (
          <AudioClip videoId={clue.audio.youtubeId} start={clue.audio.start ?? 0} step={0} full revealed={false} onUnavailable={() => miss('The clip would not play')} />
        ) : (
          <div className="py-4 text-center">
            <p className="font-serif text-2xl font-bold sm:text-3xl">{clue.text}</p>
            {clue.effect && <p className="mx-auto mt-2 max-w-md font-serif text-base italic text-ink-soft">{clue.effect}</p>}
          </div>
        )}
      </div>

      {seconds > 0 && (
        <TimerBar
          total={(seconds + (clue.audio ? AUDIO_EXTRA_SECONDS : 0)) * 1000}
          running={state === 'answer'}
          resetKey={index}
          onExpire={() => miss(`Time's up — it was ${shownName(answer.name)}`)}
          hideSeconds
        />
      )}

      <input
        ref={input}
        value={text}
        disabled={state !== 'answer'}
        onChange={(e) => (setText(e.target.value), setMaybe(null))}
        onKeyDown={(e) => {
          // Enter on an empty box takes the "Did you mean".
          if (e.key === 'Enter') submit(!text.trim() && maybe ? maybe : text);
        }}
        placeholder={state === 'answer' ? 'Type the name…' : ''}
        autoComplete="off"
        autoCapitalize="off"
        spellCheck={false}
        className="w-full rounded-xl border border-coral/60 bg-card/90 px-4 py-3 text-base outline-none ring-coral/30 transition placeholder:text-ink-faint focus:border-coral focus:ring-4 disabled:opacity-60"
      />

      <DidYouMean names={state === 'answer' && maybe ? [maybe] : []} onPick={(n) => submit(n)} />

      <p className="min-h-5 text-center text-sm font-semibold" aria-live="polite">
        {message && <span className={`animate-pop inline-block ${message.good ? 'text-hit' : 'text-coral'}`}>{message.good ? `✓ ${message.text}` : `✗ ${message.text}.`}</span>}
      </p>
    </div>
  );
}
