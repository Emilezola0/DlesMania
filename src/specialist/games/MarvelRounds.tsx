import { useState } from 'react';
import { AudioClip } from '../../components/AudioClip';
import { ZoomImage } from '../../components/ZoomImage';
import { mulberry32 } from '../../lib/rng';
import type { RoundRecord } from '../../types';
import { MARVEL, filmById, introducedIn, mcuCharacterById, type McuFilm } from '../marvel';
import type { SpRound } from '../rounds';
import { SpGuessRound } from './SpGuessRound';

interface Props {
  round: SpRound;
  record: RoundRecord;
  onChange: (record: RoundRecord) => void;
}

/** Facts about a film, vaguest first. */
function filmHints(f: McuFilm): string[] {
  const debut = introducedIn(f.id)[0];
  return [
    `Released in ${f.year} (Phase ${f.phase})`,
    `Directed by ${f.director}`,
    f.boxOffice && `Box office: ${f.boxOffice}`,
    debut && `Introduces ${debut.name}`,
    `Its title starts with “${f.name[0]}”`,
  ].filter((h): h is string => !!h);
}

/** Film: a tight crop of the poster, pulling back with each miss. */
export function FilmRound({ round, record, onChange }: Props) {
  const f = filmById.get(round.targetId)!;
  const [focus] = useState<[number, number]>(() => {
    // Off-centre, but away from the top and bottom where posters print the title.
    const rand = mulberry32(round.seed);
    return [30 + Math.round(rand() * 40), 32 + Math.round(rand() * 24)];
  });
  return (
    <SpGuessRound
      type="film"
      question="Which MCU film is this poster from?"
      pool={MARVEL.films}
      targetId={f.id}
      hints={filmHints(f)}
      record={record}
      onChange={onChange}
      answer={{ name: f.name, image: f.poster, detail: `${f.year} · Phase ${f.phase} · ${f.director}` }}
      clue={(wrong, done) => <ZoomImage src={f.poster!} alt="Film poster" step={wrong} revealed={done} focus={focus} />}
    />
  );
}

/** Emoji: the film told in emojis. */
export function EmojiFilmRound({ round, record, onChange }: Props) {
  const f = filmById.get(round.targetId)!;
  return (
    <SpGuessRound
      type="emoji"
      question="Which MCU film do these emojis tell?"
      pool={MARVEL.films}
      targetId={f.id}
      hints={filmHints(f)}
      record={record}
      onChange={onChange}
      answer={{ name: f.name, image: f.poster, detail: `${f.year} · Phase ${f.phase}` }}
      clue={() => <p className="py-6 text-center text-5xl tracking-[0.25em] sm:text-6xl">{f.emoji}</p>}
    />
  );
}

/** Snippet lengths for a voice line, in seconds: one more per miss. */
const VOICE_LENGTHS = [2, 4, 7, 12, 20];

/** Voice Line: the character speaking in the original English version, in growing snippets. */
export function VoiceRound({ round, record, onChange }: Props) {
  const c = mcuCharacterById.get(round.targetId)!;
  const debut = filmById.get(c.debut);
  const [broken, setBroken] = useState(false);
  const hints = [
    debut && `First appears in ${debut.name} (${debut.year})`,
    c.team !== 'None' ? `Team: ${c.team}` : `Species: ${c.species}`,
    `${c.status === 'Deceased' ? 'Has died' : c.status === 'Alive' ? 'Still alive' : 'Fate unknown'} as of the latest film`,
    c.actor && `Played by ${c.actor}`,
    `Their name starts with “${c.name[0]}”`,
  ].filter((h): h is string => !!h);
  return (
    <SpGuessRound
      type="voice"
      question="Which MCU character is speaking?"
      pool={MARVEL.characters}
      targetId={c.id}
      // Without the clip, the vaguest fact is given away for free.
      hints={broken ? hints.slice(1) : hints}
      record={record}
      onChange={onChange}
      answer={{ name: c.name, image: c.image, detail: c.actor ? `Played by ${c.actor}` : debut?.name }}
      clue={(wrong, done) =>
        c.voice && !broken ? (
          <div className="space-y-3">
            <p className="text-center font-display text-xs uppercase tracking-widest text-ink-faint">Listen · original English voice</p>
            <AudioClip
              videoId={c.voice.youtubeId}
              start={c.voice.start ?? 0}
              step={Math.min(wrong, VOICE_LENGTHS.length - 1)}
              lengths={VOICE_LENGTHS}
              revealed={done}
              onUnavailable={() => setBroken(true)}
            />
          </div>
        ) : (
          <div className="space-y-2 py-6 text-center">
            <p className="font-display text-5xl">🎙️</p>
            <p className="font-display text-lg font-bold">{hints[0]}</p>
            <p className="text-sm text-ink-soft">This clip won't play — go by the clues.</p>
          </div>
        )
      }
    />
  );
}
