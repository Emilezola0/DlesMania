import data from '../data/jlpt.json';
import { dayNumber } from '../lib/date';
import { hashString, mulberry32, shuffle } from '../lib/rng';

/** A word or a kanji: what's written, how it's read, what it means. */
export interface JlptEntry {
  id: string;
  text: string;
  reading: string;
  meaning: string;
  level: string;
}

export type JlptKind = 'vocab' | 'kanji' | 'theme' | 'review';

export interface JlptDeck {
  /** "n5-vocab", "n1-kanji", "theme-animals"… also the best's key, after "jlpt:". */
  id: string;
  /** "N5"…"N1"; "All" for the theme decks, which mix every level. */
  level: string;
  kind: JlptKind;
  label: string;
  entries: JlptEntry[];
  /** Theme decks: an icon. */
  icon?: string;
}

export interface JlptLevel {
  level: string;
  grammar: string[];
  decks: JlptDeck[];
}

export const JLPT_SOURCE = data.source;

/** N5 (easiest) to N1, each with its vocabulary and kanji decks and its grammar list. */
export const JLPT_LEVELS: JlptLevel[] = data.levels.map((l) => ({
  level: l.level,
  grammar: l.grammar,
  decks: (['vocab', 'kanji'] as const).map((kind) => ({
    id: `${l.level.toLowerCase()}-${kind}`,
    level: l.level,
    kind,
    label: `${l.level} ${kind === 'vocab' ? 'Vocabulary' : 'Kanji'}`,
    entries: (l[kind] as string[][]).map(([text, reading, meaning], i) => ({ id: `${l.level}:${kind}:${i}`, text, reading, meaning, level: l.level })),
  })),
}));

/**
 * Theme decks: the words of every level about one thing. A word is in a theme when one of its first three
 * senses (articles and notes in brackets left out) is exactly one of the theme's words — "dog", "older
 * sister", "post office" — so "box" isn't food for being in "lunch box", nor "to fly" an animal.
 */
