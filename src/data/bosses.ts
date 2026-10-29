import type { BlitzPrompt, Boss, BossCard, Domain } from '../types';
import raw from './bosses.json';
import { BLUEPRINT_NODES, nodeImage } from '../specialist/blueprint';
import { addFrench } from '../lib/french';

/**
 * In bosses.json a card is a plain label or `{ label, src?, image?, aliases? }` (`src` only
 * matters to scripts/enrich-bosses.mjs), and a Knowledge Blitz answer is "Name|alias|alias".
 */
type RawCard = string | { label: string; image?: string; aliases?: string[]; fr?: string };
type RawBoss = Omit<Boss, 'blitz' | 'radar' | 'finale' | 'aliases' | 'secret' | 'signature'> & {
  aliases?: string[];
  blitz: { prompt: string; count: number; answers: string[] }[];
  radar: { members: RawCard[]; impostors: RawCard[] };
  finale: RawCard[];
  secret?: Omit<NonNullable<Boss['secret']>, 'categories'> & { categories: { label: string; entities: string[] }[] };
  signature?: { label: string; prompt: string; clues: { text?: string; effect?: string; audio?: { youtubeId: string; start?: number }; answer: string }[] };
};

/** "node:<name>": a Blueprint node, drawn from src/specialist/blueprint.ts rather than stored as a picture. */
const picture = (image?: string) => {
  if (!image?.startsWith('node:')) return image;
  const n = BLUEPRINT_NODES.find((x) => x.name === image.slice(5));
  return n ? nodeImage(n) : undefined;
};

const card = (c: RawCard): BossCard =>
  typeof c === 'string' ? { label: c } : { label: c.label, image: picture(c.image), aliases: c.aliases, fr: c.fr };

const spelling = (a: string) => {
  const [name, ...aliases] = a.split('|');
  return { name, aliases };
};

const prompt = (p: RawBoss['blitz'][number]): BlitzPrompt => ({ prompt: p.prompt, count: p.count, answers: p.answers.map(spelling) });

export const BOSSES: Boss[] = (raw as unknown as RawBoss[]).map((b) => ({
  ...b,
  aliases: b.aliases ?? [],
  blitz: b.blitz.map(prompt),
  radar: { members: b.radar.members.map(card), impostors: b.radar.impostors.map(card) },
  finale: b.finale.map(card),
  secret: b.secret && { ...b.secret, categories: b.secret.categories.map((c) => ({ label: c.label, entities: c.entities.map(spelling) })) },
  signature: b.signature && { ...b.signature, clues: b.signature.clues.map((c) => ({ ...c, answer: spelling(c.answer) })) },
}));

// The bosses' own French spellings (Overwatch's Mercy is Ange), each kept to its franchise, and shared with
// the whole dictionary only when no other franchise has something by that name (For Honor has a Mercy too).
{
  const sets = new Map<string, Set<string>>();
  for (const b of BOSSES) for (const c of [b.boss, ...b.radar.members, ...b.finale]) {
    const name = 'label' in c ? c.label : c.name;
    sets.set(name, (sets.get(name) ?? new Set()).add(b.id));
  }
  for (const b of BOSSES) {
    const pairs: [string, string, boolean][] = [...b.radar.members, ...b.finale].filter((c) => c.fr && c.fr !== c.label).map((c) => [c.label, c.fr!, (sets.get(c.label)?.size ?? 0) <= 1]);
    if (pairs.length) addFrench(b.id, pairs);
  }
  // Names more than one franchise uses: each keeps to its own French name, if any.
  addFrench('', [], [...sets].filter(([, s]) => s.size > 1).map(([n]) => n));
}

/** Music has no franchises to fight. */
export const BOSS_DOMAINS: Domain[] = ['games', 'anime', 'cinema'];
/** Boss Battle's tabs: the three domains, then Other (bosses marked with category "other"). */
export type BossTab = Domain | 'other';
export const BOSS_TABS: BossTab[] = [...BOSS_DOMAINS, 'other'];
export const inTab = (b: { domain: Domain; category?: 'other' }, tab: BossTab) => (tab === 'other' ? b.category === 'other' : !b.category && b.domain === tab);

export const getBoss = (id: string | undefined) => BOSSES.find((b) => b.id === id);
