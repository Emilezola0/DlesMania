// The Raid Boss (Friends → Raid Boss): each week a franchise's boss, whose health you and your friends wear down
// together, one attack a day each (src/cloud/raids.ts). An attack is a quick round: a card's picture, its name to
// find among four, against the clock; the quicker, the harder it hits, and each card of that franchise you own adds a
// little more. Numbers in src/data/tuning/friends.json.
import T from '../data/tuning/friends.json';
import { COLLECTIBLE, RARITIES, SETS, type Card } from '../gacha/cards';
import { addDays } from '../lib/date';
import { hashString, mulberry32 } from '../lib/rng';
import { CHOICE } from './choiceQuestions';

export const RAID = T.raid;

/** A franchise's faces to ask about: someone (not a place or a technique), with a picture, one card a name. */
function facesOf(set: string): Card[] {
  const seen = new Set<string>();
  return COLLECTIBLE.filter((c) => {
    if (c.set !== set || c.place || c.technique || !c.image || seen.has(c.name)) return false;
    seen.add(c.name);
    return true;
  });
}

/**
 * The franchises a week's boss can come from: those the Daily Choice uses (not the Japanese words or the tools), that had
 * shipped by that Monday (so a set added mid-week doesn't change the week's boss), with enough faces for a round.
 */
function franchisesFor(monday: string): string[] {
  return SETS.map((s) => s.id)
    .filter((id) => !CHOICE.skipSets.includes(id) && (CHOICE.launchSets.includes(id) || (CHOICE.since[id] !== undefined && CHOICE.since[id] <= monday)))
    .filter((id) => facesOf(id).length >= 12)
    .sort();
}

function rawPick(monday: string): string {
  const list = franchisesFor(monday);
  return list[Math.floor(mulberry32(hashString(`raid:${monday}`))() * list.length)];
}

export interface RaidBoss {
  set: string;
  franchise: string;
  /** Its face: the franchise's rarest card (an Omni if it has one). */
  card: Card;
}

/** The week's boss: the same for everyone, never the same franchise two weeks running. */
export function bossOf(monday: string): RaidBoss {
  let set = rawPick(monday);
  if (set === rawPick(addDays(monday, -7))) {
    const list = franchisesFor(monday);
    set = list[(list.indexOf(set) + 1) % list.length];
  }
  const faces = COLLECTIBLE.filter((c) => c.set === set && !c.place && !c.technique && c.image);
  const rank = (c: Card) => RARITIES.indexOf(c.rarity);
  const best = Math.max(...faces.map(rank));
  const top = faces.filter((c) => rank(c) === best).sort((a, b) => a.id.localeCompare(b.id));
  const card = top[Math.floor(mulberry32(hashString(`raid-face:${monday}`))() * top.length)];
  return { set, franchise: SETS.find((s) => s.id === set)?.franchise ?? set, card };
}

/** The boss's health: more for each player in the raid (you and your friends), up to RAID.maxPlayers. */
export const healthFor = (players: number) => RAID.hpPerPlayer * Math.min(RAID.maxPlayers, Math.max(1, players));

export interface RaidQuestion {
  card: Card;
  /** Four names, the right one among them. */
  options: string[];
}

/** An attack's questions: different faces of the franchise, each with three other names of it. */
export function questionsFor(set: string, n = RAID.questions): RaidQuestion[] {
  const faces = [...facesOf(set)].sort(() => Math.random() - 0.5);
  return faces.slice(0, n).map((card) => {
    const others = faces.filter((c) => c.name !== card.name).sort(() => Math.random() - 0.5).slice(0, 3).map((c) => c.name);
    return { card, options: [card.name, ...others].sort(() => Math.random() - 0.5) };
  });
}

/** The bonus owning the franchise's cards gives (+1% a card, up to +25%). */
export function ownedBonus(cards: Record<string, number>, set: string): number {
  let n = 0;
  for (const c of COLLECTIBLE) if (c.set === set && (cards[c.id] ?? 0) > 0) n++;
  return Math.min(RAID.ownedBonusMax, n * RAID.ownedBonus);
}

/** One right answer's damage, `left` seconds still on its clock. */
export const hitFor = (left: number) => RAID.hitBase + RAID.hitSpeed * Math.max(0, Math.min(1, left / RAID.seconds));
