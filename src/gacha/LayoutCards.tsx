// The cards the page frame shows: the background card, its reactions, the omni aura, the icon. Loaded
// only once a card is equipped — the frame of a player without one never downloads the card catalogue.
import { CARD_BY_ID } from './cards';
import { OmniAura } from './OmniAura';
import { CardAvatar, CardBackdrop } from './Perks';
import { CardReactions } from './Reactions';

export function CardLayers() {
  return (
    <>
      <CardBackdrop />
      <CardReactions />
      <OmniAura />
    </>
  );
}

export function AvatarIcon({ id, className }: { id: string; className?: string }) {
  const card = CARD_BY_ID.get(id);
  return card ? <CardAvatar card={card} className={className} /> : null;
}
