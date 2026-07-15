import { join, } from 'node:path';

import {
  defineConfig,
  type RolldownOptions,
} from 'rolldown';

import { browserslistTargets, } from './browserslist-targets.ts';
import { packageExternals, } from './package-externals.ts';

/**
 * Resolved Browserslist targets shared by client bundles, via
 * {@link browserslistTargets}.
 */
const target = await browserslistTargets({ runtime: 'browser', },);

/**
 * Bundle-inclusion patterns for client bundles:
 * workspace source plus the heavy browser libraries that must ride inside
 * the self-contained script.
 */
export const CLIENT_ALWAYS_BUNDLE: readonly string[] = [
  '@monochromatic-dev/**',
  '@lezer/**',
  'lezer-**',
  'jspdf',
];

/**
 * Shared raw-rolldown configuration for browser client bundles.
 *
 * Bundles everything reachable (including undeclared transitives) into
 * self-contained browser scripts served as `<script type="module">` tags.
 * Output goes to `dist/client/` with plain `.js` extensions matching
 * existing HTML references. No declarations: client bundles have no type
 * consumers.
 *
 * @example
 * ```ts
 * // rolldown.client.config.ts
 * import base from '\@monochromatic-dev/config-rolldown/.client.ts';
 * import { defineConfig, } from 'rolldown';
 *
 * export default defineConfig({
 *   ...base,
 *   input: ['./src/client/inbox.ts', './src/client/search.ts',],
 * },);
 * ```
 */
const _default_1: RolldownOptions = defineConfig({
  input: ['./src/client.ts',],
  platform: 'neutral',
  resolve: {
    mainFields: [
      'module',
      'main',
    ],
    alias: {
      canvg: join(
        import.meta.dirname,
        'stubs',
        'canvg.ts',
      ),
    },
  },
  external: await packageExternals({ alwaysBundle: CLIENT_ALWAYS_BUNDLE, },),
  transform: { target: [...target,], },
  output: {
    dir: 'dist/client',
    format: 'es',
    entryFileNames: '[name].js',
    chunkFileNames: '[name]-[hash].js',
    cleanDir: true,
    minify: {
      compress: true,
      // Mangle breaks func.name and makes output difficult for users to audit.
      mangle: false,
      codegen: true,
    },
  },
},);
export default _default_1;
