import { useProgress } from '../store/progress';

/** Tiny synthesized UI sounds (WebAudio) — no audio files to ship or license. */
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

interface Note {
  freq: number;
  at?: number;
  dur?: number;
  type?: OscillatorType;
  gain?: number;
  /** Frequency to glide to over the note's duration. */
  slide?: number;
}

function play(notes: Note[]) {
  const ac = audio();
  // The effects volume scales every note (0 = silent).
  const level = useProgress.getState().sfxVolume / 100;
  if (!ac || level <= 0) return;
  const t0 = ac.currentTime;
  for (const { freq, at = 0, dur = 0.12, type = 'sine', gain: base = 0.12, slide } of notes) {
    const gain = Math.max(0.0002, base * level);
    const osc = ac.createOscillator();
    const amp = ac.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0 + at);
    if (slide) osc.frequency.exponentialRampToValueAtTime(slide, t0 + at + dur);
    amp.gain.setValueAtTime(0.0001, t0 + at);
    amp.gain.exponentialRampToValueAtTime(gain, t0 + at + 0.01);
    amp.gain.exponentialRampToValueAtTime(0.0001, t0 + at + dur);
    osc.connect(amp).connect(ac.destination);
    osc.start(t0 + at);
    osc.stop(t0 + at + dur + 0.02);
  }
}

