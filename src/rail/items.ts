/** What a station offers: pick one of three. */
export type RailItemId = 'airbag' | 'wagon' | 'brake' | 'lantern' | 'longview' | 'switch';

export const RAIL_ITEMS: Record<RailItemId, { icon: string; name: string; blurb: string }> = {
  airbag: { icon: '🎈', name: 'Air bag', blurb: 'The next crash costs nothing. They stack.' },
  wagon: { icon: '🚃', name: 'Extra wagon', blurb: 'One more wagon: one more crash you can take.' },
  brake: { icon: '🛑', name: 'Brake', blurb: 'A quarter slower until the next station.' },
  lantern: { icon: '🏮', name: 'Lantern', blurb: "Each sign shows the first letter of its character's name, until the next station." },
  longview: { icon: '🔭', name: 'Long view', blurb: 'Gates come into sight 1.5 s earlier, until the next station.' },
  switch: { icon: '🔀', name: 'Switch line', blurb: 'Ride another game from here. A line you haven’t ridden yet adds ×0.5 to every gate.' },
};

/** Gates between two stations. */
export const GATES_PER_STATION = 10;
/** No train pulls more than this. */
export const MAX_WAGONS = 5;
/** What a new line adds to the points each gate is worth. */
export const NEW_LINE_BONUS = 0.5;

/** Three different items; no extra wagon for a full train. */
export function stationOffer(wagons: number, rand: () => number = Math.random): RailItemId[] {
  const pool = (Object.keys(RAIL_ITEMS) as RailItemId[]).filter((id) => id !== 'wagon' || wagons < MAX_WAGONS);
  const out: RailItemId[] = [];
  while (out.length < 3 && pool.length) out.push(pool.splice(Math.floor(rand() * pool.length), 1)[0]);
  return out;
}
