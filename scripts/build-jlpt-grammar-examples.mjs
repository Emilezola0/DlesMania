// Example sentences for each grammar point of the list (src/data/jlpt.json), shown once a grammar
// question is answered: taken as they are from the page of the source the point was found in
// (src/data/jlpt-grammar.json's `pages`: Bunpro's grammar point, JLPT Sensei's lesson) — never written
// here. A sentence is kept only when it really has the point: the source marks the part of it that is the
// grammar (Bunpro's answer, JLPT Sensei's highlight), and that part and the sentence must hold the list's
// pattern, piece by piece and in order (conjugated at the end: ～てしまう in てしまった). The Tatoeba
// sentences already found for the points (src/data/jlpt-sentences.json) are checked the same way; the ones
// that fail are listed in `tatoebaOut`, not shown.
//   KUROMOJI=/tmp/tok/node_modules/kuromoji NODE_USE_ENV_PROXY=1 node scripts/build-jlpt-grammar-examples.mjs
// Pages are kept in CACHE (a folder outside the project) when it's set, so a run again needn't fetch them.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';

const ROOT = new URL('..', import.meta.url).pathname;
const require = createRequire(import.meta.url);
const K = process.env.KUROMOJI;
if (!K) throw new Error('Set KUROMOJI (the kuromoji package folder, outside the project).');
const kuromoji = require(K);
const tok = await new Promise((ok, ko) => kuromoji.builder({ dicPath: K + '/dict' }).build((e, t) => (e ? ko(e) : ok(t))));
const grammar = JSON.parse(readFileSync(ROOT + 'src/data/jlpt-grammar.json', 'utf8')).levels;
const tatoeba = JSON.parse(readFileSync(ROOT + 'src/data/jlpt-sentences.json', 'utf8')).levels;
const CACHE = process.env.CACHE;
if (CACHE) mkdirSync(CACHE, { recursive: true });
/** How many sentences each source gives a point, at most. */
const PER_SOURCE = 6;

const blocked = [];
const page = async (url) => {
  const file = CACHE && `${CACHE}/${createHash('sha1').update(url).digest('hex')}.html`;
  if (file && existsSync(file)) return readFileSync(file, 'utf8');
  for (let i = 0; i < 4; i++) {
    try {
      const r = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0' } });
      if (r.ok) {
        const t = await r.text();
        // A "are you a robot?" page instead of the lesson: the site doesn't want it fetched, so it's left out.
        if (/sgcaptcha/.test(t)) {
          blocked.push(url);
          return null;
        }
        if (file) writeFileSync(file, t);
        return t;
      }
      if (r.status === 404) return null;
    } catch {
      // Tried again.
    }
    await new Promise((ok) => setTimeout(ok, 2000 * 2 ** i));
  }
  throw new Error(`no answer from ${url}`);
};
const unescape = (s) =>
  s
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)))
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#039;|&apos;/g, "'")
    .replace(/&nbsp;/g, ' ');
const text = (s) => unescape(s.replace(/<[^>]+>/g, '')).trim();

const hira = (s) => s.replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60));
const HAN = /[\p{Script=Han}々〆ヶ]/u;
/** Kana only (katakana as hiragana): what's compared. */
const only = (s) => hira(s).replace(/[^ぁ-ゖー]/g, '');
/** A Japanese text as kana, its kanji read by the dictionary (for the list's patterns, and a check only). */
const kana = (s) => only(tok.tokenize(s).map((t) => (HAN.test(t.surface_form) && t.reading ? t.reading : t.surface_form)).join(''));

/**
 * A pattern of the list as what a sentence must hold: its ways of being written (a/b, a bracket left out
 * or in), each as its pieces in kana (what stands between the ～ and the placeholders).
 */
