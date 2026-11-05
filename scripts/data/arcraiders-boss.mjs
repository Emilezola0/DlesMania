// The ARC Raiders boss (the Queen) and its card roster, from src/data/specialist/arcraiders.json
// (scripts/build-specialist-arcraiders.mjs, the ARC Raiders Wiki) and the traders' portraits on the same wiki.
// The Radar's impostors are another game's machines (Horizon Zero Dawn's, from its wiki). Lines written for Omnidle.
//   node scripts/data/arcraiders-boss.mjs
import { readFileSync, writeFileSync } from 'node:fs';

const ROOT = new URL('../../', import.meta.url);
const read = (p) => JSON.parse(readFileSync(new URL(p, ROOT), 'utf8'));
const D = read('src/data/specialist/arcraiders.json');
const UA = 'OmnidleBot/1.0 (fan site data builder)';

async function thumbs(files) {
  const url = `https://arcraiders.wiki/w/api.php?${new URLSearchParams({ format: 'json', action: 'query', prop: 'imageinfo', iiprop: 'url', iiurlwidth: '400', titles: files.map((f) => `File:${f}`).join('|') })}`;
  const d = await (await fetch(url, { headers: { 'User-Agent': UA } })).json();
  const out = new Map();
  for (const p of Object.values(d.query.pages)) if (p.imageinfo) out.set(p.title.replace(/^File:/, '').replace(/ /g, '_'), p.imageinfo[0].thumburl ?? p.imageinfo[0].url);
  return out;
}

const arc = new Map(D.arcs.map((a) => [a.name, a]));
const gear = new Map(D.gear.map((g) => [g.name, g]));
const alias = (name) => {
  const a = [name];
  if (name.startsWith('ARC ')) a.push(name.slice(4));
  if (name.startsWith('The ')) a.push(name.slice(4));
  if (name.endsWith(' Shield')) a.push(name.replace(/ Shield$/, ''));
  return a.join('|');
};

const TRADERS = ['Apollo', 'Celeste', 'Lance', 'Shani', 'Tian Wen'];
const traderArt = await thumbs(['Trader_Apollo_horizontal.png', 'Trader_Celeste_vertical.png', 'Trader_Lance_vertical.png', 'Trader_Shani_vertical.png', 'Trader_Tian_Wen_horizontal.png', 'Scrappy.png']);
const traderImage = (n) => [...traderArt].find(([k]) => k.startsWith(`Trader_${n.replace(/ /g, '_')}_`))?.[1];

const MAPS = D.places.filter((p) => p.kind === 'Map').map((p) => p.name);
const WEAPONS = D.gear.filter((g) => g.kind === 'Weapon').map((g) => g.name);
const GRENADES = D.gear.filter((g) => g.kind === 'Grenade').map((g) => g.name);
const STATIONS = ['Workbench', 'Gunsmith', 'Gear Bench', 'Medical Lab', 'Explosives Station', 'Utility Station', 'Refiner'];
const BASIC = D.materials.filter((m) => m.kind !== 'Topside').map((m) => m.name);

// The best-known machines first (the first two are legendary cards, the next four epic), then the traders.
const RADAR_ARCS = ['Leaper', 'Bastion', 'Wasp', 'Hornet', 'Rocketeer', 'Bombardier', 'Matriarch', 'Queen', 'Shredder', 'Sentinel', 'Snitch', 'Tick', 'Pop', 'Spotter', 'Fireball', 'Firefly', 'Turret', 'ARC Surveyor', 'Comet', 'Vaporizer', 'Bully', 'Hydra', 'Skulker'];
const members = [
  ...RADAR_ARCS.filter((n) => n !== 'Queen' && arc.get(n)?.image).map((n) => ({ label: n, image: arc.get(n).image, ...(n.startsWith('ARC ') ? { aliases: [n.slice(4)] } : {}) })),
  ...TRADERS.filter(traderImage).map((n) => ({ label: n, image: traderImage(n) })),
  ...(traderArt.get('Scrappy.png') ? [{ label: 'Scrappy', image: traderArt.get('Scrappy.png') }] : []),
];

