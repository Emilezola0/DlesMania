// The Baldur's Gate 3 boss (the Netherbrain, the Absolute) and its card roster, from bg3.wiki's API. Boss Battle and
// the cards show drawn art only (the game itself is 3D): Larian's painted portraits of the companions and villains
// (Edward Vanderghote's, the ones bg3.wiki's infoboxes call "portrait"), the studio's concept paintings and sketches,
// the Collector's Edition stickers, and the painted item art for the legendary and very rare items. The Radar's
// impostors are World of Warcraft's faces (already in bosses.json). Lines written for Omnidle.
//   node scripts/data/bg3-boss.mjs
import { readFileSync, writeFileSync } from 'node:fs';

const ROOT = new URL('../../', import.meta.url);
const read = (p) => JSON.parse(readFileSync(new URL(p, ROOT), 'utf8'));
// bosses.json and card-rosters.json keep Windows line ends.
const write = (p, j, indent) => writeFileSync(new URL(p, ROOT), (JSON.stringify(j, null, indent) + '\n').replace(/\n/g, '\r\n'));

const API = 'https://bg3.wiki/w/api.php';
const api = async (p) => (await fetch(`${API}?${new URLSearchParams({ format: 'json', formatversion: '2', ...p })}`, { headers: { 'User-Agent': 'OmnidleData/1.0' } })).json();

/** Every article of a category. */
async function category(cat) {
  const out = [];
  let cont = {};
  do {
    const j = await api({ action: 'query', list: 'categorymembers', cmtitle: `Category:${cat}`, cmlimit: '500', cmnamespace: '0', ...cont });
    out.push(...(j.query?.categorymembers ?? []).map((m) => m.title));
    cont = j.continue ?? null;
  } while (cont && Object.keys(cont).length);
  return out;
}
const backMap = (q) => {
  const back = new Map();
  for (const r of q?.redirects ?? []) back.set(r.to, r.from);
  for (const n of q?.normalized ?? []) back.set(n.to, n.from);
  return (t) => {
    while (back.has(t)) t = back.get(t);
    return t;
  };
};
/** Of these files, the address of each, 600 px wide at most. */
async function files(names) {
  const out = new Map();
  for (let i = 0; i < names.length; i += 50) {
    const j = await api({ action: 'query', titles: names.slice(i, i + 50).map((f) => `File:${f}`).join('|'), prop: 'imageinfo', iiprop: 'url|size', iiurlwidth: '600', redirects: '1' });
    const asked = backMap(j.query);
    for (const p of j.query?.pages ?? []) {
      const ii = p.imageinfo?.[0];
      if (ii) out.set(asked(p.title).replace(/^File:/, ''), ii.width > 600 && ii.thumburl ? ii.thumburl : ii.url);
    }
  }
  return out;
}
/** The main picture of every page asked for (an item's: its painted art, "Unfaded"). */
async function pageImages(titles) {
  const out = new Map();
  for (let i = 0; i < titles.length; i += 50) {
    const j = await api({ action: 'query', titles: titles.slice(i, i + 50).join('|'), prop: 'pageimages', piprop: 'original', redirects: '1' });
    const asked = backMap(j.query);
    for (const p of j.query?.pages ?? []) if (p.original?.source) out.set(asked(p.title), p.original.source);
  }
  return out;
}

