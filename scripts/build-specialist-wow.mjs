#!/usr/bin/env node
// Builds src/data/specialist/wow.json for the World of Warcraft Specialist mode (and the Who's That?
// and Boss Battle rosters built from it), from the Warcraft Wiki (warcraft.wiki.gg).
//
//   node scripts/build-specialist-wow.mjs [--size=120]
//
// - Who's in: only well-known characters who appear in the games. Candidates are the pages Blizzard
//   and the wiki flag as major (Blizzard's "The Characters of Warcraft", Hearthstone heroes, Heroes of
//   the Storm, action figures, faction leaders, city bosses, Mount Journal and Hearthstone legendary
//   characters), each flag weighted, plus the article's size. Characters must appear in World of
//   Warcraft (a "<zone> NPCs" / "mobs" / "bosses" category); the top `--size` are kept.
// - Facts: the {{Npcbox}} infobox — gender, race, creature type, faction, class, status, titles.
// - Debut: the first game each one appeared in, hand-written in scripts/data/wow-debuts.mjs.
// - Pictures: the infobox art (portrait crop) and, for silhouettes, a render with a transparent
//   background found among the PNGs on the character's page (Warcraft III Reforged, Warcraft Rumble…),
//   checked by decoding the thumbnail here.
// Only facts and names are kept.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { inflateSync } from 'node:zlib';
import { ROOT, mediawikiGet, parseArgs, sleep } from './lib.mjs';
import { WOW_DEBUT, WOW_GAMES } from './data/wow-debuts.mjs';

const API = 'https://warcraft.wiki.gg/api.php';
const OUT = join(ROOT, 'src', 'data', 'specialist', 'wow.json');
const { flags } = parseArgs();
const SIZE = Number(flags.size ?? 120);

/** How much each "this character matters" flag counts. */
const SEEDS = {
  'Heroes of the Storm characters': 2,
  'Action figures': 2,
  'Hearthstone heroes': 1.5,
  'Leaders of Azeroth characters': 1.5,
  'City bosses': 1,
  'Mount Journal characters': 0.5,
  'Hearthstone legendary cards': 0.5,
};
const OFFICIAL = 3;
/**
 * Left out: pages that aren't one character (a title held by several, a horse...), and characters the
 * flags overrate — Hearthstone originals, minor raid bosses and side characters most players won't know.
 */
