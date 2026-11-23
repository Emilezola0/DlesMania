// Genesis's ritual, set by set (src/gacha/genesis.ts): where each one stands, the offering, the forging — and the
// moment a Genesis is born: the page falls silent and goes white, the card's lines are drawn, then its colours laid in.
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { CardFace, CardMissing } from './CardView';
import { GENESIS_CARDS, RARITY_INFO, SETS, type Card } from './cards';
import { canForge, canOffer, earliestDawn, GENESIS_DAWNS, GENESIS_REWARD, GENESIS_SHARDS, genesisStatus, type GenesisStatus, type GenesisStep } from './genesis';
import { useCloud } from '../cloud/state';
import { formatLong as formatDay, ROUNDS_PER_DAY } from '../lib/date';
import { shownName } from '../lib/french';
import { tr, useT } from '../lib/i18n';
import { sfx } from '../lib/sfx';
import { useProgress } from '../store/progress';

const ORDER: GenesisStep[] = ['set', 'awake', 'offering', 'dawns', 'trial', 'forge', 'forged'];

/** One step of the ritual: done, the one under way, or still ahead. */
function Step({ n, at, step, title, children }: { n: number; at: GenesisStep; step: GenesisStep; title: string; children?: React.ReactNode }) {
  const done = ORDER.indexOf(at) > ORDER.indexOf(step);
  const now = at === step;
  return (
    <li className={`flex gap-2 rounded-md px-2 py-1 ${now ? 'bg-[#7ef0e0]/15 ring-1 ring-[#7ef0e0]/60' : ''}`}>
      <span className={`mt-0.5 grid size-5 shrink-0 place-items-center rounded-full text-xs font-bold ${done ? 'bg-[#2dd4bf] text-white' : now ? 'border-2 border-[#2dd4bf] text-[#0f766e]' : 'border border-rule-strong text-ink-faint'}`}>{done ? '✓' : n}</span>
      <div className={`min-w-0 text-sm ${done ? 'text-ink-soft' : now ? '' : 'text-ink-faint'}`}>
        <p className="font-semibold">{title}</p>
        {now && children}
      </div>
    </li>
  );
}

function Bar({ value, max }: { value: number; max: number }) {
  return (
    <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-rule">
      <div className="h-full rounded-full bg-gradient-to-r from-[#2dd4bf] via-[#e879f9] to-[#f6c453] transition-[width] duration-700" style={{ width: `${(100 * Math.min(value, max)) / max}%` }} />
    </div>
  );
}

