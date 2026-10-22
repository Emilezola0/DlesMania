import { useState } from 'react';
import { AudioClip } from '../../components/AudioClip';
import { ObscuredImage } from '../../components/ObscuredImage';
import type { RoundRecord } from '../../types';
import { ONE_PIECE, SILHOUETTE_OF, characterById, crewById, formatBounty, fruitById, type OpCharacter } from '../data';
import type { SpRound } from '../rounds';
import { SpGuessRound } from './SpGuessRound';

interface Props {
  round: SpRound;
  record: RoundRecord;
  onChange: (record: RoundRecord) => void;
}

const fruitNames = ONE_PIECE.fruits;
const crewNames = ONE_PIECE.crews;
const characters = ONE_PIECE.characters;

/** Short facts about a character, vaguest first, for the rounds that ask for one. */
function characterHints(c: OpCharacter): string[] {
  return [
    `Affiliation: ${c.affiliation}`,
    `First appeared in the ${c.arc} arc`,
    c.fruit[0] === 'None' ? 'Has not eaten a Devil Fruit' : `Devil Fruit type: ${c.fruitType.join(' & ')}`,
    c.bounty ? `Bounty: ${formatBounty(c.bounty)} berries` : 'No known bounty',
    `Their name starts with “${c.name[0]}”`,
  ];
}

/** Devil Fruit: the fruit's picture (when it's been shown), opening up with each miss; hints from its facts. */
export function FruitRound({ round, record, onChange }: Props) {
  const f = fruitById.get(round.targetId)!;
  const [broken, setBroken] = useState(false);
  const picture = f.image && !broken;
  const hints = [
    `Type: ${f.type}`,
    f.meaning && `Its name comes from “${f.meaning}”`,
    f.arc && `First seen in the ${f.arc} arc`,
    f.english && `English name: ${f.english}`,
    f.users.length ? `Eaten by ${f.users.join(' & ')}` : null,
  ].filter((h): h is string => !!h);
  return (
    <SpGuessRound
      type="fruit"
      question="Which Devil Fruit is this?"
      pool={fruitNames}
      targetId={f.id}
      // No picture: the first fact is given away for free.
      hints={picture ? hints : hints.slice(1)}
      record={record}
      onChange={onChange}
      answer={{ name: f.name, image: f.image, detail: [f.english, f.type, f.users.join(' & ')].filter(Boolean).join(' · ') }}
      clue={(wrong, done) =>
        picture ? (
          <ObscuredImage src={f.image!} alt="Devil Fruit" step={wrong} revealed={done} seed={round.seed} onError={() => setBroken(true)} />
        ) : (
          <div className="space-y-2 py-6 text-center">
            <p className="font-display text-5xl">🍈</p>
            <p className="font-display text-lg font-bold">{hints[0]}</p>
            <p className="text-sm text-ink-soft">This fruit's look was never shown — go by the clues.</p>
          </div>
        )
      }
    />
  );
}

/** Laugh: the character's signature laugh in the original Japanese voice; the written laugh is a late hint. */
export function LaughRound({ round, record, onChange }: Props) {
  const c = characterById.get(round.targetId)!;
  const entry = ONE_PIECE.laughs.find((l) => l.character === c.id)!;
  const [broken, setBroken] = useState(false);
  const audio = entry.youtubeId && !broken;
  const facts = characterHints(c);
  // Heard: the written laugh comes after the vaguer facts. No clip: it's the clue itself.
  const hints = audio ? [...facts.slice(0, 3), `It's written “${entry.laugh}”`, facts[4]] : facts;
  return (
    <SpGuessRound
      type="laugh"
      question="Whose signature laugh is this?"
      pool={characters}
      targetId={c.id}
      hints={hints}
      record={record}
      onChange={onChange}
      answer={{ name: c.name, image: c.image, detail: `“${entry.laugh}” · ${c.affiliation}` }}
      clue={(wrong, done) =>
        audio ? (
          <div className="space-y-3">
            <p className="text-center font-display text-xs uppercase tracking-widest text-ink-faint">Listen to the laugh · original Japanese voice</p>
            {/* Laugh clips are short and often open on a beat of silence: the whole clip, from its start. */}
            <AudioClip videoId={entry.youtubeId!} start={0} step={wrong} full revealed={done} onUnavailable={() => setBroken(true)} />
          </div>
        ) : (
          <p className="py-6 text-center font-serif text-5xl font-bold italic tracking-wide sm:text-6xl">“{entry.laugh}”</p>
        )
      }
    />
  );
}

/** Jolly Roger: the crew's flag, opening up with each miss. */
export function FlagRound({ round, record, onChange }: Props) {
  const crew = crewById.get(round.targetId)!;
  const members = characters.filter((c) => c.affiliation === crew.name);
  const hints = [
    crew.arc && `First seen in the ${crew.arc} arc`,
    members[0] && `A member: ${members[members.length - 1].name}`,
    members.length > 1 && `Its best-known member: ${members[0].name}`,
    `Its name starts with “${crew.name[0]}”`,
  ].filter((h): h is string => !!h);
  return (
    <SpGuessRound
      type="flag"
      question="Which crew flies this Jolly Roger?"
      pool={crewNames}
      targetId={crew.id}
      hints={hints}
      record={record}
      onChange={onChange}
      answer={{ name: crew.name, image: crew.flag }}
      clue={(wrong, done) => <ObscuredImage src={crew.flag} alt="Jolly Roger" step={wrong} revealed={done} seed={round.seed} />}
    />
  );
}

/** Silhouette: a blacked-out cut-out, in colour once the round is over. */
export function SilhouetteRound({ round, record, onChange }: Props) {
  const c = characterById.get(round.targetId)!;
  const image = SILHOUETTE_OF.get(c.id)!;
  return (
    <SpGuessRound
      type="silhouette"
      question="Who is hiding in the shadow?"
      pool={characters}
      targetId={c.id}
      hints={characterHints(c)}
      record={record}
      onChange={onChange}
      answer={{ name: c.name, image: c.image, detail: c.affiliation }}
      clue={(_, done) => (
        <div
          className="relative mx-auto aspect-square w-full max-w-xs overflow-hidden rounded-xl"
          style={{ background: 'radial-gradient(circle at 50% 45%, #fde68a 0%, #f59e0b 35%, #1d4ed8 75%)' }}
        >
          <img
            src={image}
            alt={done ? c.name : 'Silhouette'}
            draggable={false}
            onContextMenu={(e) => e.preventDefault()}
            className="absolute inset-0 size-full select-none object-contain p-5 transition-[filter] duration-500"
            style={{ filter: done ? 'none' : 'brightness(0) drop-shadow(0 4px 10px rgb(0 0 0 / 0.35))' }}
          />
        </div>
      )}
    />
  );
}
