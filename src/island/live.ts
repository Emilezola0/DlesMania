// Island players seen live (src/island/IslandView.tsx): on a shared island, everyone there sees the others walk.
// Each player writes where they stand (on the Realtime Database, src/cloud/presence.ts, here/<owner>/<uid>; on
// Firestore, src/cloud/islands.ts, islands/<owner>/here/<uid>, while that doesn't answer) about every SEND ms while
// they move, and every BEAT ms while they stand still; the others glide smoothly between those points. Gone after
// STALE ms without news (a closed tab), and removed when they leave. The demo makes up a friend walking about.
// They also say which tool they hold (drawn in their hand), and their last switch of a TV or a music maker, so a TV
// switched on (or a disc changed by a visitor) does the same for everyone there; and whether they sit or sleep, and
// their last emote (a bubble over their head for a few seconds). And which world they are in: the island, or the week's
// dungeon under it (`world`); only those in the same world are seen (the owner's call: in the dungeon too, as on the
// island). Until the database's rules take `world` (firestore.rules, published by the owner), a write with it is
// refused: then it's written without, as before, those in the dungeon standing at the island's gate (`away`).
import { useEffect, useRef, useState } from 'react';
import { useProgress } from '../store/progress';
import { ISLAND, surfaceAt } from './island';

export interface Peer {
  uid: string;
  name: string;
  face: string | null;
  x: number;
  y: number;
  left: boolean;
  /** The tool in their hand (walk: none). */
  tool?: string;
  /** Their last TV switch. */
  tv?: TvEvent | null;
  /** Their last music switch (visitors only; the owner's and builders' are saved on the island). */
  tune?: TuneEvent | null;
  /** Sitting or asleep. */
  pose?: Pose | null;
  /** Their last emote. */
  emote?: EmoteEvent | null;
  /** Where they are: "island", or "dungeon:<week>" (none: on the island). */
  world?: string;
}
/** Sitting, asleep, in a minecart, on a zipline. */
export type Pose = 'sit' | 'sleep' | 'cart' | 'zip';
/** An emote popped over a player's head (one of EMOTES). */
export interface EmoteEvent {
  e: string;
  at: number;
}
/** The emote wheel (src/island/IslandView.tsx), in order: R opens it, 1–8 or a click picks. */
export const EMOTES = ['👋', '❤️', '😂', '😮', '😢', '😡', '👍', '🎉'];
/** A TV switched on (a clip of the card, started at `at`) or off. */
export interface TvEvent {
  cell: number;
  card: string;
  clip: string;
  at: number;
  on: boolean;
}
/** A music maker switched off, on, or given a disc (`value` null: back to the island's setting). */
export interface TuneEvent {
  key: string;
  value: string | null;
  at: number;
}
/** What the player says about themself. */
export interface Here {
  x: number;
  y: number;
  left: boolean;
  tool: string;
  tv: TvEvent | null;
  tune: TuneEvent | null;
  pose: Pose | null;
  emote: EmoteEvent | null;
  /** The world they are in ("island", "dungeon:<week>"), and where to say they stand if it can't be told. */
  world: string;
  away: { x: number; y: number };
}
/** Where to go live: someone's island online (as you), or the demo. */
export type LiveCfg = { owner: string; uid: string; name: string } | { demo: string };

const SEND = 400;
const BEAT = 10_000;
const STALE = 30_000;
/** The database's rules don't take `world` yet (refused once): written without it from then on. */
let worldRefused = false;
/** Where the island's presence goes this session: the Realtime Database, or Firestore (it didn't answer); null: trying. */
let backend: 'rt' | 'fs' | null = null;

