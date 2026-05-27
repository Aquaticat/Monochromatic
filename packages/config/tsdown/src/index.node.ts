import {
  defineConfig,
  type UserConfig,
} from 'tsdown';

import { browserslistTargets, } from './browserslist-targets.ts';

/** Resolved Browserslist targets shared by Node builds. */
const target = await browserslistTargets({ runtime: 'node', },);

/**
 * Shared tsdown configuration for Node.js platform builds.
 *
 * Bundles workspace dependencies (`@monochromatic-dev/*`) into the output
 * so built artifacts are self-contained and work outside the monorepo
 * (e.g. Claude Code plugins installed via marketplace).
 *
 * @example
 * ```ts
 * // tsdown.node.config.ts
 * import base from '\@monochromatic-dev/config-tsdown/.node.ts';
 * export default defineConfig({ ...base, entry: ['./src/index.ts'] });
 * ```
 */
const _default_1: UserConfig = defineConfig({
  entry: ['./src/index.ts',],
  dts: true,
  target,
  platform: 'node',
  deps: {
    alwaysBundle: [
      '@monochromatic-dev/**',
      'find-up',
      'nano-spawn',
    ],
    neverBundle: [
      // Pi extension peer deps: provided by the pi runtime at load time.
      // Bundling them duplicates the pi API and causes CJS/ESM
      // "exports is not defined" errors.
      '@earendil-works/pi-coding-agent',
      'typebox',
      // Pi AI providers: provided by the pi runtime at load time.
      '@earendil-works/pi-ai',
    ],
  },
  minify: {
    compress: true,
    // Mangle breaks func.name and makes output difficult for users to audit.
    mangle: false,
    codegen: true,
  },
  report: false,
  outDir: 'dist/final/node',
  fixedExtension: true,
},);
export default _default_1;
