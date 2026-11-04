// League of Legends in 2D everywhere but Who's That?: the champions' cards that came from Who's That?'s 3D
// renders keep them (cards keep the picture they were pulled with), but the games draw them from the League
// of Legends Wiki (https://wiki.leagueoflegends.com/en-us/List_of_champions) — each champion's original
// loading-screen art, the same as the boss's own faces. Written to bosses.json's League boss as `faceArt`
// (src/boss/faces.ts), and the boss marked `drawnOnly`: a champion with no 2D art sits out the Final Blow.
// node scripts/data/lol-2d-art.mjs   (behind a proxy: NODE_USE_ENV_PROXY=1)
import { readFileSync, writeFileSync } from 'node:fs';

const BOSSES = new URL('../../src/data/bosses.json', import.meta.url);
const SILHOUETTES = new URL('../../src/data/silhouettes.json', import.meta.url);
const API = 'https://wiki.leagueoflegends.com/en-us/api.php';
const UA = { 'User-Agent': 'Omnidle-data-build/1.0 (fan project; https://github.com/Emilezola0/DlesMania)' };

/** Of these file titles, the URL of each one that exists (redirects followed, keyed by the asked title). */
async function files(titles) {
  const found = new Map();
  for (let i = 0; i < titles.length; i += 50) {
    const url = `${API}?${new URLSearchParams({ action: 'query', format: 'json', formatversion: '2', redirects: '1', prop: 'imageinfo', iiprop: 'url', titles: titles.slice(i, i + 50).join('|') })}`;
    const data = await (await fetch(url, { headers: UA })).json();
    const back = new Map([...(data.query.normalized ?? []), ...(data.query.redirects ?? [])].map((n) => [n.to, n.from]));
    for (const p of data.query.pages) {
      if (!p.imageinfo) continue;
      let t = p.title;
      found.set(t, p.imageinfo[0].url);
      while (back.has(t)) (t = back.get(t)), found.set(t, p.imageinfo[0].url);
    }
  }
  return found;
}

/** The wiki's file names for a champion's original loading art, most likely first. */
const candidates = (name) => {
  const base = name.replaceAll(' ', '_');
  return [...new Set([base, base.replaceAll("'", ''), base.replaceAll('.', ''), base.split('_&_')[0]])].map((b) => `File:${b}_OriginalLoading.jpg`);
};

const bosses = JSON.parse(readFileSync(BOSSES, 'utf8'));
const lol = bosses.find((b) => b.id === 'lol');
const series = JSON.parse(readFileSync(SILHOUETTES, 'utf8'));
const roster = (Array.isArray(series) ? series : series.series ?? []).find((s) => s.id === 'lol')?.entries ?? [];
// Every champion a card may show in 3D: the Who's That? roster.
const names = [...new Set(roster.map((e) => e.name))];
const tries = new Map(names.map((n) => [n, candidates(n)]));
const found = await files([...new Set([...tries.values()].flat())]);
const norm = (t) => t.replaceAll('_', ' ');
const art = {};
const missing = [];
for (const n of names) {
  const hit = tries.get(n).find((t) => found.has(t) || found.has(norm(t)));
  // The file URL without the wiki's cache-buster query.
  if (hit) art[n] = (found.get(hit) ?? found.get(norm(hit))).split('?')[0];
  else missing.push(n);
}
lol.faceArt = art;
lol.drawnOnly = true;
writeFileSync(BOSSES, JSON.stringify(bosses, null, 2) + '\n');
console.log(`lol: ${Object.keys(art).length} champions in 2D${missing.length ? ` · none for ${missing.join(', ')}` : ''}`);
