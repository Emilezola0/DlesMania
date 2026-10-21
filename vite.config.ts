/// <reference types="node" />
import { execSync } from 'node:child_process';
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
  define: { __APP_VERSION__: JSON.stringify(VERSION) },
  // The bundle is mostly the works dataset (~270 KB gzipped); one chunk is fine for a static site.
  build: { chunkSizeWarningLimit: 1200 },
});