/** One set's ritual: its Genesis card (or its blank page) and the steps. */
function Rite({ g, onForged }: { g: GenesisStatus; onForged: (c: Card) => void }) {
  const t = useT();
  const begin = useProgress((s) => s.beginGenesis);
  const forge = useProgress((s) => s.forgeGenesis);
  const signedIn = useCloud((s) => s.name ?? s.email?.split('@')[0] ?? undefined);
  const [sure, setSure] = useState(false);
  const guardian = SETS.find((s) => s.id === g.card.set)?.guardian.name ?? '';
  const offer = () => {
    if (!sure) return void (sfx.select(), setSure(true));
    setSure(false);
    if (!g.omni || !begin(g.card.set, g.omni.id, canOffer(g))) return void sfx.wrong();
    sfx.crystal();
  };
  const make = () => {
    if (!forge(g.card.set, g.card.id, canForge(g), signedIn)) return void sfx.wrong();
    onForged(g.card);
  };
  const s = g.step;
  return (
    <section className="rarity-entry page flex flex-col gap-4 rounded-lg p-4 sm:flex-row sm:p-5" style={{ ['--entry' as string]: '#7ef0e0' }}>
      <div className="mx-auto w-[150px] shrink-0 sm:mx-0">{s === 'forged' ? <CardFace card={g.card} count={1} /> : <CardMissing card={g.card} />}</div>
      <div className="min-w-0 flex-1 space-y-2">
        <h3 className="font-display text-xl font-bold">
          {g.card.franchise} <span className="text-ink-soft">· {s === 'forged' ? shownName(g.card.name, g.card.set) : '???'}</span>
        </h3>
        {s === 'forged' ? (
          <p className="text-sm">
            ✺ {t('Forged', 'Forgée')}
            {g.rite?.forged ? ` · ${formatDay(g.rite.forged)}` : ''}
            {g.rite?.by ? ` · ${g.rite.by}` : ''}
          </p>
        ) : (
          <ol className="space-y-1">
            <Step n={1} at={s} step="set" title={t('Collect the whole set', 'Compléter toute la série')}>
              <p className="text-ink-soft">{t(`${g.missing} card${g.missing === 1 ? '' : 's'} still missing.`, `Encore ${g.missing} carte${g.missing === 1 ? '' : 's'} à trouver.`)}</p>
            </Step>
            <Step n={2} at={s} step="awake" title={t(`Beat ${guardian} on Hard`, `Battre ${guardian} en Difficile`)}>
              <Link to={`/boss/${g.card.set}`} className="font-semibold text-accent hover:underline">
                {t('To the boss →', 'Vers le boss →')}
              </Link>
            </Step>
            <Step n={3} at={s} step="offering" title={t(`The offering: a spare Omni and ${GENESIS_SHARDS} star shards`, `L’offrande : un Omni en double et ${GENESIS_SHARDS} éclats d’étoile`)}>
              <p className="text-ink-soft">
                {g.omni ? t(`A spare ${shownName(g.omni.name, g.omni.set)} will be given.`, `Un double de ${shownName(g.omni.name, g.omni.set)} sera donné.`) : t('No Omni of this set in double yet.', 'Pas encore d’Omni de cette série en double.')}{' '}
                {t(`Star shards: ${g.shards}/${GENESIS_SHARDS}.`, `Éclats d’étoile : ${g.shards}/${GENESIS_SHARDS}.`)}
              </p>
              <button
                type="button"
                onClick={offer}
                disabled={!canOffer(g)}
                className={`mt-1 rounded-full border-2 px-3 py-1 text-sm font-bold transition ${canOffer(g) ? (sure ? 'border-ink bg-ink text-paper' : 'border-[#2dd4bf] text-[#0f766e] hover:bg-[#7ef0e0]/20') : 'border-dashed border-rule-strong text-ink-faint'}`}
              >
                ✺ {sure ? t('Confirm the offering (for good)', 'Confirmer l’offrande (pour de bon)') : t('Make the offering', 'Faire l’offrande')}
              </button>
            </Step>
            <Step n={4} at={s} step="dawns" title={t(`${GENESIS_DAWNS} dawns: dailies completed`, `${GENESIS_DAWNS} aurores : défis du jour terminés`)}>
              <p className="text-ink-soft">
                {t(`Complete the ${g.card.domain === 'cinema' ? 'Movies' : g.card.domain === 'anime' ? 'Anime' : 'Video Games'} daily on ${GENESIS_DAWNS} days, from the offering on: ${g.dawns}/${GENESIS_DAWNS}.`, `Termine le défi du jour ${g.card.domain === 'cinema' ? 'Films' : g.card.domain === 'anime' ? 'Anime' : 'Jeux vidéo'} ${GENESIS_DAWNS} jours, depuis l’offrande : ${g.dawns}/${GENESIS_DAWNS}.`)}
                {g.rite && ` ${t('At the earliest:', 'Au plus tôt :')} ${formatDay(earliestDawn(g.rite.begun))}.`}
              </p>
              <Bar value={g.dawns} max={GENESIS_DAWNS} />
            </Step>
            <Step n={5} at={s} step="trial" title={t(`The trial: ${guardian} on Hell, without losing a heart`, `L’épreuve : ${guardian} en Enfer, sans perdre un cœur`)}>
              <Link to={`/boss/${g.card.set}`} className="font-semibold text-accent hover:underline">
                {t('To the boss →', 'Vers le boss →')}
              </Link>
            </Step>
            <Step n={6} at={s} step="forge" title={t('The forging', 'La forge')}>
              {!g.setComplete && <p className="text-coral">{t('The set must be whole again.', 'La série doit être de nouveau complète.')}</p>}
              <button
                type="button"
                onClick={make}
                disabled={!canForge(g)}
                className="genesis-forge-button mt-1 rounded-full px-4 py-1.5 font-display text-sm font-bold disabled:opacity-50"
              >
                ✺ {t(`Forge it · +${GENESIS_REWARD.toLocaleString('en')} DleCoins`, `La forger · +${GENESIS_REWARD.toLocaleString('fr')} DleCoins`)}
              </button>
            </Step>
          </ol>
        )}
      </div>
    </section>
  );
}

