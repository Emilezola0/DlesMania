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

// ── Romaji to kana, for typing Japanese on a Latin keyboard (Japanese Wordle): "kyou" → きょう. ──

const TO_KANA: Record<string, string> = {
  a: 'あ', i: 'い', u: 'う', e: 'え', o: 'お',
  ka: 'か', ki: 'き', ku: 'く', ke: 'け', ko: 'こ', ga: 'が', gi: 'ぎ', gu: 'ぐ', ge: 'げ', go: 'ご',
  sa: 'さ', shi: 'し', si: 'し', su: 'す', se: 'せ', so: 'そ', za: 'ざ', ji: 'じ', zi: 'じ', zu: 'ず', ze: 'ぜ', zo: 'ぞ',
  ta: 'た', chi: 'ち', ti: 'ち', tsu: 'つ', tu: 'つ', te: 'て', to: 'と', da: 'だ', di: 'ぢ', du: 'づ', de: 'で', do: 'ど',
  na: 'な', ni: 'に', nu: 'ぬ', ne: 'ね', no: 'の', ha: 'は', hi: 'ひ', fu: 'ふ', hu: 'ふ', he: 'へ', ho: 'ほ',
  ba: 'ば', bi: 'び', bu: 'ぶ', be: 'べ', bo: 'ぼ', pa: 'ぱ', pi: 'ぴ', pu: 'ぷ', pe: 'ぺ', po: 'ぽ',
  ma: 'ま', mi: 'み', mu: 'む', me: 'め', mo: 'も', ya: 'や', yu: 'ゆ', yo: 'よ',
  ra: 'ら', ri: 'り', ru: 'る', re: 'れ', ro: 'ろ', wa: 'わ', wo: 'を', nn: 'ん', "n'": 'ん', '-': 'ー', vu: 'ゔ',
  sha: 'しゃ', shu: 'しゅ', sho: 'しょ', she: 'しぇ', cha: 'ちゃ', chu: 'ちゅ', cho: 'ちょ', che: 'ちぇ', ja: 'じゃ', ju: 'じゅ', jo: 'じょ', je: 'じぇ',
  xa: 'ぁ', xi: 'ぃ', xu: 'ぅ', xe: 'ぇ', xo: 'ぉ', xya: 'ゃ', xyu: 'ゅ', xyo: 'ょ', xtsu: 'っ', xtu: 'っ',
};
// Every consonant + y + vowel (kya, nyu, ryo…): the i-sound and a small ya, yu, yo.
for (const [c, i] of Object.entries({ k: 'き', g: 'ぎ', n: 'に', h: 'ひ', b: 'び', p: 'ぴ', m: 'み', r: 'り', s: 'し', z: 'じ', t: 'ち', d: 'ぢ', j: 'じ', ch: 'ち' })) {
  TO_KANA[`${c}ya`] ??= `${i}ゃ`;
  TO_KANA[`${c}yu`] ??= `${i}ゅ`;
  TO_KANA[`${c}yo`] ??= `${i}ょ`;
}
const LONGEST = Math.max(...Object.keys(TO_KANA).map((k) => k.length));

/**
 * Romaji as hiragana, as an IME would type it: "toukyou" → とうきょう, "kitte" → きって, "konnichiha" →
 * こんにちは. Kana already typed stays as it is (katakana becomes hiragana); a lone final "n" stays a
 * Latin n until the next letter decides (ん, or な, に…), unless `final` says the typing is over.
 */
export function kanaFromRomaji(input: string, final = false): string {
  const s = toHiragana(input.toLowerCase());
  let out = '';
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (!/[a-z'-]/.test(c)) {
      out += c;
      i++;
      continue;
    }
    // "nn": ん — and before a vowel, the second n starts the next syllable ("konnichiha" → こんにちは).
    if (c === 'n' && s[i + 1] === 'n') {
      out += 'ん';
      i += /[aiueoy]/.test(s[i + 2] ?? '') ? 1 : 2;
      continue;
    }
    // A doubled consonant is a small っ ("kk" → っk; "tch" → っch).
    if ((/[bcdfghjklmpqrstvwxyz]/.test(c) && s[i + 1] === c) || (c === 't' && s.slice(i + 1, i + 3) === 'ch')) {
      out += 'っ';
      i++;
      continue;
    }
    let hit = '';
    for (let len = Math.min(LONGEST, s.length - i); len > 0; len--) {
      const k = s.slice(i, i + len);
      if (TO_KANA[k]) {
        hit = k;
        break;
      }
    }
    // An n before a consonant (or at the very end, once typing is over) is ん.
    if (c === 'n' && (!hit || hit === 'n')) {
      const next = s[i + 1];
      if (next !== undefined ? !/[aiueoy]/.test(next) : final) {
        out += 'ん';
        i++;
        continue;
      }
    }
    if (hit) {
      out += TO_KANA[hit];
      i += hit.length;
    } else {
      // Not (yet) a syllable: kept as typed, for the next letter to complete.
      out += c;
      i++;
    }
  }
  return out;
}
