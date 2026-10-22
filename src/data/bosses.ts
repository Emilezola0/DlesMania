import type { BlitzPrompt, Boss, BossCard, Domain } from '../types';
import raw from './bosses.json';

/**
 * In bosses.json a card is a plain label or `{ label, src?, image?, aliases? }` (`src` only
 * matters to scripts/enrich-bosses.mjs), and a Knowledge Blitz answer is "Name|alias|alias".
 */
type RawCard = string | { label: string; image?: string; aliases?: string[] };
type RawBoss = Omit<Boss, 'blitz' | 'radar' | 'finale' | 'aliases' | 'secret' | 'signature'> & {
  aliases?: string[];
  blitz: { prompt: string; count: number; answers: string[] }[];
  radar: { members: RawCard[]; impostors: RawCard[] };
  finale: RawCard[];
  secret?: Omit<NonNullable<Boss['secret']>, 'categories'> & { categories: { label: string; entities: string[] }[] };
  signature?: { label: string; prompt: string; clues: { text?: string; audio?: { youtubeId: string; start?: number }; answer: string }[] };
};

const card = (c: RawCard): BossCard =>
  typeof c === 'string' ? { label: c } : { label: c.label, image: c.image, aliases: c.aliases };

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

/** Music has no franchises to fight. */
export const BOSS_DOMAINS: Domain[] = ['games', 'anime', 'cinema'];

export const getBoss = (id: string | undefined) => BOSSES.find((b) => b.id === id);
