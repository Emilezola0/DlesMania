// The Island's music makers (items of kind "music"), synthesized live (WebAudio, no files): each plays its own little
// loop, heard only near it, louder the closer you stand, and from its side (left or right). Off with the site's sound;
// as loud as the effects volume.
import { useProgress } from '../store/progress';

type Step = number | number[] | null;
interface Voice {
  wave: OscillatorType;
  /** The first note's pitch (Hz); steps are semitones above it. */
  base: number;
  /** Seconds a step lasts. */
  step: number;
  /** How long a note rings (s). */
  ring: number;
  gain: number;
  steps: Step[];
  /** Notes drawn at random from these instead (chimes, birds), each step with this chance. */
  random?: { notes: number[]; chance: number };
  /** Each note glides up this many semitones (birdsong, singing flowers). */
  slide?: number;
}

const V: Record<string, Voice> = {
  'music-box': { wave: 'triangle', base: 880, step: 0.26, ring: 0.45, gain: 0.22, steps: [0, 7, 12, 7, 9, 7, 4, null, 0, 4, 7, 12, 9, null, 7, null] },
  speaker: { wave: 'square', base: 110, step: 0.2, ring: 0.16, gain: 0.12, steps: [0, null, 0, 12, null, 0, 7, null, 0, null, 0, 12, null, 10, 7, null] },
  jukebox: { wave: 'triangle', base: 220, step: 0.22, ring: 0.3, gain: 0.16, steps: [[0, 4, 7], null, 7, 9, [5, 9, 12], null, 9, 7, [7, 11, 14], null, 11, 9, [0, 4, 7], null, 4, null] },
  'grand-piano': { wave: 'triangle', base: 262, step: 0.42, ring: 1.4, gain: 0.18, steps: [[0, 4, 7], 12, 7, 4, [-3, 0, 4], 9, 4, 0, [-7, -3, 0], 5, 0, -3, [-5, -1, 2], 7, 2, -1] },
  'wind-chime': { wave: 'sine', base: 1047, step: 0.3, ring: 2.2, gain: 0.12, steps: [], random: { notes: [0, 2, 4, 7, 9, 12], chance: 0.28 } },
  radio: { wave: 'square', base: 330, step: 0.16, ring: 0.12, gain: 0.07, steps: [0, 3, 7, 3, 10, 7, 3, null, 0, 3, 7, 12, 10, 7, null, null] },
  gramophone: { wave: 'triangle', base: 196, step: 0.3, ring: 0.5, gain: 0.17, steps: [0, [4, 7], [4, 7], 5, [9, 12], [9, 12], 7, [11, 14], [11, 14], 0, [4, 7], [4, 7]] },
  karaoke: { wave: 'sawtooth', base: 392, step: 0.24, ring: 0.22, gain: 0.07, steps: [0, 0, 2, 4, null, 4, 2, 0, -3, null, -3, 0, 2, null, null, null] },
  'singing-flowers': { wave: 'sine', base: 659, step: 0.36, ring: 0.5, gain: 0.13, steps: [0, null, 4, null, 7, null, 4, null, 2, null, 5, null, 9, null, null, null], slide: 2 },
  birdhouse: { wave: 'sine', base: 2093, step: 0.18, ring: 0.12, gain: 0.08, steps: [], random: { notes: [0, 3, 5, 7], chance: 0.22 }, slide: 5 },
  'cuckoo-clock': { wave: 'sine', base: 659, step: 0.32, ring: 0.4, gain: 0.16, steps: [9, 5, null, null, null, null, null, null, null, null, null, null, null, null, null, null] },
};
V.turntable = { wave: 'triangle', base: 196, step: 0.34, ring: 0.5, gain: 0.12, steps: [[0, 4, 7], null, null, 7, [5, 9, 12], null, null, 9, [-3, 0, 4], null, null, 4, [-5, -1, 2], null, 2, null] };
V['cd-player'] = { wave: 'sine', base: 392, step: 0.3, ring: 0.6, gain: 0.14, steps: [0, 4, 7, 4, 9, 7, 4, null, 2, 5, 9, 5, 7, null, null, null] };

