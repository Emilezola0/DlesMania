#!/usr/bin/env node
// Firefox checks: drives the Firefox installed on this machine (through its WebDriver BiDi remote control, with
// puppeteer-core), headless, in a throwaway profile, against the dev server (npm run dev). For what only goes wrong in
// Firefox: 3D, video playback, layout. Prints what it measures and saves screenshots.
//
//   node scripts/firefox-check.mjs --path=/#/specialist --shot
//   node scripts/firefox-check.mjs --give=minecraft:omni-steve --card=Steve --play --seconds=5
//   node scripts/firefox-check.mjs --give=dbz:omni --awake=dbz --card=Goku --play
//   node scripts/firefox-check.mjs --path=/#/album --steps=some-steps.mjs   (export default async (page, h) => { … })
//
// --give=id,id   cards added to the profile's save (the Album then shows them; --card opens one up close)
// --awake=set    that set's guardian beaten on Hard, so its Omni shows its awakened form
// --card=Name    open the card whose tile is labelled "Name, <rarity>" (the first one shown)
// --play         press "Play its video" and follow the video: time, frames drawn, dropped, errors
// --seconds=N    how long to follow it (4)      --shot   a screenshot at the end (always taken with --play)
// --size=WxH     the window (1280x900)          --headful   a visible window, to watch
// --reduced-motion   Firefox set to reduce motion (the card's sway and the CSS animations stop)
// --chrome       the same in the installed Chrome instead, to compare (a Firefox-only fault shows only without it)
// --base=URL     the dev server (http://localhost:5173)
//
// Firefox comes from FIREFOX_PATH, or C:\Program Files\Mozilla Firefox\firefox.exe. Its videos are decoded as on any
// machine without the owner's settings or extensions: a fault that comes from those won't show here.
import { existsSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import puppeteer from 'puppeteer-core';
import { parseArgs } from './lib.mjs';

const { flags } = parseArgs();
const base = String(flags.base ?? 'http://localhost:5173').replace(/\/$/, '');
const firefox = process.env.FIREFOX_PATH ?? ['C:/Program Files/Mozilla Firefox/firefox.exe', 'C:/Program Files (x86)/Mozilla Firefox/firefox.exe', '/usr/bin/firefox', '/Applications/Firefox.app/Contents/MacOS/firefox'].find(existsSync);
if (!firefox) throw new Error('Firefox not found: set FIREFOX_PATH');
try {
  await fetch(base);
} catch {
  console.error(`No dev server at ${base}: start it (npm run dev) first.`);
  process.exit(1);
}
const [width, height] = String(flags.size ?? '1280x900').split('x').map(Number);
const outDir = join(tmpdir(), 'omnidle-firefox');
mkdirSync(outDir, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (label, value) => console.log(`${label.padEnd(10)} ${typeof value === 'string' ? value : JSON.stringify(value)}`);

// --chrome: the same steps in the Chrome installed here, to compare what Firefox does with what Chrome does.
const chrome = flags.chrome && ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'].find(existsSync);
if (flags.chrome && !chrome) throw new Error('Chrome not found');
const browser = await puppeteer.launch({
  browser: chrome ? 'chrome' : 'firefox',
  executablePath: chrome || firefox,
  headless: !flags.headful,
  defaultViewport: { width, height },
  // Firefox's own "reduce motion" setting (prefers-reduced-motion: reduce), to tell whether an animation is the cause.
  extraPrefsFirefox: flags['reduced-motion'] ? { 'ui.prefersReducedMotion': 1 } : {},
});
const page = await browser.newPage();
const errors = [];
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
page.on('pageerror', (e) => errors.push(String(e)));

/** Helpers handed to --steps scripts too. */
const h = {
  sleep,
  log,
  /** A screenshot in the output folder; returns its path. */
  shot: async (name) => {
    const path = join(outDir, `${name}.png`);
    await page.screenshot({ path });
    log('shot', path);
    return path;
  },
  /** Clicks the first button whose label (aria-label, else text) starts with `text`. */
  click: async (text) => {
    const done = await page.evaluate((t) => {
      const b = [...document.querySelectorAll('button')].find((x) => (x.getAttribute('aria-label') || x.textContent || '').trim().startsWith(t));
      if (!b) return false;
      b.scrollIntoView({ block: 'center' });
      b.click();
      return true;
    }, text);
    if (!done) throw new Error(`No button starting with "${text}"`);
  },
  /** Follows the video showing up close (not a hidden preload) for `seconds`, twice a second. */
  followVideo: async (seconds) => {
    await page.evaluate(() => {
      window.__ff = { frames: 0 };
      const watch = () => {
        const v = [...document.querySelectorAll('.fixed video')].find((x) => !x.className.includes('opacity-0'));
        if (!v) return void setTimeout(watch, 100);
        window.__ff.v = v;
        const cb = () => (window.__ff.frames++, v.requestVideoFrameCallback(cb));
        v.requestVideoFrameCallback?.(cb);
      };
      watch();
    });
    for (let i = 1; i <= seconds * 2; i++) {
      await sleep(500);
      const s = await page.evaluate(() => {
        const v = window.__ff.v;
        if (!v) return { video: 'none yet' };
        const q = v.getVideoPlaybackQuality?.();
        return { t: +v.currentTime.toFixed(2), paused: v.paused, muted: v.muted, ready: v.readyState, drawn: window.__ff.frames, decoded: q?.totalVideoFrames, dropped: q?.droppedVideoFrames, error: v.error?.message ?? null, src: v.currentSrc.split('/clips/')[1] };
      });
      log(`${(i / 2).toFixed(1)} s`, s);
    }
  },
};

await page.goto(`${base}/`, { waitUntil: 'load' });
if (flags.give || flags.awake) {
  // The save, through the app's own store (the dev server serves its modules).
  await page.evaluate(
    async (give, awake) => {
      const { useProgress, bossKey } = await import('/src/store/progress.ts');
      const s = useProgress.getState();
      const cards = { ...s.cards };
      for (const id of give) cards[id] = Math.max(1, cards[id] ?? 0);
      const bosses = { ...s.bosses };
      if (awake) bosses[bossKey(awake, 'hard')] = { ...(bosses[bossKey(awake, 'hard')] ?? {}), wins: 1 };
      useProgress.setState({ cards, bosses });
    },
    flags.give ? String(flags.give).split(',') : [],
    flags.awake ? String(flags.awake) : null,
  );
}
await page.goto(`${base}/${String(flags.path ?? (flags.card ? '#/album' : '')).replace(/^\//, '')}`, { waitUntil: 'load' });
await page.reload({ waitUntil: 'load' });
await sleep(1500);

if (flags.card) {
  // The album only builds the tiles in view: search for the card first.
  const search = await page.$('input[type="search"]');
  if (search) {
    await search.type(String(flags.card));
    await sleep(800);
  }
  await h.click(`${flags.card},`);
  await sleep(1500);
  log('card', await page.evaluate(() => [document.querySelector('.fixed p.font-display')?.textContent, document.querySelector('.fixed p.italic')?.textContent].filter(Boolean).join(' — ')));
}
if (flags.play) {
  await h.click('▶ Play its video');
  await h.followVideo(Number(flags.seconds ?? 4));
}
if (flags.steps) await (await import(pathToFileURL(resolve(String(flags.steps))).href)).default(page, h);
if (flags.shot || flags.play) await h.shot(`firefox-${Date.now()}`);
if (errors.length) log('errors', errors.slice(0, 10));
await browser.close();
