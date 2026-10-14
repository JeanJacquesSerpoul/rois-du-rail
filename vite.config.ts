import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  // GitHub Pages sert le site sous /<nom-du-dépôt>/
  base: process.env.BASE_PATH ?? '/',
  plugins: [react()],
  server: {
    proxy: { '/api': 'http://localhost:3001' },
  },
});
