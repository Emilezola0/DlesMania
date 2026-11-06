// The Honkai: Star Rail boss (Nanook, Aeon of Destruction) and its card roster, from src/data/specialist/hsr.json
// (scripts/build-specialist-hsr.mjs, the Honkai: Star Rail Wiki): the characters' drawn icons and the Light Cones' art.
// The Radar's impostors are Genshin Impact's characters (already in bosses.json, drawn icons). Lines written for Omnidle.
//   node scripts/data/hsr-boss.mjs
import { readFileSync, writeFileSync } from 'node:fs';

const ROOT = new URL('../../', import.meta.url);
const read = (p) => JSON.parse(readFileSync(new URL(p, ROOT), 'utf8'));
// bosses.json and card-rosters.json keep Windows line ends.
const write = (p, j, indent) => writeFileSync(new URL(p, ROOT), (JSON.stringify(j, null, indent) + '\n').replace(/\n/g, '\r\n'));
const D = read('src/data/specialist/hsr.json');

const byName = new Map(D.characters.map((c) => [c.name, c]));
const answer = (c) => [c.name, ...c.aliases].join('|');
const by = (key, test) => D.characters.filter((c) => (typeof test === 'function' ? test(c[key]) : c[key] === test)).map(answer);
// Names the French dictionary gives another franchise's face (Smash's Robin is Daraen): in French, ours keep their name.
const OWN_FRENCH = new Set(['Robin']);
const card = (n) => {
  const c = byName.get(n);
  if (!c) throw new Error(`no character ${n}`);
  return { label: c.name, ...(c.aliases.length ? { aliases: c.aliases } : {}), ...(OWN_FRENCH.has(n) ? { fr: n } : {}), image: c.image };
};

// The fan favourites (the 2025 popularity vote: Dan Heng • Imbibitor Lunae first, Aventurine second; Kafka, Firefly
// and Acheron, the mythics and the omni; Castorice and Acheron the best-selling banners), best-known first: the first
// two are legendary cards, the next four epic, then rare; the last a common.
const FAVOURITES = ['Dan Heng • Imbibitor Lunae', 'Aventurine', 'Kafka', 'Firefly', 'Acheron', 'Castorice', 'March 7th', 'Dan Heng', 'Silver Wolf', 'Robin', 'Phainon', 'Herta'];
const members = FAVOURITES.map(card);

// Final Blow: the deep cuts — Clara (an epic find), then the four-stars of the first worlds and after.
const DEEP = ['Clara', 'Hook', 'Sampo', 'Qingque', 'Arlan', 'Asta', 'Natasha', 'Pela', 'Serval', 'Sushang', 'Tingyun', 'Yukong', 'Luka', 'Lynx', 'Guinaifen', 'Hanya', 'Xueyi', 'Misha', 'Gallagher', 'Moze'];
const finale = DEEP.map(card);

const bosses = read('src/data/bosses.json');
const gi = bosses.find((b) => b.id === 'genshin');
const impostors = [...gi.radar.members, ...gi.finale].filter((m) => m.image).slice(0, 14).map(({ label, image }) => ({ label, image }));

const PATHS = ['Destruction', 'The Hunt|Hunt', 'Erudition', 'Harmony', 'Nihility', 'Preservation', 'Abundance', 'Remembrance', 'Elation', 'Trailblaze', 'Propagation', 'Enigmata', 'Beauty', 'Permanence', 'Equilibrium', 'Order', 'Gluttony', 'Finality'];
const ELEMENTS = ['Physical', 'Fire', 'Ice', 'Lightning', 'Wind', 'Quantum', 'Imaginary'];
const AEONS = ['Akivili', 'Nanook', 'Lan', 'Nous', 'Xipe', 'IX', 'Qlipoth', 'Yaoshi', 'Fuli', 'Aha', 'Tayzzyronth', 'Oroboros', 'Long', 'Idrila', 'Mythus', 'HooH', 'Ena', 'Terminus'];
const WORLDS = ['Herta Space Station', 'Jarilo-VI', 'Xianzhou Luofu|The Xianzhou Luofu|Luofu', 'Penacony', 'Amphoreus', 'Planarcadia', 'Belobog', 'Glamoth', 'Pteruges-V', 'Sigonia-IV', 'Izumo', 'Punklorde'];
const HUNTERS = ['Kafka', 'Blade', 'Silver Wolf', 'Firefly|Sam', 'Elio', 'Silver Wolf LV.999', 'Mortenax Blade'];

// Signature: a character's own Light Cone (its drawn art) — whose is it? Hints as the clock runs down: Path, Combat
// Type and rarity, where they come from, the Light Cone's name, the first letter.
const signature = {
  label: 'Light Cone',
  prompt: 'Whose Light Cone is this?',
  seconds: 30,
  hints: true,
  clues: D.characters
    .filter((c) => c.lightcone)
    .map((c) => ({
      image: c.lightcone.image,
      hints: [`${c.path} · ${c.element} · ${c.rarity}★`, `From ${c.faction}`, `The Light Cone: “${c.lightcone.name}”`, `Their name starts with “${c.name[0]}”`],
      answer: answer(c),
    })),
};

