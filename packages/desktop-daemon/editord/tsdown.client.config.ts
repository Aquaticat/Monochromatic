import base from '@monochromatic-dev/config-tsdown/.client.ts';
import { defineConfig, } from 'tsdown';

/**
 * Client-side browser bundle config for editord.
 * Bundles the editor app entry point into `dist/client/app.js`.
 */
export default defineConfig({
  ...base,
  entry: [
    './src/client/app/app.ts',
  ],
},);
