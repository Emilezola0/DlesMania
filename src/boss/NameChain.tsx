import { useEffect, useMemo, useRef, useState } from 'react';
import { useTypeToFocus } from '../lib/focus';
import type { SecretPhase } from '../lib/boss';
import { withFrench, shownName } from '../lib/french';
import { sfx } from '../lib/sfx';
import { withArticle } from '../lib/text';
import { findBestMatch, isFuzzyMatch } from '../utils/textMatcher';
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

const spellings = (e: Entity) => withFrench([e.name, ...e.aliases]);

/**
 * Phase IV (Medium and Hard). The boss names something of one category ("Character: Zoro"); the player
 * must answer with a different thing of the same category. Nothing named by either side may come
 * back. A wrong category, a repeat or running out of time loses on the spot; `picksToWin` good
 * answers win — and so does the boss running out of things to name.
 * Names the game doesn't know are rejected without penalty, so gaps in the data never cost a fight.
 * There are no suggestions and no list of what was named: the player has to know the names and
 * remember the chain. Only the reason for a loss is shown.
 */
export function NameChain({ secret, bossName, cards, okLines, onSay, onDone }: Props) {
  const { categories, picksToWin, turnSeconds } = secret;
  const all = useMemo<Entity[]>(
    () => categories.flatMap((c, cat) => c.entities.map((e) => ({ ...e, cat, key: `${cat}:${e.name}` }))),
    [categories],
  );
  const [used, setUsed] = useState<Set<string>>(new Set());
  const [call, setCall] = useState<Entity | null>(null);
  const [turn, setTurn] = useState<Turn>('boss');
  const [round, setRound] = useState(0);
  const [score, setScore] = useState(0);
  const [note, setNote] = useState<{ text: string; key: number } | null>(null);
  const [lost, setLost] = useState<string | null>(null);
  const [text, setText] = useState('');
  const input = useRef<HTMLInputElement>(null);
  useTypeToFocus(input);
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
    setNote(null);
    if (used.has(e.key)) return lose(`${e.name} was already named`);
    if (e.cat !== call.cat) return lose(`${e.name} is ${withArticle(categories[e.cat].label)}, not ${withArticle(categories[call.cat].label)}`);
    const next = new Set(used).add(e.key);
    const nextScore = score + 1;
    setUsed(next);
    setScore(nextScore);
    sfx.correct();
    if (nextScore >= picksToWin) {
      sfx.streak();
      return finish({ won: true, score: nextScore, reason: `${nextScore} good answers in a row` });
    }
    setTurn('ok');
    onSay(okLines[(nextScore - 1) % Math.max(1, okLines.length)] ?? 'Next.', 'hit');
    later(900, () => bossTurn(next, call.cat, nextScore));
  };

  const submitText = () => {
    // Small typos are forgiven; anything else must be spelled out.
    const typed = findBestMatch(text, all, spellings)?.item;
    if (typed) return answer(typed);
    setNote({ text: `“${text.trim()}” — ${bossName} doesn't know that one. Try another name.`, key: Date.now() });
    setText('');
  };

  const portrait = call && cards.find((c) => isFuzzyMatch(call.name, withFrench([c.label, ...(c.aliases ?? [])])))?.image;

  return (
    <div className="space-y-4">
      <div className="text-center">
        <p className="font-display text-xs font-bold uppercase tracking-[0.4em] text-accent">Phase IV · Name Chain</p>
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
              <span className="align-middle font-display text-xl font-bold sm:text-2xl">{shownName(call.name)}</span>
            </p>
          ) : (
            <p className="font-display text-xl text-ink-faint">…</p>
          )}
        </div>
      </div>

      {turnSeconds > 0 && <TimerBar total={turnSeconds * 1000} running={turn === 'answer'} resetKey={round} onExpire={() => lose("Time's up")} hideSeconds />}

      <div>
        <input
          ref={input}
          value={text}
          disabled={turn !== 'answer'}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && text.trim()) submitText();
          }}
          placeholder={
            turn === 'answer' && call ? `Another ${categories[call.cat].label.toLowerCase()}…` : turn === 'boss' ? `${bossName} is thinking…` : ''
          }
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          className="w-full rounded-xl border border-coral/60 bg-card/90 px-4 py-3 text-base outline-none ring-coral/30 transition placeholder:text-ink-faint focus:border-coral focus:ring-4 disabled:opacity-60"
        />
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
    </div>
  );
}

