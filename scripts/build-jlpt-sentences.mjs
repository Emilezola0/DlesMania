// JLPT sentences with a blank (the JLPT page's "Sentences" decks): real sentences from Tatoeba (the owner
// chose it), each with a blank on one of the level's grammar points — or on one of its words — its English
// (and French, for later) translation, its furigana, and a recording where a voice with an open licence
// read it (CC BY / CC BY-NC: credited in the game). Words, readings and grammar points come from
// src/data/jlpt.json; the sentences, their furigana and their recordings from Tatoeba.
//
//   1. Tatoeba's exports in a folder (https://downloads.tatoeba.org/exports/): per_language/jpn/jpn_sentences.tsv,
//      per_language/jpn/jpn-eng_links.tsv, per_language/eng/eng_sentences.tsv, per_language/jpn/jpn-fra_links.tsv,
//      per_language/fra/fra_sentences.tsv, sentences_with_audio.csv, transcriptions.csv (unpacked).
//   2. A Japanese tokenizer for the particles, outside the project: npm i --prefix /tmp/tok kuromoji@0.1.2
//   3. TATOEBA=/path/to/exports KUROMOJI=/tmp/tok/node_modules/kuromoji NODE_USE_ENV_PROXY=1 node scripts/build-jlpt-sentences.mjs
//
// Writes src/data/jlpt-sentences.json and the recordings to public/audio/jlpt/<sentence id>.mp3. Tatoeba's
// server drops connections now and then: RECORDINGS_ONLY=1 (TATOEBA only) fetches the recordings still
// missing for the sentences already chosen, and any it can't get lose their recording in the file.
import { createReadStream, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { createInterface } from 'node:readline';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const OUT = join(ROOT, 'src/data/jlpt-sentences.json');
const T = process.env.TATOEBA;
if (!T || (!process.env.KUROMOJI && !process.env.RECORDINGS_ONLY)) throw new Error('Set TATOEBA (the exports folder) and KUROMOJI (kuromoji package folder).');

async function lines(file, each) {
  const rl = createInterface({ input: createReadStream(join(T, file), 'utf8'), crlfDelay: Infinity });
  for await (const line of rl) each(line.split('\t'));
}
/** Recordings that may be used here: an open licence, credited. */
const OPEN = new Set(['CC BY 4.0', 'CC BY-NC 4.0', 'CC BY-SA 4.0', 'CC0 1.0']);

/**
 * The chosen sentences' recordings, fetched once and served with the site (a few tries each: Tatoeba's
 * server drops connections now and then). A sentence whose recording can't be had loses it in the file.
 */
async function fetchRecordings() {
  const audioId = new Map();
  await lines('sentences_with_audio.csv', ([sid, aid, , license]) => OPEN.has(license) && !audioId.has(+sid) && audioId.set(+sid, +aid));
  const file = JSON.parse(readFileSync(OUT, 'utf8'));
  const dir = join(ROOT, 'public/audio/jlpt');
  mkdirSync(dir, { recursive: true });
  let fetched = 0;
  let lost = 0;
  for (const s of Object.values(file.levels).flat()) {
    if (!s.audio) continue;
    const to = join(dir, `${s.id}.mp3`);
    for (let attempt = 0; attempt < 5 && !existsSync(to) && audioId.has(s.id); attempt++) {
      try {
        const r = await fetch(`https://tatoeba.org/en/audio/download/${audioId.get(s.id)}`);
        if (r.ok && /audio/.test(r.headers.get('content-type') ?? '')) (writeFileSync(to, Buffer.from(await r.arrayBuffer())), fetched++);
        else break;
      } catch {
        await new Promise((ok) => setTimeout(ok, 2000 * 2 ** attempt));
      }
    }
    if (!existsSync(to)) (delete s.audio, lost++);
  }
  writeFileSync(OUT, JSON.stringify(file) + '\n');
  console.log(`recordings: ${fetched} fetched now, ${lost} not to be had`);
}
if (process.env.RECORDINGS_ONLY) {
  await fetchRecordings();
  process.exit(0);
}

const require = createRequire(import.meta.url);
const kuromoji = require(process.env.KUROMOJI);
const tokenizer = await new Promise((ok, ko) => kuromoji.builder({ dicPath: join(process.env.KUROMOJI, 'dict') }).build((e, t) => (e ? ko(e) : ok(t))));

const jlpt = JSON.parse(readFileSync(join(ROOT, 'src/data/jlpt.json'), 'utf8'));
const LEVELS = jlpt.levels.map((l) => l.level); // N5 … N1
const rank = (lv) => LEVELS.indexOf(lv);

// ── Tatoeba ──
const jpn = new Map();
await lines('jpn_sentences.tsv', ([id, , text]) => jpn.set(+id, text));
const engOf = new Map();
await lines('jpn-eng_links.tsv', ([a, b]) => (engOf.get(+a) ?? engOf.set(+a, []).get(+a)).push(+b));
const fraOf = new Map();
await lines('jpn-fra_links.tsv', ([a, b]) => (fraOf.get(+a) ?? fraOf.set(+a, []).get(+a)).push(+b));
const wanted = new Set([...engOf.values(), ...fraOf.values()].flat());
const other = new Map();
await lines('eng_sentences.tsv', ([id, , text]) => wanted.has(+id) && other.set(+id, text));
await lines('fra_sentences.tsv', ([id, , text]) => wanted.has(+id) && other.set(+id, text));
const audio = new Map();
await lines('sentences_with_audio.csv', ([sid, aid, by, license]) => jpn.has(+sid) && OPEN.has(license) && !audio.has(+sid) && audio.set(+sid, { id: +aid, by, license }));
const furigana = new Map();
await lines('transcriptions.csv', ([sid, lang, , , text]) => lang === 'jpn' && furigana.set(+sid, text));

// ── The list ──
const KANJI = new Map();
for (const l of jlpt.levels) for (const [k] of l.kanji) if (!KANJI.has(k)) KANJI.set(k, l.level);
const isKanji = (c) => /\p{Script=Han}/u.test(c);
/** A sentence's level by its kanji: the highest one it needs (null: a kanji outside the list). */
function kanjiLevel(text) {
  let r = 0;
  for (const c of text) if (isKanji(c)) {
    if (!KANJI.has(c)) return null;
    r = Math.max(r, rank(KANJI.get(c)));
  }
  return LEVELS[r];
}
/** Every word of the list, by how it's written and by its reading. */
const WORDS = new Map();
for (const l of jlpt.levels) l.vocab.forEach(([text, reading, meaning], i) => {
  const e = { id: `${l.level}:vocab:${i}`, level: l.level, text, reading, meaning };
  for (const k of [text, ...reading.split('/')]) if (!WORDS.has(k)) WORDS.set(k, e);
});
/** A noun of the list: one word, a noun, by the tokenizer (同じ, 大きい… are not). */
const NOUN = new Map();
const isNoun = (e) => {
  if (!NOUN.has(e.id)) {
    const t = tokenizer.tokenize(e.text.split('/')[0]);
    NOUN.set(e.id, t.length === 1 && t[0].pos === '名詞' && !['非自立', '代名詞', '数', '接尾', '形容動詞語幹'].includes(t[0].pos_detail_1) && !/^(to |\(to\) )/.test(e.meaning));
  }
  return NOUN.get(e.id);
};

// ── Grammar points: where each one shows in a sentence ──
// `re`: the blank is group 1 (or the whole match); `tok`: a particle, found by the tokenizer.
// `kind` (particle, ending, word) picks the wrong answers among the same kind; `show` is how the answer
// reads in the choices when the sentence's own form isn't used.
const P = (surface, detail, extra = {}) => ({ kind: 'particle', tok: { surface, detail }, show: surface, ...extra });
const R = (re, kind, show, extra = {}) => ({ re, kind, show, ...extra });
const RULES = {
  // N5
  'つもりです': R(/(つもり)/, 'word', 'つもり'),
  '～んです': R(/[^\s](んです|んだ|のです)/, 'ending', 'んです'),
  'ので': P('ので', '接続助詞'),
  'は': P('は', '係助詞'),
  '～ましょう': R(/(ましょう)(?!か)/, 'ending', 'ましょう'),
  '～のがじょうずです': R(/(のが(?:上手|じょうず))/, 'ending', 'のが上手'),
  '～まえに': R(/(?:の|る)((?:前|まえ)に)/, 'word', '前に'),
  '～のほうが～より': R(/(?:ほう|方)が.*?(より)|(より).*?(?:ほう|方)が/, 'particle', 'より'),
  '～にいく': R(/[いきしちにひみりぎびえけせてねへめれげべ](に(?:行|い)[かきくけこっ])/, 'ending', 'に行く'),
  '～がいます': R(/(がい(?:ます|る|ません|ない|た))/, 'ending', 'がいます'),
  '～く/ ～になる': R(/((?:く|に)な(?:る|ります|った|りました|って))/, 'ending', 'になる'),
  '～のがへたです': R(/(のが(?:下手|へた))/, 'ending', 'のが下手'),
  '～てください': R(/((?:て|で)ください)/, 'ending', 'てください'),
  '～たり …～たりする': R(/((?:た|だ)り).+(?:た|だ)り/, 'ending', 'たり'),
  '～てもいいです': R(/((?:て|で)も(?:いい|良い|よろしい))/, 'ending', 'てもいい'),
  '～があります': R(/(があ(?:ります|る|りません))/, 'ending', 'があります'),
  'です': R(/[^\s](です)[。！？か]/, 'ending', 'です'),
  '～なくちゃいけない': R(/(なくちゃ)/, 'ending', 'なくちゃ'),
  '～のがすきです': R(/(のが(?:好き|すき))/, 'ending', 'のが好き'),
  '～ている': R(/((?:て|で)(?:いる|います|いた|いました|いない|いません|る(?=[。！？よね])))/, 'ending', 'ている'),
  'や': P('や', '並立助詞'),
  'を': P('を', '格助詞'),
  '～てはいけません': R(/((?:て|で)は(?:いけ|だめ|ダメ)\S*?(?:ません|ない|です))/, 'ending', 'てはいけません'),
  'stem +たいです': R(/[いきしちにひみりぎびえけせてねへめれげべ](たい)/, 'ending', 'たい'),
  'ないでください': R(/(ないでください)/, 'ending', 'ないでください'),
  'でしょう': R(/(でしょう)/, 'ending', 'でしょう'),
  '～ませんか': R(/(ませんか)/, 'ending', 'ませんか'),
  'まだ～ていません': R(/まだ.*?((?:て|で)(?:いません|いない|ない))/, 'ending', 'ていません'),
  'で': P('で', '格助詞'),
  '～から': P('から', '接続助詞'),
  'も': P('も', '係助詞'),
  'と': P('と', '格助詞'),
  '～すぎる': R(/((?:すぎ|過ぎ)(?:る|ます|た|ました|て|ない))/, 'ending', 'すぎる'),
  '～ほうがいい': R(/((?:ほう|方)が(?:いい|良い|よい))/, 'ending', 'ほうがいい'),
  'に': P('に', '格助詞'),
  '～のなかで～がいちばん～': R(/(?:中|なか)で.*?(一番|いちばん)/, 'word', '一番'),
  '～ましょうか': R(/(ましょうか)/, 'ending', 'ましょうか'),
  '～てから': R(/((?:て|で)から)/, 'ending', 'てから'),
  '～たことがある': R(/(?:た|だ)(ことがあ(?:る|ります|りません|ない))/, 'ending', 'ことがある'),
  'に/へ': { kind: 'particle', show: 'へ', pair: ['に', 'へ'], dir: true },
  // N4
  '～おう': R(/[こそとのぼもろごおよ](う)(?:と|か|よ|。|！)/, 'ending', 'う'),
  '～という～': R(/(という)(?=[\p{Script=Han}\p{Script=Katakana}]|もの|こと|の|人)/u, 'ending', 'という'),
  '～かどうか': R(/(かどうか)/, 'ending', 'かどうか'),
  '～はずです': R(/(はず)/, 'word', 'はず'),
  '～てある': R(/((?:て|で)あ(?:る|ります|った|りました))/, 'ending', 'てある'),
  '～がほしい': R(/(が(?:ほし|欲し)[いかく])/, 'ending', 'がほしい'),
  '～なさい': R(/(なさい)/, 'ending', 'なさい'),
  '～てもらう': R(/((?:て|で)もら[いうえっわお])/, 'ending', 'てもらう'),
  'しか～ない': R(/(しか).*?(?:ない|ません)/, 'particle', 'しか'),
  '～てあげる': R(/((?:て|で)あげ)/, 'ending', 'てあげる'),
  'そうです': R(/[るたいだ](そうです|そうだ)/, 'ending', 'そうです'),
  '～ていただけませんか': R(/((?:て|で)いただけませんか)/, 'ending', 'ていただけませんか'),
  '～やすい': R(/[いきしちにひみりぎびえけせてねへめれげべ](やす[いかく])/, 'ending', 'やすい'),
  '～かもしれない': R(/(かもしれ(?:ない|ません)|かも知れ(?:ない|ません))/, 'ending', 'かもしれない'),
  '～ば/～れば': R(/[えけせてねへめれげべ](ば)(?![かあっ])/, 'ending', 'ば'),
  '～たらどうですか': R(/((?:た|だ)らどう)/, 'ending', 'たらどう'),
  '～く/ ～にする': R(/((?:く|に)(?:する|します|した|しました|して))/, 'ending', 'にする'),
  'のに': R(/[^\s](のに)[、。！]/, 'particle', 'のに'),
  'てみる': R(/((?:て|で)み(?:る|ます|た|ました|たい|て|よう))/, 'ending', 'てみる'),
  '～ばよかった': R(/(ばよかった|ば良かった)/, 'ending', 'ばよかった'),
  '～てすみません': R(/((?:て|で)すみません)/, 'ending', 'てすみません'),
  '～ないで': R(/(ないで)(?!ください)/, 'ending', 'ないで'),
  '～ているあいだに,～': R(/((?:間|あいだ)に)/, 'word', '間に'),
  '～てくれる': R(/((?:て|で)くれ)/, 'ending', 'てくれる'),
  '～のように': R(/(のように)/, 'ending', 'のように'),
  '～させる': R(/(させ(?:る|ます|た|ました|て))/, 'ending', 'させる'),
  '～させられる': R(/(させられ)/, 'ending', 'させられる'),
  '～し': P('し', '接続助詞'),
  'なら': R(/(なら)(?!ない|ず|ば)/, 'particle', 'なら'),
  '～ことにする': R(/(ことにし)/, 'ending', 'ことにする'),
  '～てくれてありがとう': R(/((?:て|で)くれてありがとう)/, 'ending', 'てくれてありがとう'),
  '～ておく': R(/((?:て|で)お(?:く|きます|いた|いて|きましょう))/, 'ending', 'ておく'),
  '～てしまう': R(/((?:て|で)しま(?:う|います|った|いました|って)|(?:ちゃ|じゃ)(?:う|った))/, 'ending', 'てしまう'),
  '～のような': R(/(のような)/, 'ending', 'のような'),
  '～ても': R(/[いきしちにひみりぎびえけせねへめれげべっん][てで](も)(?!いい|良い|よい|よろし|ら|かまわ|構わ|いけ|大丈夫)/, 'particle', 'も'),
  '～よう': R(/[えけせてねへめれげべみきしちにひりい](よう)(?:と|か|よ|ぜ|。|！)/, 'ending', 'よう'),
  '～みたい': R(/(みたい)/, 'ending', 'みたい'),
  '～ながら': R(/(ながら)/, 'ending', 'ながら'),
  '～なくてもいい': R(/(なくても(?:いい|良い|かまわない|構わない))/, 'ending', 'なくてもいい'),
  '～てよかった': R(/((?:て|で)(?:よかった|良かった))/, 'ending', 'てよかった'),
  '～たら': R(/[いきしちにひみりぎびえけせてねへめれげべっん]((?:た|だ)ら)(?!どう)/, 'ending', 'たら'),
  '～にくい': R(/(にく[いかく])/, 'ending', 'にくい'),
  '～そうです': R(/[いきしちにひみりぎびえけせてねへめれげべ](そう(?:です|だ|な|に))/, 'ending', 'そう'),
  '～たがる': R(/(たが(?:る|ります|って|った))/, 'ending', 'たがる'),
  '～のようてほしい': R(/((?:て|で)ほし[いかく])/, 'ending', 'てほしい'),
  'Dictionary form+と': { kind: 'particle', show: 'と', cond: true },
  '(period)に(frequency)': R(/(?:日|週|月|年|時間)(に)[一二三四五六七八九十何]/, 'particle', 'に'),
  'Number+も': R(/[一二三四五六七八九十百千万何]+(?:人|時間|回|本|冊|杯|枚|日|年|個|台|匹|分|キロ|週間|ヶ月|か月)(も)/, 'particle', 'も'),
  // N3
  '～ものを': R(/[いたばる](ものを)[、。…]/, 'word', 'ものを'),
  '～ところを': R(/[いたるな](ところを)(?=お|ご|わざわざ|すみません|申し訳|失礼)/, 'word', 'ところを'),
  '～始める': R(/[いきしちにひみりぎびえけせてねへめれげべ]((?:始|はじ)め(?:る|ます|た|ました|て))/, 'ending', '始める'),
  '～げ': R(/[しさ](げ)(?:に|な|だ)/, 'ending', 'げ'),
  '～ず': R(/[らかさたなまわがばえけせてねめれげべ](ず)(?:に|、)/, 'ending', 'ず'),
  '的': R(/\p{Script=Han}(的)(?:な|に)/u, 'ending', '的'),
  // N2
  '～ないで済む': R(/(ないで(?:済|す)[むみんま])/, 'ending', 'ないで済む'),
  'いったんーば': R(/(いったん|一旦)/, 'word', 'いったん'),
  '～からなる(成る)': R(/(から(?:なる|成る|なって|成って|なり|成り))/, 'ending', 'からなる'),
  'かたわら（傍ら）': R(/(かたわら|傍ら)/, 'word', 'かたわら'),
  '～を～にまかせる': R(/を.*?に((?:任|まか)せ)/, 'word', '任せ'),
  'いたるまで（至るまで）': R(/((?:至|いた)るまで)/, 'word', '至るまで'),
};
// N3–N1: the pattern itself, as written (its other spelling in brackets too).
const WORD_LIKE = /^[\p{Script=Hiragana}\p{Script=Han}ー]+$/u;
function autoRule(g) {
  const forms = g
    .replace(/（(.+?)）/g, '/$1')
    .split(/[\/／]/)
    .map((f) => f.replace(/[～~…()（）\s]|N\+|Number\+|stem \+|Dictionary form\+/g, '').replace(/[ーｰ]ば$/, 'ば'))
    .filter((f) => f.length >= 2 && WORD_LIKE.test(f));
  // "～ば～ほど", "～さえ～ば": the parts in order, the first one blanked.
  const parts = g.split(/[～~]/).map((s) => s.replace(/[\s()（）]|N\+/g, '')).filter(Boolean);
  if (parts.length >= 2 && parts.every((p) => WORD_LIKE.test(p))) return R(new RegExp(`(${esc(parts[0])}).*?${parts.slice(1).map(esc).join('.*?')}`), 'word', parts[0]);
  if (!forms.length) return null;
  return R(new RegExp(`(${forms.sort((a, b) => b.length - a.length).map(esc).join('|')})`), forms[0].length <= 2 ? 'particle' : 'word', forms[0]);
}
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/** Never offered together: both would fit the blank. */
const SAME = [['は', 'が'], ['に', 'へ'], ['ので', 'から'], ['たら', 'ば', 'なら', 'と'], ['のような', 'みたい', 'のように'], ['ぐらい', 'くらい', 'ほど'], ['すでに', '既に'], ['やっぱり', 'やはり'], ['てしまう', 'ちゃう'], ['つもり', 'う'], ['なくちゃ', 'なければ'], ['しか', 'だけ'], ['んです', 'のです'], ['でしょう', 'かもしれない'], ['ましょう', 'ましょうか'], ['ている', 'てある'], ['ていません', 'ない'], ['のが好き', 'のが上手'], ['ず', 'ないで']];
const clash = (a, b) => a === b || SAME.some((g) => g.includes(a) && g.includes(b));

// ── Sentences ──
/** Tatoeba's furigana ("[漢字|かん|じ]…") as plain text, to check it matches the sentence. */
const plain = (f) => f.replace(/\[([^|\]]+)\|[^\]]*\]/g, '$1');
const candidates = [];
for (const [id, text] of jpn) {
  const en = (engOf.get(id) ?? []).map((x) => other.get(x)).filter(Boolean).sort((a, b) => a.length - b.length)[0];
  if (!en || text.replace(/[。、！？…!?\s]/g, '').length < 5 || text.length > 32 || /[a-zA-Zａ-ｚＡ-Ｚ0-9０-９「」『』]/.test(text)) continue;
  const f = furigana.get(id);
  if (!f || plain(f) !== text) continue;
  const lv = kanjiLevel(text);
  if (!lv) continue;
  const fr = (fraOf.get(id) ?? []).map((x) => other.get(x)).filter(Boolean).sort((a, b) => a.length - b.length)[0];
  candidates.push({ id, text, en, fr, furigana: f, kanjiLevel: lv, audio: audio.get(id) });
}
console.log(`${candidates.length} sentences to look through (${candidates.filter((c) => c.audio).length} with a recording)`);

