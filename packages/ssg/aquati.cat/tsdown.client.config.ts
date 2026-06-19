import base from '@monochromatic-dev/config-tsdown/.client.ts';
import {
  defineConfig,
  type UserConfig,
} from 'tsdown';

/**
 * Client-side browser bundle config for the SSG.
 * Bundles all client-side scripts (syntax highlighting, etc.)
 * into `dist/client/index.js`.
 */
const config: UserConfig = defineConfig({
  ...base,
  entry: [
    './src/client/index.ts',
  ],
},);

export default config;
