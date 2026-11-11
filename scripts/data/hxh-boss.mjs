// The Hunter x Hunter boss (Meruem, the King of the Chimera Ants) and its card roster: the Hunters, the Phantom
// Troupe, the Zoldycks, the Chimera Ants, the Zodiacs and the Kakin princes in their anime and manga art, from the
// Hunterpedia (hunterxhunter.fandom.com's API: categories, infobox pictures, and the infobox's gender, Nen type, status
// and manga debut for the Specialist). The Radar's impostors are My Hero Academia's and Naruto's faces (already in
// bosses.json). Lines written for Omnidle.
//   node scripts/data/hxh-boss.mjs
import { readFileSync, writeFileSync } from 'node:fs';

const ROOT = new URL('../../', import.meta.url);
const read = (p) => JSON.parse(readFileSync(new URL(p, ROOT), 'utf8'));
// bosses.json and card-rosters.json keep Windows line ends.
const write = (p, j, indent) => writeFileSync(new URL(p, ROOT), (JSON.stringify(j, null, indent) + '\n').replace(/\n/g, '\r\n'));

const API = 'https://hunterxhunter.fandom.com/api.php';
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
      if (p.original?.source) pics.set(asked(p.title), p.original.source.replace(/\/revision\/latest(\?|$)/, '/revision/latest/scale-to-width-down/400$1'));
      if (p.revisions) texts.set(asked(p.title), p.revisions[0].slots.main.content);
    }
  }
  return { pics, texts };
}

/** An infobox field, its first line, links, references and templates reduced to their text. */
const field = (text, name) => {
  const m = text?.match(new RegExp(`\\|\\s*${name}\\s*=([^\\n]*)`));
  if (!m) return '';
  return m[1]
    .replace(/<ref[^>]*\/>|<ref.*?<\/ref>/g, '')
    .replace(/\{\{(?:dtb|mnls)\|\|[^|}]*\|([^}]*)\}\}/g, '$1')
    .replace(/\[\[(?:[^\]|]*\|)?([^\]]*)\]\]/g, '$1')
    .replace(/\{\{[^}]*\}\}/g, '')
    .split(/<br\s*\/?>/)[0]
    .trim();
};

