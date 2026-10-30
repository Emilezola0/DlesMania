#!/usr/bin/env node
// Music is songs: the title is the only answer, never an album or an artist (they're clues). This turns the
// albums into their best-known song — the one their clip already plays — and adds the video game and anime
// songs of scripts/data/music-songs.mjs, then finds a YouTube clip for every song without one (search
// results, no API key: the first video whose title names the song). Covers: node scripts/enrich-media.mjs
// --domain=music --no-youtube.
//   node scripts/add-music.mjs [--dry]   (behind a proxy: NODE_USE_ENV_PROXY=1)
import { loadWorks, parseArgs, saveWorks, sleep } from './lib.mjs';
import { ANIME_SONGS, GAME_SONGS } from './data/music-songs.mjs';

const { flags } = parseArgs();
const norm = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const slug = (s) => norm(s).replace(/ /g, '-');
/** "Sonic the Hedgehog (2006 video game)" → "Sonic the Hedgehog". */
const plain = (s) => s.replace(/\s*\([^)]*\)\s*$/, '');

const works = loadWorks('music');

// ── Albums → their song. ──
let converted = 0;
for (const w of works) {
  if (!w.tracks?.length) continue;
  const album = w.name;
  const artist = w.subtitle ?? w.creator;
  const q = ` ${norm(w.audio?.query ?? '')} `;
  // The song the clip plays: the longest track title named in the clip's search, else the biggest hit.
  const song = [...w.tracks].sort((a, b) => b.length - a.length).find((t) => q.includes(` ${norm(t)} `)) ?? w.tracks[w.tracks.length - 1];
  const others = w.tracks.filter((t) => t !== song);
  w.name = song;
  w.aliases = [];
  delete w.subtitle;
  delete w.nameFr;
  delete w.tracks;
  w.format = 'Song';
  w.facts = [`A ${w.genres[0].toLowerCase()} song from ${w.year}`, `On the album “${album}”`, ...(others.length ? [`Also on that album: ${others.slice(-2).join(', ')}`] : []), `By ${artist}`];
  w.credits = [`From the album ${album}`, ...w.credits];
  converted++;
}

// ── Songs from games and anime. ──
const ids = new Set(works.map((w) => w.id));
const names = new Set(works.map((w) => norm(w.name)));
const PALETTE = [['#7c3aed', '#f472b6'], ['#0ea5e9', '#22c55e'], ['#f97316', '#facc15'], ['#ef4444', '#111827'], ['#14b8a6', '#a3e635'], ['#6366f1', '#e0e7ff']];
let added = 0;
for (const [rows, domain] of [[GAME_SONGS, 'game'], [ANIME_SONGS, 'anime']]) {
  for (const [title, from, year, artist, type, genres, origin, emoji] of rows) {
    if (names.has(norm(title))) {
      console.log(`  skipped (already a song with that title): ${title}`);
      continue;
    }
    let id = `m-${slug(title)}`;
    for (let n = 2; ids.has(id); n++) id = `m-${slug(title)}-${n}`;
    const kind = /opening/i.test(type) ? 'opening' : /ending/i.test(type) ? 'ending' : '';
    works.push({
      id,
      name: title,
      aliases: [],
      domain: 'music',
      year,
      genres: genres.split(/,\s*/),
      studio: plain(from),
      creator: artist,
      origin,
      format: type,
      credits: [`From ${plain(from)}`, `Artist: ${artist}`],
      cover: { wiki: from },
      facts: [`${type}, ${year}`, `From ${plain(from)}`, `By ${artist}`],
      audio: {
        clue: `${type} from ${year}.`,
        query: domain === 'game' ? `${title} ${plain(from)} OST` : `${plain(from)} ${kind} ${title} ${artist}`.replace(/\s+/g, ' '),
      },
      emoji,
      visual: { icon: [...emoji][0], colors: PALETTE[added % PALETTE.length] },
    });
    ids.add(id);
    names.add(norm(title));
    added++;
  }
}

// ── Clips: the first result that names the song (and isn't a cover, a remix, an hour-long loop…). ──
const HEADERS = { 'Accept-Language': 'en-US,en;q=0.9', 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36', Cookie: 'SOCS=CAI' };
async function search(query) {
  let html = '';
  for (let attempt = 0; attempt < 4 && !html; attempt++) {
    try {
      html = await (await fetch(`https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`, { headers: HEADERS })).text();
    } catch {
      await sleep(20_000 * (attempt + 1));
    }
  }
  const m = html.match(/var ytInitialData = (\{.*?\});<\/script>/s);
  if (!m) return [];
  const out = [];
  JSON.stringify(JSON.parse(m[1]), (_, v) => {
    const r = v?.videoRenderer;
    if (r?.videoId && r.lengthText?.simpleText) out.push({ id: r.videoId, title: r.title?.runs?.map((t) => t.text).join('') ?? '', secs: r.lengthText.simpleText.split(':').reduce((a, b) => a * 60 + Number(b), 0) });
    return v;
  });
  return out;
}
const NOT_IT = /\b(cover|remix|reaction|piano|guitar|tutorial|karaoke|nightcore|8 ?bit|lofi|lo-fi|slowed|reverb|extended|hour|10 hours|1 hour|mashup|orchestra(l)? cover|live|fan)\b/i;
let clips = 0;
for (const w of works) {
  if (w.audio?.youtubeId || !w.audio?.query) continue;
  const results = await search(w.audio.query);
  const t = norm(w.name);
  const hit = results.find((r) => norm(r.title).includes(t) && !NOT_IT.test(r.title) && r.secs >= 30 && r.secs <= 600) ?? results.find((r) => r.secs >= 30 && r.secs <= 600 && !NOT_IT.test(r.title));
  if (hit) {
    w.audio.youtubeId = hit.id;
    clips++;
    console.log(`  ${w.name}: ${hit.title}`);
  } else console.log(`  ${w.name}: no clip`);
  await sleep(800);
}

if (!flags.dry) saveWorks('music', works);
console.log(`${converted} albums turned into songs, ${added} songs added, ${clips} clips found; ${works.length} songs in all.`);