/** Every set's Genesis ritual. */
export function GenesisRituals() {
  const t = useT();
  const save = useProgress((s) => s);
  const [born, setBorn] = useState<Card | null>(null);
  const all = GENESIS_CARDS.map((c) => genesisStatus(save, c.set, ROUNDS_PER_DAY)).filter((g): g is GenesisStatus => !!g);
  return (
    <div className="space-y-4">
      {all.map((g) => (
        <Rite key={g.card.id} g={g} onForged={setBorn} />
      ))}
      <p className="text-xs text-ink-faint">{t(`${GENESIS_CARDS.length} franchises have a Genesis so far; more will follow.`, `${GENESIS_CARDS.length} franchises ont une Genèse pour l’instant ; d’autres suivront.`)}</p>
      {born && <GenesisBirth card={born} onDone={() => setBorn(null)} />}
    </div>
  );
}

/**
 * A Genesis being born, full screen: silence, the page goes white, the card's lines are drawn and its colours laid
 * in, then its name and a chord of light. A tap (or Escape) closes it once it's whole.
 */
export function GenesisBirth({ card, onDone }: { card: Card; onDone: () => void }) {
  const [phase, setPhase] = useState<'white' | 'card' | 'name'>('white');
  useEffect(() => {
    const a = window.setTimeout(() => setPhase('card'), 1400);
    const b = window.setTimeout(() => (setPhase('name'), sfx.genesis()), 4200);
    return () => (window.clearTimeout(a), window.clearTimeout(b));
  }, []);
  useEffect(() => {
    const key = (e: KeyboardEvent) => e.key === 'Escape' && phase === 'name' && onDone();
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [phase, onDone]);
  return createPortal(
    <div className="genesis-birth fixed inset-0 z-[90] grid place-items-center overflow-hidden" onClick={() => phase === 'name' && onDone()} role="dialog" aria-label={tr(`${card.name}, Genesis`, `${card.name}, Genèse`)}>
      <div className="genesis-birth-rays pointer-events-none absolute inset-0" aria-hidden />
      <div className="relative flex flex-col items-center gap-5 px-4">
        {phase !== 'white' && (
          <div className="genesis-birth-card w-[min(72vw,calc(62vh*5/7),340px)]">
            <CardFace card={card} count={1} tilt={false} animate depth={false} cssLight />
          </div>
        )}
        {phase === 'name' && (
          <div className="genesis-birth-name text-center">
            <p className="font-display text-sm font-bold tracking-[0.5em] text-[#0f766e]">✺ {RARITY_INFO.genesis.name.toUpperCase()} ✺</p>
            <p className="card-genesis-name font-display text-4xl font-black">{shownName(card.name, card.set)}</p>
            <p className="text-sm italic text-[#4c3d6b]">{card.title}</p>
            <p className="mt-3 text-xs text-[#6b5b8a]">{tr('Tap to close', 'Touche pour fermer')}</p>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
