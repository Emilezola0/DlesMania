// The cards: every franchise of Boss Battle makes a set — three legendaries (its guardian and its
// two best-known faces), the rest of its best-known faces (the Radar cards, best-known first: epic,
// then rare, then common), its deep cuts (the Final Blow cards: rare, then common), and above them
// all one mythic: a special edition of the franchise's star, with its own title and voice line.
// Only cards with a picture, each name once (the mythic aside).
import { WHO_UNIVERSES } from '../arcade/whoAmI';
import { connectionThemes } from '../data';
import { BOSSES } from '../data/bosses';
import { hashString } from '../lib/rng';
import { SILHOUETTES } from '../data/silhouettes';
import { ONE_PIECE } from '../specialist/data';
import { GENSHIN } from '../specialist/genshin';
import { MARVEL } from '../specialist/marvel';
import { WOW } from '../specialist/wow';
import FROZEN_RARITIES from '../data/card-rarities.json';
import MORE_ROSTERS from '../data/card-rosters.json';
import type { Domain } from '../types';

export type Rarity = 'common' | 'rare' | 'epic' | 'legendary' | 'mythic' | 'omni';
export const RARITIES: Rarity[] = ['common', 'rare', 'epic', 'legendary', 'mythic', 'omni'];

export const RARITY_INFO: Record<Rarity, { name: string; gem: string; rank: number }> = {
  common: { name: 'Common', gem: '◆', rank: 0 },
  rare: { name: 'Rare', gem: '◆◆', rank: 1 },
  epic: { name: 'Epic', gem: '◆◆◆', rank: 2 },
  legendary: { name: 'Legendary', gem: '★', rank: 3 },
  mythic: { name: 'Mythic', gem: '✦', rank: 4 },
  omni: { name: 'Omni', gem: '✪', rank: 5 },
};

/** Each rarity's light: the glow from a torn pack, the shooting star, the bursts, an icon's ring. */
export const RARITY_LIGHT: Record<Rarity, string> = { common: '#e2e8f0', rare: '#38bdf8', epic: '#c084fc', legendary: '#fbbf24', mythic: '#f0abfc', omni: '#fff1a8' };

export interface Card {
  id: string;
  name: string;
  image: string;
  /** The set: a Boss Battle id. */
  set: string;
  franchise: string;
  domain: Domain;
  rarity: Rarity;
  description: string;
  /** A mythic's title ("Sun God Nika"). */
  title?: string;
  /** A mythic's voice line: their catchphrase, shown on the card and heard. */
  voice?: string;
  /** The real recording of it, when there is one; else the browser reads it. */
  audio?: string;
  /** An omni's second form: what it becomes once its franchise's guardian is beaten on Hard. */
  awaken?: { title: string; image: string; line: string };
  /** Number within its set, for the "12 / 35" corner. */
  no: number;
}

/**
 * The mythics: each franchise's star in a special edition — a title, a line of their own, and a
 * voice line: their catchphrase in their voice actor's own voice — the games' voice files (hosted
 * by the fan wikis), the anime's Japanese voices and the films' actors (clips from myinstants). (Lines written for these cards; titles and catchphrases from the franchises.)
 */
