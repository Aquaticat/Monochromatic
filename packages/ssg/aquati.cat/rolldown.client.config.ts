import { clientConfig, } from '@monochromatic-dev/config-rolldown/.client.ts';

/**
 * Client-side browser bundle config for the SSG.
 * Bundles all client-side scripts (syntax highlighting, etc.)
 * into `dist/client/index.js`.
 */
const config = clientConfig({
  input: [
    './src/client/index.ts',
  ],
},);

export default config;
