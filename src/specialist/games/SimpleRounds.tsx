import { useEffect, useRef, useState } from 'react';
import { ObscuredImage } from '../../components/ObscuredImage';
import { VideoClip } from '../../components/VideoClip';
import { useProgress } from '../../store/progress';
import { ZoomImage } from '../../components/ZoomImage';
import { mulberry32 } from '../../lib/rng';
import type { RoundRecord } from '../../types';
import type { SpRound } from '../rounds';
import { SIMPLE, simpleCharacter, type SimpleCharacter, type SimpleUniverse } from '../simple';
import { ClassicGrid, close, overlap, same, type Column } from './ClassicRound';
import { SpGuessRound } from './SpGuessRound';

interface Props {
  round: SpRound;
  record: RoundRecord;
  onChange: (record: RoundRecord) => void;
}

/** Hints, vaguest first: the traits one by one, then the first letter. */
const hintsFor = (c: SimpleCharacter) => [...Object.entries(c.traits).map(([k, v]) => `${k}: ${v}`), `Their name starts with “${c.name[0]}”`];
const detail = (c: SimpleCharacter) => Object.values(c.traits).join(' · ');

/** Picture: the card art, cropped tight, pulling back with each miss. */
export const pictureRoundFor = (u: SimpleUniverse['id']) =>
  function SimplePictureRound({ round, record, onChange }: Props) {
    const c = simpleCharacter(u, round.targetId)!;
    const [focus] = useState<[number, number]>(() => {
      const rand = mulberry32(round.seed);
      return [35 + Math.round(rand() * 30), 25 + Math.round(rand() * 30)];
    });
    return (
      <SpGuessRound
        type="picture"
        question="Who — or what — is in this picture?"
        pool={SIMPLE[u].characters}
        targetId={c.id}
        hints={hintsFor(c)}
        record={record}
        onChange={onChange}
        answer={{ name: c.name, image: c.image, detail: detail(c) }}
        noPictures
        clue={(wrong, done) => <ZoomImage src={c.image} alt="Picture to guess" step={wrong} revealed={done} focus={focus} />}
      />
    );
  };

/** Clue: a line about them (a weapon, an ability, a moment of the story) — name who it is. */
export const clueRoundFor = (u: SimpleUniverse['id'], question: string) =>
  function SimpleClueRound({ round, record, onChange }: Props) {
    const clue = SIMPLE[u].clues[Number(round.targetId)];
    const c = simpleCharacter(u, clue.answer)!;
    return (
      <SpGuessRound
        type="clue"
        question={question}
        pool={SIMPLE[u].characters}
        targetId={c.id}
        hints={hintsFor(c)}
        record={record}
        onChange={onChange}
        answer={{ name: c.name, image: c.image || undefined, detail: detail(c) }}
        noPictures
        clue={() => (
          <blockquote className="page mx-auto max-w-xl rounded-md px-6 py-8 text-center font-serif text-2xl italic leading-snug">“{clue.text}”</blockquote>
        )}
      />
    );
  };

/** Classic: every trait of a guess compared with the answer's. */
export const classicRoundFor = (u: SimpleUniverse['id'], noun: string) => {
  const x = SIMPLE[u];
  const num = (c: SimpleCharacter, label: string) => Number(c.traits[label]) || 0;
  const list = (c: SimpleCharacter, label: string) => (c.traits[label] ?? '').split(' / ').filter(Boolean);
  const columns: Column<SimpleCharacter>[] = x.columns.map((label) =>
    x.numeric?.includes(label)
      ? { label, show: (c) => c.traits[label] ?? '?', judge: (g, t) => close(num(g, label), num(t, label), 0.1), arrow: (g, t) => num(t, label) - num(g, label) }
      : x.lists?.includes(label)
        ? { label, show: (c) => c.traits[label] ?? '?', judge: (g, t) => overlap(list(g, label), list(t, label)) }
        : { label, show: (c) => c.traits[label] ?? '?', judge: same((c) => c.traits[label]) },
  );
  // Only those whose every trait is known can be guessed in the grid.
  const pool = x.characters.filter((c) => x.columns.every((k) => c.traits[k] && c.traits[k] !== 'Unknown'));
  const byId = new Map(x.characters.map((c) => [c.id, c]));
  return function SimpleClassicRound(props: Props) {
    return <ClassicGrid {...props} pool={pool} byId={byId} columns={columns} noun={noun} detail={detail} />;
  };
};

