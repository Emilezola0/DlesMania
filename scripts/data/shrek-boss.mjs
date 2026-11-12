// The Shrek boss (Lord Farquaad, ruler of Duloc) and its card roster: the ogres, the fairy-tale creatures, the royals
// of Far Far Away and the cast of the Puss in Boots films (Puss in Boots, 2011, and The Last Wish, 2022) in their film
// renders, from the Shrek Wiki (shrek.fandom.com's API: categories, infobox pictures, and the infobox's race, gender
// and status for the Specialist; each face's first film from the wiki's film categories). The Radar's impostors are
// The Lord of the Rings' and Harry Potter's faces (already in bosses.json). French names: the French dubs'. Lines
// written for Omnidle.
//   node scripts/data/shrek-boss.mjs
import { readFileSync, writeFileSync } from 'node:fs';

const ROOT = new URL('../../', import.meta.url);
const read = (p) => JSON.parse(readFileSync(new URL(p, ROOT), 'utf8'));
// bosses.json and card-rosters.json keep Windows line ends.
const write = (p, j, indent) => writeFileSync(new URL(p, ROOT), (JSON.stringify(j, null, indent) + '\n').replace(/\n/g, '\r\n'));

const API = 'https://shrek.fandom.com/api.php';
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

/** Follows redirects and normalisation back to the title asked for. */
const backMap = (q) => {
  const back = new Map();
  for (const r of q?.redirects ?? []) back.set(r.to, r.from);
  for (const n of q?.normalized ?? []) back.set(n.to, n.from);
  return (t) => {
    while (back.has(t)) t = back.get(t);
    return t;
  };
};

/** The infobox picture and the wikitext of every page asked for (pictures served 400 px wide). */
async function pages(titles) {
  const pics = new Map();
  const texts = new Map();
  for (let i = 0; i < titles.length; i += 40) {
    const j = await api({ action: 'query', titles: titles.slice(i, i + 40).join('|'), prop: 'pageimages|revisions', piprop: 'original', rvprop: 'content', rvslots: 'main', redirects: '1' });
    const asked = backMap(j.query);
    for (const p of j.query?.pages ?? []) {
      const t = asked(p.title);
      if (p.original?.source) pics.set(t, p.original.source.replace(/\/revision\/latest(\?|$)/, '/revision/latest/scale-to-width-down/400$1'));
      if (p.revisions) texts.set(t, p.revisions[0].slots.main.content);
    }
  }
  return { pics, texts };
}

/** An infobox field, its first line, links, references and templates reduced to their text. */
const field = (text, name) => {
  const m = text?.match(new RegExp(`\\|\\s*${name}\\s*=([^\\n|]*)`, 'i'));
  if (!m) return '';
  return m[1]
    .replace(/<ref[^>]*\/>|<ref.*?<\/ref>/g, '')
    .replace(/\[\[(?:[^\]|]*\|)?([^\]]*)\]\]/g, '$1')
    .replace(/\{\{[^}]*\}\}/g, '')
    .replace(/''+/g, '')
    .split(/<br\s*\/?>/)[0]
    .trim();
};

