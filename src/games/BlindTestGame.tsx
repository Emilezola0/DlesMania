import { useMemo } from 'react';
import { AudioClip } from '../components/AudioClip';
import { GuessInput } from '../components/GuessInput';
import { candidates, getWork } from '../data';
import { shownName } from '../lib/french';
import { tr } from '../lib/i18n';
import { sfx } from '../lib/sfx';
import type { GameProps, RoundRecord, Work } from '../types';

/** What a song's guess may be besides a work id: passed, or its clip would not play (it then doesn't count). */
export const BLIND_PASS = '-';
export const BLIND_BROKEN = '!';
/** How long each song plays (seconds), replayable. */
const LENGTHS = [8];

/** Where each song's snippet starts (0–1), from the round's seed and the song's place: 20–65 % of the way in. */
const blindAt = (seed: number, i: number) => 0.2 + (((seed >>> 0) + i * 389) % 1000) / 1000 * 0.45;

/** The round's record once a song has been answered: over after the last song, won at 60 % of the songs that played. */
export function blindRecord(ids: string[], guesses: string[]): RoundRecord {
  if (guesses.length < ids.length) return { status: 'playing', guesses, score: 0 };
  const played = guesses.filter((g) => g !== BLIND_BROKEN).length;
  const found = guesses.filter((g, i) => g === ids[i]).length;
  const score = played ? Math.round((100 * found) / played) : 100;
  return { status: score >= 60 ? 'won' : 'lost', guesses, score };
}

/** Blind Test (Music): five songs in a row, a few seconds of each, one try or a pass per song. */
export default function BlindTestGame({ spec, record, onChange }: GameProps) {
  const ids = spec.workIds ?? [];
  const songs = useMemo(() => ids.map(getWork), [ids]);
  const pool = useMemo(() => candidates('classic', 'music'), []);
  const index = record.guesses.length;
  const done = record.status !== 'playing';
  const current: Work | undefined = done ? undefined : songs[index];

  const answer = (g: string) => {
    const next = blindRecord(ids, [...record.guesses, g]);
    // A song in the middle of the round: its own sound (the host plays the round's end).
    if (next.status === 'playing' && g !== BLIND_BROKEN) (g === ids[index] ? sfx.correct : sfx.wrong)();
    onChange(next);
  };

  return (
    <div className="space-y-6">
      <p className="text-center text-ink-soft">
        {tr('Five songs, one try each.', 'Cinq chansons, un essai chacune.')}{' '}
        {!done && (
          <span className="font-semibold text-ink">
            {tr('Song', 'Chanson')} {index + 1}/{ids.length}
          </span>
        )}
      </p>

      {current?.audio?.youtubeId && (
        <div className="page rounded-md p-5 sm:p-8">
          <AudioClip
            key={current.id}
            videoId={current.audio.youtubeId}
            at={blindAt(spec.seed, index)}
            step={0}
            lengths={LENGTHS}
            revealed={false}
            onUnavailable={() => answer(BLIND_BROKEN)}
            note={tr('Listen as often as you like, then name it or pass: one try per song.', 'Écoute autant que tu veux, puis nomme-la ou passe : un essai par chanson.')}
          />
        </div>
      )}

      {!done && (
        <div className="space-y-2">
          <GuessInput pool={pool} exclude={record.guesses} onGuess={answer} placeholder={tr('Name the song…', 'Nomme la chanson…')} />
          <div className="text-center">
            <button type="button" onClick={() => answer(BLIND_PASS)} className="btn-paper rounded-md px-4 py-1.5 text-sm font-semibold">
              {tr('Pass', 'Passer')}
            </button>
          </div>
        </div>
      )}

      {/* The songs so far: each one's answer shown as soon as it's played, with what was said. */}
      {record.guesses.length > 0 && (
        <ol className="space-y-2">
          {record.guesses.map((g, i) => {
            const w = songs[i];
            const hit = g === w.id;
            const said = g === BLIND_PASS ? tr('passed', 'passé') : g === BLIND_BROKEN ? tr('clip unavailable', 'extrait indisponible') : getWork(g).name;
            return (
              <li
                key={w.id}
                className={`animate-pop flex items-center gap-3 rounded-lg border px-4 py-2.5 ${
                  hit ? 'border-hit/50 bg-hit/10' : g === BLIND_BROKEN ? 'border-rule bg-tile/50' : 'border-miss/50 bg-miss/10'
                }`}
              >
                <span className="font-mono text-xs text-ink-faint">{i + 1}</span>
                {w.cover?.image && <img src={w.cover.image} alt="" className="size-10 rounded object-cover" />}
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{shownName(w.name)}</p>
                  <p className="text-xs text-ink-soft">
                    {/* A game's or an anime's song: where it's from; a plain song: its artist (its studio is its label). */}
                    {w.format && w.format !== 'Song' ? w.studio : w.creator} · {w.year}
                  </p>
                </div>
                <span className={`text-sm ${hit ? 'text-hit' : 'text-ink-faint'}`}>{hit ? '✓' : g === BLIND_BROKEN ? said : <s>{said}</s>}</span>
              </li>
            );
          })}
        </ol>
      )}

      {done && (
        <div
          className={`animate-pop flex items-center justify-between rounded-lg border p-5 ${record.status === 'won' ? 'border-hit/50 bg-hit/10' : 'border-miss/50 bg-miss/10'}`}
        >
          <p className="font-display text-sm uppercase tracking-widest text-ink-soft">
            {record.guesses.filter((g, i) => g === ids[i]).length}/{record.guesses.filter((g) => g !== BLIND_BROKEN).length} {tr('songs found', 'chansons trouvées')}
          </p>
          <p className={`text-4xl font-black ${record.status === 'won' ? 'text-hit' : 'text-miss'}`}>+{record.score}</p>
        </div>
      )}
    </div>
  );
}
