import { useEffect, useRef, useState } from 'react';
import { setLoudness } from '../lib/loud';
import { createTikTokPlayer, type TikTokPlayer } from '../lib/tiktok';
import { YT_BUFFERING, YT_CUED, YT_ENDED, YT_PAUSED, YT_PLAYING, YT_UNSTARTED, loadYouTube, type YTPlayer } from '../lib/youtube';
import { TT_CLIP, YT_VOICE } from './voice';

/** How often a YouTube clip checks whether it has reached its end (ms): its moments can be under a second. */
const LOOP_CHECK_MS = 50;
/** How long a YouTube clip waits after it starts playing before it shows: YouTube's play button takes that to fade. */
const REVEAL_MS = 1200;
/** The first time, longer: YouTube shows its controls for a few seconds once it starts, whatever `controls` says. */
const FIRST_REVEAL_MS = 4500;
/** An end at least this far ("@0-999") means the whole video. */
const WHOLE = 900;

/** How long a clip with its sound may take to start before it's played silent instead (the browser blocked its sound). */
const SOUND_START_MS = 5000;

/** A clip heard: at this volume (0-100), once through; `onEnded` when it's over, `onNoSound` if it can't be heard. */
export interface ClipSound {
  volume: number;
  onEnded: () => void;
  onNoSound: () => void;
}

/**
 * A moment of a YouTube video on a silent loop, hidden until it really plays (no title, no loading screen).
 * With `sound` (a clip that is also its card's voice): heard, once through, its picture and sound from one player, in time.
 */