/** The page each name is on, when it isn't the name itself. */
const PAGE = {
  Hisoka: 'Hisoka Morow',
  Franklin: 'Franklin Bordeau',
  Senritsu: 'Melody',
  Netero: 'Isaac Netero',
  Neferpitou: 'Neferpitou',
};
const titleOf = (n) => PAGE[n] ?? n;
/** Other names players type: first names, nicknames, the spellings fans use. */
const ALIASES = {
  'Killua Zoldyck': ['Killua', 'Kirua'],
  'Gon Freecss': ['Gon', 'Gon Freaks'],
  Kurapika: ['Kurapica'],
  Hisoka: ['Hisoka Morow', 'Hisoka Morou'],
  'Chrollo Lucilfer': ['Chrollo', 'Kuroro', 'Kuroro Lucifer', 'Chrollo Lucifer'],
  'Leorio Paradinight': ['Leorio'],
  'Illumi Zoldyck': ['Illumi', 'Irumi'],
  Netero: ['Isaac Netero', 'Chairman Netero'],
  'Feitan Portor': ['Feitan', 'Feitan Pootaa'],
  Neferpitou: ['Pitou', 'Neferpito'],
  'Ging Freecss': ['Ging', 'Jin Freecss'],
  Komugi: [],
  'Biscuit Krueger': ['Bisky', 'Biscuit', 'Bisuke'],
  Kite: ['Kaito'],
  'Knuckle Bine': ['Knuckle', 'Knov'],
  'Zeno Zoldyck': ['Zeno'],
  'Silva Zoldyck': ['Silva', 'Silver Zoldyck'],
  'Alluka Zoldyck': ['Alluka', 'Arukka'],
  Shaiapouf: ['Pouf', 'Shaiapuf'],
  Menthuthuyoupi: ['Youpi', 'Yupi'],
  'Machi Komacine': ['Machi'],
  'Nobunaga Hazama': ['Nobunaga'],
  'Phinks Magcub': ['Phinks', 'Finks'],
  Uvogin: ['Uvo', 'Ubogin'],
  Shalnark: ['Shal', 'Sharnalk'],
  Pakunoda: ['Paku'],
  'Shizuku Murasaki': ['Shizuku'],
  Franklin: ['Franklin Bordeau', 'Franklin Bordeaux'],
  'Kalluto Zoldyck': ['Kalluto', 'Karuto'],
  'Milluki Zoldyck': ['Milluki', 'Miruki'],
  'Kikyo Zoldyck': ['Kikyo'],
  'Shoot McMahon': ['Shoot'],
  'Morel Mackernasey': ['Morel', 'Morau'],
  'Palm Siberia': ['Palm'],
  'Pariston Hill': ['Pariston'],
  'Cheadle Yorkshire': ['Cheadle'],
  'Mizaistom Nana': ['Mizaistom'],
  Senritsu: ['Melody'],
  'Neon Nostrade': ['Neon'],
  'Beyond Netero': ['Beyond'],
  'Tserriednich Hui Guo Rou': ['Tserriednich', 'Tserriednich Hoi-Gwor-Roux'],
  Meruem: ['The King', 'King Meruem', 'Merueme'],
};
// The fans' favourites, best-known first (the series' popularity polls and fan rankings: Killua and Gon at the top,
// then Kurapika, Hisoka, Chrollo and Leorio; Illumi, Netero, Feitan and Neferpitou close behind): the first two
// legendary, the next four epic, then rare.
const FAVOURITES = ['Killua Zoldyck', 'Gon Freecss', 'Kurapika', 'Hisoka', 'Chrollo Lucilfer', 'Leorio Paradinight', 'Illumi Zoldyck', 'Netero', 'Feitan Portor', 'Neferpitou', 'Ging Freecss', 'Komugi'];
// Final Blow: the rest of the cast — Biscuit an epic find, Kite, Knuckle and Zeno rare, then everyone else.
const DEEP = [
  'Biscuit Krueger', 'Kite', 'Knuckle Bine', 'Zeno Zoldyck', 'Silva Zoldyck', 'Alluka Zoldyck', 'Shaiapouf', 'Menthuthuyoupi', 'Machi Komacine', 'Nobunaga Hazama',
  'Phinks Magcub', 'Uvogin', 'Shalnark', 'Pakunoda', 'Shizuku Murasaki', 'Franklin', 'Kalluto Zoldyck', 'Milluki Zoldyck', 'Kikyo Zoldyck', 'Shoot McMahon',
  'Morel Mackernasey', 'Ikalgo', 'Meleoron', 'Palm Siberia', 'Pariston Hill', 'Cheadle Yorkshire', 'Mizaistom Nana', 'Senritsu', 'Wing', 'Zushi', 'Neon Nostrade',
  'Tonpa', 'Satotz', 'Menchi', 'Razor', 'Genthru', 'Gotoh', 'Canary', 'Beyond Netero', 'Tserriednich Hui Guo Rou', 'Hanzo', 'Pokkle',
];

const TROUPE = await category('Phantom Troupe');
const ZOLDYCKS = await category('Zoldyck Family');
const ANTS = await category('Chimera Ants');
const ZODIACS = await category('Zodiac Twelve');
const KAKIN = await category('Kakin Royal Family');
const EXAMINEES = await category('Examinee');
const EXAMINERS = await category('Examiner');
const GREED = await category('Greed Island Players');
const ARENA = await category('Heavens Arena fighters');
const NOSTRADE = await category('Nostrade Family');
const ANTAGONISTS = await category('Antagonists');
const HUNTERS = [...(await category('Single Star Hunters')), ...(await category('Double Star Hunters')), ...(await category('Unclassified Hunters')), ...(await category('Extermination Team')), ...(await category("Beyond's Expedition Team"))];
const UNNAMED = new Set(await category('Unnamed Characters'));
const GROUPS = new Set(await category('Group'));

