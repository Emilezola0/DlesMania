import { useState } from 'react';
import { ZoomImage } from '../../components/ZoomImage';
import { mulberry32 } from '../../lib/rng';
import { useProgress } from '../../store/progress';
import { tr, useT } from '../../lib/i18n';
import type { RoundRecord } from '../../types';
import { ABILITY_KEY_NAME, ABILITY_KEY_NAME_FR, LOL, LOL_FRENCH, LOL_EMOJI, LOL_QUOTES, LOL_SILHOUETTE_OF, LOL_SKINS, championById, skinSplash, type LolChampion } from '../lol';
import type { SpRound } from '../rounds';
import { SpGuessRound } from './SpGuessRound';

interface Props {
  round: SpRound;
  record: RoundRecord;
  onChange: (record: RoundRecord) => void;
}

/** League's words in French (the French client's names for regions, classes, lanes and ranges). */
const LOL_FR: Record<string, string> = {
  'Shadow Isles': 'Îles obscures', 'Bandle City': 'Bandle', Void: 'Néant', 'The Void': 'Néant', Targon: 'Targon', 'Mount Targon': 'Mont Targon', Runeterra: 'Runeterra',
  Fighter: 'Combattant', Tank: 'Tank', Mage: 'Mage', Assassin: 'Assassin', Marksman: 'Tireur', Support: 'Support', Controller: 'Contrôleur', Specialist: 'Spécialiste',
  Slayer: 'Tueur', Juggernaut: 'Colosse', Diver: 'Plongeur', Vanguard: 'Avant-garde', Warden: 'Gardien', Catcher: 'Attrapeur', Enchanter: 'Enchanteur',
  Burst: 'Burst', Battlemage: 'Mage de combat', Artillery: 'Artilleur', Skirmisher: 'Escarmoucheur',
  Top: 'Haut', Jungle: 'Jungle', Middle: 'Milieu', Mid: 'Milieu', Bottom: 'Bas', Bot: 'Bas', Melee: 'Mêlée', Ranged: 'Distance',
  Mana: 'Mana', Energy: 'Énergie', Fury: 'Fureur', Rage: 'Rage', Heat: 'Chaleur', Manaless: 'Sans ressource', Health: 'PV', Courage: 'Courage', Ferocity: 'Férocité',
  Flow: 'Flux', Shield: 'Bouclier', 'Blood Well': 'Réserve de sang', Grit: 'Ténacité', None: 'Aucune',
};
const lolFr = (s: string) => tr(s, LOL_FR[s] ?? s);

