#!/usr/bin/env node
// Finds a clip of each signature laugh in src/data/specialist/onepiece.json (the One Piece
// Specialist's Laugh round), from YouTube search results (no API key): the original Japanese voice,
// never an English dub. Only titles are checked — they must name the character (or spell the laugh)
// and say it's a laugh — so the picks are worth a listen.
//
//   node scripts/find-laugh-clips.mjs [--dry] [--force]   (--force re-searches laughs that have a clip)
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, parseArgs, sleep } from './lib.mjs';

const { flags } = parseArgs();
const FILE = join(ROOT, 'src', 'data', 'specialist', 'onepiece.json');
const HEADERS = {
  'Accept-Language': 'en-US,en;q=0.9',
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36',
  Cookie: 'SOCS=CAI',
};

/** Videos on a results page: id, title, seconds. YouTube pushes back when asked too fast: wait and retry. */
async function search(query) {
  let html = '';
  for (let attempt = 0; attempt < 4 && !html; attempt++) {
    try {
      html = await (await fetch(`https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`, { headers: HEADERS })).text();
    } catch {
      console.log(`  (YouTube is throttling — waiting ${30 * (attempt + 1)} s)`);
      await sleep(30_000 * (attempt + 1));
    }
  }
  const m = html.match(/var ytInitialData = (\{.*?\});<\/script>/s);
  if (!m) return [];
  const out = [];
  JSON.stringify(JSON.parse(m[1]), (_, v) => {
    const r = v?.videoRenderer;
    if (r?.videoId && r.lengthText?.simpleText) {
      const secs = r.lengthText.simpleText.split(':').reduce((a, b) => a * 60 + Number(b), 0);
      out.push({ id: r.videoId, title: r.title?.runs?.map((t) => t.text).join('') ?? '', secs });
    }
    return v;
  });
  return out;
}

const norm = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
/** Several characters in one video, or not the original voice. */
const NOT_ONE_LAUGH = /\b(top ?\d+|all|every|best|quiz|guess|alphabet|trend|compilation|tier|ranking|reaction|meme|edit|amv|remix|song|english|eng|dub(bed)?|fandub|cover|impression|vs|and)\b|&|\+|ランキング|クイズ|まとめ|比較/i;
const LAUGH = /\b(laugh(s|ing)?|laughter)\b|笑/i;

function pick(results, c, laugh) {
  const parts = norm(c.name).split(' ').filter((p) => p.length >= 3).concat(c.aliases.map(norm));
  const laughWord = norm(laugh).replace(/ /g, '');
  return results.find(({ title, secs }) => {
    if (secs < 3 || secs > 180 || NOT_ONE_LAUGH.test(title)) return false;
    const t = ` ${norm(title)} `;
    const names = parts.some((p) => p && t.includes(` ${p} `));
    // The laugh's spelling counts as naming it ("Zehahaha"), its first five letters at least.
    const spelled = laughWord.length >= 5 && t.replace(/ /g, '').includes(laughWord.slice(0, 5));
    return names && (LAUGH.test(title) || spelled);
  });
}

const data = JSON.parse(readFileSync(FILE, 'utf8'));
const byId = new Map(data.characters.map((c) => [c.id, c]));
const used = new Set(data.laughs.map((l) => l.youtubeId).filter(Boolean));
let found = 0;
const todo = data.laughs.filter((l) => flags.force || !l.youtubeId);
for (const [i, l] of todo.entries()) {
  const c = byId.get(l.character);
  const short = c.aliases.find((a) => a.split(' ').length === 1) ?? c.name;
  let hit = null;
  for (const q of [`${short} laugh one piece japanese`, `${l.laugh} ${short} one piece`, `${c.name} laugh`]) {
    hit = pick((await search(q)).filter((r) => !used.has(r.id)), c, l.laugh);
    if (hit) break;
    await sleep(2500);
  }
  if (hit) {
    used.add(hit.id);
    l.youtubeId = hit.id;
    // Short clips start right away; longer ones usually open with a second of context.
    l.start = hit.secs > 20 ? 1 : 0;
    found++;
  }
  console.log(`${String(i + 1).padStart(2)}/${todo.length} ${hit ? 'OK' : '--'} ${c.name} (${l.laugh}) — ${hit ? `${hit.title} [${hit.id}, ${hit.secs}s]` : 'nothing'}`);
  if (!flags.dry && (i + 1) % 10 === 0) writeFileSync(FILE, JSON.stringify(data, null, 2) + '\n');
  await sleep(2500);
}
console.log(`\n${found} of ${todo.length} laughs found`);
if (!flags.dry) writeFileSync(FILE, JSON.stringify(data, null, 2) + '\n');