/** The page each name is on, when it isn't the name itself. */
const PAGE = {
  Shrek: 'Shrek (character)',
  Gingy: 'Gingerbread Man',
  'Big Jack Horner': '"Big" Jack Horner',
  'Three Blind Mice': 'The Three Blind Mice',
  'Robin Hood': 'Monsieur Hood',
  Cookie: 'Cookie the Ogre',
};
const titleOf = (n) => PAGE[n] ?? n;
/** Other names players type: nicknames, full names, and the French dubs' names. */
const ALIASES = {
  Shrek: ['Shrek the Ogre'],
  Donkey: ['L’Âne', "L'Ane", 'Âne', 'Ane'],
  'Puss in Boots': ['Puss', 'Le Chat Potté', 'Chat Potté', 'Le Chat Potte', 'Chat Potte'],
  Fiona: ['Princess Fiona', 'Princesse Fiona'],
  Gingy: ['Gingerbread Man', 'Ti Biscuit', 'Ti-Biscuit', 'Tibiscuit', 'Gingerbread'],
  Dragon: ['Dragonne', 'The Dragon'],
  'Fairy Godmother': ['Godmother', 'La Bonne Fée Marraine', 'Bonne Fée Marraine', 'Marraine la Bonne Fée', 'Marraine'],
  'Prince Charming': ['Charming', 'Prince Charmant', 'Charmant'],
  'Humpty Dumpty': ['Humpty', 'Humpty Alexander Dumpty', 'Humpty Alexandre Dumpty', 'The Egg'],
  'Kitty Softpaws': ['Kitty', 'Kitty Pattes de Velours', 'Kitty Pattes-de-Velours'],
  Death: ['The Wolf', 'Wolf', 'Lobo', 'La Mort', 'Le Loup', 'Grim Reaper'],
  Pinocchio: [],
  Perrito: ['Perro', 'Pero'],
  Goldilocks: ["Boucle d'Or", 'Boucle d’Or', 'Boucles d’Or', "Boucles d'Or"],
  'Big Jack Horner': ['Jack Horner', 'Grand Jack Horner'],
  Rumpelstiltskin: ['Rumple', 'Tracassin', 'Rumplestiltskin'],
  'Three Little Pigs': ['The Three Little Pigs', 'Les Trois Petits Cochons', 'Trois Petits Cochons', 'Pigs'],
  'Big Bad Wolf': ['The Big Bad Wolf', 'Le Grand Méchant Loup', 'Grand Méchant Loup'],
  'Three Blind Mice': ['The Three Blind Mice', 'Les Trois Souris Aveugles', 'Trois Souris Aveugles', 'Blind Mice'],
  'Magic Mirror': ['Mirror', 'Le Miroir Magique', 'Miroir Magique'],
  'King Harold': ['Harold', 'Le Roi Harold', 'Roi Harold'],
  'Queen Lillian': ['Lillian', 'La Reine Lillian', 'Reine Lillian'],
  'Arthur Pendragon': ['Artie', 'Arthur'],
  'Snow White': ['Blanche-Neige', 'Blanche Neige'],
  Cinderella: ['Cendrillon'],
  'Sleeping Beauty': ['La Belle au Bois Dormant', 'Belle au Bois Dormant'],
  Rapunzel: ['Raiponce'],
  'Captain Hook': ['Hook', 'Capitaine Crochet', 'Crochet'],
  'Evil Queen': ['La Méchante Reine', 'Méchante Reine'],
  'Robin Hood': ['Monsieur Hood', 'Robin des Bois'],
  'Headless Horseman': ['Le Cavalier sans tête', 'Cavalier sans tête'],
  'Mama Bear': ['Maman Ours'],
  'Papa Bear': ['Papa Ours'],
  'Baby Bear': ['Bébé Ours', 'Bebe Ours'],
  'Lord Farquaad': ['Farquaad', 'Lord Farquad', 'Farquad'],
};
/** The French dub's name, shown when names are in French. */
const FR = {
  Donkey: 'L’Âne',
  'Puss in Boots': 'Le Chat Potté',
  Gingy: 'Ti Biscuit',
  Dragon: 'Dragonne',
  'Fairy Godmother': 'La Bonne Fée Marraine',
  'Prince Charming': 'Prince Charmant',
  'Kitty Softpaws': 'Kitty Pattes de Velours',
  Death: 'La Mort',
  Goldilocks: 'Boucle d’Or',
  Rumpelstiltskin: 'Tracassin',
  'Three Little Pigs': 'Les Trois Petits Cochons',
  'Big Bad Wolf': 'Le Grand Méchant Loup',
  'Three Blind Mice': 'Les Trois Souris Aveugles',
  'Magic Mirror': 'Le Miroir Magique',
  'King Harold': 'Le Roi Harold',
  'Queen Lillian': 'La Reine Lillian',
  'Snow White': 'Blanche-Neige',
  Cinderella: 'Cendrillon',
  'Sleeping Beauty': 'La Belle au Bois Dormant',
  Rapunzel: 'Raiponce',
  'Captain Hook': 'Capitaine Crochet',
  'Evil Queen': 'La Méchante Reine',
  'Robin Hood': 'Robin des Bois',
  'Headless Horseman': 'Le Cavalier sans tête',
  'Mama Bear': 'Maman Ours',
  'Papa Bear': 'Papa Ours',
  'Baby Bear': 'Bébé Ours',
};
// The fans' favourites, best-known first (polls and rankings of the films' characters: Shrek and Donkey at the top,
// then Puss in Boots, Fiona, Gingy and the Dragon; the Fairy Godmother, Prince Charming, Humpty Dumpty, Kitty and
// Death close behind): the first two legendary, the next four epic, then rare.
const FAVOURITES = ['Shrek', 'Donkey', 'Puss in Boots', 'Fiona', 'Gingy', 'Dragon', 'Fairy Godmother', 'Prince Charming', 'Humpty Dumpty', 'Kitty Softpaws', 'Death', 'Pinocchio'];
// Final Blow: the rest of the cast — Perrito an epic find, Goldilocks, Big Jack Horner and Rumpelstiltskin rare, then everyone else.
const DEEP = [
  'Perrito', 'Goldilocks', 'Big Jack Horner', 'Rumpelstiltskin', 'Three Little Pigs', 'Big Bad Wolf', 'Three Blind Mice', 'Magic Mirror', 'King Harold', 'Queen Lillian',
  'Doris', 'Mongo', 'Arthur Pendragon', 'Merlin', 'Dronkeys', 'Cookie', 'Brogan', 'Gretched', 'Mama Luna', 'Cyclops',
  'Captain Hook', 'Evil Queen', 'Cinderella', 'Snow White', 'Rapunzel', 'Sleeping Beauty', 'Muffin Man', 'Robin Hood', 'Thelonious', 'Headless Horseman',
  'Mabel', 'Lancelot', 'Mama Bear', 'Papa Bear', 'Baby Bear', 'Ethical Bug', 'Imelda', 'Golden Goose',
];
const BOSS = 'Lord Farquaad';

