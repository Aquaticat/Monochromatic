import base from '@monochromatic-dev/config-tsdown/.client.ts';
import { defineConfig, } from 'tsdown';

/**
 * Client-side browser bundle config for the SSG.
 * Bundles all client-side scripts (syntax highlighting, etc.)
 * into `dist/client/index.js`.
 */
export default defineConfig({
  ...base,
  entry: [
    './src/client/index.ts',
  ],
},);
