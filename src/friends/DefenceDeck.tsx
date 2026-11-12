// Friends → Defence Deck: set a defence of five of your cards (within the points budget, in a secret order), attack
// your friends' defences with five of your own, and watch each battle play out duel by duel (src/friends/defence.ts,
// src/cloud/defences.ts). The day's arena rule is the same for everyone.
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import type { AttackDoc, DefenceDoc } from '../cloud/defences';
import { DleCoin } from '../components/DleCoin';
import { ANOMALIES } from '../gacha/anomalies';
import { CardAvatar } from '../gacha/Perks';
import { CARD_BY_ID, COLLECTIBLE, RARITIES, RARITY_INFO, type Card } from '../gacha/cards';
import { todayKey } from '../lib/date';
import { celebrate } from '../lib/fx';
import { shownName } from '../lib/french';
import { sfx } from '../lib/sfx';
import { useProgress } from '../store/progress';
import { arenaOf, basePower, costOf, DEFENCE, fight, LIGHT_BEATS, LIGHT_WEAK, teamOk, type Battle, type BattleEvent, type Element, type Side } from './defence';
import { cardElement, ELEMENT_INFO, fighterOf, fighters, teamCardOf, type TeamCard } from './defenceCards';
import { thisMonday } from './league';

const cloud = () => import('../cloud/defences');
const coin = <DleCoin className="inline size-3.5 align-[-2px]" />;

export interface DefencePerson {
  uid: string;
  face: ReactNode;
  name: string;
}

const El = ({ e, className = '' }: { e: Element; className?: string }) => (
  <span title={ELEMENT_INFO[e]?.name} className={className}>
    {ELEMENT_INFO[e]?.icon}
  </span>
);
const cardOf = (t: TeamCard) => CARD_BY_ID.get(t.id);
/** The cards that can fight: all but the Japanese words (the JLPT set is for learning, not battles). */
const FIGHTERS = COLLECTIBLE.filter((c) => c.set !== 'jlpt');
/** The same battle on every screen: the attacker, the defender and the day. */
const seedOf = (attacker: string, defender: string, day: string) => `${attacker}_${defender}_${day}`;

/** A card in a team or a list: its face, name, rarity, element; hidden (Void-Touched) or posing as a Mythic (Fake Rarity) to an attacker looking. */
function Tile({ t, power, hidden, posing, dim, ring, onClick, children }: { t: TeamCard; power?: number; hidden?: boolean; posing?: boolean; dim?: boolean; ring?: boolean; onClick?: () => void; children?: ReactNode }) {
  const c = cardOf(t);
  if (!c) return null;
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag
      {...(onClick ? { type: 'button' as const, onClick } : {})}
      className={`flex w-full items-center gap-2 rounded-md border p-1.5 text-left transition ${ring ? 'border-accent bg-accent/10' : 'border-rule'} ${dim ? 'opacity-35 grayscale' : ''} ${onClick ? 'hover:bg-tile' : ''}`}
    >
      {hidden ? <span className="grid size-10 shrink-0 place-items-center rounded-full bg-black font-display text-lg text-white/60">?</span> : <CardAvatar card={c} className="size-10 shrink-0" />}
      <span className="min-w-0 flex-1 leading-tight">
        <span className="block truncate text-sm font-semibold">{hidden ? 'Void-Touched card' : shownName(c.name, c.set)}</span>
        <span className="block truncate text-[11px] text-ink-faint">
          {hidden ? '???' : (
            <>
              {RARITY_INFO[posing ? 'mythic' : c.rarity].gem} {posing ? 'Mythic' : RARITY_INFO[c.rarity].name} · <El e={t.element} /> {ELEMENT_INFO[t.element]?.name}
              {c.technique ? ' · Technique' : c.place ? ' · Place' : ''}
              {t.grade > 1 ? ` · grade ${t.grade}` : ''}
              {t.anomaly && !posing ? ` · ${ANOMALIES[t.anomaly].icon}` : ''}
            </>
          )}
        </span>
      </span>
      {power !== undefined && !hidden && <span className="shrink-0 font-display text-sm font-bold tabular-nums">⚡{power}</span>}
      {children}
    </Tag>
  );
}

