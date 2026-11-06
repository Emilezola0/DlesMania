// The Final Blow's faces: a boss's own list, widened with its franchise's best-known cards (Rare and up,
// not the mythics and omnis, whose pictures are special editions) — so the phase isn't the same few
// faces every fight. Kept apart from src/lib/boss.ts, which every page loads: the card catalogue only
// comes with the pages that fight.
import { CARDS } from '../gacha/cards';
import { ONE_PIECE } from '../specialist/data';
import type { Boss, BossCard } from '../types';

/** What people actually call the cards named with a title or a pair: nobody types "Grand Moff" against the clock. */
const SHORT_NAMES: Record<string, string[]> = {
  'Luke Skywalker': ['Luke'],
  'Obi-Wan Kenobi': ['Obi-Wan', 'Kenobi', 'Ben Kenobi'],
  Palpatine: ['Sheev Palpatine', 'Emperor Palpatine', 'Darth Sidious', 'Sidious'],
  'Anakin Skywalker': ['Anakin'],
  'Din Djarin': ['Mando', 'The Mandalorian'],
  'Qui-Gon Jinn': ['Qui-Gon'],
  'Count Dooku': ['Dooku'],
  'Captain Rex': ['Rex'],
  'Grand Moff Tarkin': ['Tarkin', 'Moff Tarkin'],
  'Captain Phasma': ['Phasma'],
  'General Hux': ['Hux'],
  'Moff Gideon': ['Gideon'],
  'Kanan Jarrus': ['Kanan'],
  'Fíli and Kíli': ['Fíli', 'Kíli', 'Fíli Kíli', 'Kíli and Fíli'],
  'Bard the Bowman': ['Bard'],
  'Rosalina & Luma': ['Rosalina'],
  'Banjo & Kazooie': ['Banjo', 'Kazooie'],
};

const cache = new Map<string, BossCard[]>();

const nameKey = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
/**
 * Who each name is, by every spelling the Specialist knows (One Piece: "Law", "Trafalgar Law" and
 * "Trafalgar D. Water Law" are one man), so one person is never two faces, and any of their names answers.
 */
const PERSON = new Map<string, { name: string; spellings: string[] }>();
for (const c of ONE_PIECE.characters) {
  const person = { name: c.name, spellings: [c.name, ...c.aliases] };
  for (const n of person.spellings) if (!PERSON.has(nameKey(n))) PERSON.set(nameKey(n), person);
}
const personOf = (name: string) => PERSON.get(nameKey(name));

export function finaleFaces(boss: Boss): BossCard[] {
  const hit = cache.get(boss.id);
  if (hit) return hit;
  const known = new Map<string, BossCard>();
  for (const c of [...boss.finale, ...boss.radar.members]) known.set(c.label, c);
  const skip = new Set(boss.finaleSkip ?? []);
  // A face answers to every name of its person (its own spellings, and the Specialist's).
  const withNames = (c: BossCard): BossCard => {
    const p = personOf(c.label);
    return p ? { ...c, aliases: [...new Set([...(c.aliases ?? []), ...p.spellings.filter((n) => n !== c.label)])] } : c;
  };
  const whole = new Set(boss.wholeFaces ?? []);
  const faces = boss.finale.filter((c) => !skip.has(c.label)).map(withNames);
  const taken = new Set([...boss.finale.map((c) => c.label), ...skip]);
  // The people already on the list (by the Specialist's names), so another spelling of one isn't added twice.
  const people = new Set([...boss.finale, ...boss.radar.members].flatMap((c) => [c.label, ...(c.aliases ?? [])]).map((n) => personOf(n)?.name ?? nameKey(n)));
  for (const c of CARDS) {
    if (c.set !== boss.id || c.place || c.technique || taken.has(c.name) || c.name === boss.boss.name) continue;
    const who = personOf(c.name)?.name ?? nameKey(c.name);
    if (people.has(who)) continue;
    // Bosses drawn in 2D only: a card's picture may be a 3D model (kept for the cards), so only faces the boss
    // has art for — its own, or a drawn picture of the card's face (faceArt).
    const drawn = boss.faceArt?.[c.name];
    if (boss.drawnOnly && !known.has(c.name) && !drawn) continue;
    if (!['rare', 'epic', 'legendary'].includes(c.rarity) || !c.image) continue;
    // A boss may take only its better-known cards (Inazuma Eleven: its rares are mostly faces few remember).
    if (boss.finaleCardsFrom === 'epic' && c.rarity === 'rare') continue;
    // A card from the radar keeps its spellings (aliases, French name).
    faces.push(withNames(known.get(c.name) ?? { label: c.name, image: drawn ?? c.image, aliases: SHORT_NAMES[c.name] }));
    taken.add(c.name);
    people.add(who);
  }
  const out = whole.size ? faces.map((c) => (whole.has(c.label) ? { ...c, whole: true } : c)) : faces;
  cache.set(boss.id, out);
  return out;
}
