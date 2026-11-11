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
import INAZUMA_GO from '../data/inazuma-go.json';
import CARD_ART from '../data/card-art.json';
import CARD_OPAQUE from '../data/card-opaque.json';
import RARITY_TUNING from '../data/tuning/rarities.json';
import { kanjiPicture } from '../lib/kanji';
import type { Domain } from '../types';
import { VAULTED } from './upgrades';

/** Ufouria's pictures, served with the site (public/art/ufouria): the game's wikis don't let others show theirs. */
const UFOURIA_ART = (file: string) => `${import.meta.env?.BASE_URL ?? './'}art/ufouria/${file}`;
/** Hebe's and O-Chan's sounds and clips, from the owner's own game captures (public/audio/ufouria, public/clips/ufouria). */
const UFOURIA_SOUND = (name: string) => `${import.meta.env?.BASE_URL ?? './'}audio/ufouria/${name}.mp3`;
const UFOURIA_CLIP = (names: string[]) => names.map((n) => `${import.meta.env?.BASE_URL ?? './'}clips/ufouria/${n}.mp4`).join('|');

export type Rarity = 'common' | 'rare' | 'epic' | 'legendary' | 'mythic' | 'omni';
export const RARITIES: Rarity[] = ['common', 'rare', 'epic', 'legendary', 'mythic', 'omni'];

/** Names, gems and order: src/data/tuning/rarities.json (edited from the dev-only #/admin page). */
export const RARITY_INFO: Record<Rarity, { name: string; gem: string; rank: number }> = RARITY_TUNING.info;

/** Each rarity's light: the glow from a torn pack, the shooting star, the bursts, an icon's ring. */
export const RARITY_LIGHT: Record<Rarity, string> = RARITY_TUNING.light;

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
  /** Lines it may say instead, one picked at random each time it speaks (`voice` stays the one shown). */
  voices?: string[];
  /** The same, with the real recording of each line (the hero's own voice from the game's wiki). */
  voiceClips?: { line: string; audio: string }[];
  /** The French dub's line and recording, heard (and shown) when names are in French. */
  voiceFr?: string;
  audioFr?: string;
  /** An omni's second form: what it becomes once its franchise's guardian is beaten on Hard (its clip: see `clip`). */
  awaken?: { title: string; image: string; line: string; clip?: string; clipLight?: boolean; cutout?: boolean; opaque?: boolean };
  /** A short looping clip (MP4) of a mythic, played instead of its picture where the card is seen up close. */
  clip?: string;
  /** Its clip (an MP4) has a sound of its own: heard when it plays behind a win, instead of the card's voice line. */
  clipSound?: boolean;
  /** Its picture has a transparent background: it can step out of the frame on hover. */
  cutout?: boolean;
  /** Its picture has no transparency at all (a rectangle: art, a screenshot): it fills its frame. */
  opaque?: boolean;
  /** A clip so small it can run all the time, in the album too (the player can turn that off). */
  clipLight?: boolean;
  /**
   * Framing for a picture with more around it than the card wants (a group shot, a title banner, a
   * screenshot): zoomed `zoom` times on the point at `x`% / `y`% of it.
   */
  focus?: { x: number; y: number; zoom: number };
  /** A place, not a character (Inazuma Eleven's stadiums and schools): kept out of the games that name faces. */
  place?: boolean;
  /** A technique, not a character (Inazuma Eleven's hissatsu and keshins): kept out of the games that name faces too. */
  technique?: boolean;
  /** Number within its set, for the "12 / 35" corner. */
  no: number;
}

/**
 * The mythics: each franchise's star in a special edition — a title, a line of their own, and a
 * voice line: their catchphrase in their voice actor's own voice — the games' voice files (hosted
 * by the fan wikis), the anime's Japanese voices and the films' actors (clips from myinstants). (Lines written for these cards; titles and catchphrases from the franchises.)
 */
const MYTHICS: Record<string, { name: string; title: string; line: string; voice: string; audio?: string; voiceClips?: { line: string; audio: string }[]; voiceFr?: string; audioFr?: string; image?: string }> = {
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
    // Fire Lord Zuko on his throne (the owner's picture, served with the site).
    image: `${import.meta.env?.BASE_URL ?? './'}art/avatar/zuko-fire-lord.webp`,
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
    audio: `${import.meta.env?.BASE_URL ?? './'}clips/forts/howitzer-boom.m4a`,
    image: 'https://www.earthworkgames.com/wp-content/uploads/2025/09/weaponimage-howitzer.png',
  },
  inazuma: { name: 'Mark Evans', title: 'Captain of Raimon', line: 'A headband, a ball and a hand that stops anything. Let’s play some soccer!', voice: "Let's play some soccer!" },
  jlpt: { name: 'Spirit', title: 'Ki, the Breath of Things', line: 'In 元気, in 天気, in 気持ち: one little kanji for the air, the mood and the life in everything — no word gets far in Japanese without it.', voice: 'Genki desu ka?', image: kanjiPicture('kanji:気') },
  // His voice: his singing as he dances, from the owner's game captures (his clips: see CLIPS) — never the browser's voice.
  ufouria: { name: 'Hebe', title: 'Hero of Ufouria', line: 'A blue woolly hat, a fluffy round body and a butt stomp that turns enemies into coins: he went to sleep in his own bed and woke up to save the world.', voice: 'Uppo!', audio: UFOURIA_SOUND('hebe-cry'), voiceClips: [{ line: 'Uppo!', audio: UFOURIA_SOUND('hebe-cry') }, { line: '♪', audio: UFOURIA_SOUND('hebe-dancing-2') }], image: UFOURIA_ART('dance-hebe-2.png') },
  arcraiders: { name: 'Leaper', title: 'The Pounce', line: 'Four long legs, one red eye and a jump that covers half a street: by the time you hear it land, it is already on top of you.', voice: 'Thud. Thud. THUD.', image: 'https://arcraiders.wiki/w/images/thumb/e/ed/Leaper_Codex.png/400px-Leaper_Codex.png.webp' },
  hsr: { name: 'Kafka', title: 'The Stellaron Hunter', line: 'A violin, two pistols and a voice that tells you what to do: by the time you remember the order, you have already obeyed it.', voice: 'Good times never last.', audio: 'https://static.wikia.nocookie.net/houkai-star-rail/images/f/f1/VO_Kafka_Ultimate_-_Activate_01.ogg/revision/latest?cb=20240325085121', image: 'https://static.wikia.nocookie.net/houkai-star-rail/images/9/95/Character_Kafka_Splash_Art.png/revision/latest/scale-to-width-down/600?cb=20230809042240' },
  deadlock: { name: 'Haze', title: 'The Sleeping Dagger', line: 'A sleep dagger, a smoke bomb and two pistols that never stop: by the time the lane wakes up, she is already dancing through it.', voice: 'Sweet dreams.' },
  // Lace in Silksong's own art, singing (her voice from the game, Hollow Knight Wiki).
  hollowknight: { name: 'Lace', title: 'The Citadel’s Duellist', line: 'Small, white and laughing as she lunges: she guards the way to Pharloom’s Citadel, and every duel with her feels like a dance she has already won.', voice: '♪', audio: 'https://cdn.wikimg.net/en/hkwiki/images/4/4b/Lace_Sing.ogg', voiceClips: [{ line: '♪', audio: 'https://cdn.wikimg.net/en/hkwiki/images/4/4b/Lace_Sing.ogg' }, { line: '♪♪', audio: 'https://cdn.wikimg.net/en/hkwiki/images/8/86/Lace_Sing_02.ogg' }], image: 'https://cdn.wikimg.net/en/hkwiki/images/thumb/2/25/Lace.png/600px-Lace.png' },
  // Bakugo in his hero costume (the anime's 10th-anniversary profile art, My Hero Academia Wiki); his line from the
  // anime (myinstants), his clip his Howitzer Impact (Tenor, in CLIPS).
  mha: { name: 'Katsuki Bakugo', title: 'Ground Zero', line: 'Sweat like nitroglycerin and a temper to match: he swore he would be number one, and every explosion since has been a step towards it.', voice: 'Choke on my smoke!', audio: 'https://www.myinstants.com/media/sounds/choke-on-my-smoke-katsuki-bakugo.mp3', image: 'https://static.wikia.nocookie.net/bokunoheroacademia/images/1/19/Katsuki_Hero_Costume_Profile_%2810th_Anniversary%29.png/revision/latest?cb=20260509022123' },
  // Gon grown up all at once, the price of his vow against Pitou (the 2011 anime, Hunterpedia). No recording of his
  // line yet: the browser reads it.
  hxh: { name: 'Gon Freecss', title: 'The Price of a Vow', line: 'He gave away every bit of Nen he would ever have, all at once, to become the man who could avenge Kite: one fight, and nothing left after it.', voice: 'First comes rock!', image: 'https://static.wikia.nocookie.net/hunterxhunter/images/d/d6/Adult_Gon_Anime.png/revision/latest/scale-to-width-down/600?cb=20140527193545' },
  // Karlach on her Steam trading card (Larian's painted art, bg3.wiki); her lines from the game (myinstants).
  bg3: { name: 'Karlach', title: 'The Hellfire Heart', line: 'An infernal engine where her heart should be, an axe in each hand and the biggest smile in camp: she ran from Avernus, and she is not going back.', voice: 'Hey, soldier!', audio: 'https://www.myinstants.com/media/sounds/karlach-hey-soldier.mp3', voiceClips: [{ line: 'Hey, soldier!', audio: 'https://www.myinstants.com/media/sounds/karlach-hey-soldier.mp3' }, { line: 'Hell yes!', audio: 'https://www.myinstants.com/media/sounds/karlach-hell-yes.mp3' }, { line: 'Eat dirt!', audio: 'https://www.myinstants.com/media/sounds/karlach-eat-dirt.mp3' }], image: 'https://bg3.wiki/w/images/thumb/4/4b/Karlach_SteamCard.jpg/600px-Karlach_SteamCard.jpg.webp' },
  unreal: { name: 'Event BeginPlay', title: 'Where It All Begins', line: 'Every game ever shipped on the engine woke up right here: one red node, one white wire, and the whole world starts to run.', voice: 'Begin play.', image: UNREAL_ART.beginPlay },
};

/**
 * A second mythic for every franchise, added later (ids `<set>:mythic-2`): another star's special
 * edition, its picture the star's own card unless given. Doomfist's line is his own voice (the
 * Overwatch wiki's file, in French too); the others are read in the browser's voice. (Lines written for these cards;
 * titles and catchphrases from the franchises.)
 */
