#!/usr/bin/env node
// Builds src/data/silhouettes.json for the "Who's That?" game: per series, a roster of entries
// with names (English, French and nicknames are all accepted) and a picture with a transparent
// background, so blacking it out leaves a recognisable silhouette.
//
//   node scripts/build-silhouettes.mjs [--series=pokemon]
//   node scripts/build-silhouettes.mjs --apply=choices.json   (pictures picked by the in-browser transparency check)
//
// Sources: Pokémon — PokeAPI (names in English/French, official artwork); League of Legends — Data
// Dragon champion list + "<Champion> Render.png" on the League wiki; Minecraft — the mob pages'
// renders on the Minecraft wiki; Genshin Impact — official portraits (white background, cut out at
// play time); One Piece — game renders (Thousand Storm first) on the One Piece wiki.
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, fandomApi, getJson, mediawikiGet, mediawikiImages, parseArgs, sleep } from './lib.mjs';

const { flags } = parseArgs();
const FILE = join(ROOT, 'src', 'data', 'silhouettes.json');
const SIZE = 360;

const MINECRAFT = [
  ['Creeper'], ['Zombie'], ['Skeleton', ['Squelette']], ['Spider', ['Araignée']], ['Enderman'], ['Slime'], ['Witch', ['Sorcière']], ['Ghast'], ['Blaze'],
  ['Pig', ['Cochon']], ['Cow', ['Vache']], ['Sheep', ['Mouton']], ['Chicken', ['Poule', 'Poulet']], ['Horse', ['Cheval']], ['Wolf', ['Loup']], ['Cat', ['Chat']],
  ['Ocelot'], ['Rabbit', ['Lapin']], ['Fox', ['Renard']], ['Panda'], ['Parrot', ['Perroquet']], ['Turtle', ['Tortue']], ['Llama', ['Lama']], ['Bee', ['Abeille']],
  ['Axolotl'], ['Frog', ['Grenouille']], ['Goat', ['Chèvre']], ['Camel', ['Dromadaire', 'Chameau']], ['Sniffer', ['Renifleur']], ['Allay'], ['Iron Golem', ['Golem de fer']],
  ['Snow Golem', ['Golem de neige']], ['Villager', ['Villageois']], ['Wandering Trader', ['Marchand ambulant']], ['Pillager', ['Pillard']], ['Vindicator', ['Vindicateur']],
  ['Evoker', ['Évocateur']], ['Ravager', ['Ravageur']], ['Guardian', ['Gardien']], ['Elder Guardian', ['Grand gardien']], ['Shulker'], ['Phantom', ['Fantôme']],
  ['Drowned', ['Noyé']], ['Husk', ['Zombie momifié']], ['Stray', ['Vagabond']], ['Wither Skeleton', ['Squelette wither']], ['Magma Cube', ['Cube de magma']],
  ['Piglin'], ['Hoglin'], ['Strider', ['Arpenteur']], ['Zoglin'], ['Warden'], ['Wither'], ['Ender Dragon', ["Dragon de l'Ender", 'Ender dragon']], ['Squid', ['Poulpe', 'Calamar']],
  ['Glow Squid', ['Poulpe luisant']], ['Dolphin', ['Dauphin']], ['Polar Bear', ['Ours polaire']], ['Mooshroom', ['Champimeuh']], ['Bat', ['Chauve-souris']],
  ['Silverfish', ["Poisson d'argent"]], ['Endermite'], ['Armadillo', ['Tatou']], ['Breeze'], ['Vex', ['Vexeur']], ['Zombie Villager', ['Villageois zombie']],
];

