// What Wikibooks' JLPT Guide (en.wikibooks.org, "JLPT Guide/JLPT N5…N3 Grammar", CC BY-SA 4.0) says about
// the grammar points of the list (src/data/jlpt.json), shown once a grammar question is answered, after the
// point's meaning: its explanation, and its example sentences with their readings and translation (N5, N4). Taken as the pages write them, never written here; the owner allowed
// this source on 16 November 2026. A point is matched to a Wikibooks heading by its form (～, spaces and
// brackets left out); an example is kept only when every kanji in it has its reading (the page writes it
// in （）after the word), each reading agrees with the list's own (jlpt.json: the word's, or its kanji's
// readings one after the other; the pages have a few wrong ones), and the page marks the grammar in it (in
// blue). N2's page is laid out otherwise and its list hardly meets ours (and N1 has no page): N5–N3 only.
// The French is in src/data/jlpt-grammar-wikibooks-fr.json (the English's translation), kept as it is.
//   NODE_USE_ENV_PROXY=1 node scripts/build-jlpt-grammar-wikibooks.mjs
import { existsSync, readFileSync, writeFileSync } from "node:fs";

const ROOT = new URL("..", import.meta.url).pathname.replace(
  /^\/([A-Z]:)/,
  "$1",
);
const jlpt = JSON.parse(readFileSync(ROOT + "src/data/jlpt.json", "utf8"));
const LEVELS = ["N5", "N4", "N3"];
const title = (lv) => `JLPT_Guide/JLPT_${lv}_Grammar`;
const pageUrl = (lv) => `https://en.wikibooks.org/wiki/${title(lv)}`;

const raw = async (lv) => {
  for (let i = 0; i < 4; i++) {
    try {
      const r = await fetch(
        `https://en.wikibooks.org/w/index.php?title=${title(lv)}&action=raw`,
        {
          headers: {
            "user-agent":
              "OmnidleDataBuilder/1.0 (study game; data build script)",
          },
        },
      );
      if (r.ok) return r.text();
    } catch {
      // Tried again.
    }
    await new Promise((ok) => setTimeout(ok, 2000 * 2 ** i));
  }
  throw new Error(`No page for ${lv}`);
};

/** A pattern's forms, to match: ～, spaces, slashes' sides, brackets with or without what's in them. */
const norm = (s) =>
  s
    .replace(/[～~〜\s　]/g, "")
    .replace(/^N\+/, "")
    .replace(/[（(]/g, "(")
    .replace(/[）)]/g, ")");
function forms(s) {
  const out = new Set();
  for (const part of [s, ...s.split(/\s*[/／]\s*/)]) {
    const n = norm(part);
    if (!n) continue;
    out.add(n);
    out.add(n.replace(/\([^)]*\)/g, ""));
    out.add(n.replace(/[()]/g, ""));
  }
  return out;
}