/**
 * The discs (items of kind "disc"): little tunes written for the island, each a few voices together. Vinyls play on a
 * turntable or a gramophone, CDs on a CD player; the jukebox takes both.
 */
const TRACKS: Record<string, Voice[]> = {
  'vinyl-sunset': [
    { wave: 'triangle', base: 220, step: 0.3, ring: 0.9, gain: 0.1, steps: [[0, 4, 11], null, null, [0, 4, 11], null, null, [-3, 0, 7], null, [-3, 0, 7], null, null, [2, 5, 9], null, null, [-5, 2, 7], null] },
    { wave: 'sine', base: 55, step: 0.3, ring: 0.5, gain: 0.22, steps: [0, null, null, 0, null, null, -3, null, -3, null, null, 2, null, null, -5, null] },
    { wave: 'square', base: 3520, step: 0.15, ring: 0.03, gain: 0.015, steps: [0, null, 0, 0, null, 0, 0, null] },
  ],
  'vinyl-waltz': [
    { wave: 'triangle', base: 131, step: 0.28, ring: 0.6, gain: 0.14, steps: [[0], [12, 16, 19], [12, 16, 19], [-5], [14, 17, 21], [14, 17, 21], [-1], [14, 19, 23], [14, 19, 23], [0], [12, 16, 19], [12, 16, 19]] },
    { wave: 'sine', base: 523, step: 0.28, ring: 0.7, gain: 0.12, steps: [7, null, 5, 4, null, null, 2, null, 4, 0, null, null] },
  ],
  'vinyl-jazz': [
    { wave: 'triangle', base: 82, step: 0.32, ring: 0.3, gain: 0.2, steps: [0, 4, 7, 9, 10, 9, 7, 4, 5, 9, 12, 14, 15, 14, 12, 9] },
    { wave: 'sine', base: 262, step: 0.32, ring: 0.55, gain: 0.08, steps: [[4, 10, 14], null, null, [4, 10, 14], null, null, null, null, [9, 15, 19], null, null, [9, 15, 19], null, null, null, null] },
    { wave: 'square', base: 2637, step: 0.16, ring: 0.04, gain: 0.012, steps: [0, null, null, 0, 0, null, null, 0] },
  ],
  'cd-rain': [
    { wave: 'sine', base: 523, step: 0.45, ring: 1.3, gain: 0.12, steps: [0, 7, null, 12, null, 9, 7, null, 5, null, 4, null, 2, null, null, null] },
    { wave: 'triangle', base: 131, step: 0.9, ring: 1.8, gain: 0.1, steps: [[0, 7], [-3, 4], [-7, 0], [-5, 2]] },
  ],
  'cd-chip': [
    { wave: 'square', base: 523, step: 0.13, ring: 0.1, gain: 0.05, steps: [0, 4, 7, 12, 0, 4, 7, 12, -3, 0, 4, 9, -3, 0, 4, 9, -5, -1, 2, 7, -5, -1, 2, 7, -7, -3, 0, 5, -7, -3, 0, 5] },
    { wave: 'square', base: 131, step: 0.26, ring: 0.2, gain: 0.06, steps: [0, 0, 0, 0, -3, -3, -3, -3, -5, -5, -5, -5, -7, -7, -7, -7] },
  ],
  'cd-festival': [
    { wave: 'sine', base: 65, step: 0.2, ring: 0.28, gain: 0.3, steps: [0, null, 0, null, null, 0, null, 0, 0, null, 0, 0, null, 0, null, null] },
    { wave: 'triangle', base: 784, step: 0.4, ring: 0.45, gain: 0.08, steps: [0, 2, 4, 7, 9, 7, 4, 2], slide: 1 },
  ],
  'cd-lullaby': [
    { wave: 'sine', base: 392, step: 0.5, ring: 1.1, gain: 0.12, steps: [7, 4, null, 7, 4, null, 9, 7, 5, 4, 2, null, 0, null, null, null] },
    { wave: 'triangle', base: 98, step: 1, ring: 2, gain: 0.09, steps: [[0, 7], [5, 12], [7, 14], [0, 7]] },
  ],
  'cd-boss': [
    { wave: 'sawtooth', base: 110, step: 0.15, ring: 0.12, gain: 0.05, steps: [0, 0, 12, 0, 0, 10, 0, 0, 7, 0, 0, 6, 0, 5, 3, null] },
    { wave: 'square', base: 440, step: 0.3, ring: 0.26, gain: 0.04, steps: [0, null, 3, 5, 6, 5, 3, null, 0, null, -2, null, 0, null, null, null] },
  ],
};
export const hasVoice = (id: string) => id in V || id in TRACKS;
/** Which discs a music maker takes. */
export const DISC_PLAYERS: Record<string, 'vinyl' | 'cd' | 'both'> = { turntable: 'vinyl', gramophone: 'vinyl', 'cd-player': 'cd', jukebox: 'both', radio: 'cd' };
export const discFits = (player: string, disc: string) => {
  const t = DISC_PLAYERS[player];
  return t === 'both' || (t === 'vinyl' && disc.startsWith('vinyl-')) || (t === 'cd' && disc.startsWith('cd-'));
};

