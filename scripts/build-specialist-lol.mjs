#!/usr/bin/env node
// Builds src/data/specialist/lol.json for the League of Legends Specialist mode. Re-run it after a
// patch to pick up new champions and reworked abilities.
//
//   node scripts/build-specialist-lol.mjs
//
// - Data Dragon (Riot's official static data): the champion list, abilities (passive, Q, W, E, R)
//   with their icons, and the base splash art.
// - League of Legends wiki, Module:ChampionData/data: positions, range type, resource, class and
//   release date.
// - League of Legends wiki lore pages ({{Champion bio}}): pronouns (for gender), species and region.
// Only facts and names are kept.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, fandomApi, getJson, mediawikiGet, sleep } from './lib.mjs';

const API = fandomApi('leagueoflegends');
const OUT = join(ROOT, 'src', 'data', 'specialist', 'lol.json');

const version = (await getJson('https://ddragon.leagueoflegends.com/api/versions.json'))[0];
const CDN = `https://ddragon.leagueoflegends.com/cdn/${version}`;
console.log(`▶ Data Dragon ${version}`);
const full = (await getJson(`${CDN}/data/en_US/championFull.json`)).data;

// ── Wiki: Module:ChampionData/data (a Lua table, one block per champion) ─────────

async function pageText(title) {
  const d = await mediawikiGet(API, { action: 'query', prop: 'revisions', rvprop: 'content', rvslots: 'main', titles: title });
  return d.query?.pages?.[0]?.revisions?.[0]?.slots?.main?.content ?? '';
}

