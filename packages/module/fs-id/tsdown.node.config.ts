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
  entry: ['./src/index.ts',],
},);

export default config;
