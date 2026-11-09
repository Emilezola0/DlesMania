// The luck report on the Friends page: for the player and each friend, the Legendary, Mythic and Omni cards
// their packs gave against what the odds promised (src/cloud/luck.ts), and how likely that much luck is.
// It can't stop a cheat (packs are rolled on the player's device); it shows who is lucky, and how lucky.
import { useEffect, useState, type ReactNode } from 'react';
import type { Luck } from '../cloud/luck';
import type { TopCount } from '../gacha/packs';

const KINDS = [
  { key: 'legendary', name: 'Legendary', color: '#f59e0b' },
  { key: 'mythic', name: 'Mythic', color: '#e11d48' },
  { key: 'omni', name: 'Omni', color: '#a855f7' },
] as const satisfies readonly { key: keyof TopCount; name: string; color: string }[];

/** Fewer packs than this: too early to say anything. */
const FEW_PACKS = 20;

// ── How likely: Poisson tails (a count of rare pulls, with its expected number) ──
function lnFact(k: number) {
  let s = 0;
  for (let i = 2; i <= k; i++) s += Math.log(i);
  return s;
}
/** erfc, to 1e-7 (Numerical Recipes' erfcc). */
function erfc(x: number) {
  const z = Math.abs(x);
  const t = 1 / (1 + 0.5 * z);
  const r = t * Math.exp(-z * z - 1.26551223 + t * (1.00002368 + t * (0.37409196 + t * (0.09678418 + t * (-0.18628806 + t * (0.27886807 + t * (-1.13520398 + t * (1.48851587 + t * (-0.82215223 + t * 0.17087277)))))))));
  return x >= 0 ? r : 2 - r;
}
const normalUpper = (z: number) => 0.5 * erfc(z / Math.SQRT2);
/** The chance of `k` or more, when `lam` are expected. */
export function atLeast(k: number, lam: number): number {
  if (k <= 0) return 1;
  if (lam <= 0) return 0;
  if (lam > 80) return normalUpper((k - 0.5 - lam) / Math.sqrt(lam));
  let term = Math.exp(-lam + k * Math.log(lam) - lnFact(k));
  let s = 0;
  for (let i = k; i < k + 2000; i++) {
    s += term;
    term *= lam / (i + 1);
    if (term < s * 1e-15) break;
  }
  return Math.min(1, s);
}
/** The chance of `k` or fewer, when `lam` are expected. */
export function atMost(k: number, lam: number): number {
  if (lam <= 0) return 1;
  if (lam > 80) return normalUpper(-(k + 0.5 - lam) / Math.sqrt(lam));
  let term = Math.exp(-lam);
  let s = 0;
  for (let i = 0; i <= k; i++) {
    s += term;
    term *= lam / (i + 1);
  }
  return Math.min(1, s);
}

/** "1 in 2,400", "1 in 3.1 million". */
function oneIn(p: number) {
  const n = 1 / Math.max(p, 1e-15);
  if (n >= 1e9) return `1 in ${(n / 1e9).toFixed(1).replace(/\.0$/, '')} billion`;
  if (n >= 1e6) return `1 in ${(n / 1e6).toFixed(1).replace(/\.0$/, '')} million`;
  return `1 in ${Math.round(n).toLocaleString('en')}`;
}

/** What a player's pulls say: how lucky, and how likely that much luck (or bad luck) is. */
export function verdict(l: Luck): { icon: string; text: string; tone: 'hot' | 'good' | 'even' | 'cold' | 'none' } {
  if (l.packs < FEW_PACKS) return { icon: '⏳', text: `Too early to tell (${l.packs} pack${l.packs === 1 ? '' : 's'})`, tone: 'none' };
  const up = Math.min(...KINDS.map((k) => atLeast(l.got[k.key], l.expected[k.key])));
  const down = Math.min(...KINDS.filter((k) => l.expected[k.key] >= 1).map((k) => atMost(l.got[k.key], l.expected[k.key])), 1);
  if (up < 0.001) return { icon: '🚀', text: `Off the charts: ${oneIn(up)} luck`, tone: 'hot' };
  if (up < 0.02) return { icon: '🍀', text: `Very lucky: ${oneIn(up)}`, tone: 'good' };
  if (up < 0.15) return { icon: '😊', text: 'Lucky', tone: 'good' };
  if (down < 0.05) return { icon: '🌧️', text: `Unlucky: ${oneIn(down)}`, tone: 'cold' };
  return { icon: '⚖️', text: 'Right on the odds', tone: 'even' };
}

