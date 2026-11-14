import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { tr, useT } from '../lib/i18n';
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
import { AbilityRound, LolEmojiRound, LolQuoteRound, LolSilhouetteRound, LolSkinRound, SplashRound } from '../specialist/games/LolRounds';
import { FlagRound, FruitRound, LaughRound, WantedRound } from '../specialist/games/OnePieceRounds';
import { SP_META, UNIVERSES, UNIVERSE_BANNER, buildSpecialistDaily, isFeatured, maxScore, poolSize, randomRound, universe, type SpRound, type SpType, type UniverseId } from '../specialist/rounds';
import { GameHostFx } from '../games/GameHost';
import { classicRoundFor, clueRoundFor, danceRoundFor, executionRoundFor, ultCostRoundFor, pictureRoundFor, itemRoundFor, silhouetteRoundFor, spotlightRoundFor, voiceRoundFor, windowsRoundFor } from '../specialist/games/SimpleRounds';
import { SIMPLE } from '../specialist/simple';
import { ARC_FURNITURE, ARC_GEAR, ARC_MACHINES, ARC_MATERIALS, ARC_PLACES, ARC_RECIPES, ARC_SOUNDS } from '../specialist/arcraiders';
import { DL_ABILITIES, DL_HEROES, DL_ITEMS, DL_VOICES } from '../specialist/deadlock';
import { HSR_CHARACTERS, HSR_CONES, HSR_GENERATED, HSR_VOICES, versionValue } from '../specialist/hsr';
import { HsrClassicRound, HsrConeRound, HsrSplashRound, HsrVoiceRound, HsrWindowsRound } from '../specialist/games/HsrRounds';
import { DlAbilityRound, DlClassicRound, DlItemRound, DlPictureRound, DlVoiceRound, DlWindowsRound } from '../specialist/games/DeadlockRounds';
import { ArcClassicRound, ArcFurnitureRound, ArcGearRound, ArcMaterialRound, ArcMobRound, ArcPlaceRound, ArcRecipeRound, ArcSoundRound } from '../specialist/games/ArcRounds';
import { BLUEPRINT_NODES } from '../specialist/blueprint';
import { JLPT_KANJI, JLPT_WORDS } from '../specialist/jlpt';
import { JlptKanjiRound, JlptReadingRound, JlptWordRound } from '../specialist/games/JlptRounds';
import { BlueprintClassicRound, BlueprintClueRound, BlueprintPinsRound } from '../specialist/games/BlueprintRounds';

type RoundProps = { round: SpRound; record: RoundRecord; onChange: (r: RoundRecord) => void };