/** A burst of filtered noise, its band sweeping from one frequency to another: paper tearing, air rushing. */
function noise(dur: number, from: number, to: number, base = 0.12) {
  const ac = audio();
  const level = useProgress.getState().sfxVolume / 100;
  if (!ac || level <= 0) return;
  const t0 = ac.currentTime;
  const buf = ac.createBuffer(1, Math.ceil(ac.sampleRate * dur), ac.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  const src = ac.createBufferSource();
  src.buffer = buf;
  const band = ac.createBiquadFilter();
  band.type = 'bandpass';
  band.Q.value = 1.2;
  band.frequency.setValueAtTime(from, t0);
  band.frequency.exponentialRampToValueAtTime(to, t0 + dur);
  const amp = ac.createGain();
  amp.gain.setValueAtTime(0.0001, t0);
  amp.gain.exponentialRampToValueAtTime(Math.max(0.0002, base * level), t0 + 0.02);
  amp.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(band).connect(amp).connect(ac.destination);
  src.start(t0);
  src.stop(t0 + dur + 0.02);
}

/**
 * A soft suspense drone for `dur` seconds: two low, slightly detuned tones rising a fifth, a slow tremolo
 * quickening, swelling a little and cut short at the end (the moment something happens).
 */
function drone(dur: number, base = 0.035) {
  const ac = audio();
  const level = useProgress.getState().sfxVolume / 100;
  if (!ac || level <= 0) return;
  const t0 = ac.currentTime;
  const amp = ac.createGain();
  amp.gain.setValueAtTime(0.0001, t0);
  amp.gain.exponentialRampToValueAtTime(Math.max(0.0002, base * level * 0.5), t0 + 0.4);
  amp.gain.exponentialRampToValueAtTime(Math.max(0.0002, base * level), t0 + dur - 0.08);
  amp.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  // The tremolo: the volume pulsing, faster and faster, like a heartbeat speeding up.
  const trem = ac.createGain();
  trem.gain.value = 0.7;
  const lfo = ac.createOscillator();
  lfo.frequency.setValueAtTime(3, t0);
  lfo.frequency.exponentialRampToValueAtTime(12, t0 + dur);
  const depth = ac.createGain();
  depth.gain.value = 0.3;
  lfo.connect(depth).connect(trem.gain);
  trem.connect(amp).connect(ac.destination);
  for (const [freq, type] of [[110, 'triangle'], [110.8, 'sine']] as const) {
    const osc = ac.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    osc.frequency.exponentialRampToValueAtTime(freq * 1.5, t0 + dur);
    osc.connect(trem);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }
  lfo.start(t0);
  lfo.stop(t0 + dur + 0.02);
}

export const sfx = {
  /** The wait before the best card's star: a quiet drone rising, its pulse quickening. */
  suspense: (seconds: number) => drone(seconds),
  /** Two stars crashing together and bursting: a crack, a low boom, and sparkles. */
  clash: () => {
    noise(0.5, 3500, 250, 0.16);
    play([
      { freq: 140, dur: 0.45, type: 'sine', gain: 0.18, slide: 40 },
      { freq: 1568, at: 0.08, dur: 0.18, type: 'triangle', gain: 0.03 },
      { freq: 2093, at: 0.16, dur: 0.2, type: 'triangle', gain: 0.03 },
      { freq: 2637, at: 0.24, dur: 0.3, type: 'triangle', gain: 0.025 },
    ]);
  },
  click: () => play([{ freq: 660, dur: 0.05, type: 'triangle', gain: 0.06 }]),
  select: () => play([{ freq: 880, dur: 0.04, type: 'square', gain: 0.03 }]),
  wrong: () =>
    play([
      { freq: 180, dur: 0.18, type: 'sawtooth', gain: 0.07, slide: 120 },
      { freq: 150, at: 0.12, dur: 0.22, type: 'sawtooth', gain: 0.06, slide: 90 },
    ]),
  near: () => play([{ freq: 520, dur: 0.1, type: 'triangle', gain: 0.08 }, { freq: 440, at: 0.1, dur: 0.14, type: 'triangle', gain: 0.07 }]),
  correct: () =>
    play([
      { freq: 523.25, dur: 0.12, type: 'triangle' },
      { freq: 659.25, at: 0.09, dur: 0.12, type: 'triangle' },
      { freq: 783.99, at: 0.18, dur: 0.28, type: 'triangle' },
    ]),
  lose: () =>
    play([
      { freq: 392, dur: 0.2, type: 'triangle', gain: 0.09 },
      { freq: 330, at: 0.18, dur: 0.2, type: 'triangle', gain: 0.09 },
      { freq: 262, at: 0.36, dur: 0.45, type: 'triangle', gain: 0.09 },
    ]),
  streak: () =>
    play(
      [523.25, 659.25, 783.99, 1046.5, 1318.5].map((freq, i) => ({ freq, at: i * 0.08, dur: i === 4 ? 0.5 : 0.14, type: 'square' as const, gain: 0.05 })),
    ),
  /** Boss Battle: a blow landed on the boss. */
  hit: () =>
    play([
      { freq: 120, dur: 0.25, type: 'square', gain: 0.12, slide: 40 },
      { freq: 900, dur: 0.08, type: 'sawtooth', gain: 0.05, slide: 300 },
      { freq: 660, at: 0.12, dur: 0.18, type: 'triangle', gain: 0.08 },
    ]),
  /** Boss Battle: the boss strikes the player. */
  hurt: () =>
    play([
      { freq: 90, dur: 0.4, type: 'sawtooth', gain: 0.12, slide: 45 },
      { freq: 220, at: 0.05, dur: 0.3, type: 'square', gain: 0.05, slide: 70 },
    ]),
  /** A card sorted or flung away. */
  whoosh: () => play([{ freq: 1400, dur: 0.12, type: 'triangle', gain: 0.035, slide: 380 }]),
  /** Short tick for the last seconds of a timer. */
  tick: () => play([{ freq: 1200, dur: 0.03, type: 'square', gain: 0.025 }]),
  /** A pack tearing open. */
  tear: () => noise(0.28, 2400, 900, 0.16),
  /** A shooting star crossing the screen: rushing air and a falling whistle. */
  meteor: (long = false) => {
    noise(long ? 1.3 : 0.9, 400, 3200, 0.09);
    play([{ freq: long ? 2400 : 1800, dur: long ? 1.2 : 0.8, type: 'sine', gain: 0.03, slide: 500 }]);
  },
  /** Something building up: a rising shimmer, longer and higher for rarer things. */
  shimmer: (steps = 4) =>
    play(Array.from({ length: steps }, (_, i) => ({ freq: 660 * 2 ** (i / 4), at: i * 0.09, dur: 0.14, type: 'triangle' as const, gain: 0.035 }))),
  /** A small pop: a card turned. */
  pop: () => play([{ freq: 520, dur: 0.07, type: 'triangle', gain: 0.08, slide: 880 }]),
  victory: () =>
    play(
      [392, 523.25, 659.25, 783.99, 659.25, 783.99, 1046.5].map((freq, i) => ({
        freq,
        at: i < 4 ? i * 0.11 : 0.44 + (i - 4) * 0.16,
        dur: i === 6 ? 0.8 : 0.16,
        type: 'square' as const,
        gain: 0.05,
      })),
    ),
};

/**
 * What a sound says about the play: a right answer, a mistake, a big moment (a streak, a win).
 * Every game already plays these, so listening here hears every game — equipped cards react to it
 * (src/gacha/Reactions.tsx).
 */
export type Cue = 'good' | 'bad' | 'great';
const listeners = new Set<(c: Cue) => void>();
export function onCue(f: (c: Cue) => void): () => void {
  listeners.add(f);
  return () => void listeners.delete(f);
}
const CUES: Partial<Record<keyof typeof sfx, Cue>> = { correct: 'good', hit: 'good', wrong: 'bad', hurt: 'bad', lose: 'bad', streak: 'great', victory: 'great' };
for (const [name, cue] of Object.entries(CUES) as [keyof typeof sfx, Cue][]) {
  const sound = sfx[name] as (...args: unknown[]) => void;
  (sfx as Record<string, (...args: unknown[]) => void>)[name] = (...args) => {
    listeners.forEach((f) => f(cue));
    sound(...args);
  };
}