const THEMES: { id: string; label: string; icon: string; words: string }[] = [
  { id: 'animals', label: 'Animals', icon: '🐾', words: 'animal, dog, cat, bird, horse, cow, cattle, ox, pig, fish, insect, bug, monkey, bear, rabbit, mouse, rat, sheep, goat, chicken, hen, rooster, duck, snake, frog, turtle, tortoise, whale, dolphin, elephant, lion, tiger, wolf, fox, deer, crow, pigeon, sparrow, butterfly, bee, ant, mosquito, spider, worm, crab, shrimp, octopus, squid, shark, salmon, tuna, eel, owl, eagle, hawk, dragon, beast, pet, kitten, puppy, livestock, poultry, camel, giraffe, panda, penguin, seagull, crane, goldfish, carp, cicada, cricket, dragonfly, squirrel, raccoon dog, bat, lizard, living thing, creature, wild animal' },
  { id: 'food', label: 'Food & drink', icon: '🍙', words: 'food, meal, rice, cooked rice, bread, meat, beef, pork, chicken meat, egg, vegetable, vegetables, fruit, apple, orange, mandarin orange, banana, grape, strawberry, peach, pear, watermelon, melon, tomato, potato, carrot, onion, cabbage, mushroom, bean, beans, tofu, noodles, soba, udon, ramen, sushi, soup, curry, salad, cake, candy, sweets, confectionery, chocolate, ice cream, sugar, salt, pepper, soy sauce, sauce, butter, cheese, milk, tea, green tea, black tea, coffee, juice, beer, sake, alcohol, wine, drink, breakfast, lunch, dinner, supper, evening meal, snack, lunch box, boxed lunch, cooking, cuisine, dish, seaweed, miso, flour, oil, vinegar, honey, rice ball, tempura, ingredient, dessert, delicious, tasty' },
  { id: 'body', label: 'The body', icon: '🫀', words: 'body, head, face, eye, eyes, ear, ears, nose, mouth, tooth, teeth, tongue, lip, lips, neck, throat, shoulder, arm, hand, finger, nail, leg, foot, feet, knee, hip, back, stomach, belly, abdomen, chest, breast, heart, lung, lungs, bone, skin, hair, blood, muscle, brain, forehead, cheek, chin, eyebrow, elbow, wrist, ankle, heel, toe, waist, navel, sweat, tears, voice' },
  { id: 'family', label: 'Family & people', icon: '👪', words: 'family, father, mother, parent, parents, older brother, elder brother, younger brother, older sister, elder sister, younger sister, brother, sister, brothers, sisters, son, daughter, child, children, baby, grandfather, grandmother, grandchild, uncle, aunt, cousin, nephew, niece, husband, wife, married couple, relative, relatives, ancestor, twins, man, woman, boy, girl, adult, friend, person, people, neighbour, neighbor, guest, customer, everyone, oneself' },
  { id: 'nature', label: 'Nature & weather', icon: '🌸', words: 'nature, weather, rain, snow, wind, cloud, clouds, sky, sun, moon, star, stars, mountain, river, sea, ocean, lake, pond, island, forest, woods, tree, trees, flower, flowers, grass, leaf, leaves, stone, rock, sand, earth, ground, fire, water, ice, storm, typhoon, thunder, lightning, earthquake, rainbow, fog, mist, season, spring, summer, autumn, winter, beach, coast, valley, hill, field, volcano, wave, waves, fine weather, sunshine, dew, frost, cherry blossom, cherry tree, bamboo, pine, hot, cold, warm, cool' },
  { id: 'time', label: 'Time & calendar', icon: '📅', words: 'time, today, tomorrow, yesterday, morning, noon, afternoon, evening, night, midnight, week, month, year, day, hour, minute, weekend, weekday, monday, tuesday, wednesday, thursday, friday, saturday, sunday, calendar, date, birthday, holiday, holidays, vacation, this morning, this evening, tonight, last week, next week, this week, last month, next month, this month, last year, next year, this year, every day, every morning, every night, every week, every month, every year, day after tomorrow, day before yesterday, now, soon, already, still, always, sometimes, often, early, late' },
  { id: 'places', label: 'Places & town', icon: '🏯', words: 'place, school, university, hospital, station, bank, post office, library, museum, park, shop, store, department store, supermarket, restaurant, cafe, coffee shop, hotel, inn, house, home, room, kitchen, toilet, bathroom, office, company, factory, temple, shrine, church, city, town, village, country, countryside, airport, harbour, harbor, port, police station, police box, bookstore, building, apartment, garden, zoo, cinema, movie theater, theater, theatre, stadium, gym, swimming pool, embassy, castle, bridge, road, street, corner, entrance, exit, map, neighbourhood, neighborhood' },
  { id: 'transport', label: 'Transport & travel', icon: '🚄', words: 'car, automobile, train, bus, bicycle, taxi, airplane, aeroplane, plane, ship, boat, subway, underground, railway, motorcycle, bullet train, vehicle, traffic, ticket, platform, crossing, traffic light, travel, trip, journey, passport, luggage, baggage, tourism, sightseeing, guide, driver, gasoline, petrol' },
  { id: 'colours', label: 'Colours & shapes', icon: '🎨', words: 'color, colour, red, blue, green, yellow, white, black, brown, purple, pink, orange, gray, grey, gold, silver, light blue, dark blue, circle, round, square, triangle, line, dot, shape, form' },
  { id: 'clothes', label: 'Clothes & things', icon: '👘', words: 'clothes, clothing, shirt, skirt, trousers, pants, dress, coat, jacket, sweater, hat, cap, shoes, socks, glasses, spectacles, necktie, belt, kimono, uniform, underwear, gloves, scarf, pocket, button, umbrella, bag, handbag, wallet, purse, watch, clock, ring, key, box, telephone, phone, television, radio, camera, computer, newspaper, magazine, letter, stamp, envelope, postcard, money, coin, cup, glass, chopsticks, spoon, knife, fork, plate, bowl, bed, table, chair, door, window, wall, stairs, refrigerator, air conditioner' },
  { id: 'school', label: 'School & work', icon: '📚', words: 'school, student, pupil, teacher, class, lesson, homework, test, exam, examination, study, textbook, dictionary, notebook, pencil, pen, ballpoint pen, eraser, blackboard, desk, chair, university, college, graduation, entrance exam, question, answer, grade, semester, lecture, research, professor, classroom, job, work, occupation, employee, company employee, office worker, salary, boss, meeting, business, business trip, overtime, interview, document, report, president, manager, staff' },
  { id: 'feelings', label: 'Feelings', icon: '💗', words: 'happy, sad, angry, glad, lonely, afraid, scary, frightening, surprised, fun, enjoyable, painful, tired, worried, worry, anxiety, uneasiness, joy, sorrow, sadness, anger, fear, love, hate, embarrassed, ashamed, jealous, nervous, calm, proud, gentle, feeling, feelings, emotion, mood, boring, interesting, pleasant, unpleasant, disappointment, regret, hope, dream, smile, laugh, cry, tears, heart, mind, spirit' },
];

const senses = (meaning: string) =>
  meaning
    .split(/[;,]/)
    .slice(0, 3)
    .map((s) => s.replace(/\(.*?\)/g, '').trim().toLowerCase().replace(/^(a|an|the) /, ''));

const VOCAB = JLPT_LEVELS.flatMap((l) => l.decks.find((d) => d.kind === 'vocab')!.entries);

export const JLPT_THEMES: JlptDeck[] = THEMES.map((t) => {
  const words = new Set(t.words.split(/,\s*/));
  return { id: `theme-${t.id}`, level: 'All', kind: 'theme' as const, label: t.label, icon: t.icon, entries: VOCAB.filter((e) => senses(e.meaning).some((s) => words.has(s))) };
});

