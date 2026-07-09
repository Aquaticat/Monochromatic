import {
  defineConfig,
  type UserConfig,
} from 'tsdown';

/**
 * Preload bundle config: Electron's sandboxed preload runtime loads CommonJS
 * only, so this is the one CJS island in the package.
 *
 * @example
 * ```ts
 * console.log(preloadConfig.outDir);
 * ```
 */
const preloadConfig: UserConfig = defineConfig({
  entry: ['./src/preload.ts',],
  dts: false,
  fixedExtension: true,
  format: 'cjs',
  minify: {
    codegen: true,
    compress: false,
    mangle: false,
  },
  // Own subdir per bundling config, so tsdown's default clean (whole outDir)
  // can never delete a sibling config's output; build:stage assembles dist/app.
  outDir: 'dist/preload',
  platform: 'node',
  report: false,
  target: 'node22',
  deps: {
    alwaysBundle: ['@monochromatic-dev/**',],
    neverBundle: ['electron',],
  },
});

export default preloadConfig;
