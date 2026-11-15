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
export const hasVoice = (id: string) => id in V;

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
  cell: number;
  id: string;
  x: number;
  y: number;
}

/**
 * Plays the island's music makers near the listener: call `tick` often (it schedules a little ahead) with where the
 * listener is. `stop` when leaving.
 */
export function islandBand() {
  const next = new Map<number, { at: number; i: number }>();
  return {
    tick(sources: Source[], lx: number, ly: number) {
      const ac = audio();
      if (!ac) return;
      const level = useProgress.getState().sfxVolume / 100;
      const now = ac.currentTime;
      for (const s of sources) {
        const v = V[s.id];
        if (!v) continue;
        const dx = s.x - lx;
        const d = Math.hypot(dx, s.y - ly);
        if (d > HEAR) {
          next.delete(s.cell);
          continue;
        }
        // Each starts on the next whole step of a shared clock, so two of a kind stay in time.
        let st = next.get(s.cell);
        if (!st || st.at < now) st = { at: Math.ceil(now / v.step) * v.step, i: Math.round(Math.ceil(now / v.step)) };
        const gain = v.gain * level * (1 - d / HEAR) ** 2;
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
      }
    },
    stop() {
      next.clear();
    },
  };
}
