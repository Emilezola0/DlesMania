// The rarities guide (#/rarities): what each rarity, grade and special rarity is, how it's got, and how it looks,
// on a real card playing its own animations. Three tabs (?tab=rarities|grades|special). Every number comes from the
// tuning the game itself reads (packs.json, grades.json, special-rarities.json), so the guide never drifts.
import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CardFace } from '../gacha/CardView';
import { COLLECTIBLE, RARITIES, RARITY_INFO, RARITY_LIGHT, type Card, type Rarity } from '../gacha/cards';
import { ODDS, PACK_SIZE } from '../gacha/packs';
import { DUPLICATE_VALUE } from '../gacha/economy';
import { ELEMENT_IDS, ELEMENTS, GRADE_COST, GRADES, HELL_GRADE, MAX_GRADE, type ElementId } from '../gacha/grades';
import { APEX_COPIES, APEX_REWARD, ECLIPSE_CHANCE, ECLIPSE_RARITIES, ECLIPSE_SHARDS, RANKS, RELIC_REWARD, BOND_PACK_COST, BOND_CHANCE, type RankId } from '../gacha/ranks';
import { useProgress } from '../store/progress';
import { sfx } from '../lib/sfx';

const TABS = [
  { id: 'rarities', name: 'Rarities', icon: '◆', blurb: 'Common to Omni' },
  { id: 'grades', name: 'Grades', icon: 'Ⅷ', blurb: 'Copies merged' },
  { id: 'special', name: 'Special', icon: '⚱', blurb: 'Apex, Relic, Eclipse, Bond' },
] as const;
type Tab = (typeof TABS)[number]['id'];

/** The cards shown as examples (well-loved faces), the first of the rarity if one is gone. */
const EXAMPLE: Record<Rarity, string> = {
  common: 'lol:ashe',
  rare: 'lol:ezreal',
  epic: 'naruto:kakashi-hatake',
  legendary: 'onepiece:roronoa-zoro',
  mythic: 'onepiece:mythic',
  omni: 'naruto:omni',
};
const byId = (id: string) => COLLECTIBLE.find((c) => c.id === id);
const example = (r: Rarity): Card => byId(EXAMPLE[r]) ?? COLLECTIBLE.find((c) => c.rarity === r)!;
const RANK_EXAMPLE: Record<RankId, () => Card> = {
  apex: () => byId('overwatch:omni') ?? example('omni'),
  relic: () => byId('naruto:naruto-uzumaki') ?? example('legendary'),
  eclipse: () => byId('lol:mythic') ?? example('mythic'),
  bond: () => byId('lol:jinx') ?? example('epic'),
};

const RARITY_TEXT: Record<Rarity, string> = {
  common: 'Most of every pack. Plain frame, the picture and its name.',
  rare: 'A blue edge. A few in every pack or two.',
  epic: 'A violet glow. Rarer, and the cards most boosted by beating a franchise’s boss.',
  legendary: 'A gold frame and a gold name: the favourites of each franchise.',
  mythic: 'A rainbow frame turning, a title, a voice line, often a clip. A few per franchise.',
  omni: 'The franchise’s one legend: rings of fire, a crown, and an awakened form once its guardian is beaten on Hard.',
};

const pct = (n: number) => (n >= 1 ? `${+n.toFixed(1)}%` : n >= 0.01 ? `${+n.toFixed(3)}%` : `${+n.toFixed(4)}%`);
/** How often a pack (PACK_SIZE cards) holds at least one: a share of packs, or about one pack in so many. */
const perPacks = (odds: number) => {
  const p = 1 - Math.pow(1 - odds / 100, PACK_SIZE);
  if (p >= 0.25) return `${Math.min(99, Math.round(p * 100))}% of packs`;
  return `about 1 pack in ${Math.round(1 / p).toLocaleString('en')}`;
};

