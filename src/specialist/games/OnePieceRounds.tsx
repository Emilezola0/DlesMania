import { useState } from 'react';
import { AudioClip } from '../../components/AudioClip';
import { ObscuredImage } from '../../components/ObscuredImage';
import type { RoundRecord } from '../../types';
import { ONE_PIECE, characterById, crewById, formatBounty, fruitById, type OpCharacter } from '../data';
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

/** How blurred the wanted poster's picture is at each miss, in px (0 once the round is over). */
const WANTED_BLUR = [16, 12, 9, 6, 4, 2];

/** Wanted: the character's picture on a wanted poster, blurred and sepia, sharpening with each miss. */
export function WantedRound({ round, record, onChange }: Props) {
  const c = characterById.get(round.targetId)!;
  return (
    <SpGuessRound
      type="wanted"
      question="Who is on this wanted poster?"
      pool={characters}
      targetId={c.id}
      hints={characterHints(c)}
      record={record}
      onChange={onChange}
      answer={{ name: c.name, image: c.image, detail: `${c.affiliation} · ${c.bounty ? `${formatBounty(c.bounty)} berries` : 'no bounty'}` }}
      clue={(wrong, done) => {
        const blur = done ? 0 : WANTED_BLUR[Math.min(wrong, WANTED_BLUR.length - 1)];
        return (
          <div
            className="mx-auto flex w-full max-w-xs flex-col items-center gap-2 rounded-sm px-5 pb-5 pt-4 text-[#4a3424] shadow-xl"
            style={{ background: 'radial-gradient(circle at 50% 40%, #f3e2bd 0%, #e6cc98 60%, #c9a46a 100%)' }}
          >
            <p className="font-serif text-5xl font-black tracking-wider">WANTED</p>
            <div className="aspect-[4/3] w-full overflow-hidden border-2 border-[#4a3424]/60 bg-[#d9bf8c]">
              <img
                src={c.image}
                alt={done ? c.name : 'Wanted'}
                draggable={false}
                onContextMenu={(e) => e.preventDefault()}
                className="size-full scale-110 select-none object-cover object-top transition-[filter] duration-500"
                style={{ filter: done ? 'none' : `blur(${blur}px) sepia(0.55) contrast(1.05)` }}
              />
            </div>
            <p className="font-serif text-2xl font-black tracking-wide">DEAD OR ALIVE</p>
            <p className="font-display text-[10px] uppercase tracking-[0.3em] opacity-70">{done ? c.name : 'Sharper with each miss'}</p>
          </div>
        );
      }}
    />
  );
}
