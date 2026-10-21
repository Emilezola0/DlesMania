import { useEffect, useRef, useState } from 'react';
import { blitzSeconds, escalated, matchAnswer, type DifficultySpec } from '../lib/boss';
import { sfx } from '../lib/sfx';
import type { BlitzPrompt, PhaseResult } from '../types';
import { TimerBar } from './TimerBar';

interface Props {
  prompt: BlitzPrompt;
  onEvent: (good: boolean) => void;
  difficulty: DifficultySpec;
  /** Which loop of the phase (0 = first); Hard's second loop is escalated. */
  loop: number;
  onDone: (result: PhaseResult) => void;
}

/** Phase I: name N things before the timer runs out. Answers are accepted as you type. */
export function KnowledgeBlitz({ prompt, difficulty: d, loop, onEvent, onDone }: Props) {
  const esc = escalated(d, loop) ? d.secondLoop!.blitz : null;
  const total = blitzSeconds(prompt, d, loop) * 1000;
  // Hard: no list of what you've already named, and no seconds counter.
  const hidden = d.distortion === 2;
  const [found, setFound] = useState<string[]>([]);
  const [text, setText] = useState('');
  const [note, setNote] = useState<{ text: string; good: boolean; key: number } | null>(null);
  const [wrong, setWrong] = useState(0);
  const [over, setOver] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const pending = useRef<number>();

  useEffect(() => input.current?.focus({ preventScroll: true }), []);
  useEffect(() => () => clearTimeout(pending.current), []);

  const finish = (won: boolean, list = found) => {
    if (over) return;
    setOver(true);
    clearTimeout(pending.current);
    onDone({
      won,
      correct: list.length,
      wrong,
      missed: won ? undefined : prompt.answers.filter((a) => !list.includes(a.name)).slice(0, 6).map((a) => a.name),
    });
  };

  const accept = (name: string, typo = false) => {
    const next = [...found, name];
    setFound(next);
    setText('');
    setNote({ text: typo ? `${name} (typo forgiven)` : name, good: true, key: Date.now() });
    sfx.correct();
    onEvent(true);
    if (next.length >= prompt.count) finish(true, next);
  };

  const tryText = (value: string, submitted: boolean) => {
    clearTimeout(pending.current);
    // Exact spellings are accepted as you type; typos only on Enter or after a pause.
    const m = matchAnswer(prompt, value, new Set(found), submitted);
    if (m?.already) {
      if (submitted) {
        setNote({ text: `${m.name} — already named`, good: false, key: Date.now() });
        setText('');
      }
      return;
    }
    if (m && (m.exact || submitted)) return accept(m.name, m.typo);
    if (!submitted) {
      // A shorter answer that's also the start of a longer one, or a near miss, waits for a pause.
      pending.current = window.setTimeout(() => {
        const late = m ?? matchAnswer(prompt, value, new Set(found), true);
        if (late && !late.already) accept(late.name, late.typo);
      }, 900);
      return;
    }
    if (value.trim()) {
      setWrong((w) => w + 1);
      setNote({ text: `“${value.trim()}” isn't on the list`, good: false, key: Date.now() });
      sfx.wrong();
      onEvent(false);
      setText('');
    }
  };

  return (
    <div className="space-y-5">
      <div className="text-center">
        <p className="font-display text-xs uppercase tracking-[0.3em] text-ink-faint">
          The guardian demands{esc && <span className="ml-2 font-bold text-coral">· Escalation</span>}
        </p>
        <h3 className="mt-1 font-display text-2xl font-bold sm:text-3xl">
          {prompt.prompt}
        </h3>
      </div>

      <TimerBar total={total} running={!over} onExpire={() => finish(false)} hideSeconds={hidden} />

      <div className="flex justify-center gap-2" aria-label={`${found.length} of ${prompt.count} named`}>
        {Array.from({ length: prompt.count }, (_, i) => (
          <span
            key={i}
            className={`grid size-9 place-items-center rounded-full border-2 font-display text-sm font-bold transition ${
              i < found.length ? 'animate-pop border-hit bg-hit text-on-strong' : 'border-rule-strong text-ink-faint'
            }`}
          >
            {i < found.length ? '✓' : i + 1}
          </span>
        ))}
      </div>

      <input
        ref={input}
        value={text}
        disabled={over}
        onChange={(e) => {
          setText(e.target.value);
          tryText(e.target.value, false);
        }}
        onKeyDown={(e) => e.key === 'Enter' && tryText(text, true)}
        placeholder="Type a name…"
        autoComplete="off"
        autoCapitalize="off"
        spellCheck={false}
        className="w-full rounded-xl border border-rule-strong bg-card/90 px-4 py-3 text-center text-lg outline-none ring-accent/30 transition placeholder:text-ink-faint focus:border-accent focus:ring-4 disabled:opacity-50"
      />

      <p className="h-6 text-center text-sm font-semibold" aria-live="polite">
        {note && (
          <span key={note.key} className={`animate-pop inline-block ${note.good ? 'text-hit' : 'text-coral'}`}>
            {note.good ? `✓ ${note.text}` : note.text}
          </span>
        )}
      </p>

      {found.length > 0 && !hidden && (
        <ul className="flex flex-wrap justify-center gap-2">
          {found.map((n) => (
            <li key={n} className="animate-pop rounded-md border border-hit/50 bg-hit/10 px-2.5 py-1 text-sm font-semibold text-ink">
              {n}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