let ctx: AudioContext | null = null;
function audio(): AudioContext | null {
  if (!useProgress.getState().sound) return null;
  try {
    ctx ??= new AudioContext();
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function note(ac: AudioContext, v: Voice, semis: number, at: number, gain: number, pan: number) {
  const o = ac.createOscillator();
  const g = ac.createGain();
  const p = ac.createStereoPanner();
  const f = v.base * 2 ** (semis / 12);
  o.type = v.wave;
  o.frequency.setValueAtTime(f, at);
  if (v.slide) o.frequency.exponentialRampToValueAtTime(f * 2 ** (v.slide / 12), at + v.ring * 0.8);
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), at + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, at + v.ring);
  p.pan.value = pan;
  o.connect(g).connect(p).connect(ac.destination);
  o.start(at);
  o.stop(at + v.ring + 0.05);
}

/** How far (cells) a music maker is heard. */
export const HEAR = 7;

export interface Source {
  /** Its layer key ("<cell>", "b<cell>", "t<cell>"). */
  key: string;
  /** What it plays: its own tune (its item id) or a disc's. */
  id: string;
  x: number;
  y: number;
  /** Its volume (its own setting, 0–1; none: full). */
  gain?: number;
}

/**
 * Plays the island's music makers near the listener: call `tick` often (it schedules a little ahead) with where the
 * listener is. `stop` when leaving.
 */
export function islandBand() {
  const next = new Map<string, { at: number; i: number }>();
  return {
    tick(sources: Source[], lx: number, ly: number) {
      const ac = audio();
      if (!ac) return;
      const level = useProgress.getState().sfxVolume / 100;
      const now = ac.currentTime;
      for (const src of sources) {
        const voices = TRACKS[src.id] ?? (V[src.id] ? [V[src.id]] : []);
        voices.forEach((v, layer) => {
          const s = { ...src, cell: `${src.key}:${src.id}:${layer}` };
          const dx = s.x - lx;
          const d = Math.hypot(dx, s.y - ly);
          if (d > HEAR) {
            next.delete(s.cell);
            return;
          }
          // Each starts on the next whole step of a shared clock, so two of a kind stay in time.
          let st = next.get(s.cell);
          if (!st || st.at < now) st = { at: Math.ceil(now / v.step) * v.step, i: Math.round(Math.ceil(now / v.step)) };
          const gain = v.gain * level * (src.gain ?? 1) * (1 - d / HEAR) ** 2;
          if (gain <= 0.0002) {
            next.delete(s.cell);
            return;
          }
          const pan = Math.max(-1, Math.min(1, dx / HEAR));
          while (st.at < now + 0.2) {
            if (v.random) {
              if (Math.random() < v.random.chance) note(ac, v, v.random.notes[Math.floor(Math.random() * v.random.notes.length)], st.at, gain, pan);
            } else {
              const step = v.steps[st.i % v.steps.length];
              if (step !== null) for (const n of Array.isArray(step) ? step : [step]) note(ac, v, n, st.at, gain / (Array.isArray(step) ? 1.6 : 1), pan);
            }
            st = { at: st.at + v.step, i: st.i + 1 };
          }
          next.set(s.cell, st);
        });
      }
    },
    stop() {
      next.clear();
    },
  };
}
