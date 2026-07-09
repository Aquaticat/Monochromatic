import {
  defineConfig,
  type UserConfig,
} from 'tsdown';

/**
 * Build config for package-local Node tools.
 *
 * @example
 * ```ts
 * console.log(toolConfig.outDir);
 * ```
 */
const toolConfig: UserConfig = defineConfig({
  entry: [
    './src/build-stage.ts',
    './src/distribute.ts',
    './src/wayland-boundary-test.ts',
  ],
  dts: false,
  fixedExtension: true,
  format: 'esm',
  minify: {
    codegen: true,
    compress: false,
    mangle: false,
  },
  outDir: 'dist/tools',
  platform: 'node',
  report: false,
  target: 'node22',
  deps: {
    alwaysBundle: ['@monochromatic-dev/**',],
    neverBundle: [
      '@electron/packager',
      'electron',
    ],
  },
});

export default toolConfig;
