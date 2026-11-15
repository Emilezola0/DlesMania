// Friends → Bond → Mind Meld (src/friends/bondGames.ts): two cards; each of you writes, unseen, one word that links
// them; the same word is a Meld (Bond points, more the sooner); otherwise link the two words you wrote, round after
// round. One game a day. The friend's word for a round stays hidden until you've written yours.
import { useEffect, useRef, useState } from 'react';
import type { BondDoc } from '../cloud/bonds';
import { CARD_BY_ID } from '../gacha/cards';
import { CardAvatar } from '../gacha/Perks';
import { shownName } from '../lib/french';
import { celebrateBig } from '../lib/fx';
import { sfx } from '../lib/sfx';
import { todayKey } from '../lib/date';
import { MELD, meldPoints, meldRounds, normWord } from './bondGames';

export function MindMeld({ d, me, friend, busy, onStart, onSay }: { d: BondDoc; me: string; friend: { uid: string; name: string }; busy: boolean; onStart: () => void; onSay: (word: string) => void }) {
  const g = d.meld ?? null;
  const today = todayKey();
  const [word, setWord] = useState('');
  // A Meld just made: a celebration, once.
  const cheered = useRef<number | null>(g?.done && g.won ? g.id : null);
  useEffect(() => {
    if (g?.done && g.won && cheered.current !== g.id) {
      cheered.current = g.id;
      sfx.victory();
      celebrateBig();
    }
  }, [g?.done, g?.won, g?.id]);

  const canStart = !g || g.day !== today;
  if (!g)
    return (
      <Frame>
        <p className="text-sm text-ink-soft">Two cards. Each of you writes one word that links them, without seeing the other's. The same word is a Meld!</p>
        <StartButton busy={busy} onStart={onStart} />
      </Frame>
    );

  const rounds = meldRounds(g, me, friend.uid);
  const mine = g.words[`${g.round}_${me}`];
  const theirsIn = g.words[`${g.round}_${friend.uid}`] !== undefined;
  const prev = g.round > 1 ? rounds[g.round - 2] : null;
  const prompt = g.round === 1 || !prev ? null : ([prev.a, prev.b] as string[]);
  // Words already said in the rounds before (the friend's word for this round, still hidden, never counts: the same
  // word is a Meld).
  const taken = new Set([...(prompt ?? []), ...Object.entries(g.words).filter(([k]) => Number(k.split('_')[0]) < g.round).map(([, w]) => w)].map(normWord));
  const send = () => {
    const w = normWord(word);
    if (!w) return;
    sfx.select();
    onSay(w);
    setWord('');
  };
  const cards = g.cards.map((id) => CARD_BY_ID.get(id)).filter((c) => !!c);
  const meldWord = g.done && g.won ? g.words[`${g.round}_${me}`] : null;

  return (
    <Frame>
      {/* The two cards it started from. */}
      <div className="flex items-center justify-center gap-3">
        {cards.map((c, k) => (
          <span key={c.id} className="flex items-center gap-2">
            {k === 1 && <span className="font-display text-xl font-black text-ink-faint">+</span>}
            <span className="flex flex-col items-center gap-1">
              <CardAvatar card={c} className="size-14" />
              <span className="max-w-24 truncate text-xs font-semibold">{shownName(c.name, c.set)}</span>
            </span>
          </span>
        ))}
      </div>
      {/* The rounds so far: both words once both are written. */}
      {rounds.some((r) => r.a || r.b) && (
        <ol className="space-y-1 text-sm">
          {rounds.map((r) => {
            const both = !!(r.a && r.b);
            const melded = both && r.a === r.b;
            if (!r.a && !r.b) return null;
            return (
              <li key={r.round} className={`flex items-center gap-2 rounded-md px-2 py-1 ${melded ? 'meld-hit font-bold' : 'bg-tile/60'}`}>
                <span className="w-16 shrink-0 text-xs font-bold uppercase tracking-wider text-ink-faint">Round {r.round}</span>
                <span className="min-w-0 flex-1 truncate">
                  You: <b>{r.a ?? '…'}</b>
                </span>
                <span className="min-w-0 flex-1 truncate text-right">
                  {friend.name}: <b>{both || r.round < g.round ? (r.b ?? '—') : r.b ? '🔒 written' : '…'}</b>
                </span>
              </li>
            );
          })}
        </ol>
      )}
      {g.done ? (
        g.won ? (
          <p className="meld-win rounded-md p-3 text-center font-display text-lg font-bold">
            ✨ MELD! You both said « {meldWord} »{g.round > 1 ? ` on round ${g.round}` : ' at once'}: +{g.won} Bond point{g.won === 1 ? '' : 's'}
          </p>
        ) : (
          <p className="rounded-md bg-tile p-3 text-center text-sm text-ink-soft">No Meld after {MELD.rounds} rounds. So close…</p>
        )
      ) : mine ? (
        <p className="text-center text-sm text-ink-soft">
          Your word: <b className="text-ink">« {mine} »</b>. {theirsIn ? '' : `Waiting for ${friend.name}…`}
        </p>
      ) : (
        <div className="space-y-1.5">
          <p className="text-center text-sm font-semibold">
            {prompt ? (
              <>
                Link <b>« {prompt[0]} »</b> and <b>« {prompt[1]} »</b>: one word.
              </>
            ) : (
              'One word that links these two cards.'
            )}{' '}
            {theirsIn && <span className="text-ink-soft">({friend.name} has written theirs.)</span>}
          </p>
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              send();
            }}
          >
            <input
              value={word}
              onChange={(e) => setWord(e.target.value)}
              maxLength={24}
              placeholder="Your word"
              aria-label="Your word"
              className="min-w-0 flex-1 rounded-md border border-rule bg-card px-3 py-1.5 text-sm"
            />
            <button type="submit" disabled={busy || !normWord(word) || taken.has(normWord(word))} className="btn-accent rounded-md px-3 py-1.5 text-sm font-bold disabled:opacity-50">
              Send
            </button>
          </form>
          {taken.has(normWord(word)) && normWord(word) && <p className="text-center text-xs text-coral">That word is already on the table: find a new one.</p>}
          <p className="text-center text-xs text-ink-faint">
            A Meld now: +{meldPoints(g.round)} point{meldPoints(g.round) === 1 ? '' : 's'} · round {g.round} of {MELD.rounds}
          </p>
        </div>
      )}
      {canStart && <StartButton busy={busy} onStart={onStart} again />}
      {!canStart && g.done && <p className="text-center text-xs text-ink-faint">A new Mind Meld tomorrow.</p>}
    </Frame>
  );
}

function StartButton({ busy, onStart, again = false }: { busy: boolean; onStart: () => void; again?: boolean }) {
  return (
    <button type="button" disabled={busy} onClick={() => (sfx.select(), onStart())} className="btn-accent mx-auto block rounded-md px-4 py-1.5 text-sm font-bold disabled:opacity-50">
      🧠 {again ? 'Start today’s Mind Meld' : 'Start a Mind Meld'}
    </button>
  );
}

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-3 rounded-md border border-rule bg-card/60 p-3">
      <p className="font-display font-bold">
        🧠 Mind Meld{' '}
        <span className="text-xs font-semibold text-ink-soft">
          · a Meld: +{MELD.points[0]} / +{MELD.points[1]} / +{MELD.points[2]} points
        </span>
      </p>
      {children}
    </div>
  );
}