const MYTHICS: Record<string, { name: string; title: string; line: string; voice: string; audio?: string; image?: string }> = {
  lol: { name: 'Ahri', title: 'The Nine-Tailed Fox', line: 'Nine tails, nine stolen memories — and a smile that makes you forget the rest.', voice: "A clever fox is never caught.", audio: "https://static.wikia.nocookie.net/leagueoflegends/images/5/5e/Ahri_Select.ogg/revision/latest?cb=20230110210107" },
  overwatch: { name: 'Tracer', title: 'The Cavalry', line: 'Blink, blink, recall: she was here a second ago, and she will be a second from now.', voice: "Cheers, love! The cavalry's here!", audio: "https://static.wikia.nocookie.net/overwatch_gamepedia/images/c/cb/Tracer_-_Cheers%2C_love%21_The_cavalry%27s_here.ogg/revision/latest?cb=20230915013000" },
  minecraft: { name: 'Creeper', title: 'The Silent Hiss', line: 'No arms, no warning — only a hiss behind you, and a crater where your house used to be.', voice: "Sssssss…", audio: "https://minecraft.wiki/images/Creeper_fuse.ogg?2ff0e" },
  onepiece: { name: 'Monkey D. Luffy', title: 'Sun God Nika', line: 'The drums of liberation beat again: one laugh, and the whole sea becomes his playground.', voice: "Kaizoku ō ni ore wa naru!", audio: "https://www.myinstants.com/media/sounds/zzz.mp3", image: 'https://static.wikia.nocookie.net/onepiece/images/6/66/Gear_5_Infobox.png/revision/latest/scale-to-width-down/500?cb=20251221160520' },
  dbz: { name: 'Goku', title: 'Ultra Instinct', line: 'His body moves before his mind decides — calm as still water, fast as light.', voice: "HAAAAAAAAH!", audio: "https://www.myinstants.com/media/sounds/goku-ui-roar-japanese.mp3", image: 'https://static.wikia.nocookie.net/dragonball/images/b/b9/Ultra_Instinct_Goku.png/revision/latest/scale-to-width-down/500?cb=20180930060236' },
  naruto: { name: 'Naruto Uzumaki', title: 'Seventh Hokage', line: 'The kid nobody believed in, carrying the whole Leaf on his back — and still grinning.', voice: "Dattebayo!", audio: "https://www.myinstants.com/media/sounds/dattebayo.mp3" },
  starwars: { name: 'Yoda', title: 'Grand Master of the Order', line: 'Nine hundred years of patience, all of it packed into one small green frame.', voice: "Do or do not. There is no try.", audio: "https://www.myinstants.com/media/sounds/yoda-do-or-do-not-there-is-no-try.mp3" },
  harrypotter: { name: 'Harry Potter', title: 'The Boy Who Lived', line: 'A scar, a broom and a stubborn heart: the wizarding world’s most famous survivor.', voice: "Expecto Patronum!", audio: "https://www.myinstants.com/media/sounds/harry-potter-expecto-patronum.mp3" },
  lotr: { name: 'Frodo Baggins', title: 'The Ring-bearer', line: 'The smallest of walkers carried the heaviest weight, all the way to the fire.', voice: "I will take the Ring." },
  mcu: { name: 'Iron Man', title: 'The Armored Avenger', line: 'Genius, billionaire, philanthropist — and, at the very end, the one who snapped back.', voice: "I am Iron Man.", audio: "https://www.myinstants.com/media/sounds/ironman_Qaec4ow.mp3" },
  smash: { name: 'Mario', title: 'The First Challenger', line: 'A cap, a moustache and a jump that launched a thousand worlds.', voice: "Let's-a go!", audio: "https://mario.wiki.gallery/images/7/7c/SM64_Mario_Let%27s-a-go%21.wav" },
  genshin: { name: 'Diluc', title: 'The Darknight Hero', line: 'By day he runs a winery; by night, Mondstadt’s fire walks its rooftops.', voice: "Time for — retribution!", audio: "https://static.wikia.nocookie.net/gensin-impact/images/5/57/VO_Diluc_Elemental_Burst_03.ogg/revision/latest?cb=20221112195845" },
  wow: { name: 'Tyrande Whisperwind', title: 'The Night Warrior', line: 'When Elune’s light falters, her high priestess becomes the dark that hunts.', voice: "The goddess watches over us.", audio: "https://static.wikia.nocookie.net/allstars_gamepedia/images/d/d4/Tyrande_IntroBoast01.ogg/revision/latest?cb=20180709081959" },
  inazuma: { name: 'Mark Evans', title: 'Captain of Raimon', line: 'A headband, a ball and a hand that stops anything. Let’s play some soccer!', voice: "Let's play some soccer!" },
};

