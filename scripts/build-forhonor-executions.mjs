// The For Honor Specialist's Execution rounds: each hero's executions as animated GIFs from the For Honor
// wiki (the "Executions" section of every hero page), written to src/data/specialist/forhonor-executions.json
// as { hero, name, gif }. The round shows up in the universe as soon as the file has entries.
// The execution's name is read from the picture's caption, else from its file name; check a few by eye,
// and put mismatches in REJECT.
// node scripts/build-forhonor-executions.mjs
import { writeFileSync } from 'node:fs';

const API = 'https://forhonor.fandom.com/api.php';
const OUT = new URL('../src/data/specialist/forhonor-executions.json', import.meta.url);
const UA = { 'User-Agent': 'Omnidle-data-build/1.0 (fan project; https://github.com/Emilezola0/DlesMania)' };
/** GIFs checked and found wrong (not an execution, or the wrong hero). */
const REJECT = new Set([]);

// The heroes, as in src/specialist/simple.ts.
const HEROES = [
  'Warden', 'Conqueror', 'Peacekeeper', 'Lawbringer', 'Centurion', 'Gladiator', 'Black Prior', 'Warmonger', 'Gryphon',
  'Raider', 'Warlord', 'Berserker', 'Valkyrie', 'Highlander', 'Shaman', 'Jormungandr', 'Varangian Guard',
  'Kensei', 'Shugoki', 'Orochi', 'Nobushi', 'Shinobi', 'Aramusha', 'Hitokiri', 'Kyoshin', 'Sohei', 'Arakure',
  'Tiandi', 'Jiang Jun', 'Nuxia', 'Shaolin', 'Zhanhu', 'Juren', 'Pirate', 'Medjay', 'Afeera', 'Ocelotl', 'Khatun', 'Virtuosa',
];

async function parse(params) {
  const res = await fetch(`${API}?${new URLSearchParams({ action: 'parse', format: 'json', formatversion: '2', redirects: '1', ...params })}`, { headers: UA });
  if (!res.ok) throw new Error(`${params.page}: HTTP ${res.status}`);
  return res.json();
}

const decode = (s) => s.replaceAll('&amp;', '&').replaceAll('&#39;', "'").replaceAll('&quot;', '"');
/** The full-size file: no /scale-to-width-down/…, the revision kept. */
const full = (url) => decode(url).replace(/\/scale-to-width(-down)?\/\d+/, '');
/** "Warden_Execution_Coup_de_Grace.gif" → "Coup de Grace". */
function nameFromFile(url, hero) {
  const file = decodeURIComponent(url.split('/images/')[1]?.split('/')[2] ?? '').replace(/\.gif$/i, '').replaceAll('_', ' ');
  return file.replace(new RegExp(`^${hero}\\s*`, 'i'), '').replace(/^(execution|exec)\s*[-:]?\s*/i, '').trim() || file;
}

const out = [];
for (const hero of HEROES) {
  const page = hero.replaceAll(' ', '_');
  const info = await parse({ page, prop: 'sections' }).catch((e) => (console.warn(String(e)), null));
  const section = info?.parse?.sections.find((s) => /^executions?$/i.test(s.line.trim()));
  if (!section) {
    console.warn(`${hero}: no Executions section`);
    continue;
  }
  const { parse: body } = await parse({ page, section: section.index, prop: 'text' });
  const html = body.text;
  const seen = new Set();
  // Every GIF of the section, with the caption that follows it when there is one.
  for (const m of html.matchAll(/(?:src|data-src)="(https:\/\/static\.wikia\.nocookie\.net\/[^"]+?\.gif[^"]*)"[\s\S]*?(?:<figcaption[^>]*>([\s\S]*?)<\/figcaption>|(?=<img)|$)/gi)) {
    const gif = full(m[1]);
    const key = gif.split('/revision/')[0];
    if (seen.has(key) || REJECT.has(key)) continue;
    seen.add(key);
    const caption = m[2] ? decode(m[2].replace(/<[^>]+>/g, '')).trim() : '';
    out.push({ hero, name: caption || nameFromFile(gif, hero), gif });
  }
  console.log(`${hero}: ${seen.size} executions`);
}
writeFileSync(OUT, `${JSON.stringify(out, null, 2)}\n`);
console.log(`${out.length} executions for ${new Set(out.map((e) => e.hero)).size} heroes`);
