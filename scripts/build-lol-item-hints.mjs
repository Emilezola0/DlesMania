// LoL's Signature (Boss Battle secret phase): four hints per item, from Riot's Data Dragon item list —
// the stats the clue leaves out, who usually buys it, what it's built from, and its passive/active last.
// Writes them into src/data/bosses.json (each LoL Signature clue's `hints`).
//   NODE_USE_ENV_PROXY=1 NODE_EXTRA_CA_CERTS=/root/.ccr/ca-bundle.crt node scripts/build-lol-item-hints.mjs
import { readFileSync, writeFileSync } from 'node:fs';

const FILE = new URL('../src/data/bosses.json', import.meta.url);
const versions = await (await fetch('https://ddragon.leagueoflegends.com/api/versions.json')).json();
const { data } = await (await fetch(`https://ddragon.leagueoflegends.com/cdn/${versions[0]}/data/en_US/item.json`)).json();

// Summoner's Rift items only (the clues' stats and prices are Summoner's Rift ones).
const rift = Object.entries(data).filter(([id, it]) => it.maps?.['11'] && Number(id) < 100000);
const byName = new Map();
for (const [id, it] of rift) if (!byName.has(it.name) || Number(id) < Number(byName.get(it.name).id)) byName.set(it.name, { id, ...it });

const strip = (s) => s.replace(/<br\s*\/?>/g, '\n').replace(/<[^>]+>/g, '').replace(/[ \t]+/g, ' ');
const key = (s) => s.toLowerCase().replace(/[^a-z]/g, '');

/** "50 Ability Power" lines from the item's stats block. */
const statsOf = (it) => {
  const m = it.description.match(/<stats>([\s\S]*?)<\/stats>/);
  return m ? strip(m[1]).split('\n').map((l) => l.trim()).filter(Boolean) : [];
};
/** Its passives' and actives' names ("Spellblade", "Inspiring Speech"). */
const powersOf = (it) => {
  const seen = new Set();
  return [...it.description.matchAll(/<(passive|active)>([^<]+)<\/\1>/g)].map((m) => ({ kind: m[1] === 'active' ? 'Active' : 'Passive', name: m[2].trim() })).filter((p) => !seen.has(p.name) && seen.add(p.name));
};

/** Who usually buys it, from the item's tags and stats. */
function buyers(it) {
  const t = new Set(it.tags);
  const st = statsOf(it).join(' ');
  const out = [];
  const tank = t.has('Health') && (t.has('Armor') || t.has('SpellBlock')) && !t.has('Damage') && !t.has('SpellDamage');
  if (/Lethality/.test(st)) out.push('assassins');
  if (t.has('CriticalStrike') || (t.has('AttackSpeed') && !t.has('Health') && !t.has('SpellDamage'))) out.push('marksmen');
  if (t.has('SpellDamage') && !t.has('Damage')) out.push(t.has('ManaRegen') || /Heal and Shield Power/.test(st) ? 'enchanter supports' : 'mages');
  if (t.has('SpellDamage') && t.has('Damage')) out.push('on-hit carries');
  if (t.has('Health') && t.has('Damage') && !t.has('CriticalStrike')) out.push('fighters');
  if (tank) out.push(it.gold.total <= 2400 ? 'tank supports' : 'tanks');
  if (t.has('LifeSteal') && !out.includes('fighters')) out.push('fighters');
  const list = [...new Set(out)].slice(0, 3);
  if (!list.length) return null;
  return `Usually bought by ${list.length > 1 ? `${list.slice(0, -1).join(', ')} and ${list.at(-1)}` : list[0]}`;
}

const bosses = JSON.parse(readFileSync(FILE, 'utf8'));
const lol = bosses.find((b) => b.id === 'lol');
let done = 0;
const missing = [];
for (const clue of lol.signature.clues) {
  const names = clue.answer.split('|');
  const it = names.map((n) => byName.get(n)).find(Boolean);
  if (!it) {
    missing.push(names[0]);
    continue;
  }
  // Words of the item's name, so no hint gives it away.
  const giveaway = (s) => names[0].split(/\s+/).some((w) => w.replace(/[^a-z]/gi, '').length > 3 && key(s).includes(key(w)));
  const shown = key(clue.text ?? '');
  // 1 — the stats the clue doesn't show (haste, crit damage, mana regen...), or what combining it costs.
  const extra = statsOf(it).filter((l) => !shown.includes(key(l.replace(/^[\d.%+]+\s*/, ''))));
  const h1 = extra.length ? `Its other stats: ${extra.map((l) => `+${l}`).join(' · ')}` : `Combining its parts costs ${it.gold.base.toLocaleString('en-US')} gold`;
  // 2 — who buys it.
  const h2 = buyers(it) ?? `Combining its parts costs ${it.gold.base.toLocaleString('en-US')} gold`;
  // 3 — what it's built from.
  const parts = (it.from ?? []).map((id) => data[id]?.name).filter(Boolean);
  const counts = new Map();
  for (const n of parts) counts.set(n, (counts.get(n) ?? 0) + 1);
  const h3 = parts.length ? `Built from: ${[...counts].map(([n, k]) => (k > 1 ? `${k}× ${n}` : n)).join(' + ')}` : `Sells back for ${it.gold.sell.toLocaleString('en-US')} gold`;
  // 4 — its passive / active, always last.
  const powers = powersOf(it).filter((p) => !giveaway(p.name));
  const effect = clue.effect ?? strip(it.plaintext || '');
  const h4 = powers.length ? `${powers.map((p) => `${p.kind} “${p.name}”`).join(', ')}: ${effect.replace(/^(Active|Passive): /, '')}` : effect;
  clue.hints = [h1, h2, h3, h4].map((h) => h.trim());
  done++;
}
writeFileSync(FILE, JSON.stringify(bosses, null, 2) + '\n');
console.log(`${done} items hinted (Data Dragon ${versions[0]})`, missing.length ? `— not found: ${missing.join(', ')}` : '');