/**
 * The omnis, rarest of all: a franchise's legend in two forms. The first is theirs from the pack;
 * the second wakes once the franchise's guardian is beaten on Hard (Gear 4 → Gear 5, Super Saiyan →
 * Perfected Ultra Instinct). `image` left out: the character's own picture. (Lines written for
 * these cards; art from the fan wikis.)
 */
const OMNIS: Record<string, { name: string; title: string; line: string; image?: string; awaken: { title: string; image: string; line: string } }> = {
  onepiece: {
    name: 'Monkey D. Luffy',
    title: 'Gear Fourth: Boundman',
    line: 'Rubber muscle swollen with Haki, bouncing like a war drum — and this is not even his final form.',
    image: 'https://static.wikia.nocookie.net/onepiece/images/b/b5/Luffy_Gear_Fourth_Pirate_Warriors_4.png/revision/latest/scale-to-width-down/500?cb=20191216211624',
    awaken: {
      title: 'Gear Fifth: Joy Boy',
      line: 'The drums of liberation, at last: he laughs, and the whole world bends like rubber with him.',
      image: 'https://static.wikia.nocookie.net/onepiece/images/8/8d/Luffy_Activates_Gear_5.png/revision/latest/scale-to-width-down/500?cb=20231011132639',
    },
  },
  dbz: {
    name: 'Goku',
    title: 'The Legendary Super Saiyan',
    line: 'Golden hair, green eyes, a fury born on Namek — the legend everyone said was a myth.',
    image: 'https://static.wikia.nocookie.net/dragonball/images/c/c1/Super_Saiyan_Goku.png/revision/latest/scale-to-width-down/500?cb=20251228192049',
    awaken: {
      title: 'Perfected Ultra Instinct',
      line: 'Silver light, a silent mind: the technique even the gods struggle to master, finally his.',
      image: 'https://static.wikia.nocookie.net/dragonball/images/5/55/Perfected_Ultra_Instinct_Goku_cloaked_in_aura.jpg/revision/latest/scale-to-width-down/500?cb=20210510004359',
    },
  },
  naruto: {
    name: 'Naruto Uzumaki',
    title: 'Nine-Tails Chakra Mode',
    line: 'The fox inside is a partner now: golden flames, a cloak of chakra, and a grin to match.',
    image: 'https://static.wikia.nocookie.net/naruto/images/2/21/Naruto%27s_Kurama_Mode.png/revision/latest/scale-to-width-down/500?cb=20160206204708',
    awaken: {
      title: 'Baryon Mode',
      line: 'Two lives burning as one, for a single impossible fight. Strongest — and saddest.',
      image: 'https://static.wikia.nocookie.net/naruto/images/1/17/Naruto%27s_Baryon_Mode.png/revision/latest/scale-to-width-down/500?cb=20210926184438',
    },
  },
  lotr: {
    name: 'Gandalf',
    title: 'The Grey Pilgrim',
    line: 'A wanderer in a battered hat, with fireworks in his pockets and the fate of the world on his mind.',
    awaken: {
      title: 'Gandalf the White',
      line: 'He fell with the shadow and came back as light: at the turn of the tide.',
      image: 'https://static.wikia.nocookie.net/lotr/images/4/4f/Gandalf_the_White_returns.png/revision/latest/scale-to-width-down/500?cb=20121003055423',
    },
  },
  mcu: {
    name: 'Iron Man',
    title: 'Mark III',
    line: 'Hot-rod red and gold, built in a cave from a box of scraps — the suit that started it all.',
    image: 'https://static.wikia.nocookie.net/marvelcinematicuniverse/images/4/47/Iron_Man_Armor_-_Mark_III.png/revision/latest/scale-to-width-down/500?cb=20170424185316',
    awaken: {
      title: 'Mark LXXXV: The Snap',
      line: 'Six stones, one hand, one last choice. Inevitable, he said — and Tony answered.',
      image: 'https://static.wikia.nocookie.net/marvelcinematicuniverse/images/c/cc/Iron_Man_Mark_LXXXV_Infinity_Stones.png/revision/latest/scale-to-width-down/500?cb=20190816074423',
    },
  },
  minecraft: {
    name: 'Creeper',
    title: 'The Green Menace',
    line: 'Every crafter has met it once — usually right behind them.',
    awaken: {
      title: 'Charged Creeper',
      line: 'Struck by lightning and crackling blue: twice the boom, and it still makes no sound until it is too late.',
      image: 'https://minecraft.wiki/images/thumb/Charged_Creeper_JE1_BE1.png/360px-Charged_Creeper_JE1_BE1.png?87117',
    },
  },
  overwatch: {
    "name": "Mercy",
    "title": "Guardian Angel",
    "line": "Wings, a staff and a promise she has never broken: no hero falls on her watch.",
    "awaken": {
      "title": "Valkyrie",
      "line": "Golden wings unfurled, she takes to the sky — and heals the whole battlefield at once.",
      "image": "https://static.wikia.nocookie.net/overwatch_gamepedia/images/b/b3/Mercy_Skin_Valkyrie.png/revision/latest/scale-to-width-down/500?cb=20160915183233"
    }
  },
  starwars: {
    "name": "Anakin Skywalker",
    "title": "The Chosen One",
    "line": "The boy from Tatooine, born to bring balance to the Force — and so very afraid to lose.",
    "image": "https://static.wikia.nocookie.net/starwars/images/6/6f/Anakin_Skywalker_RotS.png/revision/latest/scale-to-width-down/500?cb=20130621175844",
    "awaken": {
      "title": "Darth Vader",
      "line": "Anakin is gone; the mask breathes for him now. The Chosen One, fallen to the dark side.",
      "image": "https://static.wikia.nocookie.net/starwars/images/b/b1/Darth_Vader_Promo_Rogue_One.png/revision/latest/scale-to-width-down/500?cb=20260114054939"
    }
  },
  harrypotter: {
    "name": "Harry Potter",
    "title": "The Chosen One",
    "line": "Marked as an equal by the Dark Lord, before he could walk — and never once asked for it.",
    "awaken": {
      "title": "Master of the Deathly Hallows",
      "line": "Wand, stone and cloak: he walked into the forest to die, and came back out.",
      "image": "https://static.wikia.nocookie.net/harrypotter/images/c/c9/Harry-Potter-Deathly-Hallows-Promo-Picture_1-714x1024.jpg/revision/latest/scale-to-width-down/500?cb=20101028203626"
    }
  },
  smash: {
    "name": "Link",
    "title": "Hero of Time",
    "line": "Green tunic, Master Sword, an ocarina in his pocket: the hero who travels through time.",
    "image": "https://static.wikia.nocookie.net/zelda_gamepedia_en/images/2/29/OoT_Link_Artwork.png/revision/latest/scale-to-width-down/500?cb=20120304192937",
    "awaken": {
      "title": "Champion of Hyrule",
      "line": "A hundred years asleep, he wakes in a blue tunic to a ruined kingdom — and a wide open world.",
      "image": "https://static.wikia.nocookie.net/zelda_gamepedia_en/images/7/7f/BotW_Link_Artwork.png/revision/latest/scale-to-width-down/500?cb=20210621032827"
    }
  },
  genshin: {
    "name": "Zhongli",
    "title": "Consultant of the Wangsheng",
    "line": "A gentleman of Liyue who forgets his wallet, and somehow knows the price of everything.",
    "awaken": {
      "title": "Rex Lapis",
      "line": "The God of Contracts, Lord of Geo: six thousand years of Liyue carved in stone.",
      "image": "https://static.wikia.nocookie.net/gensin-impact/images/9/93/NPC_Rex_Lapis.png/revision/latest/scale-to-width-down/500?cb=20230704195903"
    }
  },
  wow: {
    "name": "Arthas Menethil",
    "title": "Prince of Lordaeron",
    "line": "Golden hair, a paladin’s hammer and the whole kingdom’s hopes — for now.",
    "image": "https://warcraft.wiki.gg/images/thumb/Arthas_HS.jpg/500px-Arthas_HS.jpg?35627d",
    "awaken": {
      "title": "The Lich King",
      "line": "He took up Frostmourne to save his people, and lost his soul to it. All of Northrend bows.",
      "image": "https://warcraft.wiki.gg/images/thumb/Lich_King_Arthas_art.jpg/500px-Lich_King_Arthas_art.jpg?7da394"
    }
  },
  inazuma: {
    "name": "Mark Evans",
    "title": "Raimon's Goalkeeper",
    "line": "An orange headband, an old notebook of his grandfather’s, and a hand nothing gets past.",
    "awaken": {
      "title": "Coach of Raimon",
      "line": "Ten years on, the boy who saved soccer comes home to teach it — same headband, same fire.",
      "image": "https://static.wikia.nocookie.net/inazuma-eleven/images/7/76/Endou_Mamoru_%28GO%29.png/revision/latest/scale-to-width-down/500?cb=20171215142343"
    }
  },
  lol: {
    name: 'Ahri',
    title: 'Fox of the Ionian Wilds',
    line: 'She took memories to live; now she makes her own, one charm at a time.',
    awaken: {
      title: 'Spirit Blossom Ahri',
      line: 'Under the blossoms of the spirit realm, the fox remembers who she loved — and who she was.',
      image: 'https://static.wikia.nocookie.net/leagueoflegends/images/1/19/Ahri_SpiritBlossomSkin.jpg/revision/latest/scale-to-width-down/500?cb=20240906175707',
    },
  },
};

