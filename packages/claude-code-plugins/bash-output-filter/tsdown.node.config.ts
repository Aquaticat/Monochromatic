import base from '@monochromatic-dev/config-tsdown/.node.ts';
import { defineConfig, } from 'tsdown';

export default defineConfig({
  ...base,
  entry: ['./src/index.ts', './src/filter.ts',],
});