function shapes(pattern) {
  const base = pattern.replace(/stem\s*\+|Dictionary form\s*\+|Number\s*\+|N\s*\+|\(period\)|\(frequency\)|[ABＡＢ]|\+/g, '～');
  const out = [];
  const brackets = [base.replace(/[（(][^）)]*[）)]/g, ''), base.replace(/[（()）]/g, '')];
  // A bracket that's a reading ("すぎない（過ぎない）", "まんいち（万一）") stands for the whole.
  for (const m of base.matchAll(/[（(]([^）)]+)[）)]/g)) brackets.push(m[1]);
  for (const b of brackets)
    for (const alt of new Set([b, ...b.split(/[\/／・]/)])) {
      const pieces = alt
        .split(/[～~〜…]+|\s+/)
        .map(kana)
        .filter(Boolean);
      if (pieces.length) out.push(pieces);
    }
  return out;
}
/** A kana's column (か: かきくけこ), for a verb's endings. */
const ROWS = ['あいうえお', 'かきくけこ', 'がぎぐげご', 'さしすせそ', 'たちつてと', 'なにぬねの', 'ばびぶべぼ', 'まみむめも', 'らりるれろ', 'わいうえお'];
const column = (c) => ROWS.find((r) => r.includes(c)) ?? c;
/** The ending a verb's te- and ta-form takes in place of its last kana (書く → 書いて, 読む → 読んで, 待つ → 待って). */
const ONBIN = { く: 'い', ぐ: 'い', う: 'っ', つ: 'っ', る: 'っ', む: 'ん', ぶ: 'ん', ぬ: 'ん', す: 'し' };
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\ー]/g, '\\$&');
/**
 * A piece as it may be found, as a regular expression: as written, or conjugated at its end — a verb
 * (する → し/さ/せ, ある → ない, a godan verb's other forms, an ichidan verb's stem), an adjective (い off),
 * です/だ/ます (polite or plain) — with a た/て voiced after some verbs (読んだ, 読んで) and くらい/ぐらい.
 */
function forms(piece) {
  const f = new Set([esc(piece)]);
  let p = piece;
  const voiced = (x) => x.replace(/^た/, '[ただ]').replace(/^て/, '[てで]');
  const add = (x) => x && f.add(voiced(x));
  add(esc(p));
  for (const tail of ['ですか', 'でした', 'です', 'だ', 'である', 'ません', 'ます'])
    if (p.endsWith(tail) && p.length > tail.length) {
      const stem = p.slice(0, -tail.length);
      add(esc(stem));
      // The polite form's plain one: あります → ある, 食べます → 食べる.
      if (tail === 'ます' || tail === 'ません') {
        const last = stem.at(-1);
        const col = column(last);
        add(esc(stem) + 'る');
        if (col.length === 5 && col[1] === last) add(esc(stem.slice(0, -1) + col[2]));
      }
    }
  for (const x of [...f]) f.add(x.replace(/[くぐ]らい/g, '[くぐ]らい').replace(/なに/g, 'な[にん]'));
  const last = p.at(-1);
  const base = esc(p.slice(0, -1));
  if (p.endsWith('する')) add(esc(p.slice(0, -2)) + '[しさせす]');
  if (p.endsWith('くる')) add(esc(p.slice(0, -2)) + '[きこく]');
  if (p.endsWith('ある')) add(esc(p.slice(0, -2)) + '(?:あ[らりるれろっ]|な[いかくけ])');
  if (p.endsWith('いく')) add(esc(p.slice(0, -2)) + 'い[かきくけこっ]');
  if (p.endsWith('ない')) add(esc(p.slice(0, -2)) + '(?:な[いかくけ]|ありません|ません)');
  if (p.endsWith('たい')) add(esc(p.slice(0, -2)) + 'た[いかくけ]');
  // Classical endings: ごとし (ごとく, ごとき), べからず (べからざる).
  if (/ごと[しくき]$/.test(p)) add(esc(p.slice(0, -1)) + '[しくき]');
  if (p.endsWith('べからず')) add(esc(p.slice(0, -1)) + '[ずざ]');
  // A te-form as the ta-form (踏まえて, 踏まえた).
  if (/[てで]$/.test(p) && p.length >= 3) add(esc(p.slice(0, -1)) + '[てでただ]');
  if (p.endsWith('いい')) add(esc(p.slice(0, -2)) + '(?:いい|よ[かくけ])');
  if (p.length >= 2 && 'うくぐすつぬぶむる'.includes(last)) add(`${base}[${column(last)}${ONBIN[last] ?? ''}]`);
  if (p.length >= 3 && last === 'る') add(base);
  if (p.length >= 3 && last === 'い') add(base + '[かくけ]');
  return [...f].map((x) => new RegExp(x));
}
/** Whether a text (kana) holds every piece of a shape (in any order: より～のほうが is the same as ～のほうが～より). */
function holds(textKana, pieces) {
  return pieces.every((p) => forms(p).some((re) => re.test(textKana)));
}
/** A sentence has the point: the sentence holds the pattern, and the part the source marks is part of it. */
function has(pattern, sentenceKanas, markKanas) {
  // The volitional, written as its ending in the list: a verb's volitional marked (行こう, 食べよう).
  if (pattern === '～おう') return markKanas.some((m) => /[おこごそとのぼもろ]う$/.test(m)) && !markKanas.some((m) => /よう$/.test(m));
  if (pattern === '～ようが') return markKanas.some((m) => /(?:よ|[おこごそとのぼもろ])うが/.test(m));
  if (pattern === '～よう') return markKanas.some((m) => /よう$/.test(m));
  return shapes(CHECK_AS[pattern] ?? pattern).some(
    (pieces) => sentenceKanas.some((s) => holds(s, pieces)) && markKanas.some((m) => pieces.some((p) => forms(p).some((re) => re.test(m)) || (m.length >= 2 && p.includes(m)))),
  );
}
/** A pattern of the list written with a slip, checked as its source writes it (～のようてほしい: ように～てほしい). */
const CHECK_AS = { '～のようてほしい': '～ように～てほしい' };

