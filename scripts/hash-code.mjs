#!/usr/bin/env node
// Makes a gift code's line for src/gacha/codes.ts: the site only ever holds the code's fingerprint.
//
//   npm run code:hash -- "MY CODE" 500 "Shown once it's redeemed"
//
// Keep the code itself out of the repo: only the printed line goes in.
import { createHash } from 'node:crypto';

const [raw, coins = '100', note = 'A gift!'] = process.argv.slice(2);
if (!raw) {
  console.error('Usage: npm run code:hash -- "MY CODE" 500 "Shown once it\'s redeemed"');
  process.exit(1);
}
const code = raw.trim().toUpperCase().replace(/\s+/g, '');
const hash = createHash('sha256').update(`omnidle:${code}`).digest('hex');
console.log(`  '${hash}': { coins: ${Number(coins)}, note: ${JSON.stringify(note)} },`);
