// Builds src/data/specialist/arcraiders.json from the ARC Raiders Wiki (arcraiders.wiki, MediaWiki API):
// the ARC machines, the weapons and equipment, the places, the containers ("furniture"), the materials and
// the crafting recipes, each with the wiki's picture (linked, at a small thumbnail size).
// The robot sounds are timed stretches of a YouTube video that labels each ARC on screen (see SOUNDS).
//   node scripts/build-specialist-arcraiders.mjs
import { writeFileSync } from 'node:fs';

const API = 'https://arcraiders.wiki/w/api.php';
const UA = 'OmnidleBot/1.0 (fan site data builder)';
const OUT = new URL('../src/data/specialist/arcraiders.json', import.meta.url);

async function api(params) {
  const url = `${API}?${new URLSearchParams({ format: 'json', ...params })}`;
  for (let i = 0; i < 4; i++) {
    const r = await fetch(url, { headers: { 'User-Agent': UA } });
    if (r.ok) return r.json();
    await new Promise((res) => setTimeout(res, 1500 * (i + 1)));
  }
  throw new Error(`API failed: ${url}`);
}

async function members(category) {
  const out = [];
  let cont;
  do {
    const d = await api({ action: 'query', list: 'categorymembers', cmtitle: `Category:${category}`, cmlimit: '500', ...(cont ? { cmcontinue: cont } : {}) });
    out.push(...d.query.categorymembers.filter((m) => m.ns === 0 || m.ns === 6).map((m) => m.title));
    cont = d.continue?.cmcontinue;
  } while (cont);
  return out;
}

async function embedding(template) {
  const out = [];
  let cont;
  do {
    const d = await api({ action: 'query', list: 'embeddedin', eititle: `Template:${template}`, eilimit: '500', einamespace: '0', ...(cont ? { eicontinue: cont } : {}) });
    out.push(...d.query.embeddedin.map((m) => m.title));
    cont = d.continue?.eicontinue;
  } while (cont);
  return out;
}

/** Wikitext of pages, by title. */
async function wikitext(titles) {
  const out = new Map();
  for (let i = 0; i < titles.length; i += 40) {
    const d = await api({ action: 'query', prop: 'revisions', rvprop: 'content', rvslots: 'main', titles: titles.slice(i, i + 40).join('|'), redirects: '1' });
    for (const p of Object.values(d.query.pages)) if (p.revisions) out.set(p.title, p.revisions[0].slots.main['*']);
  }
  return out;
}

/** Thumbnail URLs of files (400 px wide), by file name. */
async function thumbs(files) {
  const out = new Map();
  const names = [...new Set(files.filter(Boolean))];
  for (let i = 0; i < names.length; i += 40) {
    const d = await api({ action: 'query', prop: 'imageinfo', iiprop: 'url|size', iiurlwidth: '400', titles: names.slice(i, i + 40).map((n) => `File:${n}`).join('|') });
    const norm = new Map((d.query.normalized ?? []).map((n) => [n.to, n.from]));
    for (const p of Object.values(d.query.pages)) {
      const info = p.imageinfo?.[0];
      if (!info) continue;
      const name = (norm.get(p.title) ?? p.title).replace(/^File:/, '');
      out.set(name, info.width > 400 ? info.thumburl : info.url);
      out.set(p.title.replace(/^File:/, ''), info.width > 400 ? info.thumburl : info.url);
    }
  }
  return out;
}

/** The fields of the first {{Infobox …}} of a page. */
function infobox(text) {
  const m = text.match(/\{\{Infobox[^|]*([\s\S]*?)\n\}\}/);
  const fields = {};
  if (!m) return fields;
  for (const line of m[1].split('\n')) {
    const f = line.match(/^\s*\|\s*([\w-]+)\s*=\s*(.*)$/);
    if (f) fields[f[1]] = f[2].trim();
  }
  return fields;
}

