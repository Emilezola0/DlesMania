import { ANOMALIES } from '../gacha/anomalies';
import { useDeferredValue, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Coins } from '../components/DleCoin';
import { CardBack, CardFace, CardMissing, useCardForm } from '../gacha/CardView';
import { isVaulted, UPGRADES } from '../gacha/upgrades';
import { CARD_BY_ID, CARDS, COLLECTIBLE, RARITIES, RARITY_INFO, SETS, type Card, type Rarity } from '../gacha/cards';
import { DOMAINS } from '../data';
import { GradeEmblem } from '../gacha/GradeEmblem';
import { SellSpares } from '../gacha/SellSpares';
import { canGradeUp, ELEMENT_GRADE, ELEMENT_IDS, ELEMENT_SWITCH_COST, ELEMENTS, GRADE_COST, gradeName, gradeOf, gradeReward, GRADES, HELL_GRADE, MAX_GRADE, RESALE_BONUS, spareValue, type ElementId } from '../gacha/grades';
import { celebrate, celebrateBig } from '../lib/fx';
import { canBeBackdrop } from '../gacha/Perks';
import { RENEW_COST, RenewDialog, spareByRarity } from '../gacha/Renew';
import { GradeAllDialog, SellDialog } from '../gacha/BulkActions';
import { canHear, cardVolumeOf, playVoice } from '../gacha/voice';
import { frenchOf, shownName } from '../lib/french';
import { sfx } from '../lib/sfx';
import { useCloud } from '../cloud/state';
import { bossKey, useProgress } from '../store/progress';

/** Which cards: all, owned, missing, starred, with spare copies, ready to grade up, or Altered (back from a black hole with an anomaly). */
type Show = 'all' | 'owned' | 'missing' | 'favorites' | 'spares' | 'upgradable' | 'altered';
const SHOWS: { id: Show; label: string; title?: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'owned', label: 'Owned' },
  { id: 'missing', label: 'Missing' },
  { id: 'favorites', label: '★ Favourites', title: 'Cards you starred (open a card to star it)' },
  { id: 'spares', label: 'Spares', title: 'Cards you have more than one copy of' },
  { id: 'upgradable', label: '⬆ Can grade up', title: 'Cards with enough spare copies for their next grade' },
  { id: 'altered', label: '🕳️ Altered', title: 'Cards back from a black hole, with an anomaly' },
];

/** Lower case, no accents or punctuation: for the search box. */
const fold = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
/** What a card can be found by: its name (in English and French), its title and its franchise. */
/** How many cards of each rarity exist. */
const RARITY_TOTAL = COLLECTIBLE.reduce((t, c) => ((t[c.rarity] = (t[c.rarity] ?? 0) + 1), t), {} as Record<Rarity, number>);
const SEARCH_TEXT = new Map(CARDS.map((c) => [c.id, fold([c.name, frenchOf(c.name, c.set), c.title, c.franchise].filter(Boolean).join(' '))]));
/** The sets, by domain (Games, Anime…), for the set picker. */
const SETS_BY_DOMAIN = DOMAINS.map((d) => ({ domain: d, sets: SETS.filter((s) => s.domain === d.id) })).filter((g) => g.sets.length);

/** A choice kept on this device between visits (the Album's filters). */
function useKept<T>(key: string, initial: T, valid: (v: unknown) => boolean): [T, (v: T | ((old: T) => T)) => void] {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key);
      const v = raw === null ? undefined : JSON.parse(raw);
      return v !== undefined && valid(v) ? (v as T) : initial;
    } catch {
      return initial;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* private mode: kept for this visit only */
    }
  }, [key, value]);
  return [value, setValue];
}
type Sort = 'set' | 'recent' | 'rarity' | 'grade' | 'name' | 'count';

const SORTS: { id: Sort; label: string }[] = [
  { id: 'set', label: 'Set' },
  { id: 'recent', label: 'Newest' },
  { id: 'rarity', label: 'Rarity' },
  { id: 'grade', label: 'Grade' },
  { id: 'name', label: 'Name' },
  { id: 'count', label: 'Most pulled' },
];
/** One shared empty record: a selector must not hand back a new object at each call. */
const NONE: Record<string, never> = {};
const SET_ORDER = new Map(SETS.map((s, i) => [s.id, i]));

/**
 * One card, big, in 3D: it sways gently on its own, so its foil keeps catching the light; drag it to
 * turn it in your hands (the foil follows, its thick edge and its back show past a half turn), tap
 * it to send it spinning. The name, badges and ribbon stand off the surface.
 */
/** When the burst comes in the card's collapse (see card-grade-collapse in index.css: 55% of 2.6s). */
const COLLAPSE_BURST_MS = 1430;

/** A clip that is a GIF (from a GIF site, or a .gif): it loops on its own, no tap needed. */
/** How long the card's spin lasts (its `duration-500`). */
const SPIN_MS = 500;
const GIF_CLIP =/media\d*\.tenor\.com|giphy\.com|klipy\.com|\.gif(\?|$)/i;