/** Facts about a champion, vaguest first. */
function championHints(c: LolChampion): string[] {
  return [
    tr(`Region: ${c.regions.join(', ')}`, `Région : ${c.regions.map(lolFr).join(', ')}`),
    c.classes.length ? tr(`Class: ${c.classes.join(' / ')}`, `Classe : ${c.classes.map(lolFr).join(' / ')}`) : tr(`Range: ${c.range}`, `Portée : ${lolFr(c.range)}`),
    tr(`Plays ${c.positions.join(' or ')}`, `Joue en ${c.positions.map(lolFr).join(' ou ')}`),
    c.year ? tr(`Released in ${c.year}`, `Sorti en ${c.year}`) : tr(`Resource: ${c.resource}`, `Ressource : ${lolFr(c.resource)}`),
    tr(`Their title: “${c.title}”`, `Son titre : « ${LOL_FRENCH.titles[c.id] ?? c.title} »`),
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
  const t = useT();
  const abilityName = t(ability.name, LOL_FRENCH.abilities[c.id]?.[ability.key] ?? ability.name);
  const keyName = t(ABILITY_KEY_NAME[ability.key], ABILITY_KEY_NAME_FR[ability.key]);
  const hints = [t(`It's their ${keyName}`, `C'est son ${keyName}`), ...championHints(c).slice(0, 3), t(`The ability is called “${abilityName}”`, `La compétence s'appelle « ${abilityName} »`)];
  return (
    <SpGuessRound
      type="ability"
      question={t('Which champion has this ability?', 'Quel champion a cette compétence ?')}
      pool={LOL.champions}
      targetId={c.id}
      hints={hints}
      record={record}
      onChange={onChange}
      answer={{ name: c.name, image: c.image, detail: `${keyName}${t(':', ' :')} ${abilityName}` }}
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
            <p className="font-display text-[11px] tracking-wider text-ink-faint">{done ? abilityName.toUpperCase() : t('CLEARS UP WITH EACH MISS', "S'ÉCLAIRCIT À CHAQUE ERREUR")}</p>
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
  const t = useT();
  return (
    <SpGuessRound
      type="splash"
      question={t('Whose splash art is this?', 'À qui est ce splash art ?')}
      pool={LOL.champions}
      targetId={c.id}
      hints={championHints(c)}
      record={record}
      onChange={onChange}
      answer={{ name: c.name, image: c.image, detail: t(c.title, LOL_FRENCH.titles[c.id] ?? c.title) }}
      clue={(wrong, done) => <ZoomImage src={c.splash} alt="Splash art" step={wrong} revealed={done} focus={focus} label={t('Zooms out with each miss', 'Recule à chaque erreur')} />}
    />
  );
}

/**
 * Skins: one of the champion's skins (its own splash art, not the base one), a tight crop pulling back with each miss.
 * The last hint is the skin's name with the champion's name masked; the skin's full name shows once the round is over.
 */
export function LolSkinRound({ round, record, onChange }: Props) {
  const c = championById.get(round.targetId)!;
  const fr = useProgress((s) => s.nameLang) === 'fr';
  const t = useT();
  // The seed picks the skin and where the crop starts, so the round is the same for everyone.
  const [{ skin, focus }] = useState(() => {
    const rand = mulberry32(round.seed);
    const skins = LOL_SKINS[c.id];
    const skin = skins[Math.floor(rand() * skins.length)];
    return { skin, focus: [30 + Math.round(rand() * 40), 25 + Math.round(rand() * 35)] as [number, number] };
  });
  const skinName = (fr && skin.fr) || skin.name;
  const masked = skinName.replace(new RegExp(c.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), '???');
  const hints = [...championHints(c).slice(0, 4), fr ? `Le skin s'appelle « ${masked} »` : `The skin is called “${masked}”`];
  return (
    <SpGuessRound
      type="skin"
      question={fr ? 'Quel champion porte ce skin ?' : 'Which champion wears this skin?'}
      pool={LOL.champions}
      targetId={c.id}
      hints={hints}
      record={record}
      onChange={onChange}
      answer={{ name: c.name, image: c.image, detail: skinName }}
      clue={(wrong, done) => <ZoomImage key={skin.num} src={skinSplash(c.id, skin.num)} alt={skinName} step={wrong} revealed={done} focus={focus} label={t('Zooms out with each miss', 'Recule à chaque erreur')} />}
    />
  );
}

/** Silhouette: the champion's render blacked out, in colour once the round is over. */
export function LolSilhouetteRound({ round, record, onChange }: Props) {
  const c = championById.get(round.targetId)!;
  const image = LOL_SILHOUETTE_OF.get(c.id)!;
  const t = useT();
  return (
    <SpGuessRound
      type="silhouette"
      question={t('Which champion is hiding in the shadow?', "Quel champion se cache dans l'ombre ?")}
      pool={LOL.champions}
      targetId={c.id}
      hints={championHints(c)}
      record={record}
      onChange={onChange}
      answer={{ name: c.name, image: c.image, detail: t(c.title, LOL_FRENCH.titles[c.id] ?? c.title) }}
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

/** Quote: the champion's champion select line; each miss adds one of their other lines (ban, then moving). */
export function LolQuoteRound({ round, record, onChange }: Props) {
  const c = championById.get(round.targetId)!;
  const q = LOL_QUOTES[c.id];
  const lines = [q.pick, ...(q.ban ? [q.ban] : []), ...q.more];
  const t = useT();
  return (
    <SpGuessRound
      type="quote"
      question={t('Which champion says this in game?', 'Quel champion dit ça en jeu ? (réplique anglaise)')}
      pool={LOL.champions}
      targetId={c.id}
      hints={championHints(c)}
      record={record}
      onChange={onChange}
      answer={{ name: c.name, image: c.image, detail: t(c.title, LOL_FRENCH.titles[c.id] ?? c.title) }}
      clue={(wrong, done) => (
        <div className="space-y-3">
          {lines.slice(0, done ? lines.length : Math.min(lines.length, 1 + wrong)).map((l, i) => (
            <blockquote key={i} className={`animate-pop text-center font-serif italic ${i === 0 ? 'text-3xl font-bold sm:text-4xl' : 'text-lg text-ink-soft'}`}>
              “{l}”
            </blockquote>
          ))}
          <p className="text-center font-display text-[11px] tracking-wider text-ink-faint">{done ? t('THEIR LINES', 'SES RÉPLIQUES') : linesLeftNote(lines.length, wrong)}</p>
        </div>
      )}
    />
  );
}

const linesLeftNote = (total: number, wrong: number) =>
  1 + wrong < total ? tr('ANOTHER OF THEIR LINES WITH EACH MISS', 'UNE AUTRE DE SES RÉPLIQUES À CHAQUE ERREUR') : tr('NO MORE LINES — GO BY THE HINTS', 'PLUS DE RÉPLIQUES — FIE-TOI AUX INDICES');

/** Emoji: the champion told in five emojis, one more with each miss. */
export function LolEmojiRound({ round, record, onChange }: Props) {
  const c = championById.get(round.targetId)!;
  const emojis = LOL_EMOJI[c.id];
  const t = useT();
  return (
    <SpGuessRound
      type="emoji"
      question={t('Which champion do these emojis tell?', 'Quel champion ces emojis racontent-ils ?')}
      pool={LOL.champions}
      targetId={c.id}
      hints={championHints(c)}
      record={record}
      onChange={onChange}
      answer={{ name: c.name, image: c.image, detail: t(c.title, LOL_FRENCH.titles[c.id] ?? c.title) }}
      clue={(wrong, done) => {
        const shown = done ? emojis.length : Math.min(emojis.length, 1 + wrong);
        return (
          <div className="space-y-2">
            <p className="flex justify-center gap-3 py-6 text-5xl sm:text-6xl">
              {emojis.map((e, i) => (
                <span key={i} className={i < shown ? 'animate-pop' : 'opacity-20 grayscale'}>
                  {i < shown ? e : '❔'}
                </span>
              ))}
            </p>
            <p className="text-center font-display text-[11px] tracking-wider text-ink-faint">{done ? c.name.toUpperCase() : t('ONE MORE EMOJI WITH EACH MISS', 'UN EMOJI DE PLUS À CHAQUE ERREUR')}</p>
          </div>
        );
      }}
    />
  );
}
