// Hell's fifth phase, Connections: five faces of the franchise, and their words to place, up to four under
// each (two for a face that knows fewer links of its own).
// The words are each face's name or what links it to the franchise — a Blitz list it belongs to ("Straw
// Hats"), its Name Chain category, a short Signature clue (an ultimate, an ability), a Specialist trait
// (a role, a faction, a class). Every word fits one face of the five and no other, so the board has one
// answer; now and then a face gets two links and no name, to make it harder.
import { SIMPLE, type SimpleUniverse } from '../specialist/simple';
import { ONE_PIECE } from '../specialist/data';
import type { Boss, BossCard } from '../types';
import { shuffle } from '../lib/rng';

export const CONNECTION_FACES = 5;
/** Words under each face, at most (its name and three links, or four links and no name). */
export const CONNECTION_WORDS = 4;

export interface ConnectionPair {
  card: BossCard;
  /** Its words, two to four (order doesn't matter). */
  words: string[];
}

export interface ConnectionsBoard {
  pairs: ConnectionPair[];
  /** Every word of the board, mixed. */
  bank: string[];
}

const key = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
/** "Name 5 Straw Hats" → "Straw Hats". */
const listTitle = (prompt: string) => {
  // Up to a comma: "Emperors of the Sea, past or present" → "Emperors of the Sea".
  const t = prompt.replace(/^name (the |both )?(\d+ )?(every |all (the )?)?/i, '').split(',')[0].trim();
  return t ? t[0].toUpperCase() + t.slice(1) : '';
};
/** A link short enough to be a word on a tile. */
const MAX_LINK = 32;

/** Everything known about each face, by its name's key: the links, as they'd be shown. */
function linksFor(boss: Boss): Map<string, Set<string>> {
  const links = new Map<string, Set<string>>();
  const add = (name: string, link: string, aliases: string[] = []) => {
    const l = link.trim();
    if (!l || l.length > MAX_LINK || key(l).includes(key(name)) || key(name).includes(key(l))) return;
    // Under every spelling, so a face finds its links whatever it's called on its card.
    for (const n of [name, ...aliases]) {
      const k = key(n);
      if (k) links.set(k, (links.get(k) ?? new Set()).add(l));
    }
  };
  // A Blitz list (not the whole roster: "Name 5 champions" says nothing).
  for (const p of boss.blitz) {
    const title = listTitle(p.prompt);
    if (p.answers.length >= 2 && p.answers.length <= 40) for (const a of p.answers) add(a.name, title, a.aliases);
  }
  // The Name Chain's categories.
  for (const c of boss.secret?.categories ?? []) if (c.entities.length <= 40) for (const e of c.entities) add(e.name, c.label);
  // The Signature's short clues: an ultimate, an ability, a title.
  for (const c of boss.signature?.clues ?? []) if (c.text && c.text.length <= MAX_LINK) add(c.answer.name, c.text);
  // The Specialist's traits, where there's a universe for this franchise (words, not numbers).
  const u = SIMPLE[boss.id as SimpleUniverse['id']];
  for (const ch of u?.characters ?? []) for (const v of Object.values(ch.traits)) if (v && !/^(unknown|none|\?)$/i.test(v) && !/^\d+$/.test(v)) for (const part of v.split(' / ')) add(ch.name, part);
  // One Piece: the Specialist's crews, Devil Fruits and home seas.
  if (boss.id === 'onepiece')
    for (const c of ONE_PIECE.characters) {
      if (c.affiliation && !/^(none|unknown)$/i.test(c.affiliation)) add(c.name, c.affiliation, c.aliases);
      for (const f of c.fruit) add(c.name, f, c.aliases);
      if (c.origin && !/^unknown$/i.test(c.origin)) add(c.name, c.origin, c.aliases);
    }
  return links;
}

/**
 * A board of five faces (with a picture) and their ten words, or null when the franchise doesn't know
 * enough links for five. Tries a few draws to find five faces whose words never overlap.
 */
export function drawConnections(boss: Boss, rand: () => number = Math.random): ConnectionsBoard | null {
  const links = linksFor(boss);
  const seen = new Set<string>();
  // A face's links: under its name, or any other spelling of it; a kanji's, its reading (JLPT).
  const linkSet = (c: BossCard) => {
    const out = new Set<string>();
    for (const n of [c.label, ...(c.aliases ?? [])]) for (const l of links.get(key(n)) ?? []) out.add(l);
    if (c.reading) out.add(c.reading.split('・')[0].replace(/[.\-]/g, ''));
    return out;
  };
  const faces = [...boss.radar.members, ...(boss.cardMembers ?? []), ...boss.finale].filter((c) => c.image && !seen.has(key(c.label)) && seen.add(key(c.label)) && linkSet(c).size > 0);
  if (faces.length < CONNECTION_FACES) return null;
  // As many words under each face as the franchise allows: four under every face if it can, then three,
  // then each face as many as it has (two to four), then two (the last tries are the two-word board, so a
  // franchise that had one keeps it).
  for (let attempt = 0; attempt < 160; attempt++) {
    const [per, least] = attempt < 30 ? [CONNECTION_WORDS, CONNECTION_WORDS] : attempt < 60 ? [3, 3] : attempt < 100 ? [CONNECTION_WORDS, 2] : [2, 2];
    const picked: ConnectionPair[] = [];
    // Every link and name already on the board, by key.
    const taken = new Set<string>();
    for (const c of shuffle(faces, rand)) {
      if (picked.length === CONNECTION_FACES) break;
      const mine = [...linkSet(c)];
      // None of the board's words may fit this face too, and its name may not be a link of theirs.
      if (mine.some((l) => taken.has(key(l))) || picked.some((p) => [...linkSet(p.card)].some((l) => key(l) === key(c.label)))) continue;
      // Its links that no face on the board shares.
      const own = mine.filter((l) => !picked.some((p) => [...linkSet(p.card)].some((x) => key(x) === key(l))));
      if (!own.length) continue;
      const choice = shuffle(own, rand);
      // A kanji (JLPT): its meaning and its reading first, to learn them together, then its other links.
      const reading = c.reading?.split('・')[0].replace(/[.\-]/g, '');
      // Now and then only links and no name (Hell): only when it has enough of its own.
      const words = reading
        ? [c.label, reading, ...choice.filter((l) => key(l) !== key(reading))].slice(0, per)
        : choice.length >= per && rand() < 0.35
          ? choice.slice(0, per)
          : [c.label, ...choice].slice(0, per);
      if (words.length < least) continue;
      picked.push({ card: c, words });
      for (const w of words) taken.add(key(w));
      taken.add(key(c.label));
    }
    if (picked.length === CONNECTION_FACES) {
      // A link of a face already on the board mustn't be a word placed elsewhere either.
      return { pairs: picked, bank: shuffle(picked.flatMap((p) => p.words), rand) };
    }
  }
  return null;
}

/** Whether a face's slots hold its words (in any order). */
export const pairRight = (p: ConnectionPair, slots: (string | null)[]) => slots.length === p.words.length && slots.every((w) => w && p.words.includes(w)) && new Set(slots).size === slots.length;
