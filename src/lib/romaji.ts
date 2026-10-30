// Kana to romaji (Hepburn, long vowels written out: とうきょう → toukyou), for answers typed on a Latin
// keyboard. The same table as scripts/data/jlpt-boss.mjs.

const BASE: Record<string, string> = {
  あ: 'a', い: 'i', う: 'u', え: 'e', お: 'o', か: 'ka', き: 'ki', く: 'ku', け: 'ke', こ: 'ko', が: 'ga', ぎ: 'gi', ぐ: 'gu', げ: 'ge', ご: 'go',
  さ: 'sa', し: 'shi', す: 'su', せ: 'se', そ: 'so', ざ: 'za', じ: 'ji', ず: 'zu', ぜ: 'ze', ぞ: 'zo', た: 'ta', ち: 'chi', つ: 'tsu', て: 'te', と: 'to',
  だ: 'da', ぢ: 'ji', づ: 'zu', で: 'de', ど: 'do', な: 'na', に: 'ni', ぬ: 'nu', ね: 'ne', の: 'no', は: 'ha', ひ: 'hi', ふ: 'fu', へ: 'he', ほ: 'ho',
  ば: 'ba', び: 'bi', ぶ: 'bu', べ: 'be', ぼ: 'bo', ぱ: 'pa', ぴ: 'pi', ぷ: 'pu', ぺ: 'pe', ぽ: 'po', ま: 'ma', み: 'mi', む: 'mu', め: 'me', も: 'mo',
  や: 'ya', ゆ: 'yu', よ: 'yo', ら: 'ra', り: 'ri', る: 'ru', れ: 're', ろ: 'ro', わ: 'wa', を: 'wo', ん: 'n', ぁ: 'a', ぃ: 'i', ぅ: 'u', ぇ: 'e', ぉ: 'o', ゔ: 'vu',
};
const SMALL: Record<string, string> = { ゃ: 'ya', ゅ: 'yu', ょ: 'yo' };

/** Katakana as hiragana. */
export const toHiragana = (s: string) => s.replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60));

export function romaji(kana: string): string {
  const s = toHiragana(kana);
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
    // A long mark repeats the vowel before it (ラーメン → raamen).
    if (c === 'ー') {
      out += out.slice(-1);
      continue;
    }
    out += BASE[c] ?? '';
  }
  return out;
}

/** Every Latin spelling people use for a reading: "toukyou", "tokyo", "toukyo"… (long vowels written or not). */
export function romajiSpellings(kana: string): string[] {
  const r = romaji(kana);
  const short = r.replace(/ou/g, 'o').replace(/uu/g, 'u').replace(/aa/g, 'a').replace(/ii/g, 'i').replace(/ee/g, 'e').replace(/oo/g, 'o');
  return [...new Set([r, short, r.replace(/ou/g, 'oh')])].filter(Boolean);
}
