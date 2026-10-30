// The For Honor Specialist's Execution rounds: every hero's executions from the For Honor wiki, where each
// "<Hero>/ExecutionsAndEmotes" page lists them as short YouTube videos (file pages whose metadata holds the
// video's id and length). Written to src/data/specialist/forhonor-executions.json as
// { hero, name, youtubeId, seconds }. The round shows up in the universe as soon as the file has entries.
// node scripts/build-forhonor-executions.mjs   (behind a proxy: NODE_USE_ENV_PROXY=1)
import { writeFileSync } from 'node:fs';

const API = 'https://forhonor.fandom.com/api.php';
const OUT = new URL('../src/data/specialist/forhonor-executions.json', import.meta.url);
const UA = { 'User-Agent': 'Omnidle-data-build/1.0 (fan project; https://github.com/Emilezola0/DlesMania)' };
/** Videos checked and found wrong (not an execution, or the wrong hero), by YouTube id. */
const REJECT = new Set([]);

// The heroes, as in src/specialist/simple.ts.
const HEROES = [
  'Warden', 'Conqueror', 'Peacekeeper', 'Lawbringer', 'Centurion', 'Gladiator', 'Black Prior', 'Warmonger', 'Gryphon',
  'Raider', 'Warlord', 'Berserker', 'Valkyrie', 'Highlander', 'Shaman', 'Jormungandr', 'Varangian Guard',
  'Kensei', 'Shugoki', 'Orochi', 'Nobushi', 'Shinobi', 'Aramusha', 'Hitokiri', 'Kyoshin', 'Sohei', 'Arakure',
  'Tiandi', 'Jiang Jun', 'Nuxia', 'Shaolin', 'Zhanhu', 'Juren', 'Pirate', 'Medjay', 'Afeera', 'Ocelotl', 'Khatun', 'Virtuosa',
];

async function api(params) {
  const res = await fetch(`${API}?${new URLSearchParams({ format: 'json', formatversion: '2', redirects: '1', ...params })}`, { headers: UA });
  if (!res.ok) throw new Error(`${JSON.stringify(params)}: HTTP ${res.status}`);
  return res.json();
}

const out = [];
const missing = [];
for (const hero of HEROES) {
  // Most pages are "<Hero>/ExecutionsAndEmotes"; a few are named the other way round.
  let page = `${hero}/ExecutionsAndEmotes`;
  let info = await api({ action: 'parse', page, prop: 'sections' }).catch(() => null);
  if (!info?.parse) {
    page = `${hero}/EmotesAndExecutions`;
    info = await api({ action: 'parse', page, prop: 'sections' }).catch(() => null);
  }
  const section = info?.parse?.sections.find((s) => /^executions?$/i.test(s.line.trim()));
  if (!section) {
    missing.push(hero);
    continue;
  }
  const files = (await api({ action: 'parse', page, section: section.index, prop: 'images' })).parse.images;
  const found = [];
  // 50 titles per query at most.
  for (let i = 0; i < files.length; i += 50) {
    const { query } = await api({ action: 'query', titles: files.slice(i, i + 50).map((f) => `File:${f}`).join('|'), prop: 'imageinfo', iiprop: 'mime|metadata' });
    for (const p of query.pages) {
      const ii = p.imageinfo?.[0];
      if (ii?.mime !== 'video/youtube') continue;
      const meta = Object.fromEntries((ii.metadata ?? []).map((m) => [m.name, m.value]));
      if (!meta.videoId || meta.canEmbed === false || REJECT.has(meta.videoId)) continue;
      found.push({ hero, name: (meta.title || p.title.replace(/^File:/, '')).replace(/\s*\(.*?\)\s*$/, '').trim(), youtubeId: meta.videoId, seconds: Math.max(3, Math.min(20, Math.round(meta.duration || 8))) });
    }
  }
  // The page's order, which is the game's.
  found.sort((a, b) => files.indexOf(a.name.replaceAll(' ', '_')) - files.indexOf(b.name.replaceAll(' ', '_')));
  out.push(...found);
  console.log(`${hero}: ${found.length} executions`);
}
writeFileSync(OUT, `${JSON.stringify(out, null, 2)}\n`);
console.log(`${out.length} executions for ${new Set(out.map((e) => e.hero)).size} heroes${missing.length ? ` · no Executions section: ${missing.join(', ')}` : ''}`);
