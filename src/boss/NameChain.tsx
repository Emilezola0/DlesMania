import { useEffect, useMemo, useRef, useState } from 'react';
import type { SecretPhase } from '../lib/boss';
import { sfx } from '../lib/sfx';
import { withArticle } from '../lib/text';
import { findBestMatch, isFuzzyMatch, rankBySearch } from '../utils/textMatcher';
import type { BossCard } from '../types';
import { TimerBar } from './TimerBar';

export interface ChainResult {
  won: boolean;
  /** Good answers given. */
  score: number;
  /** Why it ended, shown on the results screen. */
  reason: string;
}

interface Props {
  secret: SecretPhase;
  bossName: string;
  /** The boss's picture cards, to show a portrait when the boss names one of them. */
  cards: BossCard[];
  okLines: string[];
  onSay: (text: string, mood: 'taunt' | 'hit' | 'hurt') => void;
  onDone: (result: ChainResult) => void;
}

interface Entity {
  key: string;
  name: string;
  aliases: string[];
  cat: number;
}

type Turn = 'boss' | 'answer' | 'ok' | 'over';

interface Said {
  who: 'boss' | 'you';
  entity: Entity;
}

const spellings = (e: Entity) => [e.name, ...e.aliases];

/**
 * Hard's secret phase. The boss names something of one category ("Character: Zoro"); the player
 * must answer with a different thing of the same category. Nothing named by either side may come
 * back. A wrong category, a repeat or running out of time loses on the spot; `picksToWin` good
 * answers win — and so does the boss running out of things to name.
 * Names the game doesn't know are rejected without penalty, so gaps in the data never cost a fight.
 */
