import { useMemo, type ReactNode } from 'react';
import { GuessInput } from '../components/GuessInput';
import { Outcome } from '../components/Outcome';
import { candidates, domainInfo, getWork } from '../data';
import { hintsFor } from '../lib/hints';
import { scoreFor } from '../lib/scoring';
import type { GameProps, GameType, Work } from '../types';
import { GAME_META } from './meta';
import { PixelCanvas } from './PixelCanvas';

function Label({ children }: { children: ReactNode }) {
  return <p className="text-center text-xs uppercase tracking-widest text-zinc-500">{children}</p>;
}

/** The main clue for each text/visual single-answer mini-game. */
function Clue({ type, w, wrong, done }: { type: GameType; w: Work; wrong: number; done: boolean }) {
  switch (type) {
    case 'quote':
      return (
        <blockquote className="text-center font-serif text-2xl italic leading-relaxed text-white sm:text-3xl">
          “{w.quote!.text}”
        </blockquote>
      );
    case 'audio':
      return (
        <div className="flex flex-col items-center gap-5 text-center">
          <div className="flex h-12 items-end gap-1" aria-hidden>
            {Array.from({ length: 24 }, (_, i) => (
              <span
                key={i}
                className="w-1.5 animate-pulse rounded-full bg-gradient-to-t from-indigo-500 to-pink-400"
                style={{ height: `${20 + ((i * 37) % 80)}%`, animationDelay: `${(i % 6) * 120}ms` }}
              />
            ))}
          </div>
          <p className="text-lg leading-relaxed text-zinc-100 sm:text-xl">{w.audio}</p>
        </div>
      );
    case 'emoji': {
      const glyphs = Array.from(new Intl.Segmenter().segment(w.emoji!), (s) => s.segment);
      // Start with two emojis and reveal one more per wrong guess.
      const shown = done ? glyphs.length : Math.min(glyphs.length, 2 + wrong);
      return (
        <div className="flex flex-wrap justify-center gap-3 text-5xl sm:text-6xl">
          {glyphs.map((g, i) =>
            i < shown ? (
              <span key={i} className="animate-pop">{g}</span>
            ) : (
              <span key={i} className="flex size-14 items-center justify-center rounded-xl bg-zinc-800 text-2xl text-zinc-600 sm:size-16">?</span>
            ),
          )}
        </div>
      );
    }
    case 'visual':
      return <PixelCanvas icon={w.visual!.icon} colors={w.visual!.colors} step={done ? 99 : wrong} />;
    case 'item':
      return (
        <div className="space-y-2">
          <Label>Iconic item</Label>
          <p className="text-center text-xl leading-relaxed text-zinc-100 sm:text-2xl">{w.item!.description}</p>
        </div>
      );
    case 'location':
      return (
        <div className="space-y-2">
          <Label>Setting</Label>
          <p className="text-center text-xl leading-relaxed text-zinc-100 sm:text-2xl">{w.location!.description}</p>
        </div>
      );
    case 'creator':
      return (
        <div className="space-y-2">
          <Label>Credits</Label>
          <p className="text-center text-2xl font-semibold text-zinc-100">{w.credits[0]}</p>
        </div>
      );
    default:
      return null;
  }
}

/** Shared engine for the quote, soundtrack, emoji, pixelated, item, location and credits games. */
export default function ClueGame({ spec, record, onChange }: GameProps) {
  const target = getWork(spec.targetId!);
  const meta = GAME_META[spec.type];
  const pool = useMemo(() => candidates('classic', target.domain), [target.domain]);
  const hints = useMemo(() => hintsFor(spec.type, target), [spec.type, target]);
  const wrong = record.guesses.filter((g) => g !== target.id);
  const done = record.status !== 'playing';
  const revealed = done ? hints.length : Math.min(wrong.length, hints.length);

  const guess = (id: string) => {
    const guesses = [...record.guesses, id];
    const won = id === target.id;
    const status = won ? 'won' : guesses.length >= meta.maxAttempts ? 'lost' : 'playing';
    onChange({ status, guesses, score: won ? scoreFor(spec.type, guesses.length) : 0 });
  };

  return (
    <div className="space-y-6">
      <p className="text-center text-zinc-300">
        Which <span className="font-semibold text-white">{domainInfo(target.domain).noun}</span> is this?
      </p>

      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6 sm:p-10">
        <Clue type={spec.type} w={target} wrong={wrong.length} done={done} />
      </div>

      {!done && (
        <GuessInput pool={pool} exclude={record.guesses} onGuess={guess} placeholder={`Search ${domainInfo(target.domain).label}…`} />
      )}

      <div className="flex justify-center gap-1.5" aria-label="Attempts">
        {Array.from({ length: meta.maxAttempts }, (_, i) => {
          const g = record.guesses[i];
          const cls = !g ? 'bg-zinc-800' : g === target.id ? 'bg-hit' : 'bg-miss';
          return <span key={i} className={`h-2 w-8 rounded-full transition-colors ${cls}`} />;
        })}
      </div>

      {revealed > 0 && (
        <ul className="space-y-2">
          {hints.slice(0, revealed).map((h) => (
            <li key={h} className="animate-pop rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-sm text-amber-100">
              💡 {h}
            </li>
          ))}
        </ul>
      )}

      {wrong.length > 0 && (
        <div className="flex flex-wrap justify-center gap-2">
          {wrong.map((id) => (
            <span key={id} className="animate-shake rounded-lg bg-red-500/15 px-3 py-1 text-sm text-red-300 line-through">
              {getWork(id).name}
            </span>
          ))}
        </div>
      )}

      <Outcome record={record} answer={target} />
    </div>
  );
}
