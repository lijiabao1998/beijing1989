import { defineConfig } from 'vite';

// Served at https://game.lijiabao.uk/beijing1989/ — relative base keeps every asset under the subpath.
export default defineConfig({
  base: './',
  build: {
    chunkSizeWarningLimit: 550,
    rollupOptions: {
      output: {
        manualChunks(id) {
          const n = id.replace(/\\/g, '/');
          if (n.includes('/node_modules/three/')) return 'three-vendor';
          if (
            n.includes('/src/render/sets/') ||
            n.includes('/src/render/imperial') ||
            n.includes('/src/render/factoryArch') ||
            n.includes('/src/render/streetScene') ||
            n.includes('/src/render/campusArch')
          ) {
            return 'scenes-world';
          }
          if (n.includes('/data/dialogue/') || n.includes('/data/events/')) return 'chronicle-data';
          if (
            n.includes('/src/ui/lianhuanhuaBook') ||
            n.includes('/src/ui/darkroom') ||
            n.includes('/src/ui/tactileObjects') ||
            n.includes('/src/ui/documentaryReel') ||
            n.includes('/src/ui/reelArtwork')
          ) {
            return 'ui-archives';
          }
          return undefined;
        },
      },
    },
  },
});
