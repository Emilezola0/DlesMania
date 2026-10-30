// The JLPT boss: Oni-Sensei, keeper of the kanji. Its cards are kanji drawn by the app ("kanji:山", see
// src/lib/kanji.ts), named by their meaning; their readings, in romaji and in kana, are accepted too.
// Every Japanese word, kanji and reading comes from src/data/jlpt.json (Coto Academy's list) — no other
// source. Radar: everyday kanji against N1 ones. Final Blow: N5 and N4 kanji to name by their meaning.
// Blitz and Name Chain: the list's words by topic. Signature (Hard): N3 kanji. Re-run after changing the list.
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

// Everyday kanji to keep on the Radar (every one from the list, N5 to N2), against N1 kanji: the ones a
// learner isn't ready for yet. Everything Japanese here comes from src/data/jlpt.json.
const TWINS = [
  ['気', 'Spirit'], ['語', 'Language'], ['書', 'Write'], ['東', 'East'], ['門', 'Gate'], ['車', 'Car'], ['馬', 'Horse'],
  ['鳥', 'Bird'], ['見', 'See'], ['長', 'Long'], ['話', 'Talk'], ['読', 'Read'], ['時', 'Time'], ['電', 'Electricity'],
  ['間', 'Interval'], ['聞', 'Hear'], ['買', 'Buy'], ['風', 'Wind'], ['魚', 'Fish'], ['開', 'Open'], ['飲', 'Drink'],
  ['飯', 'Meal'], ['駅', 'Station'], ['銀', 'Silver'],
];
const members = TWINS.map(([k, label]) => card(k, label));
const N1 = JLPT.levels.find((l) => l.level === 'N1').kanji;
const impostors = N1.filter(([, , m]) => !/[;,]/.test(m) && /^[a-z ]+$/i.test(m))
  .slice(0, 16)
  .map(([k, , m]) => ({ label: `${title(m)} (N1)`, image: `kanji:${k}` }));

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

