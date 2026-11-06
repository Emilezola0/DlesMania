import { useEffect, useRef, useState } from 'react';
import { useCloud } from '../cloud/state';
import { todayKey } from '../lib/date';
import { BIRTHDAY_COINS, daysIn, dueRewards, type Birthday, type DueReward } from '../lib/rewards';
import { useProgress } from '../store/progress';
import { DleCoin } from './DleCoin';

type Lang = 'en' | 'fr';
type Api = {
  getBirthday: () => Promise<Birthday | null>;
  setBirthday: (b: Birthday) => Promise<Birthday>;
  claimDue: (b: Birthday | null) => Promise<DueReward[]>;
};

const monthName = (m: number, lang: Lang) => new Date(2000, m - 1, 1).toLocaleDateString(lang, { month: 'long' });
/** "14 March" / "14 mars". */
export const birthdayLabel = (b: Birthday, lang: Lang) => `${b.day} ${monthName(b.month, lang)}`;

const LATER_KEY = 'omnidle:birthday:later';
const CLAIM_AGAIN_MS = 10 * 60_000;
const stored = {
  get: (k: string) => {
    try {
      return localStorage.getItem(k);
    } catch {
      return null;
    }
  },
  set: (k: string, v: string) => {
    try {
      localStorage.setItem(k, v);
    } catch {
      // Not remembered: asked again next time.
    }
  },
};

/**
 * Dev only (never in the built site): #/?birthday-demo shows the birthday question and the gifts
 * without an account or the database. Nothing is written and no coins are added.
 */
const DEMO = import.meta.env.DEV && typeof window !== 'undefined' && window.location.href.includes('birthday-demo');
const demoClaimed = new Set<string>();
const demoApi: Api = {
  getBirthday: async () => null,
  setBirthday: async (b) => b,
  claimDue: async (b) => dueRewards(b, todayKey()).filter((r) => !demoClaimed.has(r.id) && !!demoClaimed.add(r.id)),
};

/**
 * Signed-in players are asked their birthday once (it can't be changed afterwards); then, on their
 * birthday every year, and on Omnidle's special dates, a gift of DleCoins — each paid once, checked
 * by the database (src/cloud/rewards.ts).
 */
