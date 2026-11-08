// The Test lab (/test-lab, `npm run dev` only — never in a build, see App.tsx): rig the next packs (their cards,
// their events), give cards, coins, frames and cosmetics, unlock every title, preview any card at any grade, and
// keep a snapshot of the save to come back to once the test is done. Everything here acts on this browser's save
// (and syncs to the account if signed in, like any play): take a snapshot first.
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CardFace } from '../gacha/CardView';
import { COLLECTIBLE, RARITIES, RARITY_INFO, type Card, type Rarity } from '../gacha/cards';
import { COSMIC_KINDS, FORCE_DRAW, FORCE_DRAW_ONCE, PACK_SIZE } from '../gacha/packs';
import { ANOMALIES, ANOMALY_IDS, type AnomalyId } from '../gacha/anomalies';
import { ELEMENT_IDS, ELEMENTS, MAX_GRADE, GRADES, ELEMENT_GRADE, type ElementId } from '../gacha/grades';
import { FRAMES } from '../casino/frames';
import { NAME_STYLES, TITLE_ITEMS, WRAPPERS } from '../casino/cosmetics';
import { DEV_ALL_FEATS, TITLES, useFeats } from '../casino/unlocks';
import { useProgress } from '../store/progress';

const SAVE = 'omnidle-progress';
const SNAPSHOT = 'omnidle-dev-snapshot';
const SKY_MOMENTS = ['comet', 'shower', 'capture'];

const ls = {
  get: (k: string) => {
    try {
      return localStorage.getItem(k);
    } catch {
      return null;
    }
  },
  set: (k: string, v: string | null) => {
    try {
      if (v === null || v === '') localStorage.removeItem(k);
      else localStorage.setItem(k, v);
    } catch {
      // No storage: nothing to keep.
    }
  },
};

/** A localStorage switch, kept in sync with the page. */
function useSwitch(key: string): [string, (v: string) => void] {
  const [v, setV] = useState(() => ls.get(key) ?? '');
  return [v, (next) => (ls.set(key, next), setV(next))];
}

const btn = 'rounded-md border border-rule-strong px-3 py-1.5 text-sm font-semibold transition hover:bg-tile disabled:opacity-40';
const field = 'rounded-md border border-rule-strong bg-card px-2 py-1.5 text-sm';

function Section({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <section className="page space-y-3 rounded-md p-4">
      <div>
        <h2 className="font-display text-lg font-bold">{title}</h2>
        {note && <p className="text-sm text-ink-soft">{note}</p>}
      </div>
      {children}
    </section>
  );
}

/** Find a card by name, franchise or id. */
function useSearch(q: string) {
  return useMemo(() => {
    const t = q.trim().toLowerCase();
    if (t.length < 2) return [];
    return COLLECTIBLE.filter((c) => c.name.toLowerCase().includes(t) || c.franchise.toLowerCase().includes(t) || c.id.includes(t)).slice(0, 30);
  }, [q]);
}

const label = (slot: string) => {
  if (!slot) return 'As usual';
  if ((RARITIES as string[]).includes(slot)) return `Any ${RARITY_INFO[slot as Rarity].name}`;
  const c = COLLECTIBLE.find((x) => x.id === slot);
  return c ? `${c.name} (${RARITY_INFO[c.rarity].name})` : slot;
};