/** Windows: the picture behind tiles that open, a few more with each miss. */
export const windowsRoundFor = (u: SimpleUniverse['id']) =>
  function SimpleWindowsRound({ round, record, onChange }: Props) {
    const c = simpleCharacter(u, round.targetId)!;
    return (
      <SpGuessRound
        type="windows"
        question="Who — or what — is behind the windows?"
        pool={SIMPLE[u].characters}
        targetId={c.id}
        hints={hintsFor(c)}
        record={record}
        onChange={onChange}
        answer={{ name: c.name, image: c.image, detail: detail(c) }}
        noPictures
        clue={(wrong, done) => <ObscuredImage src={c.image} alt="Picture behind windows" step={wrong} revealed={done} seed={round.seed} />}
      />
    );
  };

/** Silhouette: a cut-out portrait, blacked out. */
export const silhouetteRoundFor = (u: SimpleUniverse['id']) =>
  function SimpleSilhouetteRound({ round, record, onChange }: Props) {
    const c = simpleCharacter(u, round.targetId)!;
    return (
      <SpGuessRound
        type="silhouette"
        question="Who is hiding in the shadow?"
        pool={SIMPLE[u].characters}
        targetId={c.id}
        hints={hintsFor(c)}
        record={record}
        onChange={onChange}
        answer={{ name: c.name, image: c.image, detail: detail(c) }}
        noPictures
        clue={(_, done) => (
          <div className="relative mx-auto aspect-square w-full max-w-xs overflow-hidden rounded-xl" style={{ background: 'radial-gradient(circle at 50% 45%, #fde68a 0%, #d97706 38%, #1e3a8a 78%)' }}>
            <img
              src={c.image}
              alt=""
              draggable={false}
              onContextMenu={(e) => e.preventDefault()}
              className="absolute inset-0 size-full select-none object-contain p-4 transition-[filter] duration-500"
              style={{ filter: done ? 'none' : 'brightness(0) drop-shadow(0 4px 10px rgb(0 0 0 / 0.35))' }}
            />
          </div>
        )}
      />
    );
  };

/** Dance (Ufouria): a hero cheering, dancing in the shadow; it slows down with each miss, and steps into the light at the end. */
export const danceRoundFor = (u: SimpleUniverse['id']) =>
  function SimpleDanceRound({ round, record, onChange }: Props) {
    const d = SIMPLE[u].dances![Number(round.targetId)];
    const c = simpleCharacter(u, d.answer)!;
    return (
      <SpGuessRound
        type="dance"
        question="Who is dancing in the shadow?"
        pool={SIMPLE[u].characters}
        targetId={c.id}
        hints={hintsFor(c)}
        record={record}
        onChange={onChange}
        answer={{ name: c.name, image: d.image, detail: detail(c) }}
        noPictures
        clue={(wrong, done) => (
          <div className="relative mx-auto aspect-square w-full max-w-xs overflow-hidden rounded-xl" style={{ background: 'radial-gradient(circle at 50% 40%, #fef9c3 0%, #93c5fd 45%, #1e3a8a 85%)' }}>
            <img
              src={d.image}
              alt=""
              draggable={false}
              onContextMenu={(e) => e.preventDefault()}
              className={`absolute inset-0 size-full select-none object-contain p-8 transition-[filter] duration-500 ${done ? '' : 'animate-dance'}`}
              style={{ filter: done ? 'none' : 'brightness(0) drop-shadow(0 6px 10px rgb(0 0 0 / 0.35))', animationDuration: `${1.3 + wrong * 0.5}s` }}
            />
          </div>
        )}
      />
    );
  };

