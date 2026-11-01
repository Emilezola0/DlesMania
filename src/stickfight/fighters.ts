// Stick Fight (a test): who each mystery stickman is, and the moves that give them away.
import traits from '../data/specialist/classic-traits.json';

export type Weapon = 'katana' | 'hammer' | 'rifle' | 'launcher' | 'pistols' | 'bow' | 'shotgun' | 'gauntlet' | 'blaster' | 'tesla';
export type Shape = 'star' | 'bullet' | 'arrow' | 'rocket' | 'wave' | 'ice' | 'pellet';
export type GuardLook = 'shield' | 'dome' | 'deflect' | 'ice' | 'gas' | 'block';
export type Range = 'close' | 'far';
/** What the player sees before choosing. Two moves can share one: that's the guesswork. */
export type Tell = 'raise' | 'aim' | 'crouch' | 'brace' | 'lean' | 'spin' | 'still' | 'flicker';

export const TELLS: Record<Tell, string> = {
  raise: 'It raises its weapon high.',
  aim: 'It takes aim.',
  crouch: 'It crouches, ready to spring.',
  brace: 'It braces itself.',
  lean: 'It leans forward, weight on its front foot.',
  spin: 'Something whirls in its hand.',
  still: 'It goes very still.',
  flicker: 'Its outline flickers.',
};

export interface Move {
  /** Its real name, shown once the fight is over. */
  name: string;
  kind: 'melee' | 'shot' | 'snipe' | 'dash' | 'leap' | 'hook' | 'blink' | 'recall' | 'stream' | 'shock' | 'guard' | 'mine' | 'wall' | 'retreat';
  tell: Tell;
  /** What the player reads as it happens. Never the move's name. */
  line: string;
  /** Where it can be used from. */
  from: Range | 'any';
  damage?: number;
  /** Goes straight through a guard. */
  breaks?: boolean;
  /** Gone before a strike lands. */
  evades?: boolean;
  /** The distance it leaves the fight at. */
  to?: Range;
  /** Turns before it can come back. */
  cooldown?: number;
  /** Comes straight after this one, when it connects. */
  then?: string;
  // shot
  count?: number;
  arc?: boolean;
  blast?: boolean;
  shape?: Shape;
  // guard
  look?: GuardLook;
  counter?: number;
  heal?: number;
  /** The cold: no dodging next turn. */
  chills?: boolean;
  grapple?: boolean;
}

export interface Fighter {
  name: string;
  weapon: Weapon;
  scale: number;
  /** Off the ground by this much, always. */
  hover?: number;
  passive?: string[];
  moves: Move[];
}

