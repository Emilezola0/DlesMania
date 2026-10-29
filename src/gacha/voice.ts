// A mythic's voice line: the real recording when there is one (the game stars: the fan wikis host
// their voice files), else the browser's own voice — the most natural one it has, of the right
// gender and accent, pitched and paced for each star (a slow, low Yoda; a quick, bright Naruto).
// Silent when the sound is off; a recording that can't play (some browsers can't read .ogg) falls
// back to the browser's voice.
import { useProgress } from '../store/progress';
import type { Card } from './cards';

interface Speaker {
  pitch: number;
  rate: number;
  female?: boolean;
  /** Preferred accent ("en-GB"); any English otherwise. */
  lang?: string;
}

const SPEAKERS: Record<string, Speaker> = {
  lol: { pitch: 1.15, rate: 0.95, female: true },
  overwatch: { pitch: 1.3, rate: 1.2, female: true, lang: 'en-GB' },
  minecraft: { pitch: 0.3, rate: 0.6 },
  onepiece: { pitch: 1.35, rate: 1.15 },
  dbz: { pitch: 1.15, rate: 1.05 },
  naruto: { pitch: 1.4, rate: 1.15 },
  starwars: { pitch: 0.5, rate: 0.72 },
  harrypotter: { pitch: 1.1, rate: 1, lang: 'en-GB' },
  lotr: { pitch: 1.05, rate: 0.9, lang: 'en-GB' },
  mcu: { pitch: 0.9, rate: 1.05, lang: 'en-US' },
  smash: { pitch: 1.5, rate: 1.15 },
  genshin: { pitch: 0.8, rate: 0.95 },
  wow: { pitch: 1.1, rate: 0.9, female: true },
  inazuma: { pitch: 1.3, rate: 1.15 },
};

// Voice names that say which way they sound (browsers don't tell): Windows, macOS, Chrome and Edge voices.
const FEMALE = /female|aria|jenny|sonia|libby|maisie|natasha|emma|ava|michelle|samantha|zira|hazel|susan|karen|moira|tessa|victoria|serena|kate|fiona|catherine|clara/i;
const MALE = /\bmale|guy|ryan|thomas|daniel|david|mark|george|alex|fred|christopher|eric|brian|andrew|roger|steffan|william|oliver|arthur|aaron|james/i;
/** The most lifelike voices first: Edge's "Natural"/"Online", then Google's, then the rest. */
const QUALITY = (name: string) => (/natural|neural|online/i.test(name) ? 3 : /google/i.test(name) ? 2 : 1);

function pickVoice(sp: Speaker): SpeechSynthesisVoice | undefined {
  const english = window.speechSynthesis.getVoices().filter((v) => v.lang.toLowerCase().startsWith('en'));
  const score = (v: SpeechSynthesisVoice) =>
    QUALITY(v.name) * 10 + (sp.lang && v.lang === sp.lang ? 4 : 0) + (sp.female ? (FEMALE.test(v.name) ? 5 : MALE.test(v.name) ? -5 : 0) : MALE.test(v.name) ? 5 : FEMALE.test(v.name) ? -5 : 0);
  return english.sort((a, b) => score(b) - score(a))[0];
}

export const canSpeak = () => typeof window !== 'undefined' && 'speechSynthesis' in window;

/** Reads a line aloud in a star's voice. */
function say(line: string, set: string) {
  if (!canSpeak()) return;
  const synth = window.speechSynthesis;
  synth.cancel();
  const sp = SPEAKERS[set] ?? { pitch: 1, rate: 1 };
  const u = new SpeechSynthesisUtterance(line);
  const voice = pickVoice(sp);
  if (voice) u.voice = voice;
  u.lang = voice?.lang ?? sp.lang ?? 'en-US';
  // Lifelike voices sound worse pushed far from their own pitch: they get half the shift.
  const k = voice && QUALITY(voice.name) > 1 ? 0.5 : 1;
  u.pitch = 1 + (sp.pitch - 1) * k;
  u.rate = 1 + (sp.rate - 1) * k;
  u.volume = Math.min(1, useProgress.getState().sfxVolume / 100);
  synth.speak(u);
}

let playing: HTMLAudioElement | null = null;

/** A card's voice line, heard: its recording if it has one, else the browser's voice. */
export function playVoice(card: Card) {
  if (!card.voice || !useProgress.getState().sound) return;
  playing?.pause();
  if (!card.audio) return say(card.voice, card.set);
  const a = new Audio(card.audio);
  a.volume = Math.min(1, useProgress.getState().sfxVolume / 100);
  playing = a;
  a.play().catch(() => say(card.voice!, card.set));
  a.onerror = () => say(card.voice!, card.set);
}

/** Whether a card can be heard at all (a recording, or a browser that speaks). */
export const canHear = (card: Card) => !!card.voice && (!!card.audio || canSpeak());
