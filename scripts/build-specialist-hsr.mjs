#!/usr/bin/env node
// Builds src/data/specialist/hsr.json for the Honkai: Star Rail Specialist (and the boss and cards built
// from it, scripts/data/hsr-boss.mjs), from the Honkai: Star Rail Wiki's API (honkai-star-rail.fandom.com).
// Re-run it after each version update.
//
//   node scripts/build-specialist-hsr.mjs
//
// - Characters: Category:Playable Characters (the Trailblazer, whose Path and look change, is left out).
//   The {{Character Infobox}} gives rarity, Path, Combat Type, faction, world, species and signature Light
//   Cone; "Released in Version X" the version. Gender: the pronouns of the page's opening paragraph.
// - Pictures: the character's icon and splash art, the Light Cone's art (all drawn).
// - Voice lines: a few combat lines per character in English (the wiki's recordings), that name no one.
// Only facts, names and short lines are kept.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, sleep } from './lib.mjs';

const API = 'https://honkai-star-rail.fandom.com/api.php';
const UA = 'OmnidleBot/1.0 (fan site data builder)';
const OUT = join(ROOT, 'src', 'data', 'specialist', 'hsr.json');

async function get(params) {
  const url = `${API}?${new URLSearchParams({ format: 'json', formatversion: '2', ...params })}`;
  for (let i = 0; ; i++) {
    const res = await fetch(url, { headers: { 'User-Agent': UA } });
    if (res.ok) return res.json();
    if (i >= 3) throw new Error(`${res.status} ${url}`);
    await sleep(2000 * (i + 1));
  }
}

async function categoryPages(category) {
  const out = [];
  let cont = {};
  do {
    const d = await get({ action: 'query', list: 'categorymembers', cmtitle: category, cmnamespace: '0', cmlimit: '500', ...cont });
    out.push(...(d.query?.categorymembers ?? []).map((p) => p.title));
    cont = d.continue ?? null;
  } while (cont);
  return out;
}