// [name, aliases (French names and nicknames), file-name key on the One Piece wiki]
const ONE_PIECE = [
  // Straw Hats and allies
  ['Monkey D. Luffy', ['Luffy', 'Mugiwara'], 'Luffy'], ['Roronoa Zoro', ['Zoro', 'Zorro'], 'Zoro'], ['Nami', [], 'Nami'], ['Usopp', ['Pipo'], 'Usopp'], ['Sanji', [], 'Sanji'],
  ['Tony Tony Chopper', ['Chopper'], 'Chopper'], ['Nico Robin', ['Robin'], 'Robin'], ['Franky', [], 'Franky'], ['Brook', [], 'Brook'], ['Jinbe', ['Jinbei', 'Jimbei'], 'Jinbe'],
  ['Nefertari Vivi', ['Vivi'], 'Vivi'], ['Carrot', [], 'Carrot'], ['Yamato', [], 'Yamato'], ['Kozuki Momonosuke', ['Momonosuke', 'Momo'], 'Momonosuke'], ['Kaya', [], 'Kaya'],
  ['Zeff', [], 'Zeff'], ['Koala', [], 'Koala'], ['Sabo', [], 'Sabo'], ['Portgas D. Ace', ['Ace'], 'Ace'], ['Monkey D. Dragon', ['Dragon'], 'Dragon'],
  ['Emporio Ivankov', ['Ivankov', 'Iva'], 'Ivankov'], ['Inazuma', [], 'Inazuma'], ['Bon Clay', ['Mr. 2', 'Bentham'], 'Bentham'], ['Bartolomeo', [], 'Bartolomeo'],
  ['Cavendish', [], 'Cavendish'], ['Kyros', [], 'Kyros'], ['Rebecca', [], 'Rebecca'], ['Pedro', [], 'Pedro'], ['Wiper', [], 'Wiper'], ['Neptune', [], 'Neptune'],
  ['Shirahoshi', [], 'Shirahoshi'], ['Silvers Rayleigh', ['Rayleigh'], 'Rayleigh'], ['Shakky', ['Shakuyaku'], 'Shakky'],
  // Wano
  ['Kozuki Oden', ['Oden'], 'Oden'], ["Kin'emon", ['Kinemon'], "Kin'emon"], ['Kikunojo', ['Kiku'], 'Kikunojo'], ['Kanjuro', [], 'Kanjuro'], ['Denjiro', [], 'Denjiro'],
  ['Shinobu', [], 'Shinobu'], ['Kozuki Hiyori', ['Hiyori'], 'Hiyori'], ['Kurozumi Orochi', ['Orochi'], 'Orochi'],
  // Emperors and their crews
  ['Shanks', ['Le Roux', 'Red-Haired Shanks'], 'Shanks'], ['Benn Beckman', ['Beckman'], 'Beckman'], ['Lucky Roux', ['Lucky Roo'], 'Lucky Roux'], ['Yasopp', [], 'Yasopp'],
  ['Uta', [], 'Uta'], ['Edward Newgate', ['Whitebeard', 'Barbe Blanche'], 'Whitebeard'], ['Marco', [], 'Marco'], ['Jozu', [], 'Jozu'], ['Vista', [], 'Vista'], ['Izo', [], 'Izo'],
  ['Kaido', ['Kaidou'], 'Kaido'], ['King', [], 'King'], ['Queen', [], 'Queen'], ['Jack', [], 'Jack'], ['Ulti', [], 'Ulti'],
  ['Charlotte Linlin', ['Big Mom', 'Linlin'], 'Big Mom'], ['Charlotte Katakuri', ['Katakuri'], 'Katakuri'], ['Charlotte Cracker', ['Cracker'], 'Cracker'],
  ['Charlotte Smoothie', ['Smoothie'], 'Smoothie'], ['Charlotte Perospero', ['Perospero'], 'Perospero'], ['Charlotte Pudding', ['Pudding'], 'Pudding'], ['Pekoms', [], 'Pekoms'],
  ['Marshall D. Teach', ['Blackbeard', 'Barbe Noire', 'Teach'], 'Blackbeard'], ['Jesus Burgess', ['Burgess'], 'Burgess'], ['Shiryu', [], 'Shiryu'], ['Van Augur', ['Augur'], 'Augur'],
  ['Laffitte', [], 'Laffitte'], ['Catarina Devon', ['Devon'], 'Devon'], ['Avalo Pizarro', ['Pizarro'], 'Pizarro'], ['Gol D. Roger', ['Roger', 'Gold Roger'], 'Roger'],
  // Supernovas and other pirates
  ['Trafalgar Law', ['Law', 'Trafalgar D. Water Law'], 'Law'], ['Bepo', [], 'Bepo'], ['Eustass Kid', ['Kid', 'Kidd'], 'Kid'], ['Killer', [], 'Killer'],
  ['Basil Hawkins', ['Hawkins'], 'Hawkins'], ['X Drake', ['Drake'], 'Drake'], ['Scratchmen Apoo', ['Apoo'], 'Apoo'], ['Jewelry Bonney', ['Bonney'], 'Bonney'],
  ['Capone Bege', ['Bege'], 'Bege'], ['Urouge', [], 'Urouge'], ['Boa Hancock', ['Hancock'], 'Hancock'], ['Dracule Mihawk', ['Mihawk', 'Œil de Faucon'], 'Mihawk'],
  ['Crocodile', [], 'Crocodile'], ['Daz Bonez', ['Mr. 1', 'Daz Bones'], 'Daz'], ['Galdino', ['Mr. 3'], 'Galdino'], ['Donquixote Doflamingo', ['Doflamingo'], 'Doflamingo'],
  ['Trebol', [], 'Trebol'], ['Sugar', [], 'Sugar'], ['Vergo', [], 'Vergo'], ['Monet', [], 'Monet'], ['Caesar Clown', ['Caesar'], 'Caesar'], ['Gecko Moria', ['Moria'], 'Moria'],
  ['Perona', [], 'Perona'], ['Absalom', [], 'Absalom'], ['Bartholomew Kuma', ['Kuma'], 'Kuma'], ['Buggy', ['Baggy'], 'Buggy'], ['Alvida', [], 'Alvida'], ['Kuro', [], 'Kuro'],
  ['Don Krieg', ['Krieg'], 'Krieg'], ['Gin', [], 'Gin'], ['Arlong', [], 'Arlong'], ['Hachi', ['Hatchan'], 'Hachi'], ['Hody Jones', ['Hody'], 'Hody'], ['Wapol', [], 'Wapol'],
  ['Enel', ['Ener', 'Eneru'], 'Enel'], ['Foxy', [], 'Foxy'], ['Gild Tesoro', ['Tesoro'], 'Tesoro'], ['Shiki', [], 'Shiki'], ['Douglas Bullet', ['Bullet'], 'Bullet'],
  // Marines, government and Egghead
  ['Monkey D. Garp', ['Garp'], 'Garp'], ['Sengoku', [], 'Sengoku'], ['Tsuru', [], 'Tsuru'], ['Sakazuki', ['Akainu'], 'Akainu'], ['Kuzan', ['Aokiji'], 'Aokiji'],
  ['Borsalino', ['Kizaru'], 'Kizaru'], ['Issho', ['Fujitora'], 'Fujitora'], ['Aramaki', ['Ryokugyu'], 'Ryokugyu'], ['Smoker', [], 'Smoker'], ['Tashigi', [], 'Tashigi'],
  ['Koby', ['Coby', 'Kobby'], 'Koby'], ['Helmeppo', [], 'Helmeppo'], ['Hina', [], 'Hina'], ['Zephyr', ['Z'], 'Zephyr'], ['Magellan', [], 'Magellan'], ['Hannyabal', [], 'Hannyabal'],
  ['Rob Lucci', ['Lucci'], 'Lucci'], ['Kaku', [], 'Kaku'], ['Jabra', [], 'Jabra'], ['Spandam', [], 'Spandam'], ['Stussy', [], 'Stussy'], ['Sentomaru', [], 'Sentomaru'],
  ['Vegapunk', [], 'Vegapunk'], ['Vinsmoke Reiju', ['Reiju'], 'Reiju'], ['Vinsmoke Judge', ['Judge'], 'Judge'], ['Nefertari Cobra', ['Cobra'], 'Cobra'],
];