// Groups, places and faceless extras (an unnamed ant, a family, a squad, a video-game character) aren't characters to collect.
const GENERIC = /Family$|Troupe$|Alliance$|Squad$|Brothers$|Siblings$|Guards$|Leaders$|Egg$|Queen$|^Zodiacs$|^Greed Island$|Association$|Beast$|First King|\(/;
const keep = (t) => !GENERIC.test(t) && !UNNAMED.has(t) && !GROUPS.has(t);
const pool = [...new Set([...TROUPE, ...ZOLDYCKS, ...ANTS, ...ZODIACS, ...KAKIN, ...EXAMINEES, ...EXAMINERS, ...HUNTERS, ...NOSTRADE, ...ARENA, ...ANTAGONISTS, ...GREED])].filter(keep);
const named = [...FAVOURITES, ...DEEP, 'Meruem'];
const wanted = [...new Set([...named.map(titleOf), ...pool])];
const { pics, texts: wiki } = await pages(wanted);
const imageOf = (n) => pics.get(titleOf(n)) ?? '';

const card = (n) => {
  const image = imageOf(n);
  if (!image) throw new Error(`no picture for ${n} (page ${titleOf(n)})`);
  return { label: n, ...(ALIASES[n]?.length ? { aliases: ALIASES[n] } : {}), image };
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
  ...['Izuku Midoriya', 'Katsuki Bakugo', 'Shoto Todoroki', 'Dabi', 'Himiko Toga', 'Tomura Shigaraki'].map((n) => face('mha', n)),
  ...['Naruto Uzumaki', 'Sasuke Uchiha', 'Kakashi Hatake', 'Itachi Uchiha', 'Gaara', 'Rock Lee'].map((n) => face('naruto', n)),
].filter(Boolean);
if (impostors.length < 12) console.warn('impostors missing:', 12 - impostors.length);

/** A wiki title as an answer, with the name fans use and its aliases ("Hisoka|Hisoka Morow|…"). */
const nameOf = (t) => Object.entries(PAGE).find(([, p]) => p === t)?.[0] ?? t;
const answer = (t) => {
  const n = nameOf(t);
  return [...new Set([n, t, ...(ALIASES[n] ?? [])])].join('|');
};
// The Name Chain: each name in one category only (Illumi and Kalluto are Zoldycks first, Kurapika and Leorio Zodiacs
// rather than examinees; the Ants' animal soldiers have no name).
const used = new Set();
const only = (list) => list.filter(keep).filter((t) => (used.has(t) ? false : (used.add(t), true))).map(answer);
const zoldycks = only(ZOLDYCKS);
const troupe = only(TROUPE);
const ants = only(ANTS);
const zodiacs = only(ZODIACS);
const princes = only(KAKIN);

// Signature: who is it, from what they are and do (written for Omnidle from the series).
const CLUES = [
  ['The heir of a family of assassins, who ran away from home to become a Hunter with his best friend', 'Killua Zoldyck'],
  ['A boy from Whale Island who became a Hunter to find the father who left him', 'Gon Freecss'],
  ['The last of his clan, whose eyes turn scarlet, hunting the thieves who took his people', 'Kurapika'],
  ['A magician who loves ripe fruit and strong opponents; his aura has the properties of rubber and gum', 'Hisoka'],
  ['The head of the Spider, who steals other people\'s abilities into his book', 'Chrollo Lucilfer'],
  ['Studied to become a doctor so that no one would die for want of money, like his friend did', 'Leorio Paradinight'],
  ['The eldest Zoldyck brother, who plants needles in people\'s heads', 'Illumi Zoldyck'],
  ['The twelfth Chairman of the Hunter Association, who prayed with a hundred hands', 'Netero'],
  ['A short Troupe member who tortures, and whose pain turns into a sun', 'Feitan Portor'],
  ['A cat-like Royal Guard who healed the King, and whose En stretches for kilometres', 'Neferpitou'],
  ['One of the five best Nen users in the world, and a father who never came home', 'Ging Freecss'],
  ['A blind girl who never loses at Gungi, and the last person the King asked for', 'Komugi'],
  ['Looks like a young girl, is over fifty, and trained two boys on Greed Island', 'Biscuit Krueger'],
  ['The Hunter who saved a boy from a Foxbear, and came back as a girl ant', 'Kite'],
  ['A Hunter who lends his aura with interest, and is softer than his face', 'Knuckle Bine'],
  ['The Zoldyck grandfather whose aura becomes dragons', 'Zeno Zoldyck'],
  ['A Zoldyck girl who grants wishes, if you grant her three requests first', 'Alluka Zoldyck'],
  ['The Troupe\'s strongest fist, who took on the mafia\'s Shadow Beasts bare-handed and would not tell where his friends were', 'Uvogin'],
  ['A Troupe member who remembers nothing and whose vacuum cleaner swallows everything', 'Shizuku Murasaki'],
  ['A Troupe member who reads memories with a touch and loads them into a gun', 'Pakunoda'],
  ['The King of the Chimera Ants, who learned the name he was given from a blind girl', 'Meruem'],
  ['The Vice Chairman who smiles at every disaster he causes', 'Pariston Hill'],
  ['A Nostrade bodyguard whose flute and hearing tell lies from truths', 'Senritsu'],
  ['Netero\'s son, who wants to take mankind to the Dark Continent', 'Beyond Netero'],
];
const signature = {
  label: 'Hunters & Villains',
  prompt: 'Who is this?',
  clues: CLUES.map(([text, name]) => ({ text, answer: [name, ...(ALIASES[name] ?? [])].join('|') })),
};

const boss = {
  id: 'hxh',
  domain: 'anime',
  franchise: 'Hunter x Hunter',
  aliases: ['hunter x hunter', 'hunter hunter', 'hxh', 'hunterxhunter', 'hunter × hunter'],
  images: 'fandom:hunterxhunter',
  boss: { name: 'Meruem', title: 'The King of the Chimera Ants', color: '#3f6212', image: imageOf('Meruem') },
  lines: {
    intro: 'I am the King. Everything that lives is mine to rule — you included. Show me why you should not be food.',
    phase2: 'Some of these faces have never held a Hunter License. Tell me which ones belong, human.',
    phase3: 'You are still breathing. Then name them all, before my patience ends.',
    hit: ['Interesting.', 'Hm. Again.', 'You have teeth.'],
    hurt: ['Weak.', 'Kneel.', 'That is all a human can do?', 'Predictable.'],
    win: 'So this is defeat… Komugi, would you play one more game with me?',
    lose: 'As I thought. Humans are food, nothing more.',
    secret: 'A game, then — like Gungi. I name a Hunter, a Spider, a Zoldyck or one of my ants; you answer with another of the same kind. No repeats.',
    secretOk: ['Hm.', 'Again.', 'Not bad.'],
    secretLost: 'No move left? Then I win, as always.',
  },
  blitz: [
    { prompt: 'Name 5 members of the Phantom Troupe', count: 5, answers: TROUPE.filter(keep).map(answer) },
    { prompt: 'Name 5 Zoldycks', count: 5, answers: ZOLDYCKS.filter(keep).map(answer) },
    { prompt: 'Name the six Nen types', count: 6, answers: ['Enhancement|Enhancer', 'Transmutation|Transmuter', 'Emission|Emitter', 'Conjuration|Conjurer', 'Manipulation|Manipulator', 'Specialization|Specialist'] },
    { prompt: 'Name the King\'s three Royal Guards', count: 3, answers: ['Neferpitou|Pitou|Neferpito', 'Shaiapouf|Pouf|Shaiapuf', 'Menthuthuyoupi|Youpi|Yupi'] },
    { prompt: 'Name 5 Chimera Ants', count: 5, answers: ANTS.filter(keep).map(answer) },
    { prompt: 'Name 5 Zodiacs', count: 5, answers: ZODIACS.filter(keep).map(answer) },
    { prompt: 'Name 5 examinees of a Hunter Exam', count: 5, answers: EXAMINEES.filter(keep).map(answer) },
  ],
  radar: { members, impostors },
  finale,
  secret: {
    categories: [
      { label: 'Zoldyck', entities: zoldycks },
      { label: 'Member of the Phantom Troupe', entities: troupe },
      { label: 'Chimera Ant', entities: ants },
      { label: 'Zodiac', entities: zodiacs },
      { label: 'Kakin prince', entities: princes },
    ],
  },
  signature,
};

const at = bosses.findIndex((b) => b.id === boss.id);
if (at >= 0) bosses[at] = boss;
else bosses.push(boss);
write('src/data/bosses.json', bosses, 2);

// The cards beyond the boss's: the Troupe, the Zoldycks, the named Ants, the Zodiacs, the Kakin princes, the
// examinees and examiners, the Hunters, the Nostrade family, the Heavens Arena fighters, the antagonists and the
// Greed Island players, each with their picture. The best-known of them rare, the rest common.
const RARE = new Set(['Colt', 'Welfin', 'Cheetu', 'Leol', 'Zazan', 'Rammot', 'Gyro', 'Ginta', 'Kanzai', 'Saiyu', 'Botobai Gigante', 'Benjamin Hui Guo Rou', 'Camilla Hui Guo Rou', 'Halkenburg Hui Guo Rou', 'Woble Hui Guo Rou', 'Kastro', 'Gido', 'Riehlvelt', 'Sadaso', 'Bodoro', 'Ponzu', 'Abengane', 'Tsezguerra', 'Bomber', 'Squala', 'Basho', 'Light Nostrade', 'Dalzollene', 'Buhara', 'Mito Freecss', 'Maha Zoldyck', 'Omokage', 'Knov', 'Novu', 'Bonolenov Ndongo', 'Kortopi', 'Zigg Zoldyck', 'Kurt Hui Guo Rou']);
const takenPages = new Set(named.map(titleOf));
const roster = [];
const pictured = new Set([boss.boss.image, ...members.map((m) => m.image), ...finale.map((m) => m.image)]);
for (const t of pool) {
  if (takenPages.has(t)) continue;
  const image = pics.get(t);
  if (!image || pictured.has(image)) continue;
  if (roster.some((r) => r.name === t) || named.includes(t)) continue;
  pictured.add(image);
  roster.push({ name: t, image, rarity: RARE.has(t) ? 'rare' : 'common' });
}
const rosters = read('src/data/card-rosters.json');
rosters.hxh = roster;
write('src/data/card-rosters.json', rosters, 1);

// The Specialist's traits, from each face's infobox: their group, their Nen type, gender, whether they are still
// alive, and the manga chapter they first appear in.
/** The group a face belongs to, first match wins (Illumi and Kalluto are Zoldycks; the Zodiacs before the Hunters). */
const GROUP = { Kurapika: 'Hunter', 'Leorio Paradinight': 'Hunter', Komugi: 'Civilian', 'Neon Nostrade': 'Mafia', Senritsu: 'Hunter', 'Tserriednich Hui Guo Rou': 'Kakin', 'Beyond Netero': 'Hunter', Kite: 'Hunter', Gotoh: 'Zoldyck', Canary: 'Zoldyck', Razor: 'Greed Island', Genthru: 'Greed Island', Tonpa: 'Examinee', Pokkle: 'Hunter', 'Palm Siberia': 'Hunter', Ikalgo: 'Chimera Ant', Meleoron: 'Chimera Ant' };
const groupOf = (n) => {
  if (GROUP[n]) return GROUP[n];
  const t = titleOf(n);
  if (ZOLDYCKS.includes(t)) return 'Zoldyck';
  if (TROUPE.includes(t)) return 'Phantom Troupe';
  if (ANTS.includes(t) || ['Neferpitou', 'Shaiapouf', 'Menthuthuyoupi', 'Meruem'].includes(t)) return 'Chimera Ant';
  if (ZODIACS.includes(t)) return 'Zodiac';
  return 'Hunter';
};
/** Infobox values the Specialist can't use as they are (Kite was a man; the Royal Guards' and Ging's Nen). */
const GENDER = { Kite: 'Male', Neferpitou: 'Unknown' };
const nenOf = (n, text) => {
  const v = field(text, 'type').replace(/\(.*$/, '').trim();
  return /^(Enhancement|Transmutation|Emission|Conjuration|Manipulation|Specialization)$/.test(v) ? v : 'Unknown';
};
const characters = [...FAVOURITES, ...DEEP].map((n) => {
  const text = wiki.get(titleOf(n));
  // The chapter they first appear in for real: not one where they're only mentioned, a silhouette, a photo or an image.
  const line = (text?.match(/\|\s*manga debut\s*=([^\n]*)/)?.[1] ?? '').replace(/<ref[^>]*\/>|<ref.*?<\/ref>/g, '');
  const seen = [...line.matchAll(/Chapter (\d+)\]*\s*(\([^)]*\))?/g)].filter((m) => !/mention|silhouette|photo|image|flashback/i.test(m[2] ?? ''));
  const debut = Number(seen[0]?.[1] ?? 0);
  const status = /^deceased/i.test(field(text, 'status')) ? 'Deceased' : /^alive/i.test(field(text, 'status')) ? 'Alive' : 'Unknown';
  const gender = GENDER[n] ?? (field(text, 'gender') || 'Unknown');
  return { name: n, group: groupOf(n), nen: nenOf(n, text), gender, status, debut };
});
writeFileSync(new URL('src/data/specialist/hxh.json', ROOT), JSON.stringify({ source: 'Hunterpedia (hunterxhunter.fandom.com)', characters }, null, 1) + '\n');
for (const c of characters) if (!c.debut || c.gender === 'Unknown' || c.status === 'Unknown') console.warn('check traits:', JSON.stringify(c));
console.log(`boss: ${members.length} radar, ${impostors.length} impostors, ${finale.length} finale, ${signature.clues.length} clues, ${zoldycks.length} zoldycks, ${troupe.length} troupe, ${ants.length} ants, ${zodiacs.length} zodiacs, ${princes.length} princes; roster: ${roster.length} cards; specialist: ${characters.length}`);