const SKIP = new Set([
  'Lich King', 'Invincible', 'Wildhammer Fact Checker', 'Patches (observer)', 'Annhylde the Caller', 'Magmaw', 'Faerin Lothar', 'Misha', 'Stitches',
  'Meryl Felstorm', 'Reno Jackson', 'Sir Finley Mrrgglton', 'Winter Queen', 'Prince Renathal', 'Merithra', 'Sintharia', 'Elise Starseeker', 'Brightwing',
  'The Black Knight', 'Lord Vincent Godfrey', 'Gonk', 'Murozond', 'Kurdran Wildhammer', 'Emperor Shaohao', 'Grand Magister Rommath', 'Halduron Brightwing',
  'Aethas Sunreaver', 'Darius Crowley', 'Sunwalker Dezco', 'Rokhan', 'Lunara', 'Galakras', 'Flame Leviathan', 'Maloriak', 'Hobart Grapplehammer', 'Griftah',
  'A. F. Kay', 'Wilfred Fizzlebang', 'Morchie', 'Rafaam', 'Primus', 'Pelagos', 'Orweyna', 'Ebyssian', 'Vyranoth', 'Omen', "Za'qul", 'Wardruid Loti',
  'Dagran Thaurissan II', 'Allari the Souleater', "Kor'vas Bloodthorn", 'Kayn Sunfury', 'Altruis the Sufferer', 'Magister Astalor Bloodsworn',
  'Aponi Brightmane', 'Saidan Dathrohan', 'Hemet Nesingwary', 'Marin Noggenfogger', 'Millhouse Manastorm', 'Tinkmaster Overspark', "Dar'Khan Drathir",
  'Zabra Hexx', 'Thargas Anvilmar', 'Murky', 'King Krush', 'Ursoc', 'Vindicator Boros', 'Reliquary of Souls', 'Thaddius', 'Lord Marrowgar', 'Rotface', 'Patchwerk', 'Majordomo Executus', 'Naralex', 'Annhylde', 'Nat Pagle', 'Harrison Jones',
]);
/** Iconic characters the flags miss (raid bosses, Warcraft III heroes, Old Gods...): always in when they're in the games. */
const MUST = [
  "Ner'zhul", "Kil'jaeden", 'Archimonde', 'Sargeras', 'Cenarius', 'Lei Shen', "C'Thun", 'Yogg-Saron', "N'Zoth", 'Hakkar the Soulflayer', 'Sindragosa',
  'Edwin VanCleef', 'Xavius', 'Varimathras', 'Teron Gorefiend', 'Blackhand', 'Kargath Bladefist', 'Orgrim Doomhammer', 'Anduin Lothar', 'Terenas Menethil II',
  'Antonidas', "Drek'Thar", 'Thalyssra', 'Grand Magistrix Elisande', 'Odyn', 'Helya', "G'huun", 'Mannoroth', 'Lady Deathwhisper', 'Professor Putricide',
  'Illidan Stormrage', "Kel'Thuzad", 'Queen Azshara', 'Tyrande Whisperwind', 'Alexstrasza', 'Ysera', 'Nozdormu', 'Malygos', 'Onyxia', 'Nefarian', 'Ragnaros',
  'Hogger', 'Leeroy Jenkins', 'Brann Bronzebeard', 'Chronormu', 'Mekkatorque', 'Khadgar', 'Medivh', 'Uther the Lightbringer', 'Tirion Fordring',
];
/** Extra accepted answers the infobox doesn't give. */
const EXTRA_ALIASES = { 'Arthas Menethil': ['The Lich King', 'Lich King', 'Arthas'], 'Bolvar Fordragon': ['Bolvar'], 'Grommash Hellscream': ['Grom Hellscream', 'Grom'], Chronormu: ['Chromie'], Zovaal: ['The Jailer', 'Jailer'] };

async function categoryPages(category, namespace = '0') {
  const out = [];
  let cont = {};
  do {
    const d = await mediawikiGet(API, { action: 'query', list: 'categorymembers', cmtitle: `Category:${category}`, cmnamespace: namespace, cmlimit: '500', ...cont });
    out.push(...(d.query?.categorymembers ?? []).map((p) => p.title));
    cont = d.continue ?? null;
  } while (cont);
  return out;
}

/** Wikitext, categories, size and PNG files of many pages, 20 at a time, following redirects and continuations. */
async function pages(titles) {
  const out = new Map();
  const redirect = new Map();
  for (let i = 0; i < titles.length; i += 20) {
    const batch = titles.slice(i, i + 20);
    let cont = {};
    do {
      const d = await mediawikiGet(API, {
        action: 'query', prop: 'revisions|categories|info|images', rvprop: 'content', rvslots: 'main', cllimit: 'max', imlimit: 'max', redirects: '1', titles: batch.join('|'), ...cont,
      });
      for (const r of d.query?.redirects ?? []) redirect.set(r.from, r.to);
      for (const p of d.query?.pages ?? []) {
        const prev = out.get(p.title) ?? { text: '', cats: [], images: [], length: 0 };
        prev.text = p.revisions?.[0]?.slots?.main?.content ?? prev.text;
        prev.length = p.length ?? prev.length;
        prev.cats.push(...(p.categories ?? []).map((c) => c.title.replace(/^Category:/, '')));
        prev.images.push(...(p.images ?? []).map((f) => f.title.replace(/^File:/, '')));
        out.set(p.title, prev);
      }
      cont = d.continue ?? null;
    } while (cont);
    await sleep(300);
  }
  return { out, redirect };
}