function Inspect({ card, count, onClose, onUpgraded }: { card: Card; count: number; onClose: () => void; onUpgraded: (into: Card) => void }) {
  // An omni shows the form it has reached (its title changes once awakened).
  const form = useCardForm(card);
  // Its clip: a GIF loops at once; a video waits for a tap on the card (then heard, if its sound is the moment's).
  const isVideo = !!form.clip && !form.clipLight && !GIF_CLIP.test(form.clip);
  const [started, setStarted] = useState<string | null>(null);
  const clipHeld = isVideo && started !== form.clip;
  const sfxVolume = useProgress((s) => s.sfxVolume);
  const clipSound = useMemo(
    () => (card.clipSound && started === form.clip ? { volume: Math.min(100, sfxVolume) * cardVolumeOf(card.id, 'clip'), onEnded: () => {}, onNoSound: () => {} } : undefined),
    // The volume as it was when started: a new one would restart the clip.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [card.id, card.clipSound, started, form.clip],
  );
  const grade = useProgress((s) => gradeOf(s.grades, card.id));
  const element = useProgress((s) => s.elements?.[card.id]);
  // Bumped on a grade-up (or a new element): the card flares.
  const [flare, setFlare] = useState(0);
  const [rot, setRot] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [spin, setSpin] = useState(0);
  const [sway, setSway] = useState({ x: 0, y: 0 });
  const start = useRef<{ x: number; y: number; moved: boolean } | null>(null);

  // The idle sway: a slow figure of eight, a few degrees each way.
  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    let id = 0;
    const t0 = performance.now();
    const frame = (now: number) => {
      const t = (now - t0) / 1000;
      setSway({ x: Math.sin(t * 0.9) * 6, y: Math.sin(t * 0.6) * 10 });
      id = requestAnimationFrame(frame);
    };
    id = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(id);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const down = (e: React.PointerEvent) => {
    (e.target as Element).setPointerCapture?.(e.pointerId);
    start.current = { x: e.clientX, y: e.clientY, moved: false };
    setDragging(true);
  };
  const move = (e: React.PointerEvent) => {
    const s = start.current;
    if (!s) return;
    const dx = e.clientX - s.x;
    const dy = e.clientY - s.y;
    if (Math.abs(dx) + Math.abs(dy) > 6) s.moved = true;
    setRot({ x: Math.max(-40, Math.min(40, -dy * 0.35)), y: dx * 0.6 });
  };
  // The spin takes SPIN_MS (its transition): a waiting video starts as it ends.
  const playTimer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(playTimer.current), []);
  const spinThenPlay = () => {
    sfx.whoosh();
    setSpin((n) => n + 360);
    if (!clipHeld) return;
    const clip = form.clip!;
    window.clearTimeout(playTimer.current);
    playTimer.current = window.setTimeout(() => setStarted(clip), SPIN_MS);
  };
  const up = () => {
    const s = start.current;
    start.current = null;
    setDragging(false);
    setRot({ x: 0, y: 0 });
    // A tap, not a drag: a full spin (and its video, if it's waiting, once the spin is over).
    if (s && !s.moved) spinThenPlay();
  };

  // Held, the card goes where the hand takes it; let go, it sways.
  const rx = dragging ? rot.x : sway.x;
  const ry = (dragging ? rot.y : sway.y) + spin;
  // The foil takes its light from the turn: a few degrees move it across the whole card.
  const face = ((((ry % 360) + 540) % 360) - 180) as number;
  const foil = { x: Math.max(0, Math.min(100, 50 + face * 1.6)), y: Math.max(0, Math.min(100, 50 - rx * 2.2)) };
  return (
    <div className="fixed inset-0 z-50 flex justify-center overflow-y-auto bg-black/80 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="my-auto w-full space-y-4 py-6" style={{ maxWidth: 'min(24rem, calc((100vh - 9rem) * 5 / 7))' }} onClick={(e) => e.stopPropagation()}>
        <div
          className="cursor-grab touch-none select-none [perspective:1000px] active:cursor-grabbing"
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={up}
          onPointerCancel={up}
        >
          <div
            className={`relative [transform-style:preserve-3d] ${dragging ? '' : 'transition-transform duration-500 ease-out'}`}
            style={{ transform: `rotateX(${rx}deg) rotateY(${ry}deg)` }}
          >
            {/* The card's thickness: its edge, layer by layer, between the two faces. */}
            {[1, 2, 3, 4, 5].map((z) => (
              <div key={z} className="absolute inset-0 rounded-[7%]" style={{ transform: `translateZ(-${z}px)`, background: card.rarity === 'mythic' ? '#7e22ce' : card.rarity === 'legendary' ? '#b45309' : '#2a2438' }} />
            ))}
            <div key={flare} className={`[backface-visibility:hidden] [transform-style:preserve-3d] ${flare ? (grade === HELL_GRADE ? 'card-grade-collapse' : grade === 6 || grade >= ELEMENT_GRADE ? 'card-grade-flare-top' : 'card-grade-flare') : ''}`}>
              <CardFace card={card} count={count} tilt={false} foil={foil} depth animate clipHeld={clipHeld} clipSound={clipSound} />
            </div>
            <div className="absolute inset-0 [backface-visibility:hidden]" style={{ transform: 'translateZ(-6px) rotateY(180deg)' }}>
              <CardBack rarity={card.rarity} />
            </div>
          </div>
        </div>
        <div className="text-center text-white">
          <p className={`font-display text-xl font-bold ${card.rarity === 'mythic' ? 'card-mythic-name' : ''}`}>{shownName(card.name, card.set)}</p>
          {form.title && <p className="text-sm italic opacity-80">{form.title}</p>}
          {card.awaken && !form.awakened && <p className="mt-1 text-xs text-[#fff1a8]">✪ Beat its guardian on Hard or Hell to awaken it: {card.awaken.title}.</p>}
          {clipHeld && (
            <button type="button" onClick={spinThenPlay}className="mr-2 mt-2 rounded-full border-2 border-white/40 px-3 py-1 text-sm font-bold hover:border-white">
              ▶ Play its video
            </button>
          )}
          {canHear(card) && (
            <button type="button" onClick={() => playVoice(card, true)} className="mt-2 rounded-full border-2 border-white/40 px-3 py-1 text-sm font-bold hover:border-white">
              🔊 Hear “{card.voice}”
            </button>
          )}
          <FavoriteButton cardId={card.id} />
          <CardVolume card={card} />
          <p className="text-sm opacity-80">
            {RARITY_INFO[card.rarity].name} · {gradeName(grade, element)} · {card.franchise} · pulled {count} time{count === 1 ? '' : 's'}
          </p>
          <AnomalyNote cardId={card.id} />
          <p className="mt-1 text-xs opacity-60">Drag to turn it · {clipHeld ? 'tap to spin it and play its video' : 'tap to spin it'} · Esc to close</p>
        </div>
        <UpgradeOffer card={card} onUpgraded={onUpgraded} />
        <Perks card={card} onGradeUp={() => setFlare((n) => n + 1)} />
      </div>
    </div>
  );
}

