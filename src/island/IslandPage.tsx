// Friends → Island: your island, your friends' (stage 3: visit them, water their plants, build on the ones you're
// invited to), and the Seed Book. Signed in, your island lives online (src/cloud/islands.ts) so friends can come;
// in the demo (?demo) the friends' islands are made up and nothing goes online.
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { tr } from '../lib/i18n';
import { todayKey } from '../lib/date';
import { useProgress } from '../store/progress';
import type { IslandDoc } from '../cloud/islands';
import type { TeamDoc } from '../cloud/teams';
import { DX, idx, newIsland, OLD, surfaceAt, type Island, type Who } from './island';
import { IslandView, type Act, type IslandMode, type Move } from './IslandView';
import { SeedBook } from './SeedBook';

export interface IslandFriend {
  uid: string;
  name: string;
  face: ReactNode;
}
type View = 'island' | 'visit' | 'team' | 'book';
const BUILDERS = 10;
const cloud = () => import('../cloud/islands');
const teams = () => import('../cloud/teams');

const WHAT: Record<string, [string, string]> = {
  water: ['watered a plant', 'a arrosé une plante'],
  build: ['built something', 'a construit quelque chose'],
  plant: ['planted seeds', 'a planté des graines'],
  harvest: ['harvested', 'a récolté'],
  pick: ['picked something up', 'a ramassé quelque chose'],
  dig: ['dug', 'a creusé'],
};

/** Applies a move to an island online, then your bags: what the move took from or gave to them. */
function onlineAct(owner: string, myName: string): Act {
  return async (move: Move, what?: string) => {
    let change: ReturnType<Move> | null = null;
    try {
      const { islandMove } = await cloud();
      await islandMove(
        owner,
        (island) => {
          const st = useProgress.getState();
          change = move(island, st.islandItems ?? {}, st.seeds ?? {});
          return change.island;
        },
        what ? { name: myName, what, day: todayKey() } : undefined,
      );
      if (change) useProgress.getState().islandBags(change);
      return null;
    } catch (e) {
      return /permission/i.test(String((e as { code?: string })?.code ?? (e as Error)?.message)) ? tr('Not allowed on this island.', 'Pas permis sur cette île.') : e instanceof Error ? e.message : tr('That didn’t work.', 'Ça n’a pas marché.');
    }
  };
}

/** A made-up friend's island for the demo: a little house, lights, a growing plot to water. */
function demoIsland(seed: number): Island {
  const isl = newIsland();
  const S = (x: number) => surfaceAt(x) - 1;
  const at = (x: number) => idx(x, S(x));
  const base = DX + OLD.x + 14 + (seed % 3) * 4;
  for (let x = base; x < base + 5; x++) for (let y = S(base) - 2; y <= S(base); y++) isl.bg[idx(x, y)] = seed % 2 ? 'pattern-wallpaper' : 'starry-wallpaper';
  isl.fg[at(base)] = 'sofa';
  isl.fg[at(base + 1)] = 'fireplace';
  isl.fg[at(base + 3)] = 'grand-piano';
  isl.fg[at(base + 8)] = 'paper-lantern';
  isl.fg[at(base + 10)] = 'blossom-tree';
  isl.plots[at(base + 12)] = { a: 'melody', b: 'wander', day: todayKey(), by: `friend${seed}` };
  return isl;
}