const clean = (s = '') =>
  s
    .replace(/<!--.*?-->/g, '')
    .replace(/<br\s*\/?>/gi, ' / ')
    .replace(/\[\[(?:[^|\]]*\|)?([^\]]*)\]\]/g, '$1')
    .replace(/'''?/g, '')
    .replace(/\{\{[^}]*\}\}/g, '')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim();

const fileName = (s = '') => clean(s).replace(/^File:/i, '').trim();
const isPage = (t) => !/^(User|Template|Category|File):/.test(t);

// ── ARC machines ──
const arcTitles = (await embedding('Infobox arc')).filter(isPage);
const arcText = await wikitext(arcTitles);
const arcs = [];
for (const [title, text] of arcText) {
  const f = infobox(text);
  arcs.push({
    name: clean(f.name) || title,
    image: fileName(f.image),
    icon: fileName(f.icon),
    armor: clean(f.armor),
    attack: clean(f.pAttack),
    weakness: clean(f.weakness),
    health: clean(f.health),
  });
}
// Extra pictures of the machines: the codex's ("ARC Wasp.png", "Wasp Codex.png").
const codexFiles = (await members('ARC codex images')).map((t) => t.replace(/^File:/, ''));

// ── Weapons and equipment ──
const GEAR = [
  ['Weapons', 'Weapon'],
  ['Shields', 'Shield'],
  ['Augments', 'Augment'],
  ['Grenades', 'Grenade'],
  ['Gadgets', 'Gadget'],
  ['Traps', 'Trap'],
  ['Quick Use', 'Quick use'],
  ['Utilities', 'Utility'],
];
const gearKind = new Map();
for (const [cat, kind] of GEAR) for (const t of (await members(cat)).filter(isPage)) if (!gearKind.has(t)) gearKind.set(t, kind);
const gearText = await wikitext([...gearKind.keys()]);
const gear = [];
for (const [title, text] of gearText) {
  const f = infobox(text);
  if (!f.image) continue;
  gear.push({ name: clean(f.name) || title, kind: gearKind.get(title) ?? 'Equipment', rarity: clean(f.rarity), type: clean(f.type), image: fileName(f.image) });
}

// ── Places: the maps (banner, codex and overview pictures) and the places found on every map ──
const mapTitles = (await embedding('Infobox map')).filter(isPage);
const locTitles = (await members('Map Locations')).filter(isPage);
const placeText = await wikitext([...mapTitles, ...locTitles, 'Speranza']);
const places = [];
const pictures = [];
for (const [title, text] of placeText) {
  const f = infobox(text);
  const files = [fileName(f.image), ...[...text.matchAll(/^File:([^|\n]+\.(?:png|jpe?g|webp))/gim)].map((m) => m[1].trim()), ...[...text.matchAll(/\[\[File:([^|\]]+\.(?:png|jpe?g|webp))/gi)].map((m) => m[1].trim())].filter(
    (x) => x && !/icon|blank|key\.png|^Map\b/i.test(x),
  );
  const name = clean(f.name) || title;
  places.push({ name, kind: mapTitles.includes(title) ? 'Map' : title === 'Speranza' ? 'Settlement' : 'On every map' });
  for (const file of new Set(files)) pictures.push({ answer: name, image: file });
}
for (const f of await members('Map codex images')) {
  const file = f.replace(/^File:/, '');
  const map = { 'Acerra Spaceport Codex.png': 'Spaceport', 'Alcantara Dam Codex.png': 'Dam Battlegrounds', 'Buried City Codex.png': 'Buried City', 'Riven Tides Codex.png': 'Riven Tides', 'The Blue Gate Codex.png': 'The Blue Gate' }[file];
  if (map && !pictures.some((p) => p.image === file)) pictures.push({ answer: map, image: file });
}
for (const f of await members('Map banner images')) {
  const file = f.replace(/^File:/, '');
  const map = { 'Blue Gate.png': 'The Blue Gate' }[file] ?? file.replace(/\.png$/, '');
  if (places.some((p) => p.name === map) && !pictures.some((p) => p.image === file)) pictures.push({ answer: map, image: file });
}

// ── Furniture: the containers you search (husks and ARC things left out: they're machines, not furniture) ──
const containerTitles = (await embedding('Infobox container')).filter(isPage).filter((t) => !/Husk|^ARC |Harvester|Android|Bird Nest|Supply Drop|Raider Cache|First Wave Cache|Backpack/.test(t));
const containerText = await wikitext(containerTitles);
const furniture = [];
for (const [title, text] of containerText) {
  const f = infobox(text);
  if (f.image) furniture.push({ name: clean(f.name) || title, image: fileName(f.image) });
}

// ── Materials ──
const matKind = new Map();
for (const [cat, kind] of [
  ['Basic Material', 'Basic'],
  ['Refined Material', 'Refined'],
  ['Topside Material', 'Topside'],
])
  for (const t of (await members(cat)).filter(isPage)) matKind.set(t, kind);
const matText = await wikitext([...matKind.keys()]);
const materials = [];
for (const [title, text] of matText) {
  const f = infobox(text);
  if (f.image) materials.push({ name: clean(f.name) || title, kind: matKind.get(title), rarity: clean(f.rarity), image: fileName(f.image) });
}

// ── Crafting recipes: every {{Crafting}} — what it takes and where; tiers past I left out (the same item, upgraded) ──
const craftTitles = (await embedding('Crafting')).filter(isPage);
const craftText = await wikitext(craftTitles);
const recipes = [];
const pageImage = new Map();
for (const [title, text] of craftText) {
  pageImage.set(title, fileName(infobox(text).image));
  for (const m of text.matchAll(/\{\{Crafting\s*([\s\S]*?)\n\}\}/g)) {
    const f = {};
    for (const line of m[1].split('\n')) {
      const x = line.match(/^\s*\|\s*([\w-]+)\s*=\s*(.*)$/);
      if (x) f[x[1]] = clean(x[2]);
    }
    f.result ||= title;
    if (!f.ingredients) continue;
    if (/\s(II|III|IV|V)$/.test(f.result) || /Blueprint$/.test(f.result) || /Research Station/.test(f.station ?? '')) continue;
    const name = f.result.replace(/\s+I$/, '');
    if (recipes.some((r) => r.name === name)) continue;
    recipes.push({ name, ingredients: f.ingredients.split(/\s*\+\s*/).filter(Boolean), station: f.station ?? '', page: title });
  }
}

// ── Robot sounds: "Every ARC Sound in ARC Raiders" (nixdigital), each ARC named on screen; [ARC, start (s), length (s)] ──
const SOUND_VIDEO = 'TiQBdG-sNw0';
const SOUND_LENGTH = 112.021;
const SOUNDS = [
  ['Tick', 2.5, 3.5], ['Pop', 7, 4], ['Fireball', 13, 4], ['ARC Surveyor', 18, 3], ['Spotter', 22, 4], ['Snitch', 27, 3], ['Wasp', 31, 4], ['Hornet', 37, 4],
  ['Shredder', 43, 4], ['Turret', 48, 2.5], ['Sentinel', 51.5, 4], ['Leaper', 58, 5], ['Rocketeer', 67, 4], ['Bombardier', 73, 4], ['Bastion', 79, 4], ['Queen', 85, 5], ['Matriarch', 95, 6],
];

// ── Pictures ──
const allFiles = [...arcs.flatMap((a) => [a.image, a.icon]), ...codexFiles, ...gear.map((g) => g.image), ...pictures.map((p) => p.image), ...furniture.map((f) => f.image), ...materials.map((m) => m.image), ...pageImage.values()];
const url = await thumbs(allFiles);
const pic = (f) => url.get(f) ?? url.get(f?.replace(/_/g, ' ')) ?? '';

// The codex's pictures of each machine ("ARC Wasp.png", "Wasp Codex.png": the wiki's "ARC codex images").
const codexOf = (name) => codexFiles.filter((f) => f === `ARC ${name}.png` || f === `${name} Codex.png` || f === `ARC ${name} Codex.png`);
const data = {
  generated: new Date().toISOString().slice(0, 10),
  arcs: arcs
    .map((a) => ({ ...a, image: pic(a.image), icon: pic(a.icon), pictures: [...new Set([a.image, ...codexOf(a.name)])].map(pic).filter(Boolean) }))
    .filter((a) => a.image)
    .sort((a, b) => a.name.localeCompare(b.name)),
  gear: gear
    .map((g) => ({ ...g, image: pic(g.image) }))
    .filter((g) => g.image)
    .sort((a, b) => a.name.localeCompare(b.name)),
  places: places.sort((a, b) => a.name.localeCompare(b.name)),
  placePictures: pictures.map((p) => ({ ...p, image: pic(p.image) })).filter((p) => p.image),
  furniture: furniture
    .map((f) => ({ ...f, image: pic(f.image) }))
    .filter((f) => f.image)
    .sort((a, b) => a.name.localeCompare(b.name)),
  materials: materials
    .map((m) => ({ ...m, image: pic(m.image) }))
    .filter((m) => m.image)
    .sort((a, b) => a.name.localeCompare(b.name)),
  // Only recipes no other item shares (Light, Medium and Shotgun Ammo take the same): one answer each.
  recipes: recipes
    .filter((r, _, all) => all.filter((o) => o.ingredients.join('+') === r.ingredients.join('+')).length === 1)
    .map(({ page, ...r }) => ({ ...r, image: pic(pageImage.get(page)) }))
    .sort((a, b) => a.name.localeCompare(b.name)),
  sounds: SOUNDS.map(([answer, start, seconds]) => ({ answer, youtubeId: SOUND_VIDEO, at: start / SOUND_LENGTH, seconds })),
};
writeFileSync(OUT, `${JSON.stringify(data, null, 1)}\n`);
console.log(Object.fromEntries(Object.entries(data).map(([k, v]) => [k, Array.isArray(v) ? v.length : v])));
