import { useMemo, useState, type ReactNode } from 'react';
import { AudioClip, SNIPPETS } from '../components/AudioClip';
import { BlurImage } from '../components/BlurImage';
import { GuessInput } from '../components/GuessInput';
import { Outcome } from '../components/Outcome';
import { TilePuzzle } from '../components/TilePuzzle';
import { ZoomImage } from '../components/ZoomImage';
import { candidates, domainInfo, getWork } from '../data';
import { hintsFor } from '../lib/hints';
import { scoreFor } from '../lib/scoring';
import type { GameProps, GameType, Work } from '../types';
import { GAME_META } from './meta';
import { PixelCanvas } from './PixelCanvas';

function Label({ children }: { children: ReactNode }) {
  return <p className="text-center text-xs font-display uppercase tracking-widest text-ink-faint">{children}</p>;
}

function TextClue({ children }: { children: ReactNode }) {
  return <p className="text-center font-serif text-2xl leading-relaxed text-ink sm:text-3xl">{children}</p>;
}

interface ClueProps {
  type: GameType;
  w: Work;
  seed: number;
  wrong: number;
  done: boolean;
  /** Which media failed to load or play this round; those rounds fall back gracefully. */
  broken: Set<string>;
  onBroken: (what: string) => void;
}

/** Which primary text clue (if any) is on screen, so the hints don't repeat it. */
export function textClueShown(type: GameType, w: Work, broken: Set<string>): boolean {
  if (type === 'item') return !w.item?.image || broken.has('item');
  if (type === 'location') return !w.location?.image || broken.has('location');
  if (type === 'audio') {
    const clip = !!w.audio?.youtubeId && !broken.has('clip');
    const coverZoom = !!w.cover?.image && !broken.has('cover');
    return !clip && !coverZoom;
  }
  return false;
}

/** The main clue for each single-answer mini-game. */
function Clue({ type, w, seed, wrong, done, broken, onBroken }: ClueProps) {
  switch (type) {
    case 'quote':
      if (!w.quote && w.tracks) {
        // Albums: reveal one more track title per miss.
        const shown = done ? w.tracks.length : Math.min(w.tracks.length, 1 + wrong);
        return (
          <div className="space-y-3">
            <Label>Tracklist</Label>
            <ol className="mx-auto max-w-sm space-y-2">
              {w.tracks.map((t, i) => (
                <li key={t} className={`flex items-center gap-3 rounded-lg px-4 py-2.5 ${i < shown ? 'animate-pop bg-tile' : 'bg-tile/50'}`}>
                  <span className="font-mono text-xs text-ink-faint">{String(i + 1).padStart(2, '0')}</span>
                  <span className={i < shown ? 'font-semibold text-ink' : 'select-none text-ink-faint/70 blur-[3px]'}>{i < shown ? t : '████████████'}</span>
                </li>
              ))}
            </ol>
          </div>
        );
      }
      return (
        <blockquote className="text-center font-serif text-2xl italic leading-relaxed text-ink sm:text-3xl">“{w.quote!.text}”</blockquote>
      );

    case 'audio': {
      if (w.audio?.youtubeId && !broken.has('clip')) {
        return (
          <AudioClip videoId={w.audio.youtubeId} start={w.audio.start} step={Math.min(wrong, SNIPPETS.length - 1)} revealed={done} onUnavailable={() => onBroken('clip')} />
        );
      }
      // No playable clip: a zoomed-in detail of the cover instead, then plain text as a last resort.
      if (w.cover?.image && !broken.has('cover')) {
        return (
          <div className="space-y-3">
            <Label>Zoomed-in detail</Label>
            <ZoomImage src={w.cover.image} alt={w.name} step={wrong} revealed={done} focus={[50, 42]} onError={() => onBroken('cover')} />
          </div>
        );
      }
      return (
        <div className="flex flex-col items-center gap-5 text-center">
          <div className="flex h-12 items-end gap-1" aria-hidden>
            {Array.from({ length: 24 }, (_, i) => (
              <span key={i} className="w-1.5 animate-eq rounded-full bg-accent" style={{ height: `${20 + ((i * 37) % 80)}%`, animationDelay: `${(i % 6) * 120}ms` }} />
            ))}
          </div>
          <TextClue>{w.audio!.clue}</TextClue>
        </div>
      );
    }

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
              <span key={i} className="flex size-14 items-center justify-center rounded-xl bg-tile text-2xl text-ink-faint/70 sm:size-16">?</span>
            ),
          )}
        </div>
      );
    }

    case 'visual':
      return <PixelCanvas src={w.cover?.image} icon={w.visual?.icon ?? '❔'} colors={w.visual?.colors ?? ['#27272a', '#52525b']} step={done ? 99 : wrong} />;

    case 'item':
      if (w.item?.image && !broken.has('item')) {
        return (
          <div className="space-y-3">
            <Label>Iconic item</Label>
            <BlurImage src={w.item.image} alt={w.item.name} step={wrong} revealed={done} onError={() => onBroken('item')} />
          </div>
        );
      }
      return (
        <div className="space-y-2">
          <Label>Iconic item</Label>
          <TextClue>{w.item!.description}</TextClue>
        </div>
      );

    case 'location':
      if (w.location?.image && !broken.has('location')) {
        return (
          <div className="space-y-3">
            <Label>Where is this?</Label>
            <ZoomImage src={w.location.image} alt={w.location.name} step={wrong} revealed={done} focus={w.location.focus} onError={() => onBroken('location')} />
          </div>
        );
      }
      return (
        <div className="space-y-2">
          <Label>Setting</Label>
          <TextClue>{w.location!.description}</TextClue>
        </div>
      );

    case 'tiles':
      return (
        <div className="space-y-3">
          <Label>Restore the cover</Label>
          <TilePuzzle src={w.cover!.image!} seed={seed} assists={wrong} revealed={done} onError={() => onBroken('cover')} />
        </div>
      );

    default:
      return null;
  }
}

