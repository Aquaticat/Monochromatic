import base from '@monochromatic-dev/config-tsdown/.node.ts';
import {
  defineConfig,
  type UserConfig,
} from 'tsdown';

/**
 * Node build configuration for the shadow bin and authoring API.
 *
 * @example
 * ```ts
 * export default config;
 * ```
 */
const config: UserConfig = defineConfig({
  ...base,
  entry: ['./src/index.ts',],
  outputOptions: {
    codeSplitting: false,
  },
},);

export default config;
