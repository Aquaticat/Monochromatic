import base from '@monochromatic-dev/config-tsdown/.node.ts';
import {
  defineConfig,
  type UserConfig,
} from 'tsdown';

/**
 * Node build for the pnpm workspace catalog reader.
 *
 * @example
 * ```ts
 * // The package task loads this config through tsdown.
 * export default config;
 * ```
 */
const config: UserConfig = defineConfig({
  ...base,
  entry: ['./src/index.ts',],
},);

export default config;
