// The owner's grammar books (src/data/jlpt-books.json), shown in the JLPT grammar notes and on /jlpt/books: only
// each book's list of grammar points (its table of contents: number, form, unit, page) comes from the book; the
// meaning, explanation and examples of each point are written for Omnidle by an AI (Claude) and say so on screen
// (allowed by the owner on 16 November 2026: CLAUDE.md). Sources: scripts/data/books/*.mjs.
// An example is written "[漢字|かな]…{grammar}…"; here it becomes the sentence, its furigana and the part marked.
// Each reading is checked against the list's own (src/data/jlpt.json: the word's, or its kanji's readings one
// after another); those it can't agree with are printed, to be looked at again (they stay).
//   node scripts/build-jlpt-books.mjs
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';

const ROOT = new URL('..', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
const jlpt = JSON.parse(readFileSync(ROOT + 'src/data/jlpt.json', 'utf8'));

const BOOKS = [
  {
    id: 'mimi-n2',
    files: ['mimi-n2-a', 'mimi-n2-b', 'mimi-n2-c', 'mimi-n2-d', 'mimi-n2-e'],
    title: '耳から覚える 日本語能力試験 文法トレーニング N2',
    edition: '改訂版',
    authors: '安藤栄里子・今川和',
    publisher: 'ALC (アルク)',
    level: 'N2',
    units: [
      { unit: 1, from: 1, to: 12, page: 12 },
      { unit: 2, from: 13, to: 23, page: 22 },
      { unit: 3, from: 24, to: 36, page: 32 },
      { unit: 4, from: 37, to: 48, page: 44 },
      { unit: 5, from: 49, to: 60, page: 53 },
      { unit: 6, from: 61, to: 72, page: 61 },
      { unit: 7, from: 73, to: 86, page: 76 },
      { unit: 8, from: 87, to: 98, page: 87 },
      { unit: 9, from: 99, to: 110, page: 98 },
    ],
  },
];

// ── Readings ──────────────────────────────────────────────────────────────────────────────────────────────
const KANJI = /[㐀-鿿々〆ヶ]/;
const kata = (t) => t.replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60));
const WORDS = new Set();
const WHOLE = new Map();
const KREAD = new Map();
for (const l of jlpt.levels) {
  for (const [w, r] of l.vocab)
    for (const x of String(r).split(/[/・、,]/)) {
      const y = kata(x.trim());
      WORDS.add(`${w}|${y}`);
      const k = [...w].filter((c) => KANJI.test(c)).join('');
      if (k.length > 1) WHOLE.set(k, [...(WHOLE.get(k) ?? []), y]);
    }
  for (const [k, r] of l.kanji) KREAD.set(k, [...(KREAD.get(k) ?? []), ...String(r).split(/[・、,\s]/).map((x) => kata(x.replace(/[.\-~～（）()]/g, '').trim())).filter(Boolean)]);
}
const VOICED = { か: 'が', き: 'ぎ', く: 'ぐ', け: 'げ', こ: 'ご', さ: 'ざ', し: 'じ', す: 'ず', せ: 'ぜ', そ: 'ぞ', た: 'だ', ち: 'ぢ', つ: 'づ', て: 'で', と: 'ど', は: 'ば', ひ: 'び', ふ: 'ぶ', へ: 'べ', ほ: 'ぼ' };
const HALF = { は: 'ぱ', ひ: 'ぴ', ふ: 'ぷ', へ: 'ぺ', ほ: 'ぽ' };
function shapes(r) {
  const out = new Set([r]);
  if (VOICED[r[0]]) out.add(VOICED[r[0]] + r.slice(1));
  if (HALF[r[0]]) out.add(HALF[r[0]] + r.slice(1));
  for (const x of [...out]) if (/[つくちき]$/.test(x) && x.length > 1) out.add(x.slice(0, -1) + 'っ');
  return [...out];
}
/** Whether the list agrees with a reading of a kanji run: as a word, or its kanji's readings one after another. */
function agrees(core, reading) {
  if ([...WORDS].some((w) => w.startsWith(`${core}`) && w.split('|')[1].startsWith(reading) && w.split('|')[0].replace(/[ぁ-ゟ]/g, '') === core)) return true;
  const ks = [...core].map((c, i, a) => (c === '々' ? a[i - 1] : c));
  const go = (i, rest) => {
    if (i === ks.length) return rest === '';
    for (let j = ks.length; j > i + 1; j--) for (const r of WHOLE.get(ks.slice(i, j).join('')) ?? []) for (let n = r.length; n >= 1; n--) if (rest.startsWith(r.slice(0, n)) && go(j, rest.slice(n))) return true;
    for (const r of KREAD.get(ks[i]) ?? []) for (const s of shapes(r)) for (let n = s.length; n >= 1; n--) if (rest.startsWith(s.slice(0, n)) && (n === s.length || i === ks.length - 1) && go(i + 1, rest.slice(n))) return true;
    return false;
  };
  return go(0, reading);
}