const MYTHICS_2: Record<string, { name: string; title: string; line: string; voice: string; audio?: string; voiceClips?: { line: string; audio: string }[]; voiceFr?: string; audioFr?: string; image?: string }> = {
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
  // Toph grown up, in colour (the Avatar Wiki's portrait of her around 110 AG); her voice is her own, from
  // the show (myinstants).
  avatar: {
    name: 'Toph',
    title: 'The Blind Bandit',
    line: 'She sees through her feet, wins every fight blindfolded — and invented metalbending at twelve.',
    voice: 'What are you doing, Twinkle Toes?',
    audio: 'https://www.myinstants.com/media/sounds/what-are-you-doing-twinkle-toes.mp3',
    image: 'https://static.wikia.nocookie.net/avatar/images/c/c6/Toph_Beifong_smiling.png/revision/latest?cb=20260812204616',
  },
  inazuma: { name: 'Axel Blaze', title: 'The Flame Striker', line: 'He spins, the ball catches fire, and the keeper never sees it coming.', voice: 'Fire Tornado!' },
  balatro: { name: 'Jimbo', title: 'Your Friend at the Table', line: 'He knows every seed, every shop and every hand you should have played, and he will tell you all about it.', voice: 'Hey there, friend!' },
  destiny: { name: 'Zavala', title: 'Commander of the Vanguard', line: 'The last wall between the City and the dark: a Titan who gets back up every single time.', voice: 'Guardians, make your stand.' },
  forhonor: { name: 'Commander Ravier', title: 'Sworn to the Cross', line: 'A kite shield, a heavy blade and a vow he never broke: the Blackstone’s fallen knight still stands between you and everyone he guards.', voice: 'Ad profundis!', audio: 'https://www.myinstants.com/media/sounds/ad-profundis.mp3', image: `${import.meta.env?.BASE_URL ?? './'}art/forhonor/black-prior-mythic.jpg` },
  forts: { name: 'Phantom', title: 'Now You See Me', line: 'No one ever finds his fort until its guns open up, and by then it has already moved on.', voice: 'You never saw me.', image: 'https://www.earthworkgames.com/wp-content/uploads/2025/09/Commander-Phantom.png' },
  jlpt: { name: 'Oni-Sensei', title: 'Final Exam', line: 'Red pen in hand, he has marked two thousand kanji wrong, one stroke at a time. Pass his exam and he finally smiles — once.', voice: 'Hajime!' },
  arcraiders: { name: 'Bastion', title: 'The Walking Fortress', line: 'Armour plates all round and guns that never seem to cool: the only way in is the glowing back plate, and it knows you know.', voice: 'Target acquired.', image: 'https://arcraiders.wiki/w/images/thumb/c/c5/Bastion_Codex.png/400px-Bastion_Codex.png.webp' },
  // Acheron in her splash art, a line picked each time she speaks (her own recordings from the wiki).
  hsr: { name: 'Acheron', title: 'The Rain at Dusk', line: 'One red blade, still sheathed, and a rain that never lets up: when she finally draws it, a whole world falls quiet.', voice: 'I weep for the departed...', audio: 'https://static.wikia.nocookie.net/houkai-star-rail/images/7/78/VO_Acheron_Ultimate_-_Activate_01.ogg/revision/latest?cb=20240327083125', voiceClips: [{ line: 'I weep for the departed...', audio: 'https://static.wikia.nocookie.net/houkai-star-rail/images/7/78/VO_Acheron_Ultimate_-_Activate_01.ogg/revision/latest?cb=20240327083125' }, { line: "Dusk's rain... it too shall fall.", audio: 'https://static.wikia.nocookie.net/houkai-star-rail/images/e/ed/VO_Acheron_Ultimate_-_Unleash_01.ogg/revision/latest?cb=20240327083613' }], image: 'https://static.wikia.nocookie.net/houkai-star-rail/images/7/78/Character_Acheron_Splash_Art.png/revision/latest/scale-to-width-down/600?cb=20240327021325' },
  // Zote, in his dream (Hollow Knight Wiki): the knight of 57 precepts, and the fans' favourite joke.
  hollowknight: { name: 'Zote', title: 'The Mighty', line: 'Fifty-seven precepts, one broken nail and not a single victory — and still the greatest knight in all of Hallownest, if you ask him.', voice: 'Precept One: Always Win Your Battles.', image: 'https://cdn.wikimg.net/en/hkwiki/images/c/c1/Zote_Dream.png' },
  // Todoroki's Flashfreeze Heatwave, ice and fire at once (the anime, My Hero Academia Wiki).
  mha: { name: 'Shoto Todoroki', title: 'Half-Cold Half-Hot', line: 'Ice on the right, fire on the left, and a father he swore never to become: the day he used both sides at once, the whole stadium felt the cold and the heat.', voice: 'Flashfreeze Heatwave!', image: 'https://static.wikia.nocookie.net/bokunoheroacademia/images/0/01/Flashfreeze_Heatwave.png/revision/latest/scale-to-width-down/600?cb=20260823031708' },
  // Hisoka and his Bungee Gum (the 2011 anime, Hunterpedia). No recording of his line yet: the browser reads it.
  hxh: { name: 'Hisoka', title: 'The Magician', line: 'A card trick, a smile and an aura that sticks like gum and stretches like rubber: he spares the strong so they can ripen, and comes back for them.', voice: 'Bungee Gum has the properties of both rubber and gum.', image: 'https://static.wikia.nocookie.net/hunterxhunter/images/8/81/Hisoka%27s_Bungee_Gum.png/revision/latest/scale-to-width-down/600?cb=20230524024239' },
  // Shadowheart on her Steam trading card (Larian's painted art, bg3.wiki); her lines are the game's own recordings
  // (bg3.wiki).
  bg3: { name: 'Shadowheart', title: 'The Moonlit Cleric', line: 'A cleric with a secret, a wound that will not heal and an artefact she would die before giving up: what she believes, she has never been allowed to choose.', voice: 'My faith protects me.', audio: 'https://bg3.wiki/w/images/f/f7/Shadowheart_Remark_Selected_My_faith_protects_me.wav', voiceClips: [{ line: 'My faith protects me.', audio: 'https://bg3.wiki/w/images/f/f7/Shadowheart_Remark_Selected_My_faith_protects_me.wav' }, { line: 'Wits and blade, always sharp.', audio: 'https://bg3.wiki/w/images/2/2c/Shadowheart_Remark_Selected_Wits_and_blade_always_sharp.wav' }, { line: "Whatever comes, I'm ready.", audio: 'https://bg3.wiki/w/images/7/74/Shadowheart_Remark_Selected_Whatever_comes_I%27m_ready.wav' }], image: 'https://bg3.wiki/w/images/thumb/d/dd/Shadowheart_SteamCard.jpg/600px-Shadowheart_SteamCard.jpg.webp' },
  // His own voice (Phil Morris), a line picked each time he speaks: the wiki's recordings.
  deadlock: { name: 'Infernus', title: 'The Afterburn', line: 'Napalm, a flaming dash and a burst of fire that stuns a whole team: wherever he walks, the street keeps burning behind him.', voice: "They don't need a bouncer when I'm tending bar!", audio: 'https://cdn.deadlock.wiki/Inferno_select_05.mp3', voiceClips: [{ line: "They don't need a bouncer when I'm tending bar!", audio: 'https://cdn.deadlock.wiki/Inferno_select_05.mp3' }, { line: "What'll it be today?", audio: 'https://cdn.deadlock.wiki/Inferno_select_01.mp3' }, { line: "Don't you worry, I got you.", audio: 'https://cdn.deadlock.wiki/Inferno_select_06.mp3' }, { line: "You're one of my regulars, aren't you?", audio: 'https://cdn.deadlock.wiki/Inferno_select_07.mp3' }, { line: "You got an eye for talent, I give you that.", audio: 'https://cdn.deadlock.wiki/Inferno_select_10.mp3' }, { line: "They'll be nothin' but ash when I'm through.", audio: 'https://cdn.deadlock.wiki/Inferno_upgrade_power3_03.mp3' }] },
  unreal: { name: 'Print String', title: 'Hello', line: 'The oldest debugger in the engine: when nothing else makes sense, it writes one cyan word in the corner and the truth comes out.', voice: 'Hello', image: UNREAL_ART.printString },
};

/**
 * The omnis, rarest of all: a franchise's legend in two forms. The first is theirs from the pack;
 * the second wakes once the franchise's guardian is beaten on Hard (Gear 4 → Gear 5, Super Saiyan →
 * Perfected Ultra Instinct). `image` left out: the character's own picture. (Lines written for
 * these cards; art from the fan wikis.)
 */