export const FIGHTERS: Fighter[] = [
  {
    name: 'Genji',
    weapon: 'katana',
    scale: 0.95,
    moves: [
      { name: 'Dragonblade', kind: 'melee', tell: 'still', from: 'close', damage: 16, line: 'A blade flashes out, faster than you can follow.' },
      { name: 'Deflect', kind: 'guard', tell: 'still', from: 'close', look: 'deflect', counter: 10, cooldown: 2, line: 'A blade whirls into a wall of green light.' },
      { name: 'Swift Strike', kind: 'dash', tell: 'lean', from: 'any', damage: 12, breaks: true, to: 'close', cooldown: 2, line: 'It streaks across the arena in a single cut.' },
      { name: 'Shuriken', kind: 'shot', tell: 'aim', from: 'far', damage: 12, count: 3, shape: 'star', line: 'Three spinning blades fan out at you.' },
    ],
  },
  {
    name: 'Reinhardt',
    weapon: 'hammer',
    scale: 1.3,
    moves: [
      { name: 'Rocket Hammer', kind: 'melee', tell: 'raise', from: 'close', damage: 20, line: 'A huge hammer swings round in a full arc.' },
      { name: 'Charge', kind: 'dash', tell: 'lean', from: 'far', damage: 24, breaks: true, to: 'close', cooldown: 3, line: 'It thunders across the arena, pinning you to the far wall.' },
      { name: 'Fire Strike', kind: 'shot', tell: 'raise', from: 'far', damage: 14, shape: 'wave', line: 'One swing, and an arc of flame rolls toward you.' },
      { name: 'Barrier Field', kind: 'guard', tell: 'brace', from: 'any', look: 'shield', cooldown: 2, line: 'A great wall of blue light snaps up in front of it.' },
    ],
  },
  {
    name: 'Widowmaker',
    weapon: 'rifle',
    scale: 1,
    moves: [
      { name: "Widow's Kiss", kind: 'snipe', tell: 'aim', from: 'any', damage: 22, line: 'A single shot, dead on target.' },
      { name: 'Grappling Hook', kind: 'retreat', tell: 'crouch', from: 'close', evades: true, grapple: true, to: 'far', cooldown: 3, line: 'A line shoots up, and it swings away to the far side.' },
      { name: 'Venom Mine', kind: 'mine', tell: 'crouch', from: 'far', cooldown: 3, line: 'It sets something small on the floor between you.' },
    ],
  },
  {
    name: 'Pharah',
    weapon: 'launcher',
    scale: 1,
    hover: 58,
    passive: ['Hover Jets'],
    moves: [
      { name: 'Rocket Launcher', kind: 'shot', tell: 'aim', from: 'any', damage: 15, blast: true, shape: 'rocket', line: 'A rocket screams down from above.' },
      { name: 'Concussive Blast', kind: 'shock', tell: 'brace', from: 'close', damage: 8, breaks: true, to: 'far', cooldown: 4, line: 'A blast of air throws you clear across the arena.' },
      { name: 'Jump Jet', kind: 'retreat', tell: 'crouch', from: 'close', evades: true, to: 'far', cooldown: 5, line: 'Jets roar, and it is suddenly high above you and far away.' },
    ],
  },
  {
    name: 'Tracer',
    weapon: 'pistols',
    scale: 0.88,
    moves: [
      { name: 'Pulse Pistols', kind: 'shot', tell: 'aim', from: 'any', damage: 12, count: 4, shape: 'bullet', line: 'Two pistols spit a stream of bright little shots.' },
      { name: 'Blink', kind: 'blink', tell: 'flicker', from: 'any', evades: true, cooldown: 2, line: 'It simply vanishes, and appears somewhere else.' },
      { name: 'Recall', kind: 'recall', tell: 'flicker', from: 'any', evades: true, heal: 20, cooldown: 4, line: 'It rewinds: back where it was a moment ago, wounds and all gone.' },
    ],
  },
  {
    name: 'Winston',
    weapon: 'tesla',
    scale: 1.25,
    moves: [
      { name: 'Tesla Cannon', kind: 'stream', tell: 'aim', from: 'close', damage: 14, line: 'Lightning crawls out of its weapon and over you.' },
      { name: 'Jump Pack', kind: 'leap', tell: 'crouch', from: 'far', damage: 16, breaks: true, to: 'close', line: 'It flies in a huge arc and lands on you with a crash.' },
      { name: 'Barrier Projector', kind: 'guard', tell: 'brace', from: 'close', look: 'dome', cooldown: 2, line: 'A dome of light unfolds around it.' },
    ],
  },
  {
    name: 'Hanzo',
    weapon: 'bow',
    scale: 1,
    moves: [
      { name: 'Storm Bow', kind: 'shot', tell: 'aim', from: 'any', damage: 18, arc: true, shape: 'arrow', line: 'One heavy arrow drops out of the air.' },
      { name: 'Storm Arrows', kind: 'shot', tell: 'aim', from: 'any', damage: 14, count: 3, arc: true, breaks: true, shape: 'arrow', cooldown: 2, line: 'Arrows come one after another, too quick to block.' },
      { name: 'Lunge', kind: 'retreat', tell: 'crouch', from: 'close', evades: true, to: 'far', cooldown: 3, line: 'It leaps twice, the second time off nothing at all.' },
    ],
  },
  {
    name: 'Roadhog',
    weapon: 'shotgun',
    scale: 1.42,
    moves: [
      { name: 'Chain Hook', kind: 'hook', tell: 'spin', from: 'far', damage: 8, breaks: true, to: 'close', then: 'Scrap Gun', cooldown: 2, line: 'A chain drags you across the arena.' },
      { name: 'Scrap Gun', kind: 'shot', tell: 'aim', from: 'any', damage: 18, count: 6, shape: 'pellet', line: 'A blast of scrap metal, wide and ugly.' },
      { name: 'Take a Breather', kind: 'guard', tell: 'brace', from: 'any', look: 'gas', heal: 20, cooldown: 3, line: 'It breathes in a cloud of something and looks better for it.' },
    ],
  },
  {
    name: 'Doomfist',
    weapon: 'gauntlet',
    scale: 1.18,
    moves: [
      { name: 'Rocket Punch', kind: 'dash', tell: 'brace', from: 'any', damage: 22, breaks: true, to: 'close', cooldown: 2, line: 'One enormous fist comes at you like a train.' },
      { name: 'Power Block', kind: 'guard', tell: 'brace', from: 'close', look: 'block', counter: 8, cooldown: 2, line: 'It crosses a huge fist in front of itself, and your blow comes back at you.' },
      { name: 'Seismic Slam', kind: 'leap', tell: 'crouch', from: 'far', damage: 14, to: 'close', line: 'It jumps, and comes down fist first, cracking the floor.' },
      { name: 'Hand Cannon', kind: 'shot', tell: 'aim', from: 'any', damage: 10, count: 4, shape: 'bullet', line: 'Shells burst from its knuckles.' },
    ],
  },
  {
    name: 'Mei',
    weapon: 'blaster',
    scale: 0.92,
    moves: [
      { name: 'Endothermic Blaster', kind: 'stream', tell: 'aim', from: 'close', damage: 12, chills: true, line: 'A freezing stream stiffens your legs. No dodging next turn.' },
      { name: 'Icicle', kind: 'shot', tell: 'aim', from: 'far', damage: 16, shape: 'ice', line: 'A long spike of ice flies straight at you.' },
      { name: 'Ice Wall', kind: 'wall', tell: 'brace', from: 'far', cooldown: 3, line: 'A wall of ice shoots out of the floor between you.' },
      { name: 'Cryo-Freeze', kind: 'guard', tell: 'brace', from: 'close', look: 'ice', heal: 15, cooldown: 3, line: 'It seals itself in a block of ice and comes out healed.' },
    ],
  },
];

const OVERWATCH = traits.overwatch as Record<string, Record<string, string>>;

/** The answers offered: every hero, not only the ones who can turn up. */
export const HERO_NAMES = Object.keys(OVERWATCH);

/** What hitting it gives away, in order. The first letter comes last. */
export function cluesOf(f: Fighter): { label: string; value: string }[] {
  const t = OVERWATCH[f.name] ?? {};
  const fields = ['Role', 'Sub-role', 'Nationality', 'Age'].filter((k) => t[k]).map((k) => ({ label: k, value: t[k] }));
  return [...fields, { label: 'First letter', value: f.name[0] }];
}
