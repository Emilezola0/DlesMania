// A mythic's voice line: the real recording when there is one (the game stars: the fan wikis host
// their voice files), else the browser's own voice — the most natural one it has, of the right
// gender and accent, pitched and paced for each star (a slow, low Yoda; a quick, bright Naruto).
// Silent when the sound is off; a recording that can't play (some browsers can't read .ogg) falls
// back to the browser's voice. A recording can also be a moment of a YouTube video:
// "youtube:VIDEO_ID@start-end" (seconds), played in a hidden player; or of a TikTok: "tiktok:POST_ID@start-end".
import { createTikTokPlayer, TT_PLAYING, type TikTokPlayer } from '../lib/tiktok';
import { loadYouTube, YT_ENDED, YT_PLAYING, type YTPlayer } from '../lib/youtube';
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
  forts: { pitch: 0.85, rate: 1, lang: 'en-GB' },
  forhonor: { pitch: 0.8, rate: 0.95, lang: 'en-GB' },
  destiny: { pitch: 0.95, rate: 1, lang: 'en-US' },
  balatro: { pitch: 1.15, rate: 1.05, lang: 'en-US' },
  jlpt: { pitch: 0.9, rate: 0.95, lang: 'ja-JP' },
  ufouria: { pitch: 1.4, rate: 1.1, lang: 'en-US' },
  avatar: { pitch: 1.2, rate: 1.05, lang: 'en-US' },
  unreal: { pitch: 0.7, rate: 1.1, lang: 'en-US' },
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

/** A voice line kept on YouTube: "youtube:VIDEO_ID@54-57" plays seconds 54 to 57 of that video. */
export const YT_VOICE = /^youtube:([\w-]{11})@(\d+(?:\.\d+)?)-(\d+(?:\.\d+)?)$/;
/** The same on TikTok: "tiktok:POST_ID@9-13". */
export const TT_CLIP = /^tiktok:(\d+)@(\d+(?:\.\d+)?)-(\d+(?:\.\d+)?)$/;
let ytVoice: { host: HTMLElement; player?: YTPlayer; timer?: number } | null = null;
let ttVoice: { host: HTMLElement; player?: TikTokPlayer; timer?: number } | null = null;

function stopTikTokVoice() {
  if (!ttVoice) return;
  window.clearTimeout(ttVoice.timer);
  ttVoice.player?.destroy();
  ttVoice.host.remove();
  ttVoice = null;
}

/** How long a TikTok voice may take to start before it's given up on: a little late is better than not heard. */
const TT_START_MS = 20_000;

/**
 * Plays start..end of a TikTok, out of sight; `fallback` if it can't. Its player has no volume of its
 * own to set: only mute or not, so this one ignores the sound slider.
 */
function playTikTokVoice(id: string, start: number, end: number, fallback: () => void) {
  stopTikTokVoice();
  const host = document.createElement('div');
  host.style.cssText = 'position:fixed;left:-9999px;top:0;width:320px;height:568px;opacity:0;pointer-events:none';
  document.body.appendChild(host);
  const me: { host: HTMLElement; player?: TikTokPlayer; timer?: number } = { host };
  ttVoice = me;
  const stop = () => ttVoice === me && stopTikTokVoice();
  const giveUp = () => {
    if (ttVoice !== me) return;
    stopTikTokVoice();
    fallback();
  };
  let heard = false;
  me.timer = window.setTimeout(giveUp, TT_START_MS);
  const player: TikTokPlayer = createTikTokPlayer(host, id, { muted: false }, {
    onReady: () => {
      player.unMute();
      player.seekTo(start);
      player.play();
    },
    onState: (state) => {
      if (state !== TT_PLAYING || heard) return;
      heard = true;
      // The clip's length from the moment it really starts (it may buffer first), then it goes.
      window.clearTimeout(me.timer);
      me.timer = window.setTimeout(stop, (end - start) * 1000 + 250);
    },
    onTime: (at) => {
      if (at >= end) stop();
    },
    onError: giveUp,
  });
  me.player = player;
}

