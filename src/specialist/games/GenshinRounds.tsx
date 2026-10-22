import { useState } from 'react';
import { ZoomImage } from '../../components/ZoomImage';
import { useCutout } from '../../lib/cutout';
import { mulberry32 } from '../../lib/rng';
import type { RoundRecord } from '../../types';
import { GENSHIN, giCharacterById, type GiCharacter } from '../genshin';
import type { SpRound } from '../rounds';
import { SpGuessRound } from './SpGuessRound';

interface Props {
  round: SpRound;
  record: RoundRecord;
  onChange: (record: RoundRecord) => void;
}

/** Facts about a character, vaguest first. */
function characterHints(c: GiCharacter): string[] {
  return [
    `Region: ${c.region}`,
    `Element: ${c.element}`,
    `Weapon: ${c.weapon} · ${c.rarity}★`,
    c.title ? `Their title: “${c.title}”` : `Affiliation: ${c.affiliation}`,
    `Their name starts with “${c.name[0]}”`,
  ];
}

/** Wish Art: a tight crop of the wish splash, pulling back with each miss. */
export function WishRound({ round, record, onChange }: Props) {
  const c = giCharacterById.get(round.targetId)!;
  const [focus] = useState<[number, number]>(() => {
    const rand = mulberry32(round.seed);
    return [35 + Math.round(rand() * 30), 30 + Math.round(rand() * 30)];
  });
  return (
    <SpGuessRound
      type="wish"
      question="Whose wish art is this?"
      pool={GENSHIN.characters}
      targetId={c.id}
      hints={characterHints(c)}
      record={record}
      onChange={onChange}
      answer={{ name: c.name, image: c.image, detail: `${c.element} · ${c.weapon} · ${c.region}` }}
      clue={(wrong, done) => <ZoomImage src={c.wish!} alt="Wish art" step={wrong} revealed={done} focus={focus} />}
    />
  );
}

/** Silhouette: the official portrait with its white background cut away, then blacked out. */
export function GiSilhouetteRound({ round, record, onChange }: Props) {
  const c = giCharacterById.get(round.targetId)!;
  const picture = useCutout(c.portrait, true);
  return (
    <SpGuessRound
      type="silhouette"
      question="Who is hiding in the shadow?"
      pool={GENSHIN.characters}
      targetId={c.id}
      hints={characterHints(c)}
      record={record}
      onChange={onChange}
      answer={{ name: c.name, image: c.image, detail: `${c.element} · ${c.region}` }}
      clue={(_, done) => (
        <div
          className="relative mx-auto aspect-square w-full max-w-xs overflow-hidden rounded-xl"
          style={{ background: 'radial-gradient(circle at 50% 45%, #fde68a 0%, #f59e0b 35%, #1d4ed8 75%)' }}
        >
          {picture && (
            <img
              src={picture}
              alt={done ? c.name : 'Silhouette'}
              draggable={false}
              onContextMenu={(e) => e.preventDefault()}
              className="absolute inset-0 size-full select-none object-contain p-4 transition-[filter] duration-500"
              style={{ filter: done ? 'none' : 'brightness(0) drop-shadow(0 4px 10px rgb(0 0 0 / 0.35))' }}
            />
          )}
        </div>
      )}
    />
  );
}

/** Constellation: the name of a character's constellation. */
export function ConstellationRound({ round, record, onChange }: Props) {
  const c = giCharacterById.get(round.targetId)!;
  return (
    <SpGuessRound
      type="constellation"
      question="Whose constellation is this?"
      pool={GENSHIN.characters}
      targetId={c.id}
      hints={characterHints(c)}
      record={record}
      onChange={onChange}
      answer={{ name: c.name, image: c.image, detail: `Constellation: ${c.constellation}` }}
      clue={() => (
        <div className="space-y-1 py-6 text-center">
          <p className="font-display text-[11px] uppercase tracking-[0.3em] text-ink-faint">Constellation</p>
          <p className="font-serif text-4xl font-bold italic sm:text-5xl">✦ {c.constellation} ✦</p>
        </div>
      )}
    />
  );
}
