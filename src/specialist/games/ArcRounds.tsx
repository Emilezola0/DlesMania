// ARC Raiders' rounds: name the machine, the weapon or gear, the place, the container, the material, the
// crafted item from its recipe, and the machine from its sound. Each kind guesses from its own list.
import { useState } from 'react';
import { ObscuredImage } from '../../components/ObscuredImage';
import { VideoClip } from '../../components/VideoClip';
import { ZoomImage } from '../../components/ZoomImage';
import { mulberry32 } from '../../lib/rng';
import type { RoundRecord } from '../../types';
import { ARC_CLASSIC, ARC_FURNITURE, ARC_GEAR, ARC_MACHINES, ARC_MATERIALS, ARC_PLACE_PICTURES, ARC_PLACES, ARC_RECIPES, ARC_SOUNDS, type ArcThing } from '../arcraiders';
import type { SpRound } from '../rounds';
import { ClassicGrid, close, overlap, same, type Column } from './ClassicRound';
import { SpGuessRound } from './SpGuessRound';

interface Props {
  round: SpRound;
  record: RoundRecord;
  onChange: (record: RoundRecord) => void;
}

const detail = (c: ArcThing) => Object.values(c.traits).join(' · ');
const words = (name: string) => {
  const n = name.split(/\s+/).length;
  return `${n} word${n === 1 ? '' : 's'}`;
};
/** Hints, vaguest first: the traits one by one, the length, then the first letter. */
const hintsFor = (c: ArcThing, extra: string[] = []) => [...Object.entries(c.traits).map(([k, v]) => `${k}: ${v}`), ...extra, words(c.name), `Its name starts with “${c.name[0]}”`];
const byId = <T extends ArcThing>(list: T[], id: string) => list.find((x) => x.id === id)!;
const useFocus = (seed: number) =>
  useState<[number, number]>(() => {
    const rand = mulberry32(seed);
    return [35 + Math.round(rand() * 30), 30 + Math.round(rand() * 30)];
  })[0];

/** A picture zoomed in tight, pulling back with each miss. */
function zoomRound(type: 'mob' | 'place' | 'furniture', question: string, pool: () => ArcThing[], pick: (round: SpRound) => { thing: ArcThing; image: string }) {
  return function ArcZoomRound({ round, record, onChange }: Props) {
    const { thing, image } = pick(round);
    const focus = useFocus(round.seed);
    return (
      <SpGuessRound
        type={type}
        question={question}
        pool={pool()}
        targetId={thing.id}
        hints={hintsFor(thing)}
        record={record}
        onChange={onChange}
        answer={{ name: thing.name, image, detail: detail(thing) }}
        noPictures
        clue={(wrong, done) => <ZoomImage src={image} alt="Picture to guess" step={wrong} revealed={done} focus={focus} />}
      />
    );
  };
}

/** An icon behind windows that open with each miss. */
function windowsRound(type: 'gear' | 'material', question: string, list: ArcThing[]) {
  return function ArcWindowsRound({ round, record, onChange }: Props) {
    const thing = byId(list, round.targetId);
    return (
      <SpGuessRound
        type={type}
        question={question}
        pool={list}
        targetId={thing.id}
        hints={hintsFor(thing)}
        record={record}
        onChange={onChange}
        answer={{ name: thing.name, image: thing.image, detail: detail(thing) }}
        noPictures
        clue={(wrong, done) => (
          <div className="mx-auto max-w-sm rounded-md bg-[#1b1a22] p-2">
            <ObscuredImage src={thing.image} alt="Icon to name" step={wrong} revealed={done} seed={round.seed} />
          </div>
        )}
      />
    );
  };
}

/** Mobs: an ARC machine, zoomed in (one of its pictures, picked by the day). */
export const ArcMobRound = zoomRound('mob', 'Which ARC machine is this?', () => ARC_MACHINES, (round) => {
  const thing = byId(ARC_MACHINES, round.targetId);
  return { thing, image: thing.pictures[round.seed % thing.pictures.length] };
});

/** Locations: a map, the city of Speranza or a place met on every map. */
export const ArcPlaceRound = zoomRound('place', 'Where is this?', () => ARC_PLACES, (round) => {
  const p = ARC_PLACE_PICTURES[Number(round.targetId.split(':')[1])];
  return { thing: byId(ARC_PLACES, p.answer), image: p.image };
});

