import { useState } from 'react';
import { AudioClip } from '../../components/AudioClip';
import { ObscuredImage } from '../../components/ObscuredImage';
import { mulberry32, shuffle } from '../../lib/rng';
import type { RoundRecord } from '../../types';
import { compactText } from '../../utils/textMatcher';
import { ONE_PIECE, characterById, crewById, formatBounty, fruitById, type OpCharacter, type OpFruit } from '../data';
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
/** Characters can be guessed in the Devil Fruit round too: their ids are prefixed so they never match a fruit. */
const USER_PREFIX = 'user:';
const fruitOrUser = [
  ...fruitNames,
  ...ONE_PIECE.characters.map((c) => ({ id: `${USER_PREFIX}${c.id}`, name: c.name, aliases: c.aliases, subtitle: 'character' })),
];

/** How many fruits the shortlist offers when the fruit's user is named. */
const SHORTLIST = 8;

/** The roster ids of a fruit's users (matched on any of their names). */
function userIds(f: OpFruit): string[] {
  const names = new Set(f.users.map(compactText));
  return ONE_PIECE.characters.filter((c) => [c.name, ...c.aliases].some((n) => names.has(compactText(n)))).map((c) => c.id);
}

/** The answer among a few others, same type first (so it stays a real choice), in alphabetical order. */
function shortlist(f: OpFruit, seed: number): string[] {
  const rand = mulberry32(seed ^ 0xf2017);
  const others = ONE_PIECE.fruits.filter((x) => x.id !== f.id);
  const sameType = shuffle(others.filter((x) => x.type === f.type), rand);
  const rest = shuffle(others.filter((x) => x.type !== f.type), rand);
  return [f, ...[...sameType, ...rest].slice(0, SHORTLIST - 1)].map((x) => x.name).sort((a, b) => a.localeCompare(b));
}

export function FruitRound({ round, record, onChange }: Props) {
  const f = fruitById.get(round.targetId)!;
  const [broken, setBroken] = useState(false);
  const picture = f.image && !broken;
  // Naming the fruit's user costs a try but unlocks a shortlist; naming anyone else just costs the try.
  const users = userIds(f);
  const named = record.guesses.filter((g) => g.startsWith(USER_PREFIX)).map((g) => g.slice(USER_PREFIX.length));
  const foundUser = named.find((id) => users.includes(id));
  const strangers = named.filter((id) => !users.includes(id)).map((id) => characterById.get(id)?.name ?? id);
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
      noPictures
      question="Which Devil Fruit is this? (Naming its user costs a try but shows a shortlist.)"
      pool={fruitOrUser}
      targetId={f.id}
      // No picture: the first fact is given away for free.
      hints={picture ? hints : hints.slice(1)}
      record={record}
      onChange={onChange}
      answer={{ name: f.name, image: f.image, detail: [f.english, f.type, f.users.join(' & ')].filter(Boolean).join(' · ') }}
      clue={(wrong, done) => (
        <div className="space-y-4">
          {picture ? (
            <ObscuredImage src={f.image!} alt="Devil Fruit" step={wrong} revealed={done} seed={round.seed} onError={() => setBroken(true)} />
          ) : (
            <div className="space-y-2 py-6 text-center">
              <p className="font-display text-5xl">🍈</p>
              <p className="font-display text-lg font-bold">{hints[0]}</p>
              <p className="text-sm text-ink-soft">This fruit's look was never shown — go by the clues.</p>
            </div>
          )}
          {foundUser && !done && (
            <div className="animate-pop rounded-md border border-accent/50 bg-accent-soft/60 p-3 text-center">
              <p className="font-display text-[11px] uppercase tracking-widest text-ink-faint">
                {characterById.get(foundUser)?.name} ate it — it's one of these
              </p>
              <ul className="mt-2 flex flex-wrap justify-center gap-1.5">
                {shortlist(f, round.seed).map((n) => (
                  <li key={n} className="rounded-sm border border-rule-strong bg-card px-2 py-1 text-sm font-semibold">
                    {n}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {strangers.length > 0 && !done && (
            <p className="text-center text-xs text-ink-soft">{strangers.join(', ')} didn't eat this fruit.</p>
          )}
        </div>
      )}
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
/** Misses before the wanted poster's colours come back (a red coat, green hair... are a big hint). */
const WANTED_COLOUR_AFTER = 3;

export function WantedRound({ round, record, onChange }: Props) {
  const c = characterById.get(round.targetId)!;
  return (
    <SpGuessRound
      type="wanted"
      noPictures
      question="Who is on this wanted poster?"
      pool={characters}
      targetId={c.id}
      hints={characterHints(c)}
      record={record}
      onChange={onChange}
      answer={{ name: c.name, image: c.image, detail: `${c.affiliation} · ${c.bounty ? `${formatBounty(c.bounty)} berries` : 'no bounty'}` }}
      clue={(wrong, done) => {
        const blur = done ? 0 : WANTED_BLUR[Math.min(wrong, WANTED_BLUR.length - 1)];
        const coloured = done || wrong >= WANTED_COLOUR_AFTER;
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
                style={{ filter: done ? 'none' : `blur(${blur}px) ${coloured ? 'sepia(0.35)' : 'grayscale(1) contrast(1.1)'}` }}
              />
            </div>
            <p className="font-serif text-2xl font-black tracking-wide">DEAD OR ALIVE</p>
            <p className="font-display text-[10px] uppercase tracking-[0.3em] opacity-70">{done ? c.name : coloured ? 'Sharper with each miss' : `Sharper with each miss · colour after ${WANTED_COLOUR_AFTER}`}</p>
          </div>
        );
      }}
    />
  );
}
