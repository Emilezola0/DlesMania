import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Coins } from '../components/DleCoin';
import { CardBack, CardFace, CardMissing, useCardForm } from '../gacha/CardView';
import { CARDS, RARITIES, RARITY_INFO, SETS, type Card, type Rarity } from '../gacha/cards';
import { DUPLICATE_VALUE } from '../gacha/economy';
import { GradeEmblem } from '../gacha/GradeEmblem';
import { canGradeUp, GRADE_COST, gradeOf, GRADES, MAX_GRADE } from '../gacha/grades';
import { celebrate, celebrateBig } from '../lib/fx';
import { canBeBackdrop } from '../gacha/Perks';
import { RENEW_COST, RenewDialog, spareByRarity } from '../gacha/Renew';
import { canHear, playVoice } from '../gacha/voice';
import { shownName } from '../lib/french';
import { sfx } from '../lib/sfx';
import { useProgress } from '../store/progress';

type Show = 'all' | 'owned' | 'missing';
type Sort = 'set' | 'rarity' | 'grade' | 'name' | 'count';

const SORTS: { id: Sort; label: string }[] = [
  { id: 'set', label: 'Set' },
  { id: 'rarity', label: 'Rarity' },
  { id: 'grade', label: 'Grade' },
  { id: 'name', label: 'Name' },
  { id: 'count', label: 'Most pulled' },
];
const SET_ORDER = new Map(SETS.map((s, i) => [s.id, i]));

/**
 * One card, big, in 3D: it sways gently on its own, so its foil keeps catching the light; drag it to
 * turn it in your hands (the foil follows, its thick edge and its back show past a half turn), tap
 * it to send it spinning. The name, badges and ribbon stand off the surface.
 */
function Inspect({ card, count, onClose }: { card: Card; count: number; onClose: () => void }) {
  // An omni shows the form it has reached (its title changes once awakened).
  const form = useCardForm(card);
  const grade = useProgress((s) => gradeOf(s.grades, card.id));
  // Bumped on a grade-up: the card flares.
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
  const up = () => {
    const s = start.current;
    start.current = null;
    setDragging(false);
    setRot({ x: 0, y: 0 });
    // A tap, not a drag: a full spin.
    if (s && !s.moved) (sfx.whoosh(), setSpin((n) => n + 360));
  };

  // Held, the card goes where the hand takes it; let go, it sways.
  const rx = dragging ? rot.x : sway.x;
  const ry = (dragging ? rot.y : sway.y) + spin;
  // The foil takes its light from the turn: a few degrees move it across the whole card.
  const face = ((((ry % 360) + 540) % 360) - 180) as number;
  const foil = { x: Math.max(0, Math.min(100, 50 + face * 1.6)), y: Math.max(0, Math.min(100, 50 - rx * 2.2)) };
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/80 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full space-y-4" style={{ maxWidth: 'min(24rem, calc((100vh - 9rem) * 5 / 7))' }} onClick={(e) => e.stopPropagation()}>
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
            <div key={flare} className={`[backface-visibility:hidden] [transform-style:preserve-3d] ${flare ? 'card-grade-flare' : ''}`}>
              <CardFace card={card} count={count} tilt={false} foil={foil} depth />
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
          {canHear(card) && (
            <button type="button" onClick={() => playVoice(card, true)} className="mt-2 rounded-full border-2 border-white/40 px-3 py-1 text-sm font-bold hover:border-white">
              🔊 Hear “{card.voice}”
            </button>
          )}
          <p className="text-sm opacity-80">
            {RARITY_INFO[card.rarity].name} · {GRADES[grade].name} · {card.franchise} · pulled {count} time{count === 1 ? '' : 's'}
          </p>
          <p className="mt-1 text-xs opacity-60">Drag to turn it · tap to spin it · Esc to close</p>
        </div>
        <Perks card={card} onGradeUp={() => setFlare((n) => n + 1)} />
      </div>
    </div>
  );
}