/**
 * A vaulted card (no longer given out) raised to its new rarity for DleCoins: every copy, its grade and element go
 * over (src/gacha/upgrades.ts). Two taps: the offer, then the confirmation, as the price is high.
 */
function UpgradeOffer({ card, onUpgraded }: { card: Card; onUpgraded: (into: Card) => void }) {
  const up = UPGRADES[card.id];
  const into = up && CARD_BY_ID.get(up.into);
  const coins = useProgress((s) => s.coins);
  const upgradeCard = useProgress((s) => s.upgradeCard);
  const [sure, setSure] = useState(false);
  if (!up || !into) return null;
  const enough = coins >= up.coins;
  const go = () => {
    if (!sure) return void (sfx.select(), setSure(true));
    if (!upgradeCard(card.id)) return void sfx.wrong();
    sfx.victory();
    celebrateBig();
    onUpgraded(into);
  };
  return (
    <div className="space-y-2 rounded-xl border-2 border-[#fde68a]/60 bg-gradient-to-br from-[#fde68a]/15 to-[#a78bfa]/15 p-3 text-center text-white">
      <p className="text-sm">
        <b>{shownName(card.name, card.set)}</b> is now an <b>{RARITY_INFO[into.rarity].name}</b> card: packs no longer give this {RARITY_INFO[card.rarity].name.toLowerCase()} version. Yours can go up.
      </p>
      <button
        type="button"
        onClick={go}
        disabled={!enough}
        className={`rounded-full border-2 px-4 py-1.5 text-sm font-bold transition ${enough ? (sure ? 'border-white bg-white text-black' : 'border-[#fde68a] bg-[#fde68a]/20 text-[#fef3c7] hover:bg-[#fde68a]/35') : 'border-dashed border-white/30 text-white/50'}`}
      >
        {sure ? `Confirm: pay ${up.coins.toLocaleString('en')} 🪙` : `✪ Upgrade to ${RARITY_INFO[into.rarity].name} — ${up.coins.toLocaleString('en')} 🪙`}
      </button>
      {!enough && <p className="text-xs text-white/60">Not enough DleCoins ({coins.toLocaleString('en')}/{up.coins.toLocaleString('en')}).</p>}
      {sure && <p className="text-xs text-white/70">Every copy, its grade and element go over to the {RARITY_INFO[into.rarity].name} card.</p>}
    </div>
  );
}

