// The Hollow Knight boss (the Radiance, the Old Light) for Hollow Knight and Hollow Knight: Silksong in one set, and its
// card roster: the bosses and characters of both games, in their drawn in-game art from the Hollow Knight Wiki
// (hollowknight.wiki's API; pictures on cdn.wikimg.net). The Radar's impostors are Smash's faces (already in
// bosses.json). Lines written for Omnidle.
//   node scripts/data/hollowknight-boss.mjs
import { readFileSync, writeFileSync } from 'node:fs';

const ROOT = new URL('../../', import.meta.url);
const read = (p) => JSON.parse(readFileSync(new URL(p, ROOT), 'utf8'));
// bosses.json and card-rosters.json keep Windows line ends.
const write = (p, j, indent) => writeFileSync(new URL(p, ROOT), (JSON.stringify(j, null, indent) + '\n').replace(/\n/g, '\r\n'));

const API = 'https://hollowknight.wiki/mw/api.php';
const api = async (p) => (await fetch(`${API}?${new URLSearchParams({ format: 'json', formatversion: '2', ...p })}`, { headers: { 'User-Agent': 'OmnidleData/1.0' } })).json();

/** Every page of a category. */
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

/** The wiki page each name's picture comes from, when it isn't the name itself. */
const PAGE = {
  Hornet: 'Hornet (Silksong)',
  'The Radiance': 'Radiance',
  'The Hollow Knight': 'Hollow Knight (Boss)',
  'The Pale King': 'Pale King',
  'The Knight': 'Knight',
  'Mister Mushroom': 'Mister Mushroom',
  'Brothers Oro & Mato': 'Brothers Oro & Mato',
  'Garmond and Zaza': 'Garmond and Zaza',
  'Seth': 'Shrine Guardian Seth',
  'Karmelita': 'Skarrsinger Karmelita',
  'Lugoli': 'Disgraced Chef Lugoli',
  'Signis & Gron': 'Forebrothers Signis & Gron',
};
/** The main picture of every page asked for (pageimages, 50 a request). */
async function pictures(titles) {
  const out = new Map();
  for (let i = 0; i < titles.length; i += 50) {
    const batch = titles.slice(i, i + 50);
    const j = await api({ action: 'query', titles: batch.join('|'), prop: 'pageimages', piprop: 'original', redirects: '1' });
    const back = new Map();
    for (const r of j.query?.redirects ?? []) back.set(r.to, r.from);
    for (const n of j.query?.normalized ?? []) back.set(n.to, n.from);
    for (const p of j.query?.pages ?? []) {
      let t = p.title;
      while (back.has(t)) t = back.get(t);
      if (p.original?.source) out.set(t, p.original.source);
    }
  }
  return out;
}
const answers = (list) => list.map((n) => [n, ...(ALIASES[n] ?? [])].join('|'));
/** Other names players type. */
const ALIASES = {
  'The Radiance': ['Radiance', 'The Old Light'],
  'The Hollow Knight': ['Hollow Knight'],
  'The Knight': ['Knight', 'Ghost', 'The Ghost', 'Little Ghost', 'The Vessel'],
  'The Pale King': ['Pale King', 'Wyrm'],
  'Grimm': ['Troupe Master Grimm'],
  'Zote': ['Zote the Mighty'],
  'Brothers Oro & Mato': ['Oro and Mato', 'Oro & Mato'],
  'Garmond and Zaza': ['Garmond & Zaza', 'Garmond', 'Zaza'],
  'Seth': ['Shrine Guardian Seth'],
  'Karmelita': ['Skarrsinger Karmelita'],
  'Lugoli': ['Disgraced Chef Lugoli'],
  'Signis & Gron': ['Forebrothers Signis & Gron', 'Signis and Gron'],
  'Dung Defender': ['Ogrim'],
  'Grand Mother Silk': ['Grand Mother', 'Mother Silk'],
};
// The fan favourites, best-known first (the ones every Hollow Knight community talks about: Hornet of both games, the Knight, the
// Troupe Master, Quirrel, Zote, Silksong's Lace, then the beloved side characters): the first two are legendary cards,
// the next four epic, then rare; the last a common.
const FAVOURITES = ['Hornet', 'The Knight', 'Grimm', 'Quirrel', 'Zote', 'Lace', 'Myla', 'Cloth', 'Sherma', 'Shakra', 'Tiso', 'Cornifer'];
// Final Blow: the deep cuts — the Pale King an epic find, then the Hallownest and Pharloom faces after.
const DEEP = [
  'The Pale King', 'White Lady', 'Mantis Lords', 'Dung Defender', 'Elderbug', 'Bretta', 'Iselda', 'Sly', 'Salubra', 'Nailsmith', 'Seer', 'Monomon', 'Lurien',
  'Herrah', 'Traitor Lord', 'Soul Master', 'False Knight', 'Broken Vessel', 'Nosk', 'Collector', 'Uumuu', 'Hive Knight', 'Bell Beast', 'Moss Mother',
  'Widow', 'Last Judge', 'Trobbio', 'Garmond and Zaza', 'Pinstress', 'Sister Splinter', 'Grand Mother Silk', 'First Sinner', 'Seth', 'Karmelita', 'Lugoli', 'Phantom',
];

