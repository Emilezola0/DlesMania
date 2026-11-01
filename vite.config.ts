/// <reference types="node" />
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

/**
 * One id per build: the commit (GITHUB_SHA in Actions, git locally) plus the build time, so two
 * builds of the same commit still differ. The app is compiled with it, and version.json is written
 * next to index.html; the page polls that file to notice when a newer build is live.
 */
function buildVersion(): string {
  let sha = process.env.GITHUB_SHA ?? '';
  if (!sha) {
    try {
      sha = execSync('git rev-parse HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
    } catch {
      sha = 'local';
    }
  }
  return `${sha.slice(0, 7)}-${Date.now().toString(36)}`;
}

const VERSION = buildVersion();

/**
 * The version players see, MAJOR.MINOR.PATCH (shown small in the footer). MAJOR.MINOR is package.json's,
 * raised by hand: the middle number when an update brings something new (a game, a mode, content), the
 * first for a big overhaul. PATCH counts itself: the commits pushed since package.json's version last
 * changed (every fix and tweak since). 1.0.0 was the launch, 18 October 2026.
 */
function releaseVersion(): string {
  const declared: string = JSON.parse(readFileSync('package.json', 'utf8')).version;
  const [major, minor] = declared.split('.');
  try {
    const run = (cmd: string) => execSync(cmd, { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
    const since = run('git log -1 --format=%H -G\'"version"\' -- package.json');
    if (!since) return declared;
    return `${major}.${minor}.${run(`git rev-list --count ${since}..HEAD`)}`;
  } catch {
    return declared;
  }
}

function versionFile(): Plugin {
  return {
    name: 'omnidle-version-file',
    apply: 'build',
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify({ version: VERSION, builtAt: new Date().toISOString() }) });
    },
  };
}

export default defineConfig({
  // Relative asset paths so the build works from any sub-path (e.g. GitHub Pages /DlesMania/).
  base: './',
  plugins: [react(), tailwindcss(), versionFile()],
  define: { __APP_VERSION__: JSON.stringify(VERSION), __APP_RELEASE__: JSON.stringify(releaseVersion()) },
  // The bundle is mostly the works dataset (~270 KB gzipped); one chunk is fine for a static site.
  build: { chunkSizeWarningLimit: 1200 },
});
