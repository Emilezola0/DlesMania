#!/usr/bin/env node
// Resolves media for works:
//   • cover / item / location images from their `wiki` article title (MediaWiki API, batched, no key).
//     Works without `cover.wiki` get one by searching Wikipedia for "<name> <year> <noun>".
//   • YouTube clip ids for `audio.query` (YouTube Data API v3, needs YOUTUBE_API_KEY).
//
//   node scripts/enrich-media.mjs [--domain=anime] [--force] [--dry] [--no-images] [--no-youtube]
//
// Existing `image` / `youtubeId` values are kept unless --force is passed.
import { DOMAINS, WIKIPEDIA_API, getJson, loadWorks, mediawikiGet, mediawikiImages, parseArgs, saveWorks, sleep } from './lib.mjs';

const { flags } = parseArgs();
const domains = flags.domain ? [flags.domain] : DOMAINS;
const force = !!flags.force;
const YT_KEY = process.env.YOUTUBE_API_KEY;
const NOUN = { games: 'video game', anime: 'anime', cinema: 'film', music: 'album' };
const IMAGE_WIDTH = 640;

const norm = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

/** True when a redirect target is still about the requested subject (every word of its name survives). */
function sameSubject(requested, target) {
  const compact = norm(target).replace(/ /g, '');
  return norm(requested.replace(/\(.*\)/, '')).split(' ').every((word) => compact.includes(word));
}

const wikiImages = (titles) => mediawikiImages(WIKIPEDIA_API, titles, IMAGE_WIDTH);
const wikiGet = (params) => mediawikiGet(WIKIPEDIA_API, params);

async function wikiSearch(query) {
  const d = await wikiGet({ action: 'query', list: 'search', srlimit: '1', srsearch: query });
  await sleep(500);
  return d.query?.search?.[0]?.title ?? null;
}

async function youtubeSearch(query) {
  const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&videoEmbeddable=true&maxResults=1&q=${encodeURIComponent(query)}&key=${YT_KEY}`;
  const d = await getJson(url);
  const item = d.items?.[0];
  return item ? { id: item.id.videoId, title: item.snippet.title } : null;
}

let changed = 0;
for (const domain of domains) {
  const works = loadWorks(domain);

  if (!flags['no-images']) {
    for (const w of works) {
      if (!w.cover?.wiki && (force || !w.cover?.image)) {
        const found = await wikiSearch(`${w.name} ${w.year} ${NOUN[domain]}`);
        if (found) {
          w.cover = { ...w.cover, wiki: found };
          console.log(`? ${w.id}: guessed cover article "${found}" — check it`);
        }
      }
    }
    const refs = works.flatMap((w) =>
      ['cover', 'item', 'location'].map((key) => ({ w, key, ref: w[key] })).filter(({ ref }) => ref?.wiki && (force || !ref.image)),
    );
    const resolved = await wikiImages(refs.map((r) => r.ref.wiki));
    for (const { w, key, ref } of refs) {
      let { image, title } = resolved.get(ref.wiki);
      if (title && norm(title) !== norm(ref.wiki)) {
        // Redirects often land on a franchise page whose image is the answer's logo or box art.
        const ok = sameSubject(ref.wiki, title);
        console.log(`! ${w.id}.${key}: "${ref.wiki}" redirects to "${title}"${ok ? '' : ' — image rejected'}`);
        if (!ok) image = null;
      }
      if (image) {
        ref.image = image;
        changed++;
        console.log(`✓ ${w.id}.${key} ← ${image}`);
      } else {
        // With --force, don't keep a stale image from an earlier (possibly wrong) lookup.
        delete ref.image;
        console.log(`✗ ${w.id}.${key}: no image for "${ref.wiki}"`);
      }
    }
  }

  for (const w of works) {
    if (!flags['no-youtube'] && YT_KEY && w.audio?.query && (force || !w.audio.youtubeId)) {
      const hit = await youtubeSearch(w.audio.query);
      if (hit) {
        w.audio.youtubeId = hit.id;
        changed++;
        console.log(`♪ ${w.id} ← ${hit.id} "${hit.title}"`);
      }
    }
  }
  if (!flags.dry) saveWorks(domain, works);
}
if (!YT_KEY && !flags['no-youtube']) console.log('\n(Set YOUTUBE_API_KEY to also resolve audio clips.)');
console.log(`\n${changed} field(s) updated${flags.dry ? ' (dry run, nothing written)' : ''}.`);
