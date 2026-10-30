import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ODD_THEMES, oddRound, type OddRound } from '../arcade/oddOneOut';
import { jlptWord, shortMeaning } from '../arcade/jlpt';
import { Customise, useCustomPicks } from '../components/Customise';

/** Themes to mix in "Your mix". */
const ODD_OPTIONS = ODD_THEMES.filter((t) => t.id !== 'all').map((t) => ({ key: t.id, label: t.theme }));
import { TimerBar } from '../boss/TimerBar';
import { shownName } from '../lib/french';
import { celebrateBig } from '../lib/fx';
import { sfx } from '../lib/sfx';
import { useProgress } from '../store/progress';

/** Seconds for each round: 20 at first, less with every one found, down to 5. */
const secondsFor = (streak: number) => Math.max(5, 20 - streak * 0.75);
/** What a round ran out of time is recorded as (never a card's label). */
const TIMEOUT = '__timeout__';

function Run({ themeId, label, onExit, mix }: { themeId: string; label: string; onExit: () => void; mix?: string[] }) {
  const key = `odd:${themeId}`;
  // "Your mix" (Customise): any of the picked themes.
  const draw = () => (mix ? oddRound('all', Math.random, (t) => mix.includes(t.id)) : oddRound(themeId));
  const best = useProgress((s) => s.bests[key] ?? 0);
  const recordBest = useProgress((s) => s.recordBest);
  const [round, setRound] = useState<OddRound>(draw);
  const [picked, setPicked] = useState<string | null>(null);
  const [streak, setStreak] = useState(0);
  const right = picked === round.odd;
  const over = picked !== null && !right;

  const pick = (label: string) => {
    if (picked) return;
    setPicked(label);
    if (label === round.odd) {
      sfx.correct();
      setStreak((s) => s + 1);
    } else {
      sfx.wrong();
      recordBest(key, streak, { reached: streak / 2 });
      if (streak > best) window.setTimeout(() => (sfx.streak(), celebrateBig()), 400);
    }
  };
  const next = () => {
    sfx.click();
    setRound(draw());
    setPicked(null);
  };
  const again = () => {
    setStreak(0);
    next();
  };

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div className="flex items-end justify-between">
        <button type="button" onClick={onExit} className="font-display text-sm font-semibold tracking-wider text-ink-soft hover:text-ink">
          ← {label}
        </button>
        <p className="font-display text-sm text-ink-soft">
          Streak <span className="font-serif text-2xl font-bold text-ink">{streak}</span> · best {Math.max(best, over ? streak : 0)}
        </p>
      </div>
      <p className="text-center font-serif text-lg italic text-ink-soft">
        {round.theme}: four of them share something. Which one doesn&apos;t belong?
      </p>
      <TimerBar total={secondsFor(streak) * 1000} running={!picked} resetKey={round.cards.map((c) => c.label).join()} onExpire={() => !picked && pick(TIMEOUT)} />
      <div key={round.cards.map((c) => c.label).join()} className="grid grid-cols-2 gap-2 sm:grid-cols-5 sm:gap-3">
        {round.cards.map((c) => {
          const isOdd = c.label === round.odd;
          const tone = !picked ? 'border-rule-strong hover:-translate-y-0.5 hover:border-ink' : isOdd ? 'border-hit ring-2 ring-hit' : c.label === picked ? 'border-miss ring-2 ring-miss' : 'border-rule opacity-60';
          return (
            <button key={c.label} type="button" disabled={!!picked} onClick={() => pick(c.label)} className={`animate-round-in flex flex-col overflow-hidden rounded-lg border-2 bg-card text-left transition ${tone}`}>
              <div className="aspect-square w-full bg-tile">{c.image && <img src={c.image} alt="" draggable={false} className="size-full object-cover object-top" />}</div>
              <p className="truncate p-2 text-center text-sm font-semibold">{shownName(c.label)}</p>
              {/* JLPT words: their reading and meaning once the round is over (the point is to learn). */}
              {picked && jlptWord(c.label) && (
                <p lang="ja" className="animate-pop px-2 pb-2 text-center text-xs text-ink-soft">
                  {jlptWord(c.label)!.reading} · {shortMeaning(jlptWord(c.label)!.meaning, 2)}
                </p>
              )}
            </button>
          );
        })}
      </div>
      {picked && (
        <div className={`animate-pop space-y-2 rounded-md border p-4 text-center ${right ? 'border-hit/50 bg-hit/10' : 'border-miss/50 bg-miss/10'}`}>
          <p className="font-display text-sm uppercase tracking-widest text-ink-soft">{right ? 'Right!' : picked === TIMEOUT ? "Time's up — streak over" : 'Streak over'}</p>
          <p className="text-lg">
            The others are all <span className="font-bold">{round.link}</span> — <span className="font-bold">{round.odd}</span> isn&apos;t.
          </p>
          {right ? (
            <button type="button" onClick={next} className="btn-ink rounded-md px-6 py-2.5 font-display font-bold tracking-wider">
              Next →
            </button>
          ) : (
            <>
              <p className="text-sm text-ink-soft">{streak > best ? '★ New best!' : `Best: ${best}`}</p>
              <button type="button" onClick={again} className="btn-ink rounded-md px-6 py-2.5 font-display font-bold tracking-wider">
                Play again
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

/** /odd-one-out */
export default function OddOneOut() {
  const bests = useProgress((s) => s.bests);
  const [theme, setTheme] = useState<(typeof ODD_THEMES)[number] | null>(null);
  const { picks, setPicks } = useCustomPicks('omnidle-custom-odd', ODD_OPTIONS);
  if (theme) return <Run key={theme.id} themeId={theme.id} label={theme.theme} onExit={() => setTheme(null)} mix={theme.id === 'custom' ? picks : undefined} />;
  return (
    <div className="space-y-8">
      <div>
        <Link to="/games" className="font-display text-sm font-semibold tracking-wider text-ink-soft hover:text-ink">
          ← Games
        </Link>
        <h1 className="text-5xl font-bold">Odd One Out</h1>
        <p className="max-w-xl text-ink-soft">Five cards: four share a link, one doesn&apos;t. Spot the intruder and keep the streak going until the first mistake — each round a little quicker than the last.</p>
      </div>
      <Customise options={ODD_OPTIONS} picks={picks} onChange={setPicks} noun="theme" />
      <ul className="grid gap-3 sm:grid-cols-3">
        {picks.length > 0 && (
          <li>
            <button type="button" onClick={() => (sfx.click(), setTheme({ id: 'custom', theme: 'Your mix' }))} className="page flex h-full w-full flex-col items-start gap-1 rounded-md p-4 text-left ring-2 ring-coral/60 transition hover:-translate-y-0.5">
              <span className="font-display text-lg font-bold">🎛 Your mix</span>
              <span className="text-xs text-ink-faint">
                {picks.length} theme{picks.length === 1 ? '' : 's'} · {(bests['odd:custom'] ?? 0) > 0 ? `Best streak: ${bests['odd:custom']}` : 'Not played yet'}
              </span>
            </button>
          </li>
        )}
        {ODD_THEMES.map((t) => (
          <li key={t.id}>
            <button type="button" onClick={() => (sfx.click(), setTheme(t))} className="page flex h-full w-full flex-col items-start gap-1 rounded-md p-4 text-left ring-2 ring-accent/40 transition hover:-translate-y-0.5">
              <span className="font-display text-lg font-bold">{t.theme}</span>
              <span className="text-xs text-ink-faint">{(bests[`odd:${t.id}`] ?? 0) > 0 ? `Best streak: ${bests[`odd:${t.id}`]}` : 'Not played yet'}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