export function NameChain({ secret, bossName, cards, okLines, onSay, onDone }: Props) {
  const { categories, picksToWin, turnSeconds, historyShown } = secret;
  const all = useMemo<Entity[]>(
    () => categories.flatMap((c, cat) => c.entities.map((e) => ({ ...e, cat, key: `${cat}:${e.name}` }))),
    [categories],
  );
  const [used, setUsed] = useState<Set<string>>(new Set());
  const [said, setSaid] = useState<Said[]>([]);
  const [call, setCall] = useState<Entity | null>(null);
  const [turn, setTurn] = useState<Turn>('boss');
  const [round, setRound] = useState(0);
  const [score, setScore] = useState(0);
  const [note, setNote] = useState<{ text: string; key: number } | null>(null);
  const [lost, setLost] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [active, setActive] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const timers = useRef<number[]>([]);
  const later = (ms: number, fn: () => void) => timers.current.push(window.setTimeout(fn, ms));
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const finish = (result: ChainResult) => {
    setTurn('over');
    later(result.won ? 1200 : 1700, () => onDone(result));
  };

  /** The boss's turn: a category that still has two unused names (one for each side), never the same one twice running if it can help it. */
  const bossTurn = (usedNow: Set<string>, last: number | null, scoreNow: number) => {
    const left = categories.map((_, cat) => all.filter((e) => e.cat === cat && !usedNow.has(e.key)));
    const eligible = left.map((l, cat) => (l.length >= 2 ? cat : -1)).filter((c) => c >= 0);
    if (!eligible.length) {
      sfx.streak();
      setTurn('over');
      onSay('Hmph… I have nothing left to name.', 'hit');
      return finish({ won: true, score: scoreNow, reason: `${bossName} ran out of names` });
    }
    const varied = eligible.length > 1 ? eligible.filter((c) => c !== last) : eligible;
    const cat = varied[Math.floor(Math.random() * varied.length)];
    const pick = left[cat][Math.floor(Math.random() * left[cat].length)];
    const next = new Set(usedNow).add(pick.key);
    setUsed(next);
    setCall(pick);
    setSaid((s) => [...s, { who: 'boss', entity: pick }]);
    setTurn('boss');
    sfx.select();
    later(700, () => {
      setTurn('answer');
      setRound((r) => r + 1);
      input.current?.focus({ preventScroll: true });
    });
  };

  // The boss opens.
  useEffect(() => {
    later(400, () => bossTurn(new Set(), null, 0));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const lose = (reason: string) => {
    setLost(reason);
    sfx.hurt();
    finish({ won: false, score, reason });
  };

  const answer = (e: Entity) => {
    if (turn !== 'answer' || !call) return;
    setText('');
    setActive(0);
    setNote(null);
    if (used.has(e.key)) return lose(`${e.name} was already named`);
    if (e.cat !== call.cat) return lose(`${e.name} is ${withArticle(categories[e.cat].label)}, not ${withArticle(categories[call.cat].label)}`);
    const next = new Set(used).add(e.key);
    const nextScore = score + 1;
    setUsed(next);
    setScore(nextScore);
    setSaid((s) => [...s, { who: 'you', entity: e }]);
    sfx.correct();
    if (nextScore >= picksToWin) {
      sfx.streak();
      return finish({ won: true, score: nextScore, reason: `${nextScore} good answers in a row` });
    }
    setTurn('ok');
    onSay(okLines[(nextScore - 1) % Math.max(1, okLines.length)] ?? 'Next.', 'hit');
    later(900, () => bossTurn(next, call.cat, nextScore));
  };

  const suggestions = useMemo(() => (text.trim() ? rankBySearch(text, all, spellings, 6) : []), [all, text]);

  const submitText = () => {
    // What was typed wins when it names something (typos forgiven); otherwise the highlighted suggestion.
    const typed = findBestMatch(text, all, spellings)?.item ?? suggestions[active];
    if (typed) return answer(typed);
    setNote({ text: `“${text.trim()}” — ${bossName} doesn't know that one. Try another name.`, key: Date.now() });
    setText('');
  };

  const portrait = call && cards.find((c) => isFuzzyMatch(call.name, [c.label, ...(c.aliases ?? [])]))?.image;
  const recent = said.slice(-historyShown);
  const hiddenCount = said.length - recent.length;

  return (
    <div className="space-y-4">
      <div className="text-center">
        <p className="boss-secret-title font-display text-xs font-bold uppercase tracking-[0.4em] text-coral">Secret phase · Name Chain</p>
        <h3 className="mt-1 font-display text-lg font-bold sm:text-xl">Answer with another of the same kind — never repeat a name.</h3>
      </div>

      <div className="flex items-center justify-center gap-1.5" aria-label={`${score} of ${picksToWin} answers`}>
        {Array.from({ length: picksToWin }, (_, i) => (
          <span
            key={i}
            className={`h-2 w-6 rounded-full transition ${i < score ? 'bg-hit' : lost && i === score ? 'animate-pop bg-coral' : 'bg-rule-strong'}`}
          />
        ))}
      </div>

      {/* The boss's call */}
      <div className="flex items-center gap-4 rounded-md border-2 border-coral/60 bg-card/70 p-3 sm:p-4">
        <span className="relative grid size-16 shrink-0 place-items-center overflow-hidden rounded-md bg-tile sm:size-20">
          {portrait ? <img src={portrait} alt="" className="size-full object-cover object-top" /> : <span className="font-display text-2xl text-ink-faint">?</span>}
        </span>
        <div className="min-w-0">
          <p className="font-display text-[11px] uppercase tracking-widest text-ink-faint">{bossName} names a…</p>
          {call ? (
            <p key={call.key} className="animate-pop">
              <span className="mr-2 inline-block rounded-sm bg-coral px-2 py-0.5 align-middle font-display text-xs font-bold uppercase tracking-widest text-on-strong">
                {categories[call.cat].label}
              </span>
              <span className="align-middle font-display text-xl font-bold sm:text-2xl">{call.name}</span>
            </p>
          ) : (
            <p className="font-display text-xl text-ink-faint">…</p>
          )}
        </div>
      </div>

      {turnSeconds > 0 && <TimerBar total={turnSeconds * 1000} running={turn === 'answer'} resetKey={round} onExpire={() => lose("Time's up")} hideSeconds />}

      <div className="relative">
        <input
          ref={input}
          value={text}
          disabled={turn !== 'answer'}
          onChange={(e) => {
            setText(e.target.value);
            setActive(0);
          }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setActive((a) => Math.min(a + 1, suggestions.length - 1));
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              setActive((a) => Math.max(a - 1, 0));
            } else if (e.key === 'Enter' && text.trim()) submitText();
          }}
          placeholder={
            turn === 'answer' && call ? `Another ${categories[call.cat].label.toLowerCase()}…` : turn === 'boss' ? `${bossName} is thinking…` : ''
          }
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          className="w-full rounded-xl border border-coral/60 bg-card/90 px-4 py-3 text-base outline-none ring-coral/30 transition placeholder:text-ink-faint focus:border-coral focus:ring-4 disabled:opacity-60"
        />
        {/* Suggestions cover every category, used names included: knowing which fits is the game. */}
        {suggestions.length > 0 && turn === 'answer' && (
          <ul className="animate-pop absolute z-20 mt-2 w-full overflow-hidden rounded-xl border border-rule-strong bg-card shadow-2xl">
            {suggestions.map((e, i) => (
              <li key={e.key}>
                <button
                  type="button"
                  onMouseEnter={() => setActive(i)}
                  onClick={() => answer(e)}
                  className={`w-full px-4 py-2.5 text-left font-medium ${i === active ? 'bg-accent-soft' : 'hover:bg-tile'}`}
                >
                  {e.name}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <p className="min-h-5 text-center text-sm font-semibold" aria-live="polite">
        {lost && <span className="animate-pop inline-block text-coral">✗ {lost}.</span>}
        {!lost && turn === 'ok' && <span className="animate-pop inline-block text-hit">✓ Good answer.</span>}
        {!lost && turn === 'answer' && note && (
          <span key={note.key} className="animate-pop inline-block text-ochre">
            {note.text}
          </span>
        )}
      </p>

      {/* Only the latest names stay visible; the rest must be remembered. */}
      <div className="space-y-1.5">
        <p className="font-display text-[11px] uppercase tracking-widest text-ink-faint">
          Named so far{hiddenCount > 0 ? ` · ${hiddenCount} more hidden — remember them` : ''}
        </p>
        <ul className="flex flex-wrap gap-1.5">
          {recent.map((s) => (
            <li
              key={`${s.who}-${s.entity.key}`}
              className={`rounded-md border px-2 py-1 text-xs font-semibold ${s.who === 'boss' ? 'border-coral/50 bg-coral/10' : 'border-hit/50 bg-hit/10'}`}
            >
              <span className="text-ink-faint">{s.who === 'boss' ? bossName.split(' ')[0] : 'You'}:</span> {s.entity.name}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