/** Voice: a line in their voice — the French dub when names are in French and there is one, else the original. */
export const voiceRoundFor = (u: SimpleUniverse['id']) =>
  function SimpleVoiceRound({ round, record, onChange }: Props) {
    const v = SIMPLE[u].voices![Number(round.targetId)];
    const c = simpleCharacter(u, v.answer)!;
    const lang = useProgress((s) => s.nameLang);
    const french = lang === 'fr' && !!v.fr;
    const src = french ? v.fr! : (v.en ?? v.fr!);
    const audio = useRef<HTMLAudioElement | null>(null);
    const play = () => {
      audio.current?.pause();
      const a = new Audio(src);
      a.volume = Math.min(1, useProgress.getState().clipVolume / 100);
      audio.current = a;
      void a.play().catch(() => {});
    };
    useEffect(() => () => audio.current?.pause(), []);
    return (
      <SpGuessRound
        type="voice"
        question="Who is speaking?"
        pool={SIMPLE[u].characters}
        targetId={c.id}
        hints={hintsFor(c)}
        record={record}
        onChange={onChange}
        answer={{ name: c.name, image: c.image || undefined, detail: detail(c) }}
        noPictures
        clue={() => (
          <div className="page mx-auto flex max-w-sm flex-col items-center gap-3 rounded-md px-6 py-8 text-center">
            <button type="button" onClick={play} className="btn-accent grid size-20 place-items-center rounded-full text-3xl" aria-label="Play the voice line">
              🔊
            </button>
            <p className="text-xs text-ink-faint">{french ? 'Version française' : lang === 'fr' ? 'Original English voice (no French dub clip for this line yet)' : 'Original English voice'}</p>
          </div>
        )}
      />
    );
  };

/** How the Spotlight picture is hidden at each wrong-guess step: the light's radius (%) and the blur (px). */
const SPOT_STEPS = [
  { radius: 14, blur: 10 },
  { radius: 18, blur: 8 },
  { radius: 22, blur: 6 },
  { radius: 27, blur: 4 },
  { radius: 33, blur: 2.5 },
  { radius: 40, blur: 1 },
];

/** Spotlight: Phase III's look — a blurred picture in the dark, lit by a light that jumps around it; each miss widens it. */
function SpotlightImage({ src, step, revealed }: { src: string; step: number; revealed: boolean }) {
  const [spot, setSpot] = useState({ x: 50, y: 35 });
  useEffect(() => {
    if (revealed) return;
    const id = window.setInterval(() => setSpot({ x: 20 + Math.random() * 60, y: 15 + Math.random() * 60 }), 650);
    return () => clearInterval(id);
  }, [revealed]);
  const s = SPOT_STEPS[Math.min(step, SPOT_STEPS.length - 1)];
  const mask = revealed ? undefined : `radial-gradient(circle at ${spot.x}% ${spot.y}%, #000 ${s.radius}%, transparent ${s.radius + 14}%)`;
  return (
    <div className="relative mx-auto aspect-square w-full max-w-xs">
      <div className={`boss-glow absolute -inset-2 rounded-lg transition-opacity ${revealed ? 'opacity-0' : ''}`} aria-hidden />
      <div className="relative size-full overflow-hidden rounded-md border-2 border-coral/70 bg-[#141018]">
        <div className="absolute inset-0" style={{ WebkitMaskImage: mask, maskImage: mask }}>
          <img
            src={src}
            alt=""
            draggable={false}
            onContextMenu={(e) => e.preventDefault()}
            className={`size-full select-none object-cover object-top transition-[filter] duration-300 ${revealed ? '' : 'boss-flicker'}`}
            style={{ filter: revealed ? 'none' : `blur(${s.blur}px) contrast(1.1)` }}
          />
        </div>
      </div>
    </div>
  );
}

export const spotlightRoundFor = (u: SimpleUniverse['id']) =>
  function SimpleSpotlightRound({ round, record, onChange }: Props) {
    const c = simpleCharacter(u, round.targetId)!;
    return (
      <SpGuessRound
        type="spotlight"
        question="Who is in the spotlight?"
        pool={SIMPLE[u].characters}
        targetId={c.id}
        hints={hintsFor(c)}
        record={record}
        onChange={onChange}
        answer={{ name: c.name, image: c.image, detail: detail(c) }}
        noPictures
        clue={(wrong, done) => <SpotlightImage src={c.image} step={wrong} revealed={done} />}
      />
    );
  };

/** Exotic: an item's icon (not a character: Destiny's Exotic weapons), behind windows that open with each miss. */
export const itemRoundFor = (u: SimpleUniverse['id'], question: string) =>
  function SimpleItemRound({ round, record, onChange }: Props) {
    const items = SIMPLE[u].items ?? [];
    const c = items.find((x) => x.id === round.targetId)!;
    const words = c.name.split(/\s+/).length;
    return (
      <SpGuessRound
        type="exotic"
        question={question}
        pool={items}
        targetId={c.id}
        hints={[`${words} word${words === 1 ? '' : 's'}`, `Its name starts with “${c.name[0]}”`]}
        record={record}
        onChange={onChange}
        answer={{ name: c.name, image: c.image }}
        noPictures
        clue={(wrong, done) => <ObscuredImage src={c.image} alt="Icon to name" step={wrong} revealed={done} seed={round.seed} />}
      />
    );
  };