/** Which component plays each round type, per universe. */
const ROUND_COMPONENT: Record<UniverseId, Partial<Record<SpType, ComponentType<RoundProps>>>> = {
  onepiece: { classic: ClassicRound, fruit: FruitRound, laugh: LaughRound, flag: FlagRound, wanted: WantedRound, timeline: timelineRoundFor('onepiece') },
  lol: { classic: LolClassicRound, ability: AbilityRound, splash: SplashRound, silhouette: LolSilhouetteRound, timeline: timelineRoundFor('lol'), quote: LolQuoteRound, emoji: LolEmojiRound, skin: LolSkinRound },
  marvel: { classic: MarvelClassicRound, film: FilmRound, emoji: EmojiFilmRound, voice: VoiceRound, timeline: timelineRoundFor('marvel') },
  genshin: { classic: GenshinClassicRound, wish: WishRound, silhouette: GiSilhouetteRound, constellation: ConstellationRound, timeline: timelineRoundFor('genshin') },
  wow: { classic: WowClassicRound, art: WowArtRound, silhouette: WowSilhouetteRound, titles: WowTitlesRound, timeline: timelineRoundFor('wow') },
  forhonor: { picture: pictureRoundFor('forhonor'), clue: clueRoundFor('forhonor', 'Which hero fights with this?'), windows: windowsRoundFor('forhonor'), spotlight: spotlightRoundFor('forhonor'), execution: executionRoundFor('forhonor'), classic: classicRoundFor('forhonor', 'hero') },
  overwatch: { voice: voiceRoundFor('overwatch'), clue: clueRoundFor('overwatch', 'Whose ultimate is this?'), picture: pictureRoundFor('overwatch'), windows: windowsRoundFor('overwatch'), ultcost: ultCostRoundFor('overwatch'), classic: classicRoundFor('overwatch', 'hero') },
  ufouria: { dance: danceRoundFor('ufouria'), picture: pictureRoundFor('ufouria'), clue: clueRoundFor('ufouria', 'Who or what is this?'), windows: windowsRoundFor('ufouria'), spotlight: spotlightRoundFor('ufouria'), classic: classicRoundFor('ufouria', 'character') },
  hollowknight: { classic: classicRoundFor('hollowknight', 'bug'), picture: pictureRoundFor('hollowknight'), windows: windowsRoundFor('hollowknight'), clue: clueRoundFor('hollowknight', 'Who is this?'), voice: voiceRoundFor('hollowknight') },
  mha: { classic: classicRoundFor('mha', 'character'), picture: pictureRoundFor('mha'), windows: windowsRoundFor('mha'), clue: clueRoundFor('mha', 'Who is this?') },
  bg3: { classic: classicRoundFor('bg3', 'character'), picture: pictureRoundFor('bg3'), windows: windowsRoundFor('bg3'), clue: clueRoundFor('bg3', 'Who is this?') },
  hxh: { classic: classicRoundFor('hxh', 'character'), picture: pictureRoundFor('hxh'), windows: windowsRoundFor('hxh'), clue: clueRoundFor('hxh', 'Who is this?') },
  shrek: { classic: classicRoundFor('shrek', 'character'), picture: pictureRoundFor('shrek'), windows: windowsRoundFor('shrek'), clue: clueRoundFor('shrek', 'Who is this?') },
  arcraiders: { classic: ArcClassicRound, mob: ArcMobRound, gear: ArcGearRound, place: ArcPlaceRound, furniture: ArcFurnitureRound, material: ArcMaterialRound, recipe: ArcRecipeRound, sound: ArcSoundRound },
  hsr: { classic: HsrClassicRound, splash: HsrSplashRound, windows: HsrWindowsRound, lightcone: HsrConeRound, voice: HsrVoiceRound },
  deadlock: { classic: DlClassicRound, picture: DlPictureRound, windows: DlWindowsRound, ability: DlAbilityRound, voice: DlVoiceRound, item: DlItemRound },
  forts: { picture: pictureRoundFor('forts'), clue: clueRoundFor('forts', 'Which commander has this ability?'), windows: windowsRoundFor('forts'), silhouette: silhouetteRoundFor('forts') },
  avatar: { classic: classicRoundFor('avatar', 'character'), picture: pictureRoundFor('avatar'), clue: clueRoundFor('avatar', 'Who is this?'), windows: windowsRoundFor('avatar'), voice: voiceRoundFor('avatar') },
  destiny: { classic: classicRoundFor('destiny', 'character'), picture: pictureRoundFor('destiny'), clue: clueRoundFor('destiny', 'Who is this?'), windows: windowsRoundFor('destiny'), exotic: itemRoundFor('destiny', 'Which Exotic weapon is this?') },
  jlpt: { kanji: JlptKanjiRound, reading: JlptReadingRound, word: JlptWordRound },
  unreal: { classic: BlueprintClassicRound, pins: BlueprintPinsRound, clue: BlueprintClueRound },
};

