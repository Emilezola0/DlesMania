// Friends → Clue Grid (src/friends/clueBoard.ts): today's grid with your secret characters in your colour, your clue
// (one word, and how many of your characters it points to), your friends' clues to answer, and yesterday's grid
// revealed: whose characters were whose, and who picked what (hover or tap a character to see every name).
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import type { ClueDoc, SecretDoc } from '../cloud/clueGrid';
import { DleCoin } from '../components/DleCoin';
import { CardAvatar } from '../gacha/Perks';
import type { Card } from '../gacha/cards';
import { addDays, todayKey } from '../lib/date';
import { celebrate } from '../lib/fx';
import { shownName } from '../lib/french';
import { hashString, mulberry32, shuffle } from '../lib/rng';
import { sfx } from '../lib/sfx';
import { useProgress } from '../store/progress';
import { CLUE, CLUE_MAX, cells, clueProblem, gridOf, randomTargets, rightOf } from './clueBoard';

const cloud = () => import('../cloud/clueGrid');

export interface CluePerson {
  uid: string;
  /** Their icon and name, drawn by the Friends page. */
  face: ReactNode;
  name: string;
  /** Their colour on the Friends page: their characters on the grid. */
  color: string;
}

const fmt = (n: number) => n.toLocaleString('en');
const Coin = () => <DleCoin className="inline size-3.5 align-[-2px]" />;

/** One character on a grid, with what's drawn over it. */
/** Where a cell's tooltip sits, so it stays on screen: against the left edge in the first column, the right in the last (4 columns on a phone, 5 above). */
function tipPlace(i: number): string {
  const phone = i % 4 === 0 ? 'left-0 translate-x-0' : i % 4 === 3 ? 'right-0 translate-x-0' : 'left-1/2 -translate-x-1/2';
  const wide = i % 5 === 0 ? 'sm:left-0 sm:right-auto sm:translate-x-0' : i % 5 === 4 ? 'sm:left-auto sm:right-0 sm:translate-x-0' : 'sm:left-1/2 sm:right-auto sm:-translate-x-1/2';
  return `${phone} ${wide}`;
}

function Cell({ card, onClick, disabled, ring, chosen, children, tip, at = 1 }: { card: Card; onClick?: () => void; disabled?: boolean; ring?: string[]; chosen?: number; children?: ReactNode; tip?: ReactNode; at?: number }) {
  const [open, setOpen] = useState(false);
  const rings = ring ?? [];
  const border = rings.length === 1 ? rings[0] : undefined;
  return (
    <div className="group relative" onMouseLeave={() => setOpen(false)}>
      <button
        type="button"
        onClick={() => {
          if (onClick) onClick();
          else if (tip) setOpen((o) => !o);
        }}
        disabled={disabled}
        className={`flex w-full flex-col items-center gap-1 rounded-lg border-2 p-1.5 text-center transition ${
          chosen ? 'border-accent bg-accent/10 -translate-y-0.5' : 'border-rule'
        } ${onClick && !disabled ? 'hover:-translate-y-0.5 hover:bg-tile' : ''} ${disabled && !chosen ? 'opacity-60' : ''}`}
        style={border && !chosen ? { borderColor: border, boxShadow: `0 0 0 1px ${border}, 0 0 14px ${border}55` } : rings.length > 1 && !chosen ? { borderImage: `linear-gradient(90deg, ${rings.join(', ')}) 1` } : undefined}
        aria-pressed={chosen ? true : undefined}
      >
        <CardAvatar card={card} className="size-12 sm:size-16" />
        <span className="line-clamp-2 min-h-[2lh] text-[11px] font-semibold leading-tight sm:text-xs">{shownName(card.name, card.set)}</span>
        {chosen ? <span className="absolute right-1 top-1 grid size-5 place-items-center rounded-full bg-accent text-[11px] font-bold text-white">{chosen}</span> : null}
        {children}
      </button>
      {tip && (
        <div
          role="tooltip"
          className={`pointer-events-none absolute top-full z-20 mt-1 w-56 max-w-[80vw] ${tipPlace(at)} rounded-md border border-rule-strong bg-card p-2 text-left text-xs shadow-lg ${open ? 'block' : 'hidden group-hover:block'}`}
        >
          {tip}
        </div>
      )}
    </div>
  );
}

