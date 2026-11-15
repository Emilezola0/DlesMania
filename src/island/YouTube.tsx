// YouTube on the Island (the owner's call): a TV or a radio can play a YouTube link, its video shown over it (big over
// a TV, small over a radio), full screen at a tap. Its sound follows the island: the device's own volume, and how near
// the player stands to it or to a speaker linked to it (src/island/IslandView.tsx). The player is YouTube's own
// (youtube-nocookie.com), driven by messages: volume, mute.
import { useEffect, useRef, useState } from 'react';
import { tr } from '../lib/i18n';

/** A YouTube video's id from a link (watch?v=, youtu.be/, shorts/, embed/, live/) or the id itself; null if none. */
export function ytId(input: string): string | null {
  const s = input.trim();
  if (/^[\w-]{11}$/.test(s)) return s;
  const m = /(?:youtube(?:-nocookie)?\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/|live\/|v\/)|youtu\.be\/)([\w-]{11})/.exec(s);
  return m ? m[1] : null;
}
/** A device's setting holding a YouTube video: "yt:<id>". */
export const YT = 'yt:';
export const ytOf = (setting: string | null | undefined) => (setting?.startsWith(YT) ? setting.slice(YT.length) : null);

/** Sends a command to a YouTube player (its iframe API, over messages). */
function command(frame: HTMLIFrameElement | null, func: string, args: unknown[] = []) {
  frame?.contentWindow?.postMessage(JSON.stringify({ event: 'command', func, args }), '*');
}

/**
 * A YouTube video playing on the island, `volume` 0–1 (already the device's own setting times how near the player
 * is). `start`: seconds in (to be in step with whoever switched it on). `loop` for a radio. The bar: full screen,
 * and off when `onOff` is given.
 */
export function YouTubeShow({ id, volume, start = 0, loop = false, label, onOff, vol, onVol, className = '', style }: { id: string; volume: number; start?: number; loop?: boolean; label?: string; onOff?: () => void; vol?: number; onVol?: (v: number) => void; className?: string; style?: React.CSSProperties }) {
  const box = useRef<HTMLDivElement>(null);
  const frame = useRef<HTMLIFrameElement>(null);
  const level = useRef(volume);
  level.current = volume;
  const apply = () => {
    const v = Math.round(Math.max(0, Math.min(1, level.current)) * 100);
    if (v <= 0) command(frame.current, 'mute');
    else {
      command(frame.current, 'unMute');
      command(frame.current, 'setVolume', [v]);
    }
  };
  useEffect(apply, [volume]);
  // The player takes commands once it's ready: said again a few times after it loads.
  const onLoad = () => {
    for (const ms of [300, 1000, 2500]) window.setTimeout(apply, ms);
  };
  const src = `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&playsinline=1&enablejsapi=1&rel=0&modestbranding=1&start=${Math.max(0, Math.floor(start))}${loop ? `&loop=1&playlist=${id}` : ''}`;
  const full = () => {
    const el = box.current;
    if (!el) return;
    if (document.fullscreenElement) void document.exitFullscreen();
    else void el.requestFullscreen?.().catch(() => {});
  };
  return (
    <div ref={box} className={`island-yt overflow-hidden rounded-md bg-black ${className}`} style={style} onPointerDown={(e) => e.stopPropagation()}>
      <iframe ref={frame} src={src} title={label ?? 'YouTube'} allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen onLoad={onLoad} className="size-full border-0" />
      <ShowBar label={label} onFull={full} onOff={onOff} vol={vol} onVol={onVol} />
    </div>
  );
}

/** A show's bar over its corner: its name, its volume (the device's own setting, 0–1), full screen, off. */
export function ShowBar({ label, onFull, onOff, vol, onVol }: { label?: string; onFull: () => void; onOff?: () => void; vol?: number; onVol?: (v: number) => void }) {
  return (
    <div className="island-show-bar absolute right-1 top-1 flex items-center gap-1" onPointerDown={(e) => e.stopPropagation()}>
      {label && <span className="max-w-[10rem] truncate rounded bg-black/60 px-1.5 text-[11px] font-semibold text-white">{label}</span>}
      {onVol && vol !== undefined && (
        <span className="flex items-center gap-1 rounded bg-black/60 px-1.5 text-xs text-white">
          {vol <= 0 ? '🔇' : '🔊'}
          <VolumeSlider value={vol * 100} onChange={onVol} compact />
        </span>
      )}
      <button type="button" onClick={onFull} className="rounded bg-black/60 px-1.5 text-xs text-white hover:bg-black/80" title={tr('Full screen', 'Plein écran')} aria-label={tr('Full screen', 'Plein écran')}>
        ⛶
      </button>
      {onOff && (
        <button type="button" onClick={onOff} className="rounded bg-black/60 px-1.5 text-xs text-white hover:bg-black/80" title={tr('Switch off', 'Éteindre')} aria-label={tr('Switch off', 'Éteindre')}>
          ✕
        </button>
      )}
    </div>
  );
}

/** A device's volume, 0–100: moves at once on screen, saved a moment after you let go. */
export function VolumeSlider({ value, onChange, compact = false }: { value: number; onChange: (v: number) => void; compact?: boolean }) {
  const [v, setV] = useState(Math.round(value));
  const timer = useRef(0);
  useEffect(() => setV(Math.round(value)), [value]);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  const input = (
    <input
      type="range"
      min={0}
      max={100}
      step={5}
      value={v}
      aria-label={tr('Volume', 'Volume')}
      onPointerDown={(e) => e.stopPropagation()}
      onChange={(e) => {
        const n = Number(e.target.value);
        setV(n);
        window.clearTimeout(timer.current);
        timer.current = window.setTimeout(() => onChange(n), 450);
      }}
      className={compact ? 'w-16 accent-white' : 'flex-1 accent-current'}
    />
  );
  if (compact) return input;
  return (
    <label className="flex items-center gap-2 text-sm">
      <span>{v === 0 ? '🔇' : '🔊'}</span>
      {input}
      <span className="w-10 text-right tabular-nums text-ink-soft">{v}%</span>
    </label>
  );
}
