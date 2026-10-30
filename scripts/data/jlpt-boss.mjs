// The JLPT boss: Oni-Sensei, keeper of the kanji. Its cards are kanji drawn by the app ("kanji:山", see
// src/lib/kanji.ts), named by their meaning; their readings, in romaji and in kana, are accepted too.
// Radar: the Japanese kanji against their simplified Chinese twins. Final Blow: N5 and N4 kanji to name
// by their meaning. Signature (Hard): N3 kanji. Re-run after changing src/data/jlpt.json.
// node scripts/data/jlpt-boss.mjs
import { readFileSync, writeFileSync } from 'node:fs';

const BOSSES = new URL('../../src/data/bosses.json', import.meta.url);
const JLPT = JSON.parse(readFileSync(new URL('../../src/data/jlpt.json', import.meta.url), 'utf8'));

// ── Kana to romaji (Hepburn, long vowels written out: とうきょう → toukyou). ──
const BASE = {
  あ: 'a', い: 'i', う: 'u', え: 'e', お: 'o', か: 'ka', き: 'ki', く: 'ku', け: 'ke', こ: 'ko', が: 'ga', ぎ: 'gi', ぐ: 'gu', げ: 'ge', ご: 'go',
  さ: 'sa', し: 'shi', す: 'su', せ: 'se', そ: 'so', ざ: 'za', じ: 'ji', ず: 'zu', ぜ: 'ze', ぞ: 'zo', た: 'ta', ち: 'chi', つ: 'tsu', て: 'te', と: 'to',
  だ: 'da', ぢ: 'ji', づ: 'zu', で: 'de', ど: 'do', な: 'na', に: 'ni', ぬ: 'nu', ね: 'ne', の: 'no', は: 'ha', ひ: 'hi', ふ: 'fu', へ: 'he', ほ: 'ho',
  ば: 'ba', び: 'bi', ぶ: 'bu', べ: 'be', ぼ: 'bo', ぱ: 'pa', ぴ: 'pi', ぷ: 'pu', ぺ: 'pe', ぽ: 'po', ま: 'ma', み: 'mi', む: 'mu', め: 'me', も: 'mo',
  や: 'ya', ゆ: 'yu', よ: 'yo', ら: 'ra', り: 'ri', る: 'ru', れ: 're', ろ: 'ro', わ: 'wa', を: 'wo', ん: 'n', ぁ: 'a', ぃ: 'i', ぅ: 'u', ぇ: 'e', ぉ: 'o',
};
const SMALL = { ゃ: 'ya', ゅ: 'yu', ょ: 'yo' };
const hira = (s) => s.replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60));
export function romaji(kana) {
  const s = hira(kana);
  let out = '';
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === 'っ') {
      const next = BASE[s[i + 1]];
      if (next) out += next[0] === 'c' ? 't' : next[0];
      continue;
    }
    if (SMALL[c]) {
      // きゃ → kya, しゃ → sha, ちゃ → cha, じゃ → ja.
      out = /(shi|chi|ji)$/.test(out) ? out.slice(0, -1) + SMALL[c].slice(1) : out.slice(0, -1) + SMALL[c];
      continue;
    }
    if (c === 'ー') continue;
    out += BASE[c] ?? '';
  }
  return out;
}

/** "サン・セン・やま" → the readings, okurigana marks and dashes dropped: ["さん", "せん", "やま"]. */
const readingsOf = (r) => [...new Set(r.split(/[・、\s]+/).map((x) => hira(x.replace(/[.\-～~]/g, ''))).filter(Boolean))];
const title = (s) => s[0].toUpperCase() + s.slice(1);
const KANJI = new Map(JLPT.levels.flatMap((l) => l.kanji.map(([k, r, m]) => [k, { level: l.level, reading: r, meanings: m.split(/;\s*/).map((x) => x.trim()).filter(Boolean) }])));

/** A kanji's card: named by its first meaning (or the one given), the other meanings and the readings accepted. */
function card(k, label) {
  const info = KANJI.get(k);
  const meanings = info?.meanings.filter((m) => !/radical|counter/i.test(m)) ?? [];
  const name = label ?? title(meanings[0]);
  const readings = info ? readingsOf(info.reading) : [];
  const aliases = [...new Set([...meanings.slice(label ? 0 : 1, 4).map(title), ...readings.map(romaji), ...readings, k])].filter((a) => a && a.toLowerCase() !== name.toLowerCase());
  return { label: name, image: `kanji:${k}`, aliases };
}