const FILMS = [
  ['Shrek Characters', 'Shrek', 2001],
  ['Shrek 2 Characters', 'Shrek 2', 2004],
  ['Shrek the Third Characters', 'Shrek the Third', 2007],
  ['Shrek Forever After Characters', 'Shrek Forever After', 2010],
  ['Puss in Boots Characters', 'Puss in Boots', 2011],
];
const OGRES = await category('Ogres');
const FAIRY = [...(await category('Fairy Tale Characters')), ...(await category('Nursery Rhyme Characters'))];
const ROYALS = await category('Royalty');
const VILLAINS = [...(await category('Antagonists')), ...(await category('Villains')), ...(await category('Main antagonists')), ...(await category('Shrek 2 Antagonists')), ...(await category('Shrek the Third Antagonists')), ...(await category('Shrek Forever After Antagonists')), ...(await category('Puss in Boots Antagonists'))];
const FILM_CAST = new Map();
for (const [cat] of FILMS) FILM_CAST.set(cat, await category(cat));
const PUSS = FILM_CAST.get('Puss in Boots Characters');
// Read from the categories' member lists (a page's own categories come cut short when many pages are asked at once).
const FEMALE = new Set(await category('Female'));
const MALE = new Set(await category('Male'));
const DECEASED = new Set(await category('Deceased Characters'));