/** Motion verbs: に or へ before one of them marks where to. */
const MOTION = new Set(['行く', '来る', '帰る', '戻る', '出かける', '着く', '入る', '向かう', '引っ越す']);
/** Where a grammar point is in a sentence: [start, end] of its blank, or null. `toks()` tokenizes it (once). */
function findGrammar(rule, c, toks) {
  const tokens = () => {
    let at = 0;
    return toks().map((t) => ({ ...t, start: at, end: (at += t.surface_form.length) }));
  };
  if (rule.tok) {
    const t = tokens().find((t, i, all) => t.surface_form === rule.tok.surface && t.pos === '助詞' && t.pos_detail_1 === rule.tok.detail && !(rule.tok.surface === 'も' && /[てで]$/.test(all[i - 1]?.surface_form ?? '')));
    return t ? [t.start, t.end] : null;
  }
  // A conditional と: after a verb's dictionary form, then a comma (not それはそうと).
  if (rule.cond) {
    const all = tokens();
    const t = all.find((t, i) => t.surface_form === 'と' && t.pos === '助詞' && all[i - 1]?.pos === '動詞' && all[i - 1].conjugated_form === '基本形' && all[i + 1]?.surface_form === '、');
    return t ? [t.start, t.end] : null;
  }
  if (rule.dir) {
    const all = tokens();
    const t = all.find((t, i) => (t.surface_form === 'に' || t.surface_form === 'へ') && t.pos === '助詞' && all.slice(i + 1, i + 3).some((n) => n.pos === '動詞' && MOTION.has(n.basic_form)));
    return t ? [t.start, t.end] : null;
  }
  const m = rule.re.exec(c.text);
  if (!m) return null;
  const gi = m.slice(1).findIndex((x) => x !== undefined);
  const blank = gi >= 0 ? m[gi + 1] : m[0];
  const start = m.index + m[0].indexOf(blank);
  const end = start + blank.length;
  // The blank starts and ends where words do (つい in ついた is not the adverb).
  const all = tokens();
  if (!all.some((t) => t.start === start) || !all.some((t) => t.end === end)) return null;
  // A word of the pattern written in kana (つい, まさか, せっかく…) is that word, not part of a verb.
  if (rule.kind === 'word' && /^[\p{Script=Hiragana}]{2,5}$/u.test(blank)) {
    const first = all.find((t) => t.start === start);
    if (['動詞', '形容詞', '助動詞'].includes(first.pos)) return null;
  }
  return [start, end];
}
/** The blank widened to the furigana's pieces (a kanji word is never cut in two). */
function snap(f, [s, e]) {
  let at = 0;
  for (const m of f.matchAll(/\[([^|\]]+)\|[^\]]*\]|([^[]+)/g)) {
    const len = (m[1] ?? m[2]).length;
    if (m[1] && at < e && at + len > s) (s = Math.min(s, at)), (e = Math.max(e, at + len));
    at += len;
  }
  return [s, e];
}

