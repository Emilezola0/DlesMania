#!/usr/bin/env node
// How the site runs on a phone: opens pages in the installed Chrome as a phone (375x812, touch, the processor slowed
// 4x and a fast 4G connection, like a mid-range phone) and measures, per page: when something first shows (FCP), when
// the main content shows (LCP), how long the page was too busy to answer a tap (long tasks over 50 ms, total), and how
// smoothly it then animates (frames per second over a few seconds, and the slowest frame).
//
//   npm run build && npm run preview -- --port 4173      then
//   node scripts/phone-perf.mjs --base=http://localhost:4173
//   node scripts/phone-perf.mjs --paths=/,/album --cpu=6 --seconds=5 --tablet
//   node scripts/phone-perf.mjs --save=save.json --scroll   a save to start from (the localStorage 'omnidle-progress' value:
//                                                          cards owned, an equipped card…), and frames counted while scrolling
import { existsSync, readFileSync } from 'node:fs';
import puppeteer from 'puppeteer-core';
import { parseArgs } from './lib.mjs';

const { flags } = parseArgs();
const base = String(flags.base ?? 'http://localhost:4173').replace(/\/$/, '');
const chrome = process.env.CHROME_PATH ?? ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'].find(existsSync);
if (!chrome) throw new Error('Chrome not found: set CHROME_PATH');
const paths = String(flags.paths ?? '/,/daily,/daily/games,/games,/album,/casino,/boss,/boss/shrek,/specialist,/shop,/jlpt').split(',');
const cpu = Number(flags.cpu ?? 4);
const seconds = Number(flags.seconds ?? 3);
const [width, height] = flags.tablet ? [768, 1024] : [375, 812];
const save = flags.save ? readFileSync(String(flags.save), 'utf8') : null;

const browser = await puppeteer.launch({ browser: 'chrome', executablePath: chrome, headless: true });
const rows = [];
for (const path of paths) {
  // A fresh page (and an empty cache) for each, as a first visit.
  const ctx = await browser.createBrowserContext();
  const page = await ctx.newPage();
  await page.setViewport({ width, height, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  const cdp = await page.createCDPSession();
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpu });
  await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 60, downloadThroughput: (9 * 1024 * 1024) / 8, uploadThroughput: (1.5 * 1024 * 1024) / 8 });
  if (save) await page.evaluateOnNewDocument((v) => localStorage.getItem('omnidle-progress') || localStorage.setItem('omnidle-progress', v), save);
  await page.evaluateOnNewDocument(() => {
    window.__perf = { long: 0, lcp: 0 };
    new PerformanceObserver((l) => l.getEntries().forEach((e) => (window.__perf.long += e.duration - 50))).observe({ type: 'longtask', buffered: true });
    new PerformanceObserver((l) => l.getEntries().forEach((e) => (window.__perf.lcp = e.startTime))).observe({ type: 'largest-contentful-paint', buffered: true });
  });
  const t0 = Date.now();
  await page.goto(`${base}/#${path}`, { waitUntil: 'load', timeout: 120000 });
  await page.waitForNetworkIdle({ idleTime: 500, timeout: 60000 }).catch(() => {});
  const loaded = Date.now() - t0;
  const bytes = await page.evaluate(() => performance.getEntriesByType('resource').reduce((n, r) => n + (r.transferSize || 0), 0) + (performance.getEntriesByType('navigation')[0]?.transferSize || 0));
  const fcp = await page.evaluate(() => performance.getEntriesByName('first-contentful-paint')[0]?.startTime ?? 0);
  const anim = await page.evaluate(
    (ms, scroll) =>
      new Promise((done) => {
        const times = [];
        const start = performance.now();
        const tick = (t) => {
          times.push(t);
          // Scrolling down and back, as a thumb would.
          if (scroll) window.scrollBy(0, Math.floor((t - start) / 1500) % 2 ? -40 : 40);
          if (t - start < ms) requestAnimationFrame(tick);
          else {
            let worst = 0;
            for (let i = 1; i < times.length; i++) worst = Math.max(worst, times[i] - times[i - 1]);
            done({ fps: Math.round(((times.length - 1) * 1000) / (times.at(-1) - times[0])), worst: Math.round(worst) });
          }
        };
        requestAnimationFrame(tick);
      }),
    seconds * 1000,
    !!flags.scroll,
  );
  const p = await page.evaluate(() => window.__perf);
  rows.push({ path, kb: Math.round(bytes / 1024), fcp: Math.round(fcp), lcp: Math.round(p.lcp), blocked: Math.round(p.long), loaded, ...anim });
  await ctx.close();
}
await browser.close();
console.log(`${flags.tablet ? 'Tablet' : 'Phone'} ${width}x${height}, processor ${cpu}x slower, fast 4G`);
console.log('page'.padEnd(16) + 'KB'.padStart(7) + 'FCP ms'.padStart(9) + 'LCP ms'.padStart(9) + 'blocked'.padStart(9) + 'fps'.padStart(6) + 'worst'.padStart(7));
for (const r of rows) console.log(r.path.padEnd(16) + String(r.kb).padStart(7) + String(r.fcp).padStart(9) + String(r.lcp).padStart(9) + String(r.blocked).padStart(9) + String(r.fps).padStart(6) + String(r.worst).padStart(7));
