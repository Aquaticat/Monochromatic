import base from '@monochromatic-dev/config-tsdown/.node.ts';
import {
  defineConfig,
  type UserConfig,
} from 'tsdown';

/** Build configuration for bash-output-filter, including both the hook entry and the filter script. */
const config: UserConfig = defineConfig({
  ...base,
  entry: [
    './src/index.ts',
    './src/filter.ts',
  ],
},);

export default config;