/**
 * Game renders on the One Piece wiki, best first. Thousand Storm has the biggest roster and clean
 * cut-outs (transparent, no outline); the others are fallbacks. Bounty Rush renders carry a glow
 * outline that shows as a doubled edge in the silhouette, and Pirate Warriors ones are painted on
 * brush strokes, so neither is used.
 */
const RENDER_GAMES = ['Thousand Storm', 'World Seeker', 'Burning Will', 'Unlimited World Red', 'Burning Blood'];

// Holiday and one-off costumes change the outline: kept only as a last resort.
const COSTUME = /_(new_year|halloween|christmas|valentine|swimsuit|summer|child|kid_version)_/i;
const gameRank = (n) => RENDER_GAMES.findIndex((g) => n.toLowerCase().endsWith(`_${g.replace(/ /g, '_')}.png`.toLowerCase()));

/** Render files named "<key>_[<variant>_]<game>.png". */
async function onePieceRenders(key) {
  const d = await mediawikiGet(fandomApi('onepiece'), { action: 'query', list: 'allimages', aiprefix: key, ailimit: '500' });
  const prefix = key.replace(/ /g, '_').toLowerCase();
  return (d.query?.allimages ?? []).map((i) => i.name).filter((n) => n.toLowerCase().startsWith(`${prefix}_`) && gameRank(n) >= 0);
}