/**
 * Every card's rarity, set once and for all (src/data/card-rarities.json, filled by
 * `npm run cards:freeze`): a card never changes rarity — what a player pulled as a rare stays a
 * rare. New cards take the rarity the rules below give them, then get frozen too.
 */
const FROZEN = FROZEN_RARITIES as Record<string, Rarity>;

/**
 * More faces from the Specialist rosters, their rarity from the data itself: a 5★ Genshin character
 * is epic and a 4★ rare; a One Piece bounty over a billion is epic, over a hundred million rare; an
 * MCU character in six films or more is epic, in three rare; the best-known Warcraft heroes epic,
 * the next ones rare. (Each name once: a face already in the set keeps its card.)
 */
const ROSTERS: Record<string, { name: string; image?: string; rarity: Rarity }[]> = {
  genshin: GENSHIN.characters.map((c) => ({ name: c.name, image: c.portrait ?? c.image, rarity: c.rarity >= 5 ? 'epic' : 'rare' })),
  onepiece: ONE_PIECE.characters.map((c) => ({ name: c.name, image: c.image, rarity: c.bounty >= 1e9 ? 'epic' : c.bounty >= 1e8 ? 'rare' : 'common' })),
  mcu: MARVEL.characters.map((c) => ({ name: c.name, image: c.image, rarity: c.films >= 6 ? 'epic' : c.films >= 3 ? 'rare' : 'common' })),
  wow: WOW.characters.map((c, i) => ({ name: c.name, image: c.render ?? c.image, rarity: i < 15 ? 'epic' : i < 45 ? 'rare' : 'common' })),
};