// Every sentence once: tokenized (when needed), every level's grammar points and nouns looked for.
const LEVEL_RULES = Object.fromEntries(jlpt.levels.map((l) => [l.level, l.grammar.map((g) => [g, RULES[g] ?? autoRule(g)])]));
const stats = [];
for (const [lv, rules] of Object.entries(LEVEL_RULES)) for (const [g, r] of rules) if (!r) stats.push(`${lv} ${g}: no rule`);
/** Kanji up to two levels above (their furigana shows from the start). */
const fitsLevel = (c, level) => rank(c.kanjiLevel) <= rank(level) + 2;
const grammarFound = new Map();
const nounFound = new Map(LEVELS.map((l) => [l, []]));
let n = 0;
for (const c of candidates) {
  if (++n % 20000 === 0) console.log(`  ${n} looked through`);
  let tokens = null;
  const toks = () => (tokens ??= tokenizer.tokenize(c.text));
  for (const level of LEVELS) {
    if (!fitsLevel(c, level)) continue;
    for (const [g, rule] of LEVEL_RULES[level]) {
      if (!rule || (rule.tok && !c.text.includes(rule.tok.surface))) continue;
      const span = findGrammar(rule, c, toks);
      if (!span || span[1] <= span[0]) continue;
      const key = `${level}|${g}`;
      (grammarFound.get(key) ?? grammarFound.set(key, []).get(key)).push({ c, span: snap(c.furigana, span) });
    }
  }
  // A noun of the list, for the word blanks (recorded or short sentences only).
  if (!c.audio && c.text.length > 16) continue;
  let at = 0;
  for (const t of toks()) {
    const start = at;
    at += t.surface_form.length;
    const e = WORDS.get(t.surface_form);
    if (!e || e.text.split('/')[0] !== t.surface_form || t.pos !== '名詞' || !isNoun(e) || t.surface_form.length < 2 || !fitsLevel(c, e.level)) continue;
    nounFound.get(e.level).push({ c, span: snap(c.furigana, [start, at]), word: e });
    break;
  }
}

