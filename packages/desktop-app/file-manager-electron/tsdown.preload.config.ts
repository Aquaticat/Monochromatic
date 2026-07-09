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
  outDir: 'dist/app',
  platform: 'node',
  report: false,
  target: 'node22',
  deps: {
    alwaysBundle: ['@monochromatic-dev/**',],
    neverBundle: ['electron',],
  },
});

export default preloadConfig;
