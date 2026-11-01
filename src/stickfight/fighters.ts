// Stick Fight (a test): who each mystery stickman is, and the moves that give them away.
import traits from '../data/specialist/classic-traits.json';

export type Weapon = 'katana' | 'hammer' | 'rifle' | 'launcher' | 'pistols' | 'bow' | 'shotgun' | 'gauntlet' | 'blaster' | 'tesla';
export type Shape = 'star' | 'bullet' | 'arrow' | 'rocket' | 'wave' | 'ice' | 'pellet';
export type GuardLook = 'shield' | 'dome' | 'deflect' | 'ice' | 'gas' | 'block';

export interface Move {
  /** Its real name, shown once the fight is over. */
  name: string;
  kind: 'melee' | 'shot' | 'snipe' | 'dash' | 'leap' | 'hook' | 'blink' | 'recall' | 'stream' | 'shock' | 'guard' | 'mine' | 'wall';
  windup: number;
  active: number;
  recover: number;
  cooldown: number;
  /** Used only with the player this close, or this far away. */
  min?: number;
  max?: number;
  damage?: number;
  kb?: number;
  /** melee, stream, shock: how far it reaches. */
  reach?: number;
  // shot and hook
  speed?: number;
  count?: number;
  spread?: number;
  burst?: number;
  arc?: boolean;
  shape?: Shape;
  blast?: number;
  slow?: boolean;
  // dash
  through?: boolean;
  carry?: boolean;
  // leap and blink
  away?: boolean;
  grapple?: boolean;
  shock?: number;
  dist?: number;
  // guard and recall
  look?: GuardLook;
  counter?: string;
  heal?: number;
  /** Comes straight after this one. */
  then?: string;
}

export interface Fighter {
  name: string;
  weapon: Weapon;
  scale: number;
  speed: number;
  /** The distance it tries to fight from. */
  keep: [number, number];
  /** Off the ground by this much, always. */
  hover?: number;
  /** Hits don't stop it. */
  armored?: boolean;
  passive?: string[];
  moves: Move[];
}

