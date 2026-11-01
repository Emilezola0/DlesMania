// What each grammar point of the list means, shown once a grammar question is answered (JLPT): the list
// (src/data/jlpt.json, Coto Academy's) gives the patterns only, so each one's translation comes from
// where it's already written — Bunpro's grammar points (bunpro.jp), JLPT Sensei's grammar lists
// (jlptsensei.com) and, for a few words, JMdict through Jisho (jisho.org, CC BY-SA). Nothing is written
// here: a pattern is matched to the same pattern in a source (by its kana: kanji read out, ～ and です/だ
// left out), the matches that aren't what the list means are named in NOT, and a pattern no source has
// keeps no translation. The French is in src/data/jlpt-grammar-fr.json (the English's translation), kept
// as it is when this runs again.
//   KUROMOJI=/tmp/tok/node_modules/kuromoji NODE_USE_ENV_PROXY=1 node scripts/build-jlpt-grammar.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const ROOT = new URL('..', import.meta.url).pathname;
const require = createRequire(import.meta.url);
const K = process.env.KUROMOJI;
if (!K) throw new Error('Set KUROMOJI (the kuromoji package folder, outside the project).');
const kuromoji = require(K);
const tok = await new Promise((ok, ko) => kuromoji.builder({ dicPath: K + '/dict' }).build((e, t) => (e ? ko(e) : ok(t))));
const jlpt = JSON.parse(readFileSync(ROOT + 'src/data/jlpt.json', 'utf8'));

const page = async (url) => {
  for (let i = 0; i < 4; i++) {
    try {
      const r = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0' } });
      if (r.ok) return r.text();
      if (r.status === 404) return null;
    } catch {
      // Tried again.
    }
    await new Promise((ok) => setTimeout(ok, 2000 * 2 ** i));
  }
  throw new Error(`no answer from ${url}`);
};
const text = (s) => s.replace(/<[^>]+>/g, '').replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n)).replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16))).replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#039;|&apos;/g, "'").replace(/&nbsp;/g, ' ').trim();

// ── Bunpro: every grammar point, its meaning and its level ──
const bunpro = [];
for (const chunk of (await page('https://bunpro.jp/grammar_points')).split('<li id="GrammarPoint-').slice(1)) {
  const h = /<h4[^>]*>([\s\S]*?)<\/h4>/.exec(chunk);
  const p = /<p class="line-clamp-1 text-secondary-fg">([\s\S]*?)<\/p>/.exec(chunk);
  const lv = /<span>(N[1-5])<\/span>/.exec(chunk);
  if (h && p) bunpro.push({ title: text(h[1]), meaning: text(p[1]), level: lv?.[1] ?? '', src: 'Bunpro' });
}
// ── JLPT Sensei: each level's list, page by page ──
const sensei = [];
for (const n of [5, 4, 3, 2, 1])
  for (let p = 1; p < 10; p++) {
    // A page now and then comes back without its list: asked again before moving on.
    let rows = [];
    for (let tries = 0; tries < 4 && !rows.length; tries++) {
      const html = await page(`https://jlptsensei.com/jlpt-n${n}-grammar-list/${p > 1 ? `page/${p}/` : ''}`);
      if (!html) break;
      rows = [...html.matchAll(/class="jl-td-gj[^"]*"><a[^>]*>([\s\S]*?)<\/a><td class="jl-td-gm[^"]*">([\s\S]*?)(?=<tr|<\/t|$)/g)];
      if (!rows.length) await new Promise((ok) => setTimeout(ok, 3000));
    }
    if (!rows.length) break;
    for (const m of rows) sensei.push({ title: text(m[1]), meaning: text(m[2]), level: `N${n}`, src: 'JLPT Sensei' });
  }
console.log(`Bunpro ${bunpro.length} · JLPT Sensei ${sensei.length} (${[5, 4, 3, 2, 1].map((n) => sensei.filter((x) => x.level === `N${n}`).length).join('/')})`);

