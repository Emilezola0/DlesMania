import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  // Relative asset paths so the build works from any sub-path (e.g. GitHub Pages /DlesMania/).
  base: './',
  plugins: [react(), tailwindcss()],
});
