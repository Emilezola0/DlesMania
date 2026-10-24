import { useEffect, useRef, useState } from 'react';
import { sfx } from '../lib/sfx';
import { YT_ENDED, YT_PLAYING, loadYouTube, type YTPlayer } from '../lib/youtube';
import { useProgress } from '../store/progress';

interface Props {
  videoId: string;
  /** Where the clip starts, as a share of the video's length. */
  at: number;
  /** Seconds the clip runs before pausing. */
  seconds: number;
  /** Round over: the real video with its title and controls. */
  revealed: boolean;
  /** The video can't be played (removed, embedding disabled...). */
  onUnavailable: () => void;
}

/**
 * A stretch of gameplay with nothing that gives the answer away: no controls, YouTube's title bar
 * masked while it plays, and the whole frame covered whenever it isn't playing (YouTube shows the
 * title and suggestions on a paused or unstarted video).
 */
export function VideoClip({ videoId, at, seconds, revealed, onUnavailable }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const player = useRef<YTPlayer | null>(null);
  const timer = useRef<number>();
  const pending = useRef(false);
  const [start, setStart] = useState(0);
  const [ready, setReady] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const clipVolume = useProgress((s) => s.clipVolume);
  useEffect(() => {
    player.current?.setVolume(clipVolume);
  }, [clipVolume]);

  useEffect(() => {
    if (revealed) return;
    let cancelled = false;
    setReady(false);
    loadYouTube()
      .then((YT) => {
        if (cancelled || !host.current) return;
        const mount = document.createElement('div');
        host.current.replaceChildren(mount);
        player.current = new YT.Player(mount, {
          videoId,
          width: '100%',
          height: '100%',
          playerVars: { controls: 0, disablekb: 1, modestbranding: 1, rel: 0, playsinline: 1, iv_load_policy: 3, fs: 0 },
          events: {
            onReady: () => {
              const p = player.current;
              if (!p) return;
              p.setVolume(useProgress.getState().clipVolume);
              const d = p.getDuration();
              setStart(Math.floor(Math.max(0, Math.min(d * at, d - seconds - 10))));
              setReady(true);
            },
            onError: () => onUnavailable(),
            onStateChange: (e) => {
              if (e.data === YT_ENDED) stop();
              if (e.data === YT_PLAYING && pending.current) {
                pending.current = false;
                run();
              }
            },
          },
        });
      })
      .catch(() => onUnavailable());
    return () => {
      cancelled = true;
      window.clearInterval(timer.current);
      player.current?.destroy();
      player.current = null;
      host.current?.replaceChildren();
    };
    // One player per video: `at`, `seconds` and `onUnavailable` don't change during a round.
  }, [videoId, revealed]);

  function stop() {
    window.clearInterval(timer.current);
    player.current?.pauseVideo();
    setPlaying(false);
  }

  /** Counts the clip from the moment it really plays (seeking can buffer), then pauses. */
  function run() {
    setPlaying(true);
    const t0 = performance.now();
    timer.current = window.setInterval(() => {
      const elapsed = (performance.now() - t0) / 1000;
      setProgress(Math.min(elapsed, seconds));
      if (elapsed >= seconds) stop();
    }, 100);
  }

  const play = () => {
    const p = player.current;
    if (!p) return;
    sfx.click();
    if (playing) return stop();
    window.clearInterval(timer.current);
    setProgress(0);
    pending.current = true;
    p.seekTo(start, true);
    p.playVideo();
  };

  if (revealed) {
    return (
      <div className="animate-pop mx-auto aspect-video w-full max-w-3xl overflow-hidden rounded-xl bg-black shadow-2xl">
        <iframe
          className="size-full"
          src={`https://www.youtube-nocookie.com/embed/${videoId}?start=${start}&rel=0`}
          title="Gameplay clip"
          allow="autoplay; encrypted-media; picture-in-picture"
          allowFullScreen
        />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-2">
      <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-black shadow-2xl">
        <div ref={host} className="pointer-events-none size-full [&_iframe]:size-full" aria-hidden />
        {/* YouTube's title bar (it names the rank), its logo corner and its share corner. */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[16%] bg-black" />
        <div className="pointer-events-none absolute bottom-0 right-0 h-[13%] w-[18%] bg-black" />
        <div className="pointer-events-none absolute bottom-0 left-0 h-[13%] w-[10%] bg-black" />
        {/* Clicks never reach the video; a stopped video is fully covered. */}
        <button
          type="button"
          onClick={play}
          disabled={!ready}
          aria-label={playing ? 'Pause' : 'Play the clip'}
          className={`absolute inset-0 flex items-center justify-center transition-colors ${playing ? 'bg-transparent' : 'bg-black'}`}
        >
          {!playing && (
            <span className="btn-paper flex items-center gap-2 rounded-full px-6 py-3 font-display font-bold tracking-wider">
              {ready ? (progress > 0 ? '↻ Watch again' : '▶ Watch the clip') : 'Loading…'} {ready ? `${seconds}s` : ''}
            </span>
          )}
        </button>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-tile">
        <div className="h-full bg-accent transition-[width] duration-100" style={{ width: `${(progress / seconds) * 100}%` }} />
      </div>
    </div>
  );
}
