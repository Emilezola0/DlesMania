import { useEffect, useRef, useState } from 'react';
import { shownName } from '../lib/french';
import { Link } from 'react-router-dom';
import { NameLangSwitch } from '../components/NameLangSwitch';
import { Spinner } from '../components/Spinner';
import { mergeSaves, pickSave, type SaveData } from '../cloud/merge';
import { CARD_BY_ID, SETS, RARITY_INFO } from '../gacha/cards';
import { THEMES, unlockedThemes } from '../gacha/Theme';
import { CardAvatar } from '../gacha/Perks';
import { RotationSettings } from '../gacha/RotationSettings';
import { AvatarFrame } from '../casino/Frame';
import { FRAME_BY_ID } from '../casino/frames';
import { COSMETIC_BY_ID, NAME_STYLES } from '../casino/cosmetics';
import { TITLES, TITLE_BY_ID, useFeats } from '../casino/unlocks';
import { useShownName } from '../casino/Boutique';
import { PrizeArt } from '../casino/Claw';
import { bestPlush, PLUSH_BY_ID, PLUSH_RARITY, PLUSHIES } from '../casino/plushies';
import { startCloud, useCloud } from '../cloud/state';
import { birthdayLabel } from '../components/BirthdayReward';
import { BIRTHDAY_COINS } from '../lib/rewards';
import { DevCode } from '../components/DevCode';
import { todayKey } from '../lib/date';
import { sfx } from '../lib/sfx';
import { useProgress } from '../store/progress';

const STATUS: Record<string, string> = {
  off: 'Not connected',
  loading: 'Connecting…',
  signedOut: 'Not signed in',
  syncing: 'Saving…',
  synced: 'Saved to your account',
  offline: 'Offline — saved here, sent when back online',
  error: 'Not saved to your account',
};

