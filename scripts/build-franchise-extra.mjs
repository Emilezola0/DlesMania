// More to play with, for the franchises whose games had the least (no new cards: games only): characters
// and numbers from each franchise's open data, into src/data/extra.json.
//   Harry Potter — HP-API (hp-api.onrender.com): house, blood status, wand, patronus, actor.
//   Star Wars — akabab's Star Wars API (akabab.github.io/starwars-api, from the Star Wars wiki): species,
//     homeworld, height, affiliations, masters and apprentices.
//   Naruto — Dattebayo API (dattebayo-api.onrender.com, from the Narutopedia): clan, village, natures,
//     rank, kekkei genkai, height; the best-known characters only (the most techniques and facts).
//   Dragon Ball — Dragon Ball API (dragonball-api.com): race, affiliation, home planet, max ki, transformations.
//   Minecraft — PrismarineJS minecraft-data (Java 1.20): mobs and their kind, foods and the hunger they
//     fill, blocks and how hard they are; textures from PrismarineJS minecraft-assets.
//   NODE_USE_ENV_PROXY=1 NODE_EXTRA_CA_CERTS=/root/.ccr/ca-bundle.crt node scripts/build-franchise-extra.mjs
import { writeFileSync } from 'node:fs';

const OUT = new URL('../src/data/extra.json', import.meta.url);
const get = async (url) => {
  for (let i = 0; i < 4; i++) {
    try {
      const r = await fetch(url);
      if (r.ok) return r.json();
    } catch {
      // Tried again below.
    }
    await new Promise((ok) => setTimeout(ok, 2000 * 2 ** i));
  }
  throw new Error(`no answer from ${url}`);
};
const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);
/** A field that's sometimes one value, sometimes a list. */
const arr = (x) => [x ?? []].flat();
const clean = (s) => String(s ?? '').replace(/\s*\(.*?\)\s*/g, ' ').replace(/\s+/g, ' ').trim();

// ── Harry Potter ──
const hp = (await get('https://hp-api.onrender.com/api/characters'))
  .map((c) => ({
    name: c.name,
    aliases: c.alternate_names.filter((a) => a && a.length < 30).slice(0, 3),
    house: c.house || '',
    species: cap(c.species),
    gender: cap(c.gender),
    ancestry: cap(c.ancestry),
    patronus: cap(c.patronus),
    wand: [c.wand.wood && `${c.wand.wood} wood`, c.wand.core, c.wand.length && `${c.wand.length}″`].filter(Boolean).join(', '),
    wandLength: c.wand.length || 0,
    actor: c.actor || '',
    alive: c.alive,
    role: c.hogwartsStudent ? 'Hogwarts student' : c.hogwartsStaff ? 'Hogwarts staff' : '',
    born: c.yearOfBirth || 0,
    image: c.image || '',
  }))
  // Someone with enough known about them to be found.
  .filter((c) => [c.house, c.ancestry, c.patronus, c.wand, c.actor, c.role].filter(Boolean).length >= 3);

// ── Star Wars ──
const sw = (await get('https://akabab.github.io/starwars-api/api/all.json')).map((c) => ({
  name: c.name,
  image: c.image || '',
  species: cap(c.species ?? ''),
  homeworld: cap(Array.isArray(c.homeworld) ? c.homeworld[0] : c.homeworld ?? ''),
  gender: cap(c.gender ?? ''),
  height: c.height ? Math.round(c.height * 100) : 0,
  mass: typeof c.mass === 'number' ? c.mass : 0,
  born: typeof c.born === 'number' ? (c.born < 0 ? `${-c.born} BBY` : `${c.born} ABY`) : '',
  affiliations: (c.affiliations ?? []).slice(0, 4),
  masters: [c.masters ?? []].flat().slice(0, 3),
  apprentices: [c.apprentices ?? []].flat().slice(0, 3),
}));

// ── Naruto ──
const naruto = (await get('https://dattebayo-api.onrender.com/characters?page=1&limit=1500')).characters
  .filter((c) => c.images?.length && c.personal)
  .map((c) => {
    const p = c.personal;
    const last = (x) => (x && typeof x === 'object' && !Array.isArray(x) ? Object.values(x).at(-1) : x);
    const cm = Number(String(p.height?.['Part II'] ?? last(p.height) ?? '').replace(/[^\d.].*$/, '')) || 0;
    return {
      name: c.name,
      image: c.images.at(-1),
      fame: arr(c.jutsu).length + arr(c.tools).length + (c.family ? Object.keys(c.family).length : 0) + arr(p.classification).length * 2,
      sex: p.sex ?? '',
      clan: clean(arr(p.clan)[0]),
      village: clean(arr(p.affiliation)[0]),
      affiliations: arr(p.affiliation).map(clean),
      natures: arr(c.natureType).map(clean).filter((n) => !/Yin|Yang/.test(n)).slice(0, 3),
      rank: clean(last(c.rank?.ninjaRank)),
      kekkeiGenkai: arr(p.kekkeiGenkai).map(clean).slice(0, 2),
      classification: arr(p.classification).map(clean).slice(0, 3),
      team: clean(arr(p.team)[0]),
      occupation: arr(p.occupation).map(clean),
      height: cm,
    };
  })
  .filter((c) => c.sex && (c.village || c.clan))
  .sort((a, b) => b.fame - a.fame)
  .slice(0, 150);

