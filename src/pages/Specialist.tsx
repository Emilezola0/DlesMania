import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { FlameIcon } from '../components/Layout';
import { Ornament } from '../components/Glyph';
import { dayNumber, formatLong, isPlayableDay, todayKey } from '../lib/date';
import { celebrateBig } from '../lib/fx';
import { sfx } from '../lib/sfx';
import { roundEmoji } from '../lib/share';
import { recentlySeen, specialStreak, useProgress } from '../store/progress';
import { EMPTY_RECORD, type RoundRecord } from '../types';
import type { ComponentType } from 'react';
import { ONE_PIECE } from '../specialist/data';
import { LOL } from '../specialist/lol';
import { MARVEL } from '../specialist/marvel';
import { GENSHIN } from '../specialist/genshin';
import { WOW } from '../specialist/wow';
import { timelineRoundFor } from '../specialist/games/TimelineRound';
import { WowArtRound, WowSilhouetteRound, WowTitlesRound } from '../specialist/games/WowRounds';
import { ClassicRound, GenshinClassicRound, LolClassicRound, MarvelClassicRound, WowClassicRound } from '../specialist/games/ClassicRound';
import { ConstellationRound, GiSilhouetteRound, WishRound } from '../specialist/games/GenshinRounds';
import { EmojiFilmRound, FilmRound, VoiceRound } from '../specialist/games/MarvelRounds';
import { AbilityRound, LolSilhouetteRound, SplashRound } from '../specialist/games/LolRounds';
import { FlagRound, FruitRound, LaughRound, WantedRound } from '../specialist/games/OnePieceRounds';
import { SP_META, UNIVERSES, buildSpecialistDaily, maxScore, poolSize, randomRound, universe, type SpRound, type SpType, type UniverseId } from '../specialist/rounds';
import { GameHostFx } from '../games/GameHost';
import { classicRoundFor, clueRoundFor, pictureRoundFor } from '../specialist/games/SimpleRounds';
import { SIMPLE } from '../specialist/simple';
import { BLUEPRINT_NODES } from '../specialist/blueprint';
import { BlueprintClassicRound, BlueprintClueRound, BlueprintPinsRound } from '../specialist/games/BlueprintRounds';

type RoundProps = { round: SpRound; record: RoundRecord; onChange: (r: RoundRecord) => void };

/** Which component plays each round type, per universe. */
const ROUND_COMPONENT: Record<UniverseId, Partial<Record<SpType, ComponentType<RoundProps>>>> = {
  onepiece: { classic: ClassicRound, fruit: FruitRound, laugh: LaughRound, flag: FlagRound, wanted: WantedRound, timeline: timelineRoundFor('onepiece') },
  lol: { classic: LolClassicRound, ability: AbilityRound, splash: SplashRound, silhouette: LolSilhouetteRound, timeline: timelineRoundFor('lol') },
  marvel: { classic: MarvelClassicRound, film: FilmRound, emoji: EmojiFilmRound, voice: VoiceRound, timeline: timelineRoundFor('marvel') },
  genshin: { classic: GenshinClassicRound, wish: WishRound, silhouette: GiSilhouetteRound, constellation: ConstellationRound, timeline: timelineRoundFor('genshin') },
  wow: { classic: WowClassicRound, art: WowArtRound, silhouette: WowSilhouetteRound, titles: WowTitlesRound, timeline: timelineRoundFor('wow') },
  forhonor: { picture: pictureRoundFor('forhonor'), clue: clueRoundFor('forhonor', 'Which hero fights with this?') },
  forts: { picture: pictureRoundFor('forts'), clue: clueRoundFor('forts', 'Which commander has this ability?') },
  avatar: { classic: classicRoundFor('avatar', 'character'), picture: pictureRoundFor('avatar'), clue: clueRoundFor('avatar', 'Who is this?') },
  unreal: { classic: BlueprintClassicRound, pins: BlueprintPinsRound, clue: BlueprintClueRound },
};