// The kanji Japan kept whole and their simplified Chinese twins.
const TWINS = [
  ['気', '气', 'Spirit'], ['語', '语', 'Language'], ['書', '书', 'Write'], ['東', '东', 'East'], ['門', '门', 'Gate'], ['車', '车', 'Car'], ['馬', '马', 'Horse'],
  ['鳥', '鸟', 'Bird'], ['見', '见', 'See'], ['長', '长', 'Long'], ['話', '话', 'Talk'], ['読', '读', 'Read'], ['時', '时', 'Time'], ['電', '电', 'Electricity'],
  ['間', '间', 'Interval'], ['聞', '闻', 'Hear'], ['買', '买', 'Buy'], ['風', '风', 'Wind'], ['魚', '鱼', 'Fish'], ['開', '开', 'Open'], ['飲', '饮', 'Drink'],
  ['飯', '饭', 'Meal'], ['駅', '驿', 'Station'], ['銀', '银', 'Silver'],
];
const members = TWINS.map(([k, , label]) => card(k, label));
const impostors = TWINS.slice(0, 16).map(([, z, label]) => ({ label: `${label} (simplified Chinese)`, image: `kanji:${z}` }));

const twinsUsed = new Set(TWINS.map(([k]) => k));
const FINALE = ['山', '川', '火', '水', '木', '金', '土', '雨', '花', '犬', '牛', '肉', '茶', '海', '夜', '朝', '春', '夏', '秋', '冬', '赤', '黒', '白', '手', '口', '目', '足', '店', '紙', '歌'];
const finale = FINALE.filter((k) => !twinsUsed.has(k)).map((k) => card(k));

// Hard's Signature: N3 kanji with one clear meaning.
const N3 = JLPT.levels.find((l) => l.level === 'N3').kanji;
const clues = N3.filter(([, , m]) => !/[;,]/.test(m) && m.length <= 14 && /^[a-z ]+$/i.test(m))
  .slice(0, 24)
  .map(([k, r]) => {
    const readings = readingsOf(r);
    const [meaning] = N3.find((x) => x[0] === k)[2].split(';');
    return { text: k, answer: [title(meaning), ...readings.map(romaji), ...readings].join('|') };
  });

/** Words a Name Chain can go through: romaji first, kana and kanji as other spellings. */
const chain = (label, words) => ({ label, entities: words.map((w) => w.join('|')) });

