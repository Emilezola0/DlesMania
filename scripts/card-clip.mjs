#!/usr/bin/env node
// A card's video, hosted with the site (public/clips/): never a YouTube or TikTok embed on a card, whose players show
// their own buttons (a pause button for ~4 s after any seek, titles, "More videos") and can't be hidden.
//
// Downloads one moment of a video (YouTube, TikTok…) with yt-dlp, crops its black bars, and encodes it for both places
// it shows: the card up close (a small frame) and the full-screen background behind a win (so it must stay sharp).
//
//   node scripts/card-clip.mjs --url=https://youtu.be/BAQvCB3Fnm0 --from=19 --to=41 --out=dbz/goku-ultra-instinct
//   node scripts/card-clip.mjs --url=... --from=0 --to=5 --out=forts/howitzer --mute     (no sound track)
//   node scripts/card-clip.mjs --url=... --from=1:15 --to=1:30 --out=shrek/lord-farquaad-2 --crop=1920:730:0:170   (subtitles burnt in: cut by hand)
//   node scripts/card-clip.mjs --url=... --from=0 --to=3 --out=lotr-mythic --gif         (a GIF: clips/gif/, loops, no sound)
//
// --from/--to accept seconds (19, 9.7) or m:ss (12:44). Then point the card at it in src/gacha/cards.ts (the line is
// printed): CLIPS (an Omni's awakened form, or the card), FIRST_CLIPS (an Omni's first form). A clip that has its own
// sound needs `clipSound: true` in STRONG; a clip that is also the voice line uses the same path as `audio`.
//
// Settings (tried side by side on Luffy's Gear 5, the hardest clip — 540p/CRF 31 was visibly blocky full screen):
// 1080p max, H.264 High CRF 24 (preset slow), a constant frame rate (an odd one, like 29.376 fps, froze the picture
// in some browsers while the sound went on), AAC 128 kb/s, index first (+faststart) so it starts before it's all
// loaded. GIFs: their own size, CRF 26, no sound. About 0.3–0.7 MB a second of video.
//
// Needs yt-dlp, ffmpeg and deno (yt-dlp needs a JavaScript runtime to get YouTube's 1080p, or it stops at 360p):
//   winget install yt-dlp.yt-dlp   (brings ffmpeg)      winget install DenoLand.Deno
// A file that changes keeps its old name in browsers' caches: give it a new name (e.g. -30fps) when re-encoding.
import { existsSync, mkdirSync, readdirSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { ROOT, parseArgs } from './lib.mjs';

const { flags } = parseArgs();
const usage = 'node scripts/card-clip.mjs --url=<video> --from=<s|m:ss> --to=<s|m:ss> --out=<set/name> [--mute] [--gif] [--fps=30] [--crop=w:h:x:y]';
if (!flags.url || flags.from === undefined || flags.to === undefined || !flags.out) {
  console.error(usage);
  process.exit(1);
}
const seconds = (t) => String(t).split(':').reduce((a, b) => a * 60 + Number(b), 0);
const from = seconds(flags.from);
const to = seconds(flags.to);
const gif = !!flags.gif;
const mute = gif || !!flags.mute;
const fps = Number(flags.fps ?? 30);

/** A tool on the PATH, or where winget puts it (its PATH change needs a new shell). */
function tool(name) {
  if (spawnSync(name, ['--version'], { stdio: 'ignore' }).status === 0) return name;
  const packages = join(process.env.LOCALAPPDATA ?? '', 'Microsoft', 'WinGet', 'Packages');
  const find = (dir, depth) => {
    if (depth > 4 || !existsSync(dir)) return null;
    for (const entry of readdirSync(dir)) {
      const path = join(dir, entry);
      if (entry.toLowerCase() === `${name}.exe`) return path;
      if (statSync(path).isDirectory()) {
        const found = find(path, depth + 1);
        if (found) return found;
      }
    }
    return null;
  };
  const found = find(packages, 0);
  if (!found) {
    console.error(`${name} not found: winget install ${name === 'deno' ? 'DenoLand.Deno' : 'yt-dlp.yt-dlp'}`);
    process.exit(1);
  }
  return found;
}
const run = (cmd, args) => {
  const r = spawnSync(cmd, args, { encoding: 'utf8', maxBuffer: 1 << 26 });
  if (r.status !== 0) {
    console.error(r.stderr || r.stdout);
    process.exit(1);
  }
  return `${r.stdout}${r.stderr}`;
};

const ytdlp = tool('yt-dlp');
const ffmpeg = tool('ffmpeg');
const deno = tool('deno');
const ffdir = ffmpeg === 'ffmpeg' ? null : join(ffmpeg, '..');

// 1. The moment, at up to 1080p (H.264 first: no re-encoding surprises).
const work = join(tmpdir(), `omnidle-clip-${Date.now()}`);
mkdirSync(work, { recursive: true });
console.log(`Downloading ${from}–${to} s of ${flags.url}…`);
run(ytdlp, [
  '-q', '--no-warnings', '--js-runtimes', `deno:${deno}`, ...(ffdir ? ['--ffmpeg-location', ffdir] : []),
  '-f', 'bv*[height<=1080][vcodec^=avc1]+ba[ext=m4a]/bv*[height<=1080]+ba/b',
  '--merge-output-format', 'mp4', '--download-sections', `*${from}-${to}`, '--force-keyframes-at-cuts',
  '-o', join(work, 'raw.%(ext)s'), flags.url,
]);
const raw = join(work, readdirSync(work).find((f) => f.startsWith('raw.')));

// 2. Its black bars (letterboxing), measured over the whole moment — or --crop=w:h:x:y, chosen by eye (to cut out
//    subtitles or a channel's logo burnt into the picture).
const crop = flags.crop ? `crop=${flags.crop}` : run(ffmpeg, ['-hide_banner', '-i', raw, '-vf', 'cropdetect=limit=0.1:round=2:reset=0', '-f', 'null', '-']).match(/crop=\d+:\d+:\d+:\d+/g)?.pop();
console.log(flags.crop ? `Crop: ${crop} (given)` : `Bars: ${crop ?? 'none found'} (check dark scenes by eye: cropdetect can mistake them for bars)`);

// 3. The encode.
const name = gif ? join('gif', flags.out.replace(/\//g, '-')) : flags.out;
const out = join(ROOT, 'public', 'clips', `${name}.mp4`);
mkdirSync(join(out, '..'), { recursive: true });
const filters = [crop, gif ? null : `fps=${fps}`, gif ? null : "scale='min(1920,iw)':-2"].filter(Boolean).join(',');
run(ffmpeg, [
  '-v', 'error', '-y', '-i', raw, ...(filters ? ['-vf', filters] : []), ...(gif ? [] : ['-fps_mode', 'cfr']),
  '-c:v', 'libx264', '-preset', 'slow', '-crf', gif ? '26' : '24', '-pix_fmt', 'yuv420p',
  ...(mute ? ['-an'] : ['-c:a', 'aac', '-b:a', '128k']), '-movflags', '+faststart', out,
]);
rmSync(work, { recursive: true, force: true });

const kb = Math.round(statSync(out).size / 1024);
console.log(`\n→ public/clips/${name.replace(/\\/g, '/')}.mp4 (${kb} KB)`);
console.log(`In src/gacha/cards.ts:  \`\${import.meta.env?.BASE_URL ?? './'}clips/${name.replace(/\\/g, '/')}.mp4\``);
