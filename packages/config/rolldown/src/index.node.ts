import {
  defineConfig,
  type OutputOptions,
  type RolldownOptions,
} from 'rolldown';
import { dts, } from 'rolldown-plugin-dts';

import { browserslistTargets, } from './browserslist-targets.ts';
import {
  anchoredExternal,
  packageExternals,
} from './package-externals.ts';
import { shebangExecutablePlugin, } from './shebang-executable.ts';

/**
 * Resolved Browserslist targets shared by Node builds, via
 * {@link browserslistTargets}.
 */
const target = await browserslistTargets({ runtime: 'node', },);

/**
 * Bundle-inclusion patterns for Node builds:
 * workspace source plus the two ESM-only utilities historically inlined
 * so committed plugin bundles stay dependency-free.
 */
export const NODE_ALWAYS_BUNDLE: readonly string[] = [
  '@monochromatic-dev/**',
  'find-up',
  'nano-spawn',
];

/**
 * Bare names kept external even when undeclared:
 * pi extension peers are provided by the pi runtime at load time,
 * and bundling them duplicates the pi API causing CJS/ESM
 * "exports is not defined" errors.
 */
export const NODE_ALWAYS_EXTERNAL: readonly string[] = [
  '@earendil-works/pi-coding-agent',
  'typebox',
  '@earendil-works/pi-ai',
];

/**
 * Shared raw-rolldown options for Node platform builds, without an input.
 *
 * Bundles workspace dependencies (`@monochromatic-dev/*`) into the output
 * so built artifacts are self-contained and work outside the monorepo
 * (e.g. Claude Code plugins installed via marketplace).
 *
 * Selects Oxc declaration generation explicitly;
 * the tsgo backend cannot emit declarations for workspace source inlined from
 * outside the entry package's tsconfig project
 * (see `docs/troubleshooting/rolldown-plugin-dts-typescript-7-generator.md`).
 */
const baseOptions: RolldownOptions = {
  platform: 'node',
  external: [
    ...await packageExternals({ alwaysBundle: NODE_ALWAYS_BUNDLE, },),
    ...NODE_ALWAYS_EXTERNAL.map(function toMatcher(name: string,): RegExp {
      return anchoredExternal(name,);
    },),
  ],
  transform: { target: [...target,], },
  plugins: [
    dts({ generator: 'oxc', },),
    shebangExecutablePlugin(),
  ],
};

/**
 * Shared output options for Node builds, without a directory.
 *
 * `entryFileNames`/`chunkFileNames` force `.mjs` because raw rolldown has no
 * `fixedExtension`; `rolldown-plugin-dts` derives `.d.mts` from the template.
 */
const baseOutput = {
  format: 'es' as const,
  entryFileNames: '[name].mjs',
  chunkFileNames: '[name]-[hash].mjs',
  minify: {
    compress: true,
    // Mangle breaks func.name and makes output difficult for users to audit.
    mangle: false,
    codegen: true,
  },
};

/**
 * Build one Node flavor config with overridable input and output directory.
 *
 * @param input - Source input paths; defaults to the package index.
 *
 * @param outputDir - Output directory; committed Claude Code plugin bundles
 *   override this to `bundle/node` (see `docs/decisions/gitignore-negations.md`).
 *
 * @param outputOverrides - Shallow output-option overrides for consumers
 *   needing e.g. `minify: false` or `codeSplitting: false`.
 *
 * @returns Node flavor rolldown config for one self-contained build.
 *
 * @example
 * ```ts
 * // rolldown.node.config.ts
 * import { nodeConfig, } from '\@monochromatic-dev/config-rolldown/.node.ts';
 * export default nodeConfig({ outputDir: 'bundle/node', },);
 * ```
 */
export function nodeConfig(
  {
    input = ['./src/index.ts',],
    outputDir = 'dist/final/node',
    outputOverrides = {},
  }: {
    readonly input?: readonly string[];
    readonly outputDir?: string;
    readonly outputOverrides?: OutputOptions;
  } = {},
): RolldownOptions {
  return defineConfig({
    ...baseOptions,
    input: [...input,],
    output: {
      ...baseOutput,
      dir: outputDir,
      cleanDir: true,
      ...outputOverrides,
    },
  },);
}

/**
 * Default single-input Node build config via {@link nodeConfig}.
 *
 * Single-input builds are already self-contained: with one input there is
 * nothing to hoist into a shared chunk. Multi-entry plugins must use
 * {@link perEntryNodeConfig} instead so each entry stays self-contained.
 *
 * @example
 * ```ts
 * // rolldown.node.config.ts
 * export { default, } from '\@monochromatic-dev/config-rolldown/.node.ts';
 * ```
 */
const _default_1: RolldownOptions = nodeConfig();
export default _default_1;

/**
 * Build each input as its own single-input bundle.
 *
 * A single build with multiple inputs hoists code shared between those
 * inputs into a separate chunk whose filename carries a content hash.
 * Because these dist bundles are committed and published, that hash churns
 * the filename on every content change and leaks an internal chunk into the
 * published plugin. Building one input per config removes the shared chunk
 * entirely: the shared code inlines into each entry, so every output file is
 * self-contained with a stable name.
 *
 * `cleanDir` stays off for every per-entry config because raw rolldown's
 * clean is per-config and not watch-safe: any config cleaning the shared
 * `dist/final/node` would delete sibling outputs. The owning mise task
 * pre-cleans the directory once instead.
 *
 * @param entries - Source input paths, one self-contained bundle emitted per path.
 *
 * @param outputDir - Shared output directory; committed Claude Code plugin
 *   bundles override this to `bundle/node`.
 *
 * @returns One single-input rolldown config per entry.
 *
 * @example
 * ```ts
 * // rolldown.node.config.ts
 * import { perEntryNodeConfig, } from '\@monochromatic-dev/config-rolldown/.node.ts';
 * export default perEntryNodeConfig({ entries: ['./src/index.ts', './src/filter.ts',], },);
 * ```
 */
export function perEntryNodeConfig(
  {
    entries,
    outputDir = 'dist/final/node',
  }: {
    readonly entries: readonly string[];
    readonly outputDir?: string;
  },
): RolldownOptions[] {
  return defineConfig(entries.map(function toSingleEntryConfig(entry: string,): RolldownOptions {
    return {
      ...baseOptions,
      input: [entry,],
      output: {
        ...baseOutput,
        dir: outputDir,
        cleanDir: false,
      },
    };
  },),);
}