/** Dots in the owners' colours, top-left of a revealed character. */
function OwnerDots({ colors }: { colors: string[] }) {
  if (!colors.length) return null;
  return (
    <span className="absolute left-1 top-1 flex gap-0.5">
      {colors.map((c, i) => (
        <span key={i} className="size-2.5 rounded-full ring-1 ring-card" style={{ background: c }} />
      ))}
    </span>
  );
}

interface Day {
  clues: ClueDoc[];
  secrets: SecretDoc[];
}

/** Dev only (#/friends?demo): made-up clues, characters and picks. */
function demoDay(people: CluePerson[], day: string, me: string | null, answered: boolean): Day {
  const rand = mulberry32(hashString(`clue-demo:${day}`));
  const words = ['Sword', 'Fire', 'Royalty', 'Speed', 'Ocean', 'Mask', 'Dragon', 'Gold'];
  const secrets: SecretDoc[] = people.map((p) => ({ uid: p.uid, day, targets: shuffle([...Array(CLUE.size).keys()], rand).slice(0, CLUE.targets), picks: {} }));
  const clues: ClueDoc[] = people.map((p, k) => ({ uid: p.uid, name: p.name, day, clue: words[(k + day.length) % words.length], count: 1 + (k % CLUE.targets), at: k }));
  if (answered)
    for (const s of secrets)
      for (const c of clues) {
        if (c.uid === s.uid || (s.uid === me && !answered)) continue;
        const theirs = secrets.find((x) => x.uid === c.uid)!.targets;
        // Mostly right, a few misses.
        s.picks[c.uid] = shuffle([...Array(CLUE.size).keys()], rand)
          .sort((a, b) => Number(theirs.includes(b)) - Number(theirs.includes(a)) + (rand() < 0.3 ? 1 : 0))
          .slice(0, c.count);
      }
  return { clues: clues.filter((c) => !(answered === false && c.uid === me)), secrets };
}