/** The line under a universe's title: what's in it, and when the data was built. */
const DATA_LINE: Record<UniverseId, string> = {
  onepiece: `${ONE_PIECE.characters.length} characters · ${ONE_PIECE.fruits.length} Devil Fruits · ${ONE_PIECE.crews.length} crews — wiki data from ${ONE_PIECE.generated}`,
  lol: `${LOL.champions.length} champions — Data Dragon ${LOL.version}, built ${LOL.generated}`,
  marvel: `${MARVEL.characters.length} characters · ${MARVEL.films.length} films — MCU wiki data from ${MARVEL.generated}`,
  genshin: `${GENSHIN.characters.length} characters, up to version ${GENSHIN.characters[GENSHIN.characters.length - 1]?.version} — Genshin wiki data from ${GENSHIN.generated}`,
  wow: `${WOW.characters.length} characters from the games — Warcraft Wiki data from ${WOW.generated}`,
  forhonor: `${SIMPLE.forhonor.characters.length} heroes · ${SIMPLE.forhonor.clues.length} weapons${SIMPLE.forhonor.executions?.length ? ` · ${SIMPLE.forhonor.executions.length} executions` : ''} — For Honor wiki`,
  overwatch: `${SIMPLE.overwatch.characters.length} heroes · ${SIMPLE.overwatch.voices?.length ?? 0} voice lines · ${SIMPLE.overwatch.clues.length} ultimates — Overwatch wiki`,
  ufouria: `${SIMPLE.ufouria.characters.length} heroes, enemies and things · ${SIMPLE.ufouria.dances?.length ?? 0} dances · ${SIMPLE.ufouria.clues.length} clues — Sunsoft (official site, store pages and trailers)`,
  hollowknight: `${SIMPLE.hollowknight.characters.length} bosses and characters · ${SIMPLE.hollowknight.voices?.length ?? 0} voices · ${SIMPLE.hollowknight.clues.length} clues — Hollow Knight Wiki, myinstants`,
  mha: `${SIMPLE.mha.characters.length} heroes, students and villains · ${SIMPLE.mha.clues.length} clues — My Hero Academia Wiki`,
  bg3: `${SIMPLE.bg3.characters.length} companions, villains and allies · ${SIMPLE.bg3.clues.length} clues — bg3.wiki`,
  hxh: `${SIMPLE.hxh.characters.length} Hunters, Spiders, Zoldycks and Chimera Ants · ${SIMPLE.hxh.clues.length} clues — Hunterpedia`,
  shrek: `${SIMPLE.shrek.characters.length} ogres, fairy-tale creatures and royals · ${SIMPLE.shrek.clues.length} clues — Shrek Wiki`,
  arcraiders: `${ARC_MACHINES.length} ARC machines · ${ARC_GEAR.length} weapons and gear · ${ARC_PLACES.length} places · ${ARC_FURNITURE.length} containers · ${ARC_MATERIALS.length} materials · ${ARC_RECIPES.length} recipes · ${ARC_SOUNDS.length} sounds — ARC Raiders Wiki`,
  hsr: `${HSR_CHARACTERS.length} characters, up to version ${HSR_CHARACTERS.reduce((v, c) => (versionValue(c.version) > versionValue(v) ? c.version : v), '1.0')} · ${HSR_CONES.length} Light Cones · ${HSR_VOICES.length} voice lines — Honkai: Star Rail Wiki data from ${HSR_GENERATED}`,
  deadlock: `${DL_HEROES.length} heroes · ${DL_ABILITIES.length} abilities · ${DL_VOICES.length} voice lines · ${DL_ITEMS.length} items — The Deadlock Wiki`,
  forts: `${SIMPLE.forts.characters.length} commanders, weapons and devices · ${SIMPLE.forts.clues.length} abilities — Forts wiki and EarthWork Games`,
  avatar: `${SIMPLE.avatar.characters.length} characters · ${SIMPLE.avatar.clues.length} clues · ${SIMPLE.avatar.voices?.length ?? 0} voice lines — Avatar Wiki, myinstants`,
  destiny: `${SIMPLE.destiny.characters.length} characters · ${SIMPLE.destiny.clues.length} clues · ${SIMPLE.destiny.items?.length ?? 0} Exotic weapons — Destinypedia, Bungie (via godroll.tv)`,
  jlpt: `${JLPT_KANJI.length.toLocaleString('en')} kanji · ${JLPT_WORDS.length.toLocaleString('en')} words — Coto Academy's JLPT list`,
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
  const t = useT();
  return (
    <div className="space-y-8">
      <div>
        <Link to="/games" className="font-display text-sm font-semibold tracking-wider text-ink-soft hover:text-ink">
          ← {t('Games', 'Jeux')}
        </Link>
        <p className="font-display text-xs uppercase tracking-[0.3em] text-ink-faint">{t('One universe, every angle', 'Un univers, sous tous les angles')}</p>
        <h1 className="text-5xl font-bold">{t('Specialist', 'Spécialiste')}</h1>
        <p className="max-w-xl text-ink-soft">
          {t(
            "Pick a universe and play rounds made only from it: a Classic built on its own traits, plus games you won't find anywhere else — Devil Fruits, signature laughs and Jolly Rogers for One Piece, abilities, splash arts and skins for League, posters and voice lines for Marvel, wish arts and constellations for Genshin, art and titles for World of Warcraft — and in every universe, a Timeline of who came first. A new daily every day, and practice whenever you like.",
            'Choisis un univers et joue des manches faites uniquement de lui : un Classique bâti sur ses propres traits, et des jeux introuvables ailleurs — fruits du démon, rires et Jolly Rogers pour One Piece, compétences, splash arts et skins pour League, affiches et répliques pour Marvel, arts de vœu et constellations pour Genshin, art et titres pour World of Warcraft — et dans chaque univers, une Chronologie de qui est arrivé en premier. Un nouveau défi chaque jour, et de l’entraînement quand tu veux.',
          )}
        </p>
      </div>
      {/* The owner's three most important, in gold, on their own above the rest. */}
      {[UNIVERSES.filter((u) => isFeatured(u.id)), UNIVERSES.filter((u) => !isFeatured(u.id))].map((group, g) => (
      <section key={g} className="space-y-3">
      {g === 1 && <p className="font-display text-xs uppercase tracking-[0.3em] text-ink-faint">{t('More universes', 'Autres univers')}</p>}
      <ul className="grid gap-4 sm:grid-cols-3">
        {group.map((u) => {
          const today = Object.values(special[`${u.id}:${todayKey()}`] ?? {}).filter((r) => r.status !== 'playing').length;
          const streak = specialStreak(special, u.id, u.types.length);
          const banner = UNIVERSE_BANNER[u.id];
          const body = (
            <>
              {/* The universe's banner, slightly blurred, inside the frame (the corner diamonds stay on top of it). */}
              <span aria-hidden className="pointer-events-none absolute inset-[6px] -z-10 overflow-hidden rounded-sm">
                {banner ? (
                  <img src={banner} alt="" loading="lazy" draggable={false} className="size-full scale-110 object-cover opacity-60 blur-[3px]" />
                ) : (
                  <span className="block size-full bg-[#0d3b66] opacity-60 [background-image:linear-gradient(#ffffff22_1px,transparent_1px),linear-gradient(90deg,#ffffff22_1px,transparent_1px)] [background-size:16px_16px] blur-[1px]" />
                )}
                <span className="absolute inset-0 bg-gradient-to-br from-card/85 via-card/60 to-card/35" />
              </span>
              <span className={`font-display text-xl font-bold ${isFeatured(u.id) ? 'golden-text' : ''}`}>{isFeatured(u.id) ? `★ ${u.label}` : u.label}</span>
              <span className="text-sm text-ink-soft">{u.blurb}</span>
              <span className="mt-auto flex items-center justify-between pt-3 text-xs text-ink-faint">
                {u.ready
                  ? today >= u.types.length
                    ? t('Today: done', 'Aujourd’hui : fait')
                    : today
                      ? t(`Today: ${today}/${u.types.length}`, `Aujourd’hui : ${today}/${u.types.length}`)
                      : t('Today: not started', 'Aujourd’hui : pas commencé')
                  : t('Coming soon', 'Bientôt')}
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
                <Link to={`/specialist/${u.id}`} className={`page isolate flex h-full flex-col gap-1 rounded-md p-5 transition hover:-translate-y-0.5 ${isFeatured(u.id) ? 'golden-ready bg-gradient-to-br from-[#fde68a]/15 to-transparent' : 'ring-2 ring-accent/40'}`}>
                  {body}
                </Link>
              ) : (
                <div className="page isolate flex h-full flex-col gap-1 rounded-md p-5 opacity-60">{body}</div>
              )}
            </li>
          );
        })}
      </ul>
      </section>
      ))}
    </div>
  );
}