export default function TestLab() {
  // ── The next packs ──
  const [draw, setDrawRaw] = useState<string[]>(() => {
    try {
      const v: unknown = JSON.parse(ls.get(FORCE_DRAW) ?? '[]');
      return Array.from({ length: PACK_SIZE }, (_, i) => (Array.isArray(v) && typeof v[i] === 'string' ? (v[i] as string) : ''));
    } catch {
      return Array(PACK_SIZE).fill('');
    }
  });
  const setDraw = (next: string[]) => (setDrawRaw(next), ls.set(FORCE_DRAW, next.some(Boolean) ? JSON.stringify(next) : null));
  const setSlot = (i: number, v: string) => setDraw(draw.map((s, k) => (k === i ? v : s)));
  const [once, setOnce] = useSwitch(FORCE_DRAW_ONCE);
  const [cosmic, setCosmic] = useSwitch('omnidle-force-cosmic');
  const [hole, setHole] = useSwitch('omnidle-force-anomaly');
  const [sky, setSky] = useSwitch('omnidle-force-sky');
  const [golden, setGolden] = useSwitch('omnidle-force-golden');
  const [flyby, setFlyby] = useSwitch('omnidle-force-flyby');
  const [bloom, setBloom] = useSwitch('omnidle-force-bloom');
  const clearRig = () => (setDraw(Array(PACK_SIZE).fill('')), setOnce(''), setCosmic(''), setHole(''), setSky(''), setGolden(''), setFlyby(''), setBloom(''));

  // ── A card: found, previewed, given ──
  const [q, setQ] = useState('');
  const found = useSearch(q);
  const [picked, setPicked] = useState<Card | null>(null);
  const [grade, setGrade] = useState(1);
  const [element, setElement] = useState<ElementId>(ELEMENT_IDS[0]);
  const [anomaly, setAnomaly] = useState<AnomalyId | ''>('');

  const coins = useProgress((s) => s.coins);
  const owned = useProgress((s) => s.cards);
  const frames = useProgress((s) => s.frames ?? []);
  const cosmetics = useProgress((s) => s.cosmetics ?? []);
  const feats = useFeats();
  const [msg, setMsg] = useState('');
  const say = (t: string) => setMsg(`${new Date().toLocaleTimeString()} · ${t}`);

  const give = (c: Card, copies = 1) => {
    useProgress.setState((s) => ({ cards: { ...s.cards, [c.id]: (s.cards[c.id] ?? 0) + copies } }));
    say(`Gave ${copies} × ${c.name}.`);
  };
  const giveLook = (c: Card) => {
    useProgress.setState((s) => ({
      cards: { ...s.cards, [c.id]: Math.max(1, s.cards[c.id] ?? 0) },
      grades: { ...s.grades, [c.id]: grade },
      elements: grade >= ELEMENT_GRADE ? { ...s.elements, [c.id]: element } : s.elements,
      anomalies: (() => {
        const a = { ...s.anomalies };
        if (anomaly) a[c.id] = anomaly;
        else delete a[c.id];
        return a;
      })(),
    }));
    say(`${c.name} is now yours at ${GRADES[grade]?.name ?? `grade ${grade}`}${anomaly ? `, ${ANOMALIES[anomaly].name}` : ''}.`);
  };

  // ── The snapshot ──
  const [snap, setSnap] = useState(() => ls.get(`${SNAPSHOT}-at`));
  const takeSnapshot = () => {
    const save = ls.get(SAVE);
    if (!save) return say('No save to keep yet.');
    ls.set(SNAPSHOT, save);
    const at = new Date().toLocaleString();
    ls.set(`${SNAPSHOT}-at`, at);
    setSnap(at);
    say('Snapshot taken.');
  };
  const restore = () => {
    const save = ls.get(SNAPSHOT);
    if (!save || !confirm('Put the save back as it was at the snapshot? Everything since is lost.')) return;
    ls.set(SAVE, save);
    location.reload();
  };

  const allFeats = ls.get(DEV_ALL_FEATS) === '1';

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="font-display text-2xl font-bold">
          🧪 Test lab <span className="rounded bg-coral px-1.5 py-0.5 align-middle text-xs font-bold text-on-strong">DEV ONLY</span>
        </h1>
        <Link to="/admin" className="text-sm font-semibold text-accent">
          ← Admin
        </Link>
      </header>
      {msg && (
        <p role="status" className="sticky top-16 z-10 rounded-md bg-hit/15 px-3 py-2 text-sm">
          {msg}
        </p>
      )}

      <Section title="Save snapshot" note="Take one before testing; restore it once done. Tests change this browser's save (and the account's, if signed in).">
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className={btn} onClick={takeSnapshot}>
            📸 Take snapshot
          </button>
          <button type="button" className={btn} disabled={!snap} onClick={restore}>
            ↩ Restore snapshot
          </button>
          <span className="text-sm text-ink-faint">{snap ? `Last: ${snap}` : 'No snapshot yet.'}</span>
        </div>
      </Section>

      <Section title="Rig the next packs" note="Applies to every pack bought in the Card Shop until cleared (or to the next purchase only). Cards drawn are added to the save like real ones.">
        <div className="grid gap-2 sm:grid-cols-5">
          {draw.map((slot, i) => (
            <label key={i} className="space-y-1 text-sm">
              <span className="block text-xs uppercase tracking-widest text-ink-faint">Card {i + 1}</span>
              <select value={(RARITIES as string[]).includes(slot) || !slot ? slot : 'card'} onChange={(e) => setSlot(i, e.target.value === 'card' ? slot : e.target.value)} className={`${field} w-full`}>
                <option value="">As usual</option>
                {RARITIES.map((r) => (
                  <option key={r} value={r}>
                    {RARITY_INFO[r].gem} {RARITY_INFO[r].name}
                  </option>
                ))}
                {slot && !(RARITIES as string[]).includes(slot) && <option value="card">{label(slot)}</option>}
              </select>
            </label>
          ))}
        </div>
        <p className="text-xs text-ink-faint">A specific card: find it below and press its slot number. The pack shows its cards rarest last.</p>
        <div className="grid gap-2 sm:grid-cols-3">
          <label className="space-y-1 text-sm">
            <span className="block text-xs uppercase tracking-widest text-ink-faint">Cosmic event</span>
            <select value={cosmic} onChange={(e) => setCosmic(e.target.value)} className={`${field} w-full`}>
              <option value="">By chance</option>
              {COSMIC_KINDS.map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1 text-sm">
            <span className="block text-xs uppercase tracking-widest text-ink-faint">Black hole</span>
            <select value={hole} onChange={(e) => setHole(e.target.value)} className={`${field} w-full`}>
              <option value="">By chance</option>
              <option value="1">Every pack (random anomaly)</option>
              {ANOMALY_IDS.map((a) => (
                <option key={a} value={a}>
                  Every pack: {ANOMALIES[a].name}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1 text-sm">
            <span className="block text-xs uppercase tracking-widest text-ink-faint">Sky moment</span>
            <select value={sky} onChange={(e) => setSky(e.target.value)} className={`${field} w-full`}>
              <option value="">By chance</option>
              {SKY_MOMENTS.map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="flex flex-wrap items-center gap-4 text-sm">
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={golden === '1'} onChange={(e) => setGolden(e.target.checked ? '1' : '')} /> Golden pack every time
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={flyby === '1'} onChange={(e) => setFlyby(e.target.checked ? '1' : '')} /> Fly-by every time
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={bloom === '1'} onChange={(e) => setBloom(e.target.checked ? '1' : '')} /> Late bloom on every Legendary and Mythic
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={once === '1'} onChange={(e) => setOnce(e.target.checked ? '1' : '')} /> Rigged cards for the next purchase only
          </label>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to="/shop" className={`${btn} bg-accent text-on-strong`}>
            Open packs in the Card Shop →
          </Link>
          <button type="button" className={btn} onClick={clearRig}>
            Clear everything rigged
          </button>
        </div>
      </Section>

      <Section title="Cards" note="Find a card: put it in a pack slot, give it, or try it at any grade, element and anomaly.">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name, franchise or id…" className={`${field} w-full`} />
        {found.length > 0 && (
          <ul className="max-h-72 divide-y divide-rule overflow-y-auto rounded-md border border-rule">
            {found.map((c) => (
              <li key={c.id} className={`flex flex-wrap items-center gap-2 px-2 py-1.5 text-sm ${picked?.id === c.id ? 'bg-tile' : ''}`}>
                <button type="button" className="mr-auto min-w-0 truncate text-left" onClick={() => setPicked(c)} title="Preview">
                  {RARITY_INFO[c.rarity].gem} <b>{c.name}</b> <span className="text-ink-faint">· {c.franchise} · {c.id}</span>
                  {owned[c.id] ? <span className="ml-1 text-xs text-hit">×{owned[c.id]}</span> : null}
                </button>
                {draw.map((_, i) => (
                  <button key={i} type="button" className="rounded border border-rule px-1.5 text-xs font-bold hover:bg-tile" title={`Card ${i + 1} of the next packs`} onClick={() => (setSlot(i, c.id), say(`${c.name} in slot ${i + 1}.`))}>
                    {i + 1}
                  </button>
                ))}
                <button type="button" className="rounded border border-rule px-2 text-xs font-bold hover:bg-tile" onClick={() => give(c)}>
                  Give
                </button>
              </li>
            ))}
          </ul>
        )}
        {picked && (
          <div className="grid gap-4 sm:grid-cols-[14rem_1fr]">
            <div className="w-56 max-w-full">
              <CardFace card={picked} grade={grade} element={element} anomaly={anomaly || null} animate hoverHero />
            </div>
            <div className="space-y-2 text-sm">
              <p className="font-display text-lg font-bold">{picked.name}</p>
              <label className="flex items-center gap-2">
                Grade
                <select value={grade} onChange={(e) => setGrade(Number(e.target.value))} className={field}>
                  {Array.from({ length: MAX_GRADE }, (_, k) => k + 1).map((g) => (
                    <option key={g} value={g}>
                      {g} · {GRADES[g]?.name}
                    </option>
                  ))}
                </select>
              </label>
              {grade >= ELEMENT_GRADE && (
                <label className="flex items-center gap-2">
                  Element
                  <select value={element} onChange={(e) => setElement(e.target.value as ElementId)} className={field}>
                    {ELEMENT_IDS.map((el) => (
                      <option key={el} value={el}>
                        {ELEMENTS[el].name}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <label className="flex items-center gap-2">
                Anomaly
                <select value={anomaly} onChange={(e) => setAnomaly(e.target.value as AnomalyId | '')} className={field}>
                  <option value="">None</option>
                  {ANOMALY_IDS.map((a) => (
                    <option key={a} value={a}>
                      {ANOMALIES[a].name}
                    </option>
                  ))}
                </select>
              </label>
              <div className="flex flex-wrap gap-2 pt-1">
                <button type="button" className={btn} onClick={() => giveLook(picked)}>
                  Make mine like this
                </button>
                <button type="button" className={btn} onClick={() => give(picked, 5)}>
                  Give 5 copies
                </button>
              </div>
            </div>
          </div>
        )}
      </Section>

      <Section title="Coins, frames and cosmetics">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold">{coins.toLocaleString('en')} DleCoins</span>
          {[1000, 10000, 100000].map((n) => (
            <button key={n} type="button" className={btn} onClick={() => (useProgress.setState((s) => ({ coins: s.coins + n })), say(`+${n.toLocaleString('en')} DleCoins.`))}>
              +{n.toLocaleString('en')}
            </button>
          ))}
          <button type="button" className={btn} onClick={() => (useProgress.setState({ coins: 0 }), say('Coins set to 0.'))}>
            Set to 0
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm">
            Frames {frames.length}/{FRAMES.length} · Cosmetics {cosmetics.length}/{NAME_STYLES.length + WRAPPERS.length + TITLE_ITEMS.length}
          </span>
          <button type="button" className={btn} onClick={() => (useProgress.setState({ frames: FRAMES.map((f) => f.id) }), say('Every capsule frame (seasonal ones too) is yours.'))}>
            Give every frame
          </button>
          <button type="button" className={btn} onClick={() => (useProgress.setState({ cosmetics: [...NAME_STYLES, ...WRAPPERS, ...TITLE_ITEMS].map((c) => c.id) }), say('Every name style, wrapper and Boutique title is yours.'))}>
            Give every cosmetic
          </button>
          <button type="button" className={btn} onClick={() => (useProgress.setState({ frames: [], frame: null, cosmetics: [], nameStyle: null, wrapper: null, title: null }), say('Frames and cosmetics taken back.'))}>
            Take them all back
          </button>
        </div>
        <p className="text-xs text-ink-faint">
          Try them on in <Link to="/casino" className="text-accent">the Casino</Link> (Capsules → collection, Boutique) and on <Link to="/account" className="text-accent">your Account</Link>.
        </p>
      </Section>

      <Section title="Titles and earned frames" note="Counts every feat as done (streaks, sets, bosses, Mythic and Omni): every title and trophy frame unlocks. Nothing is written to the save; switching it off locks them again.">
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className={btn} onClick={() => (ls.set(DEV_ALL_FEATS, allFeats ? null : '1'), location.reload())}>
            {allFeats ? '🔓 Everything unlocked — lock again' : '🔒 Unlock every title and trophy'}
          </button>
          <span className="text-sm text-ink-faint">
            {TITLES.filter((t) => t.has(feats)).length}/{TITLES.length} titles earned now
          </span>
        </div>
      </Section>
    </div>
  );
}