const TONE = { hot: 'border-coral/60 bg-coral/10 text-coral', good: 'border-hit/50 bg-hit/10', even: 'border-rule-strong bg-tile', cold: 'border-sky-500/40 bg-sky-500/10', none: 'border-rule bg-tile text-ink-soft' };
const fmt = (n: number, digits = 0) => n.toLocaleString('en', { maximumFractionDigits: digits, minimumFractionDigits: digits });
const date = (ms: number) => new Date(ms).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

/** One row a player: who (drawn by the page), and their luck. `demo`: made-up luck (dev only). */
export function LuckReport({ players, demo }: { players: { uid: string; who: ReactNode }[]; demo?: Record<string, Luck> }) {
  const [luck, setLuck] = useState<Record<string, Luck> | null>(demo ?? null);
  const uids = players.map((p) => p.uid).join(',');
  useEffect(() => {
    if (demo) return setLuck(demo);
    let live = true;
    import('../cloud/luck')
      .then((m) => m.loadLuck(uids ? uids.split(',') : []))
      .then((l) => live && setLuck(l))
      .catch(() => live && setLuck({}));
    return () => {
      live = false;
    };
  }, [uids, demo]);

  return (
    <section className="page space-y-3 rounded-md p-5">
      <div>
        <h2 className="font-display text-lg font-bold">🍀 Luck report</h2>
        <p className="text-sm text-ink-soft">The Legendary, Mythic and Omni cards each of you pulled from packs, against what the odds promised for those very packs (boss boost, pity, golden packs and cosmic events counted).</p>
      </div>
      {!luck ? (
        <p className="text-sm text-ink-soft">Loading…</p>
      ) : (
        <ul className="space-y-2">
          {players.map((p) => {
            const l = luck[p.uid];
            const v = l ? verdict(l) : null;
            return (
              <li key={p.uid} className="space-y-2 rounded-lg border border-rule p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex min-w-0 flex-1 items-center gap-2">{p.who}</div>
                  {v ? (
                    <span className={`rounded-full border px-2.5 py-0.5 text-xs font-bold ${TONE[v.tone]}`}>
                      {v.icon} {v.text}
                    </span>
                  ) : (
                    <span className="text-xs text-ink-faint">No pack opened signed in yet</span>
                  )}
                </div>
                {l && (
                  <>
                    <div className="grid grid-cols-3 gap-2 text-center">
                      {KINDS.map((k) => {
                        const got = l.got[k.key];
                        const exp = l.expected[k.key];
                        const ratio = exp > 0 ? got / exp : 0;
                        return (
                          <div key={k.key} className="rounded-md bg-tile px-1 py-1.5">
                            <p className="text-[10px] font-bold tracking-wider uppercase" style={{ color: k.color }}>
                              {k.name}
                            </p>
                            <p className="font-display text-lg font-bold tabular-nums leading-tight">{fmt(got)}</p>
                            <p className="text-[11px] text-ink-soft tabular-nums">
                              expected {fmt(exp, exp < 10 ? 1 : 0)}
                              {exp > 0 && got > 0 && <span className={ratio >= 1.5 ? 'font-bold text-hit' : ratio <= 0.67 ? 'font-bold text-coral' : ''}> · ×{fmt(ratio, 1)}</span>}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                    <p className="text-[11px] text-ink-faint">
                      {fmt(l.packs)} packs since {date(l.since)}
                    </p>
                  </>
                )}
              </li>
            );
          })}
        </ul>
      )}
      <p className="text-xs text-ink-faint">
        Counted from this update on, for packs opened while signed in. Packs are rolled on each player's device, so this can't prove or stop a cheat — but over a few hundred packs, luck that's “off the charts” is worth a friendly chat. A lucky streak over a few dozen packs is just that.
      </p>
    </section>
  );
}
