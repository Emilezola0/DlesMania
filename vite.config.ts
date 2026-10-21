import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  // Relative asset paths so the build works from any sub-path (e.g. GitHub Pages /DlesMania/).
  base: './',
  plugins: [react(), tailwindcss()],
  // The bundle is mostly the works dataset (~270 KB gzipped); one chunk is fine for a static site.
  build: { chunkSizeWarningLimit: 1200 },
});
