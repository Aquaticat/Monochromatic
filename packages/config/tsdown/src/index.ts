import { defineConfig, type UserConfig, } from 'tsdown';

const _default_1: UserConfig = defineConfig({
  entry: ['./src/index.ts',],
  dts: true,
  target: 'firefox140',
  platform: 'neutral',
  minify: {
    compress: true,
    mangle: false,
    codegen: true,
  },
  report: false,
  outDir: 'dist/final/neutral',
  fixedExtension: true,
});
export default _default_1;
