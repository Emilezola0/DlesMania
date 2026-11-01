// More Who Am I? universes, for the games only (the cards' lines keep coming from WHO_UNIVERSES alone):
// Harry Potter, Star Wars, Naruto and Dragon Ball from their open data (src/specialist/extra.ts), and the
// Specialist's Overwatch, Destiny, Avatar and For Honor people with their traits as clues.
import { DRAGON_BALL, HARRY_POTTER, NARUTO, STAR_WARS, formatKi } from '../specialist/extra';
import { SIMPLE, type SimpleUniverse } from '../specialist/simple';
import { WHO_UNIVERSES, list, nameClue, type WhoTarget, type WhoUniverse } from './whoAmI';

const harryPotter: WhoTarget[] = HARRY_POTTER.map((c) => ({
  id: c.id,
  name: c.name,
  aliases: c.aliases,
  image: c.image,
  clues: [
    `${c.gender} · ${c.species}`,
    c.role || (c.alive ? 'Alive at the end of the story' : 'Dead by the end of the story'),
    c.ancestry ? `Blood status: ${c.ancestry}` : 'Blood status unknown',
    c.house ? `House: ${c.house}` : 'No Hogwarts house',
    c.wand ? `Wand: ${c.wand}` : c.born ? `Born in ${c.born}` : 'No known wand',
    c.patronus ? `Patronus: ${c.patronus}` : c.born ? `Born in ${c.born}` : 'No known Patronus',
    c.actor ? `Played by ${c.actor}` : nameClue(c.name),
    nameClue(c.name),
  ].filter((x, i, all) => all.indexOf(x) === i),
}));

const starWars: WhoTarget[] = STAR_WARS.map((c) => ({
  id: c.id,
  name: c.name,
  aliases: [],
  image: c.image,
  clues: [
    `${c.gender || 'No gender'} · ${c.species || 'Unknown species'}`,
    c.homeworld ? `From ${c.homeworld}` : 'Homeworld unknown',
    c.born ? `Born ${c.born}` : c.height ? `${(c.height / 100).toFixed(2)} m tall` : 'Birth date unknown',
    c.height ? `${(c.height / 100).toFixed(2)} m tall` : 'Height unknown',
    c.affiliations.length ? `Affiliations: ${c.affiliations.slice(0, 2).join(', ')}` : 'No known affiliation',
    c.masters.length ? `Trained by ${list(c.masters)}` : c.apprentices.length ? `Trained ${list(c.apprentices)}` : c.affiliations[2] ? `Also: ${c.affiliations[2]}` : 'Never trained as a Jedi or Sith',
    nameClue(c.name),
  ].filter((x, i, all) => all.indexOf(x) === i),
}));

const naruto: WhoTarget[] = NARUTO.map((c) => ({
  id: c.id,
  name: c.name,
  aliases: [],
  image: c.image,
  clues: [
    `${c.sex} · from ${c.village || 'no village'}`,
    c.natures.length ? `Nature: ${list(c.natures)}` : 'No known nature type',
    c.rank ? `Rank: ${c.rank}` : 'No ninja rank',
    c.classification.length ? `${list(c.classification)}` : c.team ? `Team: ${c.team}` : 'No special classification',
    c.team ? `Team: ${c.team}` : c.affiliations[1] ? `Also: ${c.affiliations[1]}` : 'No known team',
    c.clan ? `Clan: ${c.clan}` : 'No known clan',
    c.kekkeiGenkai.length ? `Kekkei genkai: ${list(c.kekkeiGenkai)}` : nameClue(c.name),
    nameClue(c.name),
  ].filter((x, i, all) => all.indexOf(x) === i),
}));

const dragonBall: WhoTarget[] = DRAGON_BALL.map((c) => ({
  id: c.id,
  name: c.name,
  aliases: c.aliases,
  image: c.image,
  clues: [
    `${c.gender} · ${c.race || 'unknown race'}`,
    `Affiliation: ${c.affiliation}`,
    c.planet ? `From ${c.planet}` : 'Home planet unknown',
    c.maxKiValue ? `Max ki: ${formatKi(c.maxKiValue)}` : 'No fighting power to speak of',
    c.transformations ? `${c.transformations} transformation${c.transformations === 1 ? '' : 's'}` : 'No transformations',
    nameClue(c.name),
  ],
}));

/** A Specialist universe's people, their traits as clues (the vaguest first, as listed). */
const fromSimple = (u: SimpleUniverse): WhoTarget[] =>
  u.characters
    .filter((c) => c.image && Object.values(c.traits).filter((v) => v && v !== 'Unknown').length >= 3)
    .map((c) => ({
      id: c.id,
      name: c.name,
      aliases: c.aliases,
      image: c.image,
      clues: [...Object.entries(c.traits).filter(([, v]) => v && v !== 'Unknown').map(([k, v]) => `${k}: ${v}`), nameClue(c.name)],
    }));

/** Every universe a Who Am I? game can be played in. */
export const WHO_ALL: WhoUniverse[] = [
  ...WHO_UNIVERSES,
  ...(
    [
      { id: 'harrypotter', label: 'Harry Potter', icon: '🪄', domain: 'cinema', pool: harryPotter, targets: harryPotter.filter((c) => c.image) },
      { id: 'starwars', label: 'Star Wars', icon: '🌌', domain: 'cinema', pool: starWars, targets: starWars.filter((c) => c.image) },
      { id: 'naruto', label: 'Naruto', icon: '🍥', domain: 'anime', pool: naruto, targets: naruto.slice(0, 80) },
      { id: 'dbz', label: 'Dragon Ball', icon: '💥', domain: 'anime', pool: dragonBall, targets: dragonBall.filter((c) => c.image) },
      { id: 'overwatch', label: 'Overwatch', icon: '🎯', domain: 'games', pool: fromSimple(SIMPLE.overwatch), targets: fromSimple(SIMPLE.overwatch) },
      { id: 'destiny', label: 'Destiny', icon: '🌒', domain: 'games', pool: fromSimple(SIMPLE.destiny), targets: fromSimple(SIMPLE.destiny) },
      { id: 'avatar', label: 'Avatar: The Last Airbender', icon: '🌊', domain: 'anime', pool: fromSimple(SIMPLE.avatar), targets: fromSimple(SIMPLE.avatar) },
      { id: 'forhonor', label: 'For Honor', icon: '🛡️', domain: 'games', pool: fromSimple(SIMPLE.forhonor), targets: fromSimple(SIMPLE.forhonor) },
    ] as WhoUniverse[]
  ).filter((u) => u.targets.length >= 8),
];
