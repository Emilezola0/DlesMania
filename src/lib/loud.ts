// A sound or video at a volume that may go past 100%: an <audio> or <video> element can't be louder than 1, so above
// that its sound goes through the page's audio (a gain). Only for files the site serves itself: another site's file
// played through the page's audio comes out silent (the browser's cross-origin rule), so those stop at 100%.

let ctx: AudioContext | null = null;
const gains = new WeakMap<HTMLMediaElement, GainNode>();

const ownFile = (el: HTMLMediaElement) => {
  try {
    return new URL(el.currentSrc || el.src, window.location.href).origin === window.location.origin;
  } catch {
    return false;
  }
};

/** Sets `el`'s volume, 1 being its own (0 to 2: above 1, louder, for the site's own files). */
export function setLoudness(el: HTMLMediaElement, volume: number) {
  const v = Math.max(0, Math.min(2, Number.isFinite(volume) ? volume : 1));
  const gain = gains.get(el);
  if (v <= 1 && !gain) {
    el.volume = v;
    return;
  }
  if (!gain && !ownFile(el)) {
    el.volume = Math.min(1, v);
    return;
  }
  try {
    ctx ??= new AudioContext();
    if (ctx.state === 'suspended') void ctx.resume();
    let g = gain;
    if (!g) {
      g = ctx.createGain();
      ctx.createMediaElementSource(el).connect(g).connect(ctx.destination);
      gains.set(el, g);
    }
    el.volume = 1;
    g.gain.value = v;
  } catch {
    el.volume = Math.min(1, v);
  }
}