const HK_BOSSES = await category('Bosses (Hollow Knight)');
const SS_BOSSES = (await category('Bosses (Silksong)')).filter((t) => !t.startsWith('Bosses'));
const HK_NPCS = (await category('NPCs (Hollow Knight)')).filter((t) => !/^Unnamed|Distant Villagers|Spirits|Dreamers/.test(t));
const SS_NPCS = (await category('NPCs (Silksong)')).filter((t) => !t.startsWith('NPCs') && !/^Unnamed/.test(t));
const HK_AREAS = (await category('Areas (Hollow Knight)')).filter((t) => !t.startsWith('Areas'));
const SS_AREAS = (await category('Areas (Silksong)')).filter((t) => !t.startsWith('Areas'));

// Names as players say them (the wiki's titles, without its "(Silksong)" and "(Boss)" tags).
const clean = (t) => t.replace(/ \((Silksong|Hollow Knight|Boss)\)$/, '');
const wanted = [...new Set([...FAVOURITES, ...DEEP, 'The Radiance', 'The Hollow Knight', ...[...HK_BOSSES, ...SS_BOSSES, ...HK_NPCS, ...SS_NPCS].map(clean)])];
const titleOf = (n) => PAGE[n] ?? n;
const pics = await pictures([...new Set(wanted.flatMap((n) => [titleOf(n), n]))]);
/** Pictures picked by hand where the page's own is a poor fit (the Knight's is its Shade; Hornet's a small sprite). */
const IMAGE = {
  Hornet: 'https://cdn.wikimg.net/en/hkwiki/images/thumb/4/4a/Hornet_%28Hollow_Knight%29.png/700px-Hornet_%28Hollow_Knight%29.png',
  'The Knight': 'https://cdn.wikimg.net/en/hkwiki/images/4/47/The_Knight_Idle.png',
};
// Silksong's own pages first (its "(Silksong)" ones), then the name's.
const imageOf = (n) => IMAGE[n] ?? pics.get(titleOf(n)) ?? pics.get(`${n} (Silksong)`) ?? pics.get(n) ?? '';

const card = (n) => {
  const image = imageOf(n);
  if (!image) throw new Error(`no picture for ${n} (page ${titleOf(n)})`);
  return { label: n, ...(ALIASES[n]?.length ? { aliases: ALIASES[n] } : {}), image };
};
const members = FAVOURITES.map(card);
const finale = DEEP.map(card);

const bosses = read('src/data/bosses.json');
const smash = bosses.find((b) => b.id === 'smash');
const IMPOSTORS = ['Kirby', 'Mario', 'Link', 'Samus', 'Pikachu', 'Sonic', 'Yoshi', 'Pac-Man', 'Mega Man', 'Isabelle', 'Olimar', 'Inkling'];
const impostors = IMPOSTORS.map((n) => [...smash.radar.members, ...smash.finale].find((m) => m.label === n)).filter((m) => m?.image).map(({ label, image }) => ({ label, image }));