/** Export and import: the whole save as a file, account or not. */
function Backup() {
  const file = useRef<HTMLInputElement>(null);
  const [note, setNote] = useState<string | null>(null);
  const exportSave = () => {
    const blob = new Blob([JSON.stringify({ omnidle: 1, exported: new Date().toISOString(), save: pickSave(useProgress.getState()) }, null, 1)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `omnidle-save-${todayKey()}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    sfx.click();
    setNote('Save downloaded.');
  };
  const importSave = async (f: File | undefined) => {
    if (!f) return;
    try {
      const parsed = JSON.parse(await f.text());
      const save = parsed?.save as SaveData | undefined;
      if (!parsed?.omnidle || !save || typeof save !== 'object') throw new Error('not a save');
      if (!window.confirm('Add this save to your progress? Days, bests and cards are combined; the coin balance and the Expedition run come from the file.')) return;
      useProgress.setState(mergeSaves(pickSave(useProgress.getState()), save, { firstLink: false, cloudNewer: true }));
      sfx.streak();
      setNote('Save imported.');
    } catch {
      sfx.wrong();
      setNote("That file isn't an Omnidle save.");
    } finally {
      if (file.current) file.current.value = '';
    }
  };
  return (
    <section className="page space-y-3 rounded-md p-5">
      <h2 className="font-display text-lg font-bold">Backup</h2>
      <p className="text-sm text-ink-soft">Your whole save as a file — to keep, or to bring to another browser without an account.</p>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={exportSave} className="btn-paper rounded-md px-4 py-2 font-semibold">
          ⬇ Export save
        </button>
        <button type="button" onClick={() => file.current?.click()} className="btn-paper rounded-md px-4 py-2 font-semibold">
          ⬆ Import save
        </button>
        <input ref={file} type="file" accept="application/json,.json" className="hidden" onChange={(e) => importSave(e.target.files?.[0])} />
      </div>
      {note && <p className="text-sm font-semibold">{note}</p>}
    </section>
  );
}

/** The plushies won at the claw machine (Casino → Claw), missing ones as shadows. */
function PlushShelf() {
  const owned = useProgress((s) => s.claw?.plush ?? {});
  const picked = useProgress((s) => s.shownPlush ?? null);
  const setShown = useProgress((s) => s.setShownPlush);
  const have = PLUSHIES.filter((p) => owned[p.id]).length;
  // The one friends see: the one picked, if still owned, else the best.
  const shown = picked && owned[picked] ? PLUSH_BY_ID.get(picked) : bestPlush(owned);
  return (
    <div className="space-y-2 rounded-md border border-rule-strong bg-card p-4">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="font-display text-lg font-bold">🧸 Plushies</h2>
        <span className="text-sm tabular-nums text-ink-soft">
          {have} / {PLUSHIES.length}
        </span>
      </div>
      <div className="grid grid-cols-5 gap-2 sm:grid-cols-10">
        {PLUSHIES.map((p) =>
          owned[p.id] ? (
            <button
              key={p.id}
              type="button"
              onClick={() => (sfx.select(), setShown(shown?.id === p.id && picked ? null : p.id))}
              aria-pressed={shown?.id === p.id}
              className={`flex flex-col items-center gap-0.5 rounded-md p-0.5 text-center transition hover:bg-tile ${shown?.id === p.id ? 'bg-tile ring-2 ring-accent' : ''}`}
              title={`${p.name} (${PLUSH_RARITY[p.rarity].name}): ${shown?.id === p.id ? 'shown to your friends' : 'show this one to your friends'}`}
            >
              <span className="relative">
                <PrizeArt prize={`plush:${p.id}`} className="size-11" style={{ fontSize: '2.75rem' }} />
                {owned[p.id] > 1 && <span className="absolute -right-1 -top-1 rounded-full bg-ink px-1 text-[10px] font-bold text-paper">×{owned[p.id]}</span>}
                {shown?.id === p.id && <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 rounded-full bg-accent px-1 text-[9px] font-bold text-white">★</span>}
              </span>
              <span className="w-full truncate text-[10px] font-semibold" style={{ color: PLUSH_RARITY[p.rarity].color }}>
                {p.name}
              </span>
            </button>
          ) : (
            <div key={p.id} className="flex flex-col items-center gap-0.5" title="Not won yet">
              <span className="grid size-11 place-items-center rounded-[46%] bg-tile text-lg text-ink-faint">?</span>
              <span className="text-[10px] text-ink-faint">???</span>
            </div>
          ),
        )}
      </div>
      <p className="text-xs text-ink-faint">
        Won at the{' '}
        <Link to="/casino" className="font-semibold text-accent">
          Casino&apos;s claw machine
        </Link>
        .{' '}
        {shown ? (
          <>
            Tap one to show it next to your name for your friends: now <b className="text-ink">{shown.name}</b>
            {picked && owned[picked] ? '' : ' (your best, until you pick one)'}.
          </>
        ) : (
          'The one you pick shows next to your name for your friends.'
        )}
      </p>
    </div>
  );
}

/**
 * The player as others would see them: their icon in its frame, their name in its style, their title under it
 * (titles are earned by playing; name styles are bought in the Casino's Boutique).
 */
function ProfileCard() {
  const avatar = useProgress((s) => (s.avatar && s.cards[s.avatar] ? CARD_BY_ID.get(s.avatar) : undefined));
  const frame = useProgress((s) => s.frame);
  const name = useShownName();
  const nameStyle = useProgress((s) => s.nameStyle);
  const setNameStyle = useProgress((s) => s.setNameStyle);
  const cosmetics = useProgress((s) => s.cosmetics ?? []);
  const title = useProgress((s) => s.title);
  const setTitle = useProgress((s) => s.setTitle);
  const feats = useFeats();
  const earned = TITLES.filter((t) => t.has(feats));
  const picked = TITLE_BY_ID.get(title ?? '');
  const shownTitle = picked && picked.has(feats) ? picked : TITLES[0];
  const styles = NAME_STYLES.filter((c) => cosmetics.includes(c.id));
  return (
    <div className="space-y-3 rounded-md border border-rule-strong bg-card p-4">
      <div className="flex items-center gap-4">
        <AvatarFrame frame={frame}>
          {avatar ? <CardAvatar card={avatar} className="size-16" /> : <span className="block size-16 rounded-full bg-tile" />}
        </AvatarFrame>
        <div className="min-w-0">
          <p className={`truncate font-display text-2xl font-bold ${COSMETIC_BY_ID.get(nameStyle ?? '')?.className ?? ''}`}>{name}</p>
          <p className="text-sm font-semibold tracking-wider text-ink-soft">« {shownTitle.name} »</p>
        </div>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="mb-1 block text-xs uppercase tracking-widest text-ink-faint">
            Title ({earned.length} / {TITLES.length})
          </span>
          <select value={shownTitle.id} onChange={(e) => setTitle(e.target.value)} className="w-full rounded-md border border-rule-strong bg-card px-3 py-2 font-semibold">
            {TITLES.map((t) => (
              <option key={t.id} value={t.id} disabled={!t.has(feats)}>
                {t.has(feats) ? t.name : `🔒 ${t.name} — ${t.how}`}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-xs uppercase tracking-widest text-ink-faint">Name style</span>
          <select value={nameStyle ?? ''} onChange={(e) => setNameStyle(e.target.value || null)} className="w-full rounded-md border border-rule-strong bg-card px-3 py-2 font-semibold">
            <option value="">Plain</option>
            {styles.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <p className="text-xs text-ink-faint">
        Trophy frames and most titles are earned by playing; name styles, pack wrappers and a few titles are in the Casino&apos;s{' '}
        <Link to="/casino" className="font-semibold text-accent">
          Boutique
        </Link>
        .
      </p>
    </div>
  );
}

/** The cards the player shows: their icon and their background, picked in the album. */
function Profile() {
  const avatar = useProgress((s) => (s.avatar && s.cards[s.avatar] ? CARD_BY_ID.get(s.avatar) : undefined));
  const backdrop = useProgress((s) => (s.backdrop && s.cards[s.backdrop] ? CARD_BY_ID.get(s.backdrop) : undefined));
  const setAvatar = useProgress((s) => s.setAvatar);
  const setBackdrop = useProgress((s) => s.setBackdrop);
  const frame = useProgress((s) => (s.frame ? FRAME_BY_ID.get(s.frame) : undefined));
  const setFrame = useProgress((s) => s.setFrame);
  const reactions = useProgress((s) => s.cardReactions ?? true);
  const setReactions = useProgress((s) => s.setCardReactions);
  const aura = useProgress((s) => s.omniAura ?? true);
  const setAura = useProgress((s) => s.setOmniAura);
  const voices = useProgress((s) => s.voiceLines ?? true);
  const setVoices = useProgress((s) => s.setVoiceLines);
  const motion = useProgress((s) => s.cardMotion ?? true);
  const setMotion = useProgress((s) => s.setCardMotion);
  const uiTheme = useProgress((s) => s.uiTheme ?? 'icon');
  const setUiTheme = useProgress((s) => s.setUiTheme);
  const companions = useProgress((s) => s.companions ?? true);
  const setCompanions = useProgress((s) => s.setCompanions);
  const owned = useProgress((s) => s.cards);
  const unlocked = unlockedThemes(owned);
  const row = (label: string, card: typeof avatar, clear: () => void) => (
    <div className="flex items-center gap-3">
      {card ? <CardAvatar card={card} className="size-10" /> : <span className="grid size-10 place-items-center rounded-full border-2 border-dashed border-rule-strong text-ink-faint">?</span>}
      <div className="min-w-0 flex-1">
        <p className="text-xs uppercase tracking-widest text-ink-faint">{label}</p>
        <p className="truncate font-semibold">{card ? `${shownName(card.name, card.set)} · ${RARITY_INFO[card.rarity].name}` : 'None'}</p>
      </div>
      {card && (
        <button type="button" onClick={clear} className="btn-paper rounded-md px-3 py-1 text-sm font-semibold">
          Remove
        </button>
      )}
    </div>
  );
  return (
    <section className="page space-y-3 rounded-md p-5">
      <ProfileCard />
      <PlushShelf />
      <h2 className="font-display text-lg font-bold">Your cards on show</h2>
      {row('Icon', avatar, () => setAvatar(null))}
      {row('Background', backdrop, () => setBackdrop(null))}
      <RotationSettings />
      <div className="flex items-center gap-3">
        <AvatarFrame frame={frame?.id}>
          {avatar ? <CardAvatar card={avatar} className="size-10" /> : <span className="block size-10 rounded-full bg-tile" />}
        </AvatarFrame>
        <div className="min-w-0 flex-1">
          <p className="text-xs uppercase tracking-widest text-ink-faint">Icon frame</p>
          <p className="truncate font-semibold">
            {frame ? frame.name : 'None'} ·{' '}
            <Link to="/casino" className="text-sm font-normal text-ink-soft underline">
              win frames at the Casino
            </Link>
          </p>
        </div>
        {frame && (
          <button type="button" onClick={() => setFrame(null)} className="btn-paper rounded-md px-3 py-1 text-sm font-semibold">
            Remove
          </button>
        )}
      </div>
      <label className="flex cursor-pointer items-start gap-3 rounded-md border border-rule p-3">
        <input type="checkbox" checked={reactions} onChange={(e) => setReactions(e.target.checked)} className="mt-1 size-4 accent-[var(--color-accent)]" />
        <span>
          <span className="block font-semibold">Cards react while you play</span>
          <span className="block text-sm text-ink-soft">A Legendary or Mythic icon pops up with a word on a right answer, a mistake or a big win; a Legendary or Mythic background lights up, winces or bursts, and on a win plays its video and says its voice line.</span>
        </span>
      </label>
      <label className="flex cursor-pointer items-start gap-3 rounded-md border border-rule p-3">
        <input type="checkbox" checked={aura} onChange={(e) => setAura(e.target.checked)} className="mt-1 size-4 accent-[var(--color-accent)]" />
        <span>
          <span className="block font-semibold">✪ Omni aura</span>
          <span className="block text-sm text-ink-soft">With an Omni card as your icon or background, the whole site shines: an aurora behind the pages, a rainbow under the header, a golden logo and buttons, sparkles behind the cursor.</span>
        </span>
      </label>
      <label className="flex cursor-pointer items-start gap-3 rounded-md border border-rule p-3">
        <input type="checkbox" checked={voices} onChange={(e) => setVoices(e.target.checked)} className="mt-1 size-4 accent-[var(--color-accent)]" />
        <span>
          <span className="block font-semibold">🔊 Voice lines</span>
          <span className="block text-sm text-ink-soft">Mythic cards say their line in their voice actor's voice — out of a pack, in the album, on a big win. Off: the line stays on the card, silent.</span>
        </span>
      </label>
      <label className="flex cursor-pointer items-start gap-3 rounded-md border border-rule p-3">
        <input type="checkbox" checked={motion} onChange={(e) => setMotion(e.target.checked)} className="mt-1 size-4 accent-[var(--color-accent)]" />
        <span>
          <span className="block font-semibold">🎞 Animated cards in the album</span>
          <span className="block text-sm text-ink-soft">Cards with a light animation (the Ender Dragon's GIF, Mercy's clip…) keep moving wherever they're shown. Off: still pictures, and animations only up close and on big wins.</span>
        </span>
      </label>
      <label className="block rounded-md border border-rule p-3">
        <span className="block font-semibold">🎨 Site theme</span>
        <span className="mb-2 block text-sm text-ink-soft">Recolours the whole site in a franchise's colours, its symbols drifting behind the pages. A franchise unlocks when you own one of its Legendary cards or better.</span>
        <select value={uiTheme} onChange={(e) => setUiTheme(e.target.value)} className="w-full rounded-md border border-rule-strong bg-card px-3 py-2 font-semibold">
          <option value="icon">Follow my icon's franchise</option>
          <option value="off">Off: the classic look</option>
          {SETS.filter((s) => THEMES[s.id]).map((s) => (
            <option key={s.id} value={s.id} disabled={!unlocked.has(s.id)}>
              {unlocked.has(s.id) ? s.franchise : `🔒 ${s.franchise}`}
            </option>
          ))}
        </select>
      </label>
      <label className="flex cursor-pointer items-start gap-3 rounded-md border border-rule p-3">
        <input type="checkbox" checked={companions} onChange={(e) => setCompanions(e.target.checked)} className="mt-1 size-4 accent-[var(--color-accent)]" />
        <span>
          <span className="block font-semibold">💬 Companions</span>
          <span className="block text-sm text-ink-soft">With a theme on, the other characters you own from that franchise pop up now and then to talk among themselves. The more of them you own, the more voices.</span>
        </span>
      </label>
      <p className="text-xs text-ink-faint">
        Pick them in the{' '}
        <Link to="/album" className="font-semibold text-accent">
          Album
        </Link>
        : open a card, then “Use as my icon” — or, for a Rare card or better, “Use as background”.
      </p>
    </section>
  );
}

/** The account's birthday: set for good, or a button to set it. */
function BirthdayLine() {
  const birthday = useCloud((c) => c.birthday);
  const fr = useProgress((s) => s.nameLang) === 'fr';
  if (birthday === undefined) return null;
  return (
    <p className="flex flex-wrap items-center gap-2 text-sm">
      <span aria-hidden>🎂</span>
      {birthday ? (
        <>
          <span>
            {fr ? 'Anniversaire' : 'Birthday'}: <b>{birthdayLabel(birthday, fr ? 'fr' : 'en')}</b>
          </span>
          <span className="text-ink-faint">· {fr ? `${BIRTHDAY_COINS.toLocaleString('fr')} DleCoins chaque année` : `${BIRTHDAY_COINS.toLocaleString('en')} DleCoins every year`}</span>
        </>
      ) : (
        <button type="button" onClick={() => useCloud.setState({ askBirthday: true })} className="font-semibold underline hover:text-accent">
          {fr ? 'Indique ton anniversaire' : 'Set your birthday'}
        </button>
      )}
    </p>
  );
}

/** The name other players see (friends, trades, album news): changed here. */
function NameForm({ name, busy, save }: { name: string; busy: boolean; save: (n: string) => Promise<boolean> }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(name);
  const [done, setDone] = useState(false);
  if (!open)
    return (
      <p className="text-sm">
        <button type="button" onClick={() => (setText(name), setDone(false), setOpen(true))} className="font-semibold underline hover:text-accent">
          ✎ Change my name
        </button>
        {done && <span className="ml-2 font-semibold text-hit">✓ Saved</span>}
      </p>
    );
  const clean = text.replace(/\s+/g, ' ').trim();
  return (
    <form
      className="flex flex-wrap items-center gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (!clean) return;
        void save(clean).then((ok) => ok && (setOpen(false), setDone(true)));
      }}
    >
      <input autoFocus maxLength={40} value={text} onChange={(e) => setText(e.target.value)} placeholder="Your name" aria-label="Your name" className="min-w-0 flex-1 rounded-md border border-rule-strong bg-card px-3 py-2 outline-none focus:border-accent" />
      <button type="submit" disabled={busy || !clean || clean === name} className="btn-accent rounded-md px-4 py-2 font-semibold disabled:opacity-50">
        Save
      </button>
      <button type="button" onClick={() => setOpen(false)} className="text-sm font-semibold text-ink-soft underline-offset-2 hover:underline">
        Cancel
      </button>
      <p className="w-full text-xs text-ink-faint">What friends, trades and album news show (40 characters at most).</p>
    </form>
  );
}

/** /account */
export default function Account() {
  const { status, email, name, lastSync, error, actions } = useCloud();
  const [mode, setMode] = useState<'link' | 'password'>('link');
  const [form, setForm] = useState({ email: '', password: '' });
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => void startCloud(), []);

  const signedIn = !!email && status !== 'signedOut';
  const go = async (f: () => Promise<void>) => {
    setBusy(true);
    try {
      await f();
      return true;
    } catch {
      return false;
    } finally {
      setBusy(false);
    }
  };
  const field = 'w-full rounded-md border border-rule-strong bg-card px-3 py-2.5 outline-none focus:border-accent';

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <Link to="/" className="font-display text-sm font-semibold tracking-wider text-ink-soft hover:text-ink">
          ← Omnidle
        </Link>
        <h1 className="text-5xl font-bold">Account</h1>
        <p className="text-ink-soft">Sign in to keep the same streak, album, coins and bests on your phone and your computer. Without an account, everything stays saved in this browser.</p>
      </div>

      {status === 'off' || status === 'loading' || !actions ? (
        <p className="flex items-center gap-2 text-ink-soft">
          <Spinner /> Connecting…
        </p>
      ) : signedIn ? (
        <section className="page space-y-4 rounded-md p-5">
          <div>
            <p className="font-display text-xs uppercase tracking-[0.3em] text-ink-faint">Signed in as</p>
            <p className="text-xl font-bold">{name ?? email}</p>
            {name && <p className="text-sm text-ink-soft">{email}</p>}
          </div>
          <NameForm name={name ?? ''} busy={busy} save={(n) => go(() => actions.setName(n))} />
          <p className={`flex items-center gap-2 text-sm font-semibold ${status === 'error' ? 'text-coral' : status === 'synced' ? 'text-hit' : 'text-ink-soft'}`}>
            {status === 'syncing' ? <Spinner /> : status === 'synced' ? '✓' : status === 'error' ? '⚠' : '•'} {STATUS[status]}
            {status === 'synced' && lastSync && <span className="font-normal text-ink-faint">· {new Date(lastSync).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>}
          </p>
          {error && <p className="text-sm text-coral">{error}</p>}
          <BirthdayLine />
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={busy} onClick={() => go(actions.syncNow)} className="btn-accent rounded-md px-4 py-2 font-semibold disabled:opacity-50">
              ⟳ Sync now
            </button>
            <button type="button" disabled={busy} onClick={() => go(actions.signOut)} className="btn-paper rounded-md px-4 py-2 font-semibold">
              Sign out
            </button>
          </div>
          <p className="text-xs text-ink-faint">Signing out clears your progress from this browser (it stays safe in your account); signing in again on any device brings it all back.</p>
        </section>
      ) : (
        <section className="page space-y-4 rounded-md p-5">
          <button type="button" disabled={busy} onClick={() => go(actions.signInGoogle)} className="btn-ink flex w-full items-center justify-center gap-3 rounded-md px-4 py-3 font-display font-bold">
            <svg viewBox="0 0 48 48" className="size-5" aria-hidden>
              <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
              <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
              <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
              <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
            </svg>
            Continue with Google
          </button>
          <div className="flex items-center gap-3 text-xs uppercase tracking-widest text-ink-faint">
            <span className="h-px flex-1 bg-rule" /> or with your email <span className="h-px flex-1 bg-rule" />
          </div>
          <div className="flex gap-1.5 text-sm">
            {(['link', 'password'] as const).map((m) => (
              <button key={m} type="button" onClick={() => (setMode(m), setSent(false))} className={`rounded-full border-2 px-3 py-1 font-semibold ${mode === m ? 'border-ink bg-ink text-paper' : 'border-rule-strong text-ink-soft'}`}>
                {m === 'link' ? 'Email me a link' : 'Password'}
              </button>
            ))}
          </div>
          <form
            className="space-y-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (mode === 'link') void go(() => actions.sendEmailLink(form.email)).then((ok) => ok && setSent(true));
              else void go(() => actions.signInPassword(form.email, form.password));
            }}
          >
            <input type="email" required autoComplete="email" placeholder="you@example.com" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className={field} />
            {mode === 'password' && (
              <input type="password" required minLength={6} autoComplete="current-password" placeholder="Password (6 characters or more)" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className={field} />
            )}
            <div className="flex flex-wrap gap-2">
              <button type="submit" disabled={busy} className="btn-accent rounded-md px-4 py-2 font-semibold disabled:opacity-50">
                {mode === 'link' ? 'Send me a sign-in link' : 'Sign in'}
              </button>
              {mode === 'password' && (
                <>
                  <button type="button" disabled={busy || !form.email || form.password.length < 6} onClick={() => go(() => actions.register(form.email, form.password))} className="btn-paper rounded-md px-4 py-2 font-semibold disabled:opacity-50">
                    Create an account
                  </button>
                  <button type="button" disabled={busy || !form.email} onClick={() => go(() => actions.resetPassword(form.email)).then((ok) => ok && setSent(true))} className="text-sm font-semibold text-ink-soft underline-offset-2 hover:underline disabled:opacity-50">
                    Forgot it?
                  </button>
                </>
              )}
            </div>
          </form>
          {sent && <p className="text-sm font-semibold text-hit">✉ Sent to {form.email} — open the email on this device and follow the link{mode === 'password' ? ' to choose a new password' : ''}. Check the spam folder if it isn&apos;t there in a minute.</p>}
          {error && <p className="text-sm font-semibold text-coral">{error}</p>}
          <p className="text-xs text-ink-faint">Your progress in this browser comes with you into a new account. Signing in to an account that already has a save keeps that account&apos;s coins and cards (your scores and history here are added to it). Signing out clears this browser.</p>
        </section>
      )}

      <Profile />

      <section className="page flex flex-wrap items-center justify-between gap-3 rounded-md p-5">
        <div>
          <h2 className="font-display text-lg font-bold">Names</h2>
          <p className="text-sm text-ink-soft">Show characters and titles in English or in French, where they differ.</p>
        </div>
        <NameLangSwitch />
      </section>

      <Backup />
      {import.meta.env.DEV && <DevCode />}
    </div>
  );
}
