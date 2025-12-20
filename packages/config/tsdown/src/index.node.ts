import { defineConfig, type UserConfig, } from 'tsdown';

const _default_1: UserConfig = defineConfig({
  entry: ['./src/index.ts',],
  dts: true,
  target: 'firefox140',
  platform: 'node',
  minify: {
    compress: true,
    mangle: false,
    codegen: true,
  },
  report: false,
  outDir: 'dist/final/node',
  fixedExtension: true,
});
export default _default_1;