/** Wikitext and categories of many pages, 20 at a time. */
async function pages(titles) {
  const out = new Map();
  for (let i = 0; i < titles.length; i += 20) {
    const batch = titles.slice(i, i + 20);
    let cont = {};
    do {
      const d = await get({ action: 'query', prop: 'revisions|categories', rvprop: 'content', rvslots: 'main', cllimit: 'max', titles: batch.join('|'), ...cont });
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

/** URLs of many files ("X.png"), 50 at a time; missing files are left out. */
async function fileUrls(files, width) {
  const out = new Map();
  for (let i = 0; i < files.length; i += 50) {
    const batch = files.slice(i, i + 50);
    const d = await get({ action: 'query', prop: 'imageinfo', iiprop: 'url', ...(width ? { iiurlwidth: String(width) } : {}), titles: batch.map((f) => `File:${f}`).join('|') });
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
    .replace(/&amp;/g, '&')
    .trim();
}

/** She or he, from the pronouns of the opening paragraphs (after the infobox). */
function genderOf(text) {
  const body = text.replace(/\{\{Character Infobox[\s\S]*?\n\}\}/, '').split(/\n==/)[0];
  const she = (body.match(/\b(she|her|hers|herself)\b/gi) ?? []).length;
  const he = (body.match(/\b(he|him|his|himself)\b/gi) ?? []).length;
  return she > he ? 'Female' : he > she ? 'Male' : 'Unknown';
}

// The combat lines worth a round, by their key in {{Combat VO}} and the words in the recording's file name.
const VO = [
  ['ulti-activate', 'Ultimate - Activate'],
  ['ulti-unleash', 'Ultimate - Unleash'],
  ['skill', 'Skill'],
  ['talent', 'Talent'],
  ['b-begin-w', 'Battle Begins - Weakness Break'],
  ['win', 'Battle Won'],
  ['t-begin', 'Turn Begins'],
];

console.log('▶ characters');
const titles = (await categoryPages('Category:Playable Characters')).filter((t) => !/^Trailblazer/.test(t));
const info = await pages(titles);
const vo = await pages(titles.map((t) => `${t}/Voice-Overs`));

const rows = [];
for (const title of titles) {
  const p = info.get(title);
  const path = field(p.text, 'path');
  const element = field(p.text, 'combatType');
  if (!path || !element || !/Character Infobox/.test(p.text)) {
    console.log(`  ✗ ${title}: no infobox data`);
    continue;
  }
  const version = p.cats.map((c) => c.match(/^Released in Version ([\d.]+)$/)?.[1]).find(Boolean);
  // Combat lines with their recordings' file names; lines that link or name someone are left out.
  const text = vo.get(`${title}/Voice-Overs`)?.text ?? '';
  const lines = [];
  for (const [key, label] of VO) {
    for (const m of text.matchAll(new RegExp(`\\|\\s*${key}_(\\d+)_tx\\s*=([^\\n]*)`, 'g'))) {
      const line = m[2].replace(/<[^>]+>/g, '').replace(/&mdash;/g, '—').replace(/\s+/g, ' ').trim();
      if (!line || /\[\[|\{\{|\(Trailblazer\)|Trailblazer|\*/.test(line) || line.length > 90) continue;
      lines.push({ text: line, file: `VO ${title} ${label} ${m[1].padStart(2, '0')}.ogg` });
    }
  }
  rows.push({
    title,
    path,
    element,
    rarity: Number(field(p.text, 'rarity')) || 4,
    faction: field(p.text, 'faction').split(/<br|,|\n/)[0].trim() || 'None',
    world: field(p.text, 'world').split(/<br|,|\n/)[0].trim() || 'Unknown',
    species: field(p.text, 'species') || 'Unknown',
    lightcone: field(p.text, 'lightcone') || undefined,
    released: field(p.text, 'release_date') || undefined,
    version: version ?? '1.0',
    gender: genderOf(p.text),
    lines: lines.slice(0, 4),
  });
}

const icons = await fileUrls(rows.map((r) => `Character ${r.title} Icon.png`), 160);
const splash = await fileUrls(rows.map((r) => `Character ${r.title} Splash Art.png`), 700);
const cones = await fileUrls(rows.filter((r) => r.lightcone).map((r) => `Light Cone ${r.lightcone}.png`), 400);
const audio = await fileUrls(rows.flatMap((r) => r.lines.map((l) => l.file)));

const slug = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const ALIASES = {
  'Dan Heng • Imbibitor Lunae': ['Imbibitor Lunae', 'Dan Heng Imbibitor Lunae', 'DHIL'],
  'Dan Heng • Permansor Terrae': ['Permansor Terrae', 'Dan Heng Permansor Terrae'],
  'Himeko • Nova': ['Himeko Nova'],
  'Robin • Summeretto': ['Robin Summeretto'],
  'Aventurine • Waveflair': ['Aventurine Waveflair'],
  'Silver Wolf LV.999': ['Silver Wolf LV999'],
  'Topaz & Numby': ['Topaz', 'Topaz and Numby'],
  'Dr. Ratio': ['Ratio', 'Dr Ratio', 'Veritas Ratio'],
  'The Dahlia': ['Dahlia'],
  'March 7th': ['March 7', 'March'],
  'Jing Yuan': ['Jingyuan'],
};
// Pages whose opening says too little to tell (checked on each character's page).
const GENDER_FIX = {
  Yanqing: 'Male', Argenti: 'Male', Aglaea: 'Female', Mydei: 'Male', Castorice: 'Female', Anaxa: 'Male', Hyacine: 'Female',
  Cipher: 'Female', Phainon: 'Male', Hysilens: 'Female', Cerydra: 'Female', 'Dan Heng • Permansor Terrae': 'Male',
};
const characters = rows.map((r) => ({
  id: slug(r.title),
  name: r.title,
  aliases: ALIASES[r.title] ?? [],
  image: icons.get(`Character ${r.title} Icon.png`),
  splash: splash.get(`Character ${r.title} Splash Art.png`),
  gender: GENDER_FIX[r.title] ?? r.gender,
  rarity: r.rarity,
  path: r.path,
  element: r.element,
  faction: r.faction,
  world: r.world,
  species: r.species,
  version: r.version,
  released: r.released,
  ...(r.lightcone && cones.get(`Light Cone ${r.lightcone}.png`) ? { lightcone: { name: r.lightcone, image: cones.get(`Light Cone ${r.lightcone}.png`) } } : {}),
  voices: r.lines.filter((l) => audio.get(l.file)).map((l) => ({ text: l.text, audio: audio.get(l.file) })),
}));
const versionKey = (v) => v.split('.').map((n) => n.padStart(3, '0')).join('.');
characters.sort((a, b) => versionKey(a.version).localeCompare(versionKey(b.version)) || (a.released ?? '').localeCompare(b.released ?? '') || a.name.localeCompare(b.name));
const missing = (k) => characters.filter((c) => !c[k] || (Array.isArray(c[k]) && !c[k].length)).map((c) => c.name);
console.log(`  ${characters.length} characters; no icon: ${missing('image').join(', ') || '-'}; no splash: ${missing('splash').join(', ') || '-'}; no light cone: ${missing('lightcone').join(', ') || '-'}; no voice: ${missing('voices').join(', ') || '-'}; gender unknown: ${characters.filter((c) => c.gender === 'Unknown').map((c) => c.name).join(', ') || '-'}`);

mkdirSync(join(ROOT, 'src', 'data', 'specialist'), { recursive: true });
writeFileSync(OUT, JSON.stringify({ generated: new Date().toISOString().slice(0, 10), characters }, null, 2) + '\n');
console.log(`✓ ${OUT}`);