function YouTubeLoop({ id, start, end, onFail, onPlaying, className, sound, hold }: { id: string; start: number; end: number; onFail: () => void; onPlaying?: () => void; className?: string; sound?: ClipSound; hold?: boolean }) {
  const host = useRef<HTMLDivElement>(null);
  const [playing, setPlaying] = useState(false);
  const holdRef = useRef(hold);
  const soundRef = useRef(sound);
  const goRef = useRef<() => void>(() => {});
  useEffect(() => {
    holdRef.current = hold;
    soundRef.current = sound;
    if (!hold) goRef.current();
  }, [hold, sound]);
  useEffect(() => {
    let cancelled = false;
    let player: YTPlayer | null = null;
    let timer: number | undefined;
    let reveal: number | undefined;
    let shown = false;
    // Held (waiting for a tap): it plays hidden and silent meanwhile, so YouTube's buttons are gone by the time it's let go.
    const wasHeld = !!hold;
    let went = false;
    let settling = false;
    // Sought back to its start: it may land on a keyframe a little before it — not a reason to seek again (that never ends).
    let landing = false;
    const toStart = () => {
      landing = true;
      player?.seekTo(start, true);
    };
    // Heard: once through, then silent on a loop like any clip. Not started in time (its sound blocked): silent, voice played apart.
    let heard = !!sound && !wasHeld;
    let soundTimer: number | undefined;
    const silence = (ended: boolean) => {
      if (!heard) return;
      heard = false;
      window.clearTimeout(soundTimer);
      player?.mute();
      if (ended) sound?.onEnded();
      else sound?.onNoSound();
    };
    // A clip played whole ("@0-999") loops by YouTube's own loop: every seek makes it flash its play button.
    // Heard, it plays once through and is seeked like a moment, so its end is known.
    const whole = start === 0 && end >= WHOLE && !sound;
    /** Let go once its buttons have faded: from the start, heard and shown at once — picture and sound together. */
    const go = () => {
      if (!wasHeld || went || holdRef.current || !shown || !player) return;
      went = true;
      settling = true;
      const s = soundRef.current;
      if (s) {
        heard = true;
        sound = s;
        player.unMute();
        player.setVolume(Math.min(100, s.volume));
      }
      toStart();
      player.playVideo();
      setPlaying(true);
      onPlaying?.();
    };
    goRef.current = go;
    loadYouTube()
      .then((YT) => {
        if (cancelled || !host.current) return;
        const mount = document.createElement('div');
        host.current.replaceChildren(mount);
        player = new YT.Player(mount, {
          videoId: id,
          width: '100%',
          height: '100%',
          playerVars: { autoplay: 1, mute: sound ? 0 : 1, controls: 0, disablekb: 1, modestbranding: 1, rel: 0, playsinline: 1, iv_load_policy: 3, fs: 0, start: Math.floor(start), ...(whole ? { loop: 1, playlist: id } : {}) },
          events: {
            onReady: () => {
              if (heard && sound) {
                player?.unMute();
                player?.setVolume(Math.min(100, sound.volume));
                soundTimer = window.setTimeout(() => {
                  silence(false);
                  player?.playVideo();
                }, SOUND_START_MS);
              } else player?.mute();
              if (!whole) toStart();
              player?.playVideo();
              if (whole) return;
              // An end past the video's own (a clip played whole: "@0-999") loops at the video's end.
              const length = player?.getDuration() ?? 0;
              const stop = length > 0 ? Math.min(end, length - 0.3) : end;
              timer = window.setInterval(() => {
                const at = player?.getCurrentTime() ?? start;
                if (at >= start) landing = false;
                if (at >= stop) silence(true);
                if (at >= stop || (at < start - 0.5 && !landing)) toStart();
              }, LOOP_CHECK_MS);
            },
            onError: () => onFail(),
            onStateChange: (e) => {
              // Just let go: the seek back to its start buffers a moment; it stays shown (its buttons are long gone).
              if (settling) {
                if (e.data === YT_BUFFERING) return;
                if (e.data === YT_PLAYING) return void (settling = false);
                settling = false;
              }
              // Ended anyway (the length wasn't known yet): from the start again.
              if (e.data === YT_ENDED) {
                silence(true);
                window.clearTimeout(reveal);
                setPlaying(false);
                if (!whole) toStart();
                return void player?.playVideo();
              }
              // Paused, cued or not started: YouTube draws its big play button, so hide (and play on, if paused).
              if (e.data === YT_PAUSED || e.data === YT_CUED || e.data === YT_UNSTARTED) {
                window.clearTimeout(reveal);
                setPlaying(false);
                if (e.data === YT_PAUSED) player?.playVideo();
                return;
              }
              // Loading: YouTube draws its spinner, so the picture comes back until it plays again.
              if (e.data === YT_BUFFERING) {
                window.clearTimeout(reveal);
                return void setPlaying(false);
              }
              if (e.data !== YT_PLAYING) return;
              window.clearTimeout(soundTimer);
              // Its play button and controls fade out a while after playback starts: show the clip once they have gone.
              window.clearTimeout(reveal);
              reveal = window.setTimeout(() => {
                if (cancelled) return;
                shown = true;
                // Held: stays hidden until let go (and if it already was, it goes now).
                if (wasHeld && !went) return go();
                setPlaying(true);
                onPlaying?.();
                // Heard from its first moment: shown sooner (its sound and picture are one).
              }, shown || (sound && !wasHeld) ? REVEAL_MS : FIRST_REVEAL_MS);
            },
          },
        });
      })
      .catch(() => onFail());
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      window.clearTimeout(reveal);
      // Taken away while heard (the moment over): its sound is over too.
      if (heard) {
        heard = false;
        window.clearTimeout(soundTimer);
        sound?.onEnded();
      }
      player?.destroy();
    };
    // One player per clip: `onFail` doesn't change what it plays.
  }, [id, start, end]);
  return <div ref={host} aria-hidden className={`card-clip-yt ${playing ? '' : 'opacity-0'} ${className ?? ''}`} />;
}

/** The width TikTok's player is drawn at, before it's scaled down to the card: its own marks stay small. */
const TT_WIDTH = 640;

/** A moment of a TikTok on a silent loop, hidden until it has reached that moment. */
function TikTokLoop({ id, start, end, onFail, onPlaying, className }: { id: string; start: number; end: number; onFail: () => void; onPlaying?: () => void; className?: string }) {
  const host = useRef<HTMLDivElement>(null);
  const [playing, setPlaying] = useState(false);
  useEffect(() => {
    const el = host.current;
    if (!el) return;
    const fit = () => el.style.setProperty('--tt-scale', String(el.clientWidth / TT_WIDTH));
    fit();
    const size = new ResizeObserver(fit);
    size.observe(el);
    const player: TikTokPlayer = createTikTokPlayer(el, id, { muted: true }, {
      onReady: () => {
        player.seekTo(start);
        player.play();
      },
      onTime: (at) => {
        if (at >= end) player.seekTo(start);
        else if (at >= start) {
          setPlaying(true);
          onPlaying?.();
        }
      },
      onError: onFail,
    });
    return () => {
      size.disconnect();
      player.destroy();
    };
    // One player per clip: `onFail` doesn't change what it plays.
  }, [id, start, end]);
  return <div ref={host} aria-hidden className={`card-clip-tt ${playing ? '' : 'opacity-0'} ${className ?? ''}`} />;
}

