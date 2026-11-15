// Island players seen live (src/island/IslandView.tsx): on a shared island, everyone there sees the others walk.
// Each player writes where they stand (src/cloud/islands.ts, islands/<owner>/here/<uid>) about every SEND ms while
// they move, and every BEAT ms while they stand still; the others glide smoothly between those points. Gone after
// STALE ms without news (a closed tab), and removed when they leave. The demo makes up a friend walking about.
// They also say which tool they hold (drawn in their hand), and their last switch of a TV or a music maker, so a TV
// switched on (or a disc changed by a visitor) does the same for everyone there; and whether they sit or sleep, and
// their last emote (a bubble over their head for a few seconds).
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
}
export type Pose = 'sit' | 'sleep';
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
}
/** Where to go live: someone's island online (as you), or the demo. */
export type LiveCfg = { owner: string; uid: string; name: string } | { demo: string };

const SEND = 400;
const BEAT = 10_000;
const STALE = 30_000;

export function useLive(cfg: LiveCfg | undefined, where: () => Here): Peer[] {
  const [peers, setPeers] = useState<Peer[]>([]);
  const whereRef = useRef(where);
  whereRef.current = where;
  const owner = cfg && 'owner' in cfg ? cfg.owner : null;
  const uid = cfg && 'owner' in cfg ? cfg.uid : null;
  const name = cfg && 'owner' in cfg ? cfg.name : null;
  const demo = cfg && 'demo' in cfg ? cfg.demo : null;

  // Online: follow who's here, and say where you are.
  useEffect(() => {
    if (!owner || !uid || !name) return;
    let gone = false;
    let stop = () => {};
    let timer = 0;
    const leave = () => void import('../cloud/islands').then((c) => c.leaveHere(owner));
    void import('../cloud/islands').then((c) => {
      if (gone) return;
      stop = c.watchHere(owner, (list) => {
        const now = Date.now();
        setPeers(
          list
            .filter((h) => h.uid !== uid && (!h.at || now - h.at.toMillis() < STALE))
            .map((h) => ({ uid: h.uid, name: h.name, face: h.face, x: h.x, y: h.y, left: h.left, tool: h.tool, tv: h.tv ?? null, tune: h.tune ?? null, pose: h.pose ?? null, emote: h.emote ?? null })),
        );
      });
      let last = { x: -99, y: -99, left: false, t: 0, rest: '' };
      timer = window.setInterval(() => {
        if (document.hidden) return;
        const p = whereRef.current();
        const now = Date.now();
        const rest = JSON.stringify([p.tool, p.tv, p.tune, p.pose, p.emote]);
        const moved = Math.abs(p.x - last.x) > 0.02 || Math.abs(p.y - last.y) > 0.02 || p.left !== last.left || rest !== last.rest;
        if (!moved && now - last.t < BEAT) return;
        last = { ...p, t: now, rest };
        c.sayHere(owner, {
          name,
          face: useProgress.getState().avatar ?? null,
          x: Math.round(p.x * 100) / 100,
          y: Math.round(p.y * 100) / 100,
          left: p.left,
          tool: p.tool,
          tv: p.tv,
          tune: p.tune,
          pose: p.pose,
          emote: p.emote,
        }).catch(() => {});
      }, SEND);
    });
    window.addEventListener('pagehide', leave);
    return () => {
      gone = true;
      stop();
      window.clearInterval(timer);
      window.removeEventListener('pagehide', leave);
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
