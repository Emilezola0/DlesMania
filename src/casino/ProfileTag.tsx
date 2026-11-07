import { Link } from 'react-router-dom';
import { useCloud } from '../cloud/state';
import { useProgress } from '../store/progress';
import { COSMETIC_BY_ID } from './cosmetics';
import { TITLE_BY_ID, TITLES, useFeats } from './unlocks';

/** The name shown on the profile: the account's, else "You". */
export const useShownName = () => {
  const name = useCloud((c) => c.name);
  const email = useCloud((c) => c.email);
  return name ?? email?.split('@')[0] ?? 'You';
};

/** The title the player wears: the one picked, if still earned, else the first. */
export const useShownTitle = () => {
  const title = useProgress((s) => s.title);
  const feats = useFeats();
  const picked = TITLE_BY_ID.get(title ?? '');
  return picked && picked.has(feats) ? picked : TITLES[0];
};

/**
 * The top bar's profile, right of the icon: the player's name in the style they bought (the Casino's Boutique)
 * and their title under it. Lazy-loaded by Layout (titles need the cards; the main bundle must not).
 */
export function ProfileTag({ className = '' }: { className?: string }) {
  const name = useShownName();
  const style = useProgress((s) => COSMETIC_BY_ID.get(s.nameStyle ?? '')?.className ?? '');
  const title = useShownTitle();
  return (
    <Link to="/account" title="Your profile" className={`shrink-0 flex-col justify-center leading-tight ${className}`}>
      <span className={`truncate font-display text-[13px] font-bold ${style || 'text-ink'}`}>{name}</span>
      <span className="truncate text-[10px] font-semibold uppercase tracking-wider text-ink-faint">{title.name}</span>
    </Link>
  );
}