/**
 * Bigger rosters still (src/data/card-rosters.json, from the fan wikis): Naruto, Dragon Ball and
 * Inazuma Eleven's casts, and every Overwatch hero. Their rarity is set in the file: the best-known
 * faces epic, the next ones rare.
 */
const MORE = MORE_ROSTERS as Record<string, { name: string; image: string; rarity: Rarity }[]>;

const slug = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

/** The most telling Who Am I? clues of a character, when it has some (the last one only spells the name). */
// Keyed by set and name: two franchises can share a name (One Piece's Nami, League's Nami).
const WHO_SET: Record<string, string> = { marvel: 'mcu' };
const CLUES = new Map(WHO_UNIVERSES.flatMap((u) => u.targets.map((t) => [`${WHO_SET[u.id] ?? u.id}:${t.name}`, t.clues.slice(-3, -1).join(' · ')] as const)));

/** When nothing more telling is known: a line by rarity, with the card's own name. */
const LINES: Record<'legendary' | 'epic' | 'rare' | 'common' | 'deep', string[]> = {
  legendary: ['One of the pillars of {f}: the story bends around them.', 'Where {f} goes, they lead.', 'A name every fan of {f} says with respect.'],
  epic: ['An icon of {f} — everyone knows this face.', 'The face of {f} for a generation of fans.', 'A legend of {f} in their own right.'],
  rare: ['{n}, a familiar face from {f}.', '{n}, a fan favourite of {f}.', 'Hard to picture {f} without {n}.'],
  common: ['{n}, part of the {f} roster.', '{n}, one of the many faces of {f}.', 'You have met {n} somewhere in {f}.'],
  deep: ['{n}: a deep cut from {f} — only true fans name this one.', 'Blink and you miss {n} in {f}.', '{n}, a {f} detail for the connoisseurs.'],
};
const line = (kind: keyof typeof LINES, name: string, franchise: string) => {
  const xs = LINES[kind];
  return xs[hashString(name) % xs.length].replace('{f}', franchise).replace('{n}', name);
};