/** "[漢字|かな]" furigana from a sentence and its readings by kanji run. */
const furiganaOf = (parts) => parts.map((p) => (p.reading ? `[${p.text}|${p.reading}]` : p.text)).join('');

// ── Bunpro: a grammar point's sentences (its page's data), the kanji's readings in brackets ──
function bunproSentences(html) {
  const m = /<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/.exec(html);
  if (!m) return [];
  const data = JSON.parse(m[1]);
  const id = data.props?.pageProps?.grammarPoint?.id ?? data.props?.pageProps?.data?.id;
  const found = new Map();
  const walk = (o) => {
    if (Array.isArray(o)) return o.forEach(walk);
    if (!o || typeof o !== 'object') return;
    if (o.sentenceable_type === 'GrammarPoint' && typeof o.content === 'string' && o.answer && (id === undefined || o.sentenceable_id === id)) found.set(o.id, o);
    else Object.values(o).forEach(walk);
  };
  walk(data.props?.pageProps);
  const out = [];
  for (const o of [...found.values()].sort((a, b) => (a.sentence_order ?? 0) - (b.sentence_order ?? 0))) {
    const raw = unescape(o.content.replace(/<[^>]+>/g, ''));
    if ((raw.match(/_{2,}/g) ?? []).length !== 1) continue;
    const answer = unescape(o.answer.replace(/<[^>]+>/g, ''));
    // Its pieces: a kanji run and the reading in brackets after it, the rest as written; the blank, the answer.
    const parts = [];
    let ja = '';
    let blank = null;
    const re = /(_{2,})|([\p{Script=Han}々〆ヶ0-9０-９A-Za-zＡ-Ｚａ-ｚ．.]+)（([^）]*)）|([\s\S])/gu;
    for (const t of raw.matchAll(re)) {
      if (t[1]) {
        const start = ja.length;
        // The answer may hold kanji with their reading too ("上（うえ）で").
        for (const a of answer.matchAll(/([\p{Script=Han}々〆ヶ]+)（([^）]*)）|([^（]+)/gu)) {
          if (a[1]) (parts.push({ text: a[1], reading: hira(a[2]) }), (ja += a[1]));
          else (parts.push({ text: a[3] }), (ja += a[3]));
        }
        blank = [start, ja.length];
      } else if (t[2]) (parts.push({ text: t[2], reading: hira(t[3]) }), (ja += t[2]));
      else (parts.push({ text: t[4] }), (ja += t[4]));
    }
    if (!blank) continue;
    const en = text(o.translation ?? '');
    if (!en) continue;
    const reading = parts.map((p) => p.reading ?? p.text).join('');
    out.push({ ja, furigana: furiganaOf(merge(parts)), blank, en, check: [only(reading)], mark: [only(reading.slice(...readingSpan(parts, blank)))] });
  }
  return out;
}
/** Plain pieces side by side made one. */
function merge(parts) {
  const out = [];
  for (const p of parts) {
    const last = out.at(-1);
    if (!p.reading && last && !last.reading) last.text += p.text;
    else out.push({ ...p });
  }
  return out;
}
/** Where the blank is in the reading. */
function readingSpan(parts, [b0, b1]) {
  let at = 0;
  let r = 0;
  let s = 0;
  let e = 0;
  for (const p of parts) {
    const len = (p.reading ?? p.text).length;
    if (at === b0) s = r;
    at += p.text.length;
    r += len;
    if (at === b1) e = r;
  }
  return [s, e || r];
}