const hira = (s) => s.replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60));
/** A form as kana: kanji read out, placeholders and marks gone. */
const kana = (s) => hira(tok.tokenize(s).map((t) => (/[\p{Script=Han}]/u.test(t.surface_form) && t.reading ? t.reading : t.surface_form)).join('')).replace(/[^ぁ-ゖー]/g, '');
const bare = (s) => s.replace(/stem \+|Dictionary form\+|Number\+|N\+|\(period\)|\(frequency\)|[ABＡＢ]/g, '');
/** Every way a title or pattern can be written: its alternatives (a/b, a kanji's reading in brackets), as kana; `strict` keeps them whole. */
function keys(s, strict = false) {
  const alts = new Set();
  const base = bare(s);
  const outBr = base.replace(/[（(][^）)]*[）)]/g, '');
  const whole = kana(outBr);
  // The written alternatives (a/b, a・b) and the whole, and a bracket's reading when it stands for the whole
  // ("すぎない（過ぎない）"), not when it's only part of it ("～からなる(成る)": 成る).
  for (const a of [outBr, ...outBr.split(/[\/／・]/)]) {
    const k = kana(a);
    if (k) alts.add(k);
  }
  for (const m of base.matchAll(/[（(]([^）)]+)[）)]/g)) {
    for (const a of m[1].split(/[\/／・]/)) {
      const k = kana(a);
      if (k && k.length >= whole.length * 0.7) alts.add(k);
    }
  }
  const out = [...alts];
  if (strict) return out;
  const more = new Set(out);
  for (const k of out) {
    for (const tail of ['です', 'だ', 'である', 'ですか']) if (k.endsWith(tail) && k.length > tail.length + 1) more.add(k.slice(0, -tail.length));
    if (k.endsWith('ません')) more.add(k.slice(0, -3) + 'ない');
    if (k.includes('なに')) more.add(k.replace('なに', 'なん'));
    if (k.startsWith('の') && k.length > 3) more.add(k.slice(1));
  }
  return [...more];
}
/** The core of a form, its particles and endings off at both ends (for the forms written a little differently). */
function core(k) {
  let c = k;
  for (let i = 0; i < 3; i++) {
    c = c.replace(/^(に|を|と|が|は|の|て|で)(?=..)/, '').replace(/(に|の|で|だ|です|する|をする|ない|いけない)$/, '');
  }
  return c.length >= 2 ? c : k;
}

const all = [...bunpro, ...sensei];
const exact = new Map();
const loose = new Map();
const fuzzy = new Map();
const push = (m, k, x) => (m.get(k) ?? m.set(k, []).get(k)).push(x);
for (const x of all) {
  for (const k of keys(x.title, true)) push(exact, k, x);
  for (const k of keys(x.title)) (push(loose, k, x), push(fuzzy, core(k), x));
}

// The list's patterns whose entry in a source is named: two senses or the list's own spelling (に/へ: the
// direction; そうです: hearsay, ～そうです being "looks like"; ～おう and ～よう: the volitional), or the same
// grammar written another way (～ず: ずに; ～ないではすまない: ずにはすまない…).
const PICK = {
  '～のほうが～より': 'より～のほうが',
  'に/へ': 'へ',
  'そうです': 'そうだ',
  '～よう': 'Verb[よう]',
  '～おう': 'Verb[よう]',
  '～のようてほしい': 'ように～てほしい',
  '～ず': 'ずに',
  '～ないで済む': 'ずに済む',
  '一方では': '一方で（いっぽうで）',
  'さしつかえない': 'ても差し支えない（てもさしつかえない）',
  '～た上で': '上で',
  '～が最後': 'たら最後 / たが最後（たらさいご / たがさいご）',
  '～ないではすまない': 'ずにはすまない',
  '～ようが': 'ようが～まいが',
  '～く/ ～にする': '～にする・～くする',
  '～に（は）あたらない': 'には当たらない',
  '～割りに（は）': '割に（わりに）',
  // The same form for both: the passive and the potential.
  '～られる': ['受身形（うけみけい）', 'られる'],
};
/** Patterns too unlike any source's but the same one: only an exact or near match will do. */
const NO_FUZZY = new Set(['～をおして', '～でいいです', '～ばいいのに', '～のように', '～としたら', '～からなる(成る)', 'たしか', '～には～の～がある']);
/** Found only loosely, and not what the list means: no translation rather than a wrong one. */
const NOT = new Set(['～のように:Verb[よう]', '～としたら:にしたら', 'たしか:確かに', 'たしか:確かに（たしかに）', '～でいいです:といい', '～でいいです:たらいい・といい', '～ようが:ようがない', '～ようが:ようがない・ようもない', '～ばいいのに:ばいい']);
/** The words no grammar list has: JMdict's (through Jisho), the sense the pattern is about. */
const JMDICT = { とうてい: ['到底', 0], のぼる: ['上る', 4], いったんーば: ['一旦', 0], やむをえず: ['やむを得ず', 0], やっぱり: ['やっぱり', 0], 'まんいち（万一）': ['万一', 1], たしか: ['確か', 2] };