/** What the card can be: the player's icon (any card), the pages' background (Rare or better). */
function Perks({ card, onGradeUp }: { card: Card; onGradeUp: () => void }) {
  const count = useProgress((s) => s.cards[card.id] ?? 0);
  const grade = useProgress((s) => gradeOf(s.grades, card.id));
  const gradeUp = useProgress((s) => s.gradeUp);
  // The next grade's reward, unless that grade was already paid for once.
  const reward = useProgress((s) => (grade + 1 > (s.gradesPaid?.[card.id] ?? 1) ? gradeReward(card.rarity, grade + 1) : 0));
  const signedIn = useCloud((s) => s.name ?? s.email?.split('@')[0] ?? undefined);
  const hellBeaten = useProgress((s) => (s.bosses[bossKey(card.set, 'hell')]?.wins ?? 0) > 0);
  const ready = canGradeUp(count, grade, hellBeaten);
  const element = useProgress((s) => s.elements?.[card.id]);
  const coins = useProgress((s) => s.coins);
  const switchElement = useProgress((s) => s.switchElement);
  // The element grade asks for an element: the choice opens first (and again, to change it, once there).
  const [choosing, setChoosing] = useState(false);
  const nextIsElement = grade + 1 === ELEMENT_GRADE;
  const up = (picked?: ElementId) => {
    if (!gradeUp(card.id, card.rarity, signedIn, picked)) return;
    setChoosing(false);
    onGradeUp();
    // Singularity: the card collapses to a point, a silence, then the burst (see card-grade-collapse).
    if (grade + 1 === HELL_GRADE) window.setTimeout(() => (sfx.victory(), celebrateBig()), COLLAPSE_BURST_MS);
    else if (grade + 1 >= 4) (sfx.victory(), celebrateBig());
    else (sfx.streak(), celebrate());
  };
  const pick = (id: ElementId) => {
    if (grade < ELEMENT_GRADE) return up(id);
    if (!switchElement(card.id, id)) return sfx.wrong();
    setChoosing(false);
    onGradeUp();
    sfx.victory();
  };
  const spare = spareValue(card.rarity, grade);
  const exchange = useProgress((s) => s.exchangeCards);
  const avatar = useProgress((s) => s.avatar);
  const backdrop = useProgress((s) => s.backdrop);
  const setAvatar = useProgress((s) => s.setAvatar);
  const setBackdrop = useProgress((s) => s.setBackdrop);
  const inIconTurns = useProgress((s) => !!s.rotation?.avatar?.cards.includes(card.id));
  const inBackdropTurns = useProgress((s) => !!s.rotation?.backdrop?.cards.includes(card.id));
  const toggleTurn = useProgress((s) => s.toggleInRotation);
  const isAvatar = avatar === card.id;
  const isBackdrop = backdrop === card.id;
  const btn = (on: boolean) => `rounded-full border-2 px-3 py-1.5 text-sm font-bold transition ${on ? 'border-white bg-white text-black' : 'border-white/40 text-white hover:border-white'}`;
  return (
    <div className="flex flex-wrap justify-center gap-2">
      {/* Five copies into one a grade higher: the card and four spares. */}
      {grade < MAX_GRADE ? (
        <button
          type="button"
          onClick={() => (nextIsElement ? setChoosing((c) => !c) : up())}
          disabled={!ready}
          className={`flex items-center gap-1.5 rounded-full border-2 px-3 py-1 text-sm font-bold transition ${ready ? 'border-[#fde68a] bg-[#fde68a]/15 text-[#fef3c7] hover:bg-[#fde68a]/30' : 'border-dashed border-white/25 text-white/50'}`}
          title={`Merge ${GRADE_COST + 1} copies of this card into one: the card and ${GRADE_COST} spares`}
        >
          <GradeEmblem grade={grade + 1} info={nextIsElement ? GRADES[grade + 1] : undefined} className="size-7" />
          {ready
            ? nextIsElement
              ? `Ascend to ${GRADES[grade + 1].name}: choose an element`
              : `Upgrade to ${GRADES[grade + 1].name}`
            : grade + 1 === HELL_GRADE && !hellBeaten
              ? `${GRADES[grade + 1].name}: ${Math.max(0, count - 1)}/${GRADE_COST} spares, and beat its boss on Hell`
              : `${GRADES[grade + 1].name}: ${Math.max(0, count - 1)}/${GRADE_COST} spares`}
          {reward > 0 && <span className="ml-1 rounded-full bg-[#fde68a]/20 px-1.5 text-xs text-[#fde68a]">+{reward} 🪙</span>}
        </button>
      ) : (
        <span className="flex items-center gap-1.5 rounded-full border-2 border-[#fde68a] px-3 py-1 text-sm font-bold text-[#fef3c7]">
          <GradeEmblem grade={MAX_GRADE} element={element} className="size-7" /> {gradeName(MAX_GRADE, element)} — top grade
        </span>
      )}
      {grade >= ELEMENT_GRADE && (
        <button type="button" onClick={() => setChoosing((c) => !c)} className={btn(choosing)} title="Pick another element for this card">
          🔄 Change element ({ELEMENT_SWITCH_COST} 🪙)
        </button>
      )}
      {choosing && <ElementChoice current={grade >= ELEMENT_GRADE ? element : undefined} cost={grade >= ELEMENT_GRADE ? ELEMENT_SWITCH_COST : 0} coins={coins} onPick={pick} />}
      <button type="button" onClick={() => (sfx.select(), setAvatar(isAvatar ? null : card.id))} className={btn(isAvatar)}>
        {isAvatar ? '✓ Your icon' : '👤 Use as my icon'}
      </button>
      {canBeBackdrop(card) ? (
        <button type="button" onClick={() => (sfx.select(), setBackdrop(isBackdrop ? null : card.id))} className={btn(isBackdrop)}>
          {isBackdrop ? '✓ Your background' : '🖼 Use as background'}
        </button>
      ) : (
        <span className="rounded-full border-2 border-dashed border-white/25 px-3 py-1.5 text-sm font-semibold text-white/50" title="Only Rare cards and better can be a background">
          🖼 Background: Rare or better
        </span>
      )}
      <button type="button" onClick={() => (sfx.select(), toggleTurn('avatar', card.id))} className={btn(inIconTurns)} title="Your icon takes turns between the cards in this list (Account page)">
        {inIconTurns ? '✓ In icon turns' : '🔄 Icon turns'}
      </button>
      {canBeBackdrop(card) && (
        <button type="button" onClick={() => (sfx.select(), toggleTurn('backdrop', card.id))} className={btn(inBackdropTurns)} title="Your background takes turns between the cards in this list (Account page)">
          {inBackdropTurns ? '✓ In background turns' : '🔄 Background turns'}
        </button>
      )}
      {count > 1 && (
        <button
          type="button"
          onClick={() => (sfx.correct(), exchange({ [card.id]: 1 }, spare))}
          className={btn(false)}
          title={grade >= ELEMENT_GRADE ? `One copy always stays in your album. At ${GRADES[ELEMENT_GRADE].name}, spares fetch ×${RESALE_BONUS}` : 'One copy always stays in your album'}
        >
          ♻ Exchange a spare copy (+{spare} coins{grade >= ELEMENT_GRADE ? ` · ×${RESALE_BONUS}` : ''})
        </button>
      )}
      {/* Every spare at once (asked twice). */}
      {count > 2 && <SellSpares card={card} dark />}
      <Link to={`/trades?give=${card.id}`} className={btn(false)}>
        ⇄ Offer in a trade
      </Link>
    </div>
  );
}