// ── JLPT Sensei: a lesson's example sentences, the grammar highlighted, the whole read in kana ──
/**
 * The kanji runs' readings, found by lining the sentence up with the source's reading (the kana between
 * stay as they are). When it lines up more than one way (食べ物の中で: 物 as も or もの), the way whose
 * readings the dictionary agrees with most is taken — the readings are still the source's.
 */
function align(ja, reading) {
  const runs = [...ja.matchAll(/([\p{Script=Han}々〆ヶ]+)|([^\p{Script=Han}々〆ヶ]+)/gu)].map((m) => ({ text: m[0], han: !!m[1], kana: m[1] ? '' : only(m[0]) }));
  const r = only(reading);
  const ways = [];
  const walk = (i, at, got) => {
    if (ways.length > 200) return;
    if (i === runs.length) return at === r.length && ways.push(got);
    const x = runs[i];
    if (!x.han) return r.startsWith(x.kana, at) && walk(i + 1, at + x.kana.length, got);
    for (let end = at + 1; end <= r.length; end++) walk(i + 1, end, [...got, r.slice(at, end)]);
  };
  walk(0, 0, []);
  if (!ways.length) return null;
  const said = runs.filter((x) => x.han).map((x) => kana(x.text));
  const score = (w) => w.reduce((n, k, i) => n + (k === said[i] ? 2 : k[0] === said[i]?.[0] ? 1 : 0), 0);
  const best = ways.sort((a, b) => score(b) - score(a))[0];
  let g = 0;
  return runs.map((x) => (x.han ? { text: x.text, reading: best[g++] } : { text: x.text }));
}
function senseiSentences(html) {
  const out = [];
  for (const block of html.split('<div class="example-cont').slice(1)) {
    const main = /<p class="m-0 jp">([\s\S]*?)<\/div>/.exec(block);
    const hint = /id=example_\d+_ja><div class="alert alert-success">([\s\S]*?)<\/div>/.exec(block);
    const en = /id=example_\d+_en><div class="alert alert-primary">([\s\S]*?)<\/div>/.exec(block);
    if (!main || !en) continue;
    const marked = [...main[1].matchAll(/<span class=["']?color["']?>([\s\S]*?)<\/span>/g)].map((x) => text(x[1]));
    const ja = text(main[1]);
    if (!marked.length || !ja) continue;
    // The first highlight is what's underlined (a second one, when there is, is checked with it).
    // Where each highlight is in the sentence.
    const spans = [];
    let at = 0;
    const bits = main[1].split(/<span class=["']?color["']?>([\s\S]*?)<\/span>/);
    for (let i = 0; i < bits.length; i++) {
      const t = unescape(bits[i].replace(/<[^>]+>/g, ''));
      const s0 = i === 0 ? t.trimStart() : t;
      if (i % 2) spans.push([at, at + s0.length]);
      at += s0.length;
    }
    if (!spans.length || spans.some(([a, b], i) => ja.slice(a, b) !== marked[i])) continue;
    const reading = hint ? text(hint[1]) : '';
    const parts = reading ? align(ja, reading) : null;
    out.push({
      ja,
      furigana: parts ? furiganaOf(merge(parts)) : ja,
      // Its reading as the source writes it, when it doesn't line up with the kanji (shown under it instead).
      ...(parts || !reading ? {} : { kana: reading }),
      blank: spans[0],
      spans,
      en: text(en[1]),
      check: [kana(ja), ...(reading ? [only(reading)] : [])],
      mark: marked.map(kana),
    });
  }
  return out;
}

/**
 * A source's entry found for a point under the same kana but another meaning: not where its examples
 * are taken from (～そうです "looks like" isn't JLPT Sensei's hearsay そうだ, nor the frequency に its に).
 */
const NOT_PAGE = new Set(['～そうです|JLPT Sensei:そうだ', '(period)に(frequency)|JLPT Sensei:に']);
const examples = {};
const report = { kept: 0, out: [], none: [], tatoebaOut: [] };
for (const [level, points] of Object.entries(grammar)) {
  examples[level] = {};
  for (const [pattern, g] of Object.entries(points)) {
    const list = [];
    for (const ref of g.pages ?? []) {
      if (!ref.url || NOT_PAGE.has(`${pattern}|${ref.src}:${ref.title}`)) continue;
      const html = await page(ref.url);
      if (!html) continue;
      const found = ref.src === 'Bunpro' ? bunproSentences(html) : senseiSentences(html);
      let n = 0;
      for (const s of found) {
        if (n >= PER_SOURCE) break;
        if (!has(pattern, s.check, s.mark)) {
          report.out.push(`${level} ${pattern} · ${ref.src} (${ref.title}): ${s.ja}`);
          continue;
        }
        if (list.some((x) => x.ja === s.ja)) continue;
        // The highlight underlined: the one that is the point (JLPT Sensei's first may be another word of it, "に").
        // (The one holding the longest piece of it: で有名 rather than は for ～は～で有名.)
        if (s.spans) {
          const score = (m) => Math.max(0, ...shapes(CHECK_AS[pattern] ?? pattern).flat().filter((p) => forms(p).some((re) => re.test(m))).map((p) => p.length));
          const best = s.spans.map((sp, i) => [sp, score(s.mark[i])]).sort((x, y) => y[1] - x[1])[0];
          if (best[1] > 0) s.blank = best[0];
        }
        const { check, mark, spans, ...keep } = s;
        list.push({ ...keep, src: ref.src, url: ref.url });
        n++;
      }
    }
    report.kept += list.length;
    if (list.length) examples[level][pattern] = list;
    else report.none.push(`${level} ${pattern}`);
  }
}
// The Tatoeba sentences found for the points, checked the same way: the blank is the marked part.
for (const [level, list] of Object.entries(tatoeba))
  for (const s of list) {
    if (!s.grammar) continue;
    const reading = s.furigana.replace(/\[([^|\]]+)\|([^\]]*)\]/g, (_, base, r) => r.replace(/\|/g, '') || base);
    const blankReading = (() => {
      // The blank's reading: the furigana pieces that fall in it.
      let at = 0;
      let out = '';
      for (const m of s.furigana.matchAll(/\[([^|\]]+)\|([^\]]*)\]|([^[]+)/g)) {
        const t = m[3] ?? m[1];
        const r = m[3] ?? (m[2].replace(/\|/g, '') || m[1]);
        const a = at;
        const b = at + t.length;
        if (b > s.blank[0] && a < s.blank[1]) out += m[3] ? t.slice(Math.max(0, s.blank[0] - a), s.blank[1] - a) : r;
        at = b;
      }
      return out;
    })();
    if (!has(s.grammar, [only(reading), kana(s.ja)], [only(blankReading), kana(s.ja.slice(...s.blank))])) report.tatoebaOut.push(`${level}|${s.grammar}|${s.id}`);
  }

writeFileSync(
  ROOT + 'src/data/jlpt-grammar-examples.json',
  JSON.stringify({ source: "Bunpro (bunpro.jp) and JLPT Sensei (jlptsensei.com): each grammar point's own example sentences, as the source writes them", tatoebaOut: report.tatoebaOut, levels: examples }) + '\n',
);
writeFileSync(process.env.REPORT ?? '/dev/null', [`kept ${report.kept}`, `none: ${report.none.join(', ')}`, '', 'left out:', ...report.out, '', `Tatoeba left out: ${report.tatoebaOut.length}`, '', 'pages the site would not give:', ...blocked].join('\n'));
console.log(`${report.kept} sentences for ${Object.values(examples).reduce((n, l) => n + Object.keys(l).length, 0)} points · left out ${report.out.length} · no sentence: ${report.none.length} · Tatoeba left out ${report.tatoebaOut.length} · pages not given ${blocked.length}`);