const HORIZON = {
  Watcher: 'https://static.wikia.nocookie.net/horizonzerodawn/images/0/04/Watcher-Render.png/revision/latest/scale-to-width-down/400?cb=20170623042110',
  Thunderjaw: 'https://static.wikia.nocookie.net/horizonzerodawn/images/a/a9/Thunderjaw-Render.png/revision/latest/scale-to-width-down/400?cb=20170623042329',
  Sawtooth: 'https://static.wikia.nocookie.net/horizonzerodawn/images/9/94/Sawtooth-Render.png/revision/latest/scale-to-width-down/400?cb=20170623043043',
  Tallneck: 'https://static.wikia.nocookie.net/horizonzerodawn/images/3/34/TallNeck-Render.png/revision/latest/scale-to-width-down/400?cb=20170623042418',
  Stormbird: 'https://static.wikia.nocookie.net/horizonzerodawn/images/6/6a/Stormbird-Render.png/revision/latest/scale-to-width-down/400?cb=20170623042041',
  Grazer: 'https://static.wikia.nocookie.net/horizonzerodawn/images/4/45/Grazer-Render.png/revision/latest/scale-to-width-down/400?cb=20170623043652',
  Scrapper: 'https://static.wikia.nocookie.net/horizonzerodawn/images/e/e3/Scrapper-Render.png/revision/latest/scale-to-width-down/400?cb=20170623042955',
  Snapmaw: 'https://static.wikia.nocookie.net/horizonzerodawn/images/5/5e/Snapmaw-Render.png/revision/latest/scale-to-width-down/400?cb=20170623042718',
  Glinthawk: 'https://static.wikia.nocookie.net/horizonzerodawn/images/d/d7/Glinthawk-Render.png/revision/latest/scale-to-width-down/400?cb=20170623043725',
  Ravager: 'https://static.wikia.nocookie.net/horizonzerodawn/images/c/c7/Ravager-Render.png/revision/latest/scale-to-width-down/400?cb=20170623043305',
  Stalker: 'https://static.wikia.nocookie.net/horizonzerodawn/images/6/6e/Stalker-Render.png/revision/latest/scale-to-width-down/400?cb=20170623042607',
  'Shell-Walker': 'https://static.wikia.nocookie.net/horizonzerodawn/images/8/88/ShellWalker-Render.png/revision/latest/scale-to-width-down/400?cb=20170623042908',
  Longleg: 'https://static.wikia.nocookie.net/horizonzerodawn/images/0/08/LongLeg-Render.png/revision/latest/scale-to-width-down/400?cb=20170623043400',
  Rockbreaker: 'https://static.wikia.nocookie.net/horizonzerodawn/images/b/b3/Rockbreaker-Render.png/revision/latest/scale-to-width-down/400?cb=20170623043130',
};

// Final Blow: the gear and the places, the first an epic card, the next three rare.
const FINALE_GEAR = ['Ferro', 'Kettle', 'Stitcher', 'Anvil', 'Il Toro', 'Hairpin', 'Rattler', 'Venator', 'Renegade', 'Light Shield', 'Heavy Shield', 'Zipline', 'Wolfpack', 'Defibrillator', 'Snap Hook', 'Photoelectric Cloak', 'Grappling Hook', 'Bandage'];
const finale = [
  ...FINALE_GEAR.filter((n) => gear.get(n)).map((n) => ({ label: n, image: gear.get(n).image, ...(alias(n).includes('|') ? { aliases: alias(n).split('|').slice(1) } : {}) })),
  ...D.placePictures.filter((p, i, all) => all.findIndex((x) => x.answer === p.answer) === i && ['Speranza', 'Raider Hatch'].includes(p.answer)).map((p) => ({ label: p.answer, image: p.image })),
];

// Signature: as in the Specialist's Crafting round — every recipe, its ingredients side by side, and hints
// as the clock runs down (where it is crafted, what kind of thing it is, its length, its first letter).
const kindOf = new Map([...D.gear.map((g) => [g.name, g.kind]), ...D.materials.map((m) => [m.name, `${m.kind} material`])]);
const words = (name) => {
  const n = name.split(/s+/).length;
  return `${n} word${n === 1 ? '' : 's'}`;
};
const signature = {
  label: 'Crafting',
  prompt: 'What do you craft with this?',
  seconds: 30,
  hints: true,
  clues: D.recipes.map((r) => ({
    ingredients: r.ingredients,
    hints: [`Crafted at: ${r.station}`, ...(kindOf.get(r.name) ? [`Kind: ${kindOf.get(r.name)}`] : []), words(r.name), `Its name starts with “${r.name[0]}”`],
    answer: alias(r.name),
  })),
};

// Kept out of the Final Blow (their cards stay): the two places, the augments, and parts nobody names on sight.
const finaleSkip = [
  'Speranza',
  'Raider Hatch',
  ...D.gear.map((g) => g.name).filter((n) => /^(Combat|Tactical|Looting) Mk./.test(n)),
  ...['ARC Conductive Coupler', 'ARC Insulated Coupler', 'ARC Plated Coupler', 'Speaker Component', 'Voltage Converter'],
];
// The weapons are wide pictures: shown whole in the Final Blow, not cropped to the square.
const wholeFaces = WEAPONS;