/** Five of the player's cards, within the budget, in order: a list to pick from (searched, filtered), the team beside it. */
function TeamBuilder({ team, onChange, demo = false }: { team: TeamCard[]; onChange: (t: TeamCard[]) => void; demo?: boolean }) {
  const cards = useProgress((s) => s.cards);
  const grades = useProgress((s) => s.grades);
  const elements = useProgress((s) => s.elements);
  const anomalies = useProgress((s) => s.anomalies);
  const save = useMemo(() => ({ grades, elements, anomalies }), [grades, elements, anomalies]);
  const [q, setQ] = useState('');
  const [rarity, setRarity] = useState<string>('');
  const [element, setElement] = useState<string>('');
  const arena = arenaOf(todayKey());
  // Dev demo: the whole catalogue, to try it without a collection.
  const owned = useMemo(() => FIGHTERS.filter((c) => demo || (cards[c.id] ?? 0) > 0), [cards, demo]);
  const cost = team.reduce((n, t) => n + (cardOf(t) ? DEFENCE.cost[cardOf(t)!.rarity] : 0), 0);
  const left = DEFENCE.budget - cost;
  const list = useMemo(() => {
    const words = q.trim().toLowerCase();
    return owned
      .map((c) => teamCardOf(c.id, save))
      .filter((t) => {
        const c = cardOf(t)!;
        return (!words || c.name.toLowerCase().includes(words) || c.franchise.toLowerCase().includes(words)) && (!rarity || c.rarity === rarity) && (!element || t.element === element);
      })
      .sort((a, b) => RARITIES.indexOf(cardOf(b)!.rarity) - RARITIES.indexOf(cardOf(a)!.rarity) || b.grade - a.grade);
  }, [owned, q, rarity, element, save]);
  const teamF = fighters(team);
  const power = (t: TeamCard) => {
    const f = fighterOf(t);
    return f ? basePower(f, teamF, arena) : 0;
  };
  const move = (i: number, d: number) => {
    const next = [...team];
    [next[i], next[i + d]] = [next[i + d], next[i]];
    onChange(next);
  };

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="space-y-2">
        <p className="flex justify-between text-xs font-bold uppercase tracking-widest text-ink-faint">
          <span>Your team, in order</span>
          <span className={left < 0 ? 'text-coral' : ''}>
            {cost} / {DEFENCE.budget} points
          </span>
        </p>
        {Array.from({ length: DEFENCE.size }, (_, i) => {
          const t = team[i];
          return t ? (
            <Tile key={t.id} t={t} power={power(t)}>
              <span className="flex shrink-0 flex-col">
                <button type="button" disabled={i === 0} onClick={() => move(i, -1)} className="px-1 text-xs disabled:opacity-20" aria-label="Earlier">
                  ▲
                </button>
                <button type="button" disabled={i === team.length - 1} onClick={() => move(i, 1)} className="px-1 text-xs disabled:opacity-20" aria-label="Later">
                  ▼
                </button>
              </span>
              <button type="button" onClick={() => onChange(team.filter((x) => x.id !== t.id))} className="shrink-0 px-1 text-ink-faint hover:text-coral" aria-label="Take out">
                ✕
              </button>
            </Tile>
          ) : (
            <div key={i} className="rounded-md border border-dashed border-rule p-3 text-center text-sm text-ink-faint">
              {i + 1}. Pick a card
            </div>
          );
        })}
        <p className="text-xs text-ink-faint">
          Costs: {RARITIES.map((r) => `${RARITY_INFO[r].name} ${DEFENCE.cost[r]}`).join(' · ')}. Every 2 points left unspent: +{DEFENCE.spare} power to each card.
        </p>
      </div>
      <div className="space-y-2">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search your cards…" className="w-full rounded-md border border-rule-strong bg-paper px-3 py-1.5" />
        <div className="flex flex-wrap gap-1">
          {['', ...RARITIES].map((r) => (
            <button key={r || 'all'} type="button" onClick={() => setRarity(r)} className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${rarity === r ? 'border-ink bg-ink text-paper' : 'border-rule'}`}>
              {r ? RARITY_INFO[r as Card['rarity']].gem : 'All'}
            </button>
          ))}
          <span className="mx-1 w-px bg-rule" />
          {['', 'fire', 'air', 'earth', 'water', 'light', 'darkness'].map((e) => (
            <button key={e || 'any'} type="button" onClick={() => setElement(e)} className={`rounded-full border px-2 py-0.5 text-xs ${element === e ? 'border-ink bg-ink text-paper' : 'border-rule'}`}>
              {e ? ELEMENT_INFO[e as Element].icon : 'Any'}
            </button>
          ))}
        </div>
        <div className="max-h-96 space-y-1 overflow-y-auto pr-1">
          {list.slice(0, 80).map((t) => {
            const inTeam = team.some((x) => x.id === t.id);
            const c = cardOf(t)!;
            // It must leave at least a point (a Common) for each slot still empty after it.
            const fits = !inTeam && team.length < DEFENCE.size && DEFENCE.cost[c.rarity] <= left - (DEFENCE.size - team.length - 1) * DEFENCE.cost.common;
            return <Tile key={t.id} t={t} power={power(t)} ring={inTeam} dim={!inTeam && !fits} onClick={fits ? () => (sfx.select(), onChange([...team, t])) : undefined} />;
          })}
          {list.length > 80 && <p className="text-center text-xs text-ink-faint">{list.length - 80} more: search or filter.</p>}
          {!owned.length && <p className="text-sm text-ink-soft">No cards yet: open packs in the Shop first.</p>}
        </div>
      </div>
    </div>
  );
}

/** Why a duel went as it did, in a few words. */
function verdict(e: Extract<BattleEvent, { t: 'duel' }>): string {
  if (e.reason === 'tie') return `Equal power (${e.pa}): both are out`;
  const w = e.winner === 'a' ? e.ea : e.ed;
  const l = e.winner === 'a' ? e.ed : e.ea;
  if (e.reason === 'element') return `${ELEMENT_INFO[w].icon} ${ELEMENT_INFO[w].name} beats ${ELEMENT_INFO[l].icon} ${ELEMENT_INFO[l].name}${e.inverted ? ' (inverted!)' : ''}`;
  return `⚡ ${Math.max(e.pa, e.pd)} beats ${Math.min(e.pa, e.pd)}`;
}

/** A battle played back duel by duel. */
function BattleView({ attack, defence, battle, names, mine, prize = 0 }: { attack: TeamCard[]; defence: TeamCard[]; battle: Battle; names: { a: string; d: string }; mine: Side; prize?: number }) {
  const duels = battle.events.map((e, k) => [e, k] as const).filter(([e]) => e.t === 'duel');
  const [step, setStep] = useState(0);
  const [auto, setAuto] = useState(true);
  useEffect(() => {
    if (!auto || step >= duels.length) return;
    const t = window.setTimeout(() => setStep((s) => s + 1), step === 0 ? 600 : 1600);
    return () => window.clearTimeout(t);
  }, [auto, step, duels.length]);
  useEffect(() => {
    if (step === duels.length && duels.length) {
      if (battle.winner === mine) (sfx.victory(), celebrate());
      else sfx.wrong();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  const upTo = step === 0 ? -1 : duels[step - 1][1];
  const out = { a: new Set<number>(), d: new Set<number>() };
  for (const e of battle.events.slice(0, upTo + 1)) if (e.t === 'out') out[e.side].add(e.i);
  const current = step > 0 ? (duels[step - 1][0] as Extract<BattleEvent, { t: 'duel' }>) : null;
  const notes = step > 0 ? battle.events.slice(step > 1 ? duels[step - 2][1] + 1 : 0, duels[step - 1][1] + 1).filter((e) => e.t !== 'duel' && e.t !== 'enter') : [];
  const note = (e: BattleEvent, k: number) => {
    const side = 'side' in e ? e.side : 'a';
    const c = cardOf((side === 'a' ? attack : defence)[(e as { i: number }).i]);
    const who = c ? shownName(c.name, c.set) : '';
    switch (e.t) {
      case 'technique':
        return <li key={k}>🥋 {who} strikes as it arrives: −{e.hit} power to the card it meets.</li>;
      case 'element':
        return (
          <li key={k}>
            {e.why === 'mirror' ? '⇋' : '▚'} {who} {e.why === 'mirror' ? 'mirrors' : 'glitches into'} <El e={e.element} /> {ELEMENT_INFO[e.element].name}.
          </li>
        );
      case 'timelost':
        return <li key={k}>⌛ {who} slips away in time, back at the end of its team.</li>;
      case 'place':
        return (
          <li key={k}>
            🏰 {who} falls, but lifts the cards after it: +{e.lift} power.
          </li>
        );
      case 'out':
        return null;
      default:
        return null;
    }
  };
  const row = (side: Side, team: TeamCard[]) => (
    <div className="flex justify-center gap-1.5">
      {team.map((t, i) => {
        const c = cardOf(t);
        const on = current && (side === 'a' ? current.a : current.d) === i;
        return c ? (
          <span key={i} className={`relative transition ${out[side].has(i) ? 'opacity-25 grayscale' : ''} ${on ? 'scale-110' : ''}`} title={c.name}>
            <CardAvatar card={c} className={`size-9 sm:size-11 ${on ? 'ring-2 ring-accent ring-offset-2 ring-offset-paper' : ''}`} />
            <El e={t.element} className="absolute -bottom-1 -right-1 text-xs" />
          </span>
        ) : null;
      })}
    </div>
  );
  const fighterCard = (side: Side) => {
    if (!current) return null;
    const i = side === 'a' ? current.a : current.d;
    const t = (side === 'a' ? attack : defence)[i];
    const c = cardOf(t);
    if (!c) return null;
    const won = current.winner === side;
    return (
      <div className={`flex flex-1 flex-col items-center gap-1 rounded-lg p-2 ${won ? 'bg-hit/15' : 'bg-coral/10'}`}>
        <CardAvatar card={c} className="size-16 sm:size-20" />
        <p className="text-center text-sm font-bold leading-tight">{shownName(c.name, c.set)}</p>
        <p className="text-xs">
          <El e={side === 'a' ? current.ea : current.ed} /> ⚡{side === 'a' ? current.pa : current.pd}
        </p>
        <p className={`text-xs font-bold ${won ? 'text-hit' : 'text-coral'}`}>{won ? 'Stays!' : 'Out'}</p>
      </div>
    );
  };
  const done = step >= duels.length;
  return (
    <div className="space-y-3 rounded-lg border border-rule p-3">
      <p className="text-center text-xs font-bold uppercase tracking-widest text-ink-faint">{names.a}</p>
      {row('a', attack)}
      <div className="min-h-[9rem]">
        {current ? (
          <div className="space-y-2">
            <div className="flex items-stretch gap-2">
              {fighterCard('a')}
              <span className="self-center font-display text-xl font-black text-ink-faint">VS</span>
              {fighterCard('d')}
            </div>
            <p className="text-center font-display font-bold">{verdict(current)}</p>
            {notes.length > 0 && <ul className="space-y-0.5 text-center text-xs text-ink-soft">{notes.map(note)}</ul>}
          </div>
        ) : (
          <p className="pt-12 text-center font-display text-lg font-bold text-ink-faint">Ready…</p>
        )}
      </div>
      {row('d', defence)}
      <p className="text-center text-xs font-bold uppercase tracking-widest text-ink-faint">{names.d}</p>
      {done && (
        <p className={`rounded-md p-2 text-center font-display text-lg font-bold ${battle.winner === mine ? 'bg-hit/15 text-hit' : 'bg-coral/10 text-coral'}`}>
          {battle.winner === 'a' ? `${names.a} won` : `${names.d} held`}
          {battle.how === 'cheaper' ? ' (both ran out: the cheaper team wins)' : battle.how === 'defence' ? ' (both ran out, same cost: the defence holds)' : ''}
          {prize > 0 && (
            <>
              {' '}
              · +{prize.toLocaleString('en')} {coin}
            </>
          )}
        </p>
      )}
      <div className="flex justify-center gap-2 text-sm">
        <button type="button" onClick={() => (setAuto(false), setStep((s) => Math.max(0, s - 1)))} className="btn-paper rounded-md px-3 py-1">
          ◀
        </button>
        <span className="self-center tabular-nums text-ink-faint">
          Duel {Math.min(step, duels.length)} / {duels.length}
        </span>
        <button type="button" onClick={() => (setAuto(false), setStep((s) => Math.min(duels.length, s + 1)))} className="btn-paper rounded-md px-3 py-1">
          ▶
        </button>
        {!done && (
          <button type="button" onClick={() => (setAuto(false), setStep(duels.length))} className="btn-paper rounded-md px-3 py-1">
            Skip
          </button>
        )}
      </div>
    </div>
  );
}

/** Dev only (#/friends?demo): a random team within the budget from the whole catalogue. */
function demoTeam(seed: number): TeamCard[] {
  let s = seed;
  const r = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  for (let tries = 0; ; tries++) {
    const picked = Array.from({ length: DEFENCE.size }, () => FIGHTERS[Math.floor(r() * FIGHTERS.length)]);
    const team = picked.map((c) => ({ id: c.id, grade: 1 + Math.floor(r() * 4), element: cardElement(c.id), anomaly: null }));
    if (tries > 200 || (teamOk(picked) && costOf(picked) >= DEFENCE.budget - 4)) return team;
  }
}

const rulesText = (
  <details className="rounded-md border border-rule p-3 text-sm">
    <summary className="cursor-pointer font-display font-bold">How a battle works</summary>
    <ul className="mt-2 list-disc space-y-1 pl-5 text-ink-soft">
      <li>
        Each team: {DEFENCE.size} cards in order, at most {DEFENCE.budget} points. The first cards duel; the loser is out, the winner stays (−{DEFENCE.fatigue} power for each duel it has won) and meets the next card. A team with no card left loses; if both run out at once, the cheaper team wins (the defence on a tie).
      </li>
      <li>
        A duel: the <b>element</b> first, a weakness beats any power. 🔥 Fire beats 🌪️ Air, Air beats ⛰️ Earth, Earth beats 🌊 Water, Water beats Fire. ☀️ Light beats {LIGHT_BEATS.map((e) => ELEMENT_INFO[e].name).join(' and ')} and 🌑 Darkness, and falls to {LIGHT_WEAK.map((e) => ELEMENT_INFO[e].name).join(' and ')}. Darkness falls only to Light. Otherwise the higher <b>power</b> wins; equal power, both are out.
      </li>
      <li>
        Power: {RARITIES.map((r) => `${RARITY_INFO[r].name} ${DEFENCE.power[r]}`).join(', ')}; +{DEFENCE.perGrade} for every two grades; +{DEFENCE.crew} each with {DEFENCE.crewSize} cards of one franchise; +{DEFENCE.spare} each for every 2 points left unspent; the defence +{DEFENCE.home} at home.
      </li>
      <li>
        A <b>technique</b> (−{DEFENCE.kindMalus} power) hits the card it meets as it arrives: −{DEFENCE.techniqueHit}. A <b>place</b> (−{DEFENCE.kindMalus}) once out lifts every card after it: +{DEFENCE.placeLift}.
      </li>
      <li>
        Altered cards: {ANOMALIES.inverted.icon} Inverted turns the element&apos;s verdict over; {ANOMALIES.mirror.icon} Mirror takes the element of the card it meets; {ANOMALIES.corrupted.icon} Corrupted takes a random one each duel; {ANOMALIES.timelost.icon} Time-Lost slips away once instead of falling (back at the end, −{DEFENCE.timelost});{' '}
        {ANOMALIES.void.icon} Void-Touched is hidden from attackers; {ANOMALIES.fake.icon} Fake Rarity looks like a Mythic to them.
      </li>
      <li>Legendaries, Mythics and Omnis have their own element; other cards one of the four basic ones. A card at the element grade fights with the element you chose for it.</li>
    </ul>
  </details>
);

type View = 'defence' | 'attack' | 'reports';

export function DefenceDeck({ people, me, demo }: { people: DefencePerson[]; me: string; demo: boolean }) {
  const today = todayKey();
  const monday = thisMonday(today);
  const arena = arenaOf(today);
  const pay = useProgress((s) => s.payFriendGame);
  const [view, setView] = useState<View>('attack');
  const [mine, setMine] = useState<DefenceDoc | null>(null);
  const [draft, setDraft] = useState<TeamCard[]>([]);
  const [theirs, setTheirs] = useState<DefenceDoc[] | null>(null);
  const [done, setDone] = useState<Map<string, AttackDoc>>(new Map());
  const [onMe, setOnMe] = useState<AttackDoc[] | null>(null);
  const [target, setTarget] = useState<DefenceDoc | null>(null);
  const [team, setTeam] = useState<TeamCard[]>([]);
  const [battle, setBattle] = useState<{ attack: TeamCard[]; defence: TeamCard[]; result: Battle; names: { a: string; d: string }; mine: Side; prize?: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ text: ReactNode; good?: boolean } | null>(null);
  const byUid = useMemo(() => new Map(people.map((p) => [p.uid, p])), [people]);
  const friendIds = people.filter((p) => p.uid !== me).map((p) => p.uid);
  const key = friendIds.join(',');

  useEffect(() => {
    let live = true;
    void (async () => {
      try {
        if (demo) {
          setTheirs(friendIds.map((uid, k) => ({ uid, name: byUid.get(uid)?.name ?? 'Friend', day: today, team: demoTeam(k + 7), at: null })));
          setOnMe(
            friendIds.slice(0, 3).map((uid, k) => {
              const a = demoTeam(k + 50);
              const d = demoTeam(3);
              const won = fight(fighters(a), fighters(d), arena, seedOf(uid, me, today)).winner === 'a';
              return { uid, name: byUid.get(uid)?.name ?? 'Friend', day: today, won, team: a, def: d, at: null };
            }),
          );
          return;
        }
        const c = await cloud();
        const [m, t, d, o] = await Promise.all([c.defenceOf(me), c.defencesOf(friendIds), c.myAttacks(friendIds, today), c.attacksOnMe(monday).catch(() => [] as AttackDoc[])]);
        if (!live) return;
        setMine(m);
        if (m) setDraft(m.team);
        else setView('defence');
        setTheirs(t);
        setDone(d);
        setOnMe(o);
        // Attacks held off this week: paid once each.
        let got = 0;
        for (const a of o) if (!a.won) got += pay(`defheld:${a.uid}_${a.day}`, DEFENCE.held);
        if (got) setNote({ text: <>🛡️ Your defence held off attacks: +{got.toLocaleString('en')} {coin}</>, good: true });
      } catch (e) {
        if (live) setNote({ text: (e as { code?: string })?.code === 'permission-denied' ? "The Defence Deck isn't switched on in the database yet: its rules need the defences section (firestore.rules) published." : e instanceof Error ? e.message : String(e) });
      }
    })();
    return () => void (live = false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, me, demo, today]);

  const saveDefence = async () => {
    if (!teamOk(draft.map((t) => cardOf(t)!).filter(Boolean)) || busy) return;
    setBusy(true);
    setNote(null);
    try {
      const d = demo ? { uid: me, name: 'You', day: today, team: draft, at: null } : await (await cloud()).setDefence(today, draft);
      setMine(d);
      sfx.correct();
      setNote({ text: '🛡️ Your defence is set. Your friends see its cards, not their order.', good: true });
    } catch (e) {
      sfx.wrong();
      setNote({ text: (e as { code?: string })?.code === 'permission-denied' ? 'The database refused it: the Defence Deck rules need publishing, or you already changed your defence today.' : 'No connection: try again once you are online.' });
    } finally {
      setBusy(false);
    }
  };

  const attack = async () => {
    if (!target || busy) return;
    const atk = fighters(team);
    const def = fighters(target.team);
    if (!teamOk(atk) || def.length !== DEFENCE.size) return;
    setBusy(true);
    setNote(null);
    try {
      const result = fight(atk, def, arena, seedOf(me, target.uid, today));
      const won = result.winner === 'a';
      const a = demo ? { uid: me, name: 'You', day: today, won, team, def: target.team, at: null } : await (await cloud()).recordAttack(target.uid, today, won, team, target.team);
      setDone((m) => new Map(m).set(target.uid, a));
      const got = won ? (demo ? DEFENCE.win : pay(`defwin:${target.uid}_${today}`, DEFENCE.win)) : 0;
      // The result shows at the end of the replay, not before it.
      setBattle({ attack: team, defence: target.team, result, names: { a: 'You', d: byUid.get(target.uid)?.name ?? target.name }, mine: 'a', prize: got });
      setTarget(null);
    } catch (e) {
      sfx.wrong();
      setNote({ text: (e as { code?: string })?.code === 'permission-denied' ? 'The database refused it: the Defence Deck rules need publishing, or you already attacked this friend today.' : 'No connection: try again once you are online.' });
    } finally {
      setBusy(false);
    }
  };

  const used = done.size;
  const changedToday = !!mine && mine.day === today && !demo;
  const draftOk = draft.length === DEFENCE.size && costOf(draft.map((t) => cardOf(t)!)) <= DEFENCE.budget;
  const teamReady = team.length === DEFENCE.size && costOf(team.map((t) => cardOf(t)!)) <= DEFENCE.budget;

  // The week's report: attacks on my defence, and which of its cards won the most duels.
  const report = useMemo(() => {
    if (!onMe?.length) return null;
    const wins = new Map<string, number>();
    for (const a of onMe) {
      const r = fight(fighters(a.team), fighters(a.def), arenaOf(a.day), seedOf(a.uid, me, a.day));
      for (const e of r.events) if (e.t === 'duel' && e.winner === 'd') wins.set(a.def[e.d].id, (wins.get(a.def[e.d].id) ?? 0) + 1);
    }
    const best = [...wins].sort((x, y) => y[1] - x[1])[0];
    return { held: onMe.filter((a) => !a.won).length, total: onMe.length, best: best ? { card: CARD_BY_ID.get(best[0]), n: best[1] } : null };
  }, [onMe, me]);

  return (
    <section className="page space-y-4 rounded-md p-5">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="font-display text-lg font-bold">🛡️ Defence Deck</h2>
          <p className="text-sm text-ink-soft">
            Set a defence of {DEFENCE.size} cards within {DEFENCE.budget} points, in a secret order. Attack your friends&apos; defences with {DEFENCE.size} of yours ({DEFENCE.attacksPerDay} attacks a day, each friend once): you see their cards, not their order. A win pays {DEFENCE.win} {coin}; each attack your defence holds off,{' '}
            {DEFENCE.held}.
          </p>
        </div>
        <div className="flex gap-1 rounded-lg border border-rule bg-tile p-1">
          {(['attack', 'defence', 'reports'] as View[]).map((v) => (
            <button key={v} type="button" onClick={() => (sfx.select(), setView(v), setBattle(null))} aria-pressed={view === v} className={`rounded-md px-3 py-1 font-display text-sm font-bold ${view === v ? 'bg-paper shadow' : 'text-ink-soft'}`}>
              {v === 'attack' ? '⚔️ Attack' : v === 'defence' ? '🛡️ My defence' : `📜 Reports${onMe?.length ? ` (${onMe.length})` : ''}`}
            </button>
          ))}
        </div>
      </div>

      <p className="rounded-md border border-accent/40 bg-accent/10 p-2 text-sm">
        <b>
          {arena.icon} Today&apos;s arena: {arena.name}.
        </b>{' '}
        {arena.text}
      </p>
      {note && <p className={`rounded-md border p-3 text-sm font-semibold ${note.good ? 'border-hit/50 bg-hit/10' : 'border-coral/50 bg-coral/10 text-coral'}`}>{note.text}</p>}

      {battle ? (
        <div className="space-y-2">
          <BattleView attack={battle.attack} defence={battle.defence} battle={battle.result} names={battle.names} mine={battle.mine} prize={battle.prize} />
          <button type="button" onClick={() => setBattle(null)} className="btn-paper w-full rounded-md py-2 font-semibold">
            Back
          </button>
        </div>
      ) : view === 'defence' ? (
        <div className="space-y-3">
          <TeamBuilder team={draft} onChange={setDraft} demo={demo} />
          <button type="button" disabled={busy || !draftOk || changedToday} onClick={() => void saveDefence()} className="btn-accent w-full rounded-md py-2.5 font-display font-bold disabled:opacity-40">
            {changedToday ? '🛡️ Set today: you can change it again tomorrow' : mine ? 'Change my defence' : 'Set my defence'}
          </button>
        </div>
      ) : view === 'reports' ? (
        <div className="space-y-3">
          {report && (
            <p className="rounded-md bg-tile p-3 text-sm">
              This week your defence held off <b>{report.held}</b> of <b>{report.total}</b> attacks.
              {report.best?.card && (
                <>
                  {' '}
                  Its star: <b>{shownName(report.best.card.name, report.best.card.set)}</b>, who won {report.best.n} duel{report.best.n === 1 ? '' : 's'}.
                </>
              )}
            </p>
          )}
          {onMe === null ? (
            <p className="text-sm text-ink-soft">Loading…</p>
          ) : onMe.length === 0 ? (
            <p className="text-sm text-ink-soft">{mine || demo ? 'Nobody has attacked your defence this week yet.' : 'Set a defence first: your friends can attack it once it is up.'}</p>
          ) : (
            onMe.map((a) => (
              <div key={`${a.uid}-${a.day}`} className="flex items-center gap-3 rounded-md border border-rule p-2 text-sm">
                {byUid.get(a.uid)?.face}
                <span className="min-w-0 flex-1">
                  <b>{byUid.get(a.uid)?.name ?? a.name}</b> attacked · {a.day === today ? 'today' : a.day}
                </span>
                <span className={`font-bold ${a.won ? 'text-coral' : 'text-hit'}`}>{a.won ? 'Broke through' : 'Held ✓'}</span>
                <button
                  type="button"
                  onClick={() => setBattle({ attack: a.team, defence: a.def, result: fight(fighters(a.team), fighters(a.def), arenaOf(a.day), seedOf(a.uid, me, a.day)), names: { a: byUid.get(a.uid)?.name ?? a.name, d: 'Your defence' }, mine: 'd' })}
                  className="btn-paper rounded-md px-2 py-1 text-xs font-semibold"
                >
                  ▶ Watch
                </button>
              </div>
            ))
          )}
        </div>
      ) : target ? (
        <div className="space-y-3">
          <p className="text-xs font-bold uppercase tracking-widest text-ink-faint">{byUid.get(target.uid)?.name ?? target.name}&apos;s defence · order hidden</p>
          <div className="grid gap-1.5 sm:grid-cols-5">
            {[...target.team]
              .sort((x, y) => RARITIES.indexOf(cardOf(y)?.rarity ?? 'common') - RARITIES.indexOf(cardOf(x)?.rarity ?? 'common'))
              .map((t) => (
                <Tile key={t.id} t={t} hidden={t.anomaly === 'void'} posing={t.anomaly === 'fake'} />
              ))}
          </div>
          <TeamBuilder team={team} onChange={setTeam} demo={demo} />
          <div className="flex gap-2">
            <button type="button" onClick={() => setTarget(null)} className="btn-paper flex-1 rounded-md py-2.5 font-semibold">
              Back
            </button>
            <button type="button" disabled={busy || !teamReady} onClick={() => void attack()} className="btn-accent flex-[2] rounded-md py-2.5 font-display font-bold disabled:opacity-40">
              ⚔️ Fight!
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-xs font-bold uppercase tracking-widest text-ink-faint">
            Your friends&apos; defences · {Math.max(0, DEFENCE.attacksPerDay - used)} attack{DEFENCE.attacksPerDay - used === 1 ? '' : 's'} left today
          </p>
          {theirs === null ? (
            <p className="text-sm text-ink-soft">Loading…</p>
          ) : theirs.length === 0 ? (
            <p className="text-sm text-ink-soft">{friendIds.length ? "None of your friends has set a defence yet. Set yours, and tell them!" : 'Add friends to attack their defences.'}</p>
          ) : (
            theirs.map((d) => {
              const a = done.get(d.uid);
              return (
                <div key={d.uid} className="flex flex-wrap items-center gap-3 rounded-md border border-rule p-2">
                  {byUid.get(d.uid)?.face}
                  <b className="min-w-0 flex-1 truncate">{byUid.get(d.uid)?.name ?? d.name}</b>
                  {/* Its elements sorted, not in their order (the order is the secret). */}
                  <span className="flex gap-0.5">
                    {[...d.team]
                      .sort((x, y) => (x.anomaly === 'void' ? 1 : 0) - (y.anomaly === 'void' ? 1 : 0) || x.element.localeCompare(y.element))
                      .map((t, i) => (t.anomaly === 'void' ? <span key={i}>❔</span> : <El key={i} e={t.element} />))}
                  </span>
                  {a ? (
                    <button
                      type="button"
                      onClick={() => setBattle({ attack: a.team, defence: a.def, result: fight(fighters(a.team), fighters(a.def), arena, seedOf(me, d.uid, today)), names: { a: 'You', d: byUid.get(d.uid)?.name ?? d.name }, mine: 'a' })}
                      className={`rounded-md px-3 py-1 text-sm font-bold ${a.won ? 'text-hit' : 'text-coral'}`}
                    >
                      {a.won ? '✓ Won' : '✗ Held'} · ▶
                    </button>
                  ) : (
                    <button type="button" disabled={used >= DEFENCE.attacksPerDay} onClick={() => (sfx.select(), setTarget(d), setTeam(mine?.team ?? []))} className="btn-accent rounded-md px-3 py-1 text-sm font-bold disabled:opacity-40">
                      Attack
                    </button>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}
      {rulesText}
    </section>
  );
}

