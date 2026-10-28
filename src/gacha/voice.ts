// A mythic's voice line, read aloud by the browser's own voice — pitched and paced for each star
// (a slow, low Yoda; a quick, bright Tracer; a whispering Creeper). Silent when the sound is off or
// the browser can't speak.
import { useProgress } from '../store/progress';

const VOICE: Record<string, { pitch: number; rate: number }> = {
  lol: { pitch: 1.3, rate: 0.95 },
  overwatch: { pitch: 1.5, rate: 1.25 },
  minecraft: { pitch: 0.3, rate: 0.6 },
  onepiece: { pitch: 1.3, rate: 1.15 },
  dbz: { pitch: 1.1, rate: 1.05 },
  naruto: { pitch: 1.35, rate: 1.15 },
  starwars: { pitch: 0.55, rate: 0.75 },
  harrypotter: { pitch: 1.1, rate: 1 },
  lotr: { pitch: 1.05, rate: 0.9 },
  mcu: { pitch: 0.85, rate: 1 },
  smash: { pitch: 1.6, rate: 1.2 },
  genshin: { pitch: 0.75, rate: 0.95 },
  wow: { pitch: 1.15, rate: 0.9 },
  inazuma: { pitch: 1.3, rate: 1.15 },
};

export const canSpeak = () => typeof window !== 'undefined' && 'speechSynthesis' in window;

/** Says a mythic's line in its own voice (once at a time). */
export function speak(line: string, set: string) {
  if (!canSpeak() || !useProgress.getState().sound) return;
  const synth = window.speechSynthesis;
  synth.cancel();
  const u = new SpeechSynthesisUtterance(line);
  const v = VOICE[set] ?? { pitch: 1, rate: 1 };
  u.pitch = v.pitch;
  u.rate = v.rate;
  u.volume = Math.min(1, useProgress.getState().sfxVolume / 100);
  u.lang = 'en-US';
  const english = synth.getVoices().find((x) => x.lang.startsWith('en'));
  if (english) u.voice = english;
  synth.speak(u);
}