/** The line under a universe's title: what's in it, and when the data was built. */
const DATA_LINE: Record<UniverseId, string> = {
  onepiece: `${ONE_PIECE.characters.length} characters · ${ONE_PIECE.fruits.length} Devil Fruits · ${ONE_PIECE.crews.length} crews — wiki data from ${ONE_PIECE.generated}`,
  lol: `${LOL.champions.length} champions — Data Dragon ${LOL.version}, built ${LOL.generated}`,
  marvel: `${MARVEL.characters.length} characters · ${MARVEL.films.length} films — MCU wiki data from ${MARVEL.generated}`,
  genshin: `${GENSHIN.characters.length} characters, up to version ${GENSHIN.characters[GENSHIN.characters.length - 1]?.version} — Genshin wiki data from ${GENSHIN.generated}`,
  wow: `${WOW.characters.length} characters from the games — Warcraft Wiki data from ${WOW.generated}`,
  forhonor: `${SIMPLE.forhonor.characters.length} heroes · ${SIMPLE.forhonor.clues.length} weapons — For Honor wiki`,
  forts: `${SIMPLE.forts.characters.length} commanders, weapons and devices · ${SIMPLE.forts.clues.length} abilities — Forts wiki and EarthWork Games`,
  avatar: `${SIMPLE.avatar.characters.length} characters · ${SIMPLE.avatar.clues.length} clues — Avatar Wiki`,
  unreal: `${BLUEPRINT_NODES.length} of the Blueprint nodes everyone uses — drawn in the editor's colours`,
};

function Round({ universe: id, round, record, onChange }: RoundProps & { universe: UniverseId }) {
  const Component = ROUND_COMPONENT[id][round.type]!;
  return (
    <GameHostFx record={record} onChange={onChange}>
      {(change) => <Component round={round} record={record} onChange={change} />}
    </GameHostFx>
  );
}

