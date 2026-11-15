// Island players seen live (src/island/IslandView.tsx): on a shared island, everyone there sees the others walk.
// Each player writes where they stand (src/cloud/islands.ts, islands/<owner>/here/<uid>) about every SEND ms while
// they move, and every BEAT ms while they stand still; the others glide smoothly between those points. Gone after
// STALE ms without news (a closed tab), and removed when they leave. The demo makes up a friend walking about.
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
}
/** Where to go live: someone's island online (as you), or the demo. */
export type LiveCfg = { owner: string; uid: string; name: string } | { demo: string };

const SEND = 400;
const BEAT = 10_000;
const STALE = 30_000;

export function useLive(cfg: LiveCfg | undefined, where: () => { x: number; y: number; left: boolean }): Peer[] {
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
            .map((h) => ({ uid: h.uid, name: h.name, face: h.face, x: h.x, y: h.y, left: h.left })),
        );
      });
      let last = { x: -99, y: -99, left: false, t: 0 };
      timer = window.setInterval(() => {
        if (document.hidden) return;
        const p = whereRef.current();
        const now = Date.now();
        const moved = Math.abs(p.x - last.x) > 0.02 || Math.abs(p.y - last.y) > 0.02 || p.left !== last.left;
        if (!moved && now - last.t < BEAT) return;
        last = { ...p, t: now };
        c.sayHere(owner, { name, face: useProgress.getState().avatar ?? null, x: Math.round(p.x * 100) / 100, y: Math.round(p.y * 100) / 100, left: p.left }).catch(() => {});
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

  // The demo: a friend strolling back and forth, hopping now and then.
  useEffect(() => {
    if (!demo) return;
    const t0 = Date.now();
    const timer = window.setInterval(() => {
      const t = (Date.now() - t0) / 1000;
      const x = ISLAND.w / 2 + Math.sin(t / 4) * 9;
      const cx = Math.max(0, Math.min(ISLAND.w - 1, Math.floor(x + 0.4)));
      const hop = Math.max(0, Math.sin(t * 2.2)) > 0.92 ? 0.8 : 0;
      setPeers([{ uid: 'demo', name: demo, face: null, x, y: surfaceAt(cx) - 0.93 - hop, left: Math.cos(t / 4) < 0 }]);
    }, SEND);
    return () => window.clearInterval(timer);
  }, [demo]);

  return peers;
}
