import base from '@monochromatic-dev/config-tsdown/.client.ts';
import {
  defineConfig,
  type UserConfig,
} from 'tsdown';

/**
 * Client-side browser bundle config for the inference canary viewer.
 * Bundles client scripts into `dist/client/`.
 */
const config: UserConfig = defineConfig({
  ...base,
  entry: [
    './src/client/index.ts',
  ],
  outDir: 'dist/final/client',
},);
export default config;