/** "Name 5 Akatsuki members" → "Akatsuki members". */
const listTitle = (prompt: string) => {
  const t = prompt.replace(/^name (the )?(\d+ )?(every |all (the )?)?/i, '').trim();
  return t[0].toUpperCase() + t.slice(1);
};
const IRREGULAR: Record<string, string> = { elves: 'elf', heroes: 'hero', wolves: 'wolf', dwarves: 'dwarf', men: 'man', women: 'woman', children: 'child' };
function singular(word: string): string {
  const lower = word.toLowerCase();
  const keep = (s: string) => (word[0] === word[0].toUpperCase() ? s[0].toUpperCase() + s.slice(1) : s);
  if (IRREGULAR[lower]) return keep(IRREGULAR[lower]);
  if (/ies$/.test(lower)) return word.slice(0, -3) + 'y';
  // Swordsmen, horsemen: one man.
  if (/men$/.test(lower) && lower.length > 4) return word.slice(0, -3) + 'man';
  if (/(ss|us|is)$/.test(lower) || lower.length <= 3) return word;
  if (/(ches|shes|xes|sses)$/.test(lower)) return word.slice(0, -2);
  return lower.endsWith('s') ? word.slice(0, -1) : word;
}

/**
 * A group's name, said of one of its members: "Members of the Fellowship" → "Member of the
 * Fellowship", "Damage heroes" → "Damage hero", "Talon agents, past or present" → "Talon agent,
 * past or present". Names that aren't plurals stay as they are ("Hokage", "Uchiha clan").
 */
function oneOf(label: string): string {
  const [head, ...rest] = label.split(',');
  const words = head.trim().split(/\s+/);
  const at = words.findIndex((w) => w === 'of' || w === 'by' || w === 'from');
  // "Students of Master Roshi": the word before "of"; "Original trilogy heroes": the last word.
  const i = at > 0 ? at - 1 : words.length - 1;
  words[i] = singular(words[i]);
  return [words.join(' '), ...rest].join(',');
}

/** Groups too broad to say anything about the one card ("Character", 42 names). */
const TOO_BROAD = 20;
const keyWord = (label: string) => label.split(/\s+/).sort((a, b) => b.length - a.length)[0].toLowerCase();

/**
 * What a card is, from every group it belongs to across the data — Boss Battle lists and
 * categories, Connections groups — the smallest (most telling) first: "Members of the Akatsuki ·
 * Uchiha clan". Two groups at most, and not two saying the same thing. (`oneOf` then says it of one.)
 */
