import { useEffect, useRef, useState } from 'react';
import { YT_PLAYING, loadYouTube, type YTPlayer } from '../lib/youtube';
import { YT_VOICE } from './voice';

/** How often a YouTube clip checks whether it has reached its end (ms): its moments can be under a second. */
const LOOP_CHECK_MS = 50;

/** A moment of a YouTube video on a silent loop, hidden until it really plays (no title, no loading screen). */
function YouTubeLoop({ id, start, end, onFail, className }: { id: string; start: number; end: number; onFail: () => void; className?: string }) {
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
              if (e.data === YT_PLAYING) setPlaying(true);
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

/** A card's clip: an MP4, or a moment of a YouTube video ("youtube:VIDEO_ID@55-55.9", as for voices). */
export function CardClip({ src, poster, onFail, className }: { src: string; poster?: string; onFail: () => void; className?: string }) {
  const yt = YT_VOICE.exec(src);
  if (yt) return <YouTubeLoop id={yt[1]} start={Number(yt[2])} end={Number(yt[3])} onFail={onFail} className={className} />;
  return <video key={src} src={src} poster={poster} autoPlay muted loop playsInline onError={onFail} className={className} />;
}
