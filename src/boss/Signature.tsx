import { useEffect, useRef, useState } from 'react';
import { AudioClip } from '../components/AudioClip';
import type { SignaturePhase } from '../lib/boss';
import { sfx } from '../lib/sfx';
import { isFuzzyMatch } from '../utils/textMatcher';
import type { ChainResult } from './NameChain';
import { TimerBar } from './TimerBar';

interface Props {
  signature: SignaturePhase;
  bossName: string;
  okLines: string[];
  onSay: (text: string, mood: 'taunt' | 'hit' | 'hurt') => void;
  onDone: (result: ChainResult) => void;
}

/** A sound clue gets a few more seconds: the clip has to load and play first. */
const AUDIO_EXTRA_SECONDS = 8;

/**
 * Hard's secret phase. The boss shows clues on one very specific side of the franchise (a laugh,
 * an item's stats, a Patronus...), one at a time, and every one must be answered in a row: a wrong
 * answer or running out of time loses on the spot. No suggestions — the name has to be known.
 */
export function Signature({ signature, bossName, okLines, onSay, onDone }: Props) {
  const { clues, toWin, seconds, label, prompt } = signature;
  const [index, setIndex] = useState(0);
  const [text, setText] = useState('');
  const [state, setState] = useState<'answer' | 'ok' | 'over'>('answer');
  const [lost, setLost] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const timers = useRef<number[]>([]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  useEffect(() => {
    if (state === 'answer') input.current?.focus({ preventScroll: true });
  }, [state, index]);
  const clue = clues[index];
  const answer = clue.answer;

  const end = (won: boolean, reason: string, score: number) => {
    setState('over');
    timers.current.push(window.setTimeout(() => onDone({ won, score, reason }), won ? 1200 : 1800));
  };

  const lose = (reason: string) => {
    if (state !== 'answer') return;
    setLost(reason);
    sfx.hurt();
    end(false, reason, index);
  };

  const submit = () => {
    if (state !== 'answer' || !text.trim()) return;
    if (!isFuzzyMatch(text, [answer.name, ...answer.aliases])) return lose(`“${text.trim()}” — it was ${answer.name}`);
    setText('');
    sfx.correct();
    if (index + 1 >= toWin) {
      sfx.streak();
      return end(true, `${toWin} ${label.toLowerCase()} clues in a row`, toWin);
    }
    setState('ok');
    onSay(okLines[index % Math.max(1, okLines.length)] ?? 'Next.', 'hit');
    timers.current.push(
      window.setTimeout(() => {
        setIndex((i) => i + 1);
        setState('answer');
      }, 900),
    );
  };

  return (
    <div className="space-y-4">
      <div className="text-center">
        <p className="boss-secret-title font-display text-xs font-bold uppercase tracking-[0.4em] text-coral">Secret phase · Signature — {label}</p>
        <h3 className="mt-1 font-display text-lg font-bold sm:text-xl">{prompt}</h3>
      </div>

      <div className="flex items-center justify-center gap-1.5" aria-label={`${index} of ${toWin} answered`}>
        {Array.from({ length: toWin }, (_, i) => (
          <span key={i} className={`h-2 w-8 rounded-full transition ${i < index || (i === index && state !== 'answer' && !lost) ? 'bg-hit' : lost && i === index ? 'animate-pop bg-coral' : 'bg-rule-strong'}`} />
        ))}
      </div>

      <div key={index} className="animate-pop rounded-md border-2 border-coral/60 bg-card/70 p-4">
        <p className="mb-2 text-center font-display text-[11px] uppercase tracking-widest text-ink-faint">
          {bossName} · clue {index + 1} of {toWin}
        </p>
        {clue.audio ? (
          <AudioClip videoId={clue.audio.youtubeId} start={clue.audio.start ?? 0} step={0} full revealed={false} onUnavailable={() => lose('The clip would not play')} />
        ) : (
          <p className="py-4 text-center font-serif text-2xl font-bold sm:text-3xl">{clue.text}</p>
        )}
      </div>

      {seconds > 0 && (
        <TimerBar
          total={(seconds + (clue.audio ? AUDIO_EXTRA_SECONDS : 0)) * 1000}
          running={state === 'answer'}
          resetKey={index}
          onExpire={() => lose(`Time's up — it was ${answer.name}`)}
          hideSeconds
        />
      )}

      <input
        ref={input}
        value={text}
        disabled={state !== 'answer'}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') submit();
        }}
        placeholder={state === 'answer' ? 'Type the name…' : ''}
        autoComplete="off"
        autoCapitalize="off"
        spellCheck={false}
        className="w-full rounded-xl border border-coral/60 bg-card/90 px-4 py-3 text-base outline-none ring-coral/30 transition placeholder:text-ink-faint focus:border-coral focus:ring-4 disabled:opacity-60"
      />

      <p className="min-h-5 text-center text-sm font-semibold" aria-live="polite">
        {lost && <span className="animate-pop inline-block text-coral">✗ {lost}.</span>}
        {!lost && state === 'ok' && <span className="animate-pop inline-block text-hit">✓ {answer.name}</span>}
      </p>
    </div>
  );
}