export function IslandPage({ me, friends = [], demo = false }: { me?: { uid: string; name: string } | null; friends?: IslandFriend[]; demo?: boolean }) {
  const [view, setView] = useState<View>('island');
  const online = !!me && !demo;
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5">
        {(
          [
            ['island', '🏝️', tr('My island', 'Mon île')],
            ...(me ? ([['visit', '🧭', tr('Visit friends', 'Visiter des amis')]] as const) : []),
            ...(me && !demo ? ([['team', '🛡️', tr('Team', 'Team')]] as const) : []),
            ['book', '📖', tr('Seed Book', 'Herbier')],
          ] as [View, string, string][]
        ).map(([id, icon, name]) => (
          <button
            key={id}
            type="button"
            onClick={() => setView(id)}
            className={`rounded-md border px-3 py-1.5 text-sm font-semibold ${view === id ? 'border-accent bg-card shadow' : 'border-rule text-ink-soft hover:bg-card/60'}`}
          >
            {icon} {name}
          </button>
        ))}
      </div>
      {view === 'book' ? (
        <SeedBook />
      ) : view === 'team' && me && online ? (
        <TeamIsland me={me} />
      ) : view === 'visit' && me ? (
        <Visit me={me} friends={friends} demo={demo} />
      ) : online && me ? (
        <MyIslandOnline me={me} friends={friends} />
      ) : (
        <Frame title={`🏝️ ${tr('My island', 'Mon île')}`} blurb={ownBlurb(false)}>
          <IslandView />
        </Frame>
      )}
    </div>
  );
}

const ownBlurb = (online: boolean) =>
  tr(
    `Plant two seeds on the dirt; a day or two later, harvest what grows and build with it: blocks, wallpapers, lights, music, furniture, and frames to show your cards.${online ? ' Your friends can visit, water your plants, and the builders you invite can build with you.' : ''}`,
    `Plante deux graines sur la terre ; un jour ou deux plus tard, récolte ce qui pousse et construis avec : blocs, papiers peints, lumières, musique, meubles, et cadres pour exposer tes cartes.${online ? ' Tes amis peuvent venir, arroser tes plantes, et les bâtisseurs que tu invites construisent avec toi.' : ''}`,
  );

function Frame({ title, blurb, children }: { title: ReactNode; blurb?: string; children: ReactNode }) {
  return (
    <div className="page space-y-2 rounded-md p-4">
      <h2 className="font-display text-2xl font-bold">{title}</h2>
      {blurb && <p className="text-sm text-ink-soft">{blurb}</p>}
      {children}
    </div>
  );
}

/** Your island, online: published the first time from what you built offline; then followed live. */
function MyIslandOnline({ me, friends }: { me: { uid: string; name: string }; friends: IslandFriend[] }) {
  const [d, setD] = useState<IslandDoc | null | undefined>(undefined);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    let stop = () => {};
    let gone = false;
    void cloud().then(({ watchIsland, publishIsland }) => {
      if (gone) return;
      let tried = false;
      stop = watchIsland(me.uid, (doc) => {
        if (doc) {
          setD(doc);
          // Your save keeps a copy (to play offline, and for the cloud save).
          useProgress.setState({ island: doc.island });
        } else if (!tried) {
          tried = true;
          publishIsland(useProgress.getState().island, me.name).catch((e) => setErr(e instanceof Error ? e.message : String(e)));
        } else setD(null);
      });
    });
    return () => ((gone = true), stop());
  }, [me.uid, me.name]);
  const names = useMemo(() => Object.fromEntries([[me.uid, me.name], ...friends.map((f) => [f.uid, f.name])]), [me, friends]);
  const act = useMemo(() => onlineAct(me.uid, me.name), [me.uid, me.name]);
  // Your friends, copied onto your island (the database lets them in by that list).
  const friendIds = friends.map((f) => f.uid).sort().join(',');
  const online = !!d;
  useEffect(() => {
    if (!online) return;
    const t = window.setTimeout(() => void cloud().then((c) => c.syncFriends(friendIds ? friendIds.split(',') : [])).catch(() => {}), 1500);
    return () => window.clearTimeout(t);
  }, [online, friendIds]);
  const who: Who = { uid: me.uid, owner: me.uid };
  if (d === undefined)
    return (
      <Frame title={`🏝️ ${tr('My island', 'Mon île')}`}>
        <p className="text-sm text-ink-soft">{err ? `⚠️ ${err}` : tr('Bringing your island online…', 'Mise en ligne de ton île…')}</p>
      </Frame>
    );
  if (!d)
    return (
      <Frame title={`🏝️ ${tr('My island', 'Mon île')}`} blurb={ownBlurb(false)}>
        <p className="text-sm text-coral">⚠️ {err ?? tr('Your island couldn’t go online: you can still build it here.', 'Ton île n’a pas pu être mise en ligne : tu peux quand même la construire ici.')}</p>
        <IslandView />
      </Frame>
    );
  return (
    <Frame title={`🏝️ ${d.name || tr('My island', 'Mon île')}`} blurb={ownBlurb(true)}>
      <IslandView shared={d.island} mode="own" act={act} who={who} names={names} live={{ owner: me.uid, uid: me.uid, name: me.name }} />
      <div className="grid gap-3 md:grid-cols-2">
        <Builders d={d} friends={friends} />
        <Book d={d} />
      </div>
    </Frame>
  );
}

