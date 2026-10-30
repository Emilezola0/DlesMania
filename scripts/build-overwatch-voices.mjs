// The Voice Line game's data: each Overwatch hero's voice lines, as links to the Overwatch wiki's own
// recordings (its "Voice Lines" section of every hero's Quotes page). Heroes with too few are left out.
// node scripts/build-overwatch-voices.mjs
import { writeFileSync } from 'node:fs';

const API = 'https://overwatch.fandom.com/api.php';
const OUT = new URL('../src/data/overwatch-voices.json', import.meta.url);
const MIN_LINES = 5;
const UA = { 'User-Agent': 'Omnidle-data-build/1.0 (fan project; https://github.com/Emilezola0/DlesMania)' };

async function parse(params) {
  const res = await fetch(`${API}?${new URLSearchParams({ action: 'parse', format: 'json', formatversion: '2', redirects: '1', ...params })}`, { headers: UA });
  if (!res.ok) throw new Error(`${params.page ?? params.section}: HTTP ${res.status}`);
  return res.json();
}

const { parse: index } = await parse({ page: 'Voice_lines', prop: 'links' });
const heroes = index.links.map((l) => l.title).filter((t) => t.endsWith('/Quotes')).map((t) => t.slice(0, -'/Quotes'.length));

/** The hero's icon on the wiki. */
async function imageOf(name) {
  const file = `File:Icon-${name.replaceAll(':', '').replaceAll(' ', '_')}.png`;
  const res = await fetch(`${API}?${new URLSearchParams({ action: 'query', format: 'json', formatversion: '2', prop: 'imageinfo', iiprop: 'url', titles: file })}`, { headers: UA });
  const data = await res.json();
  return data.query?.pages?.[0]?.imageinfo?.[0]?.url;
}

const out = [];
for (const name of heroes) {
  const page = `${name}/Quotes`;
  const { parse: info } = await parse({ page, prop: 'sections' }).catch(() => ({ parse: null }));
  const section = info?.sections.find((s) => /^voice lines$/i.test(s.line));
  if (!section) continue;
  const { parse: body } = await parse({ page, section: section.index, prop: 'text' });
  const lines = [...new Set([...body.text.matchAll(/https:\/\/static\.wikia\.nocookie\.net\/overwatch_gamepedia\/images\/[^"' ]+?\.(?:ogg|mp3|wav)[^"' ]*/g)].map((m) => m[0].replaceAll('&amp;', '&')))];
  if (lines.length < MIN_LINES) continue;
  const image = await imageOf(name.replaceAll('_', ' '));
  out.push({ name: name.replaceAll('_', ' '), image, lines });
  console.log(`${name}: ${lines.length} lines${image ? '' : ' (no picture)'}`);
}
out.sort((a, b) => a.name.localeCompare(b.name));
writeFileSync(OUT, `${JSON.stringify(out, null, 0)}\n`);
console.log(`${out.length} heroes, ${out.reduce((n, h) => n + h.lines.length, 0)} lines`);
