import { useEffect, useRef, useState } from 'react';
import { createTikTokPlayer, type TikTokPlayer } from '../lib/tiktok';
import { YT_PLAYING, loadYouTube, type YTPlayer } from '../lib/youtube';
import { TT_CLIP, YT_VOICE } from './voice';

/** How often a YouTube clip checks whether it has reached its end (ms): its moments can be under a second. */
const LOOP_CHECK_MS = 50;

/** A moment of a YouTube video on a silent loop, hidden until it really plays (no title, no loading screen). */
function YouTubeLoop({ id, start, end, onFail, onPlaying, className }: { id: string; start: number; end: number; onFail: () => void; onPlaying?: () => void; className?: string }) {
  const host = useRef<HTMLDivElement>(null);
  const [playing, setPlaying] = useState(false);
  useEffect(() => {
    let cancelled = false;
    let player: YTPlayer | null = null;
    let timer: number | undefined;
    loadYouTube()
      .then((YT) => {
        if (cancelled || !host.current) return;
        const mount = document.createElement('div');
        host.current.replaceChildren(mount);
        player = new YT.Player(mount, {
          videoId: id,
          width: '100%',
          height: '100%',
          playerVars: { autoplay: 1, mute: 1, controls: 0, disablekb: 1, modestbranding: 1, rel: 0, playsinline: 1, iv_load_policy: 3, fs: 0, start: Math.floor(start) },
          events: {
            onReady: () => {
              player?.mute();
              player?.seekTo(start, true);
              player?.playVideo();
              timer = window.setInterval(() => {
                const at = player?.getCurrentTime() ?? start;
                if (at >= end || at < start - 0.5) player?.seekTo(start, true);
              }, LOOP_CHECK_MS);
            },
            onError: () => onFail(),
            onStateChange: (e) => {
              if (e.data !== YT_PLAYING) return;
              setPlaying(true);
              onPlaying?.();
            },
          },
        });
      })
      .catch(() => onFail());
    return () => {
      cancelled = true;
      window.clearInterval(timer);
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

/** A card's clip: an MP4, or a moment of a video kept elsewhere ("youtube:VIDEO_ID@55-55.9", "tiktok:POST_ID@1-5", as for voices). `onPlaying` may be called more than once. */
export function CardClip({ src, poster, onFail, onPlaying, className }: { src: string; poster?: string; onFail: () => void; onPlaying?: () => void; className?: string }) {
  const yt = YT_VOICE.exec(src);
  if (yt) return <YouTubeLoop id={yt[1]} start={Number(yt[2])} end={Number(yt[3])} onFail={onFail} onPlaying={onPlaying} className={className} />;
  const tt = TT_CLIP.exec(src);
  if (tt) return <TikTokLoop id={tt[1]} start={Number(tt[2])} end={Number(tt[3])} onFail={onFail} onPlaying={onPlaying} className={className} />;
  return <video key={src} src={src} poster={poster} autoPlay muted loop playsInline onError={onFail} onPlaying={onPlaying} className={className} />;
}
