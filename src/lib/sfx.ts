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

/** A pack being torn by hand, live: the rip follows the finger, a tone rises with the tear. */
export interface TearSound {
  /** How far the tear has gone (0–1) and how fast the finger moves now (0 = still, 1 = fast). */
  update: (progress: number, speed: number) => void;
  /** The breath before it gives: the rip goes quiet, the tone swells. */
  hold: () => void;
  /** It gives: a loud rip, a thump and the tone's chord ringing out. */
  snap: () => void;
  /** Let go without tearing it all (or the pack closed): everything fades. */
  stop: () => void;
}

/**
 * The tone under the tear, by the best card inside (0 = Common … 5 = Omni): one plain note, then a fifth,
 * a bright triad, a full chord with its octave, and for Mythic and Omni a choir of detuned voices.
 */
const TEAR_CHORDS: number[][] = [[220], [220, 330], [262, 330, 392], [330, 415, 494, 660], [262, 330, 392, 523, 659], [220, 277, 330, 440, 554, 659]];

function tearSound(level: number): TearSound | null {
  const ac = audio();
  const vol = useProgress.getState().sfxVolume / 100;
  if (!ac || vol <= 0) return null;
  const chord = TEAR_CHORDS[Math.max(0, Math.min(TEAR_CHORDS.length - 1, level))];
  const choir = level >= 4;
  // The rip: noise on a loop, its band and its volume following the finger.
  const buf = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate);
  const data = buf.getChannelData(0);
  // Paper is crackly, not smooth: the noise comes in grains.
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (Math.random() < 0.3 ? 1 : 0.35);
  const src = ac.createBufferSource();
  src.buffer = buf;
  src.loop = true;
  const band = ac.createBiquadFilter();
  band.type = 'bandpass';
  band.Q.value = 0.9;
  band.frequency.value = 900;
  const rip = ac.createGain();
  rip.gain.value = 0.0001;
  src.connect(band).connect(rip).connect(ac.destination);
  src.start();
  // The tone: the chord, low and quiet at first, rising and swelling with the tear.
  const lp = ac.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = choir ? 2400 : 1800;
  const tone = ac.createGain();
  tone.gain.value = 0.0001;
  tone.connect(lp).connect(ac.destination);
  const oscs = chord.flatMap((f) => (choir ? [f * 0.996, f * 1.004] : [f])).map((f) => {
    const osc = ac.createOscillator();
    osc.type = choir ? 'sawtooth' : 'triangle';
    osc.frequency.value = f * 0.8;
    osc.connect(tone);
    osc.start();
    return { osc, f };
  });
  const toneLevel = (choir ? 0.022 : 0.05) * vol;
  let done = false;
  const end = (release: number) => {
    if (done) return;
    done = true;
    const now = ac.currentTime;
    rip.gain.setTargetAtTime(0.0001, now, release / 4);
    tone.gain.setTargetAtTime(0.0001, now, release / 4);
    src.stop(now + release + 0.1);
    for (const o of oscs) o.osc.stop(now + release + 0.1);
  };
  return {
    update(progress, speed) {
      if (done) return;
      const now = ac.currentTime;
      const s = Math.max(0, Math.min(1, speed));
      rip.gain.setTargetAtTime(s > 0.02 ? (0.03 + 0.22 * s) * vol : 0.0001, now, 0.03);
      band.frequency.setTargetAtTime(700 + 2800 * s, now, 0.05);
      tone.gain.setTargetAtTime(Math.max(0.0001, toneLevel * Math.max(0, Math.min(1, progress))), now, 0.08);
      for (const o of oscs) o.osc.frequency.setTargetAtTime(o.f * (0.8 + 0.2 * progress), now, 0.08);
    },
    hold() {
      if (done) return;
      const now = ac.currentTime;
      rip.gain.setTargetAtTime(0.0001, now, 0.02);
      tone.gain.setTargetAtTime(toneLevel * 1.5, now, 0.06);
      for (const o of oscs) o.osc.frequency.setTargetAtTime(o.f, now, 0.05);
    },
    snap() {
      end(0.35);
      noise(0.38, 3200, 650, 0.22);
      play([{ freq: 95, dur: 0.28, type: 'sine', gain: 0.28, slide: 38 }]);
      play(chord.map((f, i) => ({ freq: f * 2, at: 0.04 + i * 0.035, dur: choir ? 1.2 : 0.7, type: 'triangle' as const, gain: choir ? 0.03 : 0.045 })));
    },
    stop() {
      end(0.15);
    },
  };
}

