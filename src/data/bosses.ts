import type { BlitzPrompt, Boss, BossCard, BossFrench, Domain } from '../types';
import raw from './bosses.json';
import frenchRaw from './bosses-fr.json';
import { BLUEPRINT_NODES, nodeImage } from '../specialist/blueprint';
import { addFrench } from '../lib/french';
import { kanjiPicture } from '../lib/kanji';

/**
 * In bosses.json a card is a plain label or `{ label, src?, image?, aliases? }` (`src` only
 * matters to scripts/enrich-bosses.mjs), and a Knowledge Blitz answer is "Name|alias|alias".
 */
type RawCard = string | { label: string; image?: string; aliases?: string[]; fr?: string; reading?: string };
type RawBoss = Omit<Boss, 'blitz' | 'radar' | 'finale' | 'aliases' | 'secret' | 'signature'> & {
  aliases?: string[];
  blitz: { prompt: string; count: number; answers: string[] }[];
  radar: { members: RawCard[]; impostors: RawCard[] };
  finale: RawCard[];
  secret?: Omit<NonNullable<Boss['secret']>, 'categories'> & { categories: { label: string; entities: string[] }[] };
  signature?: { label: string; prompt: string; seconds?: number; hints?: boolean; clues: { text?: string; effect?: string; hints?: string[]; image?: string; ingredients?: string[]; audio?: { youtubeId: string; start?: number }; answer: string; reading?: string }[] };
};

/** "node:<name>": a Blueprint node, drawn from src/specialist/blueprint.ts rather than stored as a picture. */
const picture = (image?: string) => {
  // "local:art/…": a picture served with the site (public/art), for wikis that don't let others show theirs.
  if (image?.startsWith('local:')) return `${import.meta.env?.BASE_URL ?? './'}${image.slice(6)}`;
  if (!image?.startsWith('node:')) return kanjiPicture(image);
  const n = BLUEPRINT_NODES.find((x) => x.name === image.slice(5));
  return n ? nodeImage(n) : undefined;
};

const card = (c: RawCard): BossCard =>
  typeof c === 'string' ? { label: c } : { label: c.label, image: picture(c.image), aliases: c.aliases, fr: c.fr, reading: c.reading };

const spelling = (a: string) => {
  const [name, ...aliases] = a.split('|');
  return { name, aliases };
};

/** The bosses' fights in French (src/data/bosses-fr.json), by boss. */
const FRENCH = frenchRaw as Record<string, BossFrench>;

export const BOSSES: Boss[] = (raw as unknown as RawBoss[]).map((b) => {
  // Its French names are accepted answers too, and a card's French name is shown when names are in French.
  const names = FRENCH[b.id]?.names ?? {};
  const spell = (a: string) => {
    const s = spelling(a);
    const fr = names[s.name];
    if (fr && !s.aliases.includes(fr)) s.aliases.push(fr);
    return s;
  };
  const face = (c: RawCard): BossCard => {
    const x = card(c);
    const fr = names[x.label];
    return fr && !x.fr ? { ...x, fr, aliases: [...(x.aliases ?? []), fr] } : x;
  };
  return {
    ...b,
    boss: { ...b.boss, image: picture(b.boss.image) },
    aliases: b.aliases ?? [],
    blitz: b.blitz.map((p): BlitzPrompt => ({ prompt: p.prompt, count: p.count, answers: p.answers.map(spell) })),
    // Faces with no drawn art leave the Radar (`radarSkip`), but keep their cards (`cardMembers`).
    radar: { members: b.radar.members.filter((c) => !b.radarSkip?.includes(typeof c === 'string' ? c : c.label)).map(face), impostors: b.radar.impostors.map(face) },
    cardMembers: b.radarSkip?.length ? b.radar.members.map(face) : undefined,
    finale: b.finale.map(face),
    secret: b.secret && { ...b.secret, categories: b.secret.categories.map((c) => ({ label: c.label, entities: c.entities.map(spell) })) },
    signature: b.signature && { ...b.signature, clues: b.signature.clues.map((c) => ({ ...c, image: picture(c.image), answer: spell(c.answer) })) },
    fr: FRENCH[b.id],
  };
});