/** Shared engine for the quote, soundtrack, emoji, pixelated, item, location and cover-puzzle games. */
export default function ClueGame({ spec, record, onChange }: GameProps) {
  const target = getWork(spec.targetId!);
  const meta = GAME_META[spec.type];
  const [broken, setBroken] = useState<Set<string>>(new Set());
  const pool = useMemo(() => candidates('classic', target.domain), [target.domain]);
  const textShown = textClueShown(spec.type, target, broken);
  const hints = useMemo(() => hintsFor(spec.type, target, { textClueShown: textShown }), [spec.type, target, textShown]);
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
      <p className="text-center text-ink-soft">
        Which <span className="font-semibold text-ink">{domainInfo(target.domain).noun}</span> is this?
      </p>

      <div className="page rounded-md p-5 sm:p-8">
        <Clue
          type={spec.type}
          w={target}
          seed={spec.seed}
          wrong={wrong.length}
          done={done}
          broken={broken}
          onBroken={(what) => setBroken((b) => new Set(b).add(what))}
        />
      </div>

      {!done && <GuessInput pool={pool} exclude={record.guesses} onGuess={guess} placeholder={`Search ${domainInfo(target.domain).label}…`} />}

      <div className="flex justify-center gap-1.5" aria-label="Attempts">
        {Array.from({ length: meta.maxAttempts }, (_, i) => {
          const g = record.guesses[i];
          const cls = !g ? 'bg-tile' : g === target.id ? 'bg-hit' : 'bg-miss';
          return <span key={i} className={`h-2 w-8 rounded-full transition-colors duration-500 ${cls}`} />;
        })}
      </div>

      {revealed > 0 && (
        <ul className="space-y-2">
          {hints.slice(0, revealed).map((h) => (
            <li key={h} className="animate-pop rounded-lg border border-near/50 bg-near/15 px-4 py-2 text-sm text-ink">
              💡 {h}
            </li>
          ))}
        </ul>
      )}

      {wrong.length > 0 && (
        <div className="flex flex-wrap justify-center gap-2">
          {wrong.map((id) => (
            <span key={id} className="animate-shake rounded-lg bg-miss/15 px-3 py-1 text-sm text-miss line-through">
              {getWork(id).name}
            </span>
          ))}
        </div>
      )}

      <Outcome record={record} answer={target} />
    </div>
  );
}