export function ClueGrid({ people, me, demo }: { people: CluePerson[]; me: string | null; demo: boolean }) {
  const today = todayKey();
  const yesterday = addDays(today, -1);
  const grid = useMemo(() => gridOf(today), [today]);
  const past = useMemo(() => gridOf(yesterday), [yesterday]);
  const byUid = useMemo(() => new Map(people.map((p) => [p.uid, p])), [people]);
  const uids = people.map((p) => p.uid).join(',');
  const myColor = byUid.get(me ?? '')?.color ?? 'var(--color-accent)';

  const [secret, setSecret] = useState<SecretDoc | null>(null);
  const [myClue, setMyClue] = useState<ClueDoc | null>(null);
  const [clues, setClues] = useState<ClueDoc[] | null>(null);
  const [results, setResults] = useState<Day | null>(null);
  const [answering, setAnswering] = useState<string | null>(null);
  const [sel, setSel] = useState<number[]>([]);
  const [word, setWord] = useState('');
  const [count, setCount] = useState(1);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ text: string; good?: boolean } | null>(null);
  const pay = useProgress((s) => s.payFriendGame);

  useEffect(() => {
    let live = true;
    if (demo) {
      const t = demoDay(people, today, me, false);
      setSecret({ uid: me ?? 'demo', day: today, targets: t.secrets.find((s) => s.uid === me)?.targets ?? randomTargets(), picks: {} });
      setClues(t.clues.filter((c) => c.uid !== me));
      setResults(demoDay(people, yesterday, me, true));
      return;
    }
    void cloud().then(async (c) => {
      const all = uids ? uids.split(',') : [];
      const [s, todays, yClues, ySecrets] = await Promise.all([
        c.mySecret(today, randomTargets).catch(() => null),
        c.cluesOf(all, today),
        c.cluesOf(all, yesterday),
        c.secretsOf(all, yesterday),
      ]);
      if (!live) return;
      setSecret(s);
      setMyClue(todays.find((x) => x.uid === me) ?? null);
      setClues(todays.filter((x) => x.uid !== me));
      setResults({ clues: yClues, secrets: ySecrets });
      if (!s) setNote({ text: "Clue Grid isn't switched on in the database yet (its rules need publishing), or your device's date is off." });
      // Yesterday's rewards, each paid once: your right picks, and your friends' right picks on your clue. The key ends
      // with the day (the store forgets keys by their last 10 characters); one recorded the old way (the friend last,
      // so it could be forgotten at once and paid again) still counts as paid.
      const paidBefore = useProgress.getState().doodle ?? {};
      const once = (kind: string, uid: string, coins: number) => (paidBefore[`${kind}:${yesterday}:${uid}`] !== undefined ? 0 : pay(`${kind}:${uid}_${yesterday}`, coins));
      let paid = 0;
      const mine = ySecrets.find((x) => x.uid === me);
      for (const cl of yClues) {
        if (cl.uid === me || !mine) continue;
        const theirs = ySecrets.find((x) => x.uid === cl.uid);
        if (!theirs) continue;
        const right = rightOf(cells(mine.picks?.[cl.uid], cl.count), cells(theirs.targets, CLUE.targets));
        if (right) paid += once('clue-right', cl.uid, right * CLUE.right);
      }
      const myYClue = yClues.find((x) => x.uid === me);
      if (mine && myYClue)
        for (const f of ySecrets) {
          if (f.uid === me) continue;
          const found = rightOf(cells(f.picks?.[me ?? ''], myYClue.count), cells(mine.targets, CLUE.targets));
          if (found) paid += once('clue-found', f.uid, found * CLUE.found);
        }
      if (paid) {
        sfx.correct();
        setNote({ text: `🔎 Yesterday's grid: +${fmt(paid)} DleCoins for the right picks!`, good: true });
      }
    });
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [today, yesterday, uids, demo]);

  const targets = cells(secret?.targets, CLUE.targets);
  const problem = word ? clueProblem(word, grid) : null;
  const current = clues?.find((c) => c.uid === answering) ?? null;

  const post = async () => {
    const why = clueProblem(word, grid);
    if (why) return setNote({ text: why });
    if (busy || myClue) return;
    sfx.select();
    const clue = word.trim();
    if (demo) {
      setMyClue({ uid: me ?? 'demo', name: 'You', day: today, clue, count, at: Date.now() });
      return setNote({ text: `+${fmt(CLUE.clue)} DleCoins (demo: not really paid).`, good: true });
    }
    setBusy(true);
    setNote(null);
    try {
      const { result, doc } = await (await cloud()).postClue(today, clue, count);
      if (doc) setMyClue(doc);
      if (result === 'refused') return setNote({ text: "The database won't take it: your device's date may be off, or Clue Grid's rules aren't published yet." });
      if (result === 'done') return setNote({ text: 'You already posted a clue today (on another device).' });
      useProgress.setState((s) => ({ coins: (s.coins ?? 0) + CLUE.clue }));
      sfx.correct();
      setNote({ text: `+${fmt(CLUE.clue)} DleCoins! Tomorrow, see how many of your characters your friends found: +${fmt(CLUE.found)} for each.`, good: true });
    } catch {
      setNote({ text: 'No connection: try again once you are online.' });
    } finally {
      setBusy(false);
    }
  };

  const tap = (i: number) => {
    if (!current) return;
    sfx.select();
    setSel((s) => (s.includes(i) ? s.filter((x) => x !== i) : s.length < current.count ? [...s, i] : [...s.slice(1), i]));
  };

  const answer = async () => {
    if (!current || sel.length !== current.count || busy) return;
    if (demo) {
      setSecret((s) => (s ? { ...s, picks: { ...s.picks, [current.uid]: sel } } : s));
      setAnswering(null);
      setSel([]);
      return setNote({ text: `+${fmt(CLUE.answer)} DleCoins (demo: not really paid).`, good: true });
    }
    setBusy(true);
    setNote(null);
    try {
      const { result, doc } = await (await cloud()).answerClue(today, current.uid, sel);
      if (doc) setSecret(doc);
      if (result === 'refused') return setNote({ text: "The database won't take it: your device's date may be off." });
      if (result === 'done') return setNote({ text: 'You already answered that clue (on another device).' });
      useProgress.setState((s) => ({ coins: (s.coins ?? 0) + CLUE.answer }));
      sfx.correct();
      celebrate();
      setNote({ text: `+${fmt(CLUE.answer)} DleCoins! Tomorrow: +${fmt(CLUE.right)} more for each right pick.`, good: true });
      setAnswering(null);
      setSel([]);
    } catch {
      setNote({ text: 'No connection: try again once you are online.' });
    } finally {
      setBusy(false);
    }
  };

  const shownPicks = current ? sel : [];
  const hasFriends = people.length > 1;
  return (
    <section className="page space-y-4 rounded-md p-5">
      <div>
        <h2 className="font-display text-lg font-bold">🔎 Clue Grid</h2>
        <p className="text-sm text-ink-soft">
          The same {CLUE.size} characters for everyone. {CLUE.targets} of them are secretly <span style={{ color: myColor }} className="font-bold">yours</span>: write one word that leads your friends to them. Answering a friend&apos;s clue pays {fmt(CLUE.answer)} <Coin />, each right pick {fmt(CLUE.right)} more; each of your characters a friend finds pays you {fmt(CLUE.found)}. Everything shows tomorrow.
        </p>
      </div>
      {note && <p className={`rounded-md border p-3 text-sm font-semibold ${note.good ? 'border-hit/50 bg-hit/10' : 'border-coral/50 bg-coral/10 text-coral'}`}>{note.text}</p>}

      <div className="space-y-3">
        <p className="text-xs font-bold uppercase tracking-widest text-ink-faint">
          Today{current ? ` · pick ${current.count} for ${byUid.get(current.uid)?.name ?? 'a friend'}’s “${current.clue}”` : ''}
        </p>
        <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-5 sm:gap-2">
          {grid.map((card, i) => (
            <Cell
              key={card.id}
              card={card}
              ring={!current && targets.includes(i) ? [myColor] : []}
              chosen={shownPicks.includes(i) ? shownPicks.indexOf(i) + 1 : undefined}
              onClick={current ? () => tap(i) : undefined}
              disabled={busy}
            >
              {!current && targets.includes(i) && (
                <span className="absolute left-1 top-1 rounded-full px-1.5 text-[10px] font-bold text-white" style={{ background: myColor }}>
                  yours
                </span>
              )}
            </Cell>
          ))}
        </div>
        {current && (
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" className="btn-accent" disabled={sel.length !== current.count || busy} onClick={() => void answer()}>
              Answer ({sel.length}/{current.count})
            </button>
            <button
              type="button"
              className="btn-paper"
              onClick={() => {
                setAnswering(null);
                setSel([]);
              }}
            >
              Cancel
            </button>
            <span className="text-xs text-ink-faint">Your own characters are hidden while you answer.</span>
          </div>
        )}
      </div>

      {!current && (
        <div className="space-y-2 rounded-lg border border-rule p-4">
          <h3 className="font-display font-bold">Your clue</h3>
          {myClue ? (
            <p className="text-sm">
              <span className="rounded-md px-2 py-0.5 font-display text-lg font-bold text-white" style={{ background: myColor }}>
                {myClue.clue} · {myClue.count}
              </span>{' '}
              <span className="text-ink-soft">posted. Tomorrow, see who found your characters.</span>
            </p>
          ) : !secret ? (
            <p className="text-sm text-ink-soft">{demo || note ? 'Your characters are loading…' : 'Loading…'}</p>
          ) : (
            <>
              <p className="text-sm text-ink-soft">
                One word, not a name on the grid. Then say how many of your characters it points to: your friends pick that many. +{fmt(CLUE.clue)} <Coin /> for posting.
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  value={word}
                  maxLength={CLUE_MAX}
                  onChange={(e) => setWord(e.target.value.replace(/\s/g, ''))}
                  onKeyDown={(e) => e.key === 'Enter' && void post()}
                  placeholder="One word"
                  className="w-40 rounded-md border border-rule-strong bg-card px-3 py-1.5"
                  aria-label="Your clue"
                />
                <span className="flex gap-1" role="group" aria-label="How many characters it points to">
                  {Array.from({ length: CLUE.targets }, (_, k) => k + 1).map((n) => (
                    <button key={n} type="button" aria-pressed={count === n} onClick={() => setCount(n)} className={`size-9 rounded-md border font-display font-bold ${count === n ? 'border-accent bg-accent text-white' : 'border-rule-strong hover:bg-tile'}`}>
                      {n}
                    </button>
                  ))}
                </span>
                <button type="button" className="btn-accent" disabled={!word || !!problem || busy} onClick={() => void post()}>
                  Post
                </button>
              </div>
              {problem && <p className="text-xs font-semibold text-coral">{problem}</p>}
            </>
          )}
        </div>
      )}

      {!current && (
        <div className="space-y-2 rounded-lg border border-rule p-4">
          <h3 className="font-display font-bold">Your friends&apos; clues</h3>
          {!hasFriends ? (
            <p className="text-sm text-ink-soft">Add friends to answer their clues.</p>
          ) : clues === null ? (
            <p className="text-sm text-ink-soft">Loading…</p>
          ) : !clues.length ? (
            <p className="text-sm text-ink-soft">No clue yet today. Come back later!</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {clues.map((c) => {
                const p = byUid.get(c.uid);
                const done = cells(secret?.picks?.[c.uid], c.count);
                return (
                  <button
                    key={c.uid}
                    type="button"
                    disabled={!!done.length || !secret || busy}
                    onClick={() => {
                      sfx.select();
                      setAnswering(c.uid);
                      setSel([]);
                      setNote(null);
                    }}
                    className={`flex items-center gap-2 rounded-full border py-1 pl-1 pr-3 text-sm transition ${done.length ? 'border-rule opacity-60' : 'border-rule-strong hover:-translate-y-0.5 hover:bg-tile'}`}
                    style={done.length ? undefined : { borderColor: p?.color }}
                  >
                    {p?.face}
                    <span className="font-display font-bold" style={{ color: p?.color }}>
                      {c.clue}
                    </span>
                    <span className="text-xs font-bold text-ink-faint">· {c.count}</span>
                    <span className={`text-xs font-bold ${done.length ? 'text-hit' : 'text-ink-faint'}`}>{done.length ? '✓ answered' : <>+{fmt(CLUE.answer)} <Coin /></>}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {!current && <Yesterday grid={past} day={results} people={byUid} me={me} />}
    </section>
  );
}

/** Yesterday's grid revealed: each character's owners (their colours), who picked it for which clue, and each clue's score. */
function Yesterday({ grid, day, people, me }: { grid: Card[]; day: Day | null; people: Map<string, CluePerson>; me: string | null }) {
  if (!day) return <p className="text-sm text-ink-soft">Loading yesterday…</p>;
  const name = (uid: string) => (uid === me ? 'You' : (people.get(uid)?.name ?? 'A friend'));
  const color = (uid: string) => people.get(uid)?.color ?? 'var(--color-ink-faint)';
  const targetsOf = new Map(day.secrets.map((s) => [s.uid, cells(s.targets, CLUE.targets)]));
  const clueOf = new Map(day.clues.map((c) => [c.uid, c]));
  // Every pick: who picked which character, for whose clue.
  const picks = day.secrets.flatMap((s) =>
    Object.entries(s.picks ?? {}).flatMap(([giver, xs]) => {
      const clue = clueOf.get(giver);
      return clue ? cells(xs, clue.count).map((i) => ({ who: s.uid, giver, i })) : [];
    }),
  );
  if (!day.clues.length && !picks.length)
    return (
      <div className="space-y-2 pt-2">
        <p className="text-xs font-bold uppercase tracking-widest text-ink-faint">Yesterday&apos;s grid · you and your friends</p>
        <p className="text-sm text-ink-soft">Nobody played yesterday.</p>
      </div>
    );
  return (
    <div className="space-y-3 pt-2">
      <p className="text-xs font-bold uppercase tracking-widest text-ink-faint">Yesterday&apos;s grid · hover or tap a character to see who picked it</p>
      <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-5 sm:gap-2">
        {grid.map((card, i) => {
          const owners = [...targetsOf].filter(([, t]) => t.includes(i)).map(([uid]) => uid);
          const here = picks.filter((p) => p.i === i);
          return (
            <Cell
              key={card.id}
              card={card}
              ring={owners.map(color)}
              at={i}
              tip={
                owners.length || here.length ? (
                  <div className="space-y-1">
                    {owners.length > 0 && (
                      <p>
                        <span className="font-bold">{shownName(card.name, card.set)}</span> was {owners.map((u) => (u === me ? 'yours' : `${name(u)}’s`)).join(' and ')}.
                      </p>
                    )}
                    {here.length ? (
                      <ul className="space-y-0.5">
                        {here.map((p, k) => {
                          const right = (targetsOf.get(p.giver) ?? []).includes(i);
                          return (
                            <li key={k}>
                              <span className={right ? 'text-hit' : 'text-coral'}>{right ? '✓' : '✗'}</span> <span className="font-semibold" style={{ color: color(p.who) }}>{name(p.who)}</span>, for {p.giver === me ? 'your' : `${name(p.giver)}’s`} “{clueOf.get(p.giver)?.clue}”
                            </li>
                          );
                        })}
                      </ul>
                    ) : (
                      <p className="text-ink-faint">Nobody picked it.</p>
                    )}
                  </div>
                ) : undefined
              }
            >
              <OwnerDots colors={owners.map(color)} />
              {here.length > 0 && <span className="absolute right-1 top-1 grid h-5 min-w-5 place-items-center rounded-full bg-ink px-1 text-[10px] font-bold text-paper">👆{here.length}</span>}
            </Cell>
          );
        })}
      </div>
      <div className="space-y-1.5">
        {day.clues.map((c) => {
          const theirs = targetsOf.get(c.uid) ?? [];
          const answers = day.secrets.filter((s) => s.uid !== c.uid && s.picks?.[c.uid]);
          return (
            <div key={c.uid} className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-md bg-tile/70 p-2 text-sm">
              {people.get(c.uid)?.face}
              <span className="font-display font-bold" style={{ color: color(c.uid) }}>
                {c.clue} · {c.count}
              </span>
              <span className="text-xs text-ink-faint">{name(c.uid)}</span>
              <span className="flex flex-wrap gap-1.5">
                {answers.length ? (
                  answers.map((s) => {
                    const right = rightOf(cells(s.picks[c.uid], c.count), theirs);
                    return (
                      <span key={s.uid} className={`rounded-full border px-2 text-xs font-semibold ${right === c.count ? 'border-hit/60 text-hit' : 'border-rule text-ink-soft'}`}>
                        {name(s.uid)} {right}/{c.count}
                      </span>
                    );
                  })
                ) : (
                  <span className="text-xs text-ink-faint">nobody answered</span>
                )}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