const boss = {
  id: 'hsr',
  domain: 'games',
  franchise: 'Honkai: Star Rail',
  aliases: ['honkai star rail', 'star rail', 'hsr', 'honkai'],
  images: 'fandom:honkai-star-rail',
  boss: {
    name: 'Nanook',
    title: 'Aeon of Destruction',
    color: '#f59e0b',
    image: 'https://static.wikia.nocookie.net/houkai-star-rail/images/4/4e/Aeon_Nanook.png/revision/latest/scale-to-width-down/500?cb=20230501000013',
  },
  lines: {
    intro: 'Another train between the stars. Every world it reaches, I have already judged — and found wanting.',
    phase2: 'Some of these faces never rode the Express. Point out the true travellers before the Legion takes the rest!',
    phase3: 'You still stand. Then name them all, before Destruction reaches the last station.',
    hit: ['A spark, nothing more.', 'The Legion felt that.', 'Hm. Defiance.'],
    hurt: ['Back to the void!', 'Destroyed, as all things are.', 'Your journey ends here.', 'Ash and starlight.'],
    win: 'So the rails hold, this once. Ride on, Trailblazer… I will be waiting at the end of the line.',
    lose: 'One more world gone dark. The Antimatter Legion marches on.',
    secret: 'One last ride before the stars go out. I name a character, a Path or an Aeon — you name another of the same. No repeats!',
    secretOk: ['Noted.', 'Next stop.', 'The rails hold.'],
    secretLost: 'Nothing? Then this is the last station.',
  },
  blitz: [
    { prompt: 'Name 5 characters', count: 5, answers: D.characters.map(answer) },
    { prompt: 'Name 5 characters of the Destruction', count: 5, answers: by('path', 'Destruction') },
    { prompt: 'Name 5 characters of the Nihility', count: 5, answers: by('path', 'Nihility') },
    { prompt: 'Name 5 characters of the Harmony', count: 5, answers: by('path', 'Harmony') },
    { prompt: 'Name 5 Lightning characters', count: 5, answers: by('element', 'Lightning') },
    { prompt: 'Name 5 Quantum characters', count: 5, answers: by('element', 'Quantum') },
    { prompt: 'Name 5 characters from the Xianzhou', count: 5, answers: by('world', 'Xianzhou Alliance') },
    { prompt: 'Name 5 characters from Amphoreus', count: 5, answers: by('world', 'Amphoreus') },
    { prompt: 'Name 4 characters from Jarilo-VI', count: 4, answers: by('world', 'Jarilo-VI') },
    { prompt: 'Name 4 Stellaron Hunters', count: 4, answers: HUNTERS },
    { prompt: 'Name 4 Aeons', count: 4, answers: AEONS },
    { prompt: 'Name 5 Paths', count: 5, answers: PATHS },
  ],
  radar: { members, impostors },
  finale,
  secret: {
    categories: [
      { label: 'Character', entities: D.characters.map(answer) },
      { label: 'Path', entities: PATHS },
      { label: 'Combat Type', entities: ELEMENTS },
      { label: 'Aeon', entities: AEONS },
    ],
  },
  signature,
  // Light Cones are cards too, but no one names one from its art under the clock: they sit the Final Blow out.
  finaleSkip: D.characters.filter((c) => c.lightcone).map((c) => c.lightcone.name),
};

const at = bosses.findIndex((b) => b.id === boss.id);
if (at >= 0) bosses[at] = boss;
else bosses.push(boss);
write('src/data/bosses.json', bosses, 2);

// The cards beyond the boss's: every other character (the fan favourites epic, the other five-stars rare, the
// four-stars common), then every character's own Light Cone (commons).
const EPIC = new Set(['Blade', 'Jingliu', 'Ruan Mei', 'Black Swan', 'Sparkle', 'Jing Yuan', 'Himeko', 'Welt', 'Bronya', 'Seele', 'Sunday', 'The Herta', 'Cyrene', 'Saber', 'Feixiao', 'Fu Xuan', 'Huohuo', 'Dr. Ratio', 'Boothill', 'Aglaea', 'Tribbie', 'Mydei', 'Anaxa', 'Hyacine', 'Cipher', 'Evernight', 'Topaz & Numby', 'Silver Wolf LV.999']);
const taken = new Set([...FAVOURITES, ...DEEP]);
const roster = [
  ...D.characters.filter((c) => !taken.has(c.name)).map((c) => ({ name: c.name, image: c.image, rarity: EPIC.has(c.name) ? 'epic' : c.rarity >= 5 ? 'rare' : 'common' })),
  ...D.characters.filter((c) => c.lightcone && !byName.has(c.lightcone.name)).map((c) => ({ name: c.lightcone.name, image: c.lightcone.image, rarity: 'common' })),
];
const rosters = read('src/data/card-rosters.json');
rosters.hsr = roster;
write('src/data/card-rosters.json', rosters, 1);
console.log(`boss: ${members.length} radar, ${impostors.length} impostors (${impostors.map((i) => i.label).join(', ')}), ${finale.length} finale, ${signature.clues.length} signature clues; roster: ${roster.length} cards`);
