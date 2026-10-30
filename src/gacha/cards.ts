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
import UNREAL_ART from '../data/unreal-art.json';
import JLPT_CARDS from '../data/jlpt-cards.json';
import CARD_ART from '../data/card-art.json';
import { kanjiPicture } from '../lib/kanji';
import type { Domain } from '../types';

/** Ufouria's pictures, served with the site (public/art/ufouria): the game's wikis don't let others show theirs. */
const UFOURIA_ART = (file: string) => `${import.meta.env?.BASE_URL ?? './'}art/ufouria/${file}`;

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
export const RARITY_LIGHT: Record<Rarity, string> = { common: '#e2e8f0', rare: '#38bdf8', epic: '#c084fc', legendary: '#fbbf24', mythic: '#f0abfc', omni: '#ff3b4e' };

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
  /** The French dub's line and recording, heard (and shown) when names are in French. */
  voiceFr?: string;
  audioFr?: string;
  /** An omni's second form: what it becomes once its franchise's guardian is beaten on Hard (its clip: see `clip`). */
  awaken?: { title: string; image: string; line: string; clip?: string; clipLight?: boolean; cutout?: boolean };
  /** A short looping clip (MP4) of a mythic, played instead of its picture where the card is seen up close. */
  clip?: string;
  /** Its picture has a transparent background: it can step out of the frame on hover. */
  cutout?: boolean;
  /** A clip so small it can run all the time, in the album too (the player can turn that off). */
  clipLight?: boolean;
  /**
   * Framing for a picture with more around it than the card wants (a group shot, a title banner, a
   * screenshot): zoomed `zoom` times on the point at `x`% / `y`% of it.
   */
  focus?: { x: number; y: number; zoom: number };
  /** Number within its set, for the "12 / 35" corner. */
  no: number;
}

/**
 * The mythics: each franchise's star in a special edition — a title, a line of their own, and a
 * voice line: their catchphrase in their voice actor's own voice — the games' voice files (hosted
 * by the fan wikis), the anime's Japanese voices and the films' actors (clips from myinstants). (Lines written for these cards; titles and catchphrases from the franchises.)
 */
const MYTHICS: Record<string, { name: string; title: string; line: string; voice: string; audio?: string; voiceFr?: string; audioFr?: string; image?: string }> = {
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
  avatar: {
    name: 'Zuko',
    title: 'Fire Lord',
    line: 'The banished prince who lost everything chasing his honour — and found it by choosing his own side.',
    voice: 'Hello, Zuko here.',
    audio: 'https://www.myinstants.com/media/sounds/hello-zuko-here.mp3',
    image: 'https://static.wikia.nocookie.net/avatar/images/0/05/Zuko_Blu-ray_art.png/revision/latest?cb=20261025210247',
  },
  destiny: {
    name: 'Cayde-6',
    title: 'Back from the Pale Heart',
    line: 'Years after his last stand, he walks again inside the Traveler, in the Pale Heart — same grin, same hand cannon, and of course a plan.',
    voice: 'Got a plan. It is a good one, promise.',
    image: 'https://destiny.wiki.gallery/images/9/96/TFSCayde.jpg',
  },
  balatro: { name: 'Perkeo', title: 'The Negative', line: 'Leave the shop with one card and come back with two: the only jester who always keeps a spare up his sleeve.', voice: 'One more for the road.' },
  forhonor: { name: 'Centurion', title: 'The Legion\'s Fist', line: 'Gladius, fists and a voice that carries over the whole battlefield: he breaks your guard, then your will.', voice: 'INCREDIBILIS!', audio: 'https://www.myinstants.com/media/sounds/for-honor-incredibilis.mp3' },
  // Forts' mythic is the Howitzer (it was Eagle Eye, who took the Howitzer's place as a legendary): its
  // voice comes from the game's own TikTok (@fortsgame, 0:09–0:13).
  forts: {
    name: 'Howitzer',
    title: 'The Big Gun',
    line: 'Hazard stripes, a crew in a tin hat and a muzzle flash you can see across the map: the heaviest shell in the game, on its way.',
    voice: 'BOOM!',
    audio: 'tiktok:7367350882020625670@9-13',
    image: 'https://www.earthworkgames.com/wp-content/uploads/2025/09/weaponimage-howitzer.png',
  },
  inazuma: { name: 'Mark Evans', title: 'Captain of Raimon', line: 'A headband, a ball and a hand that stops anything. Let’s play some soccer!', voice: "Let's play some soccer!" },
  jlpt: { name: 'Spirit', title: 'Ki, the Breath of Things', line: 'In 元気, in 天気, in 気持ち: one little kanji for the air, the mood and the life in everything — no word gets far in Japanese without it.', voice: 'Genki desu ka?', image: kanjiPicture('kanji:気') },
  ufouria: { name: 'Hebe', title: 'Hero of Ufouria', line: 'A blue woolly hat, a fluffy round body and a butt stomp that turns enemies into coins: he went to sleep in his own bed and woke up to save the world.', voice: 'Uppo!', image: UFOURIA_ART('dance-hebe-2.png') },
  unreal: { name: 'Event BeginPlay', title: 'Where It All Begins', line: 'Every game ever shipped on the engine woke up right here: one red node, one white wire, and the whole world starts to run.', voice: 'Begin play.', image: UNREAL_ART.beginPlay },
};

