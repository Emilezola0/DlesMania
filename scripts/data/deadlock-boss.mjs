// The Deadlock boss (the Doorman) and its card roster, from src/data/specialist/deadlock.json
// (scripts/build-specialist-deadlock.mjs, The Deadlock Wiki): the heroes' painted card art and the items' icons.
// The Radar's impostors are another game's heroes (League of Legends champions, already in bosses.json, drawn art).
// Lines written for Omnidle.
//   node scripts/data/deadlock-boss.mjs
import { readFileSync, writeFileSync } from 'node:fs';

const ROOT = new URL('../../', import.meta.url);
const read = (p) => JSON.parse(readFileSync(new URL(p, ROOT), 'utf8'));
const D = read('src/data/specialist/deadlock.json');

const hero = new Map(D.heroes.map((h) => [h.name, h]));
const item = new Map(D.items.map((i) => [i.name, i]));
const aliasesOf = (name) => [...(name.startsWith('The ') ? [name.slice(4)] : []), ...(name.includes('&') ? [name.replace('&', 'and')] : [])];
const alias = (name) => [name, ...aliasesOf(name)].join('|');
const heroesOf = (type) => D.heroes.filter((h) => h.type === type).map((h) => alias(h.name));
const itemsOf = (slot) => D.items.filter((i) => i.slot === slot).map((i) => i.name);

const BOSS = 'The Doorman';
// The best-known heroes first (the first two are legendary cards, the next four epic), then the rest.
const FIRST = ['Haze', 'Seven', 'Infernus', 'Lady Geist', 'Abrams', 'Wraith', 'Bebop', 'McGinnis', 'Vindicta', 'Paradox', 'Kelvin', 'Pocket', 'Mo & Krill', 'Dynamo', 'Lash', 'Ivy', 'Grey Talon', 'Viscous', 'Warden', 'Yamato'];
const order = [...FIRST, ...D.heroes.map((h) => h.name).filter((n) => !FIRST.includes(n))].filter((n) => n !== BOSS && hero.get(n)?.image);
const members = order.map((n) => ({ label: n, image: hero.get(n).image, ...(aliasesOf(n).length ? { aliases: aliasesOf(n) } : {}) }));

const bosses = read('src/data/bosses.json');
const lol = bosses.find((b) => b.id === 'lol');
const impostors = [...lol.radar.members, ...lol.radar.impostors].filter((m) => m.image).slice(0, 14).map(({ label, image }) => ({ label, image }));

// Final Blow: the shop's best-known items, the first an epic card, the next three rare.
const FINALE = ['Unstoppable', 'Boundless Spirit', 'Curse', 'Leech', 'Siphon Bullets', 'Refresher', 'Echo Shard', 'Knockdown', 'Metal Skin', 'Glass Cannon', 'Crippling Headshot', 'Ethereal Shift', 'Silencer', 'Healing Rite', 'Vampiric Burst', 'Spirit Snatch'];
const finale = FINALE.filter((n) => item.get(n)).map((n) => ({ label: n, image: item.get(n).image }));

// Signature: an ability by its name — whose is it?
const signature = {
  label: 'Abilities',
  prompt: 'Whose ability is this?',
  clues: D.heroes.flatMap((h) => h.abilities.map((a) => ({ text: `${a.name}${a.slot === 4 ? ' (ultimate)' : ''}`, answer: alias(h.name) }))),
};

const boss = {
  id: 'deadlock',
  domain: 'games',
  franchise: 'Deadlock',
  aliases: ['deadlock', 'dead lock'],
  images: 'none',
  boss: { name: BOSS, title: 'Keeper of the Cursed Apple', color: '#a3e635', image: hero.get(BOSS).image },
  lines: {
    intro: 'Welcome to the Cursed Apple, guest. Every room is taken, every door is mine, and checkout is… not an option.',
    phase2: 'Some of these faces never checked in. Point out the real guests before I show you the way out!',
    phase3: 'You found the shop, I see. Name what is on the shelves before the bell rings!',
    hit: ['Do not touch the luggage!', 'Room service!', 'That was rude.'],
    hurt: ['Checked out!', 'Mind the door!', 'Back to spawn with you!', 'No refunds!'],
    win: 'Very well… Enjoy your stay. While it lasts.',
    lose: 'Another guest who stayed forever. I will keep the key.',
    secret: 'One last game before the lights go out. I name a hero or an item, you name another of the same. No repeats!',
    secretOk: ['Noted.', 'Next.', 'Lucky guest.'],
    secretLost: 'Nothing? Then your room is ready. Permanently.',
  },
  blitz: [
    { prompt: 'Name 5 heroes', count: 5, answers: D.heroes.map((h) => alias(h.name)) },
    { prompt: 'Name 4 Mystic heroes', count: 4, answers: heroesOf('Mystic') },
    { prompt: 'Name 4 Brawler heroes', count: 4, answers: heroesOf('Brawler') },
    { prompt: 'Name 3 Assassin heroes', count: 3, answers: heroesOf('Assassin') },
    { prompt: 'Name 3 Marksman heroes', count: 3, answers: heroesOf('Marksman') },
    { prompt: 'Name 5 Weapon items', count: 5, answers: itemsOf('Weapon') },
    { prompt: 'Name 5 Vitality items', count: 5, answers: itemsOf('Vitality') },
    { prompt: 'Name 5 Spirit items', count: 5, answers: itemsOf('Spirit') },
  ],
  radar: { members, impostors },
  finale,
  secret: {
    categories: [
      { label: 'Hero', entities: D.heroes.map((h) => alias(h.name)) },
      { label: 'Weapon item', entities: itemsOf('Weapon') },
      { label: 'Vitality item', entities: itemsOf('Vitality') },
      { label: 'Spirit item', entities: itemsOf('Spirit') },
    ],
  },
  signature,
};

const at = bosses.findIndex((b) => b.id === boss.id);
if (at >= 0) bosses[at] = boss;
else bosses.push(boss);
writeFileSync(new URL('src/data/bosses.json', ROOT), JSON.stringify(bosses, null, 2) + '\n');

// The cards beyond the boss's: every other item of the shop, its rarity from its tier.
const RARITY = { 4: 'epic', 3: 'rare' };
const inFinale = new Set(finale.map((f) => f.label));
const roster = D.items.filter((i) => !inFinale.has(i.name)).map((i) => ({ name: i.name, image: i.image, rarity: RARITY[i.tier] ?? 'common' }));
const ROSTERS = new URL('src/data/card-rosters.json', ROOT);
const rosters = read('src/data/card-rosters.json');
rosters.deadlock = roster;
writeFileSync(ROSTERS, JSON.stringify(rosters, null, 1) + '\n');
console.log(`boss: ${members.length} radar, ${impostors.length} impostors (${impostors.map((i) => i.label).join(', ')}), ${finale.length} finale, ${signature.clues.length} signature clues; roster: ${roster.length} cards`);