/** The parameters of the first {{Npcbox}}, split on top-level pipes. */
function infobox(text) {
  const start = text.search(/\{\{\s*Npcbox/i);
  if (start < 0) return null;
  let depth = 0;
  let i = start;
  for (; i < text.length; i++) {
    if (text.startsWith('{{', i) || text.startsWith('[[', i)) (depth++, i++);
    else if (text.startsWith('}}', i) || text.startsWith(']]', i)) {
      depth--;
      i++;
      if (depth === 0) break;
    }
  }
  const body = text.slice(start + 2, i - 1);
  const params = {};
  let d = 0;
  let cur = '';
  const parts = [];
  for (let k = 0; k < body.length; k++) {
    const two = body.slice(k, k + 2);
    if (two === '{{' || two === '[[') (d++, (cur += two), k++);
    else if (two === '}}' || two === ']]') (d--, (cur += two), k++);
    else if (body[k] === '|' && d === 0) (parts.push(cur), (cur = ''));
    else cur += body[k];
  }
  parts.push(cur);
  for (const p of parts.slice(1)) {
    const eq = p.indexOf('=');
    if (eq > 0) params[p.slice(0, eq).trim().toLowerCase()] = p.slice(eq + 1).trim();
  }
  return params;
}

/** A field as plain text: no refs, comments, templates or markup; links become their label. */
function plain(raw = '') {
  return raw
    .replace(/<ref[^>]*\/>|<ref[^>]*>[\s\S]*?<\/ref>|<!--[\s\S]*?-->/g, '')
    .replace(/\{\{[^{}]*\}\}/g, '')
    .replace(/\[\[(?:[^\]|]*\|)?([^\]]*)\]\]/g, '$1')
    .replace(/'''?/g, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .trim();
}

const firstLine = (raw) => plain(raw).split(/\n|,|;| \/ /).map((s) => s.trim()).filter(Boolean)[0] ?? '';

const CLASSES = ['Death knight', 'Demon hunter', 'Warrior', 'Paladin', 'Hunter', 'Rogue', 'Priest', 'Shaman', 'Mage', 'Warlock', 'Monk', 'Druid', 'Evoker'];
/** Warcraft III and lore classes, mapped onto the closest World of Warcraft class. */
const CLASS_MAP = [
  [/ranger|sniper|marksman/i, 'Hunter'], [/keeper of the grove|archdruid/i, 'Druid'], [/priestess|oracle|prophet/i, 'Priest'],
  [/mountain king|blademaster|gladiator|gryphon rider|knight$|champion/i, 'Warrior'], [/far ?seer|shadow hunter|witch doctor|spiritwalker|earthbinder/i, 'Shaman'],
  [/archmage|wizard|sorcer|magister|blood mage|sea witch|kirin tor/i, 'Mage'], [/necromancer|necrolyte|dreadlord|warlock/i, 'Warlock'],
  [/warden|assassin|spy|thief|outlaw|subtlety/i, 'Rogue'], [/brewmaster|windwalker|monk/i, 'Monk'], [/tinker|engineer|inventor/i, 'Engineer'],
];

function className(raw) {
  const text = plain(raw);
  if (!text) return 'None';
  // The first World of Warcraft class named wins; Warcraft III lines ("{{WC3-inline}} Far seer") come after.
  const lines = text.split('\n');
  for (const line of lines) {
    const hit = CLASSES.map((c) => [c, line.toLowerCase().indexOf(c.toLowerCase())]).filter(([, i]) => i >= 0).sort((a, b) => a[1] - b[1])[0];
    if (hit) return hit[0].replace(/^\w|\s\w/g, (s) => s.toUpperCase());
  }
  for (const [re, name] of CLASS_MAP) if (re.test(text)) return name;
  return 'None';
}

function statusOf(raw) {
  const all = (raw ?? '').toLowerCase();
  const s = plain(raw).toLowerCase();
  if (/undead|banshee|risen/.test(s)) return 'Undead';
  if (/deceased|defunct|killable|defeated/.test(s)) return 'Deceased';
  // "Active {{Sl-inline}}": met in the Shadowlands, the afterlife.
  if (/sl-inline/.test(all)) return 'Deceased';
  if (/^imprisoned/.test(s)) return 'Imprisoned';
  if (/alive|active|reincarnating/.test(s)) return 'Alive';
  return 'Unknown';
}

function factionOf(raw) {
  const f = firstLine(raw);
  if (/^alliance/i.test(f)) return 'Alliance';
  if (/^horde/i.test(f)) return 'Horde';
  if (/^(combat|boss|hostile)/i.test(f)) return 'Hostile';
  return 'Neutral';
}

/** Race families, so the Classic column compares like with like ("Mag'har orc" is an orc). */
const RACE_FAMILY = [
  [/dragon|drake|wyrm|aspect/i, 'Dragon'], [/forsaken|darkfallen|lich|abomination|val'kyr|undead|banshee|crypt lord|death knight/i, 'Undead'],
  [/nathrezim|eredar|demon|dreadlord|pit lord|man'ari|annihilan|satyr/i, 'Demon'], [/old god/i, 'Old God'], [/elemental/i, 'Elemental'],
  [/kyrian|venthyr|maldraxxi|night fae|eternal one|jailer/i, 'Eternal One'], [/titan/i, 'Titan'], [/^void|void entity/i, 'Void'],
  [/blood elf|high elf|void elf|quel'dorei|sin'dorei/i, 'Blood elf'], [/night elf|highborne|nightborne|kaldorei/i, 'Night elf'],
  [/draenei|broken|lost one|lightforged draenei/i, 'Draenei'], [/troll/i, 'Troll'], [/orc|mok'nathal/i, 'Orc'], [/dwarf/i, 'Dwarf'], [/human|arathi/i, 'Human'],
  [/naga/i, 'Naga'], [/ogre/i, 'Ogre'], [/loa/i, 'Loa'], [/mogu/i, 'Mogu'], [/tauren/i, 'Tauren'], [/goblin/i, 'Goblin'], [/gnome/i, 'Gnome'],
  [/pandaren/i, 'Pandaren'], [/worgen/i, 'Worgen'], [/gnoll/i, 'Gnoll'],
];
/** Where the infobox gives today's form rather than the one players know. */
const RACE_OVERRIDE = { 'Uther the Lightbringer': 'Human', Vashj: 'Naga', 'Lady Vashj': 'Naga', Draka: 'Orc', 'Sylvanas Windrunner': 'Undead', 'Garona Halforcen': 'Orc', Turalyon: 'Human' };

function raceOf(title, p) {
  if (RACE_OVERRIDE[title]) return RACE_OVERRIDE[title];
  const r = firstLine(p.race || p.races || '').replace(/\s*\(.*$/, '');
  const fam = RACE_FAMILY.find(([re]) => re.test(r));
  return fam ? fam[1] : r ? r[0].toUpperCase() + r.slice(1) : 'Unknown';
}

// ── PNG transparency check ─────────────────────────────────────────────────────────

/** Decodes an 8-bit RGBA, non-interlaced PNG into its alpha channel (null for other formats). */
function pngAlpha(buf) {
  if (buf.readUInt32BE(0) !== 0x89504e47) return null;
  let pos = 8;
  let w = 0, h = 0, depth = 0, type = 0, interlace = 0;
  const idat = [];
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos);
    const kind = buf.toString('ascii', pos + 4, pos + 8);
    const data = buf.subarray(pos + 8, pos + 8 + len);
    if (kind === 'IHDR') [w, h, depth, type, interlace] = [data.readUInt32BE(0), data.readUInt32BE(4), data[8], data[9], data[12]];
    if (kind === 'IDAT') idat.push(data);
    pos += 12 + len;
  }
  if (depth !== 8 || type !== 6 || interlace) return null;
  const raw = inflateSync(Buffer.concat(idat));
  const bpp = 4;
  const stride = w * bpp;
  const px = Buffer.alloc(stride * h);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)];
    const line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? px[y * stride + x - bpp] : 0;
      const b = y > 0 ? px[(y - 1) * stride + x] : 0;
      const c = x >= bpp && y > 0 ? px[(y - 1) * stride + x - bpp] : 0;
      let v = line[x];
      if (f === 1) v += a;
      else if (f === 2) v += b;
      else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) {
        const p = a + b - c;
        const [pa, pb, pc] = [Math.abs(p - a), Math.abs(p - b), Math.abs(p - c)];
        v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      px[y * stride + x] = v & 255;
    }
  }
  return { w, h, alpha: (x, y) => px[y * stride + x * 4 + 3] };
}

/** A cut-out: a clear border, and a figure covering a sensible share of the picture. */
function isCutout(png) {
  if (!png) return false;
  const { w, h, alpha } = png;
  let edge = 0, edgeClear = 0, clear = 0;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const a = alpha(x, y);
      if (a < 16) clear++;
      if (x === 0 || y === 0 || x === w - 1 || y === h - 1) (edge++, a < 16 && edgeClear++);
    }
  const share = clear / (w * h);
  return edgeClear / edge > 0.8 && share > 0.2 && share < 0.88;
}

const GENERIC_WORD = /^(Lady|Lord|King|Queen|Prince|Princess|Archmage|Grand|High|Baron|Overlord|Farseer|Vindicator|Sunwalker|Professor|Emperor|Magister|Trade|Blood|General)$/;
// Items (a "chest" piece), toys, mounts and fan art share the character's name but not their outline.
// Whole words only, so "Doomhammer" and "Fandral" aren't caught by "hammer" and "fan".
const BAD_FILE =
  /TCG|card|icon|spray|name_card|tankard|statue|logo|loading|screenshot|banner|wallpaper|cinematic|promo|concept|sketch|mural|comic|ow2|overwatch|diablo|_us-|deviant|(map|chest|helm|shoulders?|gauntlets|belt|boots|sword|blade|axe|hammer|staff|plush|toy|pet|fan|tabard|cloak)/i;
/**
 * Better renders first: unmounted Warcraft III Reforged, Warcraft Rumble, then in-game models; painted
 * art ("… art.png") has soft edges that blur the silhouette, so it comes last.
 */
const fileRank = (f) => (/ art\.png$/i.test(f) ? 5 : /mountless/i.test(f) ? 0 : /reforged/i.test(f) ? 1 : /\bWR\b|rumble/i.test(f) ? 2 : /render|model|tactics/i.test(f) ? 3 : 4);

async function imageInfo(files, width) {
  const out = new Map();
  for (let i = 0; i < files.length; i += 50) {
    const d = await mediawikiGet(API, { action: 'query', prop: 'imageinfo', iiprop: 'url|size|mime', iiurlwidth: String(width), titles: files.slice(i, i + 50).map((f) => `File:${f}`).join('|') });
    const back = new Map((d.query?.normalized ?? []).map((n) => [n.to, n.from]));
    for (const p of d.query?.pages ?? []) {
      const ii = p.imageinfo?.[0];
      if (ii) out.set((back.get(p.title) ?? p.title).replace(/^File:/, ''), { url: ii.thumburl ?? ii.url, width: ii.width, height: ii.height, mime: ii.mime });
    }
    await sleep(250);
  }
  return out;
}

/** PNG files whose name starts with `prefix`. */
async function filesNamed(prefix) {
  const d = await mediawikiGet(API, { action: 'query', list: 'allimages', aiprefix: prefix, aimime: 'image/png', ailimit: '200' });
  return (d.query?.allimages ?? []).map((i) => i.name.replace(/_/g, ' '));
}

/** The first candidate PNG that really is a cut-out: files on the page, then files named after the character. */
/** Renders checked by eye and found wrong (fan art, another character, a costume). */
const REJECTED_RENDERS = new Set(["Kael'thas TheFairfield.png", 'Garona us-uriahworld.png', 'Blackhand chest.png']);

/** First words of every chosen character's name, to skip files that show someone else too ("Drek'Thar Rehgar"). */
let otherKeys = [];

async function findRender(name, aliases, pageFiles) {
  // Files go by any of the names ("Grom Hellscream Reforged"), so each spelling's first word is a key.
  const firstWords = [name, ...aliases].map((n) => n.split(/[ ,]/)[0]).filter((w) => w.length >= 4 && !GENERIC_WORD.test(w));
  const keys = [...new Set(firstWords.map((w) => w.toLowerCase().replace(/'/g, '')))];
  const named = [];
  for (const prefix of new Set([name, ...firstWords])) named.push(...(await filesNamed(prefix)));
  const files = [...new Set([...pageFiles, ...named])];
  const flat = (f) => f.toLowerCase().replace(/'/g, '');
  // A key is a word start ("Orgrim" in "Orgrim Doomhammer Hood" or "OrgrimDoomhammer"), not a longer name ("Orgrimmar").
  const startsWord = (f, k) => new RegExp(`(^|[^a-z])${k}(?![a-z]{2,}(\\.png|[ _-]))`).test(flat(f));
  const others = otherKeys.filter((k) => !keys.includes(k));
  const candidates = files
    .filter((f) => /\.png$/i.test(f) && !BAD_FILE.test(f) && !REJECTED_RENDERS.has(f.replace(/_/g, ' ')))
    .filter((f) => keys.some((k) => startsWord(f, k)) && !others.some((k) => startsWord(f, k)))
    .sort((a, b) => fileRank(a) - fileRank(b))
    .slice(0, 10);
  if (!candidates.length) return undefined;
  const info = await imageInfo(candidates, 360);
  for (const f of candidates) {
    const ii = info.get(f);
    if (!ii || ii.height < ii.width * 0.6) continue;
    try {
      const res = await fetch(ii.url, { headers: { 'User-Agent': 'OmnidleDataScripts/0.2 (https://github.com/Emilezola0/DlesMania)' } });
      if (res.ok && isCutout(pngAlpha(Buffer.from(await res.arrayBuffer())))) return ii.url;
    } catch {}
    await sleep(150);
  }
  return undefined;
}

// ── Build ────────────────────────────────────────────────────────────────────────

console.log('▶ candidates');
const weight = new Map();
const add = (t, w) => weight.set(t, (weight.get(t) ?? 0) + w);
for (const [cat, w] of Object.entries(SEEDS)) for (const t of await categoryPages(cat)) add(t, w);
const official = await mediawikiGet(API, { action: 'query', list: 'allpages', apprefix: 'The Characters of Warcraft/', aplimit: '500' });
for (const p of official.query.allpages) add(p.title.split('/')[1], OFFICIAL);
for (const t of MUST) add(t, 100);
console.log(`  ${weight.size} pages`);

const { out: info, redirect } = await pages([...weight.keys()]);
// Merge the weights of redirects ("Archmage Khadgar" → "Khadgar").
const score = new Map();
for (const [t, w] of weight) {
  const to = redirect.get(t) ?? t;
  score.set(to, (score.get(to) ?? 0) + w);
}

const ranked = [];
for (const [title, w] of score) {
  const p = info.get(title);
  if (!p || SKIP.has(title)) continue;
  const box = infobox(p.text);
  if (!box) continue;
  // In the games: at least one World of Warcraft zone, dungeon or raid category.
  // (Hand-picked ones skip this: lore pages like Ner'zhul's keep their in-game versions on other pages.)
  if (!MUST.includes(title) && !p.cats.some((c) => / (NPCs|mobs|bosses)$/.test(c))) continue;
  ranked.push({ title, p, box, score: w + p.length / 30000 });
}
ranked.sort((a, b) => b.score - a.score);
const chosen = ranked.slice(0, SIZE);
otherKeys = [...new Set(chosen.map(({ title }) => title.split(/[ ,]/)[0]).filter((w) => w.length >= 4 && !GENERIC_WORD.test(w)).map((w) => w.toLowerCase().replace(/'/g, '')))];
console.log(`  ${ranked.length} in the games; keeping ${chosen.length} (last: ${chosen.at(-1)?.title}, score ${chosen.at(-1)?.score.toFixed(1)})`);

console.log('▶ pictures');
const artFiles = chosen.map(({ box }) => plain(box.image ?? '').replace(/^File:/i, '') || (box.slides ?? '').match(/File:([^{|\n]+?\.(?:png|jpe?g))/i)?.[1]).map((f) => f?.trim());
const small = await imageInfo(artFiles.filter(Boolean), 160);
const big = await imageInfo(artFiles.filter(Boolean), 700);

const characters = [];
const taken = new Map();
for (const [i, { title, p, box }] of chosen.entries()) {
  const names = plain(box.name ?? title).split(/\n|\//).map((s) => s.replace(/[()]/g, '').trim()).filter(Boolean);
  const aliases = [...new Set([...names, ...(EXTRA_ALIASES[title] ?? [])])].filter((n) => n !== title && n.split(' ').length <= 4);
  // A one-word given name is accepted too ("Jaina", "Thrall"), unless another character shares it.
  const given = title.split(' ')[0];
  if (title.includes(' ') && given.length >= 4 && !/^(The|Headless|Lady|Lord|King|Queen|Prince|Princess|Archmage|Grand|High|Sir|Baron|Overlord|Farseer|Vindicator|Sunwalker|Professor|Blood-Queen|Emperor|Magister|Wardruid|Tinkmaster|Lorewalker|Archbishop|Trade)$/.test(given)) aliases.push(given);
  const art = artFiles[i];
  const titles = plain(box.titles ?? '')
    .split(/\n|,/)
    .map((s) => s.replace(/\s+/g, ' ').trim())
    .filter((s) => s && !/^(formerly|see more|see below)/i.test(s) && !s.endsWith(':') && s.length < 48);
  const render = await findRender(title, aliases, p.images);
  const c = {
    id: title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
    name: title,
    aliases: [...new Set(aliases)],
    image: small.get(art)?.url,
    art: big.get(art)?.url,
    render,
    gender: /female/i.test(plain(box.gender)) ? 'Female' : /male/i.test(plain(box.gender)) ? 'Male' : 'Unknown',
    race: raceOf(title, box),
    faction: factionOf(box.faction),
    class: className(box.character),
    status: statusOf(box.status),
    titles: [...new Set(titles)].slice(0, 6),
    // First game they appeared in (index in `games`), hand-written in scripts/data/wow-debuts.mjs.
    debut: WOW_DEBUT[title],
  };
  for (const n of [c.name, ...c.aliases].map((n) => n.toLowerCase())) {
    if (taken.has(n) && taken.get(n) !== c.id) {
      // Two characters answering to the same short name: neither keeps it.
      const other = characters.find((x) => x.id === taken.get(n));
      if (other) other.aliases = other.aliases.filter((a) => a.toLowerCase() !== n);
      c.aliases = c.aliases.filter((a) => a.toLowerCase() !== n);
    } else taken.set(n, c.id);
  }
  characters.push(c);
  if ((i + 1) % 20 === 0) console.log(`  ${i + 1}/${chosen.length}`);
}

const missing = (k) => characters.filter((c) => !c[k]).map((c) => c.name);
console.log(`  no image: ${missing('image').join(', ') || '-'}\n  no render: ${missing('render').length} (${missing('render').slice(0, 30).join(', ')}…)`);
mkdirSync(join(ROOT, 'src', 'data', 'specialist'), { recursive: true });
writeFileSync(OUT, JSON.stringify({ generated: new Date().toISOString().slice(0, 10), games: WOW_GAMES, characters }, null, 2) + '\n');
console.log(`✓ ${OUT}: ${characters.length} characters, ${characters.filter((c) => c.render).length} with a render`);