/** The owner picks up to BUILDERS friends who may build on the island. */
function Builders({ d, friends }: { d: IslandDoc; friends: IslandFriend[] }) {
  const [busy, setBusy] = useState(false);
  const toggle = async (uid: string) => {
    const next = d.builders.includes(uid) ? d.builders.filter((b) => b !== uid) : [...d.builders, uid];
    if (next.length > BUILDERS) return;
    setBusy(true);
    try {
      await (await cloud()).setBuilders(next);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="rounded-md border border-rule bg-card/60 p-3">
      <p className="mb-1 text-xs font-bold uppercase tracking-wider text-ink-faint">
        🧑‍🤝‍🧑 {tr('Builders', 'Bâtisseurs')} · {d.builders.length} / {BUILDERS}
      </p>
      <p className="mb-2 text-xs text-ink-soft">{tr('They can build, plant and dig with you. Every friend can visit and water your plants.', 'Ils peuvent construire, planter et creuser avec toi. Tous tes amis peuvent venir et arroser tes plantes.')}</p>
      {friends.length === 0 ? (
        <p className="text-sm text-ink-soft">{tr('Add friends first (the Friends tab).', 'Ajoute d’abord des amis (onglet Amis).')}</p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {friends.map((f) => {
            const on = d.builders.includes(f.uid);
            return (
              <button
                key={f.uid}
                type="button"
                disabled={busy || (!on && d.builders.length >= BUILDERS)}
                onClick={() => void toggle(f.uid)}
                className={`flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-sm disabled:opacity-50 ${on ? 'border-accent bg-accent/15 font-semibold' : 'border-rule hover:bg-tile'}`}
              >
                {f.face} {f.name} {on ? '✓' : '+'}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** Who came by lately, and what they did. */
function Book({ d }: { d: IslandDoc }) {
  const lines = [...(d.log ?? [])].reverse().filter((l) => l.uid !== d.owner);
  return (
    <div className="rounded-md border border-rule bg-card/60 p-3">
      <p className="mb-2 text-xs font-bold uppercase tracking-wider text-ink-faint">📒 {tr('Visitors’ book', 'Livre d’or')}</p>
      {lines.length === 0 ? (
        <p className="text-sm text-ink-soft">{tr('Nobody yet. Invite builders, or ask friends to drop by and water your plants.', 'Personne encore. Invite des bâtisseurs, ou demande à tes amis de passer arroser tes plantes.')}</p>
      ) : (
        <ul className="max-h-40 space-y-0.5 overflow-y-auto text-sm">
          {lines.slice(0, 15).map((l, k) => (
            <li key={k}>
              <b>{l.name}</b> {tr(...(WHAT[l.what] ?? [l.what, l.what]))} <span className="text-xs text-ink-faint">· {l.day}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Your friends' islands: pick one, walk around it, water its plants; build on it if you're one of its builders. */
function Visit({ me, friends, demo }: { me: { uid: string; name: string }; friends: IslandFriend[]; demo: boolean }) {
  const [at, setAt] = useState<string | null>(null);
  const friend = friends.find((f) => f.uid === at);
  return (
    <Frame title={`🧭 ${tr('Visit friends', 'Visiter des amis')}`} blurb={tr('Walk around your friends’ islands, listen to their music, watch their screens. Water a plant that’s still growing: it’ll be ready a day sooner, and you get a seed for helping (3 a day).', 'Promène-toi sur les îles de tes amis, écoute leur musique, regarde leurs écrans. Arrose une plante qui pousse encore : elle sera prête un jour plus tôt, et tu gagnes une graine pour ton aide (3 par jour).')}>
      <div className="flex flex-wrap gap-1.5">
        {friends.length === 0 && <p className="text-sm text-ink-soft">{tr('Add friends first (the Friends tab).', 'Ajoute d’abord des amis (onglet Amis).')}</p>}
        {friends.map((f) => (
          <button key={f.uid} type="button" onClick={() => setAt(f.uid)} className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-sm ${at === f.uid ? 'border-accent bg-accent/15 font-semibold' : 'border-rule hover:bg-tile'}`}>
            {f.face} {f.name}
          </button>
        ))}
      </div>
      {friend && (demo ? <DemoFriendIsland key={friend.uid} me={me} friend={friend} index={friends.indexOf(friend)} /> : <FriendIsland key={friend.uid} me={me} friend={friend} friends={friends} />)}
    </Frame>
  );
}

function FriendIsland({ me, friend, friends }: { me: { uid: string; name: string }; friend: IslandFriend; friends: IslandFriend[] }) {
  const [d, setD] = useState<IslandDoc | null | undefined>(undefined);
  useEffect(() => {
    let stop = () => {};
    let gone = false;
    void cloud().then(({ watchIsland }) => {
      if (!gone) stop = watchIsland(friend.uid, setD);
    });
    return () => ((gone = true), stop());
  }, [friend.uid]);
  const act = useMemo(() => onlineAct(friend.uid, me.name), [friend.uid, me.name]);
  const names = useMemo(() => Object.fromEntries([[me.uid, tr('You', 'Toi')], ...friends.map((f) => [f.uid, f.name])]), [me.uid, friends]);
  if (d === undefined) return <p className="text-sm text-ink-soft">{tr('Sailing over…', 'En route…')}</p>;
  if (!d)
    return (
      <p className="text-sm text-ink-soft">
        {tr(`${friend.name} hasn’t put an island online yet (or hasn’t added you as a friend).`, `${friend.name} n’a pas encore d’île en ligne (ou ne t’a pas ajouté en ami).`)}
      </p>
    );
  const mode: IslandMode = d.builders.includes(me.uid) ? 'build' : 'visit';
  return (
    <div className="space-y-2">
      <p className="font-display text-lg font-bold">
        🏝️ {d.name || friend.name}{' '}
        <span className="text-xs font-semibold text-ink-soft">{mode === 'build' ? tr('· you’re one of its builders', '· tu es l’un de ses bâtisseurs') : tr('· visiting', '· en visite')}</span>
      </p>
      {d.old && (
        <p className="text-xs text-ink-soft">
          {tr(`As it was: ${friend.name} has to open their island once for you to water or build here.`, `Telle qu’elle était : ${friend.name} doit ouvrir son île une fois pour que tu puisses arroser ou construire ici.`)}
        </p>
      )}
      <IslandView key={friend.uid} shared={d.island} mode={mode} act={act} who={{ uid: me.uid, owner: friend.uid }} names={names} live={{ owner: friend.uid, uid: me.uid, name: me.name }} />
    </div>
  );
}

/** A move on a team's island: like a friend's (onlineAct), on teams/<code>. */
function teamAct(code: string, myName: string): Act {
  return async (move: Move, what?: string) => {
    let change: ReturnType<Move> | null = null;
    try {
      const { teamMove } = await teams();
      await teamMove(
        code,
        (island) => {
          const st = useProgress.getState();
          change = move(island, st.islandItems ?? {}, st.seeds ?? {});
          return change.island;
        },
        what ? { name: myName, what, day: todayKey() } : undefined,
      );
      if (change) useProgress.getState().islandBags(change);
      return null;
    } catch (e) {
      return /permission/i.test(String((e as { code?: string })?.code ?? (e as Error)?.message)) ? tr('Not allowed on this island.', 'Pas permis sur cette île.') : e instanceof Error ? e.message : tr('That didn’t work.', 'Ça n’a pas marché.');
    }
  };
}

/** Your island as it is: online if it's there, else what you built here. */
function myIslandNow(uid: string): Promise<Island> {
  return new Promise((res) => {
    let done = false;
    void cloud().then(({ watchIsland }) => {
      const stop = watchIsland(uid, (x) => {
        if (done) return;
        done = true;
        res(x?.island ?? useProgress.getState().island ?? newIsland());
        window.setTimeout(() => stop(), 0);
      });
    });
  });
}

/**
 * Your team's island (like a guild's): shared by its members, all of the same rank (each builds, digs, picks up and
 * harvests anything there). Not in one yet: make one from your island (a copy: yours stays yours), or join one by its code.
 */
function TeamIsland({ me }: { me: { uid: string; name: string } }) {
  const [code, setCode] = useState<string | null | undefined>(undefined);
  const [d, setD] = useState<TeamDoc | null | undefined>(undefined);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState('');
  const [join, setJoin] = useState('');
  useEffect(() => {
    let gone = false;
    void teams()
      .then((t) => t.myTeam())
      .then((c) => {
        if (!gone) setCode(c);
      })
      .catch((e) => {
        if (gone) return;
        setCode(null);
        setErr(e instanceof Error ? e.message : String(e));
      });
    return () => {
      gone = true;
    };
  }, []);
  useEffect(() => {
    if (!code) {
      setD(code === null ? null : undefined);
      return;
    }
    let stop = () => {};
    let gone = false;
    void teams().then((t) => {
      if (!gone) stop = t.watchTeam(code, setD);
    });
    return () => {
      gone = true;
      stop();
    };
  }, [code]);
  const act = useMemo(() => (code ? teamAct(code, me.name) : null), [code, me.name]);
  if (code === undefined) return <p className="text-sm text-ink-soft">{tr('Looking for your team…', 'On cherche ta Team…')}</p>;
  if (!code || d === null)
    return (
      <Frame
        title={`🛡️ ${tr('Team', 'Team')}`}
        blurb={tr(
          'A team shares one island, like a guild: every member builds, digs and harvests there, all of the same rank. Make one from your island (a copy of it: yours stays yours), or join one with its code.',
          'Une Team partage une île, comme une guilde : chaque membre y construit, creuse et récolte, tous au même rang. Crée-la à partir de ton île (une copie : la tienne reste à toi), ou rejoins-en une avec son code.',
        )}
      >
        {err && <p className="text-sm text-coral">⚠️ {err}</p>}
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2 rounded-md border border-rule p-3">
            <p className="font-display font-bold">{tr('Make a team', 'Créer une Team')}</p>
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} placeholder={tr('Its name', 'Son nom')} className="w-full rounded-md border border-rule bg-card px-3 py-1.5 text-sm" />
            <button
              type="button"
              disabled={busy || !name.trim()}
              onClick={async () => {
                setBusy(true);
                setErr(null);
                try {
                  const island = await myIslandNow(me.uid);
                  setCode(await (await teams()).createTeam(name.trim(), me.name, island));
                } catch (e) {
                  setErr(e instanceof Error ? e.message : String(e));
                }
                setBusy(false);
              }}
              className="btn-accent w-full rounded-md px-3 py-1.5 text-sm font-semibold disabled:opacity-40"
            >
              {tr('Make it from my island', 'La créer à partir de mon île')}
            </button>
          </div>
          <div className="space-y-2 rounded-md border border-rule p-3">
            <p className="font-display font-bold">{tr('Join a team', 'Rejoindre une Team')}</p>
            <input value={join} onChange={(e) => setJoin(e.target.value.toUpperCase())} maxLength={12} placeholder={tr('Its code', 'Son code')} className="w-full rounded-md border border-rule bg-card px-3 py-1.5 font-mono text-sm tracking-widest" />
            <button
              type="button"
              disabled={busy || join.replace(/[^A-Z0-9]/gi, '').length < 8}
              onClick={async () => {
                setBusy(true);
                setErr(null);
                const t = await teams();
                const c = t.cleanCode(join);
                const why = await t.joinTeam(c, me.name);
                if (why) setErr(why);
                else setCode(c);
                setBusy(false);
              }}
              className="btn-paper w-full rounded-md px-3 py-1.5 text-sm font-semibold disabled:opacity-40"
            >
              {tr('Join', 'Rejoindre')}
            </button>
          </div>
        </div>
      </Frame>
    );
  if (!d || !act) return <p className="text-sm text-ink-soft">{tr('Sailing over…', 'En route…')}</p>;
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <p className="font-display text-lg font-bold">🛡️ {d.name}</p>
        <span className="text-xs text-ink-soft">
          {tr('Code', 'Code')}{' '}
          <button type="button" onClick={() => void navigator.clipboard?.writeText(d.code)} className="rounded border border-rule bg-card px-1.5 font-mono font-bold tracking-widest" title={tr('Copy', 'Copier')}>
            {d.code}
          </button>
        </span>
        <span className="text-xs text-ink-soft">· {d.members.map((m) => d.names[m] ?? '?').join(', ')}</span>
        <button
          type="button"
          onClick={async () => {
            if (!window.confirm(tr('Leave this team? (The last one out takes it down.)', 'Quitter cette Team ? (Le dernier qui part la supprime.)'))) return;
            await (await teams()).leaveTeam(d.code);
            setCode(null);
          }}
          className="ml-auto text-xs text-ink-soft underline hover:text-coral"
        >
          {tr('Leave the team', 'Quitter la Team')}
        </button>
      </div>
      {/* Every member acts as its owner here: the same rank. */}
      <IslandView key={d.code} shared={d.island} mode="build" act={act} who={{ uid: me.uid, owner: me.uid }} names={d.names} live={{ owner: `team:${d.code}`, uid: me.uid, name: me.name }} />
    </div>
  );
}

/** The demo: a made-up island, played here. */
function DemoFriendIsland({ me, friend, index }: { me: { uid: string; name: string }; friend: IslandFriend; index: number }) {
  const [isl, setIsl] = useState(() => demoIsland(index));
  const mode: IslandMode = index % 2 === 0 ? 'build' : 'visit';
  const act: Act = (move) => {
    const st = useProgress.getState();
    try {
      const c = move(isl, st.islandItems ?? {}, st.seeds ?? {});
      setIsl(c.island);
      st.islandBags(c);
      return null;
    } catch (e) {
      return e instanceof Error ? e.message : 'That didn’t work.';
    }
  };
  return (
    <div className="space-y-2">
      <p className="font-display text-lg font-bold">
        🏝️ {friend.name}{' '}
        <span className="text-xs font-semibold text-ink-soft">{mode === 'build' ? tr('· you’re one of its builders (demo)', '· tu es l’un de ses bâtisseurs (démo)') : tr('· visiting (demo)', '· en visite (démo)')}</span>
      </p>
      <IslandView shared={isl} mode={mode} act={act} who={{ uid: me.uid, owner: friend.uid }} names={{ [`friend${index}`]: friend.name, [me.uid]: tr('You', 'Toi') }} live={{ demo: friend.name }} />
    </div>
  );
}
