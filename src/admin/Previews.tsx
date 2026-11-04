// What a draft looks like before it's saved, with the game's own functions fed the draft's numbers.
import { Component, type ReactNode } from 'react';
import { RARITIES, RARITY_INFO, RARITY_LIGHT, type Rarity } from '../gacha/cards';
import { clearRepeatReward, clearReward, DUPLICATE_VALUE, listSeconds, PITY_TOP_SHARE, roundCoins, type NameThemAllTuning } from '../gacha/economy';
import { NAME_LISTS } from '../arcade/lists';
import { GradeEmblem } from '../gacha/GradeEmblem';
import { gradeReward, type GradeInfo } from '../gacha/grades';
import { lastCardOdds, oddsWith } from '../gacha/packs';
import type economyJson from '../data/tuning/economy.json';
import type gradesJson from '../data/tuning/grades.json';
import type packsJson from '../data/tuning/packs.json';
import type raritiesJson from '../data/tuning/rarities.json';
import type { Json } from './api';

const pct = (x: number) => `${x >= 1 ? x.toFixed(1) : x >= 0.1 ? x.toFixed(2) : x.toFixed(3)}%`;
const th = 'px-2 py-1 text-left font-display text-xs uppercase tracking-wider text-ink-faint';
const td = 'px-2 py-1 tabular-nums';

function Box({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="page space-y-2 rounded-md p-3">
      <h3 className="font-display text-sm font-bold">{title}</h3>
      {children}
    </section>
  );
}

/** A preview of a draft, if its file has one (schema/admin-files.json "preview"); the page wraps it in an error boundary, as a draft may be mid-edit. */
export function Preview({ kind, data }: { kind?: string; data: Json }) {
  if (kind === 'odds') return <OddsPreview t={data as unknown as typeof packsJson} />;
  if (kind === 'economy') return <EconomyPreview t={data as unknown as typeof economyJson} />;
  if (kind === 'rarities') return <RarityPreview t={data as unknown as typeof raritiesJson} />;
  if (kind === 'grades') return <GradesPreview t={data as unknown as typeof gradesJson} />;
  if (kind === 'nameThemAll') return <NameThemAllPreview t={(data as unknown as { nameThemAll: NameThemAllTuning }).nameThemAll} />;
  return null;
}

export class PreviewBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? <p className="text-xs text-ink-faint">No preview while the draft is incomplete.</p> : this.props.children;
  }
}

