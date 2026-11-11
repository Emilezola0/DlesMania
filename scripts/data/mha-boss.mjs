// The My Hero Academia boss (All For One, the Symbol of Evil) and its card roster: the heroes, students and villains
// of the series in their anime and manga art, from the My Hero Academia Wiki (myheroacademia.fandom.com's API:
// categories, infobox pictures, and the infobox's gender, Quirk, status and debut chapter for the Specialist). The
// Radar's impostors are Naruto's and One Piece's faces (already in bosses.json). Lines written for Omnidle.
//   node scripts/data/mha-boss.mjs
import { readFileSync, writeFileSync } from 'node:fs';

const ROOT = new URL('../../', import.meta.url);
const read = (p) => JSON.parse(readFileSync(new URL(p, ROOT), 'utf8'));
// bosses.json and card-rosters.json keep Windows line ends.
const write = (p, j, indent) => writeFileSync(new URL(p, ROOT), (JSON.stringify(j, null, indent) + '\n').replace(/\n/g, '\r\n'));

const API = 'https://myheroacademia.fandom.com/api.php';
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

/** The infobox picture of every page asked for, served 400 px wide. */
async function pictures(titles) {
  const out = new Map();
  for (let i = 0; i < titles.length; i += 50) {
    const j = await api({ action: 'query', titles: titles.slice(i, i + 50).join('|'), prop: 'pageimages', piprop: 'original', redirects: '1' });
    const asked = backMap(j.query);
    for (const p of j.query?.pages ?? []) if (p.original?.source) out.set(asked(p.title), p.original.source.replace('/revision/latest?', '/revision/latest/scale-to-width-down/400?'));
  }
  return out;
}

/** The wikitext of every page asked for. */
async function texts(titles) {
  const out = new Map();
  for (let i = 0; i < titles.length; i += 50) {
    const j = await api({ action: 'query', titles: titles.slice(i, i + 50).join('|'), prop: 'revisions', rvprop: 'content', rvslots: 'main', redirects: '1' });
    const asked = backMap(j.query);
    for (const p of j.query?.pages ?? []) if (p.revisions) out.set(asked(p.title), p.revisions[0].slots.main.content);
  }
  return out;
}

/** The categories of every page asked for. */
async function categoriesOf(titles) {
  const out = new Map();
  for (let i = 0; i < titles.length; i += 50) {
    const j = await api({ action: 'query', titles: titles.slice(i, i + 50).join('|'), prop: 'categories', cllimit: '500', redirects: '1' });
    const asked = backMap(j.query);
    for (const p of j.query?.pages ?? []) out.set(asked(p.title), (p.categories ?? []).map((c) => c.title.replace('Category:', '')));
  }
  return out;
}

/** An infobox field, its first line, links and templates reduced to their text. */
const field = (text, name) => {
  const m = text?.match(new RegExp(`\\|\\s*${name}\\s*=([^\\n]*)`));
  if (!m) return '';
  return m[1]
    .replace(/\{\{Ruby\|([^|}]*)\|[^}]*\}\}/g, '$1')
    .replace(/\{\{Nihongo\|([^|}]*)[^}]*\}\}/g, '$1')
    .replace(/\{\{Ref[^}]*\}\}|\{\{Former\}\}|<ref[^>]*\/>|<ref.*?<\/ref>/g, '')
    .replace(/\[\[(?:[^\]|]*\|)?([^\]]*)\]\]/g, '$1')
    .replace(/\{\{[^}]*\}\}/g, '')
    .split(/<br\s*\/?>/)[0]
    .trim();
};
/** "Flame Hero: Endeavor" → "Endeavor". */
const heroName = (alias) => (/^[^:]*Hero[^:]*:\s*(.+)$/.exec(alias)?.[1] ?? '').trim();