const NAILMASTERS = ['Oro', 'Mato', 'Sheo|Paintmaster Sheo', 'Sly|Great Nailsage Sly'];
const DREAMERS = ['Monomon|Monomon the Teacher', 'Lurien|Lurien the Watcher', 'Herrah|Herrah the Beast'];
const hkBosses = answers(HK_BOSSES.map(clean));
const ssBosses = answers(SS_BOSSES.map(clean));
const hkAreas = HK_AREAS.map(clean);
// A place both games have (the Abyss) counts once, in Hallownest.
const ssAreas = SS_AREAS.map(clean).filter((a) => !hkAreas.includes(a));

// Signature: who is it, from what they are and do (written for Omnidle from the games and the wiki).
const CLUES = [
  ['The princess-protector of Hallownest, needle and thread in hand — then the heroine of her own song', 'Hornet'],
  ['Master of a travelling troupe who gathers the flame of a nightmare', 'Grimm'],
  ['A cheerful wanderer in a pale mask who keeps turning up to admire the view', 'Quirrel'],
  ['A self-proclaimed knight with 57 precepts and no victories', 'Zote'],
  ['A playful, deadly duellist in white who guards the Citadel of Pharloom', 'Lace'],
  ['A small vessel of void, silent, sent down to the old kingdom with a nail', 'The Knight'],
  ['A miner who sings while she works in the Crystal Peak', 'Myla'],
  ['A brave warrior who dreams of a glorious battle in the Fungal Wastes', 'Cloth'],
  ['A little pilgrim who rings his bells as he walks the roads of Pharloom', 'Sherma'],
  ['A fierce mapper who marks the land with her rings and her hammer', 'Shakra'],
  ['A cocky adventurer who wants to win the Colosseum of Fools', 'Tiso'],
  ['A cartographer who hums as he maps the kingdom, his wife waiting in Dirtmouth', 'Cornifer'],
  ['The god of light, once worshipped by the moths, who spread the Infection through dreams', 'The Radiance'],
  ['The pure vessel, chained in the Black Egg Temple to hold the light inside', 'The Hollow Knight'],
  ['A shining king who built a kingdom and sealed a god away', 'The Pale King'],
  ['A queen of root who waits in the Queen\'s Gardens', 'White Lady'],
  ['Three warrior sisters who duel only the worthy', 'Mantis Lords'],
  ['A cheerful knight of dung who guards the Royal Waterways', 'Dung Defender'],
  ['The last bug left in Dirtmouth, who greets every traveller', 'Elderbug'],
  ['A shopkeeper who was once a great nailsage', 'Sly'],
  ['A great beast with a bell on its back, that Hornet frees and rides', 'Bell Beast'],
  ['The ruler of Pharloom\'s silk, who called Hornet to the kingdom', 'Grand Mother Silk'],
  ['A puppeteer who puts on a show of fire and lights in the Grand Gate', 'Trobbio'],
  ['A wandering knight and his small partner who share the road with Hornet', 'Garmond and Zaza'],
];
const signature = {
  label: 'Hallownest & Pharloom',
  prompt: 'Who is this?',
  clues: CLUES.map(([text, name]) => ({ text, answer: answers([name])[0] })),
};

