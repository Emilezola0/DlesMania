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
  if (!ac) return;
  const t0 = ac.currentTime;
  for (const { freq, at = 0, dur = 0.12, type = 'sine', gain = 0.12, slide } of notes) {
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

export const sfx = {
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