/** The page each name is on, when it isn't the name itself (the wiki goes by real names). */
const PAGE = {
  'All Might': 'Toshinori Yagi',
  Hawks: 'Keigo Takami',
  Endeavor: 'Enji Todoroki',
  Mirko: 'Rumi Usagiyama',
  'Best Jeanist': 'Tsunagu Hakamada',
  'Present Mic': 'Hizashi Yamada',
  Midnight: 'Nemuri Kayama',
  'Gran Torino': 'Sorahiko Torino',
  'Recovery Girl': 'Chiyo Shuzenji',
  'Fat Gum': 'Taishiro Toyomitsu',
  Stain: 'Chizome Akaguro',
  Twice: 'Jin Bubaigawara',
  'Mr. Compress': 'Atsuhiro Sako',
  Spinner: 'Shuichi Iguchi',
  Overhaul: 'Kai Chisaki',
  'Gentle Criminal': 'Danjuro Tobita',
  'Lady Nagant': 'Kaina Tsutsumi',
  'Star and Stripe': 'Cathleen Bate',
};
const titleOf = (n) => PAGE[n] ?? n;
/** Other names players type: the real name or the hero name, nicknames, the spellings fans use. */
const ALIASES = {
  'Izuku Midoriya': ['Deku', 'Midoriya', 'Izuku'],
  'Katsuki Bakugo': ['Bakugo', 'Bakugou', 'Katsuki Bakugou', 'Kacchan', 'Ground Zero', 'Dynamight'],
  'Shoto Todoroki': ['Todoroki', 'Shoto', 'Shouto Todoroki'],
  'All Might': ['Toshinori Yagi', 'Toshinori'],
  Hawks: ['Keigo Takami'],
  'Shota Aizawa': ['Aizawa', 'Eraser Head', 'Eraserhead', 'Shouta Aizawa'],
  'Eijiro Kirishima': ['Kirishima', 'Red Riot', 'Eijirou Kirishima'],
  Dabi: ['Toya Todoroki', 'Touya Todoroki'],
  'Ochaco Uraraka': ['Uraraka', 'Uravity', 'Ochako Uraraka', 'Ochaco'],
  'Himiko Toga': ['Toga'],
  'Tomura Shigaraki': ['Shigaraki', 'Tomura', 'Tenko Shimura'],
  'Fumikage Tokoyami': ['Tokoyami', 'Tsukuyomi'],
  Endeavor: ['Enji Todoroki'],
  'Mirio Togata': ['Mirio', 'Lemillion', 'Togata'],
  'Hitoshi Shinso': ['Shinso', 'Shinsou', 'Hitoshi Shinsou'],
  'Tenya Ida': ['Iida', 'Tenya Iida', 'Ida'],
  'Tsuyu Asui': ['Tsuyu', 'Froppy', 'Asui'],
  'Momo Yaoyorozu': ['Momo', 'Yaoyorozu', 'Creati'],
  'Denki Kaminari': ['Kaminari', 'Denki', 'Chargebolt'],
  'Tamaki Amajiki': ['Tamaki', 'Suneater', 'Amajiki'],
  'Kyoka Jiro': ['Jiro', 'Jirou', 'Kyouka Jirou'],
  'Mina Ashido': ['Mina', 'Ashido', 'Pinky'],
  Mirko: ['Rumi Usagiyama'],
  'Best Jeanist': ['Tsunagu Hakamada', 'Tsunagu Hakamata'],
  'Present Mic': ['Hizashi Yamada'],
  'Nejire Hado': ['Nejire', 'Nejire Chan'],
  'Neito Monoma': ['Monoma'],
  'Itsuka Kendo': ['Kendo', 'Battle Fist'],
  'Tetsutetsu Tetsutetsu': ['Tetsutetsu', 'Real Steel'],
  'Minoru Mineta': ['Mineta', 'Grape Juice'],
  'Hanta Sero': ['Sero', 'Cellophane'],
  'Gran Torino': ['Sorahiko Torino'],
  'Recovery Girl': ['Chiyo Shuzenji'],
  Nezu: ['Principal Nezu'],
  'Fat Gum': ['Taishiro Toyomitsu'],
  Midnight: ['Nemuri Kayama'],
  Stain: ['Chizome Akaguro', 'Hero Killer', 'Hero Killer Stain'],
  Twice: ['Jin Bubaigawara'],
  'Mr. Compress': ['Atsuhiro Sako', 'Mr Compress'],
  Spinner: ['Shuichi Iguchi'],
  Overhaul: ['Kai Chisaki', 'Chisaki'],
  'Gentle Criminal': ['Danjuro Tobita', 'Gentle'],
  'Lady Nagant': ['Kaina Tsutsumi'],
  'Star and Stripe': ['Cathleen Bate', 'Star & Stripe'],
  'Nana Shimura': ['Nana'],
  'Mei Hatsume': ['Hatsume', 'Mei'],
  'Inasa Yoarashi': ['Inasa', 'Yoarashi'],
  'Camie Utsushimi': ['Camie'],
  'All For One': ['AFO', 'Afo', 'Symbol of Evil'],
};
// The fans' favourites, best-known first (the series' popularity polls: Bakugo and Deku at the top, then Todoroki,
// Hawks, Aizawa, Kirishima, Dabi, Tokoyami, Toga and Uraraka; All Might its symbol): the first two legendary, the next
// four epic, then rare.
const FAVOURITES = ['Izuku Midoriya', 'Katsuki Bakugo', 'Shoto Todoroki', 'All Might', 'Hawks', 'Shota Aizawa', 'Eijiro Kirishima', 'Dabi', 'Ochaco Uraraka', 'Himiko Toga', 'Tomura Shigaraki', 'Fumikage Tokoyami'];
// Final Blow: the rest of the cast — Endeavor an epic find, Mirio, Shinso and Ida rare, then everyone else.
const DEEP = [
  'Endeavor', 'Mirio Togata', 'Hitoshi Shinso', 'Tenya Ida', 'Tsuyu Asui', 'Momo Yaoyorozu', 'Denki Kaminari', 'Tamaki Amajiki', 'Kyoka Jiro', 'Mina Ashido',
  'Stain', 'Twice', 'Overhaul', 'Mirko', 'Best Jeanist', 'Present Mic', 'Nejire Hado', 'Neito Monoma', 'Itsuka Kendo', 'Tetsutetsu Tetsutetsu', 'Minoru Mineta',
  'Hanta Sero', 'Gran Torino', 'Recovery Girl', 'Nezu', 'Fat Gum', 'Midnight', 'Mr. Compress', 'Spinner', 'Kurogiri', 'Gentle Criminal', 'Lady Nagant',
  'Star and Stripe', 'Eri', 'Nana Shimura', 'Mei Hatsume', 'Inasa Yoarashi', 'Camie Utsushimi',
];

