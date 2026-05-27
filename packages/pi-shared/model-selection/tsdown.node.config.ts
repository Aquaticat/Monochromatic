import base from '@monochromatic-dev/config-tsdown/.node.ts';
import {
  defineConfig,
  type UserConfig,
} from 'tsdown';

/** Node build configuration for dependency-tiered model-selection entry points. */
const config: UserConfig = defineConfig({
  ...base,
  entry: [
    './src/index.ts',
    './src/core.ts',
    './src/scope.ts',
    './src/cost.ts',
    './src/budget.ts',
    './src/pi-coding-agent.ts',
  ],
},);

export default config;
