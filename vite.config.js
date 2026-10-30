import { defineConfig } from 'vite';

// https://vitejs.dev/config/
export default defineConfig({
  base: './', // Relative base path ensures 100% compatibility with GitHub Pages, Vercel, Netlify, etc.
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false
  }
});
