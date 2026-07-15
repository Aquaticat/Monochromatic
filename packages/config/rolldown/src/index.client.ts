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
 * Externals shared by every client bundle produced from the consuming
 * package's manifest at import time.
 */
const clientExternal = await packageExternals({ alwaysBundle: CLIENT_ALWAYS_BUNDLE, },);

/**
 * Build one client bundle config with overridable inputs.
 *
 * Bundles everything reachable (including undeclared transitives) into
 * self-contained browser scripts served as `<script type="module">` tags.
 * Output goes to `dist/client/` with plain `.js` extensions matching
 * existing HTML references. No declarations: client bundles have no type
 * consumers.
 *
 * @param input - Client entry paths; defaults to the package client index.
 *
 * @returns Client flavor rolldown config producing self-contained scripts.
 *
 * @example
 * ```ts
 * // rolldown.client.config.ts
 * import { clientConfig, } from '\@monochromatic-dev/config-rolldown/.client.ts';
 * export default clientConfig({ input: ['./src/client/main.ts',], },);
 * ```
 */
export function clientConfig({ input = ['./src/client.ts',], }: {
  readonly input?: readonly string[];
} = {},): RolldownOptions {
  return defineConfig({
    input: [...input,],
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
    external: clientExternal,
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
}

/**
 * Default single-input client bundle config via {@link clientConfig}.
 */
const _default_1: RolldownOptions = clientConfig();
export default _default_1;
