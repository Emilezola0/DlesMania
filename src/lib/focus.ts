import { useEffect, type RefObject } from 'react';

/** Somewhere that takes text already, or a dialog: typing there is left alone. */
function typingElsewhere(el: Element | null) {
  if (!el) return false;
  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) return true;
  return (el as HTMLElement).isContentEditable || !!el.closest('[role="dialog"]');
}

/**
 * Type to answer: a letter typed while the answer box isn't focused (after pressing a clip's Play
 * button, a click on the page...) moves the focus into it, and the letter lands there. Keys typed
 * into another field, a dialog or with Ctrl/Cmd/Alt are left alone.
 */
export function useTypeToFocus(ref: RefObject<HTMLInputElement | null>, active = true) {
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      const input = ref.current;
      if (!input || input.disabled || document.activeElement === input) return;
      if (e.ctrlKey || e.metaKey || e.altKey || typingElsewhere(document.activeElement)) return;
      if (e.key.length === 1 || e.key === 'Backspace') input.focus({ preventScroll: true });
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [ref, active]);
}