const CLASS_A = (await category('Class 1-A')).filter((t) => t !== 'Class 1-A');
const CLASS_B = (await category('Class 1-B')).filter((t) => t !== 'Class 1-B');
const STAFF = await category('U.A. Staff');
const PROS = await category('Pro Heroes');
const HEROES = await category('Heroes');
const VILLAINS = await category('Villains');
const LEAGUE = await category('League of Villains');
const PLF = await category('Paranormal Liberation Front');
const SHIE = await category('Shie Hassaikai');
const QUIRKS = await category('Quirks');

// Groups and faceless extras (a Nomu, "Woman", a robot, the sidekicks, a villain known only by a fight) aren't characters to collect.
const GENERIC = /Nomu|^Woman$|^Robot$|^Red$|^Mocha$|^Johnny$|^Anonymous$|Villain$|Clan$|^Ending$|^Sanctum$|^Chubs$|^Ribby$|Headgear|Bulwark|Gaping Jaw|^Hood$|Zealot|^Mon$|^Native$|^Nine$|^Soji$|^Tetsu$|Sidekicks|Squad|^"|^Number \d|Boss$|\(/;
const pool = [...new Set([...CLASS_A, ...CLASS_B, ...STAFF, ...PROS, ...LEAGUE, ...PLF, ...SHIE])].filter((t) => !GENERIC.test(t));
const named = [...FAVOURITES, ...DEEP, 'All For One'];
const wanted = [...new Set([...named.map(titleOf), ...pool])];
const pics = await pictures(wanted);
const wiki = await texts(wanted);
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
  ...['Naruto Uzumaki', 'Sasuke Uchiha', 'Kakashi Hatake', 'Itachi Uchiha', 'Gaara', 'Rock Lee'].map((n) => face('naruto', n)),
  ...['Monkey D. Luffy', 'Roronoa Zoro', 'Sanji', 'Portgas D. Ace', 'Trafalgar D. Water Law', 'Shanks'].map((n) => face('onepiece', n)),
].filter(Boolean);

