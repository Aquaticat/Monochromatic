import { resolve, } from 'node:path';

import {
  defineConfig,
  type TsdownHooks,
  type UserConfig,
} from 'tsdown';

import { browserslistTargets, } from './browserslist-targets.ts';
import {
  createBuildCompletionGate,
  normalizeGeneratedTextOutputs,
} from './final-newline.ts';

/**
 * Resolved Browserslist targets shared by Node builds, via
 * {@link browserslistTargets}.
 */
const target = await browserslistTargets({ runtime: 'node', },);

/**
 * Creates tsdown lifecycle hooks that canonicalize emitted Node text artifacts.
 *
 * Tsdown's own logger is the build host's user-facing output channel, so this
 * integration reports only actual rewrites and leaves compliant builds quiet.
 * Multi-entry configs share one completion gate and scan their shared output
 * directory once, after every parallel entry build completes.
 *
 * @param expectedBuildCount - Parallel entry builds sharing output directory.
 *
 * @returns Build hook group with final-LF post-processing.
 *
 * @example
 * ```ts
 * const hooks = createNodeOutputHooks({ expectedBuildCount: 2 });
 * ```
 */
function createNodeOutputHooks(
  { expectedBuildCount, }: { readonly expectedBuildCount: number; },
): Pick<TsdownHooks, 'build:done'> {
  /**
   * Shared gate that opens after whole config group finishes one build cycle.
   */
  const isFinalBuild = createBuildCompletionGate({ expectedBuildCount, },);

  return {
    /**
     * Canonicalizes JavaScript and declaration output after generation completes.
     *
     * @param options - Resolved output path and host logger from completed build.
     *
     * @example
     * ```ts
     * await hooks['build:done'](context);
     * ```
     */
    'build:done': async function normalizeNodeBuildOutputs(
      { options, },
    ): Promise<void> {
      if (!isFinalBuild())
        return;

      /**
       * Absolute Node output directory resolved from package build cwd.
       */
      const outputDir = resolve(
        options.cwd,
        options.outDir,
      );
      /**
       * Relative generated artifact paths whose final LF changed.
       */
      const normalizedPaths = await normalizeGeneratedTextOutputs({ outputDir, },);

      if (normalizedPaths.length === 0)
        return;

      options
        .logger
        .info(
          `Normalized final LF in ${String(normalizedPaths.length,)} Node output file(s).`,
        );
    },
  };
}

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
  hooks: createNodeOutputHooks({ expectedBuildCount: 1, }),
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
   * Shared hooks wait for every parallel entry before scanning shared output.
   */
  const hooks = createNodeOutputHooks({ expectedBuildCount: entries.length, },);

  return defineConfig(entries.map(function toSingleEntryConfig(entry: string,): UserConfig {
    return {
      ...baseOptions,
      entry: [entry,],
      hooks,
    };
  },),);
}
