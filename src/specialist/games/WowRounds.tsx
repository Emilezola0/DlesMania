import { useState } from 'react';
import { ZoomImage } from '../../components/ZoomImage';
import { mulberry32 } from '../../lib/rng';
import type { RoundRecord } from '../../types';
import { WOW, telltaleTitles, wowCharacterById, type WowCharacter } from '../wow';
import type { SpRound } from '../rounds';
import { SpGuessRound } from './SpGuessRound';

interface Props {
  round: SpRound;
  record: RoundRecord;
  onChange: (record: RoundRecord) => void;
}

/** Facts about a character, vaguest first. */
function characterHints(c: WowCharacter): string[] {
  return [
    `Faction: ${c.faction}`,
    `Race: ${c.race}`,
    c.class !== 'None' ? `Class: ${c.class}` : `Status: ${c.status}`,
    `Status: ${c.status} · ${c.gender}`,
    `Their name starts with “${c.name[0]}”`,
  ];
}

const detail = (c: WowCharacter) => `${c.race} · ${c.faction}${c.class !== 'None' ? ` · ${c.class}` : ''}`;

/** Art: a tight crop of the character's art, pulling back with each miss. */
export function WowArtRound({ round, record, onChange }: Props) {
  const c = wowCharacterById.get(round.targetId)!;
  const [focus] = useState<[number, number]>(() => {
    const rand = mulberry32(round.seed);
    return [35 + Math.round(rand() * 30), 25 + Math.round(rand() * 30)];
  });
  return (
    <SpGuessRound
      type="art"
      question="Who is in this picture?"
      pool={WOW.characters}
      targetId={c.id}
      hints={characterHints(c)}
      record={record}
      onChange={onChange}
      answer={{ name: c.name, image: c.image, detail: detail(c) }}
      noPictures
      clue={(wrong, done) => <ZoomImage src={c.art!} alt="Character art" step={wrong} revealed={done} focus={focus} />}
    />
  );
}

/** Silhouette: a transparent render, blacked out. */
export function WowSilhouetteRound({ round, record, onChange }: Props) {
  const c = wowCharacterById.get(round.targetId)!;
  return (
    <SpGuessRound
      type="silhouette"
      question="Who is hiding in the shadow?"
      pool={WOW.characters}
      targetId={c.id}
      hints={characterHints(c)}
      record={record}
      onChange={onChange}
      answer={{ name: c.name, image: c.image, detail: detail(c) }}
      clue={(_, done) => (
        <div
          className="relative mx-auto aspect-square w-full max-w-xs overflow-hidden rounded-xl"
          style={{ background: 'radial-gradient(circle at 50% 45%, #fde68a 0%, #d97706 38%, #1e3a8a 78%)' }}
        >
          <img
            src={c.render}
            alt={done ? c.name : 'Silhouette'}
            draggable={false}
            onContextMenu={(e) => e.preventDefault()}
            className="absolute inset-0 size-full select-none object-contain p-4 transition-[filter] duration-500"
            style={{ filter: done ? 'none' : 'brightness(0) drop-shadow(0 4px 10px rgb(0 0 0 / 0.35))' }}
          />
        </div>
      )}
    />
  );
}

/** Titles: the character's titles, one more with each miss. */
export function WowTitlesRound({ round, record, onChange }: Props) {
  const c = wowCharacterById.get(round.targetId)!;
  const titles = telltaleTitles(c);
  return (
    <SpGuessRound
      type="titles"
      question="Who goes by these titles?"
      pool={WOW.characters}
      targetId={c.id}
      hints={characterHints(c).slice(0, 3)}
      record={record}
      onChange={onChange}
      answer={{ name: c.name, image: c.image, detail: detail(c) }}
      clue={(wrong, done) => (
        <ul className="space-y-2 py-2 text-center">
          {titles.slice(0, done ? titles.length : Math.min(titles.length, 1 + wrong)).map((t) => (
            <li key={t} className="animate-pop font-serif text-2xl font-bold italic sm:text-3xl">
              “{t}”
            </li>
          ))}
          {!done && titles.length > 1 + wrong && <li className="font-display text-[11px] uppercase tracking-widest text-ink-faint">Another title with each miss</li>}
        </ul>
      )}
    />
  );
}