/** A wiki title as an answer: the hero name too, for a pro hero ("Enji Todoroki|Endeavor"). */
const proAnswer = (t) => {
  const hero = heroName(field(wiki.get(t) ?? '', 'alias'));
  return hero && hero !== t ? `${t}|${hero}` : t;
};
const answer = (n) => [n, ...(ALIASES[n] ?? [])].join('|');
const QUIRK_NAMES = [...new Set(QUIRKS.map((q) => q.replace(/ \(Quirk\)$/, '')))];
// The Name Chain: each name in one category only (a Quirk named like someone in the series counts as a person).
const classA = CLASS_A.map((t) => [t, ...(ALIASES[t] ?? [])].join('|'));
const classB = CLASS_B.map((t) => [t, ...(ALIASES[t] ?? [])].join('|'));
const students = new Set([...CLASS_A, ...CLASS_B]);
const pros = PROS.filter((t) => !students.has(t)).map(proAnswer);
const villains = [...new Set([...LEAGUE, ...PLF, ...SHIE])].filter((t) => !GENERIC.test(t)).map((t) => {
  const v = Object.entries(PAGE).find(([, p]) => p === t)?.[0];
  return v ? `${v}|${t}` : t;
});

// Signature: who is it, from what they are and do (written for Omnidle from the series).
const CLUES = [
  ['Born without a Quirk, he inherited the power of the Symbol of Peace', 'Izuku Midoriya'],
  ['His sweat explodes, and he swears he will be number one', 'Katsuki Bakugo'],
  ['Ice on his right side, fire on his left, the son of the Flame Hero', 'Shoto Todoroki'],
  ['The Symbol of Peace, who smiles so that people know they are safe', 'All Might'],
  ['A Pro Hero with crimson wings, too fast for anyone, who was a spy for the Commission', 'Hawks'],
  ['A tired teacher with scarf and goggles who erases Quirks with a look', 'Shota Aizawa'],
  ['Hardens his whole body and wants to be a manly hero', 'Eijiro Kirishima'],
  ['Blue flames, burnt skin and stapled scars: the eldest son of the Todoroki family', 'Dabi'],
  ['Makes anything she touches float, and dreams of earning money for her parents', 'Ochaco Uraraka'],
  ['A cheerful girl who drinks blood to become the people she loves', 'Himiko Toga'],
  ['Turns everything he touches to dust, the leader of the League of Villains', 'Tomura Shigaraki'],
  ['A bird-headed student whose shadow fights beside him', 'Fumikage Tokoyami'],
  ['The Flame Hero, number one after All Might retired', 'Endeavor'],
  ['Passes through walls, and was once the closest to the top of the Big Three', 'Mirio Togata'],
  ['Brainwashes anyone who answers him, and trains with Eraser Head\'s capture scarf', 'Hitoshi Shinso'],
  ['The class president with engines in his calves', 'Tenya Ida'],
  ['A frog-like girl who always says what she thinks, ribbit', 'Tsuyu Asui'],
  ['Creates any non-living thing from her body, the vice-president of her class', 'Momo Yaoyorozu'],
  ['The Hero Killer, who hunted the heroes he called fakes', 'Stain'],
  ['Copies anyone, himself too, and fears which one is the real him', 'Twice'],
  ['A Yakuza boss with a plague mask who takes apart and restores anything he touches', 'Overhaul'],
  ['The Rabbit Hero, who fights with her legs alone', 'Mirko'],
  ['A little girl whose horn can rewind a person\'s body', 'Eri'],
  ['All Might\'s teacher, the seventh holder of One For All', 'Nana Shimura'],
  ['A mouse, a bear or a dog — the principal of U.A. High School', 'Nezu'],
  ['The Number One hero of America, whose Quirk makes new rules', 'Star and Stripe'],
];
const signature = {
  label: 'Heroes & Villains',
  prompt: 'Who is this?',
  clues: CLUES.map(([text, name]) => ({ text, answer: answer(name) })),
};