console.log('▶ wiki champion data');
const lua = await pageText('Module:ChampionData/data');
/** The block for one champion: from `["Name"] = {` to the next top-level champion. */
const blocks = new Map();
for (const m of lua.matchAll(/^ {2}\["([^"]+)"\] = \{/gm)) blocks.set(m[1], m.index);
const starts = [...blocks.entries()].sort((a, b) => a[1] - b[1]);
const blockOf = (name) => {
  const i = starts.findIndex(([n]) => n === name);
  return i < 0 ? '' : lua.slice(starts[i][1], starts[i + 1]?.[1] ?? lua.length);
};
const luaString = (block, key) => block.match(new RegExp(`\\["${key}"\\]\\s*=\\s*"([^"]*)"`))?.[1];
const luaList = (block, key) => [...(block.match(new RegExp(`\\["${key}"\\]\\s*=\\s*\\{([^}]*)\\}`))?.[1] ?? '').matchAll(/"([^"]+)"/g)].map((m) => m[1]);
/** Wiki block name for a Data Dragon champion: matched on the API name first. */
const wikiName = (ddId, ddName) => starts.find(([n]) => luaString(blockOf(n), 'apiname') === ddId)?.[0] ?? (blocks.has(ddName) ? ddName : null);

// ── Wiki: lore pages ({{Champion bio}}) ──────────────────────────────────────────

async function bios(titles) {
  const out = new Map();
  for (let i = 0; i < titles.length; i += 50) {
    const d = await mediawikiGet(API, { action: 'query', prop: 'revisions', rvprop: 'content', rvslots: 'main', redirects: '1', titles: titles.slice(i, i + 50).join('|') });
    const back = new Map((d.query?.redirects ?? []).map((r) => [r.to, r.from]));
    for (const n of d.query?.normalized ?? []) back.set(n.to, n.from);
    for (const p of d.query?.pages ?? []) out.set(back.get(p.title) ?? p.title, p.revisions?.[0]?.slots?.main?.content ?? '');
    await sleep(400);
  }
  return out;
}

/**
 * The fields of the page's bio box — {{Champion bio}}, or {{Arcane character}} for the Arcane cast —
 * split on top-level pipes, so values with nested templates and links stay whole.
 */
function bioFields(text) {
  const start = text.search(/\{\{\s*(Champion bio|Arcane character)\b/);
  if (start < 0) return {};
  const fields = {};
  let depth = 0;
  let part = '';
  const parts = [];
  for (let i = start + 2; i < text.length; i++) {
    const two = text.slice(i, i + 2);
    if (two === '{{' || two === '[[') (depth++, (part += two), i++);
    else if (two === '}}' || two === ']]') {
      if (depth === 0) break;
      depth--, (part += two), i++;
    } else if (text[i] === '|' && depth === 0) (parts.push(part), (part = ''));
    else part += text[i];
  }
  parts.push(part);
  for (const p of parts.slice(1)) {
    const eq = p.indexOf('=');
    if (eq > 0) fields[p.slice(0, eq).trim().toLowerCase()] = p.slice(eq + 1).trim();
  }
  return fields;
}
/** Linked names and {{fi|Name}} faction icons in a value; former ones (struck through) and small-print notes are left out. */
const names = (v = '') =>
  [
    ...new Set(
      [...v.replace(/<s>[\s\S]*?<\/s>|<small>[\s\S]*?<\/small>/g, '').matchAll(/\{\{fi\|([^}|]+)|\[\[([^\]|]+)(?:\|[^\]]*)?\]\]/g)].map((m) => (m[1] ?? m[2]).trim()),
    ),
    // Links into stories and sections ("Shadow_and_Fortune:_Chapter_Two#II") aren't species or regions.
  ].filter((n) => !/^(File|Category):/i.test(n) && !/[#:_]/.test(n));

/** From the bio's pronoun or gender field; failing both, from the pronouns the biography itself uses. */
function genderOf(bio, text) {
  const field = bio.pronoun ?? bio.gender ?? '';
  if (/^\s*(she|female)/i.test(field) && !/they|he\/him/i.test(field)) return 'Female';
  if (/^\s*(he\b|male)/i.test(field) && !/they|she/i.test(field)) return 'Male';
  if (field.trim()) return 'Other';
  const prose = text.replace(/\{\{[\s\S]*?\}\}/g, ' ').slice(0, 4000).toLowerCase();
  const her = (prose.match(/\b(she|her|hers|herself)\b/g) ?? []).length;
  const him = (prose.match(/\b(he|him|his|himself)\b/g) ?? []).length;
  return her > 2 * him ? 'Female' : him > 2 * her ? 'Male' : 'Other';
}

/** Where the wiki's bio gives no usable pronoun (a host and its weapon, a two-person champion...). */
const GENDER_FIX = { Aphelios: 'Male', Varus: 'Male', Mel: 'Female', Yunara: 'Female' };

// ── Champions ────────────────────────────────────────────────────────────────────

const champs = Object.values(full).sort((a, b) => a.name.localeCompare(b.name));
const lore = await bios(champs.map((c) => c.name));
const out = [];
for (const c of champs) {
  const wiki = wikiName(c.id, c.name);
  const block = wiki ? blockOf(wiki) : '';
  const bio = bioFields(lore.get(c.name) ?? '');
  const date = luaString(block, 'date');
  const positions = luaList(block, 'client_positions');
  const species = names(bio.species).map((s) => s.replace(/^Magical Alteration$/, 'Magically Altered'));
  const region = names(bio.region);
  if (!block || !date) console.log(`  ✗ no wiki data for ${c.name} (new champion?)`);
  if (!bio.species && !bio.region) console.log(`  ✗ no bio for ${c.name}`);
  out.push({
    id: c.id,
    name: c.name,
    // "Nunu & Willump" can be typed "Nunu"; Data Dragon ids (MonkeyKing) are accepted too.
    aliases: [...new Set([c.id !== c.name.replace(/[^A-Za-z]/g, '') ? c.id : null, c.name.includes('&') ? c.name.split('&')[0].trim() : null].filter(Boolean))],
    title: c.title,
    image: `${CDN}/img/champion/${c.image.full}`,
    splash: `https://ddragon.leagueoflegends.com/cdn/img/champion/splash/${c.id}_0.jpg`,
    gender: GENDER_FIX[c.name] ?? genderOf(bio, lore.get(c.name) ?? ''),
    // Champions too new for the wiki's data: left out of Classic until a later run fills them in.
    complete: !!(block && date && positions.length),
    positions: positions.length ? positions : ['Unknown'],
    species: species.length ? species : ['Unknown'],
    resource: luaString(block, 'resource') ?? c.partype ?? 'None',
    range: luaString(block, 'rangetype') ?? (c.stats.attackrange > 300 ? 'Ranged' : 'Melee'),
    regions: region.length ? region : ['Runeterra'],
    classes: [luaString(block, 'herotype'), luaString(block, 'alttype')].filter(Boolean),
    year: Number(date?.slice(0, 4)) || 0,
    abilities: [
      { key: 'P', name: c.passive.name, icon: `${CDN}/img/passive/${c.passive.image.full}` },
      ...c.spells.map((s, i) => ({ key: 'QWER'[i], name: s.name, icon: `${CDN}/img/spell/${s.image.full}` })),
    ],
  });
}
mkdirSync(join(ROOT, 'src', 'data', 'specialist'), { recursive: true });
writeFileSync(OUT, JSON.stringify({ generated: new Date().toISOString().slice(0, 10), version, champions: out }, null, 2) + '\n');
console.log(`✓ ${out.length} champions → ${OUT}`);
