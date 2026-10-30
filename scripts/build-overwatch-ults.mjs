// The Overwatch Specialist's Ultimate Cost round: every hero's ultimate and its charge cost (points), from
// the "ult_req" of the ultimate's Ability_details on the hero's Overwatch wiki page. Costs change with
// patches: re-run after a balance update.
// node scripts/build-overwatch-ults.mjs   (behind a proxy: NODE_USE_ENV_PROXY=1)
import { readFileSync, writeFileSync } from 'node:fs';

const API = 'https://overwatch.fandom.com/api.php';
const OUT = new URL('../src/data/overwatch-ults.json', import.meta.url);
const UA = { 'User-Agent': 'Omnidle-data-build/1.0 (fan project; https://github.com/Emilezola0/DlesMania)' };
const heroes = JSON.parse(readFileSync(new URL('../src/data/overwatch-voices.json', import.meta.url), 'utf8')).map((h) => h.name);

const out = [];
for (const hero of heroes) {
  const url = `${API}?${new URLSearchParams({ action: 'parse', page: hero, prop: 'wikitext', format: 'json', formatversion: '2', redirects: '1' })}`;
  const text = (await (await fetch(url, { headers: UA })).json()).parse?.wikitext ?? '';
  const blocks = text.split(/\{\{\s*Ability[_ ]details/i).slice(1);
  const ult = blocks.find((b) => /\|\s*ability_type\s*=\s*Ultimate/i.test(b) && /\|\s*ult_req\s*=/.test(b));
  const name = ult?.match(/\|\s*ability_name\s*=\s*([^\n|]+)/)?.[1].trim();
  const cost = Number(ult?.match(/\|\s*ult_req\s*=\s*([\d,]+)/)?.[1].replace(/,/g, ''));
  if (name && cost) out.push({ hero, ultimate: name, cost });
  console.log(`${hero}: ${name ?? '?'} ${cost || '?'}`);
}
writeFileSync(OUT, JSON.stringify(out, null, 1) + '\n');
console.log(`${out.length} ultimates`);