/** The six elements to choose from at the element grade (or to change to, for a few coins). */
function ElementChoice({ current, cost, coins, onPick }: { current?: ElementId; cost: number; coins: number; onPick: (id: ElementId) => void }) {
  return (
    <div className="w-full space-y-2 rounded-xl border-2 border-white/20 bg-black/40 p-3 text-white">
      <p className="text-center text-sm font-bold">{cost ? `Change its element for ${cost} 🪙` : 'Choose its element: it can be changed later'}</p>
      <div className="grid grid-cols-2 gap-2 min-[420px]:grid-cols-3">
        {ELEMENT_IDS.map((id) => {
          const e = ELEMENTS[id];
          const disabled = id === current || coins < cost;
          return (
            <button
              key={id}
              type="button"
              disabled={disabled}
              onClick={() => onPick(id)}
              className="flex flex-col items-center gap-1 rounded-lg border-2 p-2 text-center transition enabled:hover:scale-[1.03] disabled:opacity-40"
              style={{ borderColor: e.colors[1], background: `linear-gradient(160deg, ${e.colors[1]}33, transparent)` }}
              title={e.blurb}
            >
              <GradeEmblem grade={ELEMENT_GRADE} element={id} className="size-10" />
              <span className="text-sm font-bold">
                {e.icon} {e.name}
              </span>
              <span className="text-[11px] leading-tight opacity-75">{id === current ? 'Its element now' : e.blurb}</span>
            </button>
          );
        })}
      </div>
      {cost > 0 && coins < cost && <p className="text-center text-xs text-white/60">Not enough DleCoins ({coins}/{cost}).</p>}
    </div>
  );
}