const out = {};
const recordedFirst = (a, b) => (b.c.audio ? 1 : 0) - (a.c.audio ? 1 : 0) || a.c.text.length - b.c.text.length;
for (const level of LEVELS) {
  const items = [];
  const used = new Set();
  // Grammar: up to four sentences for each point, the recorded and shortest first.
  for (const [g, rule] of LEVEL_RULES[level]) {
    if (!rule) continue;
    const found = (grammarFound.get(`${level}|${g}`) ?? []).filter((x) => !used.has(x.c.id)).sort(recordedFirst);
    stats.push(`${level} ${g}: ${found.length} found, ${found.filter((x) => x.c.audio).length} recorded`);
    for (const { c, span } of found.slice(0, 4)) {
      used.add(c.id);
      items.push({ c, span, grammar: g, kind: rule.kind, show: rule.show, pair: rule.pair });
    }
  }
  // Words: up to 60 of the level's nouns, each once.
  const seenWord = new Set();
  for (const w of nounFound.get(level).sort(recordedFirst)) {
    if (items.filter((x) => x.word).length >= 60) break;
    if (seenWord.has(w.word.id) || used.has(w.c.id)) continue;
    seenWord.add(w.word.id);
    used.add(w.c.id);
    items.push({ c: w.c, span: w.span, word: w.word, kind: 'noun' });
  }
  out[level] = items;
}