/**
 * Candidate renders for a character, best first: regular outfits before costumes, then by game,
 * then files found under the fuller spelling ("Monkey_D._Dragon_…" before "Dragon_…", which may be
 * something else), then the plainest (shortest) name. `--apply` later keeps the first that really
 * has a transparent background.
 */
async function onePieceCandidates(spellings) {
  const found = new Map();
  for (const [i, k] of spellings.entries()) {
    for (const n of await onePieceRenders(k)) if (!found.has(n)) found.set(n, i);
    await sleep(250);
  }
  const score = (n) => [COSTUME.test(n) ? 1 : 0, gameRank(n), found.get(n), n.length];
  return [...found.keys()].sort((a, b) => {
    const [x, y] = [score(a), score(b)];
    const i = x.findIndex((v, k) => v !== y[k]);
    return i < 0 ? 0 : x[i] - y[i];
  });
}

/** Image URLs for up to five candidate files. */
async function fileUrls(files) {
  const titles = files.slice(0, 5).map((n) => `File:${n}`);
  if (!titles.length) return [];
  const info = await mediawikiGet(fandomApi('onepiece'), { action: 'query', prop: 'imageinfo', iiprop: 'url', iiurlwidth: String(SIZE), titles: titles.join('|') });
  const norm = new Map((info.query?.normalized ?? []).map((n) => [n.to, n.from]));
  const byTitle = new Map((info.query?.pages ?? []).map((p) => [norm.get(p.title) ?? p.title, p.imageinfo?.[0]?.thumburl]));
  return titles.map((t) => byTitle.get(t) ?? byTitle.get(t.replace(/_/g, ' '))).filter(Boolean);
}

/** Image URLs for "File:<name> Render.png" on the League wiki, 50 at a time. */
async function lolRenders(names) {
  const out = new Map();
  for (let i = 0; i < names.length; i += 50) {
    const batch = names.slice(i, i + 50);
    const d = await mediawikiGet(fandomApi('leagueoflegends'), {
      action: 'query', prop: 'imageinfo', iiprop: 'url', iiurlwidth: String(SIZE), titles: batch.map((n) => `File:${n} Render.png`).join('|'),
    });
    const norm = new Map((d.query?.normalized ?? []).map((n) => [n.to, n.from]));
    for (const p of d.query?.pages ?? []) {
      const url = p.imageinfo?.[0]?.thumburl;
      const asked = norm.get(p.title) ?? p.title;
      if (url) out.set(asked.replace(/^File:/, '').replace(/ Render\.png$/, ''), url);
    }
    await sleep(800);
  }
  return out;
}

async function pokemon() {
  const entries = [];
  for (let id = 1; id <= 151; id++) {
    const s = await getJson(`https://pokeapi.co/api/v2/pokemon-species/${id}`);
    const en = s.names.find((n) => n.language.name === 'en')?.name ?? s.name;
    const fr = s.names.find((n) => n.language.name === 'fr')?.name;
    entries.push({ name: en, aliases: fr && fr !== en ? [fr] : [], image: `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${id}.png` });
    if (id % 25 === 0) console.log(`  pokémon ${id}/151`);
  }
  return entries;
}

