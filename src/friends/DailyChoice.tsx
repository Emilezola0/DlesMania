// Friends → Daily Choice: today's three questions (src/friends/choiceQuestions.ts), a card to pick for each — every
// pick pays — and yesterday's, with who among you and your friends picked what (src/cloud/choices.ts).
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import type { VoteDoc } from '../cloud/choices';
import { DleCoin } from '../components/DleCoin';
import { CardAvatar } from '../gacha/Perks';
import { RARITY_LIGHT, type Card } from '../gacha/cards';
import { addDays, todayKey } from '../lib/date';
import { celebrate } from '../lib/fx';
import { shownName } from '../lib/french';
import { sfx } from '../lib/sfx';
import { useProgress } from '../store/progress';
import { CHOICE, questionsOf, type ChoiceQuestion } from './choiceQuestions';

const cloud = () => import('../cloud/choices');

export interface ChoicePerson {
  uid: string;
  /** Their icon and name, drawn by the Friends page. */
  face: ReactNode;
  name: string;
}

const coins = CHOICE.coins.toLocaleString('en');

function Option({ card, picked, chosen, onPick, busy }: { card: Card; picked: boolean; chosen: boolean; onPick: () => void; busy: boolean }) {
  return (
    <button
      type="button"
      onClick={onPick}
      disabled={chosen || busy}
      className={`group flex flex-col items-center gap-2 rounded-lg border-2 p-3 text-center transition ${
        picked ? 'border-accent bg-accent/10' : chosen ? 'border-rule opacity-45' : 'border-rule hover:-translate-y-0.5 hover:border-rule-strong hover:bg-tile'
      }`}
      style={picked ? { boxShadow: `0 0 18px ${RARITY_LIGHT[card.rarity]}66` } : undefined}
    >
      <CardAvatar card={card} className="size-20 sm:size-24" />
      <span className="leading-tight">
        <span className="block font-display font-bold">{shownName(card.name, card.set)}</span>
        <span className="block text-xs text-ink-faint">{card.franchise}</span>
      </span>
      {picked && <span className="text-xs font-bold text-accent">✓ Your choice</span>}
    </button>
  );
}

/** One of today's questions. */
function Today({ q, pick, onPick, busy }: { q: ChoiceQuestion; pick?: string; onPick: (id: string) => void; busy: boolean }) {
  return (
    <div className="space-y-3 rounded-lg border border-rule p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-display text-lg font-bold">{q.text}</h3>
        <span className={`text-xs font-bold ${pick ? 'text-hit' : 'text-ink-faint'}`}>
          {pick ? '✓ Chosen' : <>+{coins} <DleCoin className="inline size-3.5 align-[-2px]" /></>}
        </span>
      </div>
      <div className={`grid gap-2 ${q.options.length === 2 ? 'grid-cols-2' : q.options.length === 3 ? 'grid-cols-3' : 'grid-cols-2 sm:grid-cols-4'}`}>
        {q.options.map((c) => (
          <Option key={c.id} card={c} picked={pick === c.id} chosen={!!pick} busy={busy} onPick={() => onPick(c.id)} />
        ))}
      </div>
    </div>
  );
}