export default function Rarities() {
  const [params, setParams] = useSearchParams();
  const tab: Tab = TABS.some((x) => x.id === params.get('tab')) ? (params.get('tab') as Tab) : 'rarities';
  const open = (id: Tab) => (sfx.click(), setParams(id === 'rarities' ? {} : { tab: id }, { replace: true }));
  return (
    <div className="space-y-6">
      <div>
        <Link to="/album" className="font-display text-sm font-semibold tracking-wider text-ink-soft hover:text-ink">
          ← Album
        </Link>
        <h1 className="text-5xl font-bold">Rarities</h1>
        <p className="text-ink-soft">What makes a card rare, how it grows, and the special looks only a few cards ever wear.</p>
      </div>
      <nav className="page grid grid-cols-3 gap-1 rounded-md p-1" aria-label="Guide">
        {TABS.map((x) => (
          <button
            key={x.id}
            type="button"
            onClick={() => open(x.id)}
            aria-current={tab === x.id ? 'page' : undefined}
            className={`flex min-w-0 flex-col items-center gap-0.5 rounded-md border px-1 py-2 text-center transition ${tab === x.id ? 'border-accent bg-card text-ink shadow' : 'border-transparent text-ink-soft hover:bg-card/60 hover:text-ink'}`}
          >
            <span className="text-2xl leading-none" aria-hidden>
              {x.icon}
            </span>
            <span className="font-display text-[11px] font-bold leading-tight sm:text-sm">{x.name}</span>
            <span className="hidden text-[11px] leading-tight text-ink-faint sm:block">{x.blurb}</span>
          </button>
        ))}
      </nav>
      {/* Remounted per tab: the entries rise in again. */}
      <div key={tab}>
        {tab === 'rarities' && <RarityList />}
        {tab === 'grades' && <GradeList />}
        {tab === 'special' && <SpecialList />}
      </div>
    </div>
  );
}

/** One entry: its card on one side (animated), its words on the other, rising in after the one before. */
function Entry({ i, color, card, children }: { i: number; color: string; card: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rarity-entry page flex flex-col items-center gap-5 overflow-hidden rounded-lg p-4 sm:flex-row sm:items-center sm:p-5" style={{ animationDelay: `${i * 90}ms`, ['--entry' as string]: color }}>
      <div className="rarity-entry-card w-[170px] shrink-0 sm:mx-10 sm:w-[190px]">{card}</div>
      <div className="min-w-0 flex-1 space-y-2 text-center sm:text-left">{children}</div>
    </section>
  );
}

function Title({ gem, name, color, tag }: { gem: string; name: string; color: string; tag?: string }) {
  return (
    <h2 className="flex flex-wrap items-baseline justify-center gap-x-3 gap-y-1 sm:justify-start">
      <span className="font-display text-3xl font-black" style={{ color, textShadow: `0 0 18px ${color}88` }}>
        {gem} {name}
      </span>
      {tag && <span className="rounded-full border border-rule-strong px-2 py-0.5 text-xs font-semibold text-ink-soft">{tag}</span>}
    </h2>
  );
}

function Facts({ items }: { items: [string, React.ReactNode][] }) {
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-left text-sm">
      {items.map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="font-semibold text-ink-soft">{k}</dt>
          <dd>{v}</dd>
        </div>
      ))}
    </dl>
  );
}

function RarityList() {
  return (
    <div className="space-y-4">
      <p className="text-sm text-ink-soft">
        A card’s rarity never changes. Each card of a pack is drawn at these odds; beating a franchise’s boss boosts that franchise’s pack, and the luck meter
        raises them a little more after a while without a top card.
      </p>
      {[...RARITIES].reverse().map((r, i) => (
        <Entry key={r} i={i} color={RARITY_LIGHT[r]} card={<CardFace card={example(r)} grade={1} rank={null} anomaly={null} tilt={false} animate={r === 'mythic' || r === 'omni'} />}>
          <Title gem={RARITY_INFO[r].gem} name={RARITY_INFO[r].name} color={RARITY_LIGHT[r]} tag={`${pct(ODDS[r])} a card`} />
          <p>{RARITY_TEXT[r]}</p>
          <Facts
            items={[
              ['In a pack', perPacks(ODDS[r])],
              ['A spare copy', `${DUPLICATE_VALUE[r].toLocaleString('en')} DleCoins traded in`],
            ]}
          />
        </Entry>
      ))}
    </div>
  );
}

