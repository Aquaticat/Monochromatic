import {
  defineConfig,
  type UserConfig,
} from 'tsdown';

/**
 * Main-process bundle config for Electron's Node-flavoured ESM runtime.
 *
 * @example
 * ```ts
 * console.log(mainProcessConfig.outDir);
 * ```
 */
const mainProcessConfig: UserConfig = defineConfig({
  entry: ['./src/main.ts',],
  dts: false,
  fixedExtension: true,
  format: 'esm',
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

export default mainProcessConfig;