/** One of yesterday's questions: each card, how many picked it, and who. */
function Result({ q, votes, people }: { q: ChoiceQuestion; votes: VoteDoc[]; people: Map<string, ChoicePerson> }) {
  const by = q.options.map((c) => ({ card: c, who: votes.filter((v) => v.picks[String(q.index)] === c.id).map((v) => v.uid) }));
  const total = by.reduce((n, o) => n + o.who.length, 0);
  const top = Math.max(0, ...by.map((o) => o.who.length));
  return (
    <div className="space-y-2 rounded-lg border border-rule p-4">
      <h3 className="font-display font-bold">{q.text}</h3>
      {by.map(({ card, who }) => {
        const share = total ? who.length / total : 0;
        return (
          <div key={card.id} className="flex items-center gap-3">
            <CardAvatar card={card} className="size-10" />
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex items-baseline justify-between gap-2">
                <span className={`truncate font-semibold ${who.length && who.length === top ? 'text-accent' : ''}`}>
                  {who.length && who.length === top ? '👑 ' : ''}
                  {shownName(card.name, card.set)} <span className="text-xs font-normal text-ink-faint">{card.franchise}</span>
                </span>
                <span className="shrink-0 text-xs font-bold tabular-nums text-ink-soft">
                  {who.length} vote{who.length === 1 ? '' : 's'}
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-tile">
                <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${share * 100}%` }} />
              </div>
              {who.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {who.map((uid) => {
                    const p = people.get(uid);
                    return (
                      <span key={uid} className="flex items-center gap-1 rounded-full border border-rule py-0.5 pl-0.5 pr-2 text-xs" title={p?.name}>
                        {p?.face}
                        <span className="max-w-[7rem] truncate">{p?.name ?? 'A friend'}</span>
                      </span>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        );
      })}
      {!total && <p className="text-xs text-ink-faint">Nobody chose yesterday.</p>}
    </div>
  );
}

/** Dev only (#/friends?demo): made-up votes for yesterday. */
function demoVotes(people: ChoicePerson[], day: string): VoteDoc[] {
  const qs = questionsOf(day);
  return people.map((p, k) => ({ uid: p.uid, day, picks: Object.fromEntries(qs.map((q) => [String(q.index), q.options[(k + q.index) % q.options.length].id])) }));
}

export function DailyChoice({ people, demo }: { people: ChoicePerson[]; demo: boolean }) {
  const today = todayKey();
  const yesterday = addDays(today, -1);
  const questions = useMemo(() => questionsOf(today), [today]);
  const past = useMemo(() => questionsOf(yesterday), [yesterday]);
  const [mine, setMine] = useState<Record<string, string>>({});
  const [results, setResults] = useState<VoteDoc[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ text: string; good?: boolean } | null>(null);
  const uids = people.map((p) => p.uid).join(',');
  const byUid = useMemo(() => new Map(people.map((p) => [p.uid, p])), [people]);

  useEffect(() => {
    let live = true;
    if (demo) {
      setResults(demoVotes(people, yesterday));
      return;
    }
    void cloud().then(async (c) => {
      const [m, r] = await Promise.all([c.myVotes(today).catch(() => null), c.votesOf(uids ? uids.split(',') : [], yesterday)]);
      if (!live) return;
      setMine(m?.picks ?? {});
      setResults(r);
    });
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [today, yesterday, uids, demo]);

  const pick = async (q: ChoiceQuestion, cardId: string) => {
    if (mine[String(q.index)] || busy) return;
    sfx.select();
    if (demo) {
      setMine((m) => ({ ...m, [String(q.index)]: cardId }));
      setNote({ text: `+${coins} DleCoins (demo: not really paid).`, good: true });
      return;
    }
    setBusy(true);
    setNote(null);
    try {
      const { result, doc } = await (await cloud()).vote(today, q.index, cardId);
      if (doc) setMine(doc.picks);
      if (result === 'refused') return setNote({ text: "Your device's date doesn't match today's: set it right to choose." });
      if (result === 'done') return setNote({ text: 'You already chose for that one (on another device).' });
      useProgress.setState((s) => ({ coins: (s.coins ?? 0) + CHOICE.coins }));
      sfx.correct();
      celebrate();
      setNote({ text: `+${coins} DleCoins! Tomorrow, see who your friends picked.`, good: true });
    } catch {
      setNote({ text: 'No connection: try again once you are online.' });
    } finally {
      setBusy(false);
    }
  };

  const left = questions.filter((q) => !mine[String(q.index)]).length;
  return (
    <section className="page space-y-4 rounded-md p-5">
      <div>
        <h2 className="font-display text-lg font-bold">🗳️ Daily Choice</h2>
        <p className="text-sm text-ink-soft">
          {CHOICE.perDay} questions a day, the same for everyone. Each choice pays {coins} <DleCoin className="inline size-3.5 align-[-2px]" />; tomorrow, see who your friends picked.
        </p>
      </div>
      {note && <p className={`rounded-md border p-3 text-sm font-semibold ${note.good ? 'border-hit/50 bg-hit/10' : 'border-coral/50 bg-coral/10 text-coral'}`}>{note.text}</p>}

      <div className="space-y-3">
        <p className="text-xs font-bold uppercase tracking-widest text-ink-faint">Today · {left ? `${left} left to choose` : 'all chosen — come back tomorrow'}</p>
        {questions.map((q) => (
          <Today key={q.index} q={q} pick={mine[String(q.index)]} busy={busy} onPick={(id) => void pick(q, id)} />
        ))}
      </div>

      <div className="space-y-3 pt-2">
        <p className="text-xs font-bold uppercase tracking-widest text-ink-faint">Yesterday&apos;s results · you and your friends</p>
        {results === null ? <p className="text-sm text-ink-soft">Loading…</p> : past.map((q) => <Result key={q.index} q={q} votes={results} people={byUid} />)}
      </div>
    </section>
  );
}