// ── Dragon Ball ──
// The API's Spanish names, as the English dub and the rest of the site call them.
const PLANETS = { Tierra: 'Earth', Namek: 'Namek', Vegeta: 'Planet Vegeta', 'Planeta Vegeta': 'Planet Vegeta', 'Freezer No. 79': 'Planet Frieza No. 79', 'Kaiō del Norte': "King Kai's planet", 'Nucleo del Mundo': 'the Core World', 'Otro Mundo': 'Other World', 'Planeta de Bills': "Beerus's planet", 'Planeta del Gran Kaio': "Grand Kai's planet", 'Planeta sagrado': 'the Sacred World of the Kai', 'Templo móvil del Rey de Todo': "the Omni-King's palace", 'Universo 11': 'Universe 11', Desconocido: '' };
const NAMES = { Freezer: ['Frieza', 'Freezer'], Celula: ['Cell'], Ginyu: ['Captain Ginyu', 'Ginyu'], Tenshinhan: ['Tien', 'Tenshinhan', 'Tien Shinhan'], 'Mr. Satan': ['Mr. Satan', 'Hercule'], Bills: ['Beerus', 'Bills'], Zeno: ['Zeno', 'Zen-Oh', 'Omni-King'], 'Kibito-Shin': ['Kibito Kai'], Vermoudh: ['Belmod', 'Vermoud'], 'Kaio del norte (Kaito)': ['King Kai', 'North Kai'], 'Kaio del Sur': ['South Kai'], 'Kaio del este': ['East Kai'], 'Kaio del Oeste': ['West Kai'], 'Gran Kaio': ['Grand Kai'], 'Kaio-shin del Este': ['East Supreme Kai', 'Shin'], 'Kaio-shin del Norte': ['North Supreme Kai'], 'Kaio-shin del Sur': ['South Supreme Kai'], 'Kaio-shin del Oeste': ['West Supreme Kai'], 'Gran Kaio-shin': ['Grand Supreme Kai'], 'Android 20 (Dr. Gero)': ['Android 20', 'Dr. Gero'], Vegetto: ['Vegito', 'Vegetto'], 'Grand Priest': ['Grand Priest', 'Daishinkan'] };
const RACES = { Nucleico: 'Core Person', 'Nucleico benigno': 'Core Person', Unknown: '' };
const SCALE = { thousand: 1e3, million: 1e6, billion: 1e9, trillion: 1e12, quadrillion: 1e15, quintillion: 1e18, sextillion: 1e21, septillion: 1e24, octillion: 1e27, nonillion: 1e30, decillion: 1e33, googolplex: 1e100 };
const kiValue = (s) => {
  const m = String(s).toLowerCase().match(/([\d.,]+)\s*([a-z]+)?/);
  if (!m) return 0;
  const n = Number(m[1].replace(/\./g, '').replace(',', '.'));
  return m[2] && SCALE[m[2]] ? Number(m[1].replace(',', '.')) * SCALE[m[2]] : n;
};
const dbList = (await get('https://dragonball-api.com/api/characters?limit=100')).items;
const dbz = [];
for (const c of dbList) {
  const d = await get(`https://dragonball-api.com/api/characters/${c.id}`);
  const [name, ...aliases] = NAMES[c.name.trim()] ?? [c.name.trim()];
  const planet = d.originPlanet?.name?.trim() ?? '';
  dbz.push({
    name,
    aliases,
    image: c.image,
    race: RACES[c.race] ?? c.race,
    gender: c.gender,
    affiliation: c.affiliation,
    // The API puts a Kai or two on Planet Vegeta: left out.
    planet: RACES[c.race] === 'Core Person' && PLANETS[planet] === 'Planet Vegeta' ? '' : (PLANETS[planet] ?? planet),
    maxKi: c.maxKi,
    maxKiValue: kiValue(c.maxKi),
    transformations: (d.transformations ?? []).length,
  });
}

// ── Minecraft ──
const MC = 'https://raw.githubusercontent.com/PrismarineJS/minecraft-data/master/data/pc/1.20';
const TEX = 'https://raw.githubusercontent.com/PrismarineJS/minecraft-assets/master/data/1.20.2';
const mobs = (await get(`${MC}/entities.json`)).filter((e) => e.type === 'mob' || /mobs/i.test(e.category ?? '')).map((e) => ({ name: e.displayName, kind: (e.category ?? '').replace(/ mobs?$/i, '') })).filter((m) => m.kind && !/unknown/i.test(m.kind));
const foods = (await get(`${MC}/foods.json`)).map((f) => ({ name: f.displayName, hunger: f.foodPoints, saturation: f.saturation, image: `${TEX}/items/${f.name}.png` }));
// Blocks: one of each (no colours, stairs, slabs or walls), breakable by hand or tool.
const blocks = (await get(`${MC}/blocks.json`))
  .filter((b) => b.diggable && b.hardness > 0 && b.hardness < 100 && !/(stairs|slab|wall|fence|button|pressure_plate|sign|banner|bed|carpet|candle|glass_pane|_wool|terracotta|concrete|shulker|potted|wall_|_door|trapdoor|coral|leaves|sapling|head|skull|infested)/.test(b.name) && !/^(white|orange|magenta|light_blue|yellow|lime|pink|gray|light_gray|cyan|purple|blue|brown|green|red|black)_/.test(b.name))
  .map((b) => ({ name: b.displayName, hardness: b.hardness, image: `${TEX}/blocks/${b.name}.png` }));

writeFileSync(OUT, JSON.stringify({ source: 'HP-API, akabab Star Wars API, Dattebayo API, Dragon Ball API, PrismarineJS minecraft-data', harrypotter: hp, starwars: sw, naruto, dbz, minecraft: { mobs, foods, blocks } }) + '\n');
console.log(`Harry Potter ${hp.length} · Star Wars ${sw.length} · Naruto ${naruto.length} · Dragon Ball ${dbz.length} · Minecraft ${mobs.length} mobs, ${foods.length} foods, ${blocks.length} blocks`);