/** A card climbing through every grade, one every few seconds (or held on one the player picks). */
function GradeClimb({ card }: { card: Card }) {
  const [grade, setGrade] = useState(1);
  const [held, setHeld] = useState(false);
  const [element, setElement] = useState<ElementId>('fire');
  useEffect(() => {
    if (held) return;
    const t = setInterval(() => setGrade((g) => (g % MAX_GRADE) + 1), 2600);
    return () => clearInterval(t);
  }, [held]);
  return (
    <div className="page flex flex-col items-center gap-5 rounded-lg p-4 sm:flex-row sm:p-5">
      <div className="w-[190px] shrink-0">
        <div key={`${grade}-${element}`} className="rarity-swap">
          <CardFace card={card} grade={grade} element={element} rank={null} anomaly={null} tilt={false} />
        </div>
      </div>
      <div className="min-w-0 flex-1 space-y-3 text-center sm:text-left">
        <Title gem={GRADES[grade].numeral} name={grade === MAX_GRADE ? ELEMENTS[element].name : GRADES[grade].name} color={GRADES[grade].metal[1]} tag={`Grade ${GRADES[grade].numeral}`} />
        <p className="text-sm">
          {GRADE_COST + 1} copies of the same card merge into one a grade higher (the card and {GRADE_COST} spares), and every grade reached pays DleCoins.
          From {GRADES[HELL_GRADE].name} ({GRADES[HELL_GRADE].numeral}) on, the card’s boss must be beaten on Hell. At {GRADES[MAX_GRADE].name} you pick an
          element. Omnis don’t take grades: theirs is Apex.
        </p>
        <div className="flex flex-wrap justify-center gap-1 sm:justify-start">
          {Array.from({ length: MAX_GRADE }, (_, k) => k + 1).map((g) => (
            <button
              key={g}
              type="button"
              onClick={() => (setGrade(g), setHeld(true))}
              aria-pressed={grade === g}
              title={GRADES[g].name}
              className={`min-w-9 rounded-md border px-2 py-1 font-display text-sm font-bold transition ${grade === g ? 'border-accent bg-card shadow' : 'border-rule-strong text-ink-soft hover:text-ink'}`}
              style={grade === g ? { color: GRADES[g].metal[1] } : undefined}
            >
              {GRADES[g].numeral}
            </button>
          ))}
          <button type="button" onClick={() => setHeld((h) => !h)} className="rounded-md border border-rule-strong px-2 py-1 text-sm text-ink-soft hover:text-ink">
            {held ? '▶ Play' : '❚❚ Hold'}
          </button>
        </div>
        {grade === MAX_GRADE && (
          <div className="flex flex-wrap justify-center gap-1 sm:justify-start">
            {ELEMENT_IDS.map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => (setElement(id), setHeld(true))}
                aria-pressed={element === id}
                className={`rounded-md border px-2 py-1 text-sm transition ${element === id ? 'border-accent bg-card shadow' : 'border-rule-strong text-ink-soft hover:text-ink'}`}
              >
                {ELEMENTS[id].icon} {ELEMENTS[id].name}
              </button>
            ))}
          </div>
        )}
        {grade === MAX_GRADE && <p className="text-sm text-ink-soft">{ELEMENTS[element].blurb}</p>}
      </div>
    </div>
  );
}

