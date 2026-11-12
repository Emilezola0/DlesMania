#!/usr/bin/env node
// The Forts and For Honor Omnis' videos and voices (the owner's picks, 12 Nov 2026), made with scripts/card-clip.mjs.
// YouTube refuses downloads from cloud machines ("Sign in to confirm you're not a bot"): run this on a computer
// with yt-dlp, ffmpeg and deno (see card-clip.mjs), from the repository's folder:
//   node scripts/data/omni-clips-forts-forhonor.mjs
// It writes public/clips/forts/{core-swing,la-speciale-voice}.mp4 and public/clips/forhonor/apollyon-war-{sound-1..9,voice}.mp4,
// which src/gacha/cards.ts already points to. Then commit them.
import { spawnSync } from 'node:child_process';

const jobs = [
  // Forts: Pile Rouillée's Core Swing (FPL Season 5), silent — "La Spéciale" plays over it (the owner's call).
  ['https://youtu.be/mnmhN-7Q4SA', '8:35', '8:50', 'forts/core-swing', true],
  ['https://youtu.be/ZMEoZ07MnZc', '0:50', '1:05', 'forts/la-speciale-voice', false],
  // For Honor: Apollyon, 0:17 to 2:28 cut in 15 s clips, with their own sound (the owner's call, 12 Nov 2026);
  // "War… I am war" stays her voice line for the small moments.
  ...Array.from({ length: 9 }, (_, i) => {
    const from = 17 + i * 15;
    const to = Math.min(from + 15, 148);
    return ['https://youtu.be/zFUymXnQ5z8', String(from), String(to), `forhonor/apollyon-war-sound-${i + 1}`, false];
  }),
  ['https://youtu.be/WomoIywubm4', '11:42', '11:47', 'forhonor/apollyon-war-voice', false],
];

for (const [url, from, to, out, mute] of jobs) {
  const args = ['scripts/card-clip.mjs', `--url=${url}`, `--from=${from}`, `--to=${to}`, `--out=${out}`, ...(mute ? ['--mute'] : [])];
  console.log(`\n== ${out} (${from}–${to}${mute ? ', silent' : ''})`);
  const r = spawnSync(process.execPath, args, { stdio: 'inherit' });
  if (r.status !== 0) {
    console.error(`Stopped at ${out}.`);
    process.exit(r.status ?? 1);
  }
}
console.log('\nDone: 11 files in public/clips/forts and public/clips/forhonor. Commit them.');