const rank = { N5: 5, N4: 4, N3: 3, N2: 2, N1: 1 };
/** A source's meaning, shortened to its first few senses ("to plan to; to intend to ~" → "to plan to; to intend to"). */
const tidy = (m) => {
  // Its senses (commas and semicolons outside brackets), less two notes of Bunpro's that aren't meanings.
  const parts = [];
  let depth = 0;
  let cur = '';
  for (const c of m.replace(/\s*~\s*$/, '')) {
    depth += c === '(' ? 1 : c === ')' ? -1 : 0;
    if ((c === ',' || c === ';') && depth <= 0) (parts.push(cur.trim()), (cur = ''));
    else cur += c;
  }
  parts.push(cur.trim());
  for (let i = parts.length - 1; i >= 0; i--) if (!parts[i] || /^(Underlined or bolded text|Jet)$/i.test(parts[i])) parts.splice(i, 1);
  const out = [];
  for (const p of parts) if (out.join(', ').length + p.length < 70) out.push(p);
  return (out.length ? out : parts.slice(0, 1)).join(', ').replace(/\s+/g, ' ').trim();
};
const levels = {};
const missing = [];
for (const L of jlpt.levels) {
  levels[L.level] = {};
  for (const g of L.grammar) {
    let hit = null;
    if (JMDICT[g]) {
      const [word, sense] = JMDICT[g];
      const d = JSON.parse(await page(`https://jisho.org/api/v1/search/words?keyword=${encodeURIComponent(word)}`));
      const s = d.data?.[0]?.senses?.[sense];
      if (s) hit = { meaning: s.english_definitions.join('; '), src: 'JMdict' };
    } else {
      const picked = [PICK[g] ?? []].flat();
      if (picked.length > 1) {
        // Two entries named: both meanings, one after the other.
        const both = picked.map((t) => all.find((x) => x.title === t)).filter(Boolean);
        levels[L.level][g] = { en: both.map((x) => tidy(x.meaning)).join(' / '), src: [...new Set(both.map((x) => x.src))].join(', ') };
        continue;
      }
      let hits = picked.length ? all.filter((x) => x.title === picked[0]) : [];
      for (const [m, ks, name] of [[exact, keys(g, true), 'exact'], [loose, keys(g), 'loose'], [fuzzy, keys(g).map(core), 'fuzzy']]) {
        if (hits.length || (name === 'fuzzy' && NO_FUZZY.has(g))) break;
        hits = ks.flatMap((k) => m.get(k) ?? []).filter((x) => !NOT.has(`${g}:${x.title}`));
        if (hits.length && name === 'fuzzy') console.log(`  near: ${L.level} ${g} → ${hits[0].title}`);
      }
      hits.sort((a, b) => (a.level === L.level ? 0 : 1) - (b.level === L.level ? 0 : 1) || (a.src === 'Bunpro' ? 0 : 1) - (b.src === 'Bunpro' ? 0 : 1) || Math.abs((rank[a.level] ?? 0) - rank[L.level]) - Math.abs((rank[b.level] ?? 0) - rank[L.level]));
      hit = hits[0] ?? null;
    }
    if (hit) levels[L.level][g] = { en: tidy(hit.meaning), src: hit.src };
    else missing.push(`${L.level} ${g}`);
  }
}
writeFileSync(ROOT + 'src/data/jlpt-grammar.json', JSON.stringify({ source: 'Bunpro (bunpro.jp), JLPT Sensei (jlptsensei.com), JMdict via Jisho (jisho.org, CC BY-SA 4.0)', levels }, null, 1) + '\n');
const fr = JSON.parse(readFileSync(ROOT + 'src/data/jlpt-grammar-fr.json', 'utf8'));
const english = [...new Set(Object.values(levels).flatMap((l) => Object.values(l).map((x) => x.en)))];
console.log(`${Object.values(levels).reduce((n, l) => n + Object.keys(l).length, 0)} patterns translated · no source for: ${missing.join(', ')}`);
console.log(`French: ${english.filter((e) => fr[e]).length}/${english.length}; still to translate:\n${english.filter((e) => !fr[e]).join('\n')}`);