export function BirthdayReward() {
  const email = useCloud((c) => c.email);
  const status = useCloud((c) => c.status);
  const birthday = useCloud((c) => c.birthday);
  const ask = useCloud((c) => c.askBirthday);
  const lang: Lang = useProgress((s) => s.nameLang) === 'fr' ? 'fr' : 'en';
  const [gifts, setGifts] = useState<DueReward[]>([]);
  const lastClaim = useRef(0);
  const ready = DEMO || (!!email && status === 'synced');

  const api = (): Promise<Api> => (DEMO ? Promise.resolve(demoApi) : import('../cloud/rewards'));
  const claim = async (b: Birthday | null) => {
    lastClaim.current = Date.now();
    const paid = await (await api()).claimDue(b).catch(() => []);
    if (paid.length) setGifts((g) => [...g, ...paid.filter((p) => !g.some((x) => x.id === p.id))]);
  };

  // Once signed in (and the save in step, so the coins land on the latest save): the birthday, then the gifts.
  useEffect(() => {
    if (!ready || birthday !== undefined) return;
    let live = true;
    void api()
      .then((a) => a.getBirthday())
      .then((b) => {
        if (!live) return;
        useCloud.setState({ birthday: b, askBirthday: b === null && (DEMO || stored.get(LATER_KEY) !== todayKey()) });
        return claim(b);
      })
      .catch(() => {
        // No connection, or the database rules aren't deployed yet: nothing asked, nothing paid.
      });
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, birthday, email]);

  // Coming back to the page later (a new day, say): what's open now.
  useEffect(() => {
    if (!ready || birthday === undefined) return;
    const onVisible = () => {
      if (document.visibilityState === 'visible' && Date.now() - lastClaim.current > CLAIM_AGAIN_MS) void claim(useCloud.getState().birthday ?? null);
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, birthday]);

  const save = async (b: Birthday) => {
    const set = await (await api()).setBirthday(b);
    useCloud.setState({ birthday: set, askBirthday: false });
    await claim(set);
  };

  return (
    <>
      {ask && ready && birthday === null && (
        <BirthdayQuestion
          lang={lang}
          onSave={save}
          onLater={() => {
            stored.set(LATER_KEY, todayKey());
            useCloud.setState({ askBirthday: false });
          }}
        />
      )}
      {gifts.length > 0 && <Gifts gifts={gifts} lang={lang} onClose={() => setGifts([])} />}
    </>
  );
}

function BirthdayQuestion({ lang, onSave, onLater }: { lang: Lang; onSave: (b: Birthday) => Promise<void>; onLater: () => void }) {
  const fr = lang === 'fr';
  const [month, setMonth] = useState(0);
  const [day, setDay] = useState(0);
  const [sure, setSure] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const picked = month > 0 && day > 0 && day <= daysIn(month);
  const field = 'rounded-md border border-rule-strong bg-card px-3 py-2.5 outline-none focus:border-accent';

  const confirm = async () => {
    setBusy(true);
    setError(null);
    try {
      await onSave({ month, day });
    } catch {
      setError(fr ? "L'enregistrement a échoué : vérifie ta connexion et réessaie." : "Couldn't save it: check your connection and try again.");
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-ink/40 p-3 backdrop-blur-sm sm:p-6" role="dialog" aria-modal aria-labelledby="birthday-title">
      <div className="page animate-pop w-full max-w-md space-y-4 rounded-md p-5 shadow-2xl">
        <div className="text-center">
          <p className="text-4xl" aria-hidden>
            🎂
          </p>
          <h2 id="birthday-title" className="font-display text-2xl font-bold">
            {fr ? "C'est quand, ton anniversaire ?" : "When's your birthday?"}
          </h2>
          <p className="mt-1 flex flex-wrap items-center justify-center gap-1 text-sm text-ink-soft">
            {fr ? 'Chaque année, ce jour-là :' : 'Every year on that day:'}
            <b className="inline-flex items-center gap-1 text-ink">
              {BIRTHDAY_COINS.toLocaleString(lang)} <DleCoin className="size-4" /> DleCoins
            </b>
            {fr ? 'offerts.' : 'as a gift.'}
          </p>
        </div>

        {!sure ? (
          <>
            <div className="grid grid-cols-[5rem_1fr] gap-2">
              <select aria-label={fr ? 'Jour' : 'Day'} value={day} onChange={(e) => setDay(Number(e.target.value))} className={field}>
                <option value={0}>{fr ? 'Jour' : 'Day'}</option>
                {Array.from({ length: month ? daysIn(month) : 31 }, (_, i) => (
                  <option key={i + 1} value={i + 1}>
                    {i + 1}
                  </option>
                ))}
              </select>
              <select
                aria-label={fr ? 'Mois' : 'Month'}
                value={month}
                onChange={(e) => {
                  const m = Number(e.target.value);
                  setMonth(m);
                  if (m && day > daysIn(m)) setDay(0);
                }}
                className={field}
              >
                <option value={0}>{fr ? 'Mois' : 'Month'}</option>
                {Array.from({ length: 12 }, (_, i) => (
                  <option key={i + 1} value={i + 1}>
                    {monthName(i + 1, lang)}
                  </option>
                ))}
              </select>
            </div>
            <p className="rounded-md border border-ochre/60 bg-card/70 px-3 py-2 text-sm text-ink-soft">
              <b className="text-ink">{fr ? 'Choisis bien :' : 'Pick carefully:'}</b>{' '}
              {fr ? "la date ne pourra plus être changée ensuite. Si ton anniversaire est déjà passé cette année, le cadeau arrive tout de suite." : "it can't be changed afterwards. If your birthday has already passed this year, the gift comes right away."}
            </p>
            <div className="flex flex-wrap justify-end gap-2">
              <button type="button" onClick={onLater} className="btn-paper rounded-md px-4 py-2 font-semibold">
                {fr ? 'Plus tard' : 'Later'}
              </button>
              <button type="button" disabled={!picked} onClick={() => setSure(true)} className="btn-accent rounded-md px-4 py-2 font-semibold disabled:opacity-50">
                {fr ? 'Valider' : 'Continue'}
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="text-center text-lg">
              {fr ? 'Ton anniversaire est le' : 'Your birthday is'} <b className="font-display">{birthdayLabel({ month, day }, lang)}</b> ?
            </p>
            <p className="text-center text-sm text-ink-soft">{fr ? 'Une fois enregistrée, la date est définitive.' : 'Once saved, the date is for good.'}</p>
            {error && <p className="text-center text-sm text-coral">{error}</p>}
            <div className="flex flex-wrap justify-end gap-2">
              <button type="button" disabled={busy} onClick={() => setSure(false)} className="btn-paper rounded-md px-4 py-2 font-semibold">
                {fr ? 'Retour' : 'Back'}
              </button>
              <button type="button" disabled={busy} onClick={confirm} className="btn-accent rounded-md px-4 py-2 font-semibold disabled:opacity-50">
                {busy ? '…' : fr ? "Oui, c'est ça" : "Yes, that's it"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Gifts({ gifts, lang, onClose }: { gifts: DueReward[]; lang: Lang; onClose: () => void }) {
  const fr = lang === 'fr';
  return (
    <div role="status" className="animate-pop fixed inset-x-3 bottom-3 z-40 max-sm:bottom-16 mx-auto flex max-w-md flex-col gap-2 rounded-md border border-ochre bg-card px-4 py-3 shadow-2xl">
      {gifts.map((g) => (
        <div key={g.id} className="flex items-center gap-3">
          <span className="grid size-8 shrink-0 place-items-center rounded-full bg-ochre text-base" aria-hidden>
            {g.date?.emoji ?? (g.daily ? '🎁' : '🎂')}
          </span>
          <p className="min-w-0 flex-1 text-sm">
            <b className="inline-flex items-center gap-1 font-display tracking-wider">
              +{g.coins.toLocaleString(lang)} <DleCoin className="size-4" /> DleCoins
            </b>
            <span className="block text-ink-soft">
              {g.date
                ? fr
                  ? `Un cadeau pour ${g.date.name.fr} !`
                  : `A gift for ${g.date.name.en}!`
                : g.daily
                  ? fr
                    ? 'Ton cadeau du jour, à demain !'
                    : 'Your gift for today: see you tomorrow!'
                  : fr
                    ? 'Joyeux anniversaire !'
                    : 'Happy birthday!'}
            </span>
          </p>
        </div>
      ))}
      <button type="button" onClick={onClose} aria-label={fr ? 'Fermer' : 'Close'} className="absolute right-2 top-1 rounded-md p-1 text-lg leading-none text-ink-faint hover:text-ink">
        ×
      </button>
    </div>
  );
}