const FACTS: Map<string, Map<string, string[]>> = (() => {
  const bySet = new Map<string, Map<string, { label: string; size: number }[]>>();
  const note = (set: string, name: string, label: string, size: number) => {
    if (size > TOO_BROAD || size < 2) return;
    const m = bySet.get(set) ?? new Map<string, { label: string; size: number }[]>();
    bySet.set(set, m);
    m.set(name, [...(m.get(name) ?? []), { label, size }]);
  };
  const THEME_SET: Record<string, string> = { dragonball: 'dbz' };
  for (const b of BOSSES) {
    for (const p of b.blitz) for (const a of p.answers) note(b.id, a.name, listTitle(p.prompt), p.answers.length);
    for (const c of b.secret?.categories ?? []) for (const e of c.entities) note(b.id, e.name, c.label, c.entities.length);
  }
  for (const t of connectionThemes) for (const c of t.categories) for (const item of c.items) note(THEME_SET[t.id] ?? t.id, item, c.label, c.items.length);
  const out = new Map<string, Map<string, string[]>>();
  for (const [set, names] of bySet) {
    const m = new Map<string, string[]>();
    for (const [name, facts] of names) {
      const keys = new Set<string>();
      const picked = [...facts]
        .sort((a, b) => a.size - b.size)
        .filter((f) => !keys.has(keyWord(f.label)) && keys.add(keyWord(f.label)))
        .slice(0, 2)
        .map((f) => f.label);
      m.set(name, picked);
    }
    out.set(set, m);
  }
  return out;
})();

/**
 * A card's line, fuller the rarer the card: a common says one thing about it ("Damage hero."), a
 * rare up to two; an epic gets its Who Am I? clues (or its groups) and a word of its own; the
 * legendary hero the same with a line of standing; guardians and mythics are written apart (the
 * guardian's taunt, the mythic's own line).
 */
function describe(set: string, name: string, kind: keyof typeof LINES, franchise: string): string {
  const facts = (FACTS.get(set)?.get(name) ?? []).map(oneOf);
  if (kind === 'common' || kind === 'deep') return facts.length ? `${facts[0]}.` : `Seen in ${franchise}.`;
  if (kind === 'rare') return facts.length ? `${facts.join(' · ')}.` : `A familiar face of ${franchise}.`;
  const what = CLUES.get(`${set}:${name}`) || (facts.length ? facts.join(' · ') : '');
  const say = line(kind === 'legendary' ? 'legendary' : 'epic', name, franchise);
  return what ? `${what.replace(/\.$/, '')}. ${say}` : say;
}

/** The first sentence of a guardian's opening taunt. */
/** The opening of a guardian's taunt: whole sentences, enough of them to say something ("Wororororo!" alone doesn't). */
function firstLine(s: string): string {
  const sentences = s.match(/[^.!?…]+[.!?…]+(\s|$)/g) ?? [s];
  let out = '';
  for (const x of sentences) {
    out += x;
    if (out.trim().length >= 30) break;
  }
  return out.trim();
}