/** What the card can be: the player's icon (any card), the pages' background (Rare or better). */
function Perks({ card, onGradeUp }: { card: Card; onGradeUp: () => void }) {
  const count = useProgress((s) => s.cards[card.id] ?? 0);
  const grade = useProgress((s) => gradeOf(s.grades, card.id));
  const gradeUp = useProgress((s) => s.gradeUp);
  const up = () => {
    if (!gradeUp(card.id)) return;
    onGradeUp();
    if (grade + 1 >= 4) (sfx.victory(), celebrateBig());
    else (sfx.streak(), celebrate());
  };
  const exchange = useProgress((s) => s.exchangeCards);
  const avatar = useProgress((s) => s.avatar);
  const backdrop = useProgress((s) => s.backdrop);
  const setAvatar = useProgress((s) => s.setAvatar);
  const setBackdrop = useProgress((s) => s.setBackdrop);
  const isAvatar = avatar === card.id;
  const isBackdrop = backdrop === card.id;
  const btn = (on: boolean) => `rounded-full border-2 px-3 py-1.5 text-sm font-bold transition ${on ? 'border-white bg-white text-black' : 'border-white/40 text-white hover:border-white'}`;
  return (
    <div className="flex flex-wrap justify-center gap-2">
      {/* Five copies into one a grade higher: the card and four spares. */}
      {grade < MAX_GRADE ? (
        <button
          type="button"
          onClick={up}
          disabled={!canGradeUp(count, grade)}
          className={`flex items-center gap-1.5 rounded-full border-2 px-3 py-1 text-sm font-bold transition ${canGradeUp(count, grade) ? 'border-[#fde68a] bg-[#fde68a]/15 text-[#fef3c7] hover:bg-[#fde68a]/30' : 'border-dashed border-white/25 text-white/50'}`}
          title={`Merge ${GRADE_COST + 1} copies of this card into one: the card and ${GRADE_COST} spares`}
        >
          <GradeEmblem grade={grade + 1} className="size-7" />
          {canGradeUp(count, grade) ? `Upgrade to ${GRADES[grade + 1].name}` : `${GRADES[grade + 1].name}: ${Math.max(0, count - 1)}/${GRADE_COST} spares`}
        </button>
      ) : (
        <span className="flex items-center gap-1.5 rounded-full border-2 border-[#f0abfc] px-3 py-1 text-sm font-bold text-[#fdf4ff]">
          <GradeEmblem grade={MAX_GRADE} className="size-7" /> Radiant — top grade
        </span>
      )}
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
      {count > 1 && (
        <button type="button" onClick={() => (sfx.correct(), exchange({ [card.id]: 1 }, DUPLICATE_VALUE[card.rarity]))} className={btn(false)} title="One copy always stays in your album">
          ♻ Exchange a spare copy (+{DUPLICATE_VALUE[card.rarity]} coins)
        </button>
      )}
      <Link to={`/trades?give=${card.id}`} className={btn(false)}>
        ⇄ Offer in a trade
      </Link>
    </div>
  );
}

