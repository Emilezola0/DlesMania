#!/usr/bin/env node
// The League of Legends Specialist's Quote round: each champion's own lines, from the League of Legends wiki's
// "<Champion>/LoL/Audio" pages — the champion select line ("Pick", the one every player knows), then the ban line
// and a few lines said while moving, as later clues. A line that names the champion has the name masked.
//
//   node scripts/build-specialist-lol-quotes.mjs   (writes src/data/specialist/lol-quotes.json)
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, fandomApi, mediawikiGet, sleep } from './lib.mjs';

const API = fandomApi('leagueoflegends');
const OUT = join(ROOT, 'src', 'data', 'specialist', 'lol-quotes.json');
const champions = JSON.parse(readFileSync(join(ROOT, 'src', 'data', 'specialist', 'lol.json'), 'utf8')).champions;

/** Wiki markup to plain text: links, bold and italics, templates. */
const plain = (s) =>
  s
    .replace(/\[\[(?:[^|\]]*\|)?([^\]]*)\]\]/g, '$1')
    .replace(/\{\{[^}]*\}\}/g, '')
    .replace(/'{2,}/g, '')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim();

/** The quoted lines of a section ("Pick", "Ban", "First Move", "Moving"), in order. */
function linesOf(text, heading) {
  const at = text.search(new RegExp(`^(;|=+ ?)${heading}( ?=+)?\\s*$`, 'm'));
  if (at < 0) return [];
  const rest = text.slice(at).split('\n').slice(1);
  const out = [];
  for (const line of rest) {
    if (/^(;|=)/.test(line)) break;
    // Only the spoken words: ''"..."'' (stage directions in plain italics are left out).
    for (const m of line.matchAll(/''"([^"]+)"/g)) out.push(plain(m[1]));
  }
  return out.filter((l) => l.length > 3);
}

/** A champion's name hidden in its own line ("Ahri" → "▢▢▢▢"). */
function mask(line, c) {
  const names = [c.name, ...(c.aliases ?? [])].filter((n) => n.length > 2);
  return names.reduce((l, n) => l.replace(new RegExp(`\\b${n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi'), '▢▢▢'), line);
}

const out = {};
let i = 0;
for (const c of champions) {
  i++;
  const d = await mediawikiGet(API, { action: 'query', prop: 'revisions', rvprop: 'content', rvslots: 'main', redirects: '1', titles: `${c.name}/LoL/Audio` });
  const text = d.query?.pages?.[0]?.revisions?.[0]?.slots?.main?.content ?? '';
  const pick = linesOf(text, 'Pick')[0];
  if (!pick) {
    console.log(`${i}/${champions.length} -- ${c.name}: no champion select line`);
    continue;
  }
  const ban = linesOf(text, 'Ban')[0];
  const more = [...linesOf(text, 'First Move'), ...linesOf(text, 'Moving')].filter((l) => l !== pick && l !== ban).slice(0, 4);
  out[c.id] = { pick: mask(pick, c), ...(ban ? { ban: mask(ban, c) } : {}), more: more.map((l) => mask(l, c)) };
  console.log(`${i}/${champions.length} OK ${c.name}: “${out[c.id].pick}”`);
  await sleep(250);
}
writeFileSync(OUT, `${JSON.stringify({ generated: new Date().toISOString().slice(0, 10), quotes: out }, null, 2)}\n`);
console.log(`\n${Object.keys(out).length} of ${champions.length} champions → ${OUT}`);
