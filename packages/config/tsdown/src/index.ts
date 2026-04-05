import {
  defineConfig,
  type UserConfig,
} from 'tsdown';

/**
 * Shared tsdown configuration for neutral (browser-compatible) platform builds.
 *
 * Bundles workspace dependencies (`@monochromatic-dev/*`) into the output
 * so built artifacts are self-contained and work outside the monorepo.
 *
 * @example
 * ```ts
 * // tsdown.config.ts
 * import base from '\@monochromatic-dev/config-tsdown';
 * export default defineConfig({ ...base, entry: ['./src/index.ts'] });
 * ```
 */
const _default_1: UserConfig = defineConfig({
  entry: ['./src/index.ts',],
  dts: true,
  target: 'firefox140',
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
    alwaysBundle: [/^@monochromatic-dev\//,],
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
