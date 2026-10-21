import { useEffect, useRef, useState } from 'react';
import { sfx } from '../lib/sfx';

/** Snippet length (seconds) unlocked by each wrong guess, Heardle-style. */
export const SNIPPETS = [1, 2, 4, 7, 11, 16];
/** Voice lines need a little longer to be heard at all. */
export const VOICE_SNIPPETS = [2, 3, 5, 8, 12, 16];

// Minimal slice of the YouTube IFrame API we use.
interface YTPlayer {
  playVideo(): void;
  pauseVideo(): void;
  seekTo(seconds: number, allowSeekAhead: boolean): void;
  getDuration(): number;
  setVolume(v: number): void;
  destroy(): void;
}
interface YTNamespace {
  Player: new (
    el: HTMLElement,
    opts: {
      videoId: string;
      width?: string;
      height?: string;
      playerVars?: Record<string, number | string>;
      events?: { onReady?: () => void; onError?: (e: { data: number }) => void; onStateChange?: (e: { data: number }) => void };
    },
  ) => YTPlayer;
}
declare global {
  interface Window {
    YT?: YTNamespace;
    onYouTubeIframeAPIReady?: () => void;
  }
}

let apiPromise: Promise<YTNamespace> | null = null;
function loadYouTube(): Promise<YTNamespace> {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  apiPromise ??= new Promise((resolve, reject) => {
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      prev?.();
      resolve(window.YT!);
    };
    const s = document.createElement('script');
    s.src = 'https://www.youtube.com/iframe_api';
    s.onerror = () => reject(new Error('YouTube API failed to load'));
    document.head.appendChild(s);
  });
  return apiPromise;
}

interface Props {
  videoId: string;
  /** Second the snippet starts at. When omitted it's picked from the middle of the clip. */
  start?: number;
  /** Index into `lengths`: grows with each wrong guess. */
  step: number;
  /** Snippet lengths in seconds, one per step (default SNIPPETS). */
  lengths?: number[];
  /** Round over: show the real video with controls. */
  revealed: boolean;
  /** Called when the clip can't be played (removed, embedding disabled, blocked...). */
  onUnavailable: () => void;
}

const PLAYING = 1;

/** Intros are often silent or ambient, so default to ~40% in, leaving room for the longest snippet. */
function autoStart(duration: number): number {
  if (!duration || duration < 45) return 0;
  return Math.floor(Math.min(duration * 0.4, duration - SNIPPETS[SNIPPETS.length - 1] - 5));
}

export function AudioClip({ videoId, start, step, revealed, onUnavailable, lengths = SNIPPETS }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const player = useRef<YTPlayer | null>(null);
  const timer = useRef<number>();
  /** Snippet length waiting for playback to actually begin (seeking can buffer). */
  const pending = useRef<number | null>(null);
  const [clipStart, setClipStart] = useState(start ?? 0);
  const [ready, setReady] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const length = lengths[Math.min(step, lengths.length - 1)];
  const max = lengths[lengths.length - 1];

  useEffect(() => {
    if (revealed) return;
    let cancelled = false;
    loadYouTube()
      .then((YT) => {
        if (cancelled || !host.current) return;
        // YouTube replaces its mount node with an iframe, so give it one React doesn't own.
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
              p.setVolume(80);
              setClipStart(start ?? autoStart(p.getDuration()));
              setReady(true);
            },
            onError: () => onUnavailable(),
            onStateChange: (e) => {
              if (e.data !== PLAYING || pending.current === null) return;
              startTimer(pending.current);
              pending.current = null;
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
    // Created once per clip: `start` and `onUnavailable` don't change during a round.
  }, [videoId, revealed]);

  /** Counts the snippet from the moment audio is really playing, then pauses. */
  function startTimer(len: number) {
    const p = player.current;
    if (!p) return;
    setPlaying(true);
    const t0 = performance.now();
    timer.current = window.setInterval(() => {
      const elapsed = (performance.now() - t0) / 1000;
      setProgress(Math.min(elapsed, len));
      if (elapsed >= len) {
        p.pauseVideo();
        setPlaying(false);
        window.clearInterval(timer.current);
      }
    }, 50);
  }

  const playSnippet = () => {
    const p = player.current;
    if (!p) return;
    sfx.click();
    window.clearInterval(timer.current);
    setProgress(0);
    pending.current = length;
    p.seekTo(clipStart, true);
    p.playVideo();
  };

  if (revealed) {
    return (
      <div className="animate-pop mx-auto aspect-video w-full max-w-xl overflow-hidden rounded-xl bg-black shadow-2xl">
        <iframe
          className="size-full"
          src={`https://www.youtube-nocookie.com/embed/${videoId}?start=${clipStart}&rel=0`}
          title="Soundtrack clip"
          allow="autoplay; encrypted-media; picture-in-picture"
          allowFullScreen
        />
      </div>
    );
  }

  return (
    <div className="relative mx-auto w-full max-w-xl">
      {/* The player stays mounted (YouTube needs a real-size iframe) but is fully covered. */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-xl opacity-0" aria-hidden>
        <div ref={host} className="size-full [&_iframe]:size-full" />
      </div>
      <div className="relative flex flex-col items-center gap-5 rounded-md bg-tile/60 p-6">
        <div className="flex h-14 items-end gap-1" aria-hidden>
          {Array.from({ length: 28 }, (_, i) => (
            <span
              key={i}
              className={`w-1.5 rounded-full bg-accent ${playing ? 'animate-eq' : 'opacity-40'}`}
              style={{ height: `${25 + ((i * 37) % 75)}%`, animationDelay: `${(i % 7) * 90}ms` }}
            />
          ))}
        </div>
        <button
          type="button"
          onClick={playSnippet}
          disabled={!ready}
          className="btn-ink flex items-center gap-2 rounded-full px-6 py-3 font-display font-bold tracking-wider"
        >
          {ready ? (playing ? '↻ Replay' : '▶ Play') : 'Loading…'} {length}s
        </button>
        {/* Timeline of unlockable snippet lengths. */}
        <div className="relative h-2 w-full overflow-hidden rounded-full bg-tile">
          <div className="absolute inset-y-0 left-0 bg-rule-strong" style={{ width: `${(length / max) * 100}%` }} />
          <div className="absolute inset-y-0 left-0 bg-accent transition-[width] duration-75" style={{ width: `${(progress / max) * 100}%` }} />
          {lengths.map((s) => (
            <span key={s} className="absolute inset-y-0 w-px bg-paper" style={{ left: `${(s / max) * 100}%` }} />
          ))}
        </div>
        <p className="text-xs text-ink-faint">Each wrong guess unlocks a longer snippet. The video is revealed at the end.</p>
      </div>
    </div>
  );
}
