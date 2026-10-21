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
// renders on the Minecraft wiki; One Piece — Bounty Rush renders on the One Piece wiki.
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

// [name, aliases, search key for the Bounty Rush render]
const ONE_PIECE = [
  ['Monkey D. Luffy', ['Luffy', 'Mugiwara'], 'Luffy'], ['Roronoa Zoro', ['Zoro', 'Zorro'], 'Zoro'], ['Nami', [], 'Nami'], ['Usopp', ['Pipo'], 'Usopp'], ['Sanji', [], 'Sanji'],
  ['Tony Tony Chopper', ['Chopper'], 'Chopper'], ['Nico Robin', ['Robin'], 'Robin'], ['Franky', [], 'Franky'], ['Brook', [], 'Brook'], ['Jinbe', ['Jinbei', 'Jimbei'], 'Jinbe'],
  ['Shanks', ['Le Roux', 'Red-Haired Shanks'], 'Shanks'], ['Portgas D. Ace', ['Ace'], 'Ace'], ['Sabo', [], 'Sabo'], ['Trafalgar Law', ['Law', 'Trafalgar D. Water Law'], 'Law'],
  ['Boa Hancock', ['Hancock'], 'Hancock'], ['Dracule Mihawk', ['Mihawk', 'Œil de Faucon'], 'Mihawk'], ['Crocodile', [], 'Crocodile'], ['Donquixote Doflamingo', ['Doflamingo'], 'Doflamingo'],
  ['Kaido', ['Kaidou'], 'Kaido'], ['Charlotte Linlin', ['Big Mom', 'Linlin'], 'Big Mom'], ['Edward Newgate', ['Whitebeard', 'Barbe Blanche'], 'Whitebeard'],
  ['Marshall D. Teach', ['Blackbeard', 'Barbe Noire', 'Teach'], 'Blackbeard'], ['Buggy', ['Baggy'], 'Buggy'], ['Smoker', [], 'Smoker'], ['Tashigi', [], 'Tashigi'], ['Koby', ['Coby'], 'Koby'],
  ['Monkey D. Garp', ['Garp'], 'Garp'], ['Sengoku', [], 'Sengoku'], ['Sakazuki', ['Akainu'], 'Akainu'], ['Kuzan', ['Aokiji'], 'Aokiji'], ['Borsalino', ['Kizaru'], 'Kizaru'],
  ['Issho', ['Fujitora'], 'Fujitora'], ['Enel', ['Eneru'], 'Enel'], ['Rob Lucci', ['Lucci'], 'Lucci'], ['Eustass Kid', ['Kid', 'Kidd'], 'Kid'], ['Killer', [], 'Killer'], ['Marco', [], 'Marco'],
  ['Yamato', [], 'Yamato'], ['Charlotte Katakuri', ['Katakuri'], 'Katakuri'], ['Bartholomew Kuma', ['Kuma'], 'Kuma'], ['Gecko Moria', ['Moria'], 'Moria'], ['Perona', [], 'Perona'],
  ['Bon Clay', ['Mr. 2', 'Bentham'], 'Bon Clay'], ['Nefertari Vivi', ['Vivi'], 'Vivi'], ['Carrot', [], 'Carrot'], ['Kozuki Oden', ['Oden'], 'Oden'],
  ['Silvers Rayleigh', ['Rayleigh'], 'Rayleigh'], ['Gol D. Roger', ['Roger', 'Gold Roger'], 'Roger'], ['King', [], 'King'], ['Queen', [], 'Queen'], ['Uta', [], 'Uta'],
  ['Shirahoshi', [], 'Shirahoshi'], ['Arlong', [], 'Arlong'], ['Caesar Clown', ['Caesar'], 'Caesar'], ['Rebecca', [], 'Rebecca'], ["Kin'emon", ['Kinemon'], "Kin'emon"],
  ['Kozuki Hiyori', ['Hiyori'], 'Hiyori'], ['Bepo', [], 'Bepo'], ['Sentomaru', [], 'Sentomaru'], ['Vegapunk', [], 'Vegapunk'],
];

/** Game renders on the One Piece wiki have transparent backgrounds; Bounty Rush ones first. */
// (Pirate Warriors renders are painted on brush strokes, so they black out into blocks.)
const RENDER_GAMES = ['Bounty Rush', 'Super Grand Battle X', 'Puzzle and Dragons', 'Burning Blood', 'World Seeker', 'Unlimited World Red'];

/**
 * Candidate renders for a character, plainest first (the default costume tends to have the
 * shortest file name). Some uploads are in-game screenshots rather than cut-outs, so several are
 * kept: `--apply` later picks the first one that really has a transparent background.
 */
async function bountyRush(key) {
  const urls = [];
  for (const game of RENDER_GAMES) {
    urls.push(...(await gameRenders(key, game)));
    if (urls.length >= 10) break;
  }
  return urls.slice(0, 10);
}

async function gameRenders(key, game) {
  const d = await mediawikiGet(fandomApi('onepiece'), {
    action: 'query', list: 'search', srnamespace: '6', srlimit: '20', srsearch: `${key} ${game}`,
  });
  const ending = new RegExp(`${game}\\.png$`, 'i');
  const titles = (d.query?.search ?? []).map((s) => s.title).filter((t) => ending.test(t) && t.toLowerCase().includes(key.toLowerCase()));
  titles.sort((a, b) => a.length - b.length);
  if (!titles.length) return [];
  const info = await mediawikiGet(fandomApi('onepiece'), { action: 'query', prop: 'imageinfo', iiprop: 'url', iiurlwidth: String(SIZE), titles: titles.slice(0, 4).join('|') });
  const byTitle = new Map((info.query?.pages ?? []).map((p) => [p.title, p.imageinfo?.[0]?.thumburl]));
  return titles.slice(0, 4).map((t) => byTitle.get(t)).filter(Boolean);
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
    // File names use whichever name the game uses ("Kuzan", "Aokiji"...): try each in turn.
    let found = [];
    for (const k of [...new Set([key, ...aliases, name, name.split(' ').pop()])]) {
      found = await bountyRush(k);
      if (found.length) break;
      await sleep(300);
    }
    const [image, ...alts] = found;
    if (image) entries.push({ name, aliases, image, ...(alts.length ? { alts } : {}) });
    else console.log(`  ✗ one piece: no Bounty Rush render for ${name}`);
    await sleep(500);
  }
  return entries;
}

const SERIES = [
  { id: 'lol', domain: 'games', label: 'League of Legends', noun: 'champion', build: league },
  { id: 'minecraft', domain: 'games', label: 'Minecraft', noun: 'mob', build: minecraft },
  { id: 'pokemon', domain: 'anime', label: 'Pokémon', noun: 'Pokémon', build: pokemon },
  { id: 'onepiece', domain: 'anime', label: 'One Piece', noun: 'character', build: onePiece },
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