export function useLive(cfg: LiveCfg | undefined, where: () => Here): Peer[] {
  const [peers, setPeers] = useState<Peer[]>([]);
  const whereRef = useRef(where);
  whereRef.current = where;
  const owner = cfg && 'owner' in cfg ? cfg.owner : null;
  const uid = cfg && 'owner' in cfg ? cfg.uid : null;
  const name = cfg && 'owner' in cfg ? cfg.name : null;
  const demo = cfg && 'demo' in cfg ? cfg.demo : null;

  // Online: follow who's here, and say where you are. On the Realtime Database (src/cloud/presence.ts); on Firestore
  // if it doesn't answer (not made yet, its rules not published), for the rest of the visit.
  useEffect(() => {
    if (!owner || !uid || !name) return;
    let gone = false;
    let stop = () => {};
    let timer = 0;
    let leave = () => {};
    void Promise.all([import('../cloud/islands'), import('../cloud/presence')]).then(([fs, rt]) => {
      if (gone) return;
      const show = (list: { uid: string; name: string; face: string | null; x: number; y: number; left: boolean; tool?: string; tv?: TvEvent | null; tune?: TuneEvent | null; pose?: Pose | null; emote?: EmoteEvent | null; world?: string; at: number | null }[]) => {
        const now = Date.now();
        setPeers(
          list
            .filter((h) => h.uid !== uid && (!h.at || now - h.at < STALE))
            .map((h) => ({ uid: h.uid, name: h.name, face: h.face ?? null, x: h.x, y: h.y, left: h.left, tool: h.tool, tv: h.tv ?? null, tune: h.tune ?? null, pose: h.pose ?? null, emote: h.emote ?? null, world: h.world ?? 'island' })),
        );
      };
      const onFirestore = () => {
        backend = 'fs';
        stop();
        stop = fs.watchHere(owner, (list) => show(list.map((h) => ({ ...h, at: h.at ? h.at.toMillis() : null }))));
      };
      if (backend === 'fs') onFirestore();
      else
        stop = rt.watchHereRt(
          owner,
          (list) => {
            backend = 'rt';
            show(list);
          },
          onFirestore,
        );
      leave = () => void (backend === 'rt' ? rt.leaveHereRt(owner) : fs.leaveHere(owner));
      let last = { x: -99, y: -99, left: false, t: 0, rest: '' };
      timer = window.setInterval(() => {
        // Not yet known where to write (the Realtime Database is being tried): wait.
        if (document.hidden || !backend) return;
        const p = whereRef.current();
        const now = Date.now();
        const rest = JSON.stringify([p.tool, p.tv, p.tune, p.pose, p.emote, p.world]);
        const moved = Math.abs(p.x - last.x) > 0.02 || Math.abs(p.y - last.y) > 0.02 || p.left !== last.left || rest !== last.rest;
        if (!moved && now - last.t < BEAT) return;
        last = { ...p, t: now, rest };
        const say = (withWorld: boolean) => {
          // Away from the island and the world can't be told: standing at its gate, as before.
          const at = withWorld || p.world === 'island' ? p : p.away;
          const h = {
            name,
            face: useProgress.getState().avatar ?? null,
            x: Math.round(at.x * 100) / 100,
            y: Math.round(at.y * 100) / 100,
            left: p.left,
            tool: p.tool,
            tv: p.tv,
            tune: p.tune,
            pose: p.pose,
            emote: p.emote,
            ...(withWorld ? { world: p.world } : {}),
          };
          return backend === 'rt' ? rt.sayHereRt(owner, h) : fs.sayHere(owner, h);
        };
        // The Realtime Database's rules take `world`; Firestore's maybe not yet (refused once: written without it).
        say(backend === 'rt' || !worldRefused).catch((e: { code?: string }) => {
          if (backend === 'rt') {
            // Refused there (its rules not published): on Firestore from now on.
            if (/permission/i.test(String(e?.code ?? e))) onFirestore();
            return;
          }
          if (worldRefused || e?.code !== 'permission-denied') return;
          worldRefused = true;
          say(false).catch(() => {});
        });
      }, SEND);
    });
    const bye = () => leave();
    window.addEventListener('pagehide', bye);
    return () => {
      gone = true;
      stop();
      window.clearInterval(timer);
      window.removeEventListener('pagehide', bye);
      leave();
    };
  }, [owner, uid, name]);

  // The demo: a friend strolling back and forth with a pickaxe, hopping now and then, waving now and then.
  useEffect(() => {
    if (!demo) return;
    const t0 = Date.now();
    const timer = window.setInterval(() => {
      const t = (Date.now() - t0) / 1000;
      const x = ISLAND.w / 2 + Math.sin(t / 4) * 9;
      const cx = Math.max(0, Math.min(ISLAND.w - 1, Math.floor(x + 0.4)));
      const hop = Math.max(0, Math.sin(t * 2.2)) > 0.92 ? 0.8 : 0;
      const wave = Math.floor(t / 12);
      setPeers([{ uid: 'demo', name: demo, face: null, x, y: surfaceAt(cx) - 0.93 - hop, left: Math.cos(t / 4) < 0, tool: 'dig', emote: wave > 0 ? { e: EMOTES[wave % EMOTES.length], at: t0 + wave * 12_000 } : null }]);
    }, SEND);
    return () => window.clearInterval(timer);
  }, [demo]);

  return peers;
}