const boss = {
  id: 'arcraiders',
  domain: 'games',
  franchise: 'ARC Raiders',
  aliases: ['arc raiders', 'arc raider', 'arcraiders', 'arc'],
  images: 'none',
  boss: { name: 'Queen', title: 'The Crowned ARC', color: '#dc2626', image: arc.get('Queen').image },
  lines: {
    intro: 'Topside belongs to the ARC. Come up from Speranza if you dare, Raider. The Queen is listening.',
    phase2: 'Half of these machines never fell from the sky. Pick out the real ARC before my swarm finds you!',
    phase3: 'My hull is opening. Name every scrap you see before the Wasps come home!',
    hit: ['Hull breach!', 'My leg joint!', 'Core exposed!'],
    hurt: ['Downed!', 'Shredded!', 'Back down the elevator, Raider!', 'There goes your loot!'],
    win: 'Systems failing… Take your scrap and go. The ARC will be back.',
    lose: 'Another Raider who never reached extraction. Your loot is mine now.',
    secret: 'One more round before extraction. I name an ARC, a weapon, a map or a trader. You name another of the same. No repeats!',
    secretOk: ['Noted.', 'Again.', 'Lucky Raider.'],
    secretLost: 'Nothing? Then you stay topside for good.',
  },
  blitz: [
    { prompt: 'Name 5 ARC machines', count: 5, answers: D.arcs.map((a) => alias(a.name)) },
    { prompt: 'Name 4 maps', count: 4, answers: MAPS.map((m) => (m === 'Dam Battlegrounds' ? 'Dam Battlegrounds|Dam' : m === 'Spaceport' ? 'Spaceport|Acerra Spaceport' : alias(m))) },
    { prompt: 'Name 5 weapons', count: 5, answers: WEAPONS },
    { prompt: 'Name 4 traders of Speranza', count: 4, answers: TRADERS },
    { prompt: 'Name the 3 shields', count: 3, answers: ['Light Shield', 'Medium Shield', 'Heavy Shield'].map(alias) },
    { prompt: 'Name 4 grenades', count: 4, answers: GRENADES },
    { prompt: 'Name 4 crafting stations', count: 4, answers: STATIONS },
    { prompt: 'Name 5 basic or refined materials', count: 5, answers: BASIC },
  ],
  radar: { members, impostors: Object.entries(HORIZON).map(([label, image]) => ({ label, image })) },
  finale,
  secret: {
    categories: [
      { label: 'ARC', entities: D.arcs.map((a) => alias(a.name)) },
      { label: 'Weapon', entities: WEAPONS },
      { label: 'Map', entities: MAPS.map(alias) },
      { label: 'Trader', entities: TRADERS },
    ],
  },
  signature,
  finaleSkip,
  wholeFaces,
};

const FILE = new URL('src/data/bosses.json', ROOT);
const bosses = read('src/data/bosses.json');
const at = bosses.findIndex((b) => b.id === boss.id);
if (at >= 0) bosses[at] = boss;
else bosses.push(boss);
writeFileSync(FILE, JSON.stringify(bosses, null, 2) + '\n');

// The cards beyond the boss's: every other machine, weapon, piece of gear and material, their rarity from the wiki's.
const RARITY = { Legendary: 'epic', Epic: 'epic', Rare: 'rare' };
const BIG = new Set(['Queen', 'Matriarch', 'Bastion', 'Bombardier', 'Leaper', 'Rocketeer', 'ARC Turbine', 'Hydra', 'Bully', 'Shredder']);
const roster = [
  ...D.arcs.map((a) => ({ name: a.name, image: a.image, rarity: BIG.has(a.name) ? 'epic' : 'rare' })),
  ...D.gear.map((g) => ({ name: g.name, image: g.image, rarity: RARITY[g.rarity] ?? 'common' })),
  ...D.materials.map((m) => ({ name: m.name, image: m.image, rarity: RARITY[m.rarity] ?? 'common' })),
];
const ROSTERS = new URL('src/data/card-rosters.json', ROOT);
const rosters = read('src/data/card-rosters.json');
rosters.arcraiders = roster;
writeFileSync(ROSTERS, JSON.stringify(rosters, null, 1) + '\n');
console.log(`boss: ${members.length} radar, ${finale.length} finale, ${signature.clues.length} signature clues; roster: ${roster.length} cards`);
