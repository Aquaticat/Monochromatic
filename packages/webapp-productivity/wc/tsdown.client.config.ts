import base from '@monochromatic-dev/config-tsdown/.client.ts';
import {
  defineConfig,
  type UserConfig,
} from 'tsdown';

/**
 * Client-side browser bundle config for the wc text-stats tool.
 * Bundles the input-handling and rendering logic into a single
 * `dist/client/main.js` for HTML embedding.
 */
const config: UserConfig = defineConfig({
  ...base,
  entry: ['./src/client/main.ts',],
},);
export default config;