async function league() {
  const version = (await getJson('https://ddragon.leagueoflegends.com/api/versions.json'))[0];
  const champs = Object.values((await getJson(`https://ddragon.leagueoflegends.com/cdn/${version}/data/en_US/champion.json`)).data);
  const names = champs.map((c) => c.name);
  const renders = await lolRenders(names);
  return champs
    .map((c) => {
      // A few wiki files use the champion's short name ("Nunu" for Nunu & Willump).
      const image = renders.get(c.name) ?? renders.get(c.id);
      const aliases = [c.id !== c.name.replace(/[^A-Za-z]/g, '') ? c.id : null, c.name.includes('&') ? c.name.split('&')[0].trim() : null].filter(Boolean);
      return { name: c.name, aliases, image };
    })
    .filter((e) => e.image);
}

async function minecraft() {
  const res = await mediawikiImages(fandomApi('minecraft'), MINECRAFT.map(([n]) => n), SIZE);
  return MINECRAFT.map(([name, aliases = []]) => ({ name, aliases, image: res.get(name)?.image })).filter((e) => e.image);
}

async function onePiece() {
  const entries = [];
  for (const [name, aliases, key] of ONE_PIECE) {
    // File names use whichever name the game uses ("Sakazuki", "Akainu"...): try every spelling, full name first.
    const ranked = await onePieceCandidates([...new Set([name, key, ...aliases])]);
    const [image, ...alts] = await fileUrls(ranked);
    if (image) entries.push({ name, aliases, image, ...(alts.length ? { alts } : {}) });
    else console.log(`  ✗ one piece: no render for ${name}`);
    await sleep(400);
  }
  return entries;
}

/** Genshin Impact: the Specialist data's official portraits (built by build-specialist-genshin.mjs). */
async function genshin() {
  const data = JSON.parse(readFileSync(join(ROOT, 'src', 'data', 'specialist', 'genshin.json'), 'utf8'));
  return data.characters.filter((c) => c.portrait).map((c) => ({ name: c.name, aliases: c.aliases, image: c.portrait }));
}

const SERIES = [
  { id: 'lol', domain: 'games', label: 'League of Legends', noun: 'champion', build: league },
  { id: 'minecraft', domain: 'games', label: 'Minecraft', noun: 'mob', build: minecraft },
  { id: 'pokemon', domain: 'anime', label: 'Pokémon', noun: 'Pokémon', build: pokemon },
  { id: 'onepiece', domain: 'anime', label: 'One Piece', noun: 'character', build: onePiece },
  // Portraits sit on white: the game cuts the background away before blacking them out.
  { id: 'genshin', domain: 'games', label: 'Genshin Impact', noun: 'character', cutout: true, build: genshin },
];

let data = [];
try {
  data = JSON.parse(readFileSync(FILE, 'utf8'));
} catch {}

if (flags.apply) {
  // { seriesId: { entryName: chosenUrl | null } } from the in-browser pixel check: null drops the entry.
  const choices = JSON.parse(readFileSync(flags.apply, 'utf8'));
  for (const s of data) {
    const pick = choices[s.id] ?? {};
    s.entries = s.entries
      .filter((e) => pick[e.name] !== null)
      .map(({ alts, ...e }) => ({ ...e, image: pick[e.name] ?? e.image }));
    console.log(`${s.id}: ${s.entries.length} entries`);
  }
  writeFileSync(FILE, JSON.stringify(data, null, 2) + '\n');
  process.exit(0);
}

for (const s of SERIES) {
  if (flags.series && flags.series !== s.id) continue;
  console.log(`▶ ${s.label}`);
  const entries = await s.build();
  const { build, ...meta } = s;
  data = [...data.filter((d) => d.id !== s.id), { ...meta, entries }];
  console.log(`  ${entries.length} entries`);
}
data.sort((a, b) => SERIES.findIndex((s) => s.id === a.id) - SERIES.findIndex((s) => s.id === b.id));
writeFileSync(FILE, JSON.stringify(data, null, 2) + '\n');
