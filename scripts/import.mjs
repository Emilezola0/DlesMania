#!/usr/bin/env node
// Batch-inserts works into src/data/works/<domain>.json.
//
//   node scripts/import.mjs <provider> "Title one" "Title two" ...   [--dry]
//   node scripts/import.mjs <provider> --list=titles.txt               (one title per line)
//   node scripts/import.mjs file entries.json                          (hand-written entries, any domain)
//
// Providers:
//   anilist      anime   — AniList GraphQL, no key
//   tmdb         cinema  — needs TMDB_API_KEY (v3 key)
//   igdb         games   — needs IGDB_CLIENT_ID + IGDB_TOKEN (Twitch app access token)
//   musicbrainz  music   — no key (1 request/second)
//
// Imported entries contain the factual metadata (year, genres, studio, creator, characters...).
// Clue fields — emoji, quote, item, location, audio.clue, visual — are creative and must be written
// by hand afterwards; run `npm run data:validate` to see what is missing, then
// `node scripts/enrich-media.mjs` to resolve images and clips.
import { readFileSync } from 'node:fs';
import { getJson, loadWorks, makeId, parseArgs, saveWorks, sleep } from './lib.mjs';

const { flags, positional } = parseArgs();
const [provider, ...titleArgs] = positional;
const titles = flags.list ? readFileSync(flags.list, 'utf8').split(/\r?\n/).map((s) => s.trim()).filter(Boolean) : titleArgs;

const first = (arr) => (Array.isArray(arr) && arr.length ? arr[0] : undefined);
const uniq = (arr) => [...new Set(arr.filter(Boolean))];

// ---------------------------------------------------------------- providers

const providers = {
  async anilist(title) {
    const query = `query ($s: String) { Media(search: $s, type: ANIME) {
      title { romaji english } synonyms startDate { year } genres format source countryOfOrigin
      studios(isMain: true) { nodes { name } }
      staff(perPage: 8) { edges { role node { name { full } } } }
      characters(role: MAIN, perPage: 4) { nodes { name { full } } } } }`;
    const { data } = await getJson('https://graphql.anilist.co', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ query, variables: { s: title } }),
    });
    const m = data?.Media;
    if (!m) return null;
    const staff = m.staff.edges.map((e) => ({ role: e.role, name: e.node.name.full }));
    const original = staff.find((s) => /original creator|original story/i.test(s.role));
    const director = staff.find((s) => /^director$/i.test(s.role));
    const music = staff.find((s) => /music/i.test(s.role));
    const name = m.title.english ?? m.title.romaji;
    return {
      domain: 'anime',
      name,
      aliases: uniq([m.title.romaji !== name && m.title.romaji, ...m.synonyms.slice(0, 2)].map((s) => s && s.toLowerCase())),
      year: m.startDate.year,
      genres: m.genres.slice(0, 2),
      studio: first(m.studios.nodes)?.name ?? 'Unknown',
      creator: (original ?? director)?.name ?? 'Unknown',
      origin: { JP: 'Japan', KR: 'South Korea', CN: 'China' }[m.countryOfOrigin] ?? m.countryOfOrigin,
      format: m.format === 'MOVIE' ? 'Film' : 'TV Series',
      source: { MANGA: 'Manga', ORIGINAL: 'Original', LIGHT_NOVEL: 'Light Novel', VISUAL_NOVEL: 'Visual Novel', VIDEO_GAME: 'Video Game', WEB_MANGA: 'Webcomic' }[m.source] ?? m.source,
      characters: m.characters.nodes.map((c) => c.name.full),
      credits: uniq([
        original && `Original work: ${original.name}`,
        director && `Director: ${director.name}`,
        music && `Music: ${music.name}`,
      ]),
      cover: { wiki: name },
    };
  },

  async tmdb(title) {
    const key = process.env.TMDB_API_KEY;
    if (!key) throw new Error('Set TMDB_API_KEY');
    const search = await getJson(`https://api.themoviedb.org/3/search/movie?api_key=${key}&query=${encodeURIComponent(title)}`);
    const hit = first(search.results);
    if (!hit) return null;
    const m = await getJson(`https://api.themoviedb.org/3/movie/${hit.id}?api_key=${key}&append_to_response=credits`);
    const crew = m.credits.crew;
    const director = crew.find((c) => c.job === 'Director');
    const writer = crew.find((c) => c.department === 'Writing');
    const composer = crew.find((c) => c.job === 'Original Music Composer');
    const animated = m.genres.some((g) => g.name === 'Animation');
    return {
      domain: 'cinema',
      name: m.title,
      year: Number(m.release_date?.slice(0, 4)),
      genres: m.genres.slice(0, 2).map((g) => g.name),
      studio: first(m.production_companies)?.name ?? 'Unknown',
      creator: director?.name ?? 'Unknown',
      origin: first(m.production_countries)?.name?.replace('United States of America', 'USA') ?? 'Unknown',
      format: animated ? 'Animated' : 'Live-action',
      characters: m.credits.cast.slice(0, 4).map((c) => c.character).filter(Boolean),
      credits: uniq([director && `Director: ${director.name}`, writer && `Writer: ${writer.name}`, composer && `Composer: ${composer.name}`]),
      // TMDB taglines make decent quote-round material; review before publishing.
      quote: m.tagline ? { text: m.tagline, speaker: 'The poster tagline' } : undefined,
      cover: { wiki: `${m.title} (film)` },
    };
  },

  async igdb(title) {
    const { IGDB_CLIENT_ID: id, IGDB_TOKEN: token } = process.env;
    if (!id || !token) throw new Error('Set IGDB_CLIENT_ID and IGDB_TOKEN');
    const body = `search "${title.replace(/"/g, '')}"; fields name,first_release_date,genres.name,platforms.name,
      involved_companies.company.name,involved_companies.company.country,involved_companies.developer; limit 1;`;
    const [g] = await getJson('https://api.igdb.com/v4/games', {
      method: 'POST',
      headers: { 'Client-ID': id, Authorization: `Bearer ${token}` },
      body,
    });
    if (!g) return null;
    const dev = g.involved_companies?.find((c) => c.developer)?.company;
    const family = (p) =>
      /playstation/i.test(p) ? 'PlayStation' : /xbox/i.test(p) ? 'Xbox' : /nintendo|switch|wii|game ?boy|3ds|\bds\b|famicom|snes|nes/i.test(p)
        ? 'Nintendo' : /pc|windows|mac|linux/i.test(p) ? 'PC' : /android|ios/i.test(p) ? 'Mobile' : /arcade/i.test(p) ? 'Arcade' : /sega|genesis|dreamcast/i.test(p) ? 'Sega' : null;
    const platforms = uniq((g.platforms ?? []).map((p) => family(p.name)));
    return {
      domain: 'games',
      name: g.name,
      year: new Date(g.first_release_date * 1000).getUTCFullYear(),
      genres: (g.genres ?? []).slice(0, 2).map((x) => x.name),
      studio: dev?.name ?? 'Unknown',
      creator: dev?.name ?? 'Unknown', // IGDB has no people data: replace with the director by hand.
      origin: 'Unknown', // IGDB country codes are ISO 3166 numeric; fill in by hand.
      format: platforms.length > 1 ? 'Multi-platform' : platforms[0] ?? 'PC',
      platforms,
      credits: uniq([dev && `Developer: ${dev.name}`]),
      cover: { wiki: g.name },
    };
  },

  async musicbrainz(title) {
    const search = await getJson(`https://musicbrainz.org/ws/2/release-group/?fmt=json&limit=1&query=${encodeURIComponent(`releasegroup:"${title}" AND primarytype:album`)}`);
    const rg = first(search['release-groups']);
    if (!rg) return null;
    await sleep(1100); // MusicBrainz rate limit
    const rel = await getJson(`https://musicbrainz.org/ws/2/release/?fmt=json&limit=1&release-group=${rg.id}&inc=recordings+labels+artist-credits`);
    const r = first(rel.releases);
    const artist = rg['artist-credit']?.map((a) => a.name + (a.joinphrase ?? '')).join('') ?? 'Unknown';
    const tracks = r?.media?.flatMap((m) => m.tracks.map((t) => t.title)) ?? [];
    return {
      domain: 'music',
      name: rg.title,
      subtitle: artist,
      aliases: [artist.toLowerCase()],
      year: Number(rg['first-release-date']?.slice(0, 4)),
      genres: (rg.tags ?? []).sort((a, b) => b.count - a.count).slice(0, 2).map((t) => t.name.replace(/\b\w/g, (c) => c.toUpperCase())),
      studio: first(r?.['label-info'])?.label?.name ?? 'Unknown',
      creator: artist,
      origin: r?.country ?? 'Unknown',
      format: 'Studio Album',
      // Reorder by hand: the Quote round reveals tracks from deep cut to biggest hit.
      tracks: tracks.slice(0, 4),
      credits: [`Artist: ${artist}`],
      cover: { wiki: `${rg.title} (album)` },
    };
  },
};

