import {
  defineConfig,
  type RolldownOptions,
} from 'rolldown';
import { dts, } from 'rolldown-plugin-dts';

import { browserslistTargets, } from './browserslist-targets.ts';
import { packageExternals, } from './package-externals.ts';

/**
 * Resolved Browserslist targets shared by neutral builds, via
 * {@link browserslistTargets}.
 */
const target = await browserslistTargets({ runtime: 'browser', },);

/**
 * Bundle-inclusion patterns for neutral builds:
 * workspace source stays inline so artifacts work outside the monorepo.
 */
export const NEUTRAL_ALWAYS_BUNDLE: readonly string[] = ['@monochromatic-dev/**',];

/**
 * Shared raw-rolldown configuration for neutral (browser-compatible) platform builds.
 *
 * Bundles workspace dependencies (`@monochromatic-dev/*`) into the output
 * so built artifacts are self-contained and work outside the monorepo.
 *
 * Selects Oxc declaration generation explicitly because repository source
 * satisfies `isolatedDeclarations`;
 * the tsgo backend cannot emit declarations for workspace source inlined from
 * outside the entry package's tsconfig project
 * (see `docs/troubleshooting/rolldown-plugin-dts-typescript-7-generator.md`).
 *
 * `entryFileNames`/`chunkFileNames` force `.mjs` because raw rolldown has no
 * `fixedExtension`; `rolldown-plugin-dts` derives `.d.mts` from that template.
 *
 * @example
 * ```ts
 * // rolldown.browser.config.ts
 * export { default, } from '\@monochromatic-dev/config-rolldown/.ts';
 * ```
 */
const _default_1: RolldownOptions = defineConfig({
  input: ['./src/index.ts',],
  platform: 'neutral',
  resolve: {
    mainFields: [
      'module',
      'main',
    ],
  },
  external: await packageExternals({ alwaysBundle: NEUTRAL_ALWAYS_BUNDLE, },),
  transform: { target: [...target,], },
  plugins: [dts({ generator: 'oxc', },),],
  output: {
    dir: 'dist/final/neutral',
    format: 'es',
    entryFileNames: '[name].mjs',
    chunkFileNames: '[name]-[hash].mjs',
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