/** /specialist */
export function SpecialistHub() {
  const special = useProgress((s) => s.special);
  return (
    <div className="space-y-8">
      <div>
        <Link to="/games" className="font-display text-sm font-semibold tracking-wider text-ink-soft hover:text-ink">
          ← Games
        </Link>
        <p className="font-display text-xs uppercase tracking-[0.3em] text-ink-faint">One universe, every angle</p>
        <h1 className="text-5xl font-bold">Specialist</h1>
        <p className="max-w-xl text-ink-soft">
          Pick a universe and play rounds made only from it: a Classic built on its own traits, plus games you won&apos;t find anywhere else — Devil
          Fruits, signature laughs and Jolly Rogers for One Piece, abilities and splash arts for League, posters and voice lines for Marvel, wish arts and constellations for Genshin, art and titles for World of Warcraft — and in every universe, a Timeline of who came first. A new daily every day, and practice whenever you like.
        </p>
      </div>
      <ul className="grid gap-4 sm:grid-cols-3">
        {UNIVERSES.map((u) => {
          const today = Object.values(special[`${u.id}:${todayKey()}`] ?? {}).filter((r) => r.status !== 'playing').length;
          const streak = specialStreak(special, u.id, u.types.length);
          const body = (
            <>
              <span className="font-display text-xl font-bold">{u.label}</span>
              <span className="text-sm text-ink-soft">{u.blurb}</span>
              <span className="mt-auto flex items-center justify-between pt-3 text-xs text-ink-faint">
                {u.ready ? (today >= u.types.length ? 'Today: done' : today ? `Today: ${today}/${u.types.length}` : 'Today: not started') : 'Coming soon'}
                {streak > 0 && (
                  <span className="inline-flex items-center gap-1 font-bold text-coral">
                    <FlameIcon /> {streak}
                  </span>
                )}
              </span>
            </>
          );
          return (
            <li key={u.id}>
              {u.ready ? (
                <Link to={`/specialist/${u.id}`} className="page flex h-full flex-col gap-1 rounded-md p-5 ring-2 ring-accent/40 transition hover:-translate-y-0.5">
                  {body}
                </Link>
              ) : (
                <div className="page flex h-full flex-col gap-1 rounded-md p-5 opacity-60">{body}</div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function shareText(id: UniverseId, date: string, rounds: SpRound[], records: Record<number, RoundRecord>, streak: number) {
  const score = rounds.reduce((n, _, i) => n + (records[i]?.score ?? 0), 0);
  return [
    `Omnidle Specialist · ${universe(id)!.label} ${date} — ${score}/${maxScore(id)}${streak > 1 ? ` 🔥${streak}` : ''}`,
    rounds.map((_, i) => roundEmoji(records[i])).join(''),
    rounds.map((r) => SP_META[r.type].icon).join(''),
    `${window.location.origin}${window.location.pathname}#/specialist/${id}/${date}`,
  ].join('\n');
}

function DailyView({ universe, date }: { universe: UniverseId; date: string }) {
  const key = `${universe}:${date}`;
  const rounds = useMemo(() => buildSpecialistDaily(universe, date), [universe, date]);
  const records = useProgress((s) => s.special[key]) ?? {};
  const special = useProgress((s) => s.special);
  const setRound = useProgress((s) => s.setSpecialRound);
  const isOpen = (i: number) => (records[i]?.status ?? 'playing') === 'playing';
  const [index, setIndex] = useState(() => rounds.findIndex((_, i) => isOpen(i)));
  const [copied, setCopied] = useState(false);
  const round = index >= 0 ? rounds[index] : undefined;
  const record = round ? records[index] ?? EMPTY_RECORD : undefined;
  const nextOpen = rounds.findIndex((_, i) => i !== index && isOpen(i));
  const score = rounds.reduce((n, _, i) => n + (records[i]?.score ?? 0), 0);
  const streak = specialStreak(special, universe, rounds.length);

  const onChange = (r: RoundRecord) => {
    setRound(key, index, r);
    if (r.status !== 'playing' && record?.status === 'playing' && nextOpen < 0) {
      window.setTimeout(() => {
        sfx.streak();
        celebrateBig();
      }, 600);
    }
  };
  const goTo = (i: number) => {
    sfx.click();
    setIndex(i);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const share = async () => {
    const text = shareText(universe, date, rounds, records, streak);
    try {
      if (navigator.share && matchMedia('(pointer: coarse)').matches) await navigator.share({ text });
      else await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      /* cancelled */
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <p className="font-display text-xs tracking-[0.25em] text-ink-faint">
          {formatLong(date).toUpperCase()} · №{dayNumber(date)}
          {date !== todayKey() && <span className="ml-2 rounded-sm border border-coral/60 px-1.5 text-coral">ARCHIVE</span>}
        </p>
        <p className="font-serif text-2xl font-bold tabular-nums">
          {score}
          <span className="text-base text-ink-faint"> / {maxScore(universe)}</span>
        </p>
      </div>
      <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${rounds.length}, minmax(0, 1fr))` }}>
        {rounds.map((r, i) => {
          const rec = records[i];
          const tone = rec?.status === 'won' ? 'border-hit/70 bg-hit/15' : rec?.status === 'lost' ? 'border-miss/60 bg-miss/10' : 'border-rule bg-card';
          return (
            <button
              key={i}
              type="button"
              onClick={() => goTo(i)}
              className={`flex flex-col items-center gap-0.5 rounded-md border p-2 transition hover:-translate-y-0.5 ${tone} ${i === index ? 'ring-2 ring-ink ring-offset-2 ring-offset-paper' : ''}`}
            >
              <span className="text-xl">{SP_META[r.type].icon}</span>
              <span className="font-display text-[10px] font-semibold text-ink-soft">{SP_META[r.type].name}</span>
            </button>
          );
        })}
      </div>

      {round && record ? (
        <section key={`${key}-${index}`} className="mx-auto max-w-4xl space-y-6">
          <div>
            <p className="text-xs font-display uppercase tracking-widest text-ink-faint">Round {index + 1} of {rounds.length}</p>
            <h2 className="text-3xl font-bold">
              {SP_META[round.type].icon} {SP_META[round.type].name}
            </h2>
            <p className="font-serif text-lg italic text-ink-soft">{SP_META[round.type].tagline}</p>
          </div>
          <Round universe={universe} round={round} record={record} onChange={onChange} />
          {record.status !== 'playing' && (
            <div className="flex justify-center">
              <button type="button" onClick={() => goTo(nextOpen)} className="btn-ink animate-pop rounded-md px-6 py-3 font-display font-bold tracking-wider">
                {nextOpen >= 0 ? 'Next round →' : 'See results →'}
              </button>
            </div>
          )}
        </section>
      ) : (
        <div className="animate-round-in mx-auto max-w-xl space-y-5 text-center">
          <p className="font-display text-sm uppercase tracking-[0.3em] text-ink-faint">Daily complete</p>
          <p className="font-serif text-7xl font-bold leading-none">{score}</p>
          <p className="text-ink-soft">
            out of {maxScore(universe)}
            {streak > 0 && (
              <span className="ml-2 inline-flex items-center gap-1 font-bold text-coral">
                <FlameIcon /> {streak}-day streak
              </span>
            )}
          </p>
          <Ornament />
          <div className="flex flex-wrap justify-center gap-3">
            <button type="button" onClick={share} className="btn-accent rounded-md px-5 py-2.5 font-semibold">
              {copied ? '✓ Copied!' : 'Share result'}
            </button>
            <button type="button" onClick={() => goTo(0)} className="btn-paper rounded-md px-5 py-2.5 font-semibold">
              Review rounds
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/** Endless random rounds of one type; nothing is saved. */
function PracticeView({ universe: id }: { universe: UniverseId }) {
  const types = universe(id)!.types;
  const [type, setType] = useState<SpType>(types[0]);
  const [n, setN] = useState(0);
  // Recent answers (saved across visits) stay out until the whole pool has come up.
  const scope = `practice:${id}:${type}`;
  const round = useMemo(
    () => randomRound(id, type, Math.random, new Set(recentlySeen(useProgress.getState().seen[scope], poolSize(id, type)))),
    [id, type, n],
  );
  useEffect(() => useProgress.getState().markSeen(scope, [round.targetId]), [round]);
  const [record, setRecord] = useState<RoundRecord>(EMPTY_RECORD);
  const next = (t: SpType = type) => {
    sfx.click();
    setType(t);
    setN((x) => x + 1);
    setRecord(EMPTY_RECORD);
  };
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap justify-center gap-2">
        {types.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => next(t)}
            className={`rounded-md border px-3 py-2 font-display text-sm font-semibold ${t === type ? 'border-ink bg-ink text-paper' : 'border-rule-strong bg-card hover:bg-tile'}`}
          >
            {SP_META[t].icon} {SP_META[t].name}
          </button>
        ))}
      </div>
      <section key={`${type}-${n}`} className="mx-auto max-w-4xl space-y-6">
        <Round universe={id} round={round} record={record} onChange={setRecord} />
        {record.status !== 'playing' && (
          <div className="flex justify-center">
            <button type="button" onClick={() => next()} className="btn-ink animate-pop rounded-md px-6 py-3 font-display font-bold tracking-wider">
              Another one →
            </button>
          </div>
        )}
      </section>
    </div>
  );
}

/** /specialist/:universe[/:date] */
export default function SpecialistUniverse() {
  const { universe, date = todayKey() } = useParams();
  const [tab, setTab] = useState<'daily' | 'practice'>('daily');
  const info = universe ? UNIVERSES.find((u) => u.id === universe) : undefined;
  if (!info?.ready) return <Navigate to="/specialist" replace />;
  if (!isPlayableDay(date)) return <Navigate to={`/specialist/${info.id}`} replace />;
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link to="/specialist" className="font-display text-sm font-semibold tracking-wider text-ink-soft hover:text-ink">
            ← Specialist
          </Link>
          <h1 className="text-4xl font-bold">{info.label}</h1>
          <p className="text-xs text-ink-faint">{DATA_LINE[info.id]}</p>
        </div>
        <div className="flex rounded-md border border-rule-strong p-0.5">
          {(['daily', 'practice'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`rounded px-4 py-1.5 font-display text-sm font-semibold capitalize ${tab === t ? 'bg-ink text-paper' : 'text-ink-soft hover:text-ink'}`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>
      {tab === 'daily' ? <DailyView key={`${info.id}-${date}`} universe={info.id} date={date} /> : <PracticeView key={info.id} universe={info.id} />}
    </div>
  );
}
