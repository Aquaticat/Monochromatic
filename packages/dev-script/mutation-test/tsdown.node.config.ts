import base from '@monochromatic-dev/config-tsdown/.node.ts';
import {
  defineConfig,
  type UserConfig,
} from 'tsdown';

/**
 * Node-side tsdown build for the mutation-test host CLI and library exports.
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
