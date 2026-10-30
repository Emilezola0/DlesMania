// TikTok's embed player (developers.tiktok.com/doc/embed-player): an iframe driven by messages.

const PLAYER = 'https://www.tiktok.com/player/v1/';
/** Its state numbers we act on. */
export const TT_PLAYING = 1;

export interface TikTokEvents {
  onReady?: () => void;
  onState?: (state: number) => void;
  /** Its clock, every half second or so. */
  onTime?: (seconds: number) => void;
  onError?: () => void;
}

export interface TikTokPlayer {
  iframe: HTMLIFrameElement;
  play(): void;
  seekTo(seconds: number): void;
  unMute(): void;
  destroy(): void;
}

/** A player in `host`, none of TikTok's buttons or captions showing; `muted` for good if asked. */
export function createTikTokPlayer(host: HTMLElement, id: string, opts: { muted: boolean }, events: TikTokEvents): TikTokPlayer {
  const iframe = document.createElement('iframe');
  iframe.allow = 'autoplay; encrypted-media';
  iframe.title = 'TikTok clip';
  // Without autoplay it never answers at all: no "ready", and it ignores what it's sent.
  iframe.src = `${PLAYER}${id}?autoplay=1&controls=0&music_info=0&description=0&rel=0&native_context_menu=0&closed_caption=0&force_muted=${opts.muted ? 1 : 0}`;
  const send = (type: string, value?: number) => iframe.contentWindow?.postMessage({ type, value, 'x-tiktok-player': true }, '*');
  const listen = (e: MessageEvent) => {
    if (e.source !== iframe.contentWindow || !e.data?.['x-tiktok-player']) return;
    const { type, value } = e.data as { type: string; value: unknown };
    if (type === 'onPlayerReady') events.onReady?.();
    else if (type === 'onStateChange') events.onState?.(value as number);
    else if (type === 'onCurrentTime') events.onTime?.((value as { currentTime: number }).currentTime);
    else if (type === 'onPlayerError') events.onError?.();
  };
  window.addEventListener('message', listen);
  host.replaceChildren(iframe);
  return {
    iframe,
    play: () => send('play'),
    seekTo: (seconds) => send('seekTo', seconds),
    unMute: () => send('unMute'),
    destroy: () => {
      window.removeEventListener('message', listen);
      iframe.remove();
    },
  };
}