/**
 * A boss's fight in the player's language: in French, its title, its lines and every text it has a French one for
 * (Blitz prompts, Name Chain categories, the Signature) from src/data/bosses-fr.json. Names go through the French
 * dictionary as everywhere (its French names are handed to it below).
 */
export function bossIn(b: Boss, lang: string): Boss {
  const f = b.fr;
  if (lang !== 'fr' || !f) return b;
  const t = (s: string) => f.texts?.[s] ?? s;
  return {
    ...b,
    boss: { ...b.boss, title: f.title ?? b.boss.title },
    lines: { ...b.lines, ...f.lines },
    blitz: b.blitz.map((p) => ({ ...p, prompt: t(p.prompt) })),
    secret: b.secret && { ...b.secret, categories: b.secret.categories.map((c) => ({ ...c, label: t(c.label) })) },
    signature: b.signature && {
      ...b.signature,
      label: t(b.signature.label),
      prompt: t(b.signature.prompt),
      clues: b.signature.clues.map((c) => ({ ...c, text: c.text && t(c.text), effect: c.effect && t(c.effect), hints: c.hints?.map(t) })),
    },
  };
}


// The bosses' own French spellings (Overwatch's Mercy is Ange), each kept to its franchise, and shared with
// the whole dictionary only when no other franchise has something by that name (For Honor has a Mercy too).
{
  const sets = new Map<string, Set<string>>();
  for (const b of BOSSES) for (const c of [b.boss, ...b.radar.members, ...b.finale]) {
    const name = 'label' in c ? c.label : c.name;
    sets.set(name, (sets.get(name) ?? new Set()).add(b.id));
  }
  /** Every name each boss's lists use (Blitz, Name Chain, faces), by name: the bosses that use it. */
  const named = new Map<string, Set<string>>([...sets].map(([n, s]) => [n, new Set(s)]));
  for (const b of BOSSES) for (const n of [...b.blitz.flatMap((p) => p.answers), ...(b.secret?.categories.flatMap((c) => c.entities) ?? [])].map((x) => x.name)) named.set(n, (named.get(n) ?? new Set()).add(b.id));
  for (const b of BOSSES) {
    // A French name the same as the English one ("fr": "Robin") only keeps another franchise's off this one (Honkai's
    // Robin isn't Smash's Daraen): it stays with its own set and never goes in the shared dictionary.
    const pairs: [string, string, boolean][] = [...b.radar.members, ...b.finale].filter((c) => c.fr).map((c) => [c.label, c.fr!, c.fr !== c.label && (sets.get(c.label)?.size ?? 0) <= 1]);
    // The rest of its French names (Blitz answers, Name Chain entities): shared with the dictionary (the fight's lists
    // show names without their franchise) unless another boss names something the same.
    for (const [en, fr] of Object.entries(b.fr?.names ?? {})) if (!pairs.some(([n]) => n === en)) pairs.push([en, fr, (named.get(en)?.size ?? 0) <= 1]);
    if (pairs.length) addFrench(b.id, pairs);
  }
  // Names more than one franchise uses: each keeps to its own French name, if any.
  addFrench('', [], [...sets].filter(([, s]) => s.size > 1).map(([n]) => n));
}

/** Music has no franchises to fight. */
export const BOSS_DOMAINS: Domain[] = ['games', 'anime', 'cinema'];
/** Boss Battle's tabs: the three domains, then Language (category "language": Japanese) and Other (category "other"). */
export type BossTab = Domain | 'language' | 'other';
export const BOSS_TABS: BossTab[] = [...BOSS_DOMAINS, 'language', 'other'];
export const inTab = (b: { domain: Domain; category?: 'other' | 'language' }, tab: BossTab) => (tab === 'other' || tab === 'language' ? b.category === tab : !b.category && b.domain === tab);

export const getBoss = (id: string | undefined) => BOSSES.find((b) => b.id === id);