// ---------------------------------------------------------------- run

async function main() {
  if (provider === 'file') {
    const entries = JSON.parse(readFileSync(titles[0], 'utf8'));
    return insert(Array.isArray(entries) ? entries : [entries]);
  }
  const fetchOne = providers[provider];
  if (!fetchOne) {
    console.error(`Unknown provider "${provider}". Use one of: ${Object.keys(providers).join(', ')}, file`);
    process.exit(1);
  }
  const found = [];
  for (const t of titles) {
    try {
      const w = await fetchOne(t);
      if (w) found.push(w);
      else console.warn(`✗ not found: ${t}`);
    } catch (e) {
      console.warn(`✗ ${t}: ${e.message}`);
    }
    await sleep(provider === 'musicbrainz' ? 1100 : 250);
  }
  insert(found);
}

function insert(entries) {
  const byDomain = {};
  for (const e of entries) (byDomain[e.domain] ??= []).push(e);
  for (const [domain, list] of Object.entries(byDomain)) {
    const works = loadWorks(domain);
    const taken = new Set(works.map((w) => w.id));
    const names = new Set(works.map((w) => `${w.name.toLowerCase()}|${w.year}`));
    for (const e of list) {
      if (names.has(`${e.name.toLowerCase()}|${e.year}`)) {
        console.log(`= skipped (already present): ${e.name} (${e.year})`);
        continue;
      }
      e.id ??= makeId(domain, e.name, taken);
      taken.add(e.id);
      works.push(e);
      console.log(`+ ${e.id}  ${e.name} (${e.year})`);
    }
    if (!flags.dry) saveWorks(domain, works);
  }
  if (flags.dry) console.log('(dry run, nothing written)');
}

main();