/** Furniture: something to search through for loot. */
export const ArcFurnitureRound = zoomRound('furniture', 'What would you search here?', () => ARC_FURNITURE, (round) => {
  const thing = byId(ARC_FURNITURE, round.targetId);
  return { thing, image: thing.image };
});

export const ArcGearRound = windowsRound('gear', 'Which weapon or piece of equipment is this?', ARC_GEAR);
export const ArcMaterialRound = windowsRound('material', 'Which material is this?', ARC_MATERIALS);

/** Crafting recipes: what goes in — name what comes out. Where it's made comes as a hint. */
export function ArcRecipeRound({ round, record, onChange }: Props) {
  const r = byId(ARC_RECIPES, round.targetId);
  return (
    <SpGuessRound
      type="recipe"
      question="What do you craft with this?"
      pool={ARC_RECIPES}
      targetId={r.id}
      hints={hintsFor(r)}
      record={record}
      onChange={onChange}
      answer={{ name: r.name, image: r.image || undefined, detail: `${r.ingredients.join(' + ')} · ${r.station}` }}
      noPictures
      clue={() => (
        <div className="mx-auto flex max-w-md flex-col items-center gap-3 text-center">
          <p className="font-display text-xs uppercase tracking-[0.3em] text-ink-faint">Recipe</p>
          <ul className="flex flex-wrap justify-center gap-2">
            {r.ingredients.map((x, i) => (
              <li key={i} className="flex items-center gap-2">
                {i > 0 && <span className="font-bold text-ink-faint">+</span>}
                <span className="rounded-md border border-rule bg-tile px-3 py-2 font-semibold">{x}</span>
              </li>
            ))}
          </ul>
          <p className="text-2xl" aria-hidden>
            ⬇
          </p>
          <p className="rounded-md border-2 border-dashed border-rule px-6 py-3 font-display text-2xl font-black">?</p>
        </div>
      )}
    />
  );
}

/** Robot sounds: a machine heard, not seen — the clip plays in the dark, and shows itself at the end. */
export function ArcSoundRound({ round, record, onChange }: Props) {
  const s = ARC_SOUNDS[Number(round.targetId.split(':')[1])];
  const arc = byId(ARC_MACHINES, s.answer);
  const [gone, setGone] = useState(false);
  return (
    <SpGuessRound
      type="sound"
      question="Which ARC machine makes this sound?"
      pool={ARC_MACHINES}
      targetId={arc.id}
      hints={hintsFor(arc)}
      record={record}
      onChange={onChange}
      answer={{ name: arc.name, image: arc.image, detail: detail(arc) }}
      noPictures
      clue={(_, done) =>
        gone && !done ? (
          <p className="py-10 text-center text-sm text-ink-soft">The recording can't be played right now — the hints will have to do.</p>
        ) : (
          <div className="mx-auto max-w-md">
            <VideoClip videoId={s.youtubeId} at={s.at} seconds={s.seconds} revealed={done} onUnavailable={() => setGone(true)} filter="brightness(0)" />
            {!done && <p className="mt-2 text-center text-xs text-ink-faint">Turn the sound on: the picture stays dark.</p>}
          </div>
        )
      }
    />
  );
}

/** Classic: armor, attack, weak spot and health compared with the mystery machine's. */
const list = (c: ArcThing, k: string) => (c.traits[k] ?? '').split(/\s*\/\s*/).map((x) => x.toLowerCase()).filter(Boolean);
const CLASSIC_COLUMNS: Column<(typeof ARC_CLASSIC)[number]>[] = [
  { label: 'Armor', show: (c) => c.traits.Armor, judge: same((c) => c.traits.Armor) },
  { label: 'Attack', show: (c) => c.traits.Attack, judge: same((c) => c.traits.Attack.toLowerCase()) },
  { label: 'Weak spot', show: (c) => c.traits['Weak spot'], judge: (g, t) => overlap(list(g, 'Weak spot'), list(t, 'Weak spot')) },
  { label: 'Health', show: (c) => c.health.toLocaleString('en'), judge: (g, t) => close(g.health, t.health, 0.25), arrow: (g, t) => t.health - g.health },
];
const CLASSIC_BY_ID = new Map(ARC_CLASSIC.map((a) => [a.id, a]));
export function ArcClassicRound(props: Props) {
  return <ClassicGrid {...props} pool={ARC_CLASSIC} byId={CLASSIC_BY_ID} columns={CLASSIC_COLUMNS} noun="machine" detail={detail} />;
}
