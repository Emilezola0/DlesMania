// The Final Blow's faces: a boss's own list, widened with its franchise's best-known cards (Rare and up,
// not the mythics and omnis, whose pictures are special editions) — so the phase isn't the same few
// faces every fight. Kept apart from src/lib/boss.ts, which every page loads: the card catalogue only
// comes with the pages that fight.
import { CARDS } from '../gacha/cards';
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

export function finaleFaces(boss: Boss): BossCard[] {
  const hit = cache.get(boss.id);
  if (hit) return hit;
  const known = new Map<string, BossCard>();
  for (const c of [...boss.finale, ...boss.radar.members]) known.set(c.label, c);
  const skip = new Set(boss.finaleSkip ?? []);
  const faces = boss.finale.filter((c) => !skip.has(c.label));
  const taken = new Set([...boss.finale.map((c) => c.label), ...skip]);
  for (const c of CARDS) {
    if (c.set !== boss.id || taken.has(c.name) || c.name === boss.boss.name) continue;
    if (!['rare', 'epic', 'legendary'].includes(c.rarity) || !c.image) continue;
    // A card from the radar keeps its spellings (aliases, French name).
    faces.push(known.get(c.name) ?? { label: c.name, image: c.image, aliases: SHORT_NAMES[c.name] });
    taken.add(c.name);
  }
  cache.set(boss.id, faces);
  return faces;
}
