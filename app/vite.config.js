import { defineConfig } from 'vite';

export default defineConfig({
  base: './',  // chemins relatifs pour Electron (chargement via loadFile)
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
});
