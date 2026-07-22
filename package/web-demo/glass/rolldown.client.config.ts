import {
  CLIENT_ALWAYS_BUNDLE,
  clientConfig,
  clientExternalFor,
  type ClientFlavorConfig,
} from '@monochromatic-dev/config-rolldown/.client.ts';

/**
 * Client-side browser bundle config for the glass corridor demo.
 * Bundles three.js (WebGPU build) and the game logic into a single
 * `dist/client/main.js` for HTML embedding. The `three**` pattern keeps
 * the renderer inline so the demo page stays self-contained.
 */
const config: ClientFlavorConfig = clientConfig({
  input: ['./src/client/main.ts',],
  platform: 'browser',
  external: await clientExternalFor({
    alwaysBundle: [
      ...CLIENT_ALWAYS_BUNDLE,
      'three**',
    ],
  },),
},);
export default config;
