// The Final Blow's faces: a boss's own list, widened with its franchise's best-known cards (Rare and up,
// not the mythics and omnis, whose pictures are special editions) — so the phase isn't the same few
// faces every fight. Kept apart from src/lib/boss.ts, which every page loads: the card catalogue only
// comes with the pages that fight.
import { CARDS } from '../gacha/cards';
import type { Boss, BossCard } from '../types';

const cache = new Map<string, BossCard[]>();

export function finaleFaces(boss: Boss): BossCard[] {
  const hit = cache.get(boss.id);
  if (hit) return hit;
  const known = new Map<string, BossCard>();
  for (const c of [...boss.finale, ...boss.radar.members]) known.set(c.label, c);
  const faces = [...boss.finale];
  const taken = new Set(faces.map((c) => c.label));
  for (const c of CARDS) {
    if (c.set !== boss.id || taken.has(c.name) || c.name === boss.boss.name) continue;
    if (!['rare', 'epic', 'legendary'].includes(c.rarity) || !c.image) continue;
    // A card from the radar keeps its spellings (aliases, French name).
    faces.push(known.get(c.name) ?? { label: c.name, image: c.image });
    taken.add(c.name);
  }
  cache.set(boss.id, faces);
  return faces;
}
