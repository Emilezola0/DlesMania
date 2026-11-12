// Gift codes: typed in the Shop, each once per account (a daily one once a day), by a claim the database keeps
// (src/cloud/rewards.ts claimCode, firestore.rules): a reset browser, another device or a moved clock can't
// redeem one twice. A code is matched without caring about case or
// spaces. Only each code's fingerprint (SHA-256) ships with the site, not the word itself: to add one,
// run scripts/hash-code.mjs and paste the line it prints here.

export interface GiftCode {
  coins: number;
  /** Shown once it's redeemed. */
  note: string;
  /** Redeemable again every day (once a day), not once and for all. */
  daily?: boolean;
  /** Only works on this day (YYYY-MM-DD, the player's own calendar): a one-day event. */
  only?: string;
  /**
   * The commune (the owner's call, 12 Nov 2026): once a day, it doubles the player's DleCoins; everyone who
   * redeems it the same day then ends up with the average of their balances (src/cloud/commune.ts). `coins` unused.
   */
  commune?: true;
}

const CODES: Record<string, GiftCode> = {
  '6722a4db17aa51be4d0dd1f0c70a58342260d08c9e54b8c05ff27b490cc360d2': { coins: 300, note: 'The first code — welcome gift.' },
  'cf236801d18436128120963c02b298ffc05c855453a9df550977d0b1aa177dda': { coins: 300, note: 'For Tokars who need Dle Coins' },
  'd6d9e5b44ffd5a1d622ea6f28e1d618bcd14fb16a9c5860ec4c22c5592f4e24f': { coins: 500, note: 'Because We Love Gamble s love' },
  '343fc0f23e8b0fd743e39f9b56ff6ce8b98587fee55246fae10f5608d3c661f2': { coins: 5000, note: "Have some Fun" },
  '33a0f97d40c9c4890932d4f8935f651a585950fbdda4cbd36fdeef99e72a3b13': { coins: 500, note: "Today's gift — come back tomorrow for another.", daily: true },
  '99409f0abe085d863bbed792a884ff0de238d617d40364e27e447530ba6c521d': { coins: 0, note: 'Your DleCoins, doubled — and shared with every comrade who joins today.', daily: true, commune: true },
};

export const normalizeCode = (code: string) => code.trim().toUpperCase().replace(/\s+/g, '');

/** SHA-256 of a string, in hex: small and synchronous, as redeeming is (and works on any connection). */
function sha256(text: string): string {
  const bytes = new TextEncoder().encode(text);
  const K: number[] = [];
  const H: number[] = [];
  for (let n = 2, found = 0; found < 64; n++) {
    let prime = true;
    for (let d = 2; d * d <= n; d++) if (n % d === 0) prime = false;
    if (!prime) continue;
    if (found < 8) H.push(((Math.sqrt(n) % 1) * 2 ** 32) | 0);
    K.push(((Math.cbrt(n) % 1) * 2 ** 32) | 0);
    found++;
  }
  const blocks = ((bytes.length + 9 + 63) >> 6) * 16;
  const w = new Int32Array(blocks);
  bytes.forEach((b, i) => (w[i >> 2] |= b << (24 - (i % 4) * 8)));
  w[bytes.length >> 2] |= 0x80 << (24 - (bytes.length % 4) * 8);
  w[blocks - 1] = bytes.length * 8;
  const rotr = (x: number, n: number) => (x >>> n) | (x << (32 - n));
  const m = new Int32Array(64);
  for (let i = 0; i < blocks; i += 16) {
    let [a, b, c, d, e, f, g, h] = H;
    for (let t = 0; t < 64; t++) {
      if (t < 16) m[t] = w[i + t];
      else {
        const s0 = rotr(m[t - 15], 7) ^ rotr(m[t - 15], 18) ^ (m[t - 15] >>> 3);
        const s1 = rotr(m[t - 2], 17) ^ rotr(m[t - 2], 19) ^ (m[t - 2] >>> 10);
        m[t] = (m[t - 16] + s0 + m[t - 7] + s1) | 0;
      }
      const t1 = (h + (rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)) + ((e & f) ^ (~e & g)) + K[t] + m[t]) | 0;
      const t2 = ((rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)) + ((a & b) ^ (a & c) ^ (b & c))) | 0;
      h = g;
      g = f;
      f = e;
      e = (d + t1) | 0;
      d = c;
      c = b;
      b = a;
      a = (t1 + t2) | 0;
    }
    [a, b, c, d, e, f, g, h].forEach((v, j) => (H[j] = (H[j] + v) | 0));
  }
  return H.map((v) => (v >>> 0).toString(16).padStart(8, '0')).join('');
}

/** A code's id in the database's claims (part of its fingerprint: never the code itself). */
export const codeId = (code: string) => sha256(`omnidle:${code}`).slice(0, 16);

/** The gift behind a typed (normalized) code, if there is one. */
export const giftFor = (code: string): GiftCode | undefined => CODES[sha256(`omnidle:${code}`)];
