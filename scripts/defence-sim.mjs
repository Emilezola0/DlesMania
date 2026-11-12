// Balance check for the Defence Deck (src/friends/defence.ts): thousands of random battles between teams made within
// the budget, from a pool shaped like the real cards (rarities, elements, places and techniques, grades, anomalies).
// Prints how often teams win by what they hold, so no rarity, element or card kind wins too often.
//   node --experimental-strip-types scripts/defence-sim.mjs [battles]
import { readFileSync } from 'node:fs';
import { ARENAS, BASIC, DEFENCE, costOf, fight } from '../src/friends/defence.ts';

const N = Number(process.argv[2] ?? 40000);
const ELEMENTS = JSON.parse(readFileSync(new URL('../src/data/card-elements.json', import.meta.url), 'utf8'));

let seed = 12345;
const rand = () => {
  seed = (seed + 0x6d2b79f5) >>> 0;
  let t = seed;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const pick = (a) => a[Math.floor(rand() * a.length)];

// The pool: the hand-picked top cards as they are, and the rest by the real counts.
const COUNTS = { common: 3695, rare: 2338, epic: 548 };
const SETS = ['onepiece', 'dbz', 'naruto', 'starwars', 'lol', 'genshin', 'mcu', 'hsr', 'wow', 'shrek', 'mha', 'bg3'];
const pool = [];
for (const [id, element] of Object.entries(ELEMENTS)) {
  const rarity = id.includes('omni') || /:omni/.test(id) ? 'omni' : id.includes('mythic') ? 'mythic' : 'legendary';
  pool.push({ id, set: id.split(':')[0], rarity, element, kind: id.includes(':tech-') ? 'technique' : id.includes(':place-') ? 'place' : 'fighter' });
}
let n = 0;
for (const [rarity, count] of Object.entries(COUNTS))
  for (let k = 0; k < count / 10; k++) {
    const r = rand();
    pool.push({ id: `x${n++}`, set: pick(SETS), rarity, element: pick(BASIC), kind: r < 0.006 ? 'technique' : r < 0.009 ? 'place' : 'fighter' });
  }
// Places and techniques are rare in the real pool; a few more here so their effect shows in the numbers.
for (let k = 0; k < 40; k++) pool.push({ id: `t${k}`, set: pick(SETS), rarity: pick(['rare', 'epic', 'common']), element: pick(BASIC), kind: k % 2 ? 'technique' : 'place' });
const ANOMALIES = ['corrupted', 'fake', 'inverted', 'mirror', 'timelost', 'void'];
const card = (c) => ({ ...c, grade: rand() < 0.6 ? 1 + Math.floor(rand() * 3) : 1 + Math.floor(rand() * 8), anomaly: rand() < 0.04 ? pick(ANOMALIES) : null });

/** A team a player would make: five cards within the budget, using most of it. */
function team(from = pool) {
  let best = null;
  for (let t = 0; t < 25; t++) {
    const cards = [];
    const ids = new Set();
    while (cards.length < DEFENCE.size) {
      const c = pick(from);
      if (!ids.has(c.id)) (ids.add(c.id), cards.push(card(c)));
    }
    const cost = costOf(cards);
    if (cost <= DEFENCE.budget && (!best || cost > costOf(best))) best = cards;
  }
  return best ?? team(from.filter((c) => c.rarity !== 'omni' && c.rarity !== 'mythic'));
}
const shuffle = (a) => a.map((x) => [rand(), x]).sort((p, q) => p[0] - q[0]).map((p) => p[1]);

const stat = new Map();
const add = (key, won) => {
  const s = stat.get(key) ?? { n: 0, w: 0 };
  s.n++;
  s.w += won ? 1 : 0;
  stat.set(key, s);
};
let attackerWins = 0;
let lengths = 0;
const how = {};
for (let b = 0; b < N; b++) {
  const A = team();
  const D = team();
  const arena = pick(ARENAS);
  const r = fight(A, D, arena, `s${b}`);
  if (r.winner === 'a') attackerWins++;
  how[r.how] = (how[r.how] ?? 0) + 1;
  lengths += r.events.filter((e) => e.t === 'duel').length;
  for (const [side, t] of [['a', A], ['d', D]]) {
    const won = r.winner === side;
    const omnis = t.filter((c) => c.rarity === 'omni').length;
    const top = t.filter((c) => ['legendary', 'mythic', 'omni'].includes(c.rarity)).length;
    add(`omnis ${omnis}`, won);
    add(`top cards ${top}`, won);
    add(`cost ${costOf(t)}`, won);
    for (const e of new Set(t.map((c) => c.element))) add(`has ${e}`, won);
    for (const k of new Set(t.map((c) => c.kind))) add(`has ${k}`, won);
    for (const c of t) if (c.anomaly) add(`anomaly ${c.anomaly}`, won);
    const g = t.reduce((s, c) => s + c.grade, 0) / t.length;
    add(`avg grade ${g < 2 ? '<2' : g < 4 ? '2-4' : '4+'}`, won);
  }
}

// Does the order matter? A defence played in each of several orders against the same attack.
let orderSpread = 0;
for (let b = 0; b < 2000; b++) {
  const A = team();
  const D = team();
  const arena = pick(ARENAS);
  let w = 0;
  for (let k = 0; k < 10; k++) if (fight(shuffle(A), D, arena, `o${b}`).winner === 'a') w++;
  orderSpread += w > 0 && w < 10 ? 1 : 0;
}

// A thinking attacker: from 12 cards of their own, the team and order that beats most orders of the defence they see.
let smart = 0;
const SMART = 600;
for (let b = 0; b < SMART; b++) {
  const D = team();
  const arena = pick(ARENAS);
  const mine = Array.from({ length: 12 }, () => pick(pool));
  let best = null;
  let bestScore = -1;
  for (let t = 0; t < 30; t++) {
    const cand = team(mine);
    let s = 0;
    for (let k = 0; k < 6; k++) if (fight(cand, shuffle(D), arena, `m${b}${k}`).winner === 'a') s++;
    if (s > bestScore) (bestScore = s), (best = cand);
  }
  if (fight(best, shuffle(D), arena, `final${b}`).winner === 'a') smart++;
}

const pct = (x) => `${(100 * x).toFixed(1)}%`;
console.log(`${N} battles · attacker wins ${pct(attackerWins / N)} · ${(lengths / N).toFixed(1)} duels a battle · ends: ${Object.entries(how).map(([k, v]) => `${k} ${pct(v / N)}`).join(', ')}`);
console.log(`order matters (same cards, another order changes the result) in ${pct(orderSpread / 2000)} of match-ups`);
console.log(`a thinking attacker (12 cards to choose from, sees the defence) wins ${pct(smart / SMART)}`);
const rows = [...stat].sort((p, q) => p[0].localeCompare(q[0], 'en', { numeric: true }));
for (const [k, s] of rows) if (s.n > 200) console.log(`  ${k.padEnd(20)} wins ${pct(s.w / s.n).padStart(6)}  (${s.n})`);