function stopYouTubeVoice() {
  if (!ytVoice) return;
  window.clearTimeout(ytVoice.timer);
  ytVoice.player?.destroy();
  ytVoice.host.remove();
  ytVoice = null;
}

/** Plays start..end of a YouTube video, out of sight; `fallback` if it can't (embedding off, blocked, offline). */
function playYouTubeVoice(id: string, start: number, end: number, volume: number, fallback: () => void) {
  stopYouTubeVoice();
  const host = document.createElement('div');
  // Out of sight but full size: YouTube won't play in a player smaller than 200×200.
  host.style.cssText = 'position:fixed;left:-9999px;top:0;width:200px;height:200px;opacity:0;pointer-events:none';
  const el = document.createElement('div');
  host.appendChild(el);
  document.body.appendChild(host);
  const me: { host: HTMLElement; player?: YTPlayer; timer?: number } = { host };
  ytVoice = me;
  let failed = false;
  const fail = () => {
    if (failed) return;
    failed = true;
    if (ytVoice === me) stopYouTubeVoice();
    fallback();
  };
  loadYouTube()
    .then((YT) => {
      if (ytVoice !== me) return;
      me.player = new YT.Player(el, {
        videoId: id,
        width: '200',
        height: '200',
        playerVars: { start: Math.floor(start), end: Math.ceil(end), autoplay: 1, controls: 0, playsinline: 1, disablekb: 1 },
        events: {
          onReady: () => {
            me.player?.setVolume(volume);
            me.player?.seekTo(start, true);
            me.player?.playVideo();
          },
          onStateChange: (e) => {
            // The clip's length from the moment it really starts (it may buffer first), then it goes.
            if (e.data === YT_PLAYING && !me.timer) me.timer = window.setTimeout(() => ytVoice === me && stopYouTubeVoice(), (end - start) * 1000 + 250);
            if (e.data === YT_ENDED && ytVoice === me) stopYouTubeVoice();
          },
          onError: fail,
        },
      });
    })
    .catch(fail);
}

/**
 * A card's voice line, heard: its recording if it has one, else the browser's voice. Silent when the
 * sound is off, or when voice lines are (Account page) unless the player asked for it (`asked`: the 🔊 button).
 */
export function playVoice(card: Card, asked = false) {
  const st = useProgress.getState();
  if (!card.voice || !st.sound || (!asked && st.voiceLines === false)) return;
  playing?.pause();
  stopYouTubeVoice();
  stopTikTokVoice();
  const { line, audio } = voiceOf(card, st.nameLang);
  if (!audio) return say(line!, card.set);
  const tt = TT_CLIP.exec(audio);
  if (tt) return playTikTokVoice(tt[1], Number(tt[2]), Number(tt[3]), () => say(line!, card.set));
  const yt = YT_VOICE.exec(audio);
  if (yt) return playYouTubeVoice(yt[1], Number(yt[2]), Number(yt[3]), Math.min(100, st.sfxVolume), () => say(line!, card.set));
  const a = new Audio(audio);
  a.volume = Math.min(1, useProgress.getState().sfxVolume / 100);
  playing = a;
  a.play().catch(() => say(line!, card.set));
  a.onerror = () => say(line!, card.set);
}

/** A card's line and recording in the language names are shown in (the French dub's when it has one). */
export function voiceOf(card: Card, lang = useProgress.getState().nameLang): { line?: string; audio?: string } {
  const fr = lang === 'fr';
  return { line: (fr && card.voiceFr) || card.voice, audio: (fr && card.audioFr) || card.audio };
}

/** Whether a card can be heard at all (a recording, or a browser that speaks). */
export const canHear = (card: Card) => !!card.voice && (!!card.audio || canSpeak());