/**
 * A second mythic for every franchise, added later (ids `<set>:mythic-2`): another star's special
 * edition, its picture the star's own card unless given. Doomfist's line is his own voice (the
 * Overwatch wiki's file, in French too); the others are read in the browser's voice. (Lines written for these cards;
 * titles and catchphrases from the franchises.)
 */
const MYTHICS_2: Record<string, { name: string; title: string; line: string; voice: string; audio?: string; voiceFr?: string; audioFr?: string; image?: string }> = {
  lol: { name: 'Jinx', title: 'The Loose Cannon', line: 'Two guns, one rocket launcher and zero plans — Piltover has never been so loud.', voice: 'Get excited!' },
  overwatch: {
    name: 'Doomfist',
    title: 'The Successor',
    line: 'He leaps, the sky goes dark, and one gauntlet comes down like a falling star.',
    voice: 'Meteor Strike!',
    audio: 'https://static.wikia.nocookie.net/overwatch_gamepedia/images/5/54/Doomfist_-_Meteor_strike.ogg/revision/latest?cb=20230913153702',
    // In French, his ultimate's line in Doudou Masta's voice (the Overwatch wiki's French Dubbing page).
    voiceFr: 'Frappe météore !',
    audioFr: 'https://static.wikia.nocookie.net/overwatch_gamepedia/images/4/43/FrenchDoomfistULT.wav/revision/latest?cb=20241202040803',
  },
  minecraft: { name: 'Warden', title: 'The Deep Dark', line: 'Blind, patient, listening: one careless footstep in the Deep Dark and it is already coming.', voice: 'Sniff… sniff…' },
  onepiece: { name: 'Roronoa Zoro', title: 'The Pirate Hunter', line: 'Three swords, no sense of direction, and a promise to be the greatest swordsman alive.', voice: 'Santōryū!' },
  dbz: { name: 'Vegeta', title: 'Prince of All Saiyans', line: 'Pride sharper than any blade: he will surpass Kakarot, or burn trying.', voice: 'Final Flash!' },
  naruto: { name: 'Sasuke Uchiha', title: 'The Last Uchiha', line: 'Lightning in one hand, the Sharingan in his eyes — the rival who walked his own dark road.', voice: 'Chidori!' },
  starwars: { name: 'Darth Vader', title: 'Dark Lord of the Sith', line: 'A mechanical breath in the dark, a red blade, and a father nobody expected.', voice: 'I am your father.' },
  harrypotter: { name: 'Hermione Granger', title: 'The Brightest Witch of Her Age', line: 'Every book read, every spell perfect — and the one who saved them all, twice a year.', voice: 'Wingardium Leviosa!' },
  lotr: { name: 'Aragorn', title: 'King of Gondor', line: 'A ranger in the wild, a king at the Black Gate: the heir who finally came home.', voice: 'For Frodo.' },
  mcu: { name: 'Thor', title: 'God of Thunder', line: 'A hammer that chooses its bearer, an axe forged in a dying star, and lightning to spare.', voice: 'Bring me Thanos!' },
  smash: { name: 'Kirby', title: 'The Star Warrior', line: 'Small, round, always hungry — and somehow the last one standing on every stage.', voice: 'Poyo!' },
  genshin: { name: 'Raiden Shogun', title: 'The Eternal Shogun', line: 'One stroke of the Musou no Hitotachi, and the storm itself bows to eternity.', voice: 'Inazuma shines eternal!' },
  wow: { name: 'Thrall', title: 'The World-Shaman', line: 'Born a slave, raised a warchief: the orc who taught the Horde to be free.', voice: 'For the Horde!' },
  avatar: {
    name: 'Toph',
    title: 'The Blind Bandit',
    line: 'She sees through her feet, wins every fight blindfolded — and invented metalbending at twelve.',
    voice: 'I am the Blind Bandit!',
    image: 'https://static.wikia.nocookie.net/avatar/images/5/56/Toph_Blu-ray_art.png/revision/latest/scale-to-width-down/500?cb=20261025210823',
  },
  inazuma: { name: 'Axel Blaze', title: 'The Flame Striker', line: 'He spins, the ball catches fire, and the keeper never sees it coming.', voice: 'Fire Tornado!' },
  balatro: { name: 'Jimbo', title: 'Your Friend at the Table', line: 'He knows every seed, every shop and every hand you should have played, and he will tell you all about it.', voice: 'Hey there, friend!' },
  destiny: { name: 'Zavala', title: 'Commander of the Vanguard', line: 'The last wall between the City and the dark: a Titan who gets back up every single time.', voice: 'Guardians, make your stand.' },
  forhonor: { name: 'Black Prior', title: 'Sworn to the Cross', line: 'A kite shield, a heavy blade and a vow he never broke: the Blackstone’s fallen knight still stands between you and everyone he guards.', voice: 'For honor!' },
  forts: { name: 'Phantom', title: 'Now You See Me', line: 'No one ever finds his fort until its guns open up, and by then it has already moved on.', voice: 'You never saw me.', image: 'https://www.earthworkgames.com/wp-content/uploads/2025/09/Commander-Phantom.png' },
  jlpt: { name: 'Oni-Sensei', title: 'Final Exam', line: 'Red pen in hand, he has marked two thousand kanji wrong, one stroke at a time. Pass his exam and he finally smiles — once.', voice: 'Hajime!' },
  unreal: { name: 'Print String', title: 'Hello', line: 'The oldest debugger in the engine: when nothing else makes sense, it writes one cyan word in the corner and the truth comes out.', voice: 'Hello', image: UNREAL_ART.printString },
};