const boss = {
  id: 'mha',
  domain: 'anime',
  franchise: 'My Hero Academia',
  aliases: ['my hero academia', 'boku no hero academia', 'mha', 'bnha', 'hero academia', 'my hero'],
  images: 'fandom:myheroacademia',
  boss: { name: 'All For One', title: 'The Symbol of Evil', color: '#7f1d1d', image: imageOf('All For One') },
  lines: {
    intro: 'Welcome, young hero. Your Quirk, your friends, your future… I will take them all, one for me.',
    phase2: 'Some of these faces never set foot in U.A. Pick out the real heroes and villains — if you can tell them apart.',
    phase3: 'Still standing? Then name them all, before I steal the last of them.',
    hit: ['Impressive.', 'A spark of One For All…', 'You dare?'],
    hurt: ['I will take that.', 'Your Quirk is mine.', 'Plus Ultra? How tiresome.', 'Like taking candy.'],
    win: 'So the torch passes again… Remember my name, child. Evil never stays down for long.',
    lose: 'Another hero who couldn\'t go beyond. Society will never know your name.',
    secret: 'One more game, for old times\' sake. I name a hero, a villain or a Quirk — you name another of the same kind. No repeats.',
    secretOk: ['Hm.', 'Again.', 'Not bad.'],
    secretLost: 'Nothing left? Then your Quirk is mine.',
  },
  blitz: [
    { prompt: 'Name 5 students of Class 1-A', count: 5, answers: classA },
    { prompt: 'Name 5 students of Class 1-B', count: 5, answers: classB },
    { prompt: 'Name 5 Pro Heroes', count: 5, answers: pros },
    { prompt: 'Name 5 villains', count: 5, answers: villains },
    { prompt: 'Name the Big Three of U.A.', count: 3, answers: ['Mirio Togata|Lemillion|Mirio', 'Tamaki Amajiki|Suneater|Tamaki', 'Nejire Hado|Nejire'] },
    { prompt: 'Name 5 holders of One For All', count: 5, answers: ['Yoichi Shigaraki|Yoichi', 'Toshitsugu Kudo|Kudo', 'Hikage Shinomori|Shinomori', 'Daigoro Banjo|Banjo', 'En Tayutai|En', 'Nana Shimura|Nana', 'All Might|Toshinori Yagi', 'Izuku Midoriya|Deku'] },
    { prompt: 'Name 5 Quirks', count: 5, answers: QUIRK_NAMES },
  ],
  radar: { members, impostors },
  finale,
  secret: {
    categories: [
      { label: 'Student of Class 1-A', entities: classA },
      { label: 'Student of Class 1-B', entities: classB },
      { label: 'Pro Hero', entities: pros },
      { label: 'Quirk', entities: QUIRK_NAMES.filter((q) => !wanted.includes(q)) },
    ],
  },
  signature,
};

const at = bosses.findIndex((b) => b.id === boss.id);
if (at >= 0) bosses[at] = boss;
else bosses.push(boss);
write('src/data/bosses.json', bosses, 2);

// The cards beyond the boss's: the rest of both classes, U.A.'s teachers, the Pro Heroes and the villains of the
// League, the Liberation Front and the Shie Hassaikai, each with their picture; pro heroes go by their hero name.
// The best-known of them rare, the rest common.
const RARE = new Set(['Yuga Aoyama', 'Koji Koda', 'Mashirao Ojiro', 'Mezo Shoji', 'Rikido Sato', 'Toru Hagakure', 'Edgeshot', 'Ryukyu', 'Cementoss', 'Ectoplasm', 'Power Loader', 'Vlad King', 'Thirteen', 'Snipe', 'Lunch Rush', 'Gigantomachia', 'Kyudai Garaki', 'Re-Destro', 'Ingenium', 'Mt. Lady', 'Kamui Woods', 'Hound Dog', 'Crust', 'Wash', 'Sir Nighteye', 'Rock Lock', 'Shield Hero', 'Gang Orca', 'Yu Hojo', 'Kendo Rappa', 'Hari Kurono']);
const takenPages = new Set([...named.map(titleOf), 'Toshinori Yagi']);
const roster = [];
const pictured = new Set([boss.boss.image, ...members.map((m) => m.image), ...finale.map((m) => m.image)]);
for (const t of pool) {
  if (takenPages.has(t)) continue;
  const image = pics.get(t);
  if (!image || pictured.has(image)) continue;
  const hero = (PROS.includes(t) || STAFF.includes(t)) && !students.has(t) ? heroName(field(wiki.get(t) ?? '', 'alias')) : '';
  const name = (hero || t).replace(/^"|"$/g, '');
  if (roster.some((r) => r.name === name) || named.includes(name)) continue;
  pictured.add(image);
  roster.push({ name, image, rarity: RARE.has(name) || RARE.has(t) ? 'rare' : 'common' });
}
const rosters = read('src/data/card-rosters.json');
rosters.mha = roster;
write('src/data/card-rosters.json', rosters, 1);

