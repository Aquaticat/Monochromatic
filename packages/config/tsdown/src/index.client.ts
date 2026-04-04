import { join, } from 'node:path';

import {
  defineConfig,
  type UserConfig,
} from 'tsdown';

/**
 * Shared tsdown configuration for browser client bundles.
 *
 * Bundles everything (including node_modules) into self-contained browser scripts
 * served as `<script type="module">` tags. Output goes to `dist/client/`
 * with plain `.js` extensions matching existing HTML references.
 *
 * @example
 * ```ts
 * // tsdown.browser.config.ts
 * import base from '\@monochromatic-dev/config-tsdown/.client.ts';
 * import { defineConfig } from 'tsdown';
 *
 * export default defineConfig({
 *   ...base,
 *   entry: ['./src/client/inbox.ts', './src/client/search.ts'],
 * });
 * ```
 */
const _default_1: UserConfig = defineConfig({
  entry: ['./src/client.ts',],
  dts: false,
  target: 'firefox140',
  platform: 'neutral',
  inputOptions: {
    resolve: {
      mainFields: [
        'module',
        'main',
      ],
      alias: {
        canvg: join(import.meta.dirname, 'stubs', 'canvg.ts'),
      },
    },
  },
  deps: {
    alwaysBundle: [
      /^@monochromatic-dev\//,
      /^@lezer\//,
      /^lezer-/,
      /^jspdf$/,
    ],
  },
  minify: process.env.NODE_ENV === 'production',
  report: false,
  outDir: 'dist/client',
},);
export default _default_1;
