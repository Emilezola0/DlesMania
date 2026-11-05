// Builds src/data/specialist/deadlock.json from The Deadlock Wiki (deadlock.wiki, MediaWiki API): the heroes
// (Data:HeroData.json, the infobox's pronouns and release date, the hero card art), their four abilities and
// their icons, the shop's items (Data:ItemData.json) and a few of each hero's own voice lines (the hero page's
// quotation, then lines that name no one: pings and item buys). Pictures and sounds are linked from the wiki's CDN.
//   node scripts/build-specialist-deadlock.mjs
import { writeFileSync } from 'node:fs';

const API = 'https://deadlock.wiki/api.php';
const CDN = 'https://cdn.deadlock.wiki/';
const UA = 'OmnidleBot/1.0 (fan site data builder)';
const OUT = new URL('../src/data/specialist/deadlock.json', import.meta.url);

async function api(params) {
  const url = `${API}?${new URLSearchParams({ format: 'json', ...params })}`;
  for (let i = 0; i < 4; i++) {
    const r = await fetch(url, { headers: { 'User-Agent': UA } });
    if (r.ok) return r.json();
    await new Promise((res) => setTimeout(res, 1500 * (i + 1)));
  }
  throw new Error(`API failed: ${url}`);
}
async function pages(titles) {
  const out = new Map();
  for (let i = 0; i < titles.length; i += 40) {
    const d = await api({ action: 'query', prop: 'revisions', rvprop: 'content', rvslots: 'main', titles: titles.slice(i, i + 40).join('|') });
    for (const p of Object.values(d.query.pages)) if (p.revisions) out.set(p.title, p.revisions[0].slots.main['*']);
  }
  return out;
}
async function members(category, ns) {
  const out = [];
  let cont;
  do {
    const d = await api({ action: 'query', list: 'categorymembers', cmtitle: `Category:${category}`, cmlimit: '500', ...(ns !== undefined ? { cmnamespace: String(ns) } : {}), ...(cont ? { cmcontinue: cont } : {}) });
    out.push(...d.query.categorymembers.map((m) => m.title));
    cont = d.continue?.cmcontinue;
  } while (cont);
  return out;
}
/** Which of these files exist on the wiki. */
async function existing(files) {
  const out = new Set();
  for (let i = 0; i < files.length; i += 40) {
    const d = await api({ action: 'query', prop: 'imageinfo', iiprop: 'size', titles: files.slice(i, i + 40).map((f) => `File:${f}`).join('|') });
    for (const p of Object.values(d.query.pages)) if (p.imageinfo) out.add(p.title.replace(/^File:/, '').replace(/ /g, '_'));
  }
  return out;
}
const file = (name) => name.replace(/ /g, '_');
const cdn = (name) => CDN + encodeURI(file(name)).replace(/'/g, '%27').replace(/&/g, '%26');

const json = async (title) => JSON.parse((await pages([title])).get(title));
const HERO_DATA = await json('Data:HeroData.json');
const ITEM_DATA = await json('Data:ItemData.json');

// ── Heroes: the playable ones, as the wiki's Heroes category lists them ──
const names = (await members('Heroes', 0)).filter((t) => !/^(Heroes|User:)/.test(t));
const heroText = await pages(names);
const byName = new Map(Object.values(HERO_DATA).filter((h) => h.Name).map((h) => [h.Name, h]));
const GENDER = { he: 'Male', she: 'Female', they: 'Other' };
const heroes = [];
for (const name of names) {
  const h = byName.get(name);
  const text = heroText.get(name) ?? '';
  if (!h || h.IsDisabled) continue;
  const pronouns = (text.match(/\|\s*pronouns\s*=\s*([^\n|]*)/)?.[1] ?? '').trim().toLowerCase();
  const year = Number(text.match(/\|\s*release_date\s*=\s*[^\n]*?(\d{4})/)?.[1] ?? 0);
  const quotes = [...text.matchAll(/\{\{Quotation\|2=([^|}]*)\|4=([^|}]*\.mp3)/g)].map((m) => ({ text: m[1].trim(), file: m[2].trim() }));
  heroes.push({
    name,
    gender: GENDER[pronouns.split('/')[0]] ?? (pronouns.includes('they') ? 'Other' : 'Unknown'),
    type: h.Type ?? '',
    health: h.MaxHealth,
    speed: h.MaxMoveSpeed,
    stamina: h.Stamina,
    clip: h.Weapon?.ClipSize ?? 0,
    pellets: h.Weapon?.BulletsPerShot ?? 1,
    year,
    abilities: Object.entries(h.BoundAbilities ?? {})
      .sort(([a], [b]) => Number(a) - Number(b))
      .map(([slot, a]) => ({ name: a.Name, slot: Number(slot) })),
    quotes,
  });
}

// Voice lines: the quotation, then up to four lines that name no one (pings, buys), per hero.
const VOICE_OK = /_(ping_affermative|ping_attack_(?:guardian|walker|shrine|base|patron)?|ping_defend|upgrade_power\d*|purchase_\w+|ping_retreat|ping_going|ping_on_my_way)[_\d]*\.mp3$/i;
for (const h of heroes) {
  const all = (await members(`${h.name} voice lines`, 6)).map((t) => t.replace(/^File:/, '').replace(/ /g, '_'));
  const extra = all.filter((f) => VOICE_OK.test(f) && !h.quotes.some((q) => file(q.file) === f));
  // Spread out: one of each kind first.
  const kinds = new Map();
  for (const f of extra) {
    const k = f.replace(/[_\d]*\.mp3$/i, '');
    if (!kinds.has(k)) kinds.set(k, f);
  }
  h.voices = [...h.quotes.map((q) => ({ file: file(q.file), text: q.text })), ...[...kinds.values()].slice(0, 4).map((f) => ({ file: f }))].slice(0, 5);
}

// ── Items: the shop's, in their three kinds (event items left out) ──
const SLOT = { Weapon: 'Weapon', Armor: 'Vitality', Tech: 'Spirit' };
const items = Object.values(ITEM_DATA)
  .filter((i) => i.Name && !i.IsDisabled && SLOT[i.Slot] && i.Tier && !/Snowball|Candy/i.test(i.Name))
  .map((i) => ({ name: i.Name, slot: SLOT[i.Slot], tier: i.Tier, cost: i.Cost, active: i.Activation && i.Activation !== 'Passive' }));
// One item per name.
const seenItems = new Set();
const uniqueItems = items.filter((i) => !seenItems.has(i.name) && seenItems.add(i.name));

// ── Pictures: keep only the files that exist ──
const want = [...heroes.map((h) => `${h.name} card.png`), ...heroes.flatMap((h) => h.abilities.map((a) => `${a.name}.png`)), ...uniqueItems.map((i) => `${i.name}.png`)];
const have = await existing(want.map(file));
const pic = (name) => (have.has(file(name)) ? cdn(name) : '');

const data = {
  generated: new Date().toISOString().slice(0, 10),
  heroes: heroes
    .map(({ quotes, ...h }) => ({
      ...h,
      image: pic(`${h.name} card.png`),
      abilities: h.abilities.map((a) => ({ ...a, image: pic(`${a.name}.png`) })),
      voices: h.voices.map((v) => ({ ...v, audio: cdn(v.file) })).map(({ file: _, ...v }) => v),
    }))
    .sort((a, b) => a.name.localeCompare(b.name)),
  items: uniqueItems.map((i) => ({ ...i, image: pic(`${i.name}.png`) })).filter((i) => i.image).sort((a, b) => a.name.localeCompare(b.name)),
};
writeFileSync(OUT, `${JSON.stringify(data, null, 1)}\n`);
console.log({ heroes: data.heroes.length, noCard: data.heroes.filter((h) => !h.image).map((h) => h.name), abilities: data.heroes.reduce((a, h) => a + h.abilities.filter((x) => x.image).length, 0), voices: data.heroes.reduce((a, h) => a + h.voices.length, 0), items: data.items.length });