/**
 * The omnis, rarest of all: a franchise's legend in two forms. The first is theirs from the pack;
 * the second wakes once the franchise's guardian is beaten on Hard (Gear 4 → Gear 5, Super Saiyan →
 * Perfected Ultra Instinct). `image` left out: the character's own picture. (Lines written for
 * these cards; art from the fan wikis.)
 */
const OMNIS: Record<string, { name: string; title: string; line: string; image?: string; awaken: { title: string; image: string; line: string } }> = {
  // 漢字 itself, in gold on black; on a Hard win it wakes as 合格, "passed" (both words from the list).
  jlpt: {
    name: 'Language',
    title: '漢字 — Kanji',
    line: 'Two thousand of them in the list, each with its readings and its meanings: every card of the set, written together, makes this one word.',
    image: kanjiPicture('kanji-omni:漢字'),
    awaken: {
      title: '合格 — Gōkaku',
      line: 'Oni-Sensei bows for the first time: every stroke in its place, every reading known. N1 — passed.',
      image: kanjiPicture('kanji-awake:合格'),
    },
  },
  // Ufouria: O-Chan cheering (the official site's art); on a Hard win, flying over the Earth (the key art).
  ufouria: {
    name: 'O-Chan',
    title: 'The Cat-Suit Friend',
    line: 'The first friend Utsujin’s Bumyon took over, and the first one Hebe had to fight to bring back. She can’t hold back any longer!',
    image: UFOURIA_ART('dance-o-chan.png'),
    awaken: {
      title: 'Over the Earth',
      line: 'Saucer gone, Bumyon cleaned up: O-Chan floats above the whole world, Hebe and the others beside her.',
      image: UFOURIA_ART('o-chan-space.jpg'),
    },
  },
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
  avatar: {
    name: 'Aang',
    title: 'The Last Airbender',
    line: 'A hundred years in the ice, a whole nation gone — and still the kid who laughs on the back of a flying bison.',
    image: 'https://static.wikia.nocookie.net/avatar/images/5/56/Aang_airbending.png/revision/latest?cb=20200418205438',
    awaken: {
      title: 'Avatar State',
      line: 'Every Avatar who came before him, speaking through his eyes: the glow of a thousand lifetimes, and the whole world holding its breath.',
      image: 'https://static.wikia.nocookie.net/avatar/images/1/11/Aang_in_the_Avatar_State.png/revision/latest?cb=20140124170912',
    },
  },
  forts: {
    name: 'Howitzer',
    title: 'Full Barrage',
    line: 'The howitzer gives the signal and every gun on the fort answers — rockets, cannons, lasers — until the sky over the enemy turns to fire.',
    image: 'https://www.earthworkgames.com/wp-content/uploads/2022/02/forts-landing-page.png',
    awaken: {
      title: 'The Last Shell',
      line: 'One gunner, one tin hat, one shell left — and it is going straight through the enemy reactor.',
      image: 'https://www.earthworkgames.com/wp-content/uploads/2025/09/PressKit-Howitzer.png',
    },
  },
  forhonor: {
    name: 'Apollyon',
    title: 'The Wolf Among Sheep',
    line: 'She set knights, Vikings and samurai at one another’s throats, on purpose, because she believed only war makes wolves of men.',
    image: 'https://static.wikia.nocookie.net/for-honor/images/b/b9/Apollyon.png/revision/latest/scale-to-width-down/500?cb=20160730005307',
    awaken: {
      title: 'Warlord of the Blackstone',
      line: 'The war she lit has outlived her: every keep burning, every faction in arms, and her statue still watching over it all.',
      image: 'https://static.wikia.nocookie.net/for-honor/images/2/2d/Apollyon.jpg/revision/latest/scale-to-width-down/500?cb=20170204122924',
    },
  },
  balatro: {
    name: 'The Soul',
    title: 'Spectral Card',
    line: 'The rarest card in the pack: open it, and a legendary joker takes the seat beside you. No one has ever said no.',
    image: 'https://static.wikia.nocookie.net/balatrogame/images/6/6b/Spectral_The_Soul.png/revision/latest?cb=20250619173423',
    awaken: {
      title: 'Naneinf',
      line: 'The chips climb past every number there is, the counter gives up, and the screen reads naneinf. You have broken the game.',
      image: 'https://static.wikia.nocookie.net/balatrogame/images/b/b9/PolychromeModJoker.png/revision/latest?cb=20250420022806',
    },
  },
  unreal: {
    name: 'Tanglewire',
    title: 'The Spaghetti Graph',
    line: 'Three years of “I’ll clean this up later”, all in one Blueprint, and it has grown a face. Nobody dares touch a single wire.',
    image: UNREAL_ART.tangle,
    awaken: {
      title: 'Good to Go',
      line: 'Every wire straight, every node aligned, and the compile button finally green. It can’t remember what it was so angry about.',
      image: UNREAL_ART.compiled,
    },
  },
  destiny: {
    name: 'The Witness',
    title: "Salvation's Edge",
    line: 'At the summit of its Monolith it waits for the fireteam that came this far: a god of the Darkness, stepping out of its shroud to fight in person.',
    image: 'https://destiny.wiki.gallery/images/thumb/2/25/Witness_true_battle_dewey_bonczyk.jpg/600px-Witness_true_battle_dewey_bonczyk.jpg',
    awaken: {
      title: 'The Final Shape',
      line: 'Its arm comes down on the platform with the weight of a collapsing universe — the last thing between the Light and the end of everything.',
      image: 'https://destiny.wiki.gallery/images/thumb/0/08/Witness_edge_slam.png/600px-Witness_edge_slam.png',
    },
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
/** JLPT cards: [name, kanji, reading, meaning, level(, rarity)] (scripts/data/jlpt-boss.mjs) — a card for every kanji of the list. */
type JlptRow = [string, string, string, string, string, Rarity?];
const JLPT_ROSTER = JLPT_CARDS.roster as JlptRow[];
const MORE = { ...MORE_ROSTERS, jlpt: JLPT_ROSTER.map(([name, kanji, , , , rarity]) => ({ name, image: kanjiPicture(`kanji:${kanji}`), rarity: rarity! })) } as Record<string, { name: string; image: string; rarity: Rarity }[]>;

/** A JLPT card says its kanji: its meanings, its readings and its level. */
const JLPT_LINE = new Map([...(JLPT_CARDS.described as JlptRow[]), ...JLPT_ROSTER].map(([name, kanji, reading, meaning, level]) => [name, `${kanji} — ${meaning || name.toLowerCase()}. Read ${reading.replace(/\./g, '')}. JLPT ${level}.`]));

/**
 * The mythics and omnis at their strongest, in their own voices: the most powerful form or the
 * finest alternate look the franchise has (Ultra Ego Vegeta, Sasuke's Susanoo, King of Hell Zoro;
 * for the games, their skins and outfits — Star Guardian Jinx, Red Dead of Night Diluc), and their
 * line in the voice actor's original language (the anime's Japanese; Genshin's Liyue in Chinese
 * and Inazuma in Japanese), from the wikis' voice files and myinstants. A card left out keeps its
 * own picture, and its line is read by the browser's voice.
 */
const STRONG: Record<string, Partial<Pick<Card, 'image' | 'title' | 'voice' | 'audio' | 'focus'>>> = {
  // ── First mythics ──
  'lol:mythic': { title: 'Prestige K/DA', image: 'https://static.wikia.nocookie.net/leagueoflegends/images/f/fc/Ahri_PrestigeKDALoading.jpg/revision/latest?cb=20230110233703' },
  'overwatch:mythic': { title: 'Graffiti', image: 'https://static.wikia.nocookie.net/overwatch_gamepedia/images/1/19/Tracer_Skin_Graffiti.png/revision/latest/scale-to-width-down/500?cb=20170526223356' },
  'naruto:mythic': { image: 'https://static.wikia.nocookie.net/naruto/images/4/42/Naruto_Part_III.png/revision/latest/scale-to-width-down/500?cb=20180117103539' },
  'genshin:mythic': { title: 'Red Dead of Night', image: 'https://static.wikia.nocookie.net/gensin-impact/images/2/29/Character_Diluc_Red_Dead_of_Night_Full_Wish.png/revision/latest/scale-to-width-down/500?cb=20220801021754' },
  'inazuma:mythic': { image: 'https://static.wikia.nocookie.net/inazuma-eleven/images/a/a7/Endou_Mamoru_%28Orion%29.png/revision/latest/scale-to-width-down/500?cb=20210926134601' },
  // ── Second mythics ──
  'lol:mythic-2': { title: 'Star Guardian', image: 'https://static.wikia.nocookie.net/leagueoflegends/images/e/ea/Jinx_StarGuardianLoading.jpg/revision/latest?cb=20200424235449', voice: 'Get excited!', audio: 'https://static.wikia.nocookie.net/leagueoflegends/images/3/3a/VO_Jinx_spell_resolve_ally_GetExcited_01.ogg/revision/latest?cb=20210715230517' },
  'minecraft:mythic-2': { voice: 'Sniff… sniff…', audio: 'https://minecraft.wiki/images/Warden_sniff1.ogg?b4ff6' },
  'onepiece:mythic-2': { title: 'King of Hell', image: 'https://static.wikia.nocookie.net/onepiece/images/c/cf/King_of_Hell_Three_Sword_Style.png/revision/latest/scale-to-width-down/500?cb=20250427161903', voice: 'Santōryū… Rengoku Onigiri!', audio: 'https://www.myinstants.com/media/sounds/zoro-santoryu-rengoku-onigiri-one-piece-vostfr-trim.mp3' },
  'dbz:mythic-2': { title: 'Ultra Ego', image: 'https://static.wikia.nocookie.net/dragonball/images/7/7f/Ultra_Ego_Vegeta_%28Digital_Colored_Manga%29.png/revision/latest/scale-to-width-down/500?cb=20260205042243', voice: 'Final Flash!', audio: 'https://www.myinstants.com/media/sounds/vegeta-final-flash.mp3' },
  'naruto:mythic-2': { title: 'Susanoo', image: 'https://static.wikia.nocookie.net/naruto/images/2/28/Sasuke%27s_Fully_body_Susanoo.png/revision/latest/scale-to-width-down/500?cb=20141016124203', voice: 'Chidori!', audio: 'https://www.myinstants.com/media/sounds/chidorii.mp3' },
  'starwars:mythic-2': { voice: 'I am your father.', audio: 'https://www.myinstants.com/media/sounds/i-am-your-father_ujQC0Zu.mp3' },
  'harrypotter:mythic-2': { voice: "It's Levi-O-sa, not Levi-o-SA!", audio: 'https://www.myinstants.com/media/sounds/itsleviosa_HEW2LBa.mp3' },
  'lotr:mythic-2': { title: 'King Elessar', image: 'https://static.wikia.nocookie.net/lotr/images/3/35/King_Elessar.jpg/revision/latest/scale-to-width-down/500?cb=20210510072541', voice: 'For Frodo.', audio: 'https://www.myinstants.com/media/sounds/sub-final.mp3' },
  'mcu:mythic-2': { title: 'Stormbreaker', image: 'https://static.wikia.nocookie.net/marvelcinematicuniverse/images/e/ed/Avengers_Infinity_War_Thor_concept_art_3.jpg/revision/latest/scale-to-width-down/500?cb=20181106193641', voice: 'Bring me Thanos!', audio: 'https://www.myinstants.com/media/sounds/bring_me_thanos.mp3' },
  'smash:mythic-2': { voice: 'Poyo!', audio: 'https://www.myinstants.com/media/sounds/poyo.mp3' },
  'genshin:mythic-2': { voice: 'Inabikari, sunawachi eien nari!', audio: 'https://static.wikia.nocookie.net/gensin-impact/images/c/cc/VO_JA_Raiden_Shogun_Elemental_Burst_03.ogg/revision/latest?cb=20221112234607' },
  'wow:mythic-2': { image: 'https://warcraft.wiki.gg/images/thumb/Thrall_HotS_World-Shaman.jpg/500px-Thrall_HotS_World-Shaman.jpg?543732' },
  'inazuma:mythic-2': { image: 'https://static.wikia.nocookie.net/inazuma-eleven/images/d/d0/Gouenji_Shuuya_%28Orion%29.png/revision/latest/scale-to-width-down/500?cb=20190912000534' },
  // ── Omnis: their voices ──
  'lol:omni': { voice: 'A chase, then!', audio: 'https://static.wikia.nocookie.net/leagueoflegends/images/e/ef/Ahri_SpiritBlossom_R_1.ogg/revision/latest?cb=20200726232639' },
  'overwatch:omni': { voice: 'Heroes never die!', audio: 'https://static.wikia.nocookie.net/overwatch_gamepedia/images/a/ac/Mercy_-_Heroes_never_die.ogg/revision/latest?cb=20230914114913' },
  'minecraft:omni': { voice: '*BOOM*', audio: 'https://minecraft.wiki/images/Explosion1.ogg?6ed29' },
  'onepiece:omni': { voice: 'Gomu Gomu no…!', audio: 'https://www.myinstants.com/media/sounds/gomu-gomu-no.mp3' },
  'dbz:omni': { voice: 'Kamehameha!', audio: 'https://www.myinstants.com/media/sounds/kamehameha_qWZSJCi.mp3' },
  'naruto:omni': { voice: 'Rasengan!', audio: 'https://www.myinstants.com/media/sounds/naruto-rasengan-voice.mp3' },
  'starwars:omni': { voice: 'You underestimate my power!', audio: 'https://www.myinstants.com/media/sounds/you-underestimate-my-power_cN70zP4.mp3' },
  'harrypotter:omni': { voice: 'Expelliarmus!' },
  'lotr:omni': { voice: 'You shall not pass!', audio: 'https://www.myinstants.com/media/sounds/gandalf_shallnotpass.mp3' },
  'mcu:omni': { voice: 'I am Iron Man.', audio: 'https://www.myinstants.com/media/sounds/ironman_Qaec4ow.mp3' },
  'genshin:omni': { voice: 'Tiān dòng wàn xiàng!', audio: 'https://static.wikia.nocookie.net/gensin-impact/images/d/d0/VO_ZH_Zhongli_Elemental_Burst_03.ogg/revision/latest?cb=20221113225313' },
  'wow:omni': { voice: 'Frostmourne hungers.' },
  'inazuma:omni': { voice: 'God Hand!' },
  'avatar:omni': { voice: 'Yip yip!' },
  // ── Forts: the Armoured Door's only picture is a screenshot — framed on the door. (The rest have the
  // Forts RTS Wiki's own art, in src/data/bosses.json.) ──
  'forts:armoured-door': { focus: { x: 50, y: 55, zoom: 1.5 } },
};

/**
 * Single cards added later, each with an id of its own: a favourite of the franchise again, at a
 * higher rarity, in another pose (the Howitzer, close up and firing, from the studio's art).
 */
const EXTRA: (Pick<Card, 'id' | 'name' | 'image' | 'rarity' | 'title' | 'description'> & { set: string })[] = [
  {
    set: 'forts',
    // Swapped with the mythic: this legendary is now Eagle Eye (the id stays, so no one loses a card).
    id: 'forts:howitzer-legendary',
    name: 'Eagle Eye',
    rarity: 'legendary',
    title: 'Master Marksman',
    image: 'https://static.wikia.nocookie.net/forts-rts/images/7/70/Eagle_Eye_Portrait.png/revision/latest/scale-to-width-down/400?cb=20220901021356',
    description: 'One laser sight, one steady hand — and a sniper round through the one gap in your armour.',
  },
  // The expansions' weapons, in the studio's own art (Weapon-*.png on earthworkgames.com).
  { set: 'forts', id: 'forts:orbital-laser', name: 'Orbital Laser', rarity: 'epic', image: 'https://www.earthworkgames.com/wp-content/uploads/2025/09/Weapon-OrbitalLaser.png', description: 'A beam from orbit that sweeps straight down through the enemy fort.' },
  { set: 'forts', id: 'forts:deck-gun', name: 'Deck Gun', rarity: 'rare', image: 'https://www.earthworkgames.com/wp-content/uploads/2025/09/Weapon-DeckGun.png', description: 'A ship\'s gun, firing broadside.' },
  { set: 'forts', id: 'forts:harpoon', name: 'Harpoon', rarity: 'rare', image: 'https://www.earthworkgames.com/wp-content/uploads/2025/09/Weapon-Harpoon.png', description: 'Hook it, reel it in.' },
  { set: 'forts', id: 'forts:dome', name: 'Dome', rarity: 'common', image: 'https://www.earthworkgames.com/wp-content/uploads/2025/09/Weapon-Dome.png', description: 'A familiar face of Forts.' },
  // Destiny's third mythic: the Taken King in the art of the Destinypedia infobox.
  {
    set: 'destiny',
    id: 'destiny:mythic-oryx',
    name: 'Oryx',
    rarity: 'mythic',
    title: 'The Taken King',
    image: 'https://destiny.wiki.gallery/images/thumb/7/70/OryxInfobox.jpg/600px-OryxInfobox.jpg',
    description: 'He killed his own gods and took their power, then bent whole armies to his will — and his Dreadnaught still drifts in the rings of Saturn.',
  },
];

/**
 * The mythics' and omnis' animated clips: short loops from Tenor (their MP4s), chosen by eye. An omni's
 * is its awakened form's, seen once its guardian falls on Hard.
 */
const CLIPS: Record<string, string> = {
  'lol:mythic': 'https://media.tenor.com/ovaIqQkF4M0AAAPo/ahri-kda.mp4',
  'lol:omni': 'https://media.tenor.com/OaenBPLYCCYAAAPo/ahri-league-of-legends.mp4',
  'lol:mythic-2': 'https://media.tenor.com/aON12Kv1-8UAAAPo/jinx-star-guardian.mp4',
  'overwatch:mythic': 'https://media.tenor.com/G_EVend5kNYAAAP1/tracer-overwatch.mp4',
  'overwatch:omni': 'https://media.tenor.com/Q_tSybqTqr0AAAP1/pink-rose-gold.mp4',
  'overwatch:mythic-2': 'https://media.tenor.com/eW-0Jv-XG28AAAP1/overwatch-overwatch-league.mp4',
  'minecraft:mythic': 'https://media.tenor.com/G7ryB6dOXCsAAAPo/creeper-creeper-explosion.mp4',
  'minecraft:omni': 'https://media.tenor.com/FjMXvOoCwrcAAAP1/charged-creeper-lightning.mp4',
  'minecraft:mythic-2': 'https://media.tenor.com/xggcQgDU3mkAAAP1/minecraft-warden.mp4',
  'onepiece:mythic': 'https://media.tenor.com/E-EofnlEKOYAAAP1/egghead-one-piece.mp4',
  'onepiece:omni': 'https://media.tenor.com/S9Xo7A1m3_EAAAP1/one-piece-onigashima-arc.mp4',
  'onepiece:mythic-2': 'https://media.tenor.com/1Rie5-nbCN8AAAPo/king-of-hell-zoro-zoro-one-piece.mp4',
  'dbz:mythic': 'https://media.tenor.com/6KICR9VojUkAAAP1/son-goku.mp4',
  'dbz:omni': 'https://media.tenor.com/ysUrLHpqeJYAAAP1/vergil675.mp4',
  'dbz:mythic-2': 'https://media.tenor.com/z496xO1AN8kAAAP1/vegeta-ultra-ego-vegeta.mp4',
  'naruto:mythic': 'https://media.tenor.com/wXznpWHYodIAAAPo/hokage-good.mp4',
  'naruto:omni': 'https://media.tenor.com/uiGaKw6MQuMAAAP1/hh.mp4',
  'naruto:mythic-2': 'https://media.tenor.com/-fuuxopk9WwAAAPo/sasuke-susano.mp4',
  'starwars:mythic': 'https://media.tenor.com/AOUl2bhSY4cAAAP1/yoda-fight.mp4',
  'starwars:omni': 'https://media.tenor.com/a1VrRecyJjQAAAP1/vader-natode-vader.mp4',
  'starwars:mythic-2': 'https://media.tenor.com/nwBMOVfhuS0AAAPo/darth-vader-im-ready.mp4',
  'harrypotter:mythic': 'https://media.tenor.com/wt7eXX5sQxoAAAP1/hp-harry-potter.mp4',
  'harrypotter:omni': 'https://media.tenor.com/_Po2TZKmqLkAAAPo/elder-wand-harry-potter.mp4',
  'harrypotter:mythic-2': 'https://media.tenor.com/i0J9xP3hu8QAAAPo/stupefy-hermione-granger.mp4',
  'lotr:mythic': 'https://media.tenor.com/MuVqoWRdyp8AAAP1/lord-of-the-rings-ring.mp4',
  'lotr:omni': 'https://media.tenor.com/aKR7BgooK-UAAAPo/gandalf-the-white-gandalf.mp4',
  'lotr:mythic-2': 'https://media.tenor.com/LtGe_1jolSwAAAPo/lord-of-the-rings-return-of-the-king.mp4',
  'mcu:mythic': 'https://media.tenor.com/X65SdRy9nbwAAAP1/iron-man.mp4',
  'mcu:omni': 'https://media.tenor.com/KRu4vbcBkEoAAAP1/robert-downey-jr-ironman.mp4',
  'mcu:mythic-2': 'https://media.tenor.com/SP5FwVSdM8kAAAP1/almighty-thunder.mp4',
  'smash:mythic': 'https://media.tenor.com/2mGaUC5YyN4AAAP1/ucm-imucm.mp4',
  'smash:omni': 'https://media.tenor.com/9beKjndyAScAAAP1/legendofzelda-link.mp4',
  'smash:mythic-2': 'https://media.tenor.com/BjXbSxg_O2UAAAPo/kasane-teto-teto-kasane.mp4',
  'genshin:mythic': 'https://media.tenor.com/hio_kwnWe7cAAAPo/hyejinsgenre-diluc.mp4',
  'genshin:omni': 'https://media.tenor.com/BTgMUyjU5SgAAAPo/zhongli-zhongli-burst.mp4',
  'genshin:mythic-2': 'https://media.tenor.com/umRS1zU3OUsAAAPo/raiden-baal.mp4',
  'wow:mythic': 'https://media.tenor.com/X8gVLf0ElZgAAAP1/tyrande-vs-sylvanas-warcraft.mp4',
  'wow:omni': 'https://media.tenor.com/YD60vE1x6-QAAAP1/arthas.mp4',
  'wow:mythic-2': 'https://media.tenor.com/UXYdx30sa4QAAAPo/thrall-world-of-warcraft.mp4',
  'inazuma:mythic': 'https://media.tenor.com/s0u-malnHkoAAAP1/mark-evans-endou-mamoru.mp4',
  'inazuma:omni': 'https://media.tenor.com/WW2B3R_iirIAAAP1/inazuma-eleven-inazuma-eleven-3.mp4',
  'inazuma:mythic-2': 'https://media.tenor.com/BfiOzlRAU2QAAAPo/shuuya-gouenji-tsurugi-kyousuke-fire-tornado-double-drive.mp4',
  // The howitzer, from the game's own TikTok (@fortsgame, 0:01–0:05).
  'forts:mythic': 'tiktok:7367350882020625670@1-5',
  'forts:omni': 'https://media.tenor.com/nLDwdFO48t0AAAP1/get-on-forts-forts.mp4',
  'forhonor:mythic': 'https://media.tenor.com/kgk2JUYxtUQAAAPo/for-honor-centurion.mp4',
  'avatar:mythic': 'https://media.tenor.com/C8qZIVmxzNEAAAPo/firebend-atla.mp4',
  'avatar:omni': 'https://media.tenor.com/oPuyveLpr8AAAAP1/fire-anime.mp4',
  'avatar:mythic-2': 'https://media.tenor.com/FwNFDMOM2bIAAAPo/toph-avatar-the-last-airbender.mp4',
  'destiny:mythic': 'https://media.tenor.com/NLIpsly4D30AAAP1/cayde6-nicecock.mp4',
  'destiny:omni': 'https://media.tenor.com/s0PgNUUj9mAAAAP1/the-witness-destiny-2.mp4',
  'destiny:mythic-2': 'https://media.tenor.com/9SO8-ZvgS3UAAAP1/twab-where-twab.mp4',
};
/** The clips under 150 KB. */
const LIGHT_CLIPS = new Set(['overwatch:mythic', 'harrypotter:mythic', 'overwatch:omni', 'lotr:mythic', 'harrypotter:mythic-2', 'dbz:omni', 'minecraft:omni', 'wow:mythic', 'mcu:mythic-2', 'harrypotter:omni', 'forhonor:mythic', 'overwatch:mythic-2', 'smash:omni', 'inazuma:mythic', 'minecraft:mythic', 'avatar:mythic-2', 'forts:omni', 'minecraft:mythic-2', 'dbz:mythic-2', 'naruto:mythic-2', 'mcu:omni', 'inazuma:omni', 'wow:omni', 'destiny:mythic-2', 'destiny:omni', 'destiny:mythic']);
/** The pictures measured as cut out (transparent edges), first form and awakened. */
const CUTOUTS = new Set(['overwatch:omni', 'overwatch:mythic-2', 'minecraft:mythic', 'minecraft:omni', 'minecraft:mythic-2', 'onepiece:omni', 'naruto:omni', 'mcu:omni', 'smash:mythic', 'smash:omni', 'smash:mythic-2', 'genshin:mythic', 'genshin:omni', 'genshin:mythic-2', 'ufouria:mythic', 'ufouria:omni']);
const CUTOUTS_AWAKE = new Set(['minecraft:omni', 'starwars:omni', 'smash:omni']);
const withClip = (c: Card): Card => {
  const clip = CLIPS[c.id];
  const clipLight = !!clip && LIGHT_CLIPS.has(c.id);
  const cutout = CUTOUTS.has(c.id);
  return c.awaken ? { ...c, cutout, awaken: { ...c.awaken, clip, clipLight, cutout: CUTOUTS_AWAKE.has(c.id) } } : { ...c, clip, clipLight, cutout };
};

/** Franchises added after the first fourteen (see CARDS). */
const LATE_SETS = new Set(['forts', 'forhonor', 'avatar', 'unreal', 'destiny', 'balatro', 'jlpt', 'ufouria']);
/** Late sets whose names stay out of the global list, so the later roster passes keep every card they had. */
const KEEP_OUT_OF_SEEN = new Set(['destiny', 'balatro', 'jlpt', 'ufouria']);

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
  if (set === 'jlpt' && JLPT_LINE.has(name)) return JLPT_LINE.get(name)!;
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

/**
 * The cards' own pictures where Boss Battle has moved on: the bosses of these sets now show 2D art (3D
 * models are kept for silhouettes), but the cards players have pulled keep the picture they were pulled with
 * (src/data/card-art.json, by set and name; "@boss" is the guardian's).
 */
const ART = CARD_ART as Record<string, Record<string, string>>;
const withCardArt = (b: (typeof BOSSES)[number]): (typeof BOSSES)[number] => {
  const art = ART[b.id];
  if (!art) return b;
  const keep = <T extends { label: string; image?: string }>(c: T): T => ({ ...c, image: art[c.label] ?? c.image });
  return { ...b, boss: { ...b.boss, image: art['@boss'] ?? b.boss.image }, radar: { ...b.radar, members: (b.cardMembers ?? b.radar.members).map(keep) }, finale: b.finale.map(keep) };
};
const CARD_BOSSES = BOSSES.map(withCardArt);

export const CARDS: Card[] = (() => {
  // Each name once across all sets: the first set to build it keeps it. The order below is the
  // order cards were added over time — a later addition can never take a name an earlier card has,
  // so released cards keep their ids.
  const seen = new Set<string>();
  const sets = new Map<string, Omit<Card, 'no'>[]>();
  for (const b of CARD_BOSSES) {
    const set: Omit<Card, 'no'>[] = [];
    sets.set(b.id, set);
    // Franchises added after the first fourteen only need a name new to their own set: being last, they can't
    // take one from another (Forts' Phantom isn't Minecraft's).
    const own = LATE_SETS.has(b.id);
    const add = (name: string, image: string | undefined, rarity: Rarity, description: string) => {
      if (!image || (own ? set.some((c) => c.name === name) : seen.has(name))) return;
      // Nor can they keep a name from the rosters added after (Destiny's Ghost must leave Marvel's be).
      if (!KEEP_OUT_OF_SEEN.has(b.id)) seen.add(name);
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
    if (m && star?.image) set.push({ id: `${b.id}:mythic`, name: m.name, image: m.image ?? star.image, set: b.id, franchise: b.franchise, domain: b.domain, rarity: 'mythic', title: m.title, voice: m.voice, audio: m.audio, voiceFr: m.voiceFr, audioFr: m.audioFr, description: m.line });
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
  for (const b of CARD_BOSSES) {
    const set = sets.get(b.id)!;
    for (const r of ROSTERS[b.id] ?? []) {
      if (!r.image || seen.has(r.name)) continue;
      seen.add(r.name);
      set.push({ id: `${b.id}:${slug(r.name)}`, name: r.name, image: r.image, set: b.id, franchise: b.franchise, domain: b.domain, rarity: r.rarity, description: describe(b.id, r.name, r.rarity === 'epic' ? 'epic' : r.rarity === 'rare' ? 'rare' : 'common', b.franchise) });
    }
  }
  // Added last: the bigger rosters. A name only has to be new to its own set here (Overwatch's Ashe
  // isn't League's), so nothing added before can lose its card.
  for (const b of CARD_BOSSES) {
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
  // Then the single cards added on their own.
  for (const x of EXTRA) {
    const b = CARD_BOSSES.find((y) => y.id === x.set);
    if (b) sets.get(b.id)!.push({ id: x.id, name: x.name, image: x.image, set: b.id, franchise: b.franchise, domain: b.domain, rarity: x.rarity, title: x.title, description: x.description });
  }
  // And last: the second mythics, each set's newest card.
  for (const b of CARD_BOSSES) {
    const set = sets.get(b.id)!;
    const m = MYTHICS_2[b.id];
    const image = m && (m.image ?? set.find((c) => c.name === m.name)?.image ?? (b.boss.name === m.name ? b.boss.image : undefined));
    if (m && image) set.push({ id: `${b.id}:mythic-2`, name: m.name, image, set: b.id, franchise: b.franchise, domain: b.domain, rarity: 'mythic', title: m.title, voice: m.voice, audio: m.audio, voiceFr: m.voiceFr, audioFr: m.audioFr, description: m.line });
  }
  return CARD_BOSSES.flatMap((b) => sets.get(b.id)!.map((c, i) => withClip({ ...c, ...STRONG[c.id], rarity: FROZEN[c.id] ?? c.rarity, no: i + 1 })));
})();

export const CARD_BY_ID = new Map(CARDS.map((c) => [c.id, c]));

/** The sets, in Boss Battle order: id, franchise, kind of work, size. */
export const SETS = CARD_BOSSES.map((b) => ({ id: b.id, franchise: b.franchise, domain: b.domain, size: CARDS.filter((c) => c.set === b.id).length, guardian: b.boss }));
export const setSize = (id: string) => SETS.find((s) => s.id === id)?.size ?? 0;