/** How an execution is hidden at each wrong-guess step: shapes only at first, the picture coming back with each miss. */
const SHADOW_STEPS = [
  'grayscale(1) contrast(9) brightness(0.45)',
  'grayscale(1) contrast(6) brightness(0.55)',
  'grayscale(1) contrast(4) brightness(0.65)',
  'grayscale(1) contrast(2.5) brightness(0.8)',
  'grayscale(1) contrast(1.6)',
  'grayscale(0.6) contrast(1.2)',
];

/** Execution: a hero's finishing move, playing in silhouette; the fighters come out of the shadow with each miss. */
export const executionRoundFor = (u: SimpleUniverse['id']) =>
  function SimpleExecutionRound({ round, record, onChange }: Props) {
    const e = SIMPLE[u].executions![Number(round.targetId)];
    const c = simpleCharacter(u, e.answer)!;
    const [gone, setGone] = useState(false);
    return (
      <SpGuessRound
        type="execution"
        question="Whose execution is this?"
        pool={SIMPLE[u].characters}
        targetId={c.id}
        hints={[...hintsFor(c).slice(0, -1), `The execution: “${e.name}”`, hintsFor(c).at(-1)!]}
        record={record}
        onChange={onChange}
        answer={{ name: c.name, image: c.image || undefined, detail: `${detail(c)} · ${e.name}` }}
        noPictures
        clue={(wrong, done) =>
          gone && !done ? (
            // A video gone from YouTube: the hero's picture in silhouette instead.
            <div className="relative mx-auto aspect-square w-full max-w-xs overflow-hidden rounded-md bg-black">
              <img src={c.image} alt="" draggable={false} className="size-full object-cover object-top" style={{ filter: SHADOW_STEPS[Math.min(wrong, SHADOW_STEPS.length - 1)] }} />
            </div>
          ) : (
            <VideoClip videoId={e.youtubeId} at={0} seconds={e.seconds} revealed={done} onUnavailable={() => setGone(true)} filter={SHADOW_STEPS[Math.min(wrong, SHADOW_STEPS.length - 1)]} />
          )
        }
      />
    );
  };

/** Ultimate Cost (Overwatch): the points an ultimate needs to charge — whose is it? Close costs are shown as hints. */
export const ultCostRoundFor = (u: SimpleUniverse['id']) =>
  function SimpleUltCostRound({ round, record, onChange }: Props) {
    const ults = SIMPLE[u].ults ?? [];
    const ult = ults.find((x) => x.answer === round.targetId)!;
    const c = simpleCharacter(u, ult.answer)!;
    const near = [...ults].sort((a, b) => Math.abs(a.cost - ult.cost) - Math.abs(b.cost - ult.cost)).filter((x) => x !== ult).slice(0, 2);
    const fmt = (n: number) => n.toLocaleString('en');
    return (
      <SpGuessRound
        type="ultcost"
        question="Whose ultimate costs this many points to charge?"
        pool={SIMPLE[u].characters}
        targetId={c.id}
        hints={[
          ...(c.traits.Role ? [`Role: ${c.traits.Role}`] : []),
          `Close by: ${near.map((x) => `${simpleCharacter(u, x.answer)?.name} (${fmt(x.cost)})`).join(', ')}`,
          `The ultimate: ${ult.ultimate}`,
          `Their name starts with “${c.name[0]}”`,
        ]}
        record={record}
        onChange={onChange}
        answer={{ name: c.name, image: c.image || undefined, detail: `${ult.ultimate} · ${fmt(ult.cost)} points` }}
        noPictures
        clue={() => (
          <div className="flex flex-col items-center gap-1 py-4 text-center">
            <p className="font-serif text-7xl font-bold tabular-nums">{fmt(ult.cost)}</p>
            <p className="font-display text-sm uppercase tracking-[0.3em] text-ink-faint">ultimate charge points</p>
          </div>
        )}
      />
    );
  };
