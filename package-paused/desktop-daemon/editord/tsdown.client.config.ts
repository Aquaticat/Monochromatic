import base from '@monochromatic-dev/config-tsdown/.client.ts';
import {
  defineConfig,
  type UserConfig,
} from 'tsdown';

/**
 * Client-side browser bundle config for editord.
 * Bundles the editor app entry point into `dist/client/app.js`.
 */
const config: UserConfig = defineConfig({
  ...base,
  entry: [
    './src/client/app/app.ts',
  ],
},);

export default config;
