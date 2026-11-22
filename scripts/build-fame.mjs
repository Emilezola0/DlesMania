// How well known each work is: its English Wikipedia article's page views over twelve months (Wikimedia's public
// pageviews API), saved to src/data/fame.json as { workId: views }. The dailies use it to order a day's rounds from
// easy to hard (src/lib/difficulty.ts). A song counts its `cover.wiki` article: its album, or its game or anime.
//
//   node scripts/build-fame.mjs            all works
//   node scripts/build-fame.mjs --missing  only works not measured yet (new works, or a run that was refused)
//
// Wikimedia refuses bursts (HTTP 429): one request at a time, waiting longer after each refusal. A work whose article
// couldn't be measured (refused, or no article by its `cover.wiki` title) is left out of the file: it then counts as
// middling, never as the least known.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const DOMAINS = ['games', 'anime', 'cinema', 'music'];
const OUT = 'src/data/fame.json';
const FROM = '20251101';
const TO = '20261031';
const UA = 'OmnidleFame/1.0 (pageviews for a quiz game)';

const works = DOMAINS.flatMap((d) => JSON.parse(readFileSync(`src/data/works/${d}.json`, 'utf8')));
const old = existsSync(OUT) ? JSON.parse(readFileSync(OUT, 'utf8')) : {};
const todo = process.argv.includes('--missing') ? works.filter((w) => !(w.id in old)) : works;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
/** The JSON at `url`; null for a missing article; undefined when it couldn't be had (refused too long). */
async function get(url) {
  for (let i = 0; i < 8; i++) {
    const res = await fetch(url, { headers: { 'User-Agent': UA } }).catch(() => null);
    if (res?.ok) return res.json();
    if (res?.status === 404) return null;
    const wait = Number(res?.headers.get('retry-after')) || 5 * 2 ** i;
    await sleep(Math.min(wait, 120) * 1000);
  }
  return undefined;
}

// Article titles as Wikipedia has them now (redirects followed), 50 at a time.
const titles = [...new Set(todo.map((w) => w.cover?.wiki ?? w.name))];
const canonical = new Map(titles.map((t) => [t, t]));
for (let i = 0; i < titles.length; i += 50) {
  const batch = titles.slice(i, i + 50);
  const q = await get(`https://en.wikipedia.org/w/api.php?action=query&format=json&redirects=1&titles=${encodeURIComponent(batch.join('|'))}`);
  const norm = new Map((q?.query?.normalized ?? []).map((n) => [n.from, n.to]));
  const redir = new Map((q?.query?.redirects ?? []).map((r) => [r.from, r.to]));
  for (const t of batch) {
    const n = norm.get(t) ?? t;
    canonical.set(t, redir.get(n) ?? n);
  }
}

const views = new Map();
let done = 0;
async function measure(title) {
  if (views.has(title)) return;
  const path = encodeURIComponent(title.replace(/ /g, '_'));
  const r = await get(`https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/en.wikipedia/all-access/user/${path}/monthly/${FROM}/${TO}`);
  // No views at all means no article by that title (a `cover.wiki` that doesn't match one): not measured.
  const n = r?.items?.reduce((s, x) => s + x.views, 0);
  if (n) views.set(title, n);
  await sleep(250);
  if (++done % 100 === 0) console.log(`${done} articles…`);
}
const queue = [...new Set(canonical.values())];
for (const title of queue) await measure(title);

const out = { ...old };
for (const w of todo) {
  const v = views.get(canonical.get(w.cover?.wiki ?? w.name));
  if (v === undefined) delete out[w.id];
  else out[w.id] = v;
}
const sorted = Object.fromEntries(Object.entries(out).sort(([a], [b]) => a.localeCompare(b)));
writeFileSync(OUT, JSON.stringify(sorted, null, 1) + '\n');
const missed = todo.filter((w) => !(w.id in out)).map((w) => w.id);
console.log(`${todo.length - missed.length}/${todo.length} works measured; not measured (no article by that title, or refused: run again with --missing): ${missed.join(', ') || 'none'}`);