// Groups, places, things and faceless extras aren't characters to collect; nor are the Shrek 5 faces seen only in a teaser.
const GENERIC = /\(|Kingdom|Castle|Guards|Knights|Villagers|Citizens|Peasants|Soldiers|Witches|Army|Family|Band|Crew|^List|Ogres$|Babies|Kids|Children/;
/** Crowds, things and walk-ons the wiki files as characters (and an advert's mascot). */
const NOT_FACES = new Set(['Angry Mobs', 'Bridesmaids', 'Duloc Dolls', 'Duloc Mascot', 'Gnomes', 'Merrymen', 'Rock-a-Bye Baby', 'The Three Good Fairies', 'The Seven Dwarfs', 'The Three Bears', 'Unicorns', 'Wood', 'Wrestling Fan', 'Candelabra', 'Clock', 'Dresser', 'Fighting Trees', 'Furniture', 'Human Swans', 'Maidens', 'Mud Bath Fairies', 'Munchkins', 'Nobleman', "Nobleman's Son", 'Pirates', 'Red Carpet Announcer', 'Forest Animals', 'Frogs', 'Ship Captain', 'Stage Actress', 'The Shrek Mascot', 'Animal Crackers', 'The Ogre Resistance', 'Wagon Witch 1', 'Aflac Duck', "Jack Horner's Parents", 'Poker Dogs', "Puss' Former Lives", 'Serpent Sisters', 'Team Friendship', "The Baker's Dozen", 'The Forty Thieves', 'Pointing wizard', 'Bishop', 'Doctor', 'Governor', 'Throwback', 'Scimitar', 'Magic Carpet', 'Dancing Broom', 'Puss Dos', 'Grandma', 'Witch', 'Wizard', 'Snake', 'Camel', 'Badger', 'Frog', 'Bar Frog', 'Puppy Dog', 'Bluebird', 'The Old Woman']);
const keep = (t) => !GENERIC.test(t) && !NOT_FACES.has(t);
const named = [...FAVOURITES, ...DEEP, BOSS];
const pool = [...new Set([...FILM_CAST.values()].flat())].filter(keep);
const wanted = [...new Set([...named.map(titleOf), ...pool])];
const { pics, texts: wiki } = await pages(wanted);

/** A page with no lead picture: the first file of its infobox's image field. */
async function infoboxPicture(t) {
  const text = wiki.get(t) ?? '';
  const m = text.match(/\|\s*image\s*=\s*(?:<gallery>\s*)?([^|\n<]+\.(?:png|jpe?g|webp|gif))/i);
  if (!m) return '';
  const j = await api({ action: 'query', titles: `File:${m[1].trim()}`, prop: 'imageinfo', iiprop: 'url' });
  const url = j.query?.pages?.[0]?.imageinfo?.[0]?.url ?? '';
  return url.replace(/\/revision\/latest(\?|$)/, '/revision/latest/scale-to-width-down/400$1');
}
for (const n of named) if (!pics.get(titleOf(n))) pics.set(titleOf(n), await infoboxPicture(titleOf(n)));
const imageOf = (n) => pics.get(titleOf(n)) ?? '';

const card = (n) => {
  const image = imageOf(n);
  if (!image) throw new Error(`no picture for ${n} (page ${titleOf(n)})`);
  return { label: n, ...(FR[n] ? { fr: FR[n] } : {}), ...(ALIASES[n]?.length ? { aliases: ALIASES[n] } : {}), image };
};
const members = FAVOURITES.map(card);
const finale = DEEP.map(card);

const bosses = read('src/data/bosses.json');
const face = (id, n) => {
  const b = bosses.find((x) => x.id === id);
  const m = [...b.radar.members, ...b.finale].find((x) => x.label === n);
  return m?.image ? { label: m.label, image: m.image } : null;
};
const impostors = [
  ...['Gollum', 'Gimli', 'Treebeard', 'Gandalf', 'Legolas', 'Samwise Gamgee'].map((n) => face('lotr', n)),
  ...['Dobby', 'Rubeus Hagrid', 'Albus Dumbledore', 'Hedwig', 'Severus Snape', 'Draco Malfoy'].map((n) => face('harrypotter', n)),
].filter(Boolean);
if (impostors.length < 12) console.warn('impostors missing:', 12 - impostors.length);

/** A wiki title as an answer, with the name fans use and its aliases ("Gingy|Gingerbread Man|Ti Biscuit…"). */
const nameOf = (t) => Object.entries(PAGE).find(([, p]) => p === t)?.[0] ?? t;
const answer = (t) => {
  const n = nameOf(t);
  return [...new Set([n, t, ...(FR[n] ? [FR[n]] : []), ...(ALIASES[n] ?? [])])].join('|');
};
// The Name Chain: each name in one category only (an ogre first, then a royal, a fairy-tale or nursery-rhyme face,
// then the Puss in Boots films' own cast).
const used = new Set();
const only = (list) => list.filter(keep).filter((t) => (used.has(t) ? false : (used.add(t), true))).map(answer);
const ogres = only(OGRES);
const royals = only(ROYALS);
const fairy = only(FAIRY);
const villains = only(VILLAINS);
const puss = only(PUSS);

// Signature: who is it, from what they are and do (written for Omnidle from the films).
const CLUES = [
  ['An ogre who wanted his swamp back, and came home with a wife, a talking donkey and a houseful of children', 'Shrek'],
  ['A talking donkey who never stops talking, married a dragon and became a father of flying foals', 'Donkey'],
  ['A cat in a feathered hat and boots, a sword in his paw and enormous eyes that disarm anyone', 'Puss in Boots'],
  ['A princess in a tower guarded by a dragon, human by day and an ogre by night — until true love\'s kiss chose for her', 'Fiona'],
  ['A biscuit who lost his legs to a lord, and still told him where to go: not my gumdrop buttons', 'Gingy'],
  ['She guarded a tower with fire, then fell for the donkey who talked his way past her', 'Dragon'],
  ['She grants wishes in Far Far Away, for a price — and wanted her son to marry the princess', 'Fairy Godmother'],
  ['A prince who arrived too late to rescue the princess, and blamed an ogre for it ever after', 'Prince Charming'],
  ['An egg, an inventor and a thief, who grew up in an orphanage with a cat and dreamed of magic beans', 'Humpty Dumpty'],
  ['A cat thief with paws so soft that no one hears her steal', 'Kitty Softpaws'],
  ['A white wolf in a black cloak, who whistles before he comes for a cat who wasted eight lives', 'Death'],
  ['A puppet whose nose grows when he lies — so he answers questions very, very carefully', 'Pinocchio'],
  ['A little dog dressed as a cat, who only wants to be a therapy dog and sees the good in everyone', 'Perrito'],
  ['She and her three bears run a crime family, after the wish that will give them a home', 'Goldilocks'],
  ['A baker who ate the magic of a whole bag of enchanted things and wanted the rest', 'Big Jack Horner'],
  ['A little man who signs contracts, and once made an ogre trade a day of his life away', 'Rumpelstiltskin'],
  ['The short ruler of Duloc, who wanted a perfect kingdom with no fairy-tale creatures in it, and a princess to make him king', 'Lord Farquaad'],
  ['Fiona\'s father, a king who was a frog before he was a man', 'King Harold'],
  ['A mirror on the wall who shows the princesses Farquaad can marry, like a dating show', 'Magic Mirror'],
  ['A gingerbread giant baked to storm a castle', 'Mongo'],
  ['A teenager at Worcestershire Academy who did not want to be king of Far Far Away', 'Arthur Pendragon'],
  ['Three brothers whose houses were blown down, who now say everything in German', 'Three Little Pigs'],
];
const signature = {
  label: 'Ogres & Fairy Tales',
  prompt: 'Who is this?',
  clues: CLUES.map(([text, name]) => ({ text, answer: [name, ...(FR[name] ? [FR[name]] : []), ...(ALIASES[name] ?? [])].join('|') })),
};

const boss = {
  id: 'shrek',
  domain: 'cinema',
  franchise: 'Shrek',
  aliases: ['shrek', 'shrek the ogre', 'puss in boots', 'le chat potté', 'chat potte', 'far far away'],
  images: 'fandom:shrek',
  boss: { name: BOSS, title: 'Ruler of Duloc', color: '#b91c1c', image: imageOf(BOSS) },
  lines: {
    intro: 'Welcome to Duloc, the most perfect kingdom there is. Prove you know its subjects — and not one word about my height.',
    phase2: 'Fairy-tale trash, the lot of them, and some aren\'t even from my kingdom. Tell me which ones belong.',
    phase3: 'Still standing? Then name them all, before I send my knights.',
    hit: ['Hmph.', 'Lucky.', 'Guards!'],
    hurt: ['Wrong. To the dungeon.', 'Pathetic.', 'Next!', 'Is that the best you can do?'],
    win: 'This is not how my fairy tale was supposed to end… I was going to be king.',
    lose: 'Another peasant out of my perfect kingdom. Next!',
    secret: 'A game for the court: I name an ogre, a royal, a fairy-tale creature or a face from Puss in Boots; you name another of the same kind. No repeats, or it\'s the dungeon.',
    secretOk: ['Very well.', 'Again.', 'Acceptable.'],
    secretLost: 'Nothing left? Then you are banished from Duloc.',
  },
  blitz: [
    { prompt: 'Name the four Shrek films', count: 4, answers: ['Shrek|Shrek 1', 'Shrek 2', 'Shrek the Third|Shrek 3|Shrek le troisième', 'Shrek Forever After|Shrek 4|Shrek 4, il était une fin|Shrek il était une fin'] },
    { prompt: 'Name the four princesses who fight beside Fiona', count: 4, answers: ['Snow White|Blanche-Neige|Blanche Neige', 'Cinderella|Cendrillon', 'Rapunzel|Raiponce', 'Sleeping Beauty|La Belle au Bois Dormant|Belle au Bois Dormant', 'Doris'] },
    { prompt: 'Name the Three Bears of The Last Wish', count: 3, answers: ['Mama Bear|Maman Ours', 'Papa Bear|Papa Ours', 'Baby Bear|Bébé Ours|Bebe Ours'] },
    { prompt: 'Name Shrek and Fiona\'s three children', count: 3, answers: ['Farkle', 'Fergus', 'Felicia'] },
    { prompt: 'Name 5 ogres', count: 5, answers: OGRES.filter(keep).map(answer) },
    { prompt: 'Name 5 fairy-tale or nursery-rhyme characters of the films', count: 5, answers: FAIRY.filter(keep).map(answer) },
    { prompt: 'Name 5 villains of the films', count: 5, answers: [...new Set(VILLAINS)].filter(keep).map(answer) },
  ],
  radar: { members, impostors },
  finale,
  secret: {
    categories: [
      { label: 'Ogre', entities: ogres },
      { label: 'Royal', entities: royals },
      { label: 'Fairy-tale or nursery-rhyme character', entities: fairy },
      { label: 'Villain', entities: villains },
      { label: 'Face of the Puss in Boots films', entities: puss },
    ],
  },
  signature,
};

const at = bosses.findIndex((b) => b.id === boss.id);
if (at >= 0) bosses[at] = boss;
else bosses.push(boss);
write('src/data/bosses.json', bosses, 2);

// The cards beyond the boss's: everyone else the wiki files under the films, each with their picture. The best-known
// of them rare, the rest common.
const RARE = new Set(['Farkle', 'Fergus', 'Felicia', 'Puss in Boots Clones', 'Sugar Plum Fairy', 'Fifi', 'Dwarfs', 'Pied Piper', 'Little Red Riding Hood', 'Mother Goose', 'Jack Sprat', 'Little Boy Blue', 'Andy Beanstalk', 'Cheesy', 'Grimm', 'Peter Pan', 'Tinker Bell', 'Frog King']);
const takenPages = new Set(named.map(titleOf));
const roster = [];
const pictured = new Set([imageOf(BOSS), ...members.map((m) => m.image), ...finale.map((m) => m.image)]);
for (const t of pool) {
  if (takenPages.has(t)) continue;
  const image = pics.get(t);
  if (!image || pictured.has(image)) continue;
  if (roster.some((r) => r.name === t)) continue;
  pictured.add(image);
  roster.push({ name: t, image, rarity: RARE.has(t) ? 'rare' : 'common' });
}
const rosters = read('src/data/card-rosters.json');
rosters.shrek = roster;
write('src/data/card-rosters.json', rosters, 1);

// The Specialist's traits, from each face's infobox and categories: what they are, gender, whether they are still
// alive, and the year of the first film they appear in.
const SPECIES = [
  [/ogre/i, 'Ogre'],
  [/donkey|dronkey/i, 'Donkey'],
  [/dragon/i, 'Dragon'],
  [/cat\b|feline/i, 'Cat'],
  [/dog|chihuahua/i, 'Dog'],
  [/wolf/i, 'Wolf'],
  [/bear/i, 'Bear'],
  [/pig/i, 'Pig'],
  [/mouse|mice/i, 'Mouse'],
  [/gingerbread|cookie/i, 'Gingerbread'],
  [/egg/i, 'Egg'],
  [/puppet|wood/i, 'Puppet'],
  [/fairy/i, 'Fairy'],
  [/frog/i, 'Frog'],
  [/mirror/i, 'Mirror'],
  [/human|dwarf|princess|witch/i, 'Human'],
];
/** What the infobox's race can't say on its own: half-and-half faces and the wiki's gaps. */
const SPECIES_OF = { Fiona: 'Ogre', Mongo: 'Gingerbread', 'Magic Mirror': 'Mirror', Thelonious: 'Human', 'Golden Goose': 'Goose', 'Ethical Bug': 'Insect', 'Headless Horseman': 'Human', Cyclops: 'Cyclops', Death: 'Wolf', 'King Harold': 'Human', 'Big Jack Horner': 'Human', Goldilocks: 'Human', 'Mama Luna': 'Human', Imelda: 'Human', 'Three Blind Mice': 'Mouse', Dronkeys: 'Dronkey', Merlin: 'Human', 'Prince Charming': 'Human', 'Arthur Pendragon': 'Human' };
const speciesOf = (n, text) => {
  if (SPECIES_OF[n]) return SPECIES_OF[n];
  const race = field(text, 'race') || field(text, 'species');
  for (const [re, s] of SPECIES) if (re.test(race) || re.test(n)) return s;
  return 'Other';
};
/** The first film: the wiki's film categories, The Last Wish's cast picked out of Puss in Boots'. */
const LAST_WISH = new Set(['Death', 'Perrito', 'Goldilocks', 'Big Jack Horner', 'Mama Bear', 'Papa Bear', 'Baby Bear', 'Mama Luna', 'Ethical Bug']);
const DEBUT = { 'Fairy Godmother': 2004, 'Prince Charming': 2004, 'Puss in Boots': 2004, Mongo: 2004, 'King Harold': 2004, 'Queen Lillian': 2004, Doris: 2004, Dronkeys: 2004 };
const debutOf = (n) => {
  if (LAST_WISH.has(n)) return 2022;
  if (DEBUT[n]) return DEBUT[n];
  for (const [cat, , year] of FILMS) if (FILM_CAST.get(cat).includes(titleOf(n))) return year;
  return 0;
};
const GENDER = { 'Three Little Pigs': 'Male', 'Three Blind Mice': 'Male', Dronkeys: 'Mixed', Dragon: 'Female', 'Golden Goose': 'Female', Death: 'Male' };
const STATUS = { Death: 'Immortal', 'Big Jack Horner': 'Deceased', 'Humpty Dumpty': 'Deceased', 'Lord Farquaad': 'Deceased' };
const characters = [...FAVOURITES, ...DEEP, BOSS].map((n) => {
  const t = titleOf(n);
  const text = wiki.get(t);
  const status = STATUS[n] ?? (/deceased/i.test(field(text, 'status')) || DECEASED.has(t) ? 'Deceased' : 'Alive');
  const gender = GENDER[n] ?? (/^female/i.test(field(text, 'gender')) || (FEMALE.has(t) && !MALE.has(t)) ? 'Female' : /^male/i.test(field(text, 'gender')) || MALE.has(t) ? 'Male' : 'Unknown');
  return { name: n, species: speciesOf(n, text), gender, status, debut: debutOf(n) };
});
writeFileSync(new URL('src/data/specialist/shrek.json', ROOT), JSON.stringify({ source: 'Shrek Wiki (shrek.fandom.com)', characters }, null, 1) + '\n');
for (const c of characters) if (!c.debut || c.gender === 'Unknown' || c.species === 'Other') console.warn('check traits:', JSON.stringify(c));
console.log(`boss: ${members.length} radar, ${impostors.length} impostors, ${finale.length} finale, ${signature.clues.length} clues, ${ogres.length} ogres, ${royals.length} royals, ${fairy.length} fairy, ${villains.length} villains, ${puss.length} puss; roster: ${roster.length} cards; specialist: ${characters.length}`);
