import base from '@monochromatic-dev/config-tsdown/.node.ts';
import {
  defineConfig,
  type UserConfig,
} from 'tsdown';

/**
 * Node build configuration for filesystem identity resolution.
 *
 * @example
 * ```ts
 * export default config;
 * ```
 */
const config: UserConfig = defineConfig({
  ...base,
  entry: {
    index: './src/index.ts',
    testing: './src/testing.ts',
  },
},);

export default config;