const boss = {
  id: 'jlpt',
  domain: 'anime',
  category: 'other',
  franchise: 'JLPT',
  aliases: ['jlpt', 'japanese', 'japonais', 'kanji', 'nihongo', '日本語'],
  images: 'none',
  boss: { name: 'Oni-Sensei', title: 'Keeper of the Kanji', color: '#b91c1c', image: 'kanji:鬼' },
  lines: {
    intro: 'Irasshai, student. Five levels, two thousand kanji, and not one of them will forgive a careless stroke. Show me what you have studied.',
    phase2: 'Half of these are not Japanese at all. Keep the kanji, throw out the simplified impostors!',
    phase3: 'Final exam! Read each kanji before the bell rings.',
    hit: ['Yoku dekimashita!', 'Correct. Hmph.', 'Your stroke order is acceptable.'],
    hurt: ['Chigaimasu!', 'Wrong reading!', 'Back to the textbook!', 'That was Chinese, student.'],
    win: 'Gōkaku — you pass. Take my kanji with you; they are yours now.',
    lose: 'Fail. Study the N5 list again and come back tomorrow.',
    secret: 'One more lesson, no textbook. I say a word; you answer with another of the same kind. No repeats!',
    secretOk: ['Sō desu!', 'Good.', 'Again!'],
    secretLost: 'Silence? Then the lesson is over.',
  },
  blitz: [
    { prompt: 'Name the 5 vowels of hiragana', count: 5, answers: ['a|あ', 'i|い', 'u|う', 'e|え', 'o|お'] },
    { prompt: 'Name the 4 seasons in Japanese', count: 4, answers: ['haru|はる|春', 'natsu|なつ|夏', 'aki|あき|秋', 'fuyu|ふゆ|冬'] },
    { prompt: 'Name 5 numbers in Japanese', count: 5, answers: ['ichi|いち|一', 'ni|に|二', 'san|さん|三', 'yon|よん|shi|し|四', 'go|ご|五', 'roku|ろく|六', 'nana|なな|shichi|しち|七', 'hachi|はち|八', 'kyuu|きゅう|kyu|ku|く|九', 'juu|じゅう|ju|十', 'hyaku|ひゃく|百', 'sen|せん|千', 'man|まん|万'] },
    { prompt: 'Name 5 days of the week in Japanese', count: 5, answers: ['getsuyoubi|げつようび|月曜日|getsuyobi', 'kayoubi|かようび|火曜日|kayobi', 'suiyoubi|すいようび|水曜日|suiyobi', 'mokuyoubi|もくようび|木曜日|mokuyobi', 'kinyoubi|きんようび|金曜日|kinyobi', 'doyoubi|どようび|土曜日|doyobi', 'nichiyoubi|にちようび|日曜日|nichiyobi'] },
    { prompt: 'Name 5 colours in Japanese', count: 5, answers: ['aka|あか|赤', 'ao|あお|青', 'kuro|くろ|黒', 'shiro|しろ|白', 'kiiro|きいろ|黄色', 'midori|みどり|緑', 'chairo|ちゃいろ|茶色', 'murasaki|むらさき|紫', 'pinku|ピンク', 'orenji|オレンジ'] },
    { prompt: 'Name the 3 Japanese scripts', count: 3, answers: ['hiragana|ひらがな', 'katakana|カタカナ', 'kanji|漢字'] },
    { prompt: 'Name the 5 JLPT levels', count: 5, answers: ['N1', 'N2', 'N3', 'N4', 'N5'] },
    { prompt: 'Name 5 family members in Japanese', count: 5, answers: ['haha|はは|母', 'chichi|ちち|父', 'ani|あに|兄', 'ane|あね|姉', 'otouto|おとうと|弟', 'imouto|いもうと|妹', 'sofu|そふ|祖父', 'sobo|そぼ|祖母', 'kazoku|かぞく|家族', 'okaasan|おかあさん|お母さん', 'otousan|おとうさん|お父さん'] },
    { prompt: 'Name 5 body parts in Japanese', count: 5, answers: ['me|め|目', 'mimi|みみ|耳', 'kuchi|くち|口', 'te|て|手', 'ashi|あし|足', 'atama|あたま|頭', 'kao|かお|顔', 'ha|は|歯', 'yubi|ゆび|指', 'kokoro|こころ|心'] },
  ],
  radar: { members, impostors },
  finale,
  secret: {
    categories: [
      chain('Animal', [['inu', 'いぬ', '犬'], ['neko', 'ねこ', '猫'], ['tori', 'とり', '鳥'], ['uma', 'うま', '馬'], ['sakana', 'さかな', '魚'], ['ushi', 'うし', '牛'], ['buta', 'ぶた', '豚'], ['saru', 'さる', '猿'], ['kuma', 'くま', '熊'], ['usagi', 'うさぎ', '兎']]),
      chain('Food', [['gohan', 'ごはん', 'ご飯'], ['pan', 'パン'], ['sushi', 'すし', '寿司'], ['ramen', 'ラーメン'], ['niku', 'にく', '肉'], ['yasai', 'やさい', '野菜'], ['tamago', 'たまご', '卵'], ['kudamono', 'くだもの', '果物'], ['mizu', 'みず', '水'], ['ocha', 'おちゃ', 'お茶']]),
      chain('Place', [['gakkou', 'がっこう', '学校', 'gakko'], ['eki', 'えき', '駅'], ['byouin', 'びょういん', '病院', 'byoin'], ['ginkou', 'ぎんこう', '銀行', 'ginko'], ['kouen', 'こうえん', '公園', 'koen'], ['mise', 'みせ', '店'], ['toshokan', 'としょかん', '図書館'], ['uchi', 'うち', '家'], ['yama', 'やま', '山'], ['umi', 'うみ', '海']]),
      chain('Verb', [['taberu', 'たべる', '食べる'], ['nomu', 'のむ', '飲む'], ['miru', 'みる', '見る'], ['iku', 'いく', '行く'], ['kuru', 'くる', '来る'], ['suru', 'する'], ['yomu', 'よむ', '読む'], ['kaku', 'かく', '書く'], ['hanasu', 'はなす', '話す'], ['kiku', 'きく', '聞く'], ['kau', 'かう', '買う'], ['neru', 'ねる', '寝る']]),
      chain('Adjective', [['ookii', 'おおきい', '大きい'], ['chiisai', 'ちいさい', '小さい'], ['atarashii', 'あたらしい', '新しい'], ['furui', 'ふるい', '古い'], ['takai', 'たかい', '高い'], ['yasui', 'やすい', '安い'], ['atsui', 'あつい', '暑い'], ['samui', 'さむい', '寒い'], ['oishii', 'おいしい'], ['tanoshii', 'たのしい', '楽しい']]),
    ],
  },
  signature: { label: 'Kanji', prompt: 'What does this kanji mean?', clues },
};

