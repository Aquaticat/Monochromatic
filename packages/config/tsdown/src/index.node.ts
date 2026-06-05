import {
  defineConfig,
  type UserConfig,
} from 'tsdown';

import { browserslistTargets, } from './browserslist-targets.ts';

/**
 * Resolved Browserslist targets shared by Node builds.
 */
const target = await browserslistTargets({ runtime: 'node', },);

/**
 * Shared tsdown options for Node.js platform builds, without an entry.
 *
 * Bundles workspace dependencies (`@monochromatic-dev/*`) into the output
 * so built artifacts are self-contained and work outside the monorepo
 * (e.g. Claude Code plugins installed via marketplace).
 *
 * @example
 * ```ts
 * // tsdown.node.config.ts
 * import { perEntryNodeConfig, } from '\@monochromatic-dev/config-tsdown/.node.ts';
 * export default perEntryNodeConfig(['./src/index.ts',],);
 * ```
 */
const baseOptions: UserConfig = {
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
};

/**
 * Default single-entry Node build config.
 *
 * Single-entry builds are already self-contained: with one input there is
 * nothing to hoist into a shared chunk. Multi-entry plugins must use
 * {@link perEntryNodeConfig} instead so each entry stays self-contained.
 *
 * @example
 * ```ts
 * // tsdown.node.config.ts
 * export { default, } from '\@monochromatic-dev/config-tsdown/.node.ts';
 * ```
 */
const _default_1: UserConfig = defineConfig({
  ...baseOptions,
  entry: ['./src/index.ts',],
},);
export default _default_1;

/**
 * Build each entry as its own single-input bundle.
 *
 * A single tsdown build with multiple entries hoists code shared between
 * those entries into a separate chunk whose filename carries a content hash
 * (`text-scan-CYPNafuL.mjs`). Because these dist bundles are committed and
 * published, that hash churns the filename on every content change and leaks
 * an internal chunk into the published plugin. Building one input per config
 * removes the shared chunk entirely: the shared code inlines into each entry,
 * so every output file is self-contained with a stable name. tsdown cleans
 * the shared `outDir` once before the parallel builds, so the per-entry
 * outputs do not clobber one another.
 *
 * @param entries - Source entry paths, one self-contained bundle emitted per path.
 *
 * @returns One single-input tsdown config per entry.
 *
 * @example
 * ```ts
 * // tsdown.node.config.ts
 * import { perEntryNodeConfig, } from '\@monochromatic-dev/config-tsdown/.node.ts';
 * export default perEntryNodeConfig(['./src/index.ts', './src/filter.ts',],);
 * ```
 */
export function perEntryNodeConfig(entries: readonly string[],): UserConfig[] {
  /**
   * Per-entry single-input build configs accumulated from {@link entries}.
   */
  const configs: UserConfig[] = [];
  for (const entry of entries) {
    configs.push({
      ...baseOptions,
      entry: [entry,],
    },);
  }
  return defineConfig(configs,);
}
