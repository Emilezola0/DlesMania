import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { WHO_MAX_WRONG, WHO_ROUNDS, WHO_UNIVERSES, WHO_FREE_CLUES, whoPoints, type WhoUniverse } from '../arcade/whoAmI';
import { Customise, useCustomPicks } from '../components/Customise';

const WHO_OPTIONS = WHO_UNIVERSES.map((u) => ({ key: u.id, label: `${u.icon} ${u.label}` }));
import { GuessInput } from '../components/GuessInput';
import { shownName } from '../lib/french';
import { celebrateBig } from '../lib/fx';
import { shuffle } from '../lib/rng';
import { sfx } from '../lib/sfx';
import { useProgress } from '../store/progress';

function Run({ universe: u, onExit }: { universe: WhoUniverse; onExit: () => void }) {
  const key = `who:${u.id}`;
  const best = useProgress((s) => s.bests[key] ?? 0);
  const recordBest = useProgress((s) => s.recordBest);
  const [run, setRun] = useState(0);
  const targets = useMemo(() => shuffle(u.targets, Math.random).slice(0, WHO_ROUNDS), [u, run]);
  const [index, setIndex] = useState(0);
  const [shown, setShown] = useState(WHO_FREE_CLUES);
  const [wrong, setWrong] = useState<string[]>([]);
  const [results, setResults] = useState<number[]>([]);
  const target = targets[index];
  const finished = results.length > index;
  const total = results.reduce((a, b) => a + b, 0);
  const over = results.length === WHO_ROUNDS;
  const byId = new Map(u.pool.map((x) => [x.id, x]));

  const end = (points: number) => {
    const all = [...results, points];
    setResults(all);
    if (all.length === WHO_ROUNDS) {
      const sum = all.reduce((a, b) => a + b, 0);
      recordBest(key, sum, { ratio: sum / (WHO_ROUNDS * 100) });
      if (sum > best) window.setTimeout(() => (sfx.streak(), celebrateBig()), 400);
    }
  };
  const guess = (id: string) => {
    if (finished) return;
    if (id === target.id) {
      sfx.correct();
      return end(whoPoints(shown, wrong.length));
    }
    sfx.wrong();
    const w = [...wrong, id];
    setWrong(w);
    // A wrong name brings the next clue too.
    setShown((s) => Math.min(target.clues.length, s + 1));
    if (w.length >= WHO_MAX_WRONG) end(0);
  };
  const moreClue = () => {
    sfx.click();
    setShown((s) => Math.min(target.clues.length, s + 1));
  };
  const next = () => {
    sfx.click();
    setIndex((i) => i + 1);
    setShown(WHO_FREE_CLUES);
    setWrong([]);
  };
  const again = () => {
    setRun((r) => r + 1);
    setResults([]);
    setIndex(0);
    setShown(WHO_FREE_CLUES);
    setWrong([]);
  };

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div className="flex items-end justify-between">
        <button type="button" onClick={onExit} className="font-display text-sm font-semibold tracking-wider text-ink-soft hover:text-ink">
          ← {u.icon} {u.label}
        </button>
        <p className="font-serif text-2xl font-bold tabular-nums">
          {total}
          <span className="text-base text-ink-faint"> / {WHO_ROUNDS * 100}</span>
        </p>
      </div>
      <div className="grid grid-cols-5 gap-1.5">
        {Array.from({ length: WHO_ROUNDS }, (_, i) => (
          <span key={i} className={`h-2 rounded-full ${i < results.length ? (results[i] >= 70 ? 'bg-hit' : results[i] ? 'bg-near' : 'bg-miss') : i === index ? 'bg-ink' : 'bg-tile'}`} />
        ))}
      </div>

      <div key={`${run}-${index}`} className="page animate-round-in space-y-3 rounded-md p-5">
        <p className="font-display text-xs uppercase tracking-[0.3em] text-ink-faint">
          Character {index + 1} of {WHO_ROUNDS} · {shown}/{target.clues.length} clues · worth {finished ? results[index] : whoPoints(shown, wrong.length)}
        </p>
        <ol className="space-y-1.5">
          {target.clues.slice(0, finished ? target.clues.length : shown).map((c, i) => (
            <li key={i} className={`animate-pop flex gap-2 text-lg ${i >= shown ? 'text-ink-faint' : ''}`}>
              <span className="font-display font-bold text-accent">{i + 1}.</span>
              {c}
            </li>
          ))}
        </ol>
        {!finished && shown < target.clues.length && (
          <button type="button" onClick={moreClue} className="btn-paper rounded-md px-4 py-2 font-display text-sm font-semibold">
            Another clue (−12)
          </button>
        )}
      </div>

      {!finished ? (
        <>
          <GuessInput key={`${run}-${index}`} pool={u.pool} exclude={wrong} onGuess={guess} placeholder="Who is it?" />
          {wrong.length > 0 && (
            <ul className="flex flex-wrap justify-center gap-1.5">
              {wrong.map((id) => (
                <li key={id} className="rounded-md border border-miss/50 bg-miss/10 px-2 py-1 text-xs font-semibold line-through decoration-miss/70">
                  {byId.get(id)?.name ?? id}
                </li>
              ))}
              <li className="px-1 text-xs text-ink-faint">
                {WHO_MAX_WRONG - wrong.length} {WHO_MAX_WRONG - wrong.length === 1 ? 'try' : 'tries'} left
              </li>
            </ul>
          )}
        </>
      ) : (
        <div className={`animate-pop flex items-center gap-4 rounded-md border p-4 ${results[index] ? 'border-hit/50 bg-hit/10' : 'border-miss/50 bg-miss/10'}`}>
          <img src={target.image} alt="" className="size-20 shrink-0 rounded-lg object-cover object-top" />
          <div className="min-w-0 flex-1">
            <p className="font-display text-sm uppercase tracking-widest text-ink-soft">{results[index] ? `+${results[index]}` : 'Out of tries'}</p>
            <p className="text-2xl font-bold">{shownName(target.name)}</p>
            {target.aliases.length > 0 && <p className="text-xs text-ink-soft">also: {target.aliases.join(', ')}</p>}
          </div>
          {!over ? (
            <button type="button" data-next onClick={next} className="btn-ink shrink-0 rounded-md px-5 py-2.5 font-display font-bold tracking-wider">
              Next →
            </button>
          ) : (
            <div className="shrink-0 space-y-1 text-center">
              <p className="font-display text-sm font-bold">{total > best ? '★ New best' : `Best ${best}`}</p>
              <button type="button" onClick={again} className="btn-ink rounded-md px-5 py-2.5 font-display font-bold tracking-wider">
                Play again
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** /who-am-i */
export default function WhoAmI() {
  const bests = useProgress((s) => s.bests);
  const [universe, setUniverse] = useState<WhoUniverse | null>(null);
  const { picks, setPicks } = useCustomPicks('omnidle-custom-who', WHO_OPTIONS);
  if (universe) return <Run key={universe.id} universe={universe} onExit={() => setUniverse(null)} />;
  /** "Your mix" (Customise): the picked universes as one, ids kept apart. */
  const mix = (): WhoUniverse => {
    const us = WHO_UNIVERSES.filter((u) => picks.includes(u.id));
    const tag = (u: WhoUniverse) => (x: WhoUniverse['pool'][number]) => ({ ...x, id: `${u.id}:${x.id}` });
    return { id: 'custom', label: 'Your mix', icon: '🎛', domain: us[0].domain, pool: us.flatMap((u) => u.pool.map(tag(u))), targets: us.flatMap((u) => u.targets.map(tag(u))) };
  };
  return (
    <div className="space-y-8">
      <div>
        <Link to="/games" className="font-display text-sm font-semibold tracking-wider text-ink-soft hover:text-ink">
          ← Games
        </Link>
        <h1 className="text-5xl font-bold">Who Am I?</h1>
        <p className="max-w-xl text-ink-soft">
          Three clues to start with, then more one at a time, from the vaguest to the most telling. Name the character whenever you think you know: on the first three clues it&apos;s
          worth 100, and every extra clue or wrong name costs a little. {WHO_ROUNDS} characters a run.
        </p>
      </div>
      <Customise options={WHO_OPTIONS} picks={picks} onChange={setPicks} noun="universe" />
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {picks.length > 0 && (
          <li>
            <button type="button" onClick={() => (sfx.click(), setUniverse(mix()))} className="page flex h-full w-full flex-col items-start gap-1 rounded-md p-5 text-left ring-2 ring-coral/60 transition hover:-translate-y-0.5">
              <span className="text-3xl">🎛</span>
              <span className="font-display text-xl font-bold">Your mix</span>
              <span className="text-xs text-ink-faint">
                {picks.length} universe{picks.length === 1 ? '' : 's'}{(bests['who:custom'] ?? 0) > 0 ? ` · best ${bests['who:custom']} / ${WHO_ROUNDS * 100}` : ''}
              </span>
            </button>
          </li>
        )}
        {WHO_UNIVERSES.map((u) => (
          <li key={u.id}>
            <button type="button" onClick={() => (sfx.click(), setUniverse(u))} className="page flex h-full w-full flex-col items-start gap-1 rounded-md p-5 text-left ring-2 ring-accent/40 transition hover:-translate-y-0.5">
              <span className="text-3xl">{u.icon}</span>
              <span className="font-display text-xl font-bold">{u.label}</span>
              <span className="text-xs text-ink-faint">
                {u.targets.length} characters to find{(bests[`who:${u.id}`] ?? 0) > 0 ? ` · best ${bests[`who:${u.id}`]} / ${WHO_ROUNDS * 100}` : ''}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