export const CARDS: Card[] = (() => {
  // Each name once across all sets: the first set to build it keeps it. The order below is the
  // order cards were added over time — a later addition can never take a name an earlier card has,
  // so released cards keep their ids.
  const seen = new Set<string>();
  const sets = new Map<string, Omit<Card, 'no'>[]>();
  for (const b of BOSSES) {
    const set: Omit<Card, 'no'>[] = [];
    sets.set(b.id, set);
    const add = (name: string, image: string | undefined, rarity: Rarity, description: string) => {
      if (!image || seen.has(name)) return;
      seen.add(name);
      set.push({ id: `${b.id}:${slug(name)}`, name, image, set: b.id, franchise: b.franchise, domain: b.domain, rarity, description });
    };
    const intro = (b.lines as { intro?: string } | undefined)?.intro;
    add(b.boss.name, b.boss.image, 'legendary', `${b.boss.title}, guardian of ${b.franchise}.${intro ? ` “${firstLine(intro)}”` : ''}`);
    b.radar.members.forEach((m, i) => {
      // The two best-known faces stand with the guardian as legendaries; the next four are epic.
      const rarity: Rarity = i < 2 ? 'legendary' : i < 6 ? 'epic' : i < 11 ? 'rare' : 'common';
      add(m.label, m.image, rarity, describe(b.id, m.label, rarity, b.franchise));
    });
    // The deep cuts: the first an epic find, the next three rare.
    b.finale.forEach((c, i) => {
      const rarity: Rarity = i < 1 ? 'epic' : i < 4 ? 'rare' : 'common';
      add(c.label, c.image, rarity, describe(b.id, c.label, rarity === 'epic' ? 'epic' : 'deep', b.franchise));
    });
    // The mythic: the star's special edition, numbered after the rest of the set.
    const m = MYTHICS[b.id];
    const star = m && b.radar.members.find((x) => x.label === m.name);
    if (m && star?.image) set.push({ id: `${b.id}:mythic`, name: m.name, image: m.image ?? star.image, set: b.id, franchise: b.franchise, domain: b.domain, rarity: 'mythic', title: m.title, voice: m.voice, audio: m.audio, description: m.line });
    // The omni: the legend in its first form, its second waiting for a Hard win.
    const o = OMNIS[b.id];
    const legend = o && b.radar.members.find((x) => x.label === o.name);
    const oImage = o?.image ?? legend?.image;
    if (o && oImage) set.push({ id: `${b.id}:omni`, name: o.name, image: oImage, set: b.id, franchise: b.franchise, domain: b.domain, rarity: 'omni', title: o.title, description: o.line, awaken: o.awaken });
    // More faces from the same franchise (Who's That's rosters): commons, with a rare now and then.
    for (const e of SILHOUETTES.find((x) => x.id === b.id && !x.cutout)?.entries ?? []) {
      const rarity: Rarity = hashString(e.name) % 7 === 0 ? 'rare' : 'common';
      add(e.name, e.image, rarity, describe(b.id, e.name, rarity === 'rare' ? 'rare' : 'common', b.franchise));
    }
  }
  // Added later: the Specialist rosters, after every set's earlier cards.
  for (const b of BOSSES) {
    const set = sets.get(b.id)!;
    for (const r of ROSTERS[b.id] ?? []) {
      if (!r.image || seen.has(r.name)) continue;
      seen.add(r.name);
      set.push({ id: `${b.id}:${slug(r.name)}`, name: r.name, image: r.image, set: b.id, franchise: b.franchise, domain: b.domain, rarity: r.rarity, description: describe(b.id, r.name, r.rarity === 'epic' ? 'epic' : r.rarity === 'rare' ? 'rare' : 'common', b.franchise) });
    }
  }
  // Added last: the bigger rosters. A name only has to be new to its own set here (Overwatch's Ashe
  // isn't League's), so nothing added before can lose its card.
  for (const b of BOSSES) {
    const set = sets.get(b.id)!;
    const names = new Set(set.map((c) => c.name));
    const ids = new Set(set.map((c) => c.id));
    for (const r of MORE[b.id] ?? []) {
      const id = `${b.id}:${slug(r.name)}`;
      if (names.has(r.name) || ids.has(id)) continue;
      names.add(r.name);
      ids.add(id);
      set.push({ id, name: r.name, image: r.image, set: b.id, franchise: b.franchise, domain: b.domain, rarity: r.rarity, description: describe(b.id, r.name, r.rarity === 'epic' ? 'epic' : r.rarity === 'rare' ? 'rare' : 'common', b.franchise) });
    }
  }
  return BOSSES.flatMap((b) => sets.get(b.id)!.map((c, i) => ({ ...c, rarity: FROZEN[c.id] ?? c.rarity, no: i + 1 })));
})();

export const CARD_BY_ID = new Map(CARDS.map((c) => [c.id, c]));

/** The sets, in Boss Battle order: id, franchise, kind of work, size. */
export const SETS = BOSSES.map((b) => ({ id: b.id, franchise: b.franchise, domain: b.domain, size: CARDS.filter((c) => c.set === b.id).length, guardian: b.boss }));
export const setSize = (id: string) => SETS.find((s) => s.id === id)?.size ?? 0;