/** /album */
export default function Album() {
  const owned = useProgress((s) => s.cards);
  const grades = useProgress((s) => s.grades);
  const coins = useProgress((s) => s.coins);
  const [set, setSet] = useState('all');
  const [rarities, setRarities] = useState<Rarity[]>(RARITIES);
  const [show, setShow] = useState<Show>('all');
  const [sort, setSort] = useState<Sort>('set');
  const [open, setOpen] = useState<Card | null>(null);
  const [renewing, setRenewing] = useState(false);
  const canRenew = useMemo(() => Object.values(spareByRarity(owned)).some((n) => n >= RENEW_COST), [owned]);

  const exchange = useProgress((s) => s.exchangeCards);
  // Every spare copy (beyond the first of each card), and what they're worth together.
  const spare = useMemo(() => {
    const byId: Record<string, number> = {};
    let copies = 0;
    let coins = 0;
    for (const c of CARDS) {
      const n = (owned[c.id] ?? 0) - 1;
      if (n > 0) (byId[c.id] = n), (copies += n), (coins += n * DUPLICATE_VALUE[c.rarity]);
    }
    return { byId, copies, coins };
  }, [owned]);
  const unique = CARDS.filter((c) => owned[c.id]).length;
  const pulls = Object.values(owned).reduce((a, b) => a + b, 0);
  const list = useMemo(() => {
    const xs = CARDS.filter((c) => (set === 'all' || c.set === set) && rarities.includes(c.rarity) && (show === 'all' || (show === 'owned') === !!owned[c.id]));
    // Cards not owned last: they have no grade.
    const byGrade = (c: Card) => (owned[c.id] ? gradeOf(grades, c.id) : 0);
    const byRarity = (a: Card, b: Card) => RARITY_INFO[b.rarity].rank - RARITY_INFO[a.rarity].rank;
    const bySet = (a: Card, b: Card) => (SET_ORDER.get(a.set) ?? 0) - (SET_ORDER.get(b.set) ?? 0) || a.no - b.no;
    return [...xs].sort(
      sort === 'rarity' ? (a, b) => byRarity(a, b) || bySet(a, b) : sort === 'grade' ? (a, b) => byGrade(b) - byGrade(a) || byRarity(a, b) || bySet(a, b) : sort === 'name' ? (a, b) => a.name.localeCompare(b.name) : sort === 'count' ? (a, b) => (owned[b.id] ?? 0) - (owned[a.id] ?? 0) || byRarity(a, b) : bySet,
    );
  }, [set, rarities, show, sort, owned, grades]);

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
            {unique} of {CARDS.length} cards collected · {pulls} pulled in all ·{' '}
            {RARITIES.map((r) => `${CARDS.filter((c) => c.rarity === r && owned[c.id]).length}/${CARDS.filter((c) => c.rarity === r).length} ${RARITY_INFO[r].name.toLowerCase()}`).join(' · ')}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {spare.copies > 0 && (
            <button
              type="button"
              onClick={() => {
                if (!window.confirm(`Exchange ${spare.copies} spare cop${spare.copies === 1 ? 'y' : 'ies'} for ${spare.coins} DleCoins? One copy of each card stays in your album.`)) return;
                sfx.streak();
                exchange(spare.byId, spare.coins);
              }}
              className="btn-paper rounded-md px-4 py-2.5 font-display font-bold"
            >
              ♻ Exchange {spare.copies} spare{spare.copies === 1 ? '' : 's'} · <Coins n={spare.coins} />
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
        <select value={set} onChange={(e) => setSet(e.target.value)} className="rounded-md border border-rule-strong bg-card px-2 py-1.5 text-sm font-semibold" aria-label="Set">
          <option value="all">Every set</option>
          {SETS.map((s) => (
            <option key={s.id} value={s.id}>
              {s.franchise} ({CARDS.filter((c) => c.set === s.id && owned[c.id]).length}/{s.size})
            </option>
          ))}
        </select>
        <div className="flex flex-wrap gap-1.5">
          {RARITIES.map((r) => (
            <button key={r} type="button" aria-pressed={rarities.includes(r)} onClick={() => toggleRarity(r)} className={pill(rarities.includes(r))}>
              {RARITY_INFO[r].gem} {RARITY_INFO[r].name}
            </button>
          ))}
        </div>
        <div className="flex gap-1.5">
          {(['all', 'owned', 'missing'] as Show[]).map((s) => (
            <button key={s} type="button" aria-pressed={show === s} onClick={() => (sfx.click(), setShow(s))} className={pill(show === s)}>
              {s === 'all' ? 'All' : s === 'owned' ? 'Owned' : 'Missing'}
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
        </label>
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

      <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
        {list.map((c) =>
          owned[c.id] ? (
            <button key={c.id} type="button" onClick={() => (sfx.select(), setOpen(c))} className="transition hover:z-10 hover:-translate-y-1" aria-label={`${c.name}, ${RARITY_INFO[c.rarity].name}`}>
              <CardFace card={c} count={owned[c.id]} />
            </button>
          ) : (
            <CardMissing key={c.id} card={c} />
          ),
        )}
      </div>
      {!list.length && <p className="text-center text-ink-soft">No card fits these filters.</p>}

      {open && <Inspect card={open} count={owned[open.id] ?? 0} onClose={() => setOpen(null)} />}
      {renewing && <RenewDialog onClose={() => setRenewing(false)} />}
    </div>
  );
}