/** "[漢字|かな]…{grammar}…" → the sentence, its furigana, the part marked. */
function example(src, where, doubts) {
  let ja = '';
  let furigana = '';
  let b0 = -1;
  let b1 = -1;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (c === '{') {
      if (b0 < 0) b0 = ja.length;
      continue;
    }
    if (c === '}') {
      b1 = ja.length;
      continue;
    }
    if (c === '[') {
      const end = src.indexOf(']', i);
      const [k, r] = src.slice(i + 1, end).split('|');
      if (!r || !/^[ぁ-ゟー]+$/.test(r) || ![...k].every((x) => KANJI.test(x))) throw new Error(`${where}: bad reading [${k}|${r}]`);
      if (!agrees(k, r)) doubts.push(`${where}: ${k} ${r}`);
      ja += k;
      furigana += `[${k}|${r}]`;
      i = end;
      continue;
    }
    if (KANJI.test(c)) throw new Error(`${where}: ${c} has no reading in ${src}`);
    ja += c;
    furigana += c;
  }
  if (b0 < 0 || b1 <= b0) throw new Error(`${where}: no {grammar} in ${src}`);
  return { ja, furigana, blank: [b0, b1] };
}

// ── Coto's list: the same point, when it's there ──────────────────────────────────────────────────────────
const norm = (s) => s.replace(/[～~〜\s　…・]/g, '').replace(/^N\+/, '').replace(/[（(]/g, '(').replace(/[）)]/g, ')');
function forms(s) {
  const out = new Set();
  for (const part of [s, ...s.split(/[／/]/)]) {
    const n = norm(part);
    if (!n) continue;
    for (const f of [n, n.replace(/\([^)]*\)/g, ''), n.replace(/[()]/g, '')]) if (f.length > 1) out.add(f);
  }
  return out;
}
const coto = jlpt.levels.flatMap((l) => l.grammar.map((g) => ({ level: l.level.split(' ')[0], pattern: g, forms: forms(g) })));
/** Points matched by hand (the book's number → Coto's level and pattern), where the forms differ; null: not the same point. */
const SAME = {
  'mimi-n2': { 42: ['N3', 'すぎない（過ぎない）'], 73: ['N3', 'まい'], 75: ['N2', '～は～に限る'], 82: ['N2', 'かねる'], 83: ['N2', 'かねない'], 92: ['N2', 'かけては'], 105: ['N2', '～に越したことはない'], 107: ['N1', '～をふまえて'], 12: ['N2', '～た上で'], 37: ['N1', '～っぱなし'], 60: ['N1', '～たところで'], 59: ['N1', '～ところを'], 95: ['N1', 'ただ～のみ'], 52: null },
};

const out = [];
const doubts = [];
for (const b of BOOKS) {
  const points = [];
  for (const f of b.files) {
    let mod;
    try {
      mod = await import(new URL(`./data/books/${f}.mjs`, import.meta.url));
    } catch (e) {
      if (e.code === 'ERR_MODULE_NOT_FOUND') continue;
      throw e;
    }
    for (const p of mod.default) {
      const unit = b.units.find((u) => p.n >= u.from && p.n <= u.to);
      const hand = SAME[b.id]?.[p.n];
      const none = hand === null;
      const want = forms(p.p);
      const m = none ? undefined : hand ? coto.find((c) => c.level === hand[0] && c.pattern === hand[1]) : coto.find((c) => c.level !== 'N5' && c.level !== 'N4' && [...c.forms].some((x) => want.has(x)));
      if (hand && !m) throw new Error(`${b.id} ${p.n}: no ${hand.join(' ')} in the list`);
      points.push({
        n: p.n,
        p: p.p,
        unit: unit.unit,
        page: unit.page,
        ...(m ? { coto: { level: m.level, pattern: m.pattern } } : {}),
        en: p.en,
        fr: p.fr,
        form: p.form,
        note: p.note,
        ex: p.ex.map(([src, en, fr], i) => ({ ...example(src, `${b.id} ${p.n}.${i + 1}`, doubts), en, fr })),
      });
    }
  }
  points.sort((a, c) => a.n - c.n);
  const { files, ...book } = b;
  void files;
  out.push({ ...book, points });
  console.log(`${b.id}: ${points.length} points, ${points.filter((p) => p.coto).length} in Coto’s list`);
}
writeFileSync(
  ROOT + 'src/data/jlpt-books.json',
  JSON.stringify({ about: 'The owner’s grammar books: their list of points only; meanings, explanations and examples written by an AI (Claude). scripts/build-jlpt-books.mjs', books: out }, null, 1) + '\n',
);
if (doubts.length) console.log(`Readings the list can't confirm (${doubts.length}):\n  ${doubts.join('\n  ')}`);
