import {
  defineConfig,
  type UserConfig,
} from 'tsdown';

import { browserslistTargets, } from './browserslist-targets.ts';

/**
 * Resolved Browserslist targets shared by neutral builds, via
 * {@link browserslistTargets}.
 */
const target = await browserslistTargets({ runtime: 'browser', },);

/**
 * Shared tsdown configuration for neutral (browser-compatible) platform builds.
 *
 * Bundles workspace dependencies (`@monochromatic-dev/*`) into the output
 * so built artifacts are self-contained and work outside the monorepo.
 *
 * Selects Oxc declaration generation explicitly because repository source
 * satisfies `isolatedDeclarations`; this keeps declaration emission local to
 * each Rolldown module and prevents TypeScript 7 from selecting experimental
 * tsgo for cross-package source bundles.
 *
 * @example
 * ```ts
 * // tsdown.browser.config.ts
 * import base from '\@monochromatic-dev/config-tsdown/.ts';
 * export default defineConfig({ ...base, entry: ['./src/index.ts'] });
 * ```
 */
const _default_1: UserConfig = defineConfig({
  entry: ['./src/index.ts',],
  dts: {
    generator: 'oxc',
  },
  target,
  platform: 'neutral',
  inputOptions: {
    resolve: {
      mainFields: [
        'module',
        'main',
      ],
    },
  },
  deps: {
    alwaysBundle: ['@monochromatic-dev/**',],
  },
  minify: {
    compress: true,
    // Mangle breaks func.name and makes output difficult for users to audit.
    mangle: false,
    codegen: true,
  },
  report: false,
  outDir: 'dist/final/neutral',
  fixedExtension: true,
},);
export default _default_1;
