// Icons and backgrounds taking turns (picked on the Account page and in the album): after some wins, once a
// win's clip has played (the page's big moment, the background card's video, once through: src/gacha/Reactions.tsx), or each time Omnidle is opened —
// in the list's order or at random. A card changes only once the page is calm again: never in the middle of
// its own clip or burst. Cards no longer owned (or a Common as a background) are skipped.
import { useEffect } from 'react';
import { onCue } from '../lib/sfx';
import { rotationOf, useProgress, type RotationSlot } from '../store/progress';
import { CARD_BY_ID } from './cards';
import { canBeBackdrop } from './Perks';

const SLOTS: RotationSlot[] = ['avatar', 'backdrop'];
/** A win's cues (a streak, then the victory) within this count as one win. */
const SAME_WIN_MS = 4000;
/** After a win with no clip: long enough for the background's burst to finish. */
const SETTLE_MS = 1800;

/** The cards a slot can take turns with now. */
function usable(slot: RotationSlot): string[] {
  const s = useProgress.getState();
  return rotationOf(s)[slot].cards.filter((id) => {
    const c = CARD_BY_ID.get(id);
    return !!c && (s.cards[id] ?? 0) > 0 && (slot === 'avatar' || canBeBackdrop(c));
  });
}

/** The next card in a slot's turns (none when there's nothing to change to). */
export function nextInRotation(slot: RotationSlot, random = Math.random): string | null {
  const s = useProgress.getState();
  const plan = rotationOf(s)[slot];
  const cards = usable(slot);
  const now = s[slot];
  const others = cards.filter((c) => c !== now);
  if (!others.length) return cards.length && !now ? cards[0] : null;
  if (plan.order === 'random') return others[Math.floor(random() * others.length)];
  const at = now ? plan.cards.indexOf(now) : -1;
  // The next one along the list (from where the current card sits, even if it's been taken out of it).
  for (let i = 1; i <= plan.cards.length; i++) {
    const id = plan.cards[(at + i + plan.cards.length) % plan.cards.length];
    if (cards.includes(id) && id !== now) return id;
  }
  return others[0];
}

function advance(slot: RotationSlot) {
  const next = nextInRotation(slot);
  if (!next) return;
  const s = useProgress.getState();
  if (slot === 'avatar') s.setAvatar(next);
  else s.setBackdrop(next);
}

/** Wins since each slot last changed (kept for the visit only). */
const wins: Record<RotationSlot, number> = { avatar: 0, backdrop: 0 };
/** "Each time Omnidle is opened": once a page load. */
let visited = false;

const momentOn = () => document.documentElement.classList.contains('moment-on');

export function CardRotation() {
  useEffect(() => {
    if (!visited) {
      visited = true;
      for (const slot of SLOTS) if (rotationOf(useProgress.getState())[slot].when === 'visit') advance(slot);
    }
    /** Slots to change as soon as the page is calm. */
    const pending = new Set<RotationSlot>();
    let timer = 0;
    let lastWin = 0;
    const flush = () => {
      window.clearTimeout(timer);
      if (momentOn()) return; // The observer below flushes when the moment is over.
      for (const slot of pending) advance(slot);
      pending.clear();
    };
    const off = onCue((kind) => {
      const now = Date.now();
      if (kind !== 'great' || now - lastWin < SAME_WIN_MS) return;
      lastWin = now;
      const plans = rotationOf(useProgress.getState());
      for (const slot of SLOTS) {
        if (plans[slot].when !== 'win') continue;
        if (++wins[slot] < Math.max(1, plans[slot].every)) continue;
        wins[slot] = 0;
        pending.add(slot);
      }
      if (pending.size) {
        window.clearTimeout(timer);
        timer = window.setTimeout(flush, SETTLE_MS);
      }
    });
    // A big moment (the background card's video over the page) ending: the "after its clip" slots change, and any waiting.
    let wasOn = momentOn();
    const watch = new MutationObserver(() => {
      const on = momentOn();
      if (wasOn && !on) {
        const plans = rotationOf(useProgress.getState());
        for (const slot of SLOTS) if (plans[slot].when === 'clip') pending.add(slot);
        flush();
      }
      wasOn = on;
    });
    watch.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => {
      off();
      watch.disconnect();
      window.clearTimeout(timer);
    };
  }, []);
  return null;
}