export const JLPT_DECKS = [...JLPT_LEVELS.flatMap((l) => l.decks), ...JLPT_THEMES];
const ENTRY_BY_ID = new Map(JLPT_DECKS.flatMap((d) => d.entries.map((e) => [e.id, e] as const)));
export const jlptEntry = (id: string) => ENTRY_BY_ID.get(id);

/**
 * The review deck: the words and kanji the player keeps in their list (missed ones go in by themselves).
 * Its wrong answers come from the decks the entries are from, so there are always enough of them.
 */
export function reviewDeck(ids: string[]): JlptDeck {
  return { id: 'review', level: 'All', kind: 'review', label: 'Review', icon: '🔁', entries: ids.flatMap((id) => jlptEntry(id) ?? []) };
}

export const jlptDeck = (id: string) => JLPT_DECKS.find((d) => d.id === id);
/** The deck an entry comes from ("N3:vocab:12" → N3 Vocabulary). */
export const homeDeck = (e: JlptEntry) => JLPT_DECKS.find((d) => d.id === `${e.level.toLowerCase()}-${e.id.split(':')[1]}`)!;

/** The first few senses only: some entries list a dozen. */
export const shortMeaning = (m: string, senses = 3) => m.split(/;\s*|,\s*/).slice(0, senses).join(', ');

export type JlptAsk = 'meaning' | 'reading';

export interface JlptQuestion {
  entry: JlptEntry;
  ask: JlptAsk;
  /** Four answers, the right one among them. */
  options: string[];
  answer: string;
}

const shown = (e: JlptEntry, ask: JlptAsk) => (ask === 'meaning' ? shortMeaning(e.meaning) : e.reading);

/**
 * A question on an entry not seen lately: its meaning, or (for a word written in kanji) its reading. The
 * wrong answers come from the same deck, never from the same word (some are listed twice, one sense each)
 * and never reading or meaning the same as the answer.
 */
export function nextQuestion(deck: JlptDeck, recent: Set<string>): JlptQuestion {
  const fresh = deck.entries.filter((e) => !recent.has(e.id));
  const pool = fresh.length ? fresh : deck.entries;
  const entry = pool[Math.floor(Math.random() * pool.length)];
  const readable = entry.reading && entry.reading !== entry.text;
  const ask: JlptAsk = readable && Math.random() < 0.4 ? 'reading' : 'meaning';
  const answer = shown(entry, ask);
  const wrong = new Set<string>();
  // A small deck (a short review list) borrows its wrong answers from where the entry comes from.
  const others = deck.entries.length >= 12 ? deck.entries : [...deck.entries, ...homeDeck(entry).entries];
  for (const e of shuffle(others, Math.random)) {
    if (wrong.size >= 3) break;
    const s = shown(e, ask);
    if (!s || e.text === entry.text || s === answer || wrong.has(s)) continue;
    if (ask === 'meaning' && e.meaning === entry.meaning) continue;
    wrong.add(s);
  }
  return { entry, ask, answer, options: shuffle([answer, ...wrong], Math.random) };
}

/**
 * The word and the kanji of the day: every word and every kanji of the list once, in an order drawn once and
 * for all, a new one each day from EPOCH — the same for everyone. (Not a daily to play: just to learn.)
 */
const ALL_VOCAB = JLPT_LEVELS.flatMap((l) => l.decks.find((d) => d.kind === 'vocab')!.entries);
const ALL_KANJI = JLPT_LEVELS.flatMap((l) => l.decks.find((d) => d.kind === 'kanji')!.entries);
const VOCAB_ORDER = shuffle(ALL_VOCAB, mulberry32(hashString('omnidle:jlpt:word-of-the-day')));
const KANJI_ORDER = shuffle(ALL_KANJI, mulberry32(hashString('omnidle:jlpt:kanji-of-the-day')));
const at = <T>(xs: T[], n: number) => xs[((n % xs.length) + xs.length) % xs.length];

export function ofTheDay(date: string): { word: JlptEntry; kanji: JlptEntry } {
  const n = dayNumber(date);
  return { word: at(VOCAB_ORDER, n), kanji: at(KANJI_ORDER, n) };
}

/** The list's entry for a kanji (its first level), to explain the kanji a word is written with. */
const KANJI_BY_CHAR = new Map<string, JlptEntry>();
for (const e of ALL_KANJI) if (!KANJI_BY_CHAR.has(e.text)) KANJI_BY_CHAR.set(e.text, e);
export const kanjiInfo = (char: string) => KANJI_BY_CHAR.get(char);
/** The kanji of a word that the list explains, in order, each once. */
export const kanjiOfWord = (word: string) => [...new Set([...word])].flatMap((c) => KANJI_BY_CHAR.get(c) ?? []);

/** A word of the list by how it's written (its first entry), to show its reading and meaning in other games. */
const WORD_BY_TEXT = new Map<string, JlptEntry>();
for (const e of ALL_VOCAB) if (!WORD_BY_TEXT.has(e.text)) WORD_BY_TEXT.set(e.text, e);
export const jlptWord = (text: string) => WORD_BY_TEXT.get(text);