// The Specialist's traits, from each face's infobox: gender, what they are, their Quirk's kind, whether they are
// still alive, and the manga chapter they first appear in.
const quirkOf = new Map([...named].map((n) => [n, field(wiki.get(titleOf(n)), 'quirk')]));
const quirkCats = await categoriesOf([...new Set([...quirkOf.values()].filter(Boolean))]);
const kindOf = (q) => {
  const c = quirkCats.get(q) ?? [];
  return c.includes('Emitter Quirks') ? 'Emitter' : c.includes('Transformation Quirks') ? 'Transformation' : c.includes('Mutant Quirks') ? 'Mutant' : '';
};
/** What a face is, where the categories alone mislead (Toga was a student once; Eri is no hero). */
const ROLE = { 'Himiko Toga': 'Villain', Dabi: 'Villain', 'Tomura Shigaraki': 'Villain', 'Lady Nagant': 'Villain', Eri: 'Civilian', 'Nana Shimura': 'Pro Hero', 'Mirio Togata': 'Student', 'Tamaki Amajiki': 'Student', 'Nejire Hado': 'Student', 'Mei Hatsume': 'Student', 'Inasa Yoarashi': 'Student', 'Camie Utsushimi': 'Student', 'Hitoshi Shinso': 'Student', 'Nezu': 'Teacher', 'Shota Aizawa': 'Teacher', 'Present Mic': 'Teacher', 'Midnight': 'Teacher', 'Recovery Girl': 'Teacher', 'All Might': 'Pro Hero' };
/** Quirks the wiki leaves without a kind (One For All, Overhaul): Emitters both. */
const QUIRK_KIND = { 'Izuku Midoriya': 'Emitter', 'All Might': 'Emitter', Overhaul: 'Emitter' };
const roleOf = (n) => {
  if (ROLE[n]) return ROLE[n];
  const t = titleOf(n);
  if (VILLAINS.includes(t)) return 'Villain';
  if (students.has(t)) return 'Student';
  if (PROS.includes(t) || HEROES.includes(t)) return 'Pro Hero';
  return 'Civilian';
};
const characters = [...FAVOURITES, ...DEEP].map((n) => {
  const text = wiki.get(titleOf(n));
  const debut = Number(/Chapter (\d+)/.exec(field(text, 'debut'))?.[1] ?? 0);
  const status = /deceased/i.test(field(text, 'status')) ? 'Deceased' : 'Alive';
  return { name: n, gender: field(text, 'gender'), role: roleOf(n), quirk: QUIRK_KIND[n] ?? kindOf(quirkOf.get(n)), status, debut };
});
writeFileSync(new URL('src/data/specialist/mha.json', ROOT), JSON.stringify({ source: 'My Hero Academia Wiki (myheroacademia.fandom.com)', characters }, null, 1) + '\n');
for (const c of characters) if (!c.gender || !c.quirk || !c.debut) console.warn('traits missing:', JSON.stringify(c));
console.log(`boss: ${members.length} radar, ${impostors.length} impostors, ${finale.length} finale, ${signature.clues.length} clues, ${classA.length}+${classB.length} students, ${pros.length} pros, ${villains.length} villains, ${QUIRK_NAMES.length} quirks; roster: ${roster.length} cards; specialist: ${characters.length}`);