const boss = {
  id: 'hollowknight',
  domain: 'games',
  franchise: 'Hollow Knight',
  aliases: ['hollow knight', 'hollow knight silksong', 'silksong', 'hk', 'hallownest', 'pharloom'],
  images: 'hollowknight.wiki',
  boss: { name: 'The Radiance', title: 'The Old Light', color: '#facc15', image: imageOf('The Radiance') },
  lines: {
    intro: 'Sleep, little vessel. In the dream, everything is light — and the light is mine.',
    phase2: 'Some of these faces never walked Hallownest or Pharloom. Find the true bugs before my light swallows them!',
    phase3: 'You still stand in my dream. Name them all, before the light takes the last of them.',
    hit: ['A shadow…', 'The void stirs!', 'You dare?'],
    hurt: ['Into the light!', 'Infected, like the rest.', 'Your mask breaks!', 'Dream no more.'],
    win: 'The light… fades. Go, little shadow. For now, the kingdom sleeps without me.',
    lose: 'Another vessel, another dream. Hallownest is mine again.',
    secret: 'One last dream before the dawn. I name a boss or a place of Hallownest or Pharloom — you name another of the same. No repeats!',
    secretOk: ['Hm.', 'Again.', 'The light remembers.'],
    secretLost: 'Nothing? Then the dream is mine.',
  },
  blitz: [
    { prompt: 'Name 5 bosses of Hollow Knight', count: 5, answers: hkBosses },
    { prompt: 'Name 5 bosses of Silksong', count: 5, answers: ssBosses },
    { prompt: 'Name the 3 Dreamers', count: 3, answers: DREAMERS },
    { prompt: 'Name the 4 Nailmasters and their master', count: 4, answers: NAILMASTERS },
    { prompt: 'Name 5 places of Hallownest', count: 5, answers: hkAreas },
    { prompt: 'Name 5 places of Pharloom', count: 5, answers: ssAreas },
    { prompt: 'Name 5 characters of Hollow Knight', count: 5, answers: answers(HK_NPCS.map(clean)) },
    { prompt: 'Name 5 characters of Silksong', count: 5, answers: answers(SS_NPCS.map(clean)) },
  ],
  radar: { members, impostors },
  finale,
  secret: {
    categories: [
      { label: 'Boss of Hollow Knight', entities: hkBosses },
      { label: 'Boss of Silksong', entities: ssBosses },
      { label: 'Place of Hallownest', entities: hkAreas },
      { label: 'Place of Pharloom', entities: ssAreas },
    ],
  },
  signature,
};

const at = bosses.findIndex((b) => b.id === boss.id);
if (at >= 0) bosses[at] = boss;
else bosses.push(boss);
write('src/data/bosses.json', bosses, 2);

// The cards beyond the boss's: every other boss and character of both games (the best-known bosses rare, the rest
// common), with a picture.
const RARE = new Set(['Grey Prince Zote', 'Nightmare King Grimm', 'Absolute Radiance', 'Pure Vessel', 'Hunter', 'Watcher Knight', 'Failed Champion', 'Lost Kin', 'Soul Tyrant', 'Markoth', 'Gorb', 'No Eyes', 'Xero', 'Galien', 'Marmu', 'Elder Hu', 'Nailsmith', 'Lost Lace', 'Moorwing', 'Savage Beastfly', 'Cogwork Dancers', 'Fourth Chorus', 'Groal the Great', 'Shrine Guardian Seth', 'Skarrsinger Karmelita', 'Second Sentinel', 'Nuu', 'Mask Maker', 'Fleamaster Mooshka']);
const taken = new Set([...FAVOURITES, ...DEEP, 'The Radiance', 'The Hollow Knight', 'Radiance', 'Hollow Knight', 'Hornet Protector', 'Hornet Sentinel', 'Shrine Guardian Seth', 'Skarrsinger Karmelita', 'Disgraced Chef Lugoli', 'Forebrothers Signis & Gron', 'Sisters of Battle']);
const roster = [];
// One card a picture: a page that is the same bug under a longer title (Charm Lover Salubra, Monomon the Teacher) or a
// fight that shows the same art (Enraged Guardian) adds nothing.
const pictured = new Set([boss.boss.image, ...members.map((m) => m.image), ...finale.map((m) => m.image)]);
for (const n of [...HK_BOSSES, ...SS_BOSSES, ...HK_NPCS, ...SS_NPCS].map(clean)) {
  if (taken.has(n) || roster.some((r) => r.name === n)) continue;
  const image = imageOf(n);
  if (!image || /Beta_hk_promo/.test(image) || pictured.has(image)) continue;
  pictured.add(image);
  roster.push({ name: n, image, rarity: RARE.has(n) ? 'rare' : 'common' });
}
const rosters = read('src/data/card-rosters.json');
rosters.hollowknight = roster;
write('src/data/card-rosters.json', rosters, 1);
console.log(`boss: ${members.length} radar, ${impostors.length} impostors, ${finale.length} finale, ${signature.clues.length} clues, ${hkBosses.length}+${ssBosses.length} bosses, ${hkAreas.length}+${ssAreas.length} areas; roster: ${roster.length} cards`);
