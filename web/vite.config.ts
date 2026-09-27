import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  // GitHub Pages serves the repo at /<repo>/ — set VITE_BASE=/Veilance/ for that build.
  base: process.env.VITE_BASE ?? '/',
  plugins: [react()],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  server: { port: 5173, host: true },
  preview: { port: 4173, host: true },
});
