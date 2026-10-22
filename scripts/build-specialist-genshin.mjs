#!/usr/bin/env node
// Builds src/data/specialist/genshin.json for the Genshin Impact Specialist mode (and the Who's
// That? and Boss Battle rosters built from it), from the Genshin Impact wiki
// (genshin-impact.fandom.com). Re-run it after each version update.
//
//   node scripts/build-specialist-genshin.mjs
//
// - Characters: Category:Playable Characters (the Traveler's element changes, so it's left out).
//   The {{Character Infobox}} gives rarity, weapon, element, region, affiliation, constellation and
//   title; categories give body type and gender ("Medium Female Characters") and the version.
// - Pictures: the character's icon, full wish art and official portrait ("<Name> Portrait.png",
//   full-body art on white, cut out at play time for silhouettes).
// Only facts and names are kept.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, fandomApi, mediawikiGet, sleep } from './lib.mjs';

const API = fandomApi('genshin-impact');
const OUT = join(ROOT, 'src', 'data', 'specialist', 'genshin.json');

async function categoryPages(category) {
  const out = [];
  let cont = {};
  do {
    const d = await mediawikiGet(API, { action: 'query', list: 'categorymembers', cmtitle: category, cmnamespace: '0', cmlimit: '500', ...cont });
    out.push(...(d.query?.categorymembers ?? []).map((p) => p.title));
    cont = d.continue ?? null;
  } while (cont);
  return out;
}

/** Wikitext and categories of many pages, 25 at a time, following every continuation. */
async function pages(titles) {
  const out = new Map();
  for (let i = 0; i < titles.length; i += 25) {
    const batch = titles.slice(i, i + 25);
    let cont = {};
    do {
      const d = await mediawikiGet(API, { action: 'query', prop: 'revisions|categories', rvprop: 'content', rvslots: 'main', cllimit: 'max', titles: batch.join('|'), ...cont });
      for (const p of d.query?.pages ?? []) {
        const prev = out.get(p.title) ?? { text: '', cats: [] };
        prev.text = p.revisions?.[0]?.slots?.main?.content ?? prev.text;
        prev.cats.push(...(p.categories ?? []).map((c) => c.title.replace(/^Category:/, '')));
        out.set(p.title, prev);
      }
      cont = d.continue ?? null;
    } while (cont);
    await sleep(400);
  }
  return out;
}

/** URLs of many files ("File:X.png"), 50 at a time; missing files are left out. */
async function fileUrls(files, width) {
  const out = new Map();
  for (let i = 0; i < files.length; i += 50) {
    const batch = files.slice(i, i + 50);
    const d = await mediawikiGet(API, { action: 'query', prop: 'imageinfo', iiprop: 'url', iiurlwidth: String(width), titles: batch.map((f) => `File:${f}`).join('|') });
    const back = new Map((d.query?.normalized ?? []).map((n) => [n.to, n.from]));
    for (const p of d.query?.pages ?? []) {
      const url = p.imageinfo?.[0]?.thumburl ?? p.imageinfo?.[0]?.url;
      if (url) out.set((back.get(p.title) ?? p.title).replace(/^File:/, ''), url);
    }
    await sleep(300);
  }
  return out;
}

/** An infobox field's value, without refs, links, templates or comments. */
function field(text, key) {
  const raw = text.match(new RegExp(`\\n\\|\\s*${key}\\s*=([^\\n]*)`))?.[1] ?? '';
  return raw
    .replace(/<ref[^>]*>[\s\S]*?<\/ref>|<ref[^>]*\/>|<!--[\s\S]*?-->/g, '')
    .replace(/\[\[(?:[^\]|]*\|)?([^\]]*)\]\]/g, '$1')
    .replace(/\{\{[^{}]*\}\}/g, '')
    .replace(/<[^>]+>/g, '')
    .trim();
}

console.log('▶ characters');
const titles = (await categoryPages('Category:Playable Characters')).filter((t) => !/^(Traveler|Aether|Lumine|Manekin|Manekina|Wonderland Manekin)$/.test(t));
const info = await pages(titles);
const files = titles.flatMap((t) => [`${t} Icon.png`, `Character ${t} Full Wish.png`, `${t} Portrait.png`]);
const small = await fileUrls(files.filter((f) => f.endsWith(' Icon.png')), 160);
const big = await fileUrls(files.filter((f) => !f.endsWith(' Icon.png')), 700);

const characters = [];
for (const title of titles) {
  const p = info.get(title);
  const element = field(p.text, 'element');
  const weapon = field(p.text, 'weapon');
  if (!element || !weapon || !/Character Infobox/.test(p.text)) {
    console.log(`  ✗ ${title}: no infobox data`);
    continue;
  }
  const body = p.cats.map((c) => c.match(/^(Short|Medium|Tall) (Male|Female) Characters$/)).find(Boolean);
  const version = p.cats.map((c) => c.match(/^Released in Version ([\d.]+)$/)?.[1]).find(Boolean);
  const name = field(p.text, 'name') || title;
  characters.push({
    id: title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
    name: title,
    aliases: [...new Set([name, field(p.text, 'realname')])].filter((n) => n && n !== title && n.split(' ').length <= 4),
    image: small.get(`${title} Icon.png`),
    wish: big.get(`Character ${title} Full Wish.png`),
    // Official full-body art, mostly on white: Who's That? cuts the white away for the silhouette.
    portrait: big.get(`${title} Portrait.png`),
    gender: body?.[2] ?? 'Unknown',
    body: body?.[1] ?? 'Unknown',
    element,
    weapon,
    region: field(p.text, 'region') || 'None',
    rarity: Number(field(p.text, 'quality')) || 4,
    version: version ?? '1.0',
    affiliation: field(p.text, 'affiliation') || 'None',
    constellation: field(p.text, 'constellation') || undefined,
    title: field(p.text, 'title') || undefined,
    released: field(p.text, 'releaseDate') || undefined,
  });
}
// Version order ("1.3" < "4.0" < "5.10"), then release date.
const versionKey = (v) => v.split('.').map((n) => n.padStart(3, '0')).join('.');
characters.sort((a, b) => versionKey(a.version).localeCompare(versionKey(b.version)) || (a.released ?? '').localeCompare(b.released ?? '') || a.name.localeCompare(b.name));
const missing = (k) => characters.filter((c) => !c[k]).map((c) => c.name);
console.log(`  ${characters.length} characters; no icon: ${missing('image').join(', ') || '-'}; no wish: ${missing('wish').join(', ') || '-'}; no portrait: ${missing('portrait').join(', ') || '-'}`);

mkdirSync(join(ROOT, 'src', 'data', 'specialist'), { recursive: true });
writeFileSync(OUT, JSON.stringify({ generated: new Date().toISOString().slice(0, 10), characters }, null, 2) + '\n');
console.log(`✓ ${OUT}`);