export const sfx = {
  /** Tearing a pack by hand (see TearSound); null when sound is off. */
  tearStart: (level: number) => tearSound(level),
  /** The foil wrapper crinkling as it's picked up: a handful of tiny dry crackles. */
  crinkle: () => {
    for (let i = 0; i < 6; i++) window.setTimeout(() => noise(0.025 + Math.random() * 0.035, 6000, 2500 + Math.random() * 2000, 0.05), i * 32 + Math.random() * 22);
  },
  /** A heartbeat: two low thumps (lub-dub). */
  heartbeat: () =>
    play([
      { freq: 72, dur: 0.09, type: 'sine', gain: 0.32, slide: 46 },
      { freq: 64, at: 0.15, dur: 0.11, type: 'sine', gain: 0.24, slide: 40 },
    ]),
  /** The wait before the best card's star: a quiet drone rising, its pulse quickening. */
  suspense: (seconds: number) => drone(seconds),
  /** A black hole opening: a deep hum swelling under everything. */
  blackHole: () => {
    drone(2.4, 0.03);
    play([{ freq: 55, dur: 2.2, type: 'sine', gain: 0.12, slide: 38 }]);
  },
  /** A star pulled into the black hole: air rushing in and a falling whistle, swallowed. */
  swallow: () => {
    noise(0.7, 2600, 120, 0.12);
    play([{ freq: 1800, dur: 0.7, type: 'sine', gain: 0.04, slide: 80 }]);
  },
  /** Two planets drawn together: a low hum rising, their two tones closing in on one. */
  planets: (seconds: number) => {
    drone(seconds, 0.03);
    play([
      { freq: 110, dur: seconds, type: 'sine', gain: 0.07, slide: 220 },
      { freq: 330, dur: seconds, type: 'triangle', gain: 0.02, slide: 220 },
    ]);
  },
  /** Two planets becoming one: a soft impact, then a bright major chord. */
  embrace: () => {
    noise(0.6, 1800, 200, 0.12);
    play([
      { freq: 220, dur: 0.6, type: 'sine', gain: 0.16, slide: 110 },
      { freq: 523, at: 0.1, dur: 0.9, type: 'triangle', gain: 0.05 },
      { freq: 659, at: 0.18, dur: 0.9, type: 'triangle', gain: 0.05 },
      { freq: 784, at: 0.26, dur: 1.1, type: 'triangle', gain: 0.05 },
      { freq: 1047, at: 0.34, dur: 1.2, type: 'sine', gain: 0.04 },
    ]);
  },
  /** A star swelling before it blows: a rising, unsteady roar. */
  swell: (seconds: number) => {
    drone(seconds, 0.045);
    noise(seconds, 200, 1400, 0.05);
    play([{ freq: 70, dur: seconds, type: 'sawtooth', gain: 0.03, slide: 180 }]);
  },
  /** A supernova: a huge crack, a long falling boom, glittering after. */
  supernova: () => {
    noise(1.4, 5000, 80, 0.22);
    play([
      { freq: 90, dur: 1.6, type: 'sine', gain: 0.22, slide: 30 },
      { freq: 180, dur: 0.8, type: 'square', gain: 0.03, slide: 50 },
      ...[1568, 1976, 2349, 2637, 3136].map((freq, k) => ({ freq, at: 0.25 + k * 0.09, dur: 0.4, type: 'triangle' as const, gain: 0.025 })),
    ]);
  },
  /** Before the Big Bang: everything drawn in to a point, a deep falling hum, then silence. */
  collapse: (seconds: number) => {
    play([{ freq: 160, dur: seconds, type: 'sine', gain: 0.09, slide: 30 }]);
    noise(seconds * 0.8, 3000, 60, 0.05);
  },
  /** The Big Bang: the deepest boom of all, a rush outward, a choir of high tones. */
  bigBang: () => {
    noise(2.2, 6000, 60, 0.26);
    play([
      { freq: 45, dur: 2.4, type: 'sine', gain: 0.26, slide: 25 },
      { freq: 90, dur: 1.4, type: 'sawtooth', gain: 0.04, slide: 40 },
      ...[523, 659, 784, 1047, 1319, 1568].map((freq, k) => ({ freq, at: 0.4 + k * 0.12, dur: 1.6, type: 'sine' as const, gain: 0.035 })),
    ]);
  },
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
  /** The roulette: a peg clicking past the pointer (a little higher as the wheel slows). */
  wheelTick: (pitch = 1) => play([{ freq: 1500 * pitch, dur: 0.025, type: 'square', gain: 0.03 }, { freq: 320, dur: 0.03, type: 'triangle', gain: 0.05 }]),
  /** The roulette: the wheel set spinning. */
  wheelSpin: () => {
    noise(0.45, 300, 2400, 0.08);
    play([{ freq: 220, dur: 0.35, type: 'triangle', gain: 0.06, slide: 660 }]);
  },
  /** The roulette: coins pouring out, more of them for a bigger win. */
  coins: (n = 8) =>
    play(Array.from({ length: n }, (_, i) => ({ freq: 1900 + ((i * 7) % 5) * 260, at: i * 0.055, dur: 0.09, type: 'triangle' as const, gain: 0.04, slide: 2600 }))),
  /** The roulette: a miss, a sad trombone. */
  wahWah: () =>
    play([
      { freq: 311, dur: 0.28, type: 'sawtooth', gain: 0.05, slide: 293 },
      { freq: 293, at: 0.3, dur: 0.28, type: 'sawtooth', gain: 0.05, slide: 277 },
      { freq: 277, at: 0.6, dur: 0.6, type: 'sawtooth', gain: 0.05, slide: 220 },
    ]),
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
