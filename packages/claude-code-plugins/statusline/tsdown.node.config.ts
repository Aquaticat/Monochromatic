import base from '@monochromatic-dev/config-tsdown/.node.ts';
import {
  defineConfig,
  type UserConfig,
} from 'tsdown';

/**
 * Node build for Claude Code statusline.
 *
 * The package is a CLI-first utility whose public entry is `src/statusline.ts`,
 * so the bundle emits `dist/final/node/statusline.mjs` instead of the default
 * `index.mjs` entry.
 */
const config: UserConfig = defineConfig({
  ...base,
  entry: [
    './src/statusline.ts',
  ],
},);

export default config;