/** /album */
export default function Album() {
  /** On a phone: the mythic or omni brought to life by a first tap. */
  const [armed, setArmed] = useState<string | null>(null);
  const lastPointer = useRef('mouse');
  const owned = useProgress((s) => s.cards);
  const grades = useProgress((s) => s.grades);
  const anomalies = useProgress((s) => s.anomalies ?? NONE);
  const anomalyOptions = useProgress((s) => s.anomalyOptions ?? NONE);
  const favorites = useProgress((s) => s.favorites ?? NONE);
  const pulledAt = useProgress((s) => s.pulledAt ?? NONE);
  const bosses = useProgress((s) => s.bosses);
  const coins = useProgress((s) => s.coins);
  const [set, setSet] = useKept('omnidle:album:set', 'all', (v) => v === 'all' || SETS.some((s) => s.id === v));
  const [rarities, setRarities] = useKept<Rarity[]>('omnidle:album:rarities', RARITIES, (v) => Array.isArray(v) && v.length > 0 && v.every((r) => RARITIES.includes(r as Rarity)));
  const [show, setShow] = useKept<Show>('omnidle:album:show', 'all', (v) => SHOWS.some((s) => s.id === v));
  const [sort, setSort] = useKept<Sort>('omnidle:album:sort', 'set', (v) => SORTS.some((s) => s.id === v));
  const [reverse, setReverse] = useKept('omnidle:album:reverse', false, (v) => typeof v === 'boolean');
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState<Card | null>(null);
  const [renewing, setRenewing] = useState(false);
  const [bulk, setBulk] = useState<'grade' | 'sell' | null>(null);
  const canRenew = useMemo(() => Object.values(spareByRarity(owned)).some((n) => n >= RENEW_COST), [owned]);

  // Every spare copy (beyond the first of each card), and what they're worth together.
  const spare = useMemo(() => {
    const byId: Record<string, number> = {};
    let copies = 0;
    let coins = 0;
    for (const c of CARDS) {
      const n = (owned[c.id] ?? 0) - 1;
      if (n > 0) (byId[c.id] = n), (copies += n), (coins += n * spareValue(c.rarity, gradeOf(grades, c.id)));
    }
    return { byId, copies, coins };
  }, [owned, grades]);
  // Cards ready for their next grade now (the element grade counts: it opens in the dialog).
  const upgradable = useMemo(() => CARDS.filter((c) => (owned[c.id] ?? 0) > 1 && canGradeUp(owned[c.id], gradeOf(grades, c.id), (bosses[bossKey(c.set, 'hell')]?.wins ?? 0) > 0)).length, [owned, grades, bosses]);
  // Every count the page shows, in one pass over the cards (not one per rarity and per set at each render).
  const counts = useMemo(() => {
    const bySet: Record<string, number> = {};
    const byRarity = {} as Record<Rarity, number>;
    let unique = 0;
    for (const c of COLLECTIBLE) {
      if (!owned[c.id]) continue;
      unique++;
      bySet[c.set] = (bySet[c.set] ?? 0) + 1;
      byRarity[c.rarity] = (byRarity[c.rarity] ?? 0) + 1;
    }
    return { unique, bySet, byRarity };
  }, [owned]);
  const unique = counts.unique;
  // Typing stays smooth: the grid follows the search a moment later.
  const search = useDeferredValue(query);
  const pulls = Object.values(owned).reduce((a, b) => a + b, 0);
  const list = useMemo(() => {
    const words = fold(search).split(' ').filter(Boolean);
    const shown = (c: Card) => {
      const n = owned[c.id] ?? 0;
      switch (show) {
        case 'owned':
          return n > 0;
        case 'missing':
          return n === 0;
        case 'favorites':
          return n > 0 && !!favorites[c.id];
        case 'spares':
          return n > 1;
        case 'upgradable':
          return n > 1 && canGradeUp(n, gradeOf(grades, c.id), (bosses[bossKey(c.set, 'hell')]?.wins ?? 0) > 0);
        case 'altered':
          return n > 0 && (!!anomalies[c.id] || !!anomalyOptions[c.id]?.length);
        default:
          return true;
      }
    };
    const xs = CARDS.filter((c) => {
      if ((set !== 'all' && c.set !== set) || !rarities.includes(c.rarity) || !shown(c)) return false;
      // A vaulted card is no longer given out: only its owners see it.
      if (isVaulted(c.id) && !owned[c.id]) return false;
      if (!words.length) return true;
      const text = SEARCH_TEXT.get(c.id) ?? '';
      return words.every((w) => text.includes(w));
    });
    // Cards not owned last: they have no grade.
    const byGrade = (c: Card) => (owned[c.id] ? gradeOf(grades, c.id) : 0);
    const byRarity = (a: Card, b: Card) => RARITY_INFO[b.rarity].rank - RARITY_INFO[a.rarity].rank;
    // Last pulled first; cards pulled before pulls were dated come next, then the cards not owned.
    const byRecent = (c: Card) => (owned[c.id] ? (pulledAt[c.id] ?? 1) : 0);
    const bySet = (a: Card, b: Card) => (SET_ORDER.get(a.set) ?? 0) - (SET_ORDER.get(b.set) ?? 0) || a.no - b.no;
    const sorted = [...xs].sort(
      sort === 'rarity' ? (a, b) => byRarity(a, b) || bySet(a, b) : sort === 'grade' ? (a, b) => byGrade(b) - byGrade(a) || byRarity(a, b) || bySet(a, b) : sort === 'name' ? (a, b) => a.name.localeCompare(b.name) : sort === 'count' ? (a, b) => (owned[b.id] ?? 0) - (owned[a.id] ?? 0) || byRarity(a, b) : sort === 'recent' ? (a, b) => byRecent(b) - byRecent(a) || byRarity(a, b) || bySet(a, b) : bySet,
    );
    return reverse ? sorted.reverse() : sorted;
  }, [set, rarities, show, sort, reverse, search, owned, grades, anomalies, anomalyOptions, favorites, bosses, pulledAt]);
  const filtered = set !== 'all' || rarities.length < RARITIES.length || show !== 'all' || !!query.trim();
  const clearFilters = () => {
    sfx.click();
    setSet('all');
    setRarities(RARITIES);
    setShow('all');
    setQuery('');
  };
  const setInfo = set === 'all' ? null : SETS.find((s) => s.id === set);
  const setOwned = setInfo ? counts.bySet[setInfo.id] ?? 0 : 0;
  // The grid in blocks of whole rows: only the blocks near the screen hold their cards (see AlbumBlock).
  const blocks = useMemo(() => Array.from({ length: Math.ceil(list.length / BLOCK) }, (_, i) => list.slice(i * BLOCK, (i + 1) * BLOCK)), [list]);

  /** One card of the grid: owned, the card itself (a button to open it); missing, its outline. */
  const cell = (c: Card) =>
    owned[c.id] ? (
      <button
        key={c.id}
        type="button"
        onPointerDown={(e) => (lastPointer.current = e.pointerType)}
        onClick={() => {
          // On a phone, a mythic's or omni's first tap brings it to life; the next opens it.
          const top = c.rarity === 'mythic' || c.rarity === 'omni';
          if (top && lastPointer.current === 'touch' && armed !== c.id) return (sfx.select(), setArmed(c.id));
          sfx.select();
          setArmed(null);
          setOpen(c);
        }}
        className={`relative transition hover:z-10 hover:-translate-y-1 ${armed === c.id ? 'z-10' : ''}`}
        aria-label={`${c.name}, ${RARITY_INFO[c.rarity].name}`}
      >
        <CardFace card={c} count={owned[c.id]} hoverHero hero={armed === c.id} />
        {favorites[c.id] && <span className="pointer-events-none absolute -left-1.5 -top-1.5 z-20 grid size-6 place-items-center rounded-full bg-[#fbbf24] text-sm text-[#3b2a00] shadow" aria-label="Favourite">★</span>}
        {armed === c.id && <span className="pointer-events-none absolute inset-x-0 -bottom-2 z-30 text-center font-display text-[10px] font-bold tracking-wider text-white drop-shadow">TAP AGAIN TO OPEN</span>}
      </button>
    ) : (
      <CardMissing key={c.id} card={c} />
    );

  const toggleRarity = (r: Rarity) => {
    sfx.click();
    setRarities((xs) => (xs.includes(r) ? (xs.length > 1 ? xs.filter((x) => x !== r) : xs) : RARITIES.filter((x) => x === r || xs.includes(x))));
  };
  const pill = (on: boolean) => `rounded-full border-2 px-3 py-1 text-sm font-semibold transition ${on ? 'border-ink bg-ink text-paper' : 'border-rule-strong bg-card text-ink-soft hover:border-ink'}`;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link to="/games" className="font-display text-sm font-semibold tracking-wider text-ink-soft hover:text-ink">
            ← Games
          </Link>
          <h1 className="text-5xl font-bold">Album</h1>
          <p className="text-ink-soft">
            {unique} of {COLLECTIBLE.length} cards collected · {pulls} pulled in all ·{' '}
            {RARITIES.map((r) => `${counts.byRarity[r] ?? 0}/${RARITY_TOTAL[r]} ${RARITY_INFO[r].name.toLowerCase()}`).join(' · ')}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {upgradable > 0 && (
            <button type="button" onClick={() => (sfx.click(), setBulk('grade'))} className="btn-paper rounded-md px-4 py-2.5 font-display font-bold ring-2 ring-accent" title="Grade up every card that has enough spares, at once">
              ⬆ Grade up all ({upgradable})
            </button>
          )}
          {spare.copies > 0 && (
            <button type="button" onClick={() => (sfx.click(), setBulk('sell'))} className="btn-paper rounded-md px-4 py-2.5 font-display font-bold" title="Choose which spare copies to sell, and how many">
              ♻ Sell spares ({spare.copies}) · <Coins n={spare.coins} />
            </button>
          )}
          <button type="button" onClick={() => (sfx.click(), setRenewing(true))} className={`btn-paper rounded-md px-4 py-2.5 font-display font-bold ${canRenew ? 'ring-2 ring-accent' : ''}`} title={`${RENEW_COST} spare copies of a rarity for a new card of it`}>
            ♻ Renew
          </button>
          <Link to="/trades" className="btn-paper rounded-md px-4 py-2.5 font-display font-bold">
            ⇄ Trades
          </Link>
          <Link to="/shop" className="btn-accent rounded-md px-5 py-2.5 font-display font-bold">
            Card Shop · <Coins n={coins} />
          </Link>
        </div>
      </div>

      <div className="page flex flex-wrap items-center gap-3 rounded-md p-3">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search a card or franchise…"
          aria-label="Search"
          className="min-w-0 flex-1 basis-48 rounded-md border border-rule-strong bg-card px-3 py-1.5 text-sm"
        />
        <select value={set} onChange={(e) => setSet(e.target.value)} className="rounded-md border border-rule-strong bg-card px-2 py-1.5 text-sm font-semibold" aria-label="Set">
          <option value="all">Every set</option>
          {SETS_BY_DOMAIN.map((g) => (
            <optgroup key={g.domain.id} label={`${g.domain.icon} ${g.domain.label}`}>
              {g.sets.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.franchise} ({counts.bySet[s.id] ?? 0}/{s.size})
                </option>
              ))}
            </optgroup>
          ))}
        </select>
        <div className="flex flex-wrap gap-1.5">
          {RARITIES.map((r) => (
            <button key={r} type="button" aria-pressed={rarities.includes(r)} onClick={() => toggleRarity(r)} className={pill(rarities.includes(r))}>
              {RARITY_INFO[r].gem} {RARITY_INFO[r].name}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {SHOWS.map((s) => (
            <button key={s.id} type="button" aria-pressed={show === s.id} onClick={() => (sfx.click(), setShow(s.id))} className={pill(show === s.id)} title={s.title}>
              {s.label}
              {s.id === 'altered' && ` (${[...new Set([...Object.keys(anomalies), ...Object.keys(anomalyOptions)])].filter((id) => owned[id]).length})`}
              {s.id === 'favorites' && ` (${Object.keys(favorites).filter((id) => owned[id]).length})`}
            </button>
          ))}
        </div>
        <label className="ml-auto flex items-center gap-2 text-sm font-semibold">
          Sort
          <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} className="rounded-md border border-rule-strong bg-card px-2 py-1.5">
            {SORTS.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
          <button type="button" onClick={() => (sfx.click(), setReverse((r) => !r))} aria-pressed={reverse} title="Reverse the order" className={pill(reverse)}>
            ⇅
          </button>
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-3 text-sm text-ink-soft">
        <span>
          {list.length} card{list.length === 1 ? '' : 's'} shown
        </span>
        {setInfo && (
          <span className="flex items-center gap-2">
            <span className="h-2 w-32 overflow-hidden rounded-full bg-rule">
              <span className="block h-full rounded-full bg-accent" style={{ width: `${(100 * setOwned) / Math.max(1, setInfo.size)}%` }} />
            </span>
            {setInfo.franchise}: {setOwned}/{setInfo.size} ({Math.floor((100 * setOwned) / Math.max(1, setInfo.size))}%)
          </span>
        )}
        {filtered && (
          <button type="button" onClick={clearFilters} className="font-semibold text-accent hover:underline">
            Clear filters
          </button>
        )}
      </div>

      {!unique && (
        <p className="page rounded-md p-4 text-center text-ink-soft">
          No cards yet. Play the dailies and the games to earn DleCoins, then open a pack in the{' '}
          <Link to="/shop" className="font-semibold text-accent">
            Card Shop
          </Link>
          .
        </p>
      )}

      <div className="space-y-3">
        {blocks.map((cards, i) => (
          <AlbumBlock key={i} cards={cards} render={cell} />
        ))}
      </div>
      {!list.length && <p className="text-center text-ink-soft">No card fits these filters.</p>}

      {open && <Inspect card={open} count={owned[open.id] ?? 0} onClose={() => setOpen(null)} onUpgraded={setOpen} />}
      {renewing && <RenewDialog onClose={() => setRenewing(false)} />}
      {bulk === 'grade' && <GradeAllDialog onClose={() => setBulk(null)} />}
      {bulk === 'sell' && <SellDialog onClose={() => setBulk(null)} />}
    </div>
  );
}

/** Cards per block of the grid: whole rows at every width (3, 4, 5 or 6 cards a row), so the blocks stack like one grid. */
const BLOCK = 60;
/** How far off screen a block keeps its cards (px): they're there before they scroll in. */
const NEAR_MARGIN = 1600;
/** Cards drawn each frame as a block comes near. */
const DRAW_PER_FRAME = 12;

/**
 * A block of the album's grid. Near the screen it holds its cards; further off, boxes of the same size (a
 * full album is thousands of cards, each one a little world of animations). Each card it holds stands
 * still while it's off screen — its animations pause until it scrolls back in. On screen, nothing changes.
 */
function AlbumBlock({ cards, render }: { cards: Card[]; render: (c: Card) => ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(false);
  // How many of its cards are drawn: coming near, a few each frame (no stall while scrolling).
  const [drawn, setDrawn] = useState(0);
  // Before the first paint: the blocks already on screen show all their cards straight away.
  useLayoutEffect(() => {
    const r = ref.current?.getBoundingClientRect();
    if (r && r.bottom > -NEAR_MARGIN && r.top < window.innerHeight + NEAR_MARGIN) (setNear(true), setDrawn(cards.length));
    // Only on the first paint.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setNear(e.isIntersecting), { rootMargin: `${NEAR_MARGIN}px 0px` });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  useEffect(() => {
    if (!near) return setDrawn(0);
    if (drawn >= cards.length) return;
    const id = requestAnimationFrame(() => setDrawn((n) => Math.min(cards.length, n + DRAW_PER_FRAME)));
    return () => cancelAnimationFrame(id);
  }, [near, drawn, cards.length]);
  // Its cards, one by one: marked still while off screen (see [data-still] in index.css).
  useEffect(() => {
    const el = ref.current;
    if (!near || !el) return;
    const io = new IntersectionObserver((entries) => entries.forEach((e) => e.target.toggleAttribute('data-still', !e.isIntersecting)), { rootMargin: '60px 0px' });
    for (const cell of el.children) io.observe(cell);
    return () => io.disconnect();
  }, [near, drawn, cards]);
  return (
    <div ref={ref} className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
      {cards.map((c, i) => (near && i < drawn ? render(c) : <div key={c.id} className="aspect-[5/7] w-full" />))}
    </div>
  );
}

/** Stars a card (or takes its star off): starred cards have their own filter in the Album. */
/**
 * A Mythic's or Omni's own volumes: its voice line, and its video's sound behind a win (a video with a sound of its
 * own, like Gogeta's). 100% is as it comes; up to 200% (louder only for the sounds the site keeps itself).
 */
function CardVolume({ card }: { card: Card }) {
  const volume = useProgress((s) => s.cardVolume?.[card.id]);
  const setCardVolume = useProgress((s) => s.setCardVolume);
  if (card.rarity !== 'mythic' && card.rarity !== 'omni') return null;
  const rows = [
    ...(card.voice ? [{ kind: 'voice' as const, label: '🗣️ Voice line' }] : []),
    ...(card.clipSound ? [{ kind: 'clip' as const, label: '🎬 Video behind a win' }] : []),
  ];
  if (!rows.length) return null;
  return (
    <div className="mx-auto mt-2 max-w-xs space-y-1.5 rounded-md border border-white/20 bg-white/5 px-3 py-2 text-left text-xs">
      <p className="font-display font-bold tracking-widest text-white/70">VOLUME</p>
      {rows.map(({ kind, label }) => {
        const v = volume?.[kind] ?? 100;
        return (
          <label key={kind} className="flex items-center gap-2">
            <span className="w-36 shrink-0">{label}</span>
            <input
              type="range"
              min={0}
              max={200}
              step={5}
              value={v}
              onChange={(e) => setCardVolume(card.id, kind, Number(e.target.value))}
              onPointerUp={() => kind === 'voice' && playVoice(card, true)}
              className="min-w-0 flex-1 accent-[#a78bfa]"
              aria-label={`${label} volume`}
            />
            <span className="w-10 text-right tabular-nums">{v}%</span>
          </label>
        );
      })}
    </div>
  );
}

function FavoriteButton({ cardId }: { cardId: string }) {
  const on = useProgress((s) => !!s.favorites?.[cardId]);
  const toggle = useProgress((s) => s.toggleFavorite);
  return (
    <button
      type="button"
      onClick={() => (sfx.click(), toggle(cardId))}
      aria-pressed={on}
      className={`mt-2 rounded-full border-2 px-3 py-1 text-sm font-bold ${on ? 'border-[#fbbf24] text-[#fbbf24]' : 'border-white/40 hover:border-white'}`}
    >
      {on ? '★ Favourite' : '☆ Add to favourites'}
    </button>
  );
}

/**
 * A card back from a black hole: its anomaly, and a way to let it go (it can't be got back); and the other anomalies
 * it got but doesn't wear (skipped past in an opening, or replaced), to switch to — the one it wore waits in turn.
 */
function AnomalyNote({ cardId }: { cardId: string }) {
  const id = useProgress((s) => s.anomalies?.[cardId]);
  const others = useProgress((s) => s.anomalyOptions?.[cardId]);
  const setAnomaly = useProgress((s) => s.setAnomaly);
  if (!id && !others?.length) return null;
  const a = id ? ANOMALIES[id] : null;
  return (
    <p className="mt-1 text-xs text-[#c4b5fd]">
      {a ? (
        <>
          {a.icon} {a.name} — back from a black hole.{' '}
          <button type="button" onClick={() => window.confirm(`Remove ${a.name} from this card for good?`) && setAnomaly(cardId, null)} className="underline opacity-80 hover:opacity-100">
            Remove it
          </button>
        </>
      ) : (
        <>🕳️ Back from a black hole, wearing nothing yet.</>
      )}
      {(others ?? []).map((o) => (
        <button key={o} type="button" onClick={() => setAnomaly(cardId, o)} className="ml-2 rounded-full border border-[#c4b5fd]/60 px-2 py-0.5 font-semibold hover:bg-[#c4b5fd]/15" title={ANOMALIES[o].name}>
          {a ? 'Switch to' : 'Wear'} {ANOMALIES[o].icon} {ANOMALIES[o].name}
        </button>
      ))}
    </p>
  );
}