// Knowledge Blitz and Name Chain: the list's own words about one thing (N5 to N3), found as in the theme
// decks (src/arcade/jlpt.ts): one of a word's first three senses is exactly one of these. Each is named in
// romaji first, then kana and kanji; a spelling two words share goes to the first only.
const TOPICS = {
  Animal: 'animal, dog, cat, bird, horse, cow, cattle, ox, pig, fish, insect, monkey, bear, rabbit, mouse, rat, sheep, chicken, duck, snake, frog, turtle, whale, elephant, lion, tiger, wolf, fox, deer, crow, butterfly, bee, ant, mosquito, spider, worm, crab, owl, eagle, dragon, pet, livestock',
  Food: 'food, meal, rice, cooked rice, bread, meat, beef, pork, egg, vegetable, fruit, apple, orange, banana, grape, strawberry, peach, melon, tomato, potato, onion, cabbage, mushroom, bean, beans, noodles, soup, curry, cake, candy, sweets, confectionery, sugar, salt, pepper, soy sauce, sauce, butter, cheese, milk, tea, green tea, black tea, coffee, juice, beer, sake, alcohol, wine, breakfast, lunch, dinner, supper, snack, lunch box, cuisine, dish, flour, oil, honey',
  'Body part': 'body, head, face, eye, ear, nose, mouth, tooth, teeth, tongue, lip, neck, throat, shoulder, arm, hand, finger, nail, leg, foot, knee, back, stomach, belly, chest, heart, bone, skin, hair, blood, brain, forehead, cheek, elbow, wrist, toe, waist',
  'Family member': 'family, father, mother, parent, parents, older brother, elder brother, younger brother, older sister, elder sister, younger sister, brother, sister, son, daughter, child, children, baby, grandfather, grandmother, grandchild, uncle, aunt, cousin, husband, wife, relative',
  Colour: 'color, colour, red, blue, green, yellow, white, black, brown, purple, pink, orange, gray, grey, gold, silver',
  Place: 'school, university, hospital, station, bank, post office, library, museum, park, shop, store, department store, supermarket, restaurant, hotel, inn, house, home, room, kitchen, toilet, bathroom, office, company, factory, temple, shrine, church, city, town, village, country, airport, harbour, port, police station, police box, bookstore, building, apartment, garden, zoo, cinema, stadium, embassy, castle, bridge',
  'Day or season': 'monday, tuesday, wednesday, thursday, friday, saturday, sunday, today, tomorrow, yesterday, morning, noon, afternoon, evening, night, spring, summer, autumn, winter, weekend',
};
const senses = (m) => m.split(/[;,]/).slice(0, 3).map((s) => s.replace(/\(.*?\)/g, '').trim().toLowerCase().replace(/^(a|an|the) /, ''));
const spelled = new Set();
const words = (topic, levels = ['N5', 'N4', 'N3']) => {
  const keys = new Set(TOPICS[topic].split(/,\s*/));
  const out = [];
  for (const level of levels) {
    for (const [text, reading, meaning] of JLPT.levels.find((l) => l.level === level).vocab) {
      if (!senses(meaning).some((s) => keys.has(s))) continue;
      const kana = reading.split(/[/／・、\s]+/).filter(Boolean).map(hira);
      const forms = [...new Set([...kana.map(romaji).filter(Boolean), ...kana, ...text.split(/[/／\s]+/)])].filter(Boolean);
      const key = (w) => w.toLowerCase().replace(/[^a-z0-9\u3041-\u30ff\u3400-\u9fff]/g, '');
      if (!forms.length || forms.some((f) => spelled.has(key(f)))) continue;
      forms.forEach((f) => spelled.add(key(f)));
      out.push(forms.join('|'));
    }
  }
  return out;
};
const PLURAL = { Animal: 'animals', Food: 'foods and drinks', 'Body part': 'body parts', 'Family member': 'family members', Colour: 'colour words', Place: 'places', 'Day or season': 'days, times and seasons' };
const chainTopics = ['Animal', 'Food', 'Place', 'Body part', 'Colour'];
const chainCategories = chainTopics.map((label) => ({ label, entities: words(label) }));
spelled.clear();
const blitz = Object.keys(TOPICS)
  .map((topic) => ({ topic, answers: words(topic, ['N5', 'N4']) }))
  .filter((t) => t.answers.length >= 6)
  .map(({ topic, answers }) => ({ prompt: `Name 5 ${PLURAL[topic]} in Japanese`, count: 5, answers }));

const boss = {
  id: 'jlpt',
  domain: 'anime',
  category: 'other',
  franchise: 'JLPT',
  aliases: ['jlpt', 'japanese', 'japonais', 'kanji', '漢字'],
  images: 'none',
  boss: { name: 'Oni-Sensei', title: 'Keeper of the Kanji', color: '#b91c1c', image: 'kanji:鬼' },
  // Japanese in the lines only from the list too: 違う (N5), すごい (N4), 合格 (N3), 始め (N5).
  lines: {
    intro: 'Welcome, student. Five levels, two thousand kanji, and not one of them will forgive a careless stroke. Show me what you have studied.',
    phase2: 'Half of these are N1 kanji you are not ready for. Keep the ones you should know, throw out the rest!',
    phase3: 'Final exam! Read each kanji before the bell rings.',
    hit: ['Correct. Hmph.', 'Sugoi.', 'Your stroke order is acceptable.'],
    hurt: ['Chigau!', 'Wrong reading!', 'Back to the textbook!', 'That one was N1, student.'],
    win: 'Gōkaku — you pass. Take my kanji with you; they are yours now.',
    lose: 'Fail. Study the N5 list again and come back tomorrow.',
    secret: 'One more lesson, no textbook. I say a word; you answer with another of the same kind. No repeats!',
    secretOk: ['Good.', 'Again!', 'Sugoi.'],
    secretLost: 'Silence? Then the lesson is over.',
  },

  blitz,
  radar: { members, impostors },
  finale,
  secret: { categories: chainCategories },
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