// The album's JLPT cards beyond the boss's: a card for every kanji of the list (src/data/jlpt-cards.json), and what
// every JLPT card says (its kanji, readings and meanings, the boss's cards too).
const CARDS = new URL('../../src/data/jlpt-cards.json', import.meta.url);
const info = (k, name) => {
  const x = KANJI.get(k);
  return x && { name, kanji: k, reading: x.reading, meaning: x.meanings.filter((m) => !/radical|counter/i.test(m)).slice(0, 4).join(', '), level: x.level };
};
const described = [...members, ...finale].map((c) => info(c.image.slice(6), c.label)).filter(Boolean);
const taken = new Set(described.map((c) => c.name.toLowerCase()));
const roster = [];
for (const level of ['N5', 'N4']) {
  JLPT.levels.find((l) => l.level === level).kanji.forEach(([k], i) => {
    const c = card(k);
    if (twinsUsed.has(k) || FINALE.includes(k) || taken.has(c.label.toLowerCase())) return;
    taken.add(c.label.toLowerCase());
    roster.push({ ...info(k, c.label), rarity: level === 'N4' && i % 5 === 0 ? 'rare' : 'common' });
  });
}
// Then every other kanji of the list, so the set has a card for each one: N3 to N1, and the N5 and N4 kanji
// whose meaning a card already had (named by another of their meanings, else with the kanji itself).
const slug = (s) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const slugs = new Set([...members, ...finale, ...roster].map((c) => slug(c.label ?? c.name)));
const carded = new Set([...TWINS.map(([k]) => k), ...FINALE, ...roster.map((c) => c.kanji)]);
for (const level of ['N5', 'N4', 'N3', 'N2', 'N1']) {
  JLPT.levels.find((l) => l.level === level).kanji.forEach(([k], i) => {
    if (carded.has(k) || !KANJI.has(k)) return;
    carded.add(k);
    const meanings = KANJI.get(k).meanings.filter((m) => !/radical|counter/i.test(m)).map(title);
    // A card's id is its name in plain letters ("jlpt:settle-debt-etc"), so names must differ there too:
    // another meaning, else the meaning and the kanji's reading ("Kanji (ka)").
    const free = (n) => !taken.has(n.toLowerCase()) && !slugs.has(slug(n));
    const reading = romaji(readingsOf(KANJI.get(k).reading)[0] ?? '') || 'kanji';
    let name = meanings.find(free) ?? `${meanings[0] ?? 'Kanji'} (${reading})`;
    for (let n = 2; !free(name); n++) name = `${meanings[0] ?? 'Kanji'} (${reading} ${n})`;
    taken.add(name.toLowerCase());
    slugs.add(slug(name));
    const rarity = level === 'N5' || level === 'N4' ? 'common' : level === 'N3' ? (i % 4 === 0 ? 'rare' : 'common') : level === 'N2' ? (i % 3 === 0 ? 'rare' : 'common') : i % 8 === 0 ? 'epic' : 'rare';
    roster.push({ ...info(k, name), rarity });
  });
}
// Compact rows: [name, kanji, reading, meaning, level(, rarity)].
const row = (c) => [c.name, c.kanji, c.reading, c.meaning, c.level, ...(c.rarity ? [c.rarity] : [])];
writeFileSync(CARDS, `${JSON.stringify({ described: described.map(row), roster: roster.map(row) })}\n`);

const bosses = JSON.parse(readFileSync(BOSSES, 'utf8'));
const at = bosses.findIndex((b) => b.id === 'jlpt');
if (at >= 0) bosses[at] = boss;
else bosses.push(boss);
writeFileSync(BOSSES, `${JSON.stringify(bosses, null, 2)}\n`);
console.log(`jlpt: ${roster.length} more album cards, ${members.length} members, ${impostors.length} impostors, ${finale.length} final blow, ${clues.length} signature clues`);
