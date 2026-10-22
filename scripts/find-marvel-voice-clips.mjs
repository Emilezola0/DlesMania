#!/usr/bin/env node
// Finds a clip of each well-known MCU character speaking, in the original English version, for the
// Marvel Specialist's Voice Line round (src/data/specialist/marvel.json → characters[].voice). From
// YouTube search results, no API key; titles only — they must name the character and look like a
// scene or a line, never a dub, trailer, interview, compilation or music — so the picks are worth a
// listen. Rejected clips go in REJECTED so a re-run doesn't pick them again.
//
//   node scripts/find-marvel-voice-clips.mjs [--dry] [--force] [--top=110]
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, parseArgs, sleep } from './lib.mjs';

const { flags } = parseArgs();
const FILE = join(ROOT, 'src', 'data', 'specialist', 'marvel.json');
const TOP = Number(flags.top ?? 110);
const HEADERS = {
  'Accept-Language': 'en-US,en;q=0.9',
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36',
  Cookie: 'SOCS=CAI',
};

/** Clips checked and turned down. */
const REJECTED = new Set([
  '9esCA8_EPeY', // Spider-Man: Tony does the talking
  '0CpYb3Qdrmc', // Hawkeye barely speaks
  'kTTMCe40464', // War Machine: combat montage
  'ABuDBiXeZ6U', // Doctor Strange: musical fight
  '32Qh2zXbROA', // Scarlet Witch: Strucker speaks
  'IvdHeqxbDrc', // Rocket: behind-the-scenes featurette
  'cbAfhBNQ2qU', // Star-Lord: song over the credits
  '8hQn2DrSZr4', // Thanos: The Other speaks
  'i1OVWGSgIxw', // Gamora: dance to music
  'QI9z1KziHek', // Heimdall: fight, few lines
  'JyyGJk51n-0', // Natasha, not Yelena
  'CBYNibCdOIQ', // Mighty Thor: Heimdall speaks
  'GOG_kgZylcU', // Mobius: Ukrainian dub
  'kQiNe0poemM', // Valkyrie: flashback, few lines
  'r2vVsF4LS_I', // Vision: Tony and Steve speak
  'vfOV0WP5eL0', // Claire Temple: not suitable
  'fsX7i_YZ17M', // Betty Brant: Raimi's Spider-Man 3
  'pYkNNXr6cvU', // Taskmaster: fan edit
  'nDROiMF3_r0', // War Machine falls: barely speaks
  'fi9HGfLDINE', // Taskmaster: silent
]);

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
/** Not the character speaking in the original film: other languages, people talking about it, music, several characters. */
const NOT_A_LINE =
  /\b(dub(bed)?|fandub|vf|french|fran[cç]ais|latino|espa[nñ]ol|castellano|deutsch|german|italiano|hindi|tamil|telugu|portugu[eê]s|russian|trailer|teaser|interview|reaction|review|explained|breakdown|behind the scenes|bts|cast|actors?|parody|edit|amv|song|music|soundtrack|ost|theme|score|top ?\d+|every|all|ranking|compilation|tiktok|shorts?|lego|fortnite|game(play)?|cosplay|toy|asmr|ai)\b/i;
const SPOKEN = /\b(scene|scenes|speech|line|lines|quotes?|says|saying|talks?|monologue|moment|moments|voice|clip|introduces|meets|confronts|tells)\b/i;

function pick(results, c) {
  const names = [c.name, ...c.aliases].map(norm).filter((n) => n.length >= 3);
  return results.find(({ id, title, secs }) => {
    if (REJECTED.has(id) || used.has(id) || secs < 8 || secs > 240 || NOT_A_LINE.test(title) || !SPOKEN.test(title)) return false;
    const t = ` ${norm(title)} `;
    return names.some((n) => t.includes(` ${n} `));
  });
}

const data = JSON.parse(readFileSync(FILE, 'utf8'));
const films = new Map(data.films.map((f) => [f.id, f]));
const used = new Set(data.characters.map((c) => c.voice?.youtubeId).filter(Boolean));
let found = 0;
const todo = data.characters.slice(0, TOP).filter((c) => flags.force || !c.voice);
for (const [i, c] of todo.entries()) {
  // The name people search by: the civilian one when the page uses a codename ("Tony Stark").
  const person = c.aliases.find((a) => a.split(' ').length === 2) ?? c.name;
  const film = films.get(c.debut)?.name ?? '';
  let hit = null;
  for (const q of [`${person} ${film} scene`, `${c.name} best lines scene`]) {
    hit = pick(await search(q), c);
    if (hit) break;
    await sleep(2500);
  }
  if (hit) {
    used.add(hit.id);
    c.voice = { youtubeId: hit.id, start: 0 };
    found++;
  }
  console.log(`${String(i + 1).padStart(3)}/${todo.length} ${hit ? 'OK' : '--'} ${c.name} — ${hit ? `${hit.title} [${hit.id}, ${hit.secs}s]` : 'nothing'}`);
  if (!flags.dry && (i + 1) % 10 === 0) writeFileSync(FILE, JSON.stringify(data, null, 2) + '\n');
  await sleep(2500);
}
console.log(`\n${found} of ${todo.length} found`);
if (!flags.dry) writeFileSync(FILE, JSON.stringify(data, null, 2) + '\n');