export const FIGHTERS: Fighter[] = [
  {
    name: 'Genji',
    weapon: 'katana',
    scale: 0.95,
    speed: 290,
    keep: [50, 260],
    moves: [
      { name: 'Shuriken', kind: 'shot', windup: 0.25, active: 0.05, recover: 0.3, cooldown: 1.4, min: 110, count: 3, spread: 0.14, speed: 640, damage: 5, shape: 'star' },
      { name: 'Swift Strike', kind: 'dash', windup: 0.3, active: 0.24, recover: 0.4, cooldown: 3.2, min: 70, max: 380, speed: 1050, damage: 12, kb: 180, through: true },
      { name: 'Deflect', kind: 'guard', windup: 0.05, active: 1, recover: 0.2, cooldown: 6, max: 130, look: 'deflect', counter: 'Swift Strike' },
      { name: 'Dragonblade', kind: 'melee', windup: 0.28, active: 0.12, recover: 0.3, cooldown: 1.1, max: 95, reach: 88, damage: 10, kb: 240 },
    ],
  },
  {
    name: 'Reinhardt',
    weapon: 'hammer',
    scale: 1.3,
    speed: 170,
    keep: [50, 110],
    armored: true,
    moves: [
      { name: 'Rocket Hammer', kind: 'melee', windup: 0.5, active: 0.16, recover: 0.45, cooldown: 1.3, max: 125, reach: 120, damage: 15, kb: 340 },
      { name: 'Charge', kind: 'dash', windup: 0.55, active: 1.2, recover: 0.7, cooldown: 6, min: 130, speed: 620, damage: 22, kb: 420, carry: true },
      { name: 'Fire Strike', kind: 'shot', windup: 0.45, active: 0.05, recover: 0.4, cooldown: 3.4, min: 150, speed: 400, damage: 12, shape: 'wave' },
      { name: 'Barrier Field', kind: 'guard', windup: 0.1, active: 1.5, recover: 0.2, cooldown: 7, max: 180, look: 'shield' },
    ],
  },
  {
    name: 'Widowmaker',
    weapon: 'rifle',
    scale: 1,
    speed: 190,
    keep: [340, 700],
    moves: [
      { name: "Widow's Kiss", kind: 'snipe', windup: 1.05, active: 0.05, recover: 0.5, cooldown: 1.9, min: 90, damage: 20, kb: 160 },
      { name: 'Grappling Hook', kind: 'leap', windup: 0.1, active: 0.55, recover: 0.15, cooldown: 3.6, max: 240, away: true, grapple: true },
      { name: 'Venom Mine', kind: 'mine', windup: 0.25, active: 0.05, recover: 0.2, cooldown: 7, damage: 8 },
    ],
  },
  {
    name: 'Pharah',
    weapon: 'launcher',
    scale: 1,
    speed: 210,
    keep: [220, 520],
    hover: 72,
    passive: ['Hover Jets'],
    moves: [
      { name: 'Rocket Launcher', kind: 'shot', windup: 0.4, active: 0.05, recover: 0.4, cooldown: 1.2, min: 70, speed: 430, damage: 12, kb: 300, shape: 'rocket', blast: 70 },
      { name: 'Concussive Blast', kind: 'shock', windup: 0.2, active: 0.08, recover: 0.3, cooldown: 4, max: 150, reach: 150, damage: 4, kb: 640 },
    ],
  },
  {
    name: 'Tracer',
    weapon: 'pistols',
    scale: 0.88,
    speed: 330,
    keep: [110, 280],
    moves: [
      { name: 'Pulse Pistols', kind: 'shot', windup: 0.14, active: 0.5, recover: 0.2, cooldown: 1, min: 60, burst: 0.09, speed: 780, damage: 2, shape: 'bullet', spread: 0.05 },
      { name: 'Blink', kind: 'blink', windup: 0.03, active: 0.03, recover: 0.08, cooldown: 1.5, dist: 170 },
      { name: 'Recall', kind: 'recall', windup: 0.2, active: 0.25, recover: 0.1, cooldown: 12, heal: 22 },
    ],
  },
  {
    name: 'Winston',
    weapon: 'tesla',
    scale: 1.25,
    speed: 200,
    keep: [50, 150],
    armored: true,
    moves: [
      { name: 'Jump Pack', kind: 'leap', windup: 0.25, active: 0.72, recover: 0.4, cooldown: 3, min: 130, damage: 14, kb: 330, shock: 120 },
      { name: 'Tesla Cannon', kind: 'stream', windup: 0.25, active: 1, recover: 0.3, cooldown: 2, max: 190, reach: 190, damage: 2.5 },
      { name: 'Barrier Projector', kind: 'guard', windup: 0.1, active: 1.7, recover: 0.15, cooldown: 8, max: 170, look: 'dome' },
    ],
  },
  {
    name: 'Hanzo',
    weapon: 'bow',
    scale: 1,
    speed: 185,
    keep: [200, 480],
    moves: [
      { name: 'Storm Bow', kind: 'shot', windup: 0.7, active: 0.05, recover: 0.3, cooldown: 1.3, min: 90, speed: 620, damage: 16, shape: 'arrow', arc: true },
      { name: 'Storm Arrows', kind: 'shot', windup: 0.2, active: 0.8, recover: 0.45, cooldown: 7, min: 70, burst: 0.17, speed: 700, damage: 5, shape: 'arrow', arc: true },
      { name: 'Lunge', kind: 'leap', windup: 0.06, active: 0.5, recover: 0.25, cooldown: 4.5, max: 170, away: true },
    ],
  },
  {
    name: 'Roadhog',
    weapon: 'shotgun',
    scale: 1.42,
    speed: 145,
    keep: [70, 240],
    armored: true,
    moves: [
      { name: 'Chain Hook', kind: 'hook', windup: 0.5, active: 0.1, recover: 0.2, cooldown: 4.5, min: 110, max: 520, speed: 860, damage: 5, then: 'Scrap Gun' },
      { name: 'Scrap Gun', kind: 'shot', windup: 0.32, active: 0.05, recover: 0.5, cooldown: 1.4, max: 330, count: 6, spread: 0.32, speed: 640, damage: 3.5, shape: 'pellet' },
      { name: 'Take a Breather', kind: 'guard', windup: 0.15, active: 1.5, recover: 0.2, cooldown: 11, look: 'gas', heal: 18 },
    ],
  },
  {
    name: 'Doomfist',
    weapon: 'gauntlet',
    scale: 1.18,
    speed: 220,
    keep: [80, 300],
    armored: true,
    moves: [
      { name: 'Rocket Punch', kind: 'dash', windup: 0.7, active: 0.4, recover: 0.5, cooldown: 3.8, min: 90, max: 520, speed: 1000, damage: 18, kb: 620 },
      { name: 'Seismic Slam', kind: 'leap', windup: 0.2, active: 0.62, recover: 0.4, cooldown: 4.5, min: 150, damage: 11, kb: 120, shock: 130 },
      { name: 'Hand Cannon', kind: 'shot', windup: 0.25, active: 0.05, recover: 0.3, cooldown: 1.5, count: 4, spread: 0.17, speed: 720, damage: 3, shape: 'bullet' },
      { name: 'Power Block', kind: 'guard', windup: 0.08, active: 1.1, recover: 0.15, cooldown: 6, max: 150, look: 'block', counter: 'Rocket Punch' },
    ],
  },
  {
    name: 'Mei',
    weapon: 'blaster',
    scale: 0.92,
    speed: 180,
    keep: [110, 240],
    moves: [
      { name: 'Endothermic Blaster', kind: 'stream', windup: 0.2, active: 1.1, recover: 0.25, cooldown: 1.9, max: 240, reach: 240, damage: 1.6, slow: true },
      { name: 'Icicle', kind: 'shot', windup: 0.55, active: 0.05, recover: 0.3, cooldown: 2.2, min: 170, speed: 760, damage: 14, shape: 'ice' },
      { name: 'Ice Wall', kind: 'wall', windup: 0.3, active: 0.05, recover: 0.3, cooldown: 8, min: 90, max: 380 },
      { name: 'Cryo-Freeze', kind: 'guard', windup: 0.05, active: 1.4, recover: 0.25, cooldown: 11, max: 120, look: 'ice', heal: 16 },
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