const OMNIS: Record<string, { name: string; title: string; line: string; image?: string; voice?: string; audio?: string; voiceClips?: { line: string; audio: string }[]; awaken?: { title: string; image: string; line: string } }> = {
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
  // ARC Raiders: the Matriarch in the codex's two pictures; on a Hard win, the other one.
  arcraiders: {
    name: 'Matriarch',
    title: 'Mother of the Swarm',
    line: 'Missiles in swarms, a shield for her brood and twenty-three thousand points of health: the ARC Raiders send whole squads after her, and most come back with nothing.',
    image: 'https://arcraiders.wiki/w/images/thumb/a/ad/Matriarch_Codex.png/400px-Matriarch_Codex.png.webp',
    awaken: {
      title: 'Brought Down',
      line: 'Her legs give way at last, and her core is open for the taking: the loot every Raider in Speranza dreams of.',
      image: 'https://arcraiders.wiki/w/images/thumb/4/49/ARC_Matriarch.png/400px-ARC_Matriarch.png.webp',
    },
  },
  // Deadlock: the Doorman (the owner's pick; it was Seven, the id stays, so no one loses a card), grinning
  // in the wiki's painted portrait; on a Hard win, the blue fire of his critical portrait.
  deadlock: {
    name: 'The Doorman',
    title: 'Concierge of the Cursed Apple',
    line: 'A call bell, a luggage cart and a door to anywhere in the city: every guest of the hotel is welcome, and none of them ever checks out.',
    image: 'https://cdn.deadlock.wiki/Doorman_Gloat.png',
    // His own voice from the game, a line picked each time he speaks (the wiki's recordings).
    voice: "I am at your service.",
    audio: 'https://cdn.deadlock.wiki/Doorman_select_01.mp3',
    voiceClips: [{ line: "I am at your service.", audio: 'https://cdn.deadlock.wiki/Doorman_select_01.mp3' }, { line: "I think you’ll find the service at The Baroness to be… exemplary.", audio: 'https://cdn.deadlock.wiki/Doorman_select_03.mp3' }, { line: "May your time in New York be unforgettable.", audio: 'https://cdn.deadlock.wiki/Doorman_select_05.mp3' }, { line: "Today will be a day unlike any other, I assure you.", audio: 'https://cdn.deadlock.wiki/Doorman_select_08.mp3' }, { line: "It’s important to never overlook the help.", audio: 'https://cdn.deadlock.wiki/Doorman_select_10.mp3' }, { line: "I’m afraid a doorman’s job is never done.", audio: 'https://cdn.deadlock.wiki/Doorman_unselect_01.mp3' }],
    awaken: {
      title: 'Last Call',
      line: 'The lights of the Cursed Apple go out, his eyes burn blue, and every door in the city opens on the same room.',
      image: 'https://cdn.deadlock.wiki/Doorman_Critical.png',
    },
  },
  // Honkai: Star Rail: Firefly in her splash art, in her own voice; on a Hard win, SAM, the armour she burns in
  // (the wiki's drawn art of the Stellaron Hunter).
  hsr: {
    name: 'Firefly',
    title: 'Glamoth’s Last Firefly',
    line: 'Born a weapon with a short life ahead, she wants one thing before it ends: to see what it is like to live a dream of her own.',
    image: 'https://static.wikia.nocookie.net/houkai-star-rail/images/3/38/Character_Firefly_Splash_Art.png/revision/latest/scale-to-width-down/600?cb=20241007220547',
    voice: 'Like fireflies to a flame... life begets death.',
    audio: 'https://static.wikia.nocookie.net/houkai-star-rail/images/e/eb/VO_Firefly_Ultimate_-_Activate_01.ogg/revision/latest?cb=20240619054242',
    voiceClips: [{ line: 'Like fireflies to a flame... life begets death.', audio: 'https://static.wikia.nocookie.net/houkai-star-rail/images/e/eb/VO_Firefly_Ultimate_-_Activate_01.ogg/revision/latest?cb=20240619054242' }, { line: 'I will fight for myself, until everything... burns to ashes!', audio: 'https://static.wikia.nocookie.net/houkai-star-rail/images/3/39/VO_Firefly_Ultimate_-_Unleash_01.ogg/revision/latest?cb=20240619054245' }, { line: 'Prime, detonate!', audio: 'https://static.wikia.nocookie.net/houkai-star-rail/images/4/40/VO_Firefly_Skill_02.ogg/revision/latest?cb=20240619054206' }],
    awaken: {
      title: 'Stellaron Hunter: SAM',
      line: 'The armour closes, the green flame catches, and for a few minutes she burns brighter than anything Destruction ever made.',
      image: 'https://static.wikia.nocookie.net/houkai-star-rail/images/3/38/Enemy_Stellaron_Hunter_Sam.png/revision/latest/scale-to-width-down/600?cb=20260725083218',
    },
  },
  // Ufouria: O-Chan cheering (the official site's art); on a Hard win, flying over the Earth (the key art).
  ufouria: {
    name: 'O-Chan',
    title: 'The Cat-Suit Friend',
    line: 'The first friend Utsujin’s Bumyon took over, and the first one Hebe had to fight to bring back. She can’t hold back any longer!',
    image: UFOURIA_ART('dance-o-chan.png'),
    // Her voice: her singing, from the owner's game captures (her clips: see FIRST_CLIPS) — never the browser's voice.
    voice: '♪',
    audio: UFOURIA_SOUND('o-chan-singing'),
    awaken: {
      title: 'Over the Earth',
      line: 'Saucer gone, Bumyon cleaned up: O-Chan floats above the whole world, Hebe and the others beside her.',
      image: UFOURIA_ART('o-chan-space.jpg'),
    },
  },
  // Hollow Knight and Silksong: Hornet in Silksong's own art (Hollow Knight Wiki), in her own voice — a line picked
  // each time she speaks (the game's recordings, from myinstants: the 🔊 button). Her clip (CLIPS) is heard with its
  // own sound behind a win (clipSound, in STRONG). No second form, so her clip plays behind a win from the start.
  hollowknight: {
    name: 'Hornet',
    title: 'Princess-Protector',
    line: 'Needle, thread and a cry no bug forgets: she guarded the ruins of Hallownest, then was taken to Pharloom and climbed the whole kingdom to its Citadel.',
    image: 'https://cdn.wikimg.net/en/hkwiki/images/thumb/e/ed/Hornet_%28Silksong%29.png/700px-Hornet_%28Silksong%29.png',
    voice: 'Shaw!',
    audio: 'https://www.myinstants.com/media/sounds/hollow-knight-hornet-voice-11.mp3',
    voiceClips: [
      { line: 'Shaw!', audio: 'https://www.myinstants.com/media/sounds/hollow-knight-hornet-voice-11.mp3' },
      { line: 'Edino!', audio: 'https://www.myinstants.com/media/sounds/hornet_edino.mp3' },
      { line: 'Git gud!', audio: 'https://www.myinstants.com/media/sounds/hornet_gitgud.mp3' },
      { line: 'Garama!', audio: 'https://www.myinstants.com/media/sounds/hollow-knight-hornet-voice-2-3.mp3' },
    ],
  },
  // My Hero Academia: All Might's United States of Smash, his last blow against All For One (the anime, My Hero
  // Academia Wiki). His clip is that very blow (Tenor, silent, in CLIPS), so his voice line is its cry, "United States
  // of Smash!" (myinstants); his other lines for the 🔊 button.
  mha: {
    name: 'All Might',
    title: 'The Symbol of Peace',
    line: 'A smile that tells everyone they are safe, and a fist that moves the weather: he carried a whole society on his back, then passed the torch to a Quirkless boy.',
    image: 'https://static.wikia.nocookie.net/bokunoheroacademia/images/a/a5/United_States_of_Smash.png/revision/latest/scale-to-width-down/600?cb=20260824033549',
    voice: 'United States of Smash!',
    audio: 'https://www.myinstants.com/media/sounds/united-states-of-smash-my-hero-academia-mp3cut.mp3',
    voiceClips: [
      { line: 'United States of Smash!', audio: 'https://www.myinstants.com/media/sounds/united-states-of-smash-my-hero-academia-mp3cut.mp3' },
      { line: 'I am here!', audio: 'https://www.myinstants.com/media/sounds/all_might_i_am_here.mp3' },
      { line: 'Go beyond! Plus Ultra!', audio: 'https://www.myinstants.com/media/sounds/plus-ultrrraaaaaaaaaaaaaaaaaaa-dub.mp3' },
    ],
  },
  // Hunter x Hunter: Killua in Godspeed, against Youpi (the 2011 anime, Hunterpedia); his clip is Godspeed too (Tenor,
  // silent, in CLIPS). No recording of his line yet: the browser reads it.
  hxh: {
    name: 'Killua Zoldyck',
    title: 'Godspeed',
    line: 'Raised to kill, he turned his aura into lightning and his body into a reflex faster than thought: Whirlwind, Speed of Lightning, and a best friend he would cross the world for.',
    image: 'https://static.wikia.nocookie.net/hunterxhunter/images/d/d0/2011_EP119_Killua_Godspeed.png/revision/latest/scale-to-width-down/600?cb=20230821203012',
    voice: 'Gon, you are light.',
  },
  // Baldur's Gate 3: Astarion on his Steam trading card (Larian's painted art, bg3.wiki). His clip is the game's
  // footage of him (Tenor, silent, in CLIPS), with his "Darling." from the game on top (myinstants).
  bg3: {
    name: 'Astarion',
    title: 'The Vampire Spawn',
    line: 'Two centuries a slave to Cazador, and one tadpole later he can walk in the sun: a smile, a dagger and a hunger he no longer has to hide, darling.',
    image: 'https://bg3.wiki/w/images/thumb/0/00/Astarion_SteamCard.jpg/600px-Astarion_SteamCard.jpg.webp',
    voice: 'Darling.',
    audio: 'https://www.myinstants.com/media/sounds/darling-astarion.mp3',
  },
  onepiece: {
    name: 'Monkey D. Luffy',
    // The owner's call: Gear 5 in both forms (his first form was Gear 4): the same picture and clip.
    title: 'Gear Fifth',
    line: 'The drums of liberation beat in his chest: he laughs, and the fight turns into a cartoon only he can draw.',
    image: `${import.meta.env?.BASE_URL ?? './'}art/onepiece/luffy-gear-5.webp`,
    awaken: {
      title: 'Gear Fifth: Joy Boy',
      line: 'The drums of liberation, at last: he laughs, and the whole world bends like rubber with him.',
      // The owner's pick: Gear 5, laughing (uhdpaper, kept in the site).
      image: `${import.meta.env?.BASE_URL ?? './'}art/onepiece/luffy-gear-5.webp`,
    },
  },
  dbz: {
    name: 'Goku',
    title: 'The Legendary Super Saiyan',
    line: 'Golden hair, green eyes, a fury born on Namek — the legend everyone said was a myth.',
    image: 'https://static.wikia.nocookie.net/dragonball/images/8/81/Sparkling_Super_Saiyan_Goku.png/revision/latest/scale-to-width-down/500?cb=20180902154929',
    awaken: {
      title: 'Perfected Ultra Instinct',
      line: 'Silver light, a silent mind: the technique even the gods struggle to master, finally his.',
      // The owner's pick: Mastered Ultra Instinct in his aura (wallpapercave, kept in the site).
      image: `${import.meta.env?.BASE_URL ?? './'}art/dbz/goku-ultra-instinct.webp`,
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
    // The owner's picks: the picture (Dexerto, kept in the site) and 12:44 to 13:13 of Lightfall's cutscenes, its
    // clip in both forms and its voice (it speaks there).
    image: `${import.meta.env?.BASE_URL ?? './'}art/destiny/the-witness.webp`,
    voice: '*The Witness speaks*',
    audio: `${import.meta.env?.BASE_URL ?? './'}clips/destiny/the-witness-30fps.mp4`,
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
const STRONG: Record<string, Partial<Pick<Card, 'image' | 'title' | 'voice' | 'audio' | 'focus' | 'clipSound'>>> = {
  // ── First mythics ──
  'lol:mythic': { title: 'Prestige K/DA', image: 'https://static.wikia.nocookie.net/leagueoflegends/images/f/fc/Ahri_PrestigeKDALoading.jpg/revision/latest?cb=20230110233703' },
  'overwatch:mythic': { title: 'Graffiti', image: 'https://static.wikia.nocookie.net/overwatch_gamepedia/images/1/19/Tracer_Skin_Graffiti.png/revision/latest/scale-to-width-down/500?cb=20170526223356' },
  'naruto:mythic': { image: 'https://static.wikia.nocookie.net/naruto/images/4/42/Naruto_Part_III.png/revision/latest/scale-to-width-down/500?cb=20180117103539' },
  'genshin:mythic': { title: 'Red Dead of Night', image: 'https://static.wikia.nocookie.net/gensin-impact/images/2/29/Character_Diluc_Red_Dead_of_Night_Full_Wish.png/revision/latest/scale-to-width-down/500?cb=20220801021754' },
  'inazuma:mythic': { voice: 'God Hand!', audio: 'https://static.wikia.nocookie.net/inazuma-eleven/images/0/02/%28IE%29_God_Hand.mp4/revision/latest?cb=20240420164350', image: 'https://static.wikia.nocookie.net/inazuma-eleven/images/a/a7/Endou_Mamoru_%28Orion%29.png/revision/latest/scale-to-width-down/500?cb=20210926134601' },
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
  'wow:mythic-2': { audio: 'https://www.myinstants.com/media/sounds/for-the-horde-orc.mp3', image: 'https://warcraft.wiki.gg/images/thumb/Thrall_HotS_World-Shaman.jpg/500px-Thrall_HotS_World-Shaman.jpg?543732' },
  'inazuma:mythic-2': { audio: 'https://static.wikia.nocookie.net/inazuma-eleven/images/4/48/%28IE_%28007%29%29_Fire_Tornado.mp4/revision/latest?cb=20240602210604', image: 'https://static.wikia.nocookie.net/inazuma-eleven/images/d/d0/Gouenji_Shuuya_%28Orion%29.png/revision/latest/scale-to-width-down/500?cb=20190912000534' },
  // ── Omnis: their voices ──
  'lol:omni': { voice: 'A chase, then!', audio: 'https://static.wikia.nocookie.net/leagueoflegends/images/e/ef/Ahri_SpiritBlossom_R_1.ogg/revision/latest?cb=20200726232639' },
  'overwatch:omni': { voice: 'Heroes never die!', audio: 'https://static.wikia.nocookie.net/overwatch_gamepedia/images/a/ac/Mercy_-_Heroes_never_die.ogg/revision/latest?cb=20230914114913' },
  'minecraft:omni': { voice: '*BOOM*', audio: 'https://minecraft.wiki/images/Explosion1.ogg?6ed29' },
  // Luffy: his clip (Gear 5's Gum Gum lightning) is heard with its own sound behind a win (the owner's call); his voice
  // line stays for the card's 🔊 button.
  'onepiece:omni': { voice: 'Gomu Gomu no…!', audio: 'https://www.myinstants.com/media/sounds/gomu-gomu-no.mp3', clipSound: true },
  'dbz:omni': { voice: 'Kamehameha!', audio: 'https://www.myinstants.com/media/sounds/kamehameha_qWZSJCi.mp3', clipSound: true },
  'naruto:omni': { voice: 'Rasengan!', audio: 'https://www.myinstants.com/media/sounds/naruto-rasengan-voice.mp3' },
  'starwars:omni': { voice: 'You underestimate my power!', audio: 'https://www.myinstants.com/media/sounds/you-underestimate-my-power_cN70zP4.mp3' },
  'harrypotter:omni': { voice: 'Expelliarmus!' },
  'lotr:omni': { voice: 'You shall not pass!', audio: 'https://www.myinstants.com/media/sounds/gandalf_shallnotpass.mp3' },
  'mcu:omni': { voice: 'I am Iron Man.', audio: 'https://www.myinstants.com/media/sounds/ironman_Qaec4ow.mp3' },
  'genshin:omni': { voice: 'Tiān dòng wàn xiàng!', audio: 'https://static.wikia.nocookie.net/gensin-impact/images/d/d0/VO_ZH_Zhongli_Elemental_Burst_03.ogg/revision/latest?cb=20221113225313' },
  'wow:omni': { voice: 'Frostmourne hungers.', audio: 'https://www.myinstants.com/media/sounds/evilarthasyes2.mp3' },
  // Mark Evans awakened: his clip is God Catch (the golden god rising out of the clouds), so is his voice — the anime's shout of it (episode 127, from the Inazuma Eleven Wiki's own video of the technique).
  'inazuma:omni': { voice: 'God Catch!', audio: 'https://static.wikia.nocookie.net/inazuma-eleven/images/f/f9/%28IE_%28127%29%29_God_Catch_G5.mp4/revision/latest?cb=20241015044228#t=8.3,10.6' },
  'avatar:omni': { voice: 'Yip yip!', clipSound: true },
  // ── Recordings added to the Mythics and Omnis that only had a written line (the browser read it) ──
  // Shouts and cries as each game has them: myinstants (labelled), the Deadlock Wiki's own voice files, and the
  // Inazuma Eleven Wiki's clips of the anime (a special move named as it's used).
  'smash:omni': { voice: 'Hyaah!', audio: 'https://www.myinstants.com/media/sounds/ww_link_hwah.mp3' },
  'forts:omni': { voice: '*BOOM*', audio: 'https://www.myinstants.com/media/sounds/cannon-soundbible_5xh1Wvy.mp3' },
  'deadlock:mythic': { voice: 'Sleep well.', audio: 'https://cdn.deadlock.wiki/Haze_unselect_05.mp3' },
  'balatro:mythic': { audio: 'https://www.myinstants.com/media/sounds/jimbo-voice-balatro.mp3' },
  'balatro:mythic-2': { audio: 'https://www.myinstants.com/media/sounds/jimbo-voice-balatro.mp3' },
  // Hornet: her clip is heard with its own sound behind a win (the owner's call); her voice lines stay for the 🔊 button.
  'hollowknight:omni': { clipSound: true },
  'arcraiders:mythic-2': { audio: 'https://www.myinstants.com/media/sounds/arc-raiders-bastion-lock-on.mp3' },
  'hollowknight:mythic-2': { audio: 'https://www.myinstants.com/media/sounds/zote-war-cry.mp3' },
  'destiny:mythic-2': { voice: 'Indeed.', audio: 'https://www.myinstants.com/media/sounds/indeed_zavala_boosted.mp3' },
  'balatro:omni': { voice: '♪', audio: `${import.meta.env?.BASE_URL ?? './'}clips/balatro/the-soul.mp4` },
  // Toph's picture is wider than tall: the round avatar icon frames her face.
  'avatar:mythic-2': { focus: { x: 40, y: 32, zoom: 1 } },
  'avatar:mythic-sokka': { focus: { x: 50, y: 22, zoom: 1 } },
  // ── Forts: the Armoured Door's only picture is a screenshot — framed on the door. (The rest have the
  // Forts RTS Wiki's own art, in src/data/bosses.json.) ──
  'forts:armoured-door': { focus: { x: 50, y: 55, zoom: 1.5 } },
};

/**
 * Single cards added later, each with an id of its own: a favourite of the franchise again, at a
 * higher rarity, in another pose (the Howitzer, close up and firing, from the studio's art).
 */
const EXTRA: (Pick<Card, 'id' | 'name' | 'image' | 'rarity' | 'title' | 'description' | 'place' | 'voice' | 'audio'> & { set: string })[] = [
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
  // Avatar's third mythic: Sokka as the Water Tribe's mightiest warrior (the owner's picture, served with the site).
  {
    set: 'avatar',
    id: 'avatar:mythic-sokka',
    name: 'Sokka',
    rarity: 'mythic',
    title: 'The Mightiest Warrior',
    image: `${import.meta.env?.BASE_URL ?? './'}art/avatar/sokka-mythic.webp`,
    description: 'No bending, just a boomerang, a sword and a plan for everything — and in the stories told about him, he’s twice the size and three times the hero.',
    voice: 'It’s the quenchiest!',
    // His clip's own sound (a ticket: the cactus-juice line wasn't his clip's).
    audio: `${import.meta.env?.BASE_URL ?? './'}clips/avatar/sokka.mp4`,
  },
  // Inazuma Eleven's places: its stadiums, schools and the steel tower, in the anime's art (the Inazuma Eleven Wiki).
  { set: 'inazuma', id: 'inazuma:place-steel-tower-plaza', name: "Steel Tower Plaza", rarity: 'mythic', title: "Where It All Began", place: true, image: 'https://static.wikia.nocookie.net/inazuma-eleven/images/6/65/%28IE_%28001%29%29_Steel_Tower.png/revision/latest/scale-to-width-down/600?cb=20260628144331', description: "The red steel tower on the hill above Inazuma Town, at sunset: where a boy trained alone with a tyre on a rope until the whole team came to find him." },
  { set: 'inazuma', id: 'inazuma:place-titanic-stadium', name: "Titanic Stadium", rarity: 'mythic', title: "The World Final", place: true, voice: '*The crowd roars*', audio: 'https://www.myinstants.com/media/sounds/crowd-chanting-at-stadium.mp3', image: 'https://static.wikia.nocookie.net/inazuma-eleven/images/3/3b/Titanic_Stadium.png/revision/latest/scale-to-width-down/600?cb=20170113221223', description: "The great stadium of Liocott Island, raised over the sea for the final of the Football Frontier International: the whole world watching one match." },
  { set: 'inazuma', id: 'inazuma:place-football-frontier-stadium', name: "Football Frontier Stadium", rarity: 'legendary', place: true, image: 'https://static.wikia.nocookie.net/inazuma-eleven/images/9/93/Football_Frontier_Stadium.png/revision/latest/scale-to-width-down/600?cb=20130530114730', description: "The stage of the national tournament, where every junior high team in Japan dreams of playing the final." },
  { set: 'inazuma', id: 'inazuma:place-holy-road-stadium', name: "Holy Road Stadium", rarity: 'legendary', place: true, image: 'https://static.wikia.nocookie.net/inazuma-eleven/images/e/ef/Holy_Road_Stadium.png/revision/latest/scale-to-width-down/600?cb=20171129141014', description: "The great stadium of the Holy Road, where Raimon played for the freedom of soccer itself." },
  { set: 'inazuma', id: 'inazuma:place-raimon-junior-high', name: "Raimon Junior High", rarity: 'epic', place: true, image: 'https://static.wikia.nocookie.net/inazuma-eleven/images/0/00/%28IE_%28001%29%29_Raimon%27s_Main_Building.png/revision/latest/scale-to-width-down/600?cb=20260628144235', description: "The school with the lightning bolt over its gate, and a soccer club that once had too few players to field a team." },
  { set: 'inazuma', id: 'inazuma:place-zeus-stadium', name: "Zeus Stadium", rarity: 'epic', place: true, image: 'https://static.wikia.nocookie.net/inazuma-eleven/images/7/71/%28IE_%28024%29%29_Zeus_Stadium.png/revision/latest/scale-to-width-down/600?cb=20210302133632', description: "A stadium in the sky, built for Zeus: the Football Frontier final was played up among the clouds." },
  { set: 'inazuma', id: 'inazuma:place-god-eden', name: "God Eden", rarity: 'epic', place: true, image: 'https://static.wikia.nocookie.net/inazuma-eleven/images/0/03/God_Eden.png/revision/latest/scale-to-width-down/600?cb=20170504195638', description: "Fifth Sector’s island, far out at sea, where the most dangerous players were trained apart from the world." },
  { set: 'inazuma', id: 'inazuma:place-liocott-island', name: "Liocott Island", rarity: 'epic', place: true, image: 'https://static.wikia.nocookie.net/inazuma-eleven/images/4/40/Liocott_Island.png/revision/latest/scale-to-width-down/600?cb=20231025232816', description: "The island built for the Football Frontier International, each of its areas made to look like a team’s home country." },
  { set: 'inazuma', id: 'inazuma:place-royal-academy', name: "Royal Academy", rarity: 'rare', place: true, image: 'https://static.wikia.nocookie.net/inazuma-eleven/images/5/5c/%28IE_%28012%29%29_TG%27s_entrance.png/revision/latest/scale-to-width-down/600?cb=20240513175715', description: "Forty years of national titles behind these walls: the champions everyone in Japan had to beat." },
  { set: 'inazuma', id: 'inazuma:place-alius-academy', name: "Alius Academy", rarity: 'rare', place: true, image: 'https://static.wikia.nocookie.net/inazuma-eleven/images/b/b3/%28IE_%28060%29%29_Aliea_Gakuen.png/revision/latest/scale-to-width-down/600?cb=20230816163843', description: "The base the “aliens” came from, hidden at the foot of Mount Fuji." },
  { set: 'inazuma', id: 'inazuma:place-raimon-soccer-clubroom', name: "Raimon Soccer Clubroom", rarity: 'rare', place: true, image: 'https://static.wikia.nocookie.net/inazuma-eleven/images/d/d8/%28IE_%28001%29%29_Raimon_Soccer_Club.png/revision/latest/scale-to-width-down/600?cb=20240804154302', description: "The old wooden shed behind the school, where a club of almost nobody kept its name on the door." },
  { set: 'inazuma', id: 'inazuma:place-alpine-junior-high', name: "Alpine Junior High", rarity: 'rare', place: true, image: 'https://static.wikia.nocookie.net/inazuma-eleven/images/1/18/Hakuren.png/revision/latest/scale-to-width-down/600?cb=20210902122658', description: "A snowy school in Hokkaido, with a pitch in the mountains and the striker who could freeze the ball." },
  { set: 'inazuma', id: 'inazuma:place-ragnarok-stadium', name: "Ragnarok Stadium", rarity: 'rare', place: true, image: 'https://static.wikia.nocookie.net/inazuma-eleven/images/2/2a/Ragnarok_Stadium.png/revision/latest/scale-to-width-down/600?cb=20170504200142', description: "The stadium of the future, where the fate of soccer across time was decided." },
  { set: 'inazuma', id: 'inazuma:place-the-riverbank', name: "The Riverbank", rarity: 'common', place: true, image: 'https://static.wikia.nocookie.net/inazuma-eleven/images/6/6b/Riverbank.png/revision/latest/scale-to-width-down/600?cb=20240803110451', description: "The pitch on the river’s edge in Inazuma Town, where the team trains when the school ground is taken." },
  { set: 'inazuma', id: 'inazuma:place-raimon-ground', name: "Raimon Ground", rarity: 'common', place: true, image: 'https://static.wikia.nocookie.net/inazuma-eleven/images/7/7d/%28IE_%28001%29%29_Raimon_Ground.png/revision/latest/scale-to-width-down/600?cb=20260628144406', description: "Raimon’s own school ground, where the soccer club had to fight the other clubs for room to train." },
  { set: 'inazuma', id: 'inazuma:place-inazuma-town', name: "Inazuma Town", rarity: 'common', place: true, image: 'https://static.wikia.nocookie.net/inazuma-eleven/images/9/91/Inazuma_Town.png/revision/latest/scale-to-width-down/600?cb=20121229234139', description: "The hometown: the river, the steel tower and the school, all in one view." },
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
  // Movie Steve: "Steve's Lava Chicken", 0:23 to 0:42 (the owner's cut; it's his voice too: heard from the clip).
  'minecraft:omni-steve': `${import.meta.env?.BASE_URL ?? './'}clips/minecraft/steve-30fps.mp4`,
  // ── Clips for the Mythics that had none (Tenor; ARC Raiders from YouTube: its official launch trailer, and a
  // showcase of the Matriarch; Victor Blade from the Inazuma Eleven Wiki, heard with its sound) ──
  'dbz:mythic-vegito': 'https://media.tenor.com/gn-zNRi495MAAAPo/vegetto-ssj-blue-final-kamehameha.mp4',
  'inazuma:mythic-victor-blade': 'https://static.wikia.nocookie.net/inazuma-eleven/images/8/83/%28GO_%28001%29%29_Death_Sword.mp4/revision/latest?cb=20240323211654',
  'arcraiders:mythic': 'https://media.tenor.com/dv19A6pPFuUAAAPo/leaper-jump.mp4',
  // The Bastion's red targeting laser sweeping the Raiders (launch trailer, 0:57).
  'arcraiders:mythic-2': `${import.meta.env?.BASE_URL ?? './'}clips/arcraiders/bastion.mp4`,
  'arcraiders:mythic-matriarch': `${import.meta.env?.BASE_URL ?? './'}clips/arcraiders/matriarch.mp4`,
  'arcraiders:mythic-queen': 'https://media.tenor.com/qkK_T04llkEAAAPo/arc-raiders.mp4',
  'arcraiders:mythic-raider': 'https://media.tenor.com/wMVUVb4SmycAAAPo/arc-raiders-arc-raider.mp4',
  'deadlock:mythic-seven': 'https://media.tenor.com/3l3u2YdpidAAAAPo/seven-ultimate-seven-deadlock.mp4',
  'balatro:mythic': 'https://media.tenor.com/3fCNP48JN4kAAAPo/balatro-perkeo.mp4',
  'balatro:mythic-2': 'https://media.tenor.com/vyL0YDXO34sAAAPo/balatro-jimbo.mp4',
  'unreal:mythic': 'https://media.tenor.com/ldSMvl-h61wAAAPo/unreal-engine-editor.mp4',
  'jlpt:mythic': 'https://media.tenor.com/6y_x59L0fNEAAAPo/pixel-art.mp4',
  'jlpt:mythic-2': 'https://media.tenor.com/LVV2rkspHvYAAAPo/oni-mask.mp4',
  'unreal:mythic-2': 'https://media.tenor.com/kxZgL7zPf0EAAAPo/hello-world.mp4',
  'forts:mythic-2': 'https://media.tenor.com/Z5O1lUnK9e0AAAPo/forts-forts-game.mp4',
  'hsr:mythic': 'https://media.tenor.com/v-XMz_8voHIAAAPo/kafka-honkai-star-rail.mp4',
  'hsr:mythic-2': 'https://media.tenor.com/kEOuplrdMIAAAAPo/acheron-honkai-star-rail.mp4',
  'hollowknight:mythic': 'https://media.tenor.com/bm0FsIEEUjsAAAPo/silksong-lace.mp4',
  'hollowknight:mythic-2': 'https://media.tenor.com/ws4DOxdUm0wAAAPo/zote-hollow-knight.mp4',
  // Haze's Bullet Dance (a player's capture, no interface on screen) and Oryx's Taken sweeping over the Cabal (The
  // Taken King's official cinematic trailer, 0:50).
  'deadlock:mythic': `${import.meta.env?.BASE_URL ?? './'}clips/deadlock/haze.mp4`,
  'destiny:mythic-oryx': `${import.meta.env?.BASE_URL ?? './'}clips/destiny/oryx.mp4`,
  'inazuma:place-steel-tower-plaza': 'https://media.tenor.com/AzaMQlLah0oAAAPo/inazuma-eleven.mp4',
  'inazuma:place-titanic-stadium': 'https://media.tenor.com/2dDRZieIXqQAAAPo/inazuma-eleven-stadium.mp4',
  // Awakened Omnis: Firefly as SAM, blazing; Acheron's blade drawn at last.
  'hsr:omni': 'https://media.tenor.com/V2G-sDi8ZhIAAAPo/firefly-honkai.mp4',
  'hsr:omni-acheron': 'https://media.tenor.com/pglpLmfus3cAAAPo/acheron-ultimate.mp4',
  'onepiece:mythic': 'https://media.tenor.com/E-EofnlEKOYAAAP1/egghead-one-piece.mp4',
  // Luffy awakened: the owner's pick, Gear 5's Gum Gum lightning (Crunchyroll FR), its first 32 s, heard with its own sound.
  'onepiece:omni': `${import.meta.env?.BASE_URL ?? './'}clips/onepiece/luffy-gear-5.mp4`,
  'onepiece:mythic-2': 'https://media.tenor.com/1Rie5-nbCN8AAAPo/king-of-hell-zoro-zoro-one-piece.mp4',
  'dbz:mythic': 'https://media.tenor.com/6KICR9VojUkAAAP1/son-goku.mp4',
  // Goku awakened (Perfected Ultra Instinct): the owner's pick, Mastered Ultra Instinct against Jiren (0:19–0:41), heard.
  'dbz:omni': `${import.meta.env?.BASE_URL ?? './'}clips/dbz/goku-ultra-instinct-30fps.mp4`,
  'dbz:mythic-2': 'https://media.tenor.com/z496xO1AN8kAAAP1/vegeta-ultra-ego-vegeta.mp4',
  // The owner's own capture of his Kamehameha (YouTube won't embed it): H.264, 720p at 60 fps, with its sound (heard behind a win).
  'dbz:omni-gogeta': `${import.meta.env?.BASE_URL ?? './'}clips/dbz/gogeta-kamehameha.mp4`,
  // Broly's scream (the owner's BrolyScream): the same moment is his voice, heard from the clip. It stops before the
  // video's end (10.2 s), where YouTube would show its end screen.
  'dbz:mythic-broly': `${import.meta.env?.BASE_URL ?? './'}clips/dbz/broly.mp4`,
  // Hollow Knight and Silksong: Hornet in Silksong (a 4K capture of the Bellhart scene, Sirloin), silent — her own voice
  // plays over it; the other three Omnis' clips are their voices too, each a moment of the game heard with its sound.
  // Hornet: the owner's pick, 7:07 to 7:24 of this video, heard with its own sound (clipSound, in STRONG).
  'hollowknight:omni': `${import.meta.env?.BASE_URL ?? './'}clips/hollowknight/hornet.mp4`,
  'hollowknight:omni-hollow-knight': `${import.meta.env?.BASE_URL ?? './'}clips/hollowknight/the-hollow-knight.mp4`,
  'hollowknight:omni-radiance': `${import.meta.env?.BASE_URL ?? './'}clips/hollowknight/radiance.mp4`,
  'hollowknight:omni-grimm': `${import.meta.env?.BASE_URL ?? './'}clips/hollowknight/grimm.mp4`,
  'hollowknight:omni-nightmare-king-grimm': `${import.meta.env?.BASE_URL ?? './'}clips/hollowknight/nightmare-king-grimm.mp4`,
  // My Hero Academia, Baldur's Gate 3 and Hunter x Hunter (Tenor, silent loops; their voice lines play on top):
  // Bakugo's Howitzer Impact, Todoroki's fire, All Might's United States of Smash; Karlach in a fight, Shadowheart by
  // candlelight, Astarion with his sword; Gon grown up in his aura, Hisoka's Bungee Gum, Killua in Godspeed.
  'mha:mythic': 'https://media.tenor.com/PCfS-zIaquAAAAPo/katsuki-bakugo-howitzer-impact.mp4',
  'mha:mythic-2': 'https://media.tenor.com/pPAHY9q0PqAAAAPo/anime-todoroki.mp4',
  'mha:omni': 'https://media.tenor.com/ZRDPXCwLXcIAAAPo/all-might-united-states-of-smash.mp4',
  'bg3:mythic': 'https://media.tenor.com/PKXMDZh5R5sAAAPo/baldurs-gate-3-karlach.mp4',
  'bg3:mythic-2': 'https://media.tenor.com/12wZ7IQ7hnkAAAPo/shadowheart-baldurs-gate-3.mp4',
  'bg3:omni': 'https://media.tenor.com/tPOQ-U0y--sAAAPo/astarion-baldurs-gate-3.mp4',
  'hxh:mythic': 'https://media.tenor.com/P_8hJLKYGEsAAAPo/adult-gon.mp4',
  'hxh:mythic-2': 'https://media.tenor.com/xD1ikFO7Fx4AAAPo/hisoka-hunter-x-hunter.mp4',
  'hxh:omni': 'https://media.tenor.com/6cu5bNft-XMAAAPo/killua-godspeed.mp4',
  'naruto:mythic': 'https://media.tenor.com/wXznpWHYodIAAAPo/hokage-good.mp4',
  'naruto:omni': 'https://media.tenor.com/uiGaKw6MQuMAAAP1/hh.mp4',
  'naruto:mythic-2': 'https://media.tenor.com/-fuuxopk9WwAAAPo/sasuke-susano.mp4',
  'starwars:mythic': 'https://media.tenor.com/AOUl2bhSY4cAAAP1/yoda-fight.mp4',
  'starwars:omni': 'https://media.tenor.com/a1VrRecyJjQAAAP1/vader-natode-vader.mp4',
  'starwars:mythic-2': 'https://media.tenor.com/nwBMOVfhuS0AAAPo/darth-vader-im-ready.mp4',
  'harrypotter:mythic': 'https://media.tenor.com/wt7eXX5sQxoAAAP1/hp-harry-potter.mp4',
  'harrypotter:omni': 'https://media.tenor.com/_Po2TZKmqLkAAAPo/elder-wand-harry-potter.mp4',
  'harrypotter:mythic-2': 'https://media.tenor.com/i0J9xP3hu8QAAAPo/stupefy-hermione-granger.mp4',
  'lotr:mythic': `${import.meta.env?.BASE_URL ?? './'}clips/gif/lotr-mythic.mp4`,
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
  // Arion awakened: Saikyou Eleven Hadou, Mixi Maxed with Arthur, to its title (a silent loop: his voice is the anime's shout of it).
  'inazuma:omni-arion': 'https://media.tenor.com/MfYrbE0etqAAAAP1/inazuma-eleven-ie11.mp4',
  // The howitzer, from the game's own TikTok (@fortsgame, 0:01–0:05).
  'forts:mythic': `${import.meta.env?.BASE_URL ?? './'}clips/forts/howitzer.mp4`,
  'forts:omni': 'https://media.tenor.com/nLDwdFO48t0AAAP1/get-on-forts-forts.mp4',
  'forhonor:mythic': `${import.meta.env?.BASE_URL ?? './'}clips/gif/forhonor-mythic.mp4`,
  // Black Prior's "Ad profundis!", three times over (clips served with the site, cut from the owner's compilation).
  // Hebe: the owner's game captures, one after the other (O-Chan's are her first form's: FIRST_CLIPS).
  'ufouria:mythic': UFOURIA_CLIP(['hebe-idle', 'hebe-dancing']),
  'forhonor:mythic-2': [1, 2, 3].map((n) => `${import.meta.env?.BASE_URL ?? './'}clips/forhonor/black-prior-ad-profundis-${n}.mp4`).join('|'),
  'avatar:mythic': 'https://media.tenor.com/C8qZIVmxzNEAAAPo/firebend-atla.mp4',
  // Aang awakened (Avatar State): the owner's pick, Aang Goes Super Saiyan from the 2026 film (Movieclips, 0:00–0:26), heard.
  'avatar:omni': `${import.meta.env?.BASE_URL ?? './'}clips/avatar/aang-avatar-state.mp4`,
  // Toph and Sokka: the owner's own clips (YouTube, unlisted), played whole.
  'avatar:mythic-2': `${import.meta.env?.BASE_URL ?? './'}clips/avatar/toph.mp4`,
  // (Sokka's whole clip, with its own sound as his voice line, below.)
  'avatar:mythic-sokka': `${import.meta.env?.BASE_URL ?? './'}clips/avatar/sokka.mp4`,
  'avatar:omni-sokka': `${import.meta.env?.BASE_URL ?? './'}clips/avatar/sokka.mp4`,
  'destiny:mythic': 'https://media.tenor.com/NLIpsly4D30AAAP1/cayde6-nicecock.mp4',
  'destiny:omni': `${import.meta.env?.BASE_URL ?? './'}clips/destiny/the-witness-30fps.mp4`,
  'destiny:mythic-2': 'https://media.tenor.com/9SO8-ZvgS3UAAAP1/twab-where-twab.mp4',
  // Infernus: a fan's painting, the flames around him flickering (Tenor).
  'deadlock:mythic-2': 'https://media.tenor.com/0cyI_TG7YT0AAAPo/infernus-deadlock-deadlock.mp4',
  // The Doorman awakened: his ultimate in the game, the bell rung and the heroes round him sent flying (Klipy; his first form has its own clip in FIRST_CLIPS).
  'deadlock:omni': 'https://static2.klipy.com/ii/6b3a6ab13999af763b4db87b91ee67d0/ed/04/r20uJhAyqTlyYVebcr.mp4',
};
/**
 * An omni's first form, animated too (its `CLIPS` entry is its awakened form's): the Doorman in a fan's
 * hand-drawn animation, his eyes welling up before he turns away (Tenor).
 */
const FIRST_CLIPS: Record<string, string> = {
  // Each to its voice line: Goku's Super Saiyan Kamehameha, Anakin on Mustafar ("You underestimate my power!"),
  // Aang's "Yip yip!" on Appa, the Witness stepping out (no line), and Arion's Saikyou Eleven Hadou (Tenor).
  'dbz:omni': 'https://media.tenor.com/Hq39Deua0rQAAAPo/kamehameha-goku.mp4',
  'starwars:omni': `${import.meta.env?.BASE_URL ?? './'}clips/gif/starwars-omni.mp4`,
  'avatar:omni': 'https://media.tenor.com/-WoF75PbEjkAAAPo/yip-yip-aang.mp4',
  'destiny:omni': `${import.meta.env?.BASE_URL ?? './'}clips/destiny/the-witness-30fps.mp4`,
  'inazuma:omni-arion': 'https://media.tenor.com/MfYrbE0etqAAAAP1/inazuma-eleven-ie11.mp4',
  // O-Chan's first form: the owner's game captures, one after the other (her awakened form keeps its picture).
  'ufouria:omni': UFOURIA_CLIP(['o-chan-idle', 'o-chan-singing', 'o-chan-ramping', 'o-chan-ramping-2', 'o-chan-throwing-popun']),
  'deadlock:omni': 'https://media.tenor.com/fU-AUOPjl1AAAAPo/deadlock-deadlock-doorman.mp4',
  'onepiece:omni': `${import.meta.env?.BASE_URL ?? './'}clips/onepiece/luffy-gear-5.mp4`,
  // Omnis that had no clip at all: their first form's (awakened, they play it too until they have one of their own).
  'forhonor:omni': 'https://media.tenor.com/4boSdb4jMlQAAAPo/for-honor-apollyon.mp4',
  'unreal:omni': 'https://media.tenor.com/Y-8Qtpt5Z4EAAAPo/unreal-engine.mp4',
  'arcraiders:omni-scrappy': `${import.meta.env?.BASE_URL ?? './'}clips/gif/arcraiders-scrappy.mp4`,
  // Firefly's green-flame wings at sunset; Acheron's slash among the red petals.
  'hsr:omni': 'https://media.tenor.com/umLyC7Vmbu0AAAPo/firefly-honkai-starrail.mp4',
  'hsr:omni-acheron': 'https://media.tenor.com/G_mwHD_2v78AAAPo/acheron-honkai-star-rail.mp4',
  // The Soul: Balatro's own short trailer (LocalThunk), a big score then its logo, heard with its music.
  'balatro:omni': `${import.meta.env?.BASE_URL ?? './'}clips/balatro/the-soul.mp4`,
};
/** The clips under 150 KB. */
const LIGHT_CLIPS = new Set(['bg3:mythic', 'bg3:mythic-2', 'ufouria:mythic', 'ufouria:omni', 'deadlock:omni', 'overwatch:mythic', 'harrypotter:mythic', 'overwatch:omni', 'lotr:mythic', 'harrypotter:mythic-2', 'dbz:omni', 'minecraft:omni', 'wow:mythic', 'mcu:mythic-2', 'harrypotter:omni', 'forhonor:mythic', 'overwatch:mythic-2', 'smash:omni', 'inazuma:mythic', 'minecraft:mythic', 'forts:omni', 'minecraft:mythic-2', 'dbz:mythic-2', 'naruto:mythic-2', 'mcu:omni', 'inazuma:omni', 'wow:omni', 'destiny:mythic-2', 'destiny:mythic', 'forhonor:mythic-2']);
/** The pictures measured as cut out (transparent edges), first form and awakened. */
const CUTOUTS = new Set(['overwatch:omni', 'overwatch:mythic-2', 'minecraft:mythic', 'minecraft:omni', 'minecraft:mythic-2', 'naruto:omni', 'mcu:omni', 'smash:mythic', 'smash:omni', 'smash:mythic-2', 'genshin:mythic', 'genshin:omni', 'genshin:mythic-2', 'ufouria:mythic', 'ufouria:omni']);
/** Light first forms whose awakened clip is a full video, not a light one. */
const HEAVY_AWAKE = new Set(['dbz:omni']);
const CUTOUTS_AWAKE = new Set(['minecraft:omni', 'starwars:omni', 'smash:omni']);
/** The pictures measured as opaque, no transparency at all (npm run cards:measure): "id", or "id@awake" for an omni's second form. */
const OPAQUE = new Set(CARD_OPAQUE as string[]);
const withClip = (c: Card): Card => {
  const clip = CLIPS[c.id];
  const clipLight = !!clip && LIGHT_CLIPS.has(c.id);
  const cutout = CUTOUTS.has(c.id);
  const opaque = !cutout && OPAQUE.has(c.id);
  const first = FIRST_CLIPS[c.id];
  return c.awaken
    ? { ...c, cutout, opaque, ...(first ? { clip: first, clipLight: LIGHT_CLIPS.has(c.id) } : {}), awaken: { ...c.awaken, clip, clipLight: !!clip && clipLight && !HEAVY_AWAKE.has(c.id), cutout: CUTOUTS_AWAKE.has(c.id), opaque: !CUTOUTS_AWAKE.has(c.id) && OPAQUE.has(`${c.id}@awake`) } }
    : { ...c, clip, clipLight, cutout, opaque };
};

/** Franchises added after the first fourteen (see CARDS). */
const LATE_SETS = new Set(['forts', 'forhonor', 'avatar', 'unreal', 'destiny', 'balatro', 'jlpt', 'ufouria', 'arcraiders', 'deadlock', 'hsr', 'hollowknight', 'mha', 'bg3', 'hxh']);
/** Late sets whose names stay out of the global list, so the later roster passes keep every card they had. */
const KEEP_OUT_OF_SEEN = new Set(['destiny', 'balatro', 'jlpt', 'ufouria', 'arcraiders', 'deadlock', 'hsr', 'hollowknight', 'mha', 'bg3', 'hxh']);

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

/**
 * One Piece in the manga's and the anime's own pictures only: a card drawn from the Who's That? roster came
 * with a video game render (Thousand Storm, Pirate Warriors) — it takes the character's anime picture
 * instead (the boss's, the Specialist's, or the wiki's infobox).
 */
const GAME_RENDER = /Thousand_Storm|Pirate_Warriors|Bounty_Rush|Treasure_Cruise/i;
const OP_KEY = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
const OP_ANIME = (() => {
  const m = new Map<string, string>();
  const put = (name: string, url?: string) => {
    if (url && !GAME_RENDER.test(url) && !m.has(OP_KEY(name))) m.set(OP_KEY(name), url.replace(/\/scale-to-width-down\/\d+/, '/scale-to-width-down/400'));
  };
  const boss = BOSSES.find((b) => b.id === 'onepiece');
  for (const c of [...(boss?.radar.members ?? []), ...(boss?.finale ?? [])]) put(c.label, c.image);
  for (const c of ONE_PIECE.characters) for (const n of [c.name, ...c.aliases]) put(n, c.image);
  // From the One Piece wiki's infoboxes: the ones neither knows.
  const wiki = 'https://static.wikia.nocookie.net/onepiece/images/';
  for (const [n, f] of [['Jozu', '6/61/Jozu_Anime_Infobox.png'], ['Vista', '7/78/Vista_Anime_Infobox.png'], ['Gin', '4/49/Gin_Anime_Infobox.png'], ['Shiki', '3/32/Shiki_Anime_Infobox.png'], ['Douglas Bullet', '5/54/Douglas_Bullet_Anime_Infobox.png'], ['Tsuru', '9/91/Tsuru_Anime_Infobox.png'], ['Hina', '0/0d/Hina_Anime_Infobox.png']])
    put(n, `${wiki}${f}/revision/latest/scale-to-width-down/400`);
  return m;
})();
const animeOnly = (c: Omit<Card, 'no'>): Omit<Card, 'no'> => (c.set === 'onepiece' && GAME_RENDER.test(c.image) ? { ...c, image: OP_ANIME.get(OP_KEY(c.name)) ?? c.image } : c);

/**
 * Cards added after every set's second mythic, numbered last. ARC Raiders: two more mythics from the
 * machines (the wiki's screenshots), the owner's own Raider (their picture, public/art/arcraiders), and Scrappy
 * the rooster as a second omni, in the cowboy hat (the wiki's outfit art; awakened, the pirate hat).
 * Deadlock: Seven as a third mythic.
 */
const LATER: (Omit<Card, 'no' | 'franchise' | 'domain'>)[] = [
  {
    set: 'arcraiders',
    id: 'arcraiders:mythic-matriarch',
    name: 'Matriarch',
    rarity: 'mythic',
    title: 'Shadow over the Street',
    image: 'https://arcraiders.wiki/w/images/thumb/1/17/Matriarch_from_below.jpg/800px-Matriarch_from_below.jpg.webp',
    focus: { x: 30, y: 30, zoom: 1.15 },
    voice: 'The swarm answers to me.',
    description: 'Seen from the street she is all legs and engines, and the sky behind her fills with missiles before the first Raider can run.',
  },
  {
    set: 'arcraiders',
    id: 'arcraiders:mythic-queen',
    name: 'Queen',
    rarity: 'mythic',
    title: 'Core Exposed',
    image: 'https://arcraiders.wiki/w/images/thumb/4/41/Queen_with_Exposed_Core.jpg/800px-Queen_with_Exposed_Core.jpg.webp',
    voice: 'Kneel, Raider.',
    description: 'Her plates are open and her core is glowing: the one moment a whole squad has been waiting for, and the moment she is most dangerous.',
  },
  {
    set: 'arcraiders',
    id: 'arcraiders:mythic-raider',
    name: 'Raider',
    rarity: 'mythic',
    title: 'Topside Veteran',
    image: `${import.meta.env?.BASE_URL ?? './'}art/arcraiders/raider.webp`,
    voice: 'Hello, Raider!',
    voices: ['Awoooooo!', 'Hello, Raider!', "Don't shoot!"],
    description: 'Fur collar, a conductor’s cap and a belt of shells: back up the elevator for one more run, with a howl for friends and a wave for strangers.',
  },
  {
    set: 'arcraiders',
    id: 'arcraiders:omni-scrappy',
    name: 'Scrappy',
    rarity: 'omni',
    title: 'Sheriff of the Workshop',
    image: 'https://arcraiders.wiki/w/images/9/9a/Cowboy_Hat_Scrappy_Outfit.png',
    voice: 'Cock-a-doodle-doo!',
    audio: 'https://www.myinstants.com/media/sounds/village-rooster-crowing-call-3.mp3',
    description: 'The rooster who lives in your workshop and brings back whatever he finds topside — today in a cowboy hat, and nobody dares say a thing.',
    awaken: {
      title: 'Captain Scrappy',
      image: 'https://arcraiders.wiki/w/images/6/62/Pirate_Hat_Scrappy_Outfit.png',
      line: 'Every Raider in Speranza heard of the Queen falling, and Scrappy has a new hat to show for it: the workshop sails under his flag now.',
    },
  },
  // Deadlock: Seven as a third mythic (he was the omni before the Doorman), in the wiki's concept art.
  {
    set: 'deadlock',
    id: 'deadlock:mythic-seven',
    name: 'Seven',
    rarity: 'mythic',
    title: 'The Storm Caller',
    image: 'https://cdn.deadlock.wiki/Seven_concept_art.png',
    // His own voice as he calls his Storm Cloud (the Deadlock Wiki's file: Seven is "Gigawatt" in the game's files).
    voice: 'The storm gathers.',
    audio: 'https://cdn.deadlock.wiki/Gigawatt_use_power4_04.mp3',
    description: 'Lightning in a ball, a static charge that stuns and a storm cloud over a whole fight: the hero every new player is warned about.',
  },
  // Inazuma Eleven's third mythic, from GO (a fan favourite never on a card before, so no one's a duplicate):
  // Victor Blade in the armour of his keshin, Lancelot (Chrono Stones, the Inazuma Eleven Wiki).
  {
    set: 'inazuma',
    id: 'inazuma:mythic-victor-blade',
    name: 'Victor Blade',
    rarity: 'mythic',
    title: 'Keshin Armed',
    image: 'https://static.wikia.nocookie.net/inazuma-eleven/images/9/91/%28CS_%28013%29%29_KA_Tsurugi.png/revision/latest/scale-to-width-down/600?cb=20160721111806',
    description: 'Sent by the Fifth Sector to crush Raimon’s soccer club, he ended up its ace striker — and here he wears his keshin, the swordsman Lancelot, as armour.',
    // His Death Sword in the first episode of GO (the Inazuma Eleven Wiki's clip, 720p), heard with its own sound: his
    // clip (CLIPS) and his voice are the one moment.
    voice: 'Death Sword!',
    audio: 'https://static.wikia.nocookie.net/inazuma-eleven/images/8/83/%28GO_%28001%29%29_Death_Sword.mp4/revision/latest?cb=20240323211654',
    clipSound: true,
  },
  // Inazuma Eleven GO and Chrono Stones (their cast, by how loved they are), and the series' techniques: hissatsu
  // and keshins, the famous ones rarest (src/data/inazuma-go.json, from the Inazuma Eleven Wiki).
  ...(INAZUMA_GO as { id: string; name: string; rarity: Rarity; image: string; description: string; technique?: boolean }[]).map((c) => ({ ...c, set: 'inazuma' })),
  // Inazuma Eleven's second omni, from GO and Chrono Stones: Arion Sherwind (Matsukaze Tenma), the GO hero, never
  // a Mythic or an Omni before. Mixi Maxed with King Arthur, then awakened in his team's ultimate shot, all eleven
  // at once: Saikyou Eleven Hadou ("Ultimate Eleven Assault"; "Attaque Équipe Ultime" in French). Its clip (CLIPS)
  // is that shot, and so is his voice: the anime's shout of it (the Inazuma Eleven Wiki's video of its first use).
  {
    set: 'inazuma',
    id: 'inazuma:omni-arion',
    name: 'Arion Sherwind',
    rarity: 'omni',
    title: 'Captain of Chrono Storm',
    image: 'https://static.wikia.nocookie.net/inazuma-eleven/images/a/ad/%28CS%29_Saikyou_Eleven_Hadou_3.png/revision/latest/scale-to-width-down/800?cb=20130426130829',
    focus: { x: 55, y: 30, zoom: 1 },
    voice: 'Saikyou Eleven Hadou!',
    audio: 'youtube:upwq-NjKGiY@13.4-18',
    description: 'The wind that saved soccer: he crossed the ages with Chrono Storm, Mixi Maxed with King Arthur himself, his hair gone gold and the legend’s sword in his kick.',
    awaken: {
      title: 'Ultimate Eleven Assault',
      image: 'https://static.wikia.nocookie.net/inazuma-eleven/images/d/d6/%28CS%29_Saikyou_Eleven_Hadou_5.png/revision/latest/scale-to-width-down/800?cb=20130426130830',
      line: 'Saikyou Eleven Hadou — “Attaque Équipe Ultime” in French: the shot that only works when all eleven give everything, a rainbow that makes the impossible possible.',
    },
  },
  // Sokka, the Mightiest Warrior, raised to Omni (players loved his Mythic): the same picture and clip, now an Omni.
  // His Mythic is vaulted — no pack gives it any more — and its owners can pay to upgrade it (src/gacha/upgrades.ts).
  {
    set: 'avatar',
    id: 'avatar:omni-sokka',
    name: 'Sokka',
    rarity: 'omni',
    title: 'The Mightiest Warrior',
    image: `${import.meta.env?.BASE_URL ?? './'}art/avatar/sokka-mythic.webp`,
    focus: { x: 50, y: 22, zoom: 1 },
    description: 'No bending, just a boomerang, a sword and a plan for everything — and in the stories told about him, he’s twice the size and three times the hero.',
    voice: 'It’s the quenchiest!',
    audio: `${import.meta.env?.BASE_URL ?? './'}clips/avatar/sokka.mp4`,
  },
  // Dragon Ball's fusions and the Legendary Super Saiyan of the Dragon Ball Super film (a ticket), in the anime's
  // and the film's art (Dragon Ball Wiki). Goku and Vegeta already hold the set's Mythics and Omni; these are new faces.
  {
    set: 'dbz',
    id: 'dbz:omni-gogeta',
    name: 'Gogeta',
    rarity: 'omni',
    title: 'Super Saiyan Blue',
    // The owner's picks: the wallpaper (4kwallpapers), the clip (his Kamehameha, the owner's capture, in CLIPS) and, apart from
    // it, his voice when the card is inspected ("Ore wa Gogeta", the owner's capture, raised 23 dB to the other voices'
    // level and kept in the site: on YouTube it was too quiet to hear).
    image: 'https://4kwallpapers.com/images/wallpapers/super-saiyan-blue-3440x1440-17113.jpeg',
    focus: { x: 50, y: 50, zoom: 1.85 },
    description: 'Goku and Vegeta, fused by the Fusion Dance with every step in time, then turned Blue: the one warrior who could stand up to Broly at full power — and win.',
    voice: 'I am Gogeta!',
    audio: `${import.meta.env?.BASE_URL ?? './'}audio/dbz/gogeta-ore-wa-gogeta.mp3`,
    clipSound: true,
  },
  {
    set: 'dbz',
    id: 'dbz:mythic-broly',
    name: 'Broly',
    rarity: 'mythic',
    title: 'Legendary Super Saiyan',
    // The owner's picks: the picture (kept in the site), and his scream (BrolyScream, NnahoyTV) as both his clip and his
    // voice: one YouTube moment, its sound heard with its picture.
    image: `${import.meta.env?.BASE_URL ?? './'}art/dbz/broly-mythic.webp`,
    focus: { x: 55, y: 30, zoom: 1.55 },
    description: 'Raised alone on Vampa with only his anger, he grows stronger with every blow he takes — and when his rage boils over, the Legendary Super Saiyan has no ceiling.',
    voice: 'RAAAAAAAAAAH!',
    audio: `${import.meta.env?.BASE_URL ?? './'}clips/dbz/broly.mp4`,
  },
  {
    set: 'dbz',
    id: 'dbz:mythic-vegito',
    name: 'Vegito',
    rarity: 'mythic',
    title: 'Super Saiyan Blue',
    image: 'https://static.wikia.nocookie.net/dragonball/images/4/4a/SSGSS_Barrier.png/revision/latest/scale-to-width-down/800?cb=20200929203029',
    focus: { x: 80, y: 30, zoom: 1 },
    description: 'Goku and Vegeta joined by the Potara earrings, then turned Blue to face Fused Zamasu: so strong that the fusion burned out before the fight could end.',
    voice: 'Final Kamehameha!',
    audio: 'https://www.myinstants.com/media/sounds/tmpd5y55__3.mp3',
  },
  // Steve as A Minecraft Movie has him (Jack Black), the owner's pick: the film's character poster (Minecraft Wiki),
  // and "Steve's Lava Chicken" as his clip, heard with its own sound (the official music video, WaterTower Music). The set's other Omni and Mythics are the Creeper and the Warden: a new face.
  {
    set: 'minecraft',
    id: 'minecraft:omni-steve',
    name: 'Steve',
    rarity: 'omni',
    title: 'A Minecraft Movie',
    image: 'https://minecraft.wiki/images/AMCM_Character_poster_Steve.jpg',
    focus: { x: 72, y: 45, zoom: 1 },
    description: 'A doorknob salesman who yearned for the mines as a child, then found the portal and stayed: years in the Overworld, a wolf called Dennis, and one song about chicken, lava and a lava chicken.',
    // His voice lines: the film's, the owner's picks, cut from "Minecraft Movie but only THE MEMES" (one at random).
    // His clip (CLIPS: Steve's Lava Chicken) is heard with its own sound behind a win, not these.
    voice: 'I am Steve.',
    audio: 'youtube:54D5u8DnfvE@22.6-26.4',
    voiceClips: [
      { line: 'Flint and steel.', audio: 'youtube:54D5u8DnfvE@10.9-11.7' },
      { line: 'The Nether.', audio: 'youtube:54D5u8DnfvE@18.7-21' },
      { line: 'I am Steve.', audio: 'youtube:54D5u8DnfvE@22.6-26.4' },
      { line: 'First we mine, then we craft. Let’s Minecraft!', audio: 'youtube:54D5u8DnfvE@118.2-122.3' },
    ],
    clipSound: true,
  },
  // Acheron, raised to Omni (one of Honkai: Star Rail's best-loved characters): her splash art, and the Light Cone
  // drawn for her when she awakens. Her Mythic (hsr:mythic-2) is vaulted, and its owners can pay to upgrade it
  // (src/gacha/upgrades.ts). Her voice lines are the game's (Honkai: Star Rail Wiki).
  {
    set: 'hsr',
    id: 'hsr:omni-acheron',
    name: 'Acheron',
    rarity: 'omni',
    title: 'The Galaxy Ranger',
    image: 'https://static.wikia.nocookie.net/houkai-star-rail/images/7/78/Character_Acheron_Splash_Art.png/revision/latest/scale-to-width-down/600?cb=20240327021325',
    description: 'A wanderer who calls herself a Galaxy Ranger, with a red blade she almost never draws, walking the Path of Nihility: where she passes, the rain falls, and whole worlds go quiet behind her.',
    voice: 'Stream forth... the gleam of old blades.',
    audio: 'https://static.wikia.nocookie.net/houkai-star-rail/images/4/48/VO_Acheron_Technique_01.ogg/revision/latest?cb=20240327083612',
    voiceClips: [
      { line: "Stream forth... the gleam of old blades.", audio: 'https://static.wikia.nocookie.net/houkai-star-rail/images/4/48/VO_Acheron_Technique_01.ogg/revision/latest?cb=20240327083612' },
      { line: "Existence is fleeting as the dawn's dew, destined for oblivion.", audio: 'https://static.wikia.nocookie.net/houkai-star-rail/images/4/48/VO_Acheron_Skill_01.ogg/revision/latest?cb=20240327083116' },
      { line: "On the still waters of oblivion, I guide the wandering souls.", audio: 'https://static.wikia.nocookie.net/houkai-star-rail/images/d/db/VO_Acheron_Skill_02.ogg/revision/latest?cb=20240327083117' },
      { line: "Another blood debt repaid.", audio: 'https://static.wikia.nocookie.net/houkai-star-rail/images/4/4c/VO_Acheron_Battle_Won_01.ogg/revision/latest?cb=20240327083108' },
    ],
    awaken: {
      title: 'Along the Passing Shore',
      image: 'https://static.wikia.nocookie.net/houkai-star-rail/images/7/7d/Light_Cone_Along_the_Passing_Shore_Artwork.png/revision/latest/scale-to-width-down/600?cb=20240327025329',
      line: 'The blade leaves its sheath at last. One stroke, a red flash across the sky, and the rain stops — for everything in front of her, it is the end of the story.',
    },
  },
  // Hollow Knight and Silksong (one set): three more Omnis beside Hornet (the set's own). Their pictures are the
  // game's drawn art (Hollow Knight Wiki); each clip is a moment of the game heard with its own sound (the clip is
  // its voice too, so they play as one): the Hollow Knight breaking its chains with a scream (Hold To Reset's video
  // of the fight), the Radiance rising with its shriek (Spleebis), Grimm's bow in a fan animation with its own voice
  // and sound design (Grimm Troupe Animated, by @mmh_szns).
  {
    set: 'hollowknight',
    id: 'hollowknight:omni-hollow-knight',
    name: 'The Hollow Knight',
    rarity: 'omni',
    title: 'The Pure Vessel',
    // The owner's picks: the Pure Vessel in chains (Wallpaper Cave, kept in the site), and 0:08 to 0:25 of its fight
    // (CrankyTemplar's Radiant run) as its clip and its voice, one moment heard.
    image: `${import.meta.env?.BASE_URL ?? './'}art/hollowknight/the-hollow-knight.webp`,
    focus: { x: 50, y: 30, zoom: 1 },
    description: 'The vessel the Pale King raised to be perfectly empty, sealed in the Black Egg Temple with a god inside it: chained, cracked, still holding on.',
    voice: '*The Pure Vessel strikes*',
    audio: `${import.meta.env?.BASE_URL ?? './'}clips/hollowknight/the-hollow-knight.mp4`,
  },
  {
    set: 'hollowknight',
    id: 'hollowknight:omni-radiance',
    name: 'Absolute Radiance',
    rarity: 'omni',
    title: 'The Old Light',
    image: 'https://cdn.wikimg.net/en/hkwiki/images/a/aa/Radiance_Idle.png',
    description: 'A god of light the moths once worshipped, forgotten by a king and his kingdom — and her answer was a plague of dreams that turned every bug of Hallownest to her.',
    voice: 'AAAAAAAAH!',
    // The owner's pick: 0:14 to 0:28 of this video, its clip and its voice (one moment, heard).
    audio: `${import.meta.env?.BASE_URL ?? './'}clips/hollowknight/radiance.mp4`,
  },
  {
    set: 'hollowknight',
    id: 'hollowknight:omni-grimm',
    name: 'Grimm',
    // Was the set's fourth Omni; the owner made him a Mythic, his Nightmare King form the Omni (below). The id stays, for
    // the players who already have him. His picture and clip are the owner's picks (the picture kept in the site).
    rarity: 'mythic',
    title: 'Troupe Master',
    image: `${import.meta.env?.BASE_URL ?? './'}art/hollowknight/grimm-mythic.webp`,
    description: 'Master of a troupe that follows the Nightmare Lantern from kingdom to kingdom: a bow, a swirl of red cape, and the scarlet flame of a ritual older than Hallownest.',
    voice: 'Hooseh!',
    audio: `${import.meta.env?.BASE_URL ?? './'}clips/hollowknight/grimm.mp4`,
  },
  // Nightmare King Grimm, the owner's pick for the set's Omni: the picture (kept in the site; its host refuses other
  // sites) and 0:08 to 0:19 of this video, its clip and its voice.
  {
    set: 'hollowknight',
    id: 'hollowknight:omni-nightmare-king-grimm',
    name: 'Grimm',
    rarity: 'omni',
    title: 'Heart of the Nightmare',
    image: `${import.meta.env?.BASE_URL ?? './'}art/hollowknight/nightmare-king-grimm.webp`,
    description: 'The troupe master as the ritual really made him: the Nightmare King, all scarlet flame and swirling cape, dancing a fight no one leaves unburnt.',
    voice: '*The Nightmare King roars*',
    audio: `${import.meta.env?.BASE_URL ?? './'}clips/hollowknight/nightmare-king-grimm.mp4`,
  },
];

/**
 * Faces put in a boss's Radar or Final Blow after its cards were released, whose cards come in LATER (by set and
 * name): the boss lists build no early copy of them. Add a name here whenever a boss list gains a face.
 */
const LATE_FACES = new Set([...INAZUMA_GO.map((c) => `inazuma:${c.name}`), 'inazuma:Victor Blade']);

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
      // A face added to the boss after its cards were released, whose card comes later (LATER): no early copy,
      // which would shift the numbers of the cards after it (Inazuma Eleven GO's cast in the Radar and Final Blow).
      if (LATE_FACES.has(`${b.id}:${name}`)) return;
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
    if (m && star?.image) set.push({ id: `${b.id}:mythic`, name: m.name, image: m.image ?? star.image, set: b.id, franchise: b.franchise, domain: b.domain, rarity: 'mythic', title: m.title, voice: m.voice, audio: m.audio, voiceClips: m.voiceClips, voiceFr: m.voiceFr, audioFr: m.audioFr, description: m.line });
    // The omni: the legend in its first form, its second waiting for a Hard win.
    const o = OMNIS[b.id];
    const legend = o && b.radar.members.find((x) => x.label === o.name);
    const oImage = o?.image ?? legend?.image;
    if (o && oImage) set.push({ id: `${b.id}:omni`, name: o.name, image: oImage, set: b.id, franchise: b.franchise, domain: b.domain, rarity: 'omni', title: o.title, description: o.line, voice: o.voice, audio: o.audio, voiceClips: o.voiceClips, awaken: o.awaken });
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
    if (b) sets.get(b.id)!.push({ id: x.id, name: x.name, image: x.image, set: b.id, franchise: b.franchise, domain: b.domain, rarity: x.rarity, title: x.title, description: x.description, place: x.place, voice: x.voice, audio: x.audio });
  }
  // Then the second mythics, each set's newest card.
  for (const b of CARD_BOSSES) {
    const set = sets.get(b.id)!;
    const m = MYTHICS_2[b.id];
    const image = m && (m.image ?? set.find((c) => c.name === m.name)?.image ?? (b.boss.name === m.name ? b.boss.image : undefined));
    if (m && image) set.push({ id: `${b.id}:mythic-2`, name: m.name, image, set: b.id, franchise: b.franchise, domain: b.domain, rarity: 'mythic', title: m.title, voice: m.voice, audio: m.audio, voiceClips: m.voiceClips, voiceFr: m.voiceFr, audioFr: m.audioFr, description: m.line });
  }
  // And last: the cards added after the second mythics (so no released card changes number).
  for (const x of LATER) {
    const b = CARD_BOSSES.find((y) => y.id === x.set);
    if (b) sets.get(b.id)!.push({ ...x, set: b.id, franchise: b.franchise, domain: b.domain });
  }
  return CARD_BOSSES.flatMap((b) => sets.get(b.id)!.map((c, i) => withClip({ ...animeOnly(c), ...STRONG[c.id], rarity: FROZEN[c.id] ?? c.rarity, no: i + 1 })));
})();

export const CARD_BY_ID = new Map(CARDS.map((c) => [c.id, c]));

/** The cards still given out, the ones a complete set or album needs: all but the vaulted (src/gacha/upgrades.ts). */
export const COLLECTIBLE: Card[] = CARDS.filter((c) => !VAULTED.has(c.id));

/** The sets, in Boss Battle order: id, franchise, kind of work, size. */
export const SETS = CARD_BOSSES.map((b) => ({ id: b.id, franchise: b.franchise, domain: b.domain, size: COLLECTIBLE.filter((c) => c.set === b.id).length, guardian: b.boss }));
export const setSize = (id: string) => SETS.find((s) => s.id === id)?.size ?? 0;