function shareText(id: UniverseId, date: string, rounds: SpRound[], records: Record<number, RoundRecord>, streak: number) {
  const score = rounds.reduce((n, _, i) => n + (records[i]?.score ?? 0), 0);
  return [
    `Omnidle ${tr('Specialist', 'Spécialiste')} · ${universe(id)!.label} ${date} — ${score}/${maxScore(id)}${streak > 1 ? ` 🔥${streak}` : ''}`,
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
  const t = useT();
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
            <p className="text-xs font-display uppercase tracking-widest text-ink-faint">{t(`Round ${index + 1} of ${rounds.length}`, `Manche ${index + 1} sur ${rounds.length}`)}</p>
            <h2 className="text-3xl font-bold">
              {SP_META[round.type].icon} {SP_META[round.type].name}
            </h2>
            <p className="font-serif text-lg italic text-ink-soft">{SP_META[round.type].tagline}</p>
          </div>
          <Round universe={universe} round={round} record={record} onChange={onChange} />
          {record.status !== 'playing' && (
            <div className="flex justify-center">
              <button type="button" data-next onClick={() => goTo(nextOpen)} className="btn-ink animate-pop rounded-md px-6 py-3 font-display font-bold tracking-wider">
                {nextOpen >= 0 ? t('Next round →', 'Manche suivante →') : t('See results →', 'Voir les résultats →')}
              </button>
            </div>
          )}
        </section>
      ) : (
        <div className="animate-round-in mx-auto max-w-xl space-y-5 text-center">
          <p className="font-display text-sm uppercase tracking-[0.3em] text-ink-faint">{t('Daily complete', 'Défi du jour terminé')}</p>
          <p className="font-serif text-7xl font-bold leading-none">{score}</p>
          <p className="text-ink-soft">
            {t('out of', 'sur')} {maxScore(universe)}
            {streak > 0 && (
              <span className="ml-2 inline-flex items-center gap-1 font-bold text-coral">
                <FlameIcon /> {t(`${streak}-day streak`, `série de ${streak} jours`)}
              </span>
            )}
          </p>
          <Ornament />
          <div className="flex flex-wrap justify-center gap-3">
            <button type="button" onClick={share} className="btn-accent rounded-md px-5 py-2.5 font-semibold">
              {copied ? t('✓ Copied!', '✓ Copié !') : t('Share result', 'Partager le résultat')}
            </button>
            <button type="button" onClick={() => goTo(0)} className="btn-paper rounded-md px-5 py-2.5 font-semibold">
              {t('Review rounds', 'Revoir les manches')}
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
  const tt = useT();
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
              {tt('Another one →', 'Une autre →')}
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
  const t = useT();
  if (!info?.ready) return <Navigate to="/specialist" replace />;
  if (!isPlayableDay(date)) return <Navigate to={`/specialist/${info.id}`} replace />;
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link to="/specialist" className="font-display text-sm font-semibold tracking-wider text-ink-soft hover:text-ink">
            ← {t('Specialist', 'Spécialiste')}
          </Link>
          <h1 className="text-4xl font-bold">{info.label}</h1>
          <p className="text-xs text-ink-faint">{DATA_LINE[info.id]}</p>
        </div>
        <div className="flex rounded-md border border-rule-strong p-0.5">
          {(['daily', 'practice'] as const).map((tab2) => (
            <button
              key={tab2}
              type="button"
              onClick={() => setTab(tab2)}
              className={`rounded px-4 py-1.5 font-display text-sm font-semibold capitalize ${tab === tab2 ? 'bg-ink text-paper' : 'text-ink-soft hover:text-ink'}`}
            >
              {tab2 === 'daily' ? t('Daily', 'Du jour') : t('Practice', 'Entraînement')}
            </button>
          ))}
        </div>
      </div>
      {tab === 'daily' ? <DailyView key={`${info.id}-${date}`} universe={info.id} date={date} /> : <PracticeView key={info.id} universe={info.id} />}
    </div>
  );
}