/** Several MP4s, one after the other and round again (each one a different moment): a random one first. */
function Mp4Series({ srcs, poster, onFail, onPlaying, className }: { srcs: string[]; poster?: string; onFail: () => void; onPlaying?: () => void; className?: string }) {
  const [at, setAt] = useState(() => Math.floor(Math.random() * srcs.length));
  return <video key={srcs[at]} src={srcs[at]} poster={poster} autoPlay muted playsInline onEnded={() => setAt((i) => (i + 1) % srcs.length)} onError={onFail} onPlaying={onPlaying} className={className} />;
}

/**
 * An MP4 heard, once through (its sound is the moment's): its end ends the sound. If the browser won't let it play
 * with sound (no tap on the page yet), it plays on silent and says so.
 */
function HeardVideo({ src, poster, onFail, onPlaying, className, sound }: { src: string; poster?: string; onFail: () => void; onPlaying?: () => void; className?: string; sound: ClipSound }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    let over = false;
    const end = (heard: boolean) => {
      if (over) return;
      over = true;
      if (heard) sound.onEnded();
      else sound.onNoSound();
    };
    setLoudness(v, sound.volume / 100);
    v.muted = false;
    v.play().catch((e: unknown) => {
      // Taken away meanwhile (its pause cut the play short): nothing to do.
      if (over) return;
      if ((e as { name?: string })?.name !== 'NotAllowedError') return onFail();
      v.muted = true;
      end(false);
      v.play().catch(onFail);
    });
    v.onended = () => end(true);
    // Taken away (the moment over, or React trying the effect twice in development): silent, nothing more to say.
    return () => {
      over = true;
      v.pause();
    };
    // One play per clip.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src]);
  return <video ref={ref} key={src} src={src} poster={poster} playsInline onError={onFail} onPlaying={onPlaying} className={className} />;
}

/**
 * A card's clip: an MP4, several MP4s played in turn ("a.mp4|b.mp4|c.mp4"), or a moment of a video kept
 * elsewhere ("youtube:VIDEO_ID@55-55.9", "tiktok:POST_ID@1-5", as for voices). `onPlaying` may be called more than once.
 */
export function CardClip({ src, poster, onFail, onPlaying, className, sound, hold }: { src: string; poster?: string; onFail: () => void; onPlaying?: () => void; className?: string; sound?: ClipSound; /** Not yet: a YouTube clip readies itself unseen and unheard, an MP4 loads unseen. */ hold?: boolean }) {
  const yt = YT_VOICE.exec(src);
  if (yt) return <YouTubeLoop id={yt[1]} start={Number(yt[2])} end={Number(yt[3])} onFail={onFail} onPlaying={onPlaying} className={className} sound={sound} hold={hold} />;
  // An MP4 waiting for a tap: loaded meanwhile, unseen, so the tap starts it at once.
  if (hold) return src.includes('|') || TT_CLIP.test(src) ? null : <video src={src} preload="auto" muted playsInline aria-hidden className={`${className ?? ''} opacity-0`} />;
  const tt = TT_CLIP.exec(src);
  if (tt) return <TikTokLoop id={tt[1]} start={Number(tt[2])} end={Number(tt[3])} onFail={onFail} onPlaying={onPlaying} className={className} />;
  if (src.includes('|')) return <Mp4Series srcs={src.split('|')} poster={poster} onFail={onFail} onPlaying={onPlaying} className={className} />;
  if (sound) return <HeardVideo src={src} poster={poster} onFail={onFail} onPlaying={onPlaying} className={className} sound={sound} />;
  return <video key={src} src={src} poster={poster} autoPlay muted loop playsInline onError={onFail} onPlaying={onPlaying} className={className} />;
}
