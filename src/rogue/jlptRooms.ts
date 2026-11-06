// The Expedition's rooms in Japanese (the JLPT franchise): everything from the list (src/data/jlpt.json).
// Blurred portrait and Who Am I? on its kanji — named by their meaning or reading (romaji or kana) —
// and Higher or Lower on its levels. Odd One Out and Quick Sort have their own JLPT boards already.
import { JLPT_LEVELS, shortMeaning, type JlptEntry } from '../arcade/jlpt';
import type { HlDeck } from '../arcade/higherLower';
import type { WhoTarget, WhoUniverse } from '../arcade/whoAmI';
import { kanjiPicture } from '../lib/kanji';
import { romajiSpellings, toHiragana } from '../lib/romaji';

const deck = (level: string, kind: 'kanji' | 'vocab') => JLPT_LEVELS.find((l) => l.level === level)!.decks.find((d) => d.kind === kind)!.entries;
/** A kanji's readings in kana (on'yomi in hiragana too, a kun'yomi without its okurigana). */
const readings = (e: JlptEntry) => e.reading.split(/[・、/／\s]+/).map((r) => r.replace(/[-－]/g, '').split('.')[0]).filter(Boolean);
const onKun = (e: JlptEntry) => {
  const rs = e.reading.split(/[・、\s]+/).filter(Boolean);
  return { on: rs.filter((r) => /^[゠-ヿ]/.test(r)), kun: rs.filter((r) => !/^[゠-ヿ]/.test(r)) };
};

/** N5 and N4's kanji, each a "who" to name: its meaning (any sense) or a reading, in kana or romaji. */
const KANJI: WhoTarget[] = [...deck('N5', 'kanji'), ...deck('N4', 'kanji')].map((e) => {
  const { on, kun } = onKun(e);
  const kana = [...new Set(readings(e).map(toHiragana))];
  const senses = e.meaning.split(/[;,]\s*/).map((s) => s.trim()).filter(Boolean);
  return {
    id: e.id,
    // Its reading and meaning with it: what the round teaches once it's over.
    name: `${e.text} · ${kana[0] ?? ''} (${shortMeaning(e.meaning, 1)})`,
    aliases: [...new Set([e.text, ...senses, ...kana, ...kana.flatMap(romajiSpellings)])],
    image: kanjiPicture(`kanji:${e.text}`),
    clues: [
      `An ${e.level} kanji`,
      kun.length ? `Its kun reading: ${kun.join('・')}` : 'It has no kun reading',
      on.length ? `Its on reading: ${on.join('・')}` : 'It has no on reading',
      `It means “${shortMeaning(e.meaning, 3)}”`,
      `It has ${kana.length} reading${kana.length === 1 ? '' : 's'}`,
    ],
  };
});

export const JLPT_UNIVERSE: WhoUniverse = { id: 'jlpt', label: 'Japanese kanji', icon: '🈴', domain: 'anime', pool: KANJI, targets: KANJI };

/** Which is from the harder level? N5 (the first) is 1, N1 is 5. */
const levelValue = (l: string) => 6 - Number(l.slice(1));
const hl = (id: string, label: string, entries: JlptEntry[], icon: string): HlDeck => ({
  id,
  label,
  question: 'Which is from the harder level (N5 → N1)?',
  higher: 'Harder',
  lower: 'Easier',
  icon,
  domain: 'anime',
  items: entries.map((e) => ({ id: e.id, name: `${e.text} · ${e.reading} (${shortMeaning(e.meaning, 1)})`, image: kanjiPicture(`kanji:${e.text}`), value: levelValue(e.level), shown: e.level })),
});
const sample = <T,>(xs: T[], n: number) => xs.filter((_, i) => i % Math.max(1, Math.floor(xs.length / n)) === 0).slice(0, n);
export const JLPT_HL_DECKS: HlDeck[] = [
  hl('jlpt-kanji-level', 'Japanese kanji: which level?', JLPT_LEVELS.flatMap((l) => sample(deck(l.level, 'kanji'), 60)), '字'),
  hl('jlpt-word-level', 'Japanese words: which level?', JLPT_LEVELS.flatMap((l) => sample(deck(l.level, 'vocab').filter((e) => !/[/／\s]/.test(e.text)), 60)), '語'),
];