// Every face and the drawn picture it is shown with (bg3.wiki file names).
const ART = {
  'The Netherbrain': 'Elder Brain Concept Art.png',
  Astarion: 'Edward-vanderghote-astarion-portrait.png',
  Shadowheart: 'Edward-vanderghote-shadowheart-portrait.png',
  Karlach: 'Edward-vanderghote-karlach-portrait.png',
  "Lae'zel": 'Edward-vanderghote-laezel-portrait.png',
  Gale: 'Edward-vanderghote-gale-portrait.png',
  Wyll: 'Edward-vanderghote-wyll-portrait.png',
  Halsin: 'Edward-vanderghote-halsin-portrait.png',
  Minthara: 'Edward-vanderghote-minthara-portrait.png',
  Jaheira: 'Edward-vanderghote-jaheira-portrait.png',
  Minsc: 'Edward-vanderghote-minsc-portrait.png',
  'The Dark Urge': 'Dark-Urge-promotion-art.png',
  Withers: 'Withers Jergal Concept.png',
  Raphael: 'Jane-katsubo-paintings-raphael-portrait.jpg',
  'Enver Gortash': 'Edward-vanderghote-gortash.webp',
  Orin: 'Edward-vanderghote-orin.webp',
  'Ketheric Thorm': 'Edward-vanderghote-ketheric.webp',
  Cazador: 'Edward-vanderghote-cazador.webp',
  'The Emperor': 'Edward-vanderghote-emperor.webp',
  Elminster: 'Edward-vanderghote-elminster.webp',
  Sarevok: 'Edward-vanderghote-sarevok.webp',
  Viconia: 'Edward-vanderghote-viconia.webp',
  Ansur: 'Edward-vanderghote-ansur.webp',
  Volo: 'Sticker_Emoji_Volo_Hmm.webp',
  Myrkul: 'Myrkul-alex-boca-10.jpg',
  Vlaakith: 'Vlaakith Concept Art.png',
  Balthazar: 'Balthazar Face Concept Art.jpg',
  'Priestess Gut': 'Konstantin-porubov-priestess-gut.jpg',
  Us: 'Sticker_CE_Sticker_Us.webp',
  'Owlbear Cub': 'Sticker_CE_Sticker_Owl_Bear.webp',
  Boo: 'Sticker_CE_Sticker_Boo.webp',
  'Dribbles the Clown': 'Sticker_Emoji_Dribbles_Clown.webp',
  'Steel Watcher': 'Sticker_CE_Sticker_Steel_Watcher.webp',
};
/** Other names players type. */
const ALIASES = {
  'The Netherbrain': ['Netherbrain', 'The Absolute', 'Absolute', 'Elder Brain', 'The Elder Brain'],
  "Lae'zel": ['Laezel', 'Lae zel'],
  Gale: ['Gale of Waterdeep', 'Gale Dekarios'],
  Wyll: ['Wyll Ravengard', 'The Blade of Frontiers', 'Blade of Frontiers'],
  Karlach: ['Karlach Cliffgate'],
  'The Dark Urge': ['Dark Urge', 'Durge'],
  Withers: ['Jergal'],
  'Enver Gortash': ['Gortash', 'Lord Gortash'],
  Orin: ['Orin the Red'],
  'Ketheric Thorm': ['Ketheric', 'General Thorm'],
  Cazador: ['Cazador Szarr'],
  'The Emperor': ['Emperor', 'Balduran'],
  Elminster: ['Elminster Aumar'],
  Sarevok: ['Sarevok Anchev'],
  Viconia: ['Viconia DeVir'],
  Volo: ['Volothamp Geddarm', 'Volothamp'],
  Vlaakith: ['Vlaakith the Lich Queen', 'Lich Queen'],
  'Priestess Gut': ['Gut', 'True Soul Gut'],
  Us: ['The intellect devourer'],
  'Owlbear Cub': ['Owlbear'],
  Boo: ['Miniature giant space hamster'],
  'Dribbles the Clown': ['Dribbles'],
};
// The fans' favourites, best-known first (the companion polls and the most romanced: Astarion and Shadowheart, then
// Karlach, Lae'zel, Gale and Wyll; the Act Two and Three companions; the Dark Urge; Withers, the camp's skeleton): the
// first two legendary, the next four epic, then rare.
const FAVOURITES = ['Astarion', 'Shadowheart', 'Karlach', "Lae'zel", 'Gale', 'Wyll', 'Halsin', 'Minthara', 'Jaheira', 'Minsc', 'The Dark Urge', 'Withers'];
// Final Blow: the villains and the faces met along the way — Raphael an epic find, the Chosen of the Dead Three rare.
const DEEP = ['Raphael', 'Enver Gortash', 'Orin', 'Ketheric Thorm', 'Cazador', 'The Emperor', 'Elminster', 'Sarevok', 'Viconia', 'Volo', 'Ansur', 'Myrkul', 'Vlaakith', 'Balthazar', 'Priestess Gut', 'Us', 'Owlbear Cub', 'Boo', 'Dribbles the Clown', 'Steel Watcher'];

const art = await files(Object.values(ART));
const imageOf = (n) => art.get(ART[n]) ?? '';
const card = (n) => {
  const image = imageOf(n);
  if (!image) throw new Error(`no picture for ${n} (${ART[n]})`);
  return { label: n, ...(ALIASES[n]?.length ? { aliases: ALIASES[n] } : {}), image };
};
const members = FAVOURITES.map(card);
const finale = DEEP.map(card);