/** Wiki text to plain text: links, bold/italics, tags out. */
const plain = (s) =>
  s
    .replace(/\[\[(?:[^\]|]*\|)?([^\]]*)\]\]/g, "$1")
    .replace(/\[https?:\S+ ([^\]]*)\]/g, "$1")
    .replace(/'''?/g, "")
    .replace(/<br\s*\/?>/g, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/[ \t]+/g, " ")
    .trim();

const KANJI = /[㐀-鿿々〆ヶ]/;
// The list's readings: of its words, and of each kanji (katakana on readings as hiragana).
const kata = (t) =>
  t.replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60));
const WORDS = new Map();
/** The list's words written in kanji only, and their readings (a compound read as a whole: 日本 にほん). */
const WHOLE = new Map();
const KREAD = new Map();
for (const l of jlpt.levels) {
  for (const [w, r] of l.vocab)
    for (const x of String(r).split(/[\/・、,]/)) {
      WORDS.set(`${w}|${kata(x.trim())}`, true);
      if ([...w].every((c) => KANJI.test(c)) && w.length > 1)
        WHOLE.set(w, [...(WHOLE.get(w) ?? []), kata(x.trim())]);
    }
  for (const [k, r] of l.kanji)
    KREAD.set(k, [
      ...(KREAD.get(k) ?? []),
      ...String(r)
        .split(/[・、,\s]/)
        .map((x) => kata(x.replace(/[.\-~～（）()]/g, "").trim()))
        .filter(Boolean),
    ]);
}
const VOICED = {
  か: "が",
  き: "ぎ",
  く: "ぐ",
  け: "げ",
  こ: "ご",
  さ: "ざ",
  し: "じ",
  す: "ず",
  せ: "ぜ",
  そ: "ぞ",
  た: "だ",
  ち: "ぢ",
  つ: "づ",
  て: "で",
  と: "ど",
  は: "ば",
  ひ: "び",
  ふ: "ぶ",
  へ: "べ",
  ほ: "ぼ",
};
const HALF = { は: "ぱ", ひ: "ぴ", ふ: "ぷ", へ: "ぺ", ほ: "ぽ" };
/** A reading's other shapes inside a word: voiced or p- at its start, a small っ at its end. */
function shapes(r) {
  const out = new Set([r]);
  const f = r[0];
  if (VOICED[f]) out.add(VOICED[f] + r.slice(1));
  if (HALF[f]) out.add(HALF[f] + r.slice(1));
  for (const x of [...out])
    if (/[つくちき]$/.test(x) && x.length > 1) out.add(x.slice(0, -1) + "っ");
  return [...out];
}
/** Whether the list agrees with a reading: the word's own, or its kanji's readings one after another (々 repeats). */
function agrees(core, reading, word, full) {
  if (WORDS.has(`${core}|${reading}`) || WORDS.has(`${word}|${full}`))
    return true;
  const ks = [...core].map((c, i, a) => (c === "々" ? a[i - 1] : c));
  const go = (i, rest) => {
    if (i === ks.length) return rest === "";
    for (let j = ks.length; j > i + 1; j--)
      for (const r of WHOLE.get(ks.slice(i, j).join("")) ?? [])
        if (rest.startsWith(r) && go(j, rest.slice(r.length))) return true;
    for (const r of KREAD.get(ks[i]) ?? [])
      for (const s of shapes(r))
        if (s && rest.startsWith(s) && go(i + 1, rest.slice(s.length)))
          return true;
    // A kun reading's stem (its okurigana in the page's kana after it).
    for (const r of KREAD.get(ks[i]) ?? [])
      for (const s of shapes(r))
        for (let n = s.length - 1; n >= 1; n--)
          if (i === ks.length - 1 && rest === s.slice(0, n)) return true;
    return false;
  };
  return go(0, reading);
}
let wrong = 0;
const HIRA = /[ぁ-ゟ]/;
/**
 * An example as the page writes it — 優しい（やさしい）<span …>し</span>、… ''Because…'' — to the game's own
 * form: the sentence, "[漢字|かな]" over each kanji run, the part marked in blue. Null if a kanji has no reading.
 */
function example(line) {
  const m = /^\*\s*Example:\s*(.*?)\s*''(.+?)''\s*$/.exec(line.trim());
  if (!m) return null;
  let src = m[1]
    .replace(/<\/?span[^>]*>/g, (t) =>
      t.startsWith("</") ? "\u0002" : "\u0001",
    )
    .replace(/[ 　]+/g, "");
  let ja = "";
  let furi = "";
  let b0 = -1;
  let b1 = -1;
  // Where the last word read ends (what's before it isn't read again).
  let read = 0;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (c === "\u0001") {
      if (b0 < 0) b0 = ja.length;
      continue;
    }
    if (c === "\u0002") {
      if (b1 < 0) b1 = ja.length;
      continue;
    }
    if (c === "（" || c === "(") {
      const end = src.indexOf(c === "（" ? "）" : ")", i);
      if (end < 0) return null;
      const reading = src.slice(i + 1, end);
      i = end;
      if (!/^[ぁ-ゟー]+$/.test(reading)) continue; // not a reading: left out
      // The word read: kana at its end, its kanji, maybe kana before them that the reading starts with.
      let k = ja.length;
      let tail = "";
      while (k > read && HIRA.test(ja[k - 1])) tail = ja[--k] + tail;
      let core = "";
      while (k > read && KANJI.test(ja[k - 1])) core = ja[--k] + core;
      if (!core || !reading.endsWith(tail)) return null;
      let r = reading.slice(0, reading.length - tail.length);
      let head = "";
      for (let n = 2; n >= 1; n--) {
        const p = ja.slice(k - n, k);
        if (
          k - n >= read &&
          /^[ぁ-ゟ]+$/.test(p) &&
          r.startsWith(p) &&
          r.length > p.length
        ) {
          head = p;
          break;
        }
      }
      r = r.slice(head.length);
      if (!r) return null;
      if (!agrees(core, r, head + core + tail, reading)) {
        wrong++;
        if (process.env.SHOW) console.log("  reading?", core, r);
        return null;
      }
      // Rewrite the furigana text's end (it holds the same characters as ja).
      const word = core + tail;
      if (!furi.endsWith(word)) return null;
      furi = furi.slice(0, furi.length - word.length) + `[${core}|${r}]` + tail;
      read = ja.length;
      continue;
    }
    ja += c;
    furi += c;
  }
  if (b0 < 0 || b1 <= b0) return null;
  // Every kanji must have its reading.
  if (KANJI.test(furi.replace(/\[[^\]]*\]/g, ""))) return null;
  return { ja, furigana: furi, blank: [b0, b1], en: plain(m[2]) };
}

/** N5–N3: a heading (===…===) each point, its explanation, then "* Example:" lines. */
function sections(text) {
  const out = [];
  const parts = text.split(/^===\s*(.+?)\s*===\s*$/m);
  for (let i = 1; i < parts.length; i += 2) {
    const lines = parts[i + 1].split("\n");
    const ex = [];
    const said = [];
    for (const l of lines) {
      if (/^\*\s*Example:/.test(l.trim())) {
        const e = example(l);
        if (e) ex.push(e);
      } else if (!/^https?:/.test(l.trim()) && !/^\{\||^\|/.test(l.trim()))
        said.push(l);
    }
    // (The page's notes at the end — who made the list — and its templates aren't the point's.)
    const own = said
      .join("\n")
      .split(/^==[^=]/m)[0]
      .replace(/\{\{[^}]*\}\}/g, "")
      .split("\n")
      .filter((l) => !/list of grammar terms/i.test(l))
      .join("\n");
    const explain = plain(own)
      .replace(/^\*\s*/gm, "• ")
      .replace(/^Note:\s*/gm, "")
      .replace(/\n(?=[～~])/g, " ")
      .replace(/\n{2,}/g, "\n")
      .trim();
    out.push({ head: parts[i], explain, examples: ex });
  }
  return out;
}

/** Explanations the page gets wrong: left out (the point's examples kept). */
const NOT_SAID = new Set(["N4|～てくれる", "N4|～られる"]);
const levels = {};
let found = 0;
let total = 0;
for (const lv of LEVELS) {
  const text = await raw(lv);
  const heads = sections(text);
  const points = jlpt.levels.find((l) => l.level.startsWith(lv)).grammar;
  levels[lv] = {};
  for (const p of points) {
    total++;
    const want = forms(p);
    const h = heads.find((x) => [...forms(x.head)].some((f) => want.has(f)));
    if (!h || (!h.explain && !h.examples.length)) {
      console.log(`${lv} not found: ${p}`);
      continue;
    }
    found++;
    // Wrong on the page (くれる "means to receive": it's to give, to the speaker; the passive's list, 待たれる "to be
    // carried"…): their examples only.
    if (NOT_SAID.has(`${lv}|${p}`)) h.explain = "";
    levels[lv][p] = {
      head: h.head,
      ...(h.explain ? { en: h.explain } : {}),
      ...(h.examples.length ? { examples: h.examples } : {}),
    };
  }
}
const out = {
  source:
    "Wikibooks, JLPT Guide (en.wikibooks.org/wiki/JLPT_Guide), CC BY-SA 4.0",
  pages: Object.fromEntries(LEVELS.map((lv) => [lv, pageUrl(lv)])),
  levels,
};
writeFileSync(
  ROOT + "src/data/jlpt-grammar-wikibooks.json",
  JSON.stringify(out, null, 1) + "\n",
);
const fr = ROOT + "src/data/jlpt-grammar-wikibooks-fr.json";
if (!existsSync(fr)) writeFileSync(fr, "{}\n");
console.log(
  `${found} / ${total} points found; ${wrong} examples left out (a reading the list doesn't agree with)`,
);
