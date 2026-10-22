import { useState } from 'react';
import { ZoomImage } from '../../components/ZoomImage';
import { mulberry32 } from '../../lib/rng';
import type { RoundRecord } from '../../types';
import { ABILITY_KEY_NAME, LOL, LOL_SILHOUETTE_OF, championById, type LolChampion } from '../lol';
import type { SpRound } from '../rounds';
import { SpGuessRound } from './SpGuessRound';

interface Props {
  round: SpRound;
  record: RoundRecord;
  onChange: (record: RoundRecord) => void;
}

/** Facts about a champion, vaguest first. */
function championHints(c: LolChampion): string[] {
  return [
    `Region: ${c.regions.join(', ')}`,
    c.classes.length ? `Class: ${c.classes.join(' / ')}` : `Range: ${c.range}`,
    `Plays ${c.positions.join(' or ')}`,
    c.year ? `Released in ${c.year}` : `Resource: ${c.resource}`,
    `Their title: “${c.title}”`,
  ];
}

/** How the ability icon is disguised at each miss: [blur px, turn deg, greyscale 0–1]. */
const ICON_STEPS: [number, number, number][] = [
  [6, 180, 1],
  [4, 90, 1],
  [2.5, 90, 0.6],
  [1, 0, 0.3],
  [0, 0, 0],
];

/** Ability: one of the champion's five ability icons, greyscale and turned, clearing up with each miss. */
export function AbilityRound({ round, record, onChange }: Props) {
  const c = championById.get(round.targetId)!;
  // The seed picks the ability, so the round is the same for everyone.
  const ability = c.abilities[Math.floor(mulberry32(round.seed)() * c.abilities.length)];
  const hints = [`It's their ${ABILITY_KEY_NAME[ability.key]}`, ...championHints(c).slice(0, 3), `The ability is called “${ability.name}”`];
  return (
    <SpGuessRound
      type="ability"
      question="Which champion has this ability?"
      pool={LOL.champions}
      targetId={c.id}
      hints={hints}
      record={record}
      onChange={onChange}
      answer={{ name: c.name, image: c.image, detail: `${ABILITY_KEY_NAME[ability.key]}: ${ability.name}` }}
      clue={(wrong, done) => {
        const [blur, turn, grey] = done ? [0, 0, 0] : ICON_STEPS[Math.min(wrong, ICON_STEPS.length - 1)];
        return (
          <div className="flex flex-col items-center gap-3">
            <div className="grid size-40 place-items-center overflow-hidden rounded-xl border-2 border-rule-strong bg-[#0b0f17]">
              <img
                src={ability.icon}
                alt="Ability icon"
                draggable={false}
                className="size-32 select-none rounded-md transition-[filter,transform] duration-500"
                style={{ filter: `blur(${blur}px) grayscale(${grey})`, transform: `rotate(${turn}deg)` }}
              />
            </div>
            <p className="font-display text-[11px] tracking-wider text-ink-faint">{done ? ability.name.toUpperCase() : 'CLEARS UP WITH EACH MISS'}</p>
          </div>
        );
      }}
    />
  );
}

/** Splash Art: a tight crop of the base splash, pulling back with each miss. */
export function SplashRound({ round, record, onChange }: Props) {
  const c = championById.get(round.targetId)!;
  const [focus] = useState<[number, number]>(() => {
    const rand = mulberry32(round.seed);
    return [30 + Math.round(rand() * 40), 25 + Math.round(rand() * 35)];
  });
  return (
    <SpGuessRound
      type="splash"
      question="Whose splash art is this?"
      pool={LOL.champions}
      targetId={c.id}
      hints={championHints(c)}
      record={record}
      onChange={onChange}
      answer={{ name: c.name, image: c.image, detail: c.title }}
      clue={(wrong, done) => <ZoomImage src={c.splash} alt="Splash art" step={wrong} revealed={done} focus={focus} />}
    />
  );
}

/** Silhouette: the champion's render blacked out, in colour once the round is over. */
export function LolSilhouetteRound({ round, record, onChange }: Props) {
  const c = championById.get(round.targetId)!;
  const image = LOL_SILHOUETTE_OF.get(c.id)!;
  return (
    <SpGuessRound
      type="silhouette"
      question="Which champion is hiding in the shadow?"
      pool={LOL.champions}
      targetId={c.id}
      hints={championHints(c)}
      record={record}
      onChange={onChange}
      answer={{ name: c.name, image: c.image, detail: c.title }}
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
