import {
  defineConfig,
} from 'vite';
import {
  browserslistToTargets,
} from 'lightningcss';
import browserslist from 'browserslist';
import {
  resolveToEsbuildTarget,
} from 'esbuild-plugin-browserslist';

export default defineConfig({
  css: {
    devSourcemap: true,

    transformer: 'lightningcss',

    lightningcss: {
      targets: browserslistToTargets(
        browserslist(),
      ),

      drafts: {
        customMedia: true,
      },
    },
  },

  json: {
    stringify: true,
  },

  esbuild: {
    minifyIdentifiers: false,
  },

  clearScreen: false,

  // We don't need SPA fallback.
  appType: 'mpa',

  server: {
    strictPort: true,
    open: 'index.html',
  },

  build: {
    target: resolveToEsbuildTarget(browserslist()),
    cssMinify: 'lightningcss',
    reportCompressedSize: false,
  },

  worker: {
    format: 'es',
  },
});
