// Traits for the Specialist's Classic rounds of Overwatch and For Honor, from the heroes' infoboxes on
// the Overwatch wiki (role, sub-role, nationality, health, age) and the For Honor wiki (faction, class,
// gender, health). Re-run after new heroes or balance changes.
// node scripts/build-classic-traits.mjs   (behind a proxy: NODE_USE_ENV_PROXY=1)
import { readFileSync, writeFileSync } from 'node:fs';

const OUT = new URL('../src/data/specialist/classic-traits.json', import.meta.url);
const UA = { 'User-Agent': 'Omnidle-data-build/1.0 (fan project; https://github.com/Emilezola0/DlesMania)' };
const wikitext = async (api, page) => {
  const url = `${api}?${new URLSearchParams({ action: 'parse', page, prop: 'wikitext', format: 'json', formatversion: '2', redirects: '1' })}`;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return (await (await fetch(url, { headers: UA })).json()).parse?.wikitext ?? '';
    } catch {
      await new Promise((r) => setTimeout(r, 1500));
    }
  }
  return '';
};
/** A field of an infobox (its whole line), its wiki markup taken out: links, templates, refs, line breaks. */
const field = (text, name) => {
  const m = new RegExp(`\\|\\s*${name}\\s*=([^\\n]*)`, 'i').exec(text);
  if (!m) return '';
  return m[1]
    .replace(/<ref[^>]*\/>|<ref[^>]*>.*?<\/ref>/g, '')
    .replace(/<br\s*\/?>.*$/i, '')
    .replace(/\{\{flag\|[^}]*\}\}/gi, '')
    .replace(/\[\[(?:[^\]|]*\|)?([^\]]*)\]\]/g, '$1')
    .replace(/\{\{[^}]*\}\}/g, '')
    .replace(/''+/g, '')
    .split(/\s*\|\s*/)[0]
    .replace(/[\u{E0000}-\u{E007F}]/gu, '')
    .trim();
};
/** For Honor's own spellings, made one: "Knight" and "Knights", "Heavy" and "Heavies", "Female (locked)". */
const FH_FIX = { Knight: 'Knights', Viking: 'Vikings', 'The Outlanders': 'Outlanders', Heavies: 'Heavy' };
const fh = (v) => FH_FIX[v] ?? v;

const out = { overwatch: {}, forhonor: {} };

const owHeroes = JSON.parse(readFileSync(new URL('../src/data/overwatch-voices.json', import.meta.url), 'utf8')).map((h) => h.name);
for (const hero of owHeroes) {
  const t = await wikitext('https://overwatch.fandom.com/api.php', hero);
  const age = Number(/\d+/.exec(field(t, 'age'))?.[0]);
  const health = Number(/\d+/.exec(field(t, 'health'))?.[0]);
  const nationality = field(t, 'nationality').replace(/\(.*?\)/g, '').trim();
  const traits = { Role: field(t, 'role'), 'Sub-role': field(t, 'sub-role'), Nationality: nationality, Health: health ? String(health) : '', Age: age ? String(age) : '' };
  out.overwatch[hero] = Object.fromEntries(Object.entries(traits).filter(([, v]) => v));
  console.log('OW', hero, JSON.stringify(out.overwatch[hero]));
}

const FH = ['Warden', 'Conqueror', 'Peacekeeper', 'Lawbringer', 'Centurion', 'Gladiator', 'Black Prior', 'Warmonger', 'Gryphon', 'Raider', 'Warlord', 'Berserker', 'Valkyrie', 'Highlander', 'Shaman', 'Jormungandr', 'Varangian Guard', 'Kensei', 'Shugoki', 'Orochi', 'Nobushi', 'Shinobi', 'Aramusha', 'Hitokiri', 'Kyoshin', 'Sohei', 'Arakure', 'Tiandi', 'Jiang Jun', 'Nuxia', 'Shaolin', 'Zhanhu', 'Juren', 'Pirate', 'Medjay', 'Afeera', 'Ocelotl', 'Khatun', 'Virtuosa'];
for (const hero of FH) {
  const t = await wikitext('https://forhonor.fandom.com/api.php', `${hero}/Main`);
  const health = Number(/\d+/.exec(field(t, 'health'))?.[0]);
  const gender = field(t, 'gender').replace(/\(.*?\)/g, '').replace(/\s*\/\s*/g, ' / ').trim();
  const traits = { Faction: fh(field(t, 'faction')), Class: fh(field(t, 'hero_type')), Gender: gender === 'Male / Female' || gender === 'Female / Male' ? 'Both' : gender, Health: health ? String(health) : '' };
  out.forhonor[hero] = Object.fromEntries(Object.entries(traits).filter(([, v]) => v));
  console.log('FH', hero, JSON.stringify(out.forhonor[hero]));
}
writeFileSync(OUT, JSON.stringify(out, null, 1) + '\n');