const bosses = read('src/data/bosses.json');
const wow = bosses.find((b) => b.id === 'wow');
const IMPOSTORS = ['Illidan Stormrage', 'Tyrande Whisperwind', 'Uther the Lightbringer', 'Medivh', 'Thrall', 'Sylvanas Windrunner', 'Jaina Proudmoore', 'Varian Wrynn', 'Garrosh Hellscream', 'Valeera Sanguinar', 'Antonidas', 'Kel\'Thuzad'];
const impostors = IMPOSTORS.map((n) => [...wow.radar.members, ...wow.finale].find((m) => m.label === n)).filter((m) => m?.image).map(({ label, image }) => ({ label, image }));

const BOSSES_ = (await category('Bosses')).filter((t) => t !== 'List of Bosses');
const LEGENDARY = await category('Legendary items');
const VERY_RARE = await category('Very rare items');
const LOCATIONS = (await category('Locations')).filter((t) => !/Puzzle|^Forest$|^Campsite$|^Faerûn$|\(/.test(t));
const CLASSES = await category('Classes');
const RACES = ['Human', 'Elf', 'Drow', 'Half-Elf', 'Half-Orc', 'Halfling', 'Dwarf', 'Gnome', 'Tiefling', 'Githyanki', 'Dragonborn'];
const CANTRIPS = (await category('Cantrips')).filter((t) => !/[:(?]|Activate|Dismiss|Hurl|Strengthened|Improved|Conjure Us|Selûne's Dream/.test(t));
const COMPANIONS = ['Astarion', 'Shadowheart', 'Karlach', "Lae'zel|Laezel", 'Gale|Gale of Waterdeep', 'Wyll|Wyll Ravengard', 'Halsin', 'Minthara', 'Jaheira', 'Minsc'];
/** A boss's page title as players say it (Cazador Szarr → Cazador too). */
const bossAnswer = (t) => {
  const short = Object.entries(ALIASES).find(([, a]) => a.includes(t))?.[0];
  return short ? `${t}|${short}` : t;
};

// Signature: who is it, from what they are and do (written for Omnidle from the game).
const CLUES = [
  ['A vampire spawn who has served his master for two hundred years, and smiles a little too much', 'Astarion'],
  ['A cleric of Shar with a secret artefact and no memory of her past', 'Shadowheart'],
  ['A tiefling with an infernal engine for a heart, who escaped Zariel\'s army in Avernus', 'Karlach'],
  ['A githyanki warrior who answers to her queen, and has no patience for weakness', "Lae'zel"],
  ['A wizard of Waterdeep with a Netherese orb in his chest, and a cat who is not quite a cat', 'Gale'],
  ['The Blade of Frontiers, with a horn on his head and a pact with a devil', 'Wyll'],
  ['An archdruid who spent much of the last centuries as a bear', 'Halsin'],
  ['A drow paladin of the Absolute who leads the raid on the grove', 'Minthara'],
  ['A Harper, a druid, and a very old friend from Baldur\'s Gates past', 'Jaheira'],
  ['A ranger who swears by his hamster, and the hamster is a miniature giant space one', 'Minsc'],
  ['A bloodthirsty origin with no memory and a butler who never leaves his side', 'The Dark Urge'],
  ['A skeleton in a robe who shows up at camp and raises the fallen for a few gold', 'Withers'],
  ['A cambion in a fine suit who offers deals, and always keeps a contract handy', 'Raphael'],
  ['The Chosen of Bane, a former slave of Raphael, who rules Baldur\'s Gate from Wyrm\'s Rock', 'Enver Gortash'],
  ['The Chosen of Bhaal, a shapeshifter who wears other people\'s faces', 'Orin'],
  ['The Chosen of Myrkul, who rules Moonrise Towers and cannot die', 'Ketheric Thorm'],
  ['A vampire lord of the Upper City who wants seven thousand souls for his ritual', 'Cazador'],
  ['A mind flayer who once was a famous adventurer, and helps from inside the prism', 'The Emperor'],
  ['The Chosen of Mystra, an old wizard who pays a visit to the camp', 'Elminster'],
  ['A Bhaalspawn in a horned helmet, raised from death to serve the Murder Lord', 'Sarevok'],
  ['A drow priestess of Shar who raised Shadowheart in the House of Night', 'Viconia'],
  ['A famous travelling author who lays down his eye for a book', 'Volo'],
  ['The lich-queen of the githyanki, who rules from the Astral Plane', 'Vlaakith'],
  ['A necromancer who serves Ketheric Thorm in the Shadow-Cursed Lands', 'Balthazar'],
  ['A goblin priestess of the Absolute who offers to remove your tadpole', 'Priestess Gut'],
];
const answer = (n) => [n, ...(ALIASES[n] ?? [])].join('|');
const signature = { label: 'The Sword Coast', prompt: 'Who is this?', clues: CLUES.map(([text, name]) => ({ text, answer: answer(name) })) };

const legendary = LEGENDARY;
const boss = {
  id: 'bg3',
  domain: 'games',
  franchise: "Baldur's Gate 3",
  aliases: ["baldur's gate 3", 'baldurs gate 3', 'baldur gate 3', 'bg3', "baldur's gate", 'larian'],
  images: 'bg3.wiki',
  boss: { name: 'The Netherbrain', title: 'The Absolute', color: '#7c3aed', image: imageOf('The Netherbrain') },
  lines: {
    intro: 'We are the Absolute. The tadpole in your head has been listening to us all along — kneel, and become one with us.',
    phase2: 'Not all these minds belong to the Sword Coast. Find the true ones before we take them all.',
    phase3: 'Still you resist? Then name them all — every mind we will swallow when the city falls.',
    hit: ['Insolent…', 'Your will is… strong.', 'We felt that.'],
    hurt: ['Submit.', 'Your mind is ours.', 'Ceremorphosis begins.', 'Kneel!'],
    win: 'Impossible… We were the Absolute… The city… was ours…',
    lose: 'Another mind joins the hive. Baldur\'s Gate is ours.',
    secret: 'One last test, little mind. We name a class, a race, a legendary item, a cantrip or a place — you name another of the same. No repeats.',
    secretOk: ['Hm.', 'Again.', 'We see.'],
    secretLost: 'Nothing left? Then your mind is ours.',
  },
  blitz: [
    { prompt: 'Name 5 companions', count: 5, answers: COMPANIONS },
    { prompt: 'Name the 3 Chosen of the Dead Three', count: 3, answers: ['Enver Gortash|Gortash', 'Ketheric Thorm|Ketheric', 'Orin|Orin the Red'] },
    { prompt: 'Name the Dead Three', count: 3, answers: ['Bhaal', 'Bane', 'Myrkul'] },
    { prompt: 'Name 5 classes', count: 5, answers: CLASSES },
    { prompt: 'Name 5 playable races', count: 5, answers: RACES },
    { prompt: 'Name 5 bosses', count: 5, answers: BOSSES_.map(bossAnswer) },
    { prompt: 'Name 5 legendary items', count: 5, answers: legendary },
  ],
  radar: { members, impostors },
  finale,
  secret: {
    categories: [
      { label: 'Class', entities: CLASSES },
      { label: 'Playable race', entities: RACES },
      { label: 'Legendary item', entities: legendary },
      { label: 'Cantrip', entities: CANTRIPS },
      { label: 'Place', entities: LOCATIONS.filter((l) => !CLASSES.includes(l) && !RACES.includes(l) && !legendary.includes(l) && !CANTRIPS.includes(l)) },
    ],
  },
  signature,
};

const at = bosses.findIndex((b) => b.id === boss.id);
if (at >= 0) bosses[at] = boss;
else bosses.push(boss);
write('src/data/bosses.json', bosses, 2);

// The cards beyond the boss's: the legendary items (rare) and the very rare ones (common), each in its painted art —
// no dyes, arrows, potions, bombs or papers.
const itemArt = await pageImages([...LEGENDARY, ...VERY_RARE]);
const roster = [];
const pictured = new Set();
for (const [list, rarity] of [[LEGENDARY, 'rare'], [VERY_RARE, 'common']]) {
  for (const n of list) {
    if (/Dye$|^Arrow of|\(|^Scroll|^Potion|Elixir|Toxin|Runepowder|Visa$|^Lush Burgundy$|^Sinful Red/.test(n) || roster.some((r) => r.name === n)) continue;
    const image = itemArt.get(n);
    if (!image || !/Unfaded/.test(image) || pictured.has(image)) continue;
    pictured.add(image);
    roster.push({ name: n, image, rarity });
  }
}
const rosters = read('src/data/card-rosters.json');
rosters.bg3 = roster;
write('src/data/card-rosters.json', rosters, 1);
console.log(`boss: ${members.length} radar, ${impostors.length} impostors, ${finale.length} finale, ${signature.clues.length} clues, ${BOSSES_.length} bosses, ${LOCATIONS.length} places, ${CANTRIPS.length} cantrips; roster: ${roster.length} items (${roster.filter((r) => r.rarity === 'rare').length} legendary)`);