function GradeList() {
  return (
    <div className="space-y-4">
      <GradeClimb card={byId('lol:ahri') ?? example('legendary')} />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: MAX_GRADE }, (_, k) => k + 1).map((g, i) => (
          <div key={g} className="rarity-entry page rounded-md p-3 text-center" style={{ animationDelay: `${i * 60}ms` }}>
            <p className="font-display text-2xl font-black" style={{ color: GRADES[g].metal[1] }}>
              {GRADES[g].numeral}
            </p>
            <p className="font-display font-bold">{GRADES[g].name}</p>
            <p className="text-xs text-ink-soft">{g === 1 ? 'Every card starts here' : `${(GRADE_COST + 1) ** (g - 1)} copies in all${g >= HELL_GRADE ? ' · boss on Hell' : ''}`}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Its own numbers, written out. */
function rankFacts(id: RankId): [string, React.ReactNode][] {
  switch (id) {
    case 'apex':
      return [
        ['Cards', 'Omni only'],
        ['Takes', `${APEX_COPIES} copies of the same Omni`],
        ['Pays', `${APEX_REWARD.toLocaleString('en')} DleCoins`],
      ];
    case 'relic':
      return [
        ['Cards', 'Any card of the set, your pick'],
        ['Takes', 'The whole set, and its boss beaten on Hell'],
        ['Limit', 'One Relic per set'],
        ['Pays', `${RELIC_REWARD.toLocaleString('en')} DleCoins`],
        ['Under the mouse', 'Its arcana wakes: a magic circle draws itself over the picture'],
      ];
    case 'eclipse':
      return [
        ['Cards', ECLIPSE_RARITIES.map((r) => RARITY_INFO[r].name).join(' or ')],
        ['By luck', `${Math.round(ECLIPSE_CHANCE * 100)}% for one swallowed by a pack’s black hole`],
        ['By shards', `${ECLIPSE_SHARDS} star shards (one per other star swallowed)`],
        ['Under the mouse', 'You move the moon: the middle of the card is totality'],
      ];
    case 'bond':
      return [
        ['Cards', 'Only from a Bond pack'],
        ['Takes', `${BOND_PACK_COST} Bond points (a day you both play the daily is 1)`],
        ['Chance', `${Math.round(BOND_CHANCE * 100)}% a pack holds the Bond card`],
        ['Under the mouse', 'The two cards merge into one'],
      ];
  }
}

const RANK_ORDER: RankId[] = ['apex', 'eclipse', 'relic', 'bond'];

/** A card turning special: its plain self, a flash, then the special rarity, over and over (or held). */
function RankShow({ id, card }: { id: RankId; card: Card }) {
  const [on, setOn] = useState(true);
  const [held, setHeld] = useState(false);
  // Under the mouse it stays special, to try its hover effect.
  const [over, setOver] = useState(false);
  useEffect(() => {
    if (held || (over && on)) return;
    const t = setInterval(() => setOn((o) => !o), on ? 9000 : 1800);
    return () => clearInterval(t);
  }, [held, on, over]);
  const rank = RANKS[id];
  return (
    <div className="relative" style={{ ['--rk1' as string]: rank.colors[0], ['--rk3' as string]: rank.colors[2] }} onPointerEnter={() => setOver(true)} onPointerLeave={() => setOver(false)}>
      <div key={String(on)} className={on ? 'rarity-rise' : 'rarity-swap'}>
        <CardFace card={card} grade={1} rank={on ? id : null} anomaly={null} tilt={false} />
      </div>
      {on && <div key={`f${String(on)}`} className="rarity-flash pointer-events-none absolute -inset-[8%] rounded-[12%]" aria-hidden />}
      <button
        type="button"
        onClick={() => (setOn((o) => !o), setHeld(true))}
        className="mx-auto mt-3 block rounded-full border border-rule-strong px-3 py-1 text-xs font-semibold text-ink-soft hover:text-ink"
      >
        {on ? 'Show it plain' : `Show it ${rank.name}`}
      </button>
    </div>
  );
}

function SpecialList() {
  const shards = useProgress((s) => s.starShards ?? 0);
  return (
    <div className="space-y-4">
      <p className="text-sm text-ink-soft">
        Special rarities are never in a pack: they’re earned on a card you already have. The card keeps its picture and its own rarity underneath, and wears a new
        frame, effects and a ribbon on top. A card holds one at a time (an Apex can take over an Eclipse).
      </p>
      {RANK_ORDER.map((id, i) => {
        const r = RANKS[id];
        return (
          <Entry key={id} i={i} color={r.colors[0]} card={<RankShow id={id} card={RANK_EXAMPLE[id]()} />}>
            <Title gem={r.gem} name={r.name} color={r.colors[0]} />
            <p>{r.blurb}</p>
            <p className="text-sm text-ink-soft">{r.how}</p>
            <Facts items={rankFacts(id)} />
            {id === 'eclipse' && (
              <p className="text-sm">
                <span className="text-[#8b5cf6]">✧</span> You have <b>{shards}</b>/{ECLIPSE_SHARDS} star shards
                {shards >= ECLIPSE_SHARDS ? ': open a Mythic or Omni up close in the Album to eclipse it.' : '.'}
              </p>
            )}
            {id === 'bond' && (
              <Link to="/friends?tab=bond" className="inline-block text-sm font-semibold text-accent hover:underline">
                ∞ Your Bonds →
              </Link>
            )}
          </Entry>
        );
      })}
    </div>
  );
}
