// Boss Battle shows 2D art only: 3D models are for silhouettes (Who's That?). This sets the guardian, Radar
// and Final Blow pictures of the bosses whose cards came from 3D renders (Overwatch, Smash, Minecraft) to
// drawn art, each franchise from its own wiki, and marks them `drawnOnly` (src/boss/faces.ts). The cards keep
// the pictures they were pulled with (src/data/card-art.json). A face with no 2D art sits out the fight
// (finaleSkip, radarSkip) and keeps its card. Minecraft's faces and textures are kept in public/art/minecraft
// ("local:art/…"): minecraft.wiki doesn't let other sites show its pictures.
// node scripts/data/boss-2d-art.mjs [--boss=overwatch]   (behind a proxy: NODE_USE_ENV_PROXY=1)
import { readFileSync, writeFileSync } from 'node:fs';

const FILE = new URL('../../src/data/bosses.json', import.meta.url);
const UA = { 'User-Agent': 'Omnidle-data-build/1.0 (fan project; https://github.com/Emilezola0/DlesMania)' };
const only = process.argv.find((a) => a.startsWith('--boss='))?.slice(7);

/** Of these file titles on a MediaWiki, the URL of each one that exists. */
async function files(api, titles) {
  const found = new Map();
  for (let i = 0; i < titles.length; i += 50) {
    const url = `${api}?${new URLSearchParams({ action: 'query', format: 'json', formatversion: '2', redirects: '1', prop: 'imageinfo', iiprop: 'url', titles: titles.slice(i, i + 50).join('|') })}`;
    const data = await (await fetch(url, { headers: UA })).json();
    const back = new Map([...(data.query.normalized ?? []), ...(data.query.redirects ?? [])].map((n) => [n.to, n.from]));
    for (const p of data.query.pages) {
      if (!p.imageinfo) continue;
      let t = p.title;
      while (back.has(t)) t = back.get(t);
      found.set(t, p.imageinfo[0].url);
      found.set(p.title, p.imageinfo[0].url);
    }
  }
  return found;
}

/** The first candidate file that exists, for each name: { name: url }. */
async function firstOf(api, names, candidates) {
  const tries = new Map(names.map((n) => [n, candidates(n).map((f) => `File:${f}`)]));
  const found = await files(api, [...new Set([...tries.values()].flat())]);
  const norm = (t) => t.replaceAll('_', ' ');
  return Object.fromEntries(names.flatMap((n) => {
    const hit = tries.get(n).find((t) => found.has(t) || found.has(norm(t)));
    return hit ? [[n, found.get(hit) ?? found.get(norm(hit))]] : [];
  }));
}

const under = (s) => s.replaceAll(' ', '_');

// ── Overwatch: the heroes' "Cute" sprays (drawn chibis), else their pixel or portrait sprays. The impostors
// are Valorant agents, whose official portraits are painted. ──
async function overwatch(b) {
  const API = 'https://overwatch.fandom.com/api.php';
  const file = (n) => under(n.replace(':', ''));
  const names = [b.boss.name, ...b.radar.members.map((c) => c.label), ...b.finale.map((c) => c.label)];
  const art = await firstOf(API, names, (n) => [`Spray_${file(n)}_Cute.png`, `Spray_${file(n)}_Pixel.png`, `Spray_${file(n)}_Portrait.png`, `Spray_${file(n)}_Icon.png`]);
  const agents = (await (await fetch('https://valorant-api.com/v1/agents?isPlayableCharacter=true', { headers: UA })).json()).data;
  const portrait = new Map(agents.map((a) => [a.displayName, a.fullPortrait]));
  const IMPOSTORS = ['Jett', 'Phoenix', 'Sova', 'Killjoy', 'Sage', 'Reyna', 'Omen', 'Cypher', 'Raze', 'Brimstone', 'Viper', 'Neon'];
  return { art, impostors: IMPOSTORS.filter((n) => portrait.get(n)).map((n) => ({ label: n, image: portrait.get(n) })) };
}

// ── The others, picked by eye from each franchise's own art (scripts/data/boss-2d-art.json): Smash's
// fighters in their original series' drawings or sprites (SmashWiki, Super Mario Wiki, Sonic Wiki, Minecraft
// Wiki, Inkipedia), with impostors drawn from the other bosses' painted portraits. ──
const PICKED = JSON.parse(readFileSync(new URL('./boss-2d-art.json', import.meta.url), 'utf8'));
const picked = (id) => async () => PICKED[id];

const RESOLVERS = { overwatch, ...Object.fromEntries(Object.keys(PICKED).map((id) => [id, picked(id)])) };

const bosses = JSON.parse(readFileSync(FILE, 'utf8'));
for (const b of bosses) {
  const resolve = RESOLVERS[b.id];
  if (!resolve || (only && only !== b.id)) continue;
  const { art, impostors } = await resolve(b);
  const set = (c) => (art[c.label] ? { ...c, image: art[c.label] } : c);
  const missing = [b.boss.name, ...b.radar.members.map((c) => c.label), ...b.finale.map((c) => c.label)].filter((n) => !art[n]);
  if (art[b.boss.name]) b.boss.image = art[b.boss.name];
  // Final Blow draws no card pictures for these bosses (src/boss/faces.ts), and skips faces with no 2D art
  // (their cards stay).
  b.drawnOnly = true;
  if (b.id === 'minecraft') b.pixelArt = true;
  const noArt = b.finale.map((c) => c.label).filter((n) => !art[n]);
  if (noArt.length) b.finaleSkip = [...new Set([...(b.finaleSkip ?? []), ...noArt])];
  // Radar members with no 2D art sit out the Radar too (they keep their cards).
  const bare = b.radar.members.map((c) => c.label).filter((n) => !art[n]);
  if (bare.length) b.radarSkip = [...new Set([...(b.radarSkip ?? []), ...bare])];
  if (b.radar.members.length - bare.length < 12) console.warn(`${b.id}: only ${b.radar.members.length - bare.length} Radar members with 2D art (12 wanted)`);
  b.radar.members = b.radar.members.map(set);
  b.finale = b.finale.map(set);
  if (impostors) b.radar.impostors = impostors;
  console.log(`${b.id}: ${Object.keys(art).length} pictures${missing.length ? ` · none for ${missing.join(', ')}` : ''}`);
}
writeFileSync(FILE, JSON.stringify(bosses, null, 2) + '\n');