// ── The wrong answers, and the file ──
const nounsOf = (level) => [...new Map([...WORDS.values()].filter((e) => e.level === level && isNoun(e) && e.text.length >= 2).map((e) => [e.id, e])).values()];
const pick = (xs, n, ok) => {
  const res = [];
  for (const x of xs.sort(() => Math.random() - 0.5)) if (res.length < n && ok(x, res)) res.push(x);
  return res;
};
const file = { source: 'Tatoeba (tatoeba.org) — sentences CC BY 2.0 FR; recordings CC BY 4.0 / CC BY-NC 4.0, credited by voice', levels: {} };
for (const level of LEVELS) {
  const items = out[level];
  const grammarShows = items.filter((x) => x.grammar).map((x) => ({ show: x.show, kind: x.kind }));
  const nouns = nounsOf(level);
  file.levels[level] = items.map((x) => {
    const answer = x.c.text.slice(x.span[0], x.span[1]);
    let wrong;
    if (x.word) {
      const kanji = /\p{Script=Han}/u.test(answer);
      const shown = (e) => (kanji ? e.text : e.reading).split('/')[0];
      const like = nouns.filter((e) => /\p{Script=Han}/u.test(e.text) === kanji && Math.abs(shown(e).length - answer.length) <= 1);
      wrong = pick(like.length >= 6 ? like : nouns, 3, (e, res) => e.id !== x.word.id && e.meaning !== x.word.meaning && shown(e) !== answer && !res.some((r) => shown(r) === shown(e))).map(shown);
    } else {
      // The same kind first; a voiced answer (で…) gets voiced choices.
      const pool = [...new Map(grammarShows.filter((s) => s.kind === x.kind).concat(grammarShows).map((s) => [s.show, s])).values()];
      const voiced = /^で/.test(answer) && /^て/.test(x.show);
      wrong = pick(pool, 3, (s, res) => !clash(s.show, x.show) && !clash(s.show, answer) && !(x.pair ?? []).includes(s.show) && !res.some((r) => r.show === s.show)).map((s) => (voiced && /^て/.test(s.show) ? `で${s.show.slice(1)}` : s.show));
    }
    return {
      id: x.c.id,
      ja: x.c.text,
      furigana: x.c.furigana,
      blank: x.span,
      wrong,
      ...(x.grammar ? { grammar: x.grammar } : { word: x.word.id }),
      en: x.c.en,
      ...(x.c.fr ? { fr: x.c.fr } : {}),
      ...(x.c.audio ? { audio: { by: x.c.audio.by, license: x.c.audio.license } } : {}),
    };
  });
  console.log(`${level}: ${items.length} sentences (${items.filter((x) => x.grammar).length} grammar, ${items.filter((x) => x.word).length} words), ${items.filter((x) => x.c.audio).length} recorded`);
}
writeFileSync(OUT, JSON.stringify(file) + '\n');
writeFileSync(join(T, 'stats.txt'), stats.join('\n'));

// ── The recordings ──
if (!process.env.DRY) await fetchRecordings();