function OddsPreview({ t }: { t: typeof packsJson }) {
  const tuning = { odds: t.odds as Record<Rarity, number>, topCap: t.topCap, topShare: PITY_TOP_SHARE };
  const sum = Object.values(t.odds).reduce((a, b) => a + b, 0);
  const cols = [{ label: 'Base', boost: 1 }, ...(['medium', 'hard', 'hell'] as const).map((d) => ({ label: d, boost: t.boost[d] }))];
  const table = cols.map((c) => {
    const odds = oddsWith(c.boost, 1, tuning);
    const last = lastCardOdds(odds, tuning.odds);
    // At least one in a pack: none on the first cards nor on the last one.
    return { ...c, odds, pack: Object.fromEntries(RARITIES.map((r) => [r, 1 - Math.pow(1 - odds[r] / 100, t.packSize - 1) * (1 - last[r] / 100)])) as Record<Rarity, number> };
  });
  return (
    <div className="space-y-3">
      <Box title="Drop rates per card (at least one per pack)">
        <p className={`text-xs ${Math.abs(sum - 100) < 1e-6 ? 'text-hit' : 'font-bold text-miss'}`}>Base odds add up to {sum.toFixed(3)}%</p>
        <table className="w-full text-sm">
          <thead>
            <tr>
              <th className={th}>Rarity</th>
              {cols.map((c) => (
                <th key={c.label} className={`${th} text-right`}>
                  {c.label} ×{c.boost}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {RARITIES.map((r) => (
              <tr key={r} className="border-t border-rule/60">
                <td className={td} style={{ color: RARITY_LIGHT[r] }}>
                  {RARITY_INFO[r].name}
                </td>
                {table.map((c) => (
                  <td key={c.label} className={`${td} text-right`}>
                    {pct(c.odds[r])} <span className="text-ink-faint">({pct(c.pack[r] * 100)})</span>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </Box>
      <Box title="Wrappers">
        <div className="flex flex-wrap gap-2">
          {[{ ...t.general, cost: t.general.cost }, ...t.domain.packs.map((p) => ({ ...p, cost: t.domain.cost })), { name: 'Franchise pack', icon: t.franchise.icon, colors: [t.franchise.color, t.franchise.secondColor], cost: t.franchise.cost }].map((p) => (
            <div key={p.name} className="flex h-28 w-20 flex-col items-center justify-center rounded-md text-center text-white shadow" style={{ background: `linear-gradient(160deg, ${p.colors[0]}, ${p.colors[1]})` }}>
              <span className="text-2xl">{p.icon}</span>
              <span className="px-1 text-[10px] font-bold leading-tight">{p.name}</span>
              <span className="text-[10px]">🪙 {p.cost}</span>
            </div>
          ))}
        </div>
      </Box>
    </div>
  );
}

function EconomyPreview({ t }: { t: typeof economyJson }) {
  const missions = (m: Record<string, { reward: number }>) => Object.values(m).map((x) => x.reward);
  const best3 = (xs: number[]) => [...xs].sort((a, b) => b - a).slice(0, 3).reduce((a, b) => a + b, 0);
  return (
    <div className="space-y-3">
      <Box title="A daily round">
        <table className="w-full text-sm">
          <tbody>
            {[0, 30, 60, 100].map((s) => (
              <tr key={s} className="border-t border-rule/60">
                <td className={td}>Won with {s} points</td>
                <td className={`${td} text-right`}>🪙 {roundCoins(true, s, t.round)}</td>
              </tr>
            ))}
            <tr className="border-t border-rule/60">
              <td className={td}>Lost</td>
              <td className={`${td} text-right`}>🪙 {roundCoins(false, 0, t.round)}</td>
            </tr>
          </tbody>
        </table>
      </Box>
      <Box title="Bosses">
        <table className="w-full text-sm">
          <thead>
            <tr>
              <th className={th}>Difficulty</th>
              <th className={`${th} text-right`}>Win</th>
              <th className={`${th} text-right`}>+ weekly</th>
            </tr>
          </thead>
          <tbody>
            {Object.keys(t.bossWin).map((d) => (
              <tr key={d} className="border-t border-rule/60">
                <td className={td}>{d}</td>
                <td className={`${td} text-right`}>{t.bossWin[d as keyof typeof t.bossWin]}</td>
                <td className={`${td} text-right`}>{t.bossWin[d as keyof typeof t.bossWin] + t.bossWeekly[d as keyof typeof t.bossWeekly]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Box>
      <Box title="Missions, at most">
        <p className="text-sm">
          A day 🪙 {best3(missions(t.missions))} · a week 🪙 {best3(missions(t.longMissions.week))} · a month 🪙 {best3(missions(t.longMissions.month))}
        </p>
        <p className="text-xs text-ink-faint">The three best-paying of each period (the draw picks three).</p>
      </Box>
      <Box title="Luck">
        <p className="text-sm">
          Full luck (×{t.pity.max}) after {Math.round((t.pity.max - 1) / t.pity.step)} packs without a Legendary or better.
        </p>
      </Box>
    </div>
  );
}

function RarityPreview({ t }: { t: typeof raritiesJson }) {
  return (
    <Box title="Rarities">
      <div className="flex flex-wrap gap-2">
        {RARITIES.map((r) => (
          <div key={r} className="flex w-24 flex-col items-center gap-1 rounded-md border-2 bg-ink-strong p-2 text-center" style={{ borderColor: t.light[r], boxShadow: `0 0 14px ${t.light[r]}` }}>
            <span className="text-lg" style={{ color: t.light[r] }}>
              {t.info[r].gem}
            </span>
            <span className="text-xs font-bold text-white">{t.info[r].name}</span>
            <span className="text-[10px] text-white/60">rank {t.info[r].rank}</span>
          </div>
        ))}
      </div>
    </Box>
  );
}

function GradesPreview({ t }: { t: typeof gradesJson }) {
  const grades = Object.entries(t.grades as unknown as Record<string, GradeInfo>);
  const share = t.rewardShare as Record<number, number>;
  return (
    <div className="space-y-3">
      <Box title="Emblems">
        <div className="flex flex-wrap gap-3">
          {grades.map(([g, info]) => (
            <div key={g} className="flex w-16 flex-col items-center text-center">
              {Number(g) >= 2 ? <GradeEmblem grade={Number(g)} info={info} className="size-14" /> : <span className="flex size-14 items-center justify-center text-xs text-ink-faint">no emblem</span>}
              <span className="text-xs font-semibold">{info.name}</span>
            </div>
          ))}
        </div>
      </Box>
      <Box title={`Elements (grade ${t.elementGrade})`}>
        <div className="flex flex-wrap gap-3">
          {Object.entries(t.elements).map(([id, e]) => (
            <div key={id} className="flex w-20 flex-col items-center gap-1 text-center">
              <GradeEmblem grade={t.elementGrade} info={{ name: e.name, numeral: t.grades[String(t.elementGrade) as keyof typeof t.grades]?.numeral ?? '', metal: e.metal as GradeInfo['metal'] }} className="size-14" />
              <span className="text-xs font-semibold">
                {e.icon} {e.name}
              </span>
              <span className="flex gap-0.5">
                {e.colors.map((c, i) => (
                  <i key={i} className="size-3 rounded-full border border-rule" style={{ background: c }} />
                ))}
              </span>
            </div>
          ))}
        </div>
        <p className="text-xs text-ink-faint">
          Changing an element costs {t.switchCost} 🪙; spares at this grade fetch ×{t.resaleBonus}.
        </p>
      </Box>
      <Box title="Grade-up rewards">
        <table className="w-full text-sm">
          <thead>
            <tr>
              <th className={th}>Grade</th>
              {RARITIES.map((r) => (
                <th key={r} className={`${th} text-right`}>
                  {RARITY_INFO[r].name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {grades
              .filter(([g]) => Number(g) >= 2)
              .map(([g, info]) => (
                <tr key={g} className="border-t border-rule/60">
                  <td className={td}>{info.name}</td>
                  {RARITIES.map((r) => (
                    <td key={r} className={`${td} text-right`}>
                      {gradeReward(r, Number(g), t.gradeCost, share)}
                    </td>
                  ))}
                </tr>
              ))}
          </tbody>
        </table>
        <p className="text-xs text-ink-faint">Spare values from Coins, caps & missions (as saved): {RARITIES.map((r) => DUPLICATE_VALUE[r]).join(' / ')}.</p>
      </Box>
    </div>
  );
}

const clock = (sec: number) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;

/** Every Name Them All list under the draft: its clock, what clearing it pays, and again the same day. */
function NameThemAllPreview({ t }: { t: NameThemAllTuning }) {
  const rows = NAME_LISTS.map((l) => {
    const seconds = listSeconds(l.answers.length, t);
    const full = clearReward(l.answers.length, seconds, t);
    return { id: l.id, title: `${l.franchise} · ${l.title}`, names: l.answers.length, seconds, full, again: clearRepeatReward(full, t) };
  }).sort((a, b) => b.full - a.full || b.names - a.names);
  const capped = rows.filter((r) => r.full >= t.clearMax).length;
  return (
    <Box title={`Clearing a list (${rows.length} lists)`}>
      <p className="text-xs text-ink-faint">
        Biggest first. {capped ? `${capped} list(s) at the cap of ${t.clearMax.toLocaleString()}.` : 'None at the cap.'} Again the same day: the last column.
      </p>
      <div className="max-h-[60vh] overflow-y-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-card">
            <tr>
              <th className={th}>List</th>
              <th className={`${th} text-right`}>Names</th>
              <th className={`${th} text-right`}>Time</th>
              <th className={`${th} text-right`}>Pays</th>
              <th className={`${th} text-right`}>Again</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-rule/60">
                <td className={`${td} max-w-[12rem] truncate`} title={r.title}>{r.title}</td>
                <td className={`${td} text-right`}>{r.names}</td>
                <td className={`${td} text-right`}>{clock(r.seconds)}</td>
                <td className={`${td} whitespace-nowrap text-right font-semibold`}>🪙 {r.full.toLocaleString()}</td>
                <td className={`${td} text-right text-ink-faint`}>{r.again.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Box>
  );
}
