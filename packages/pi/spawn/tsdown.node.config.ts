import base from '@monochromatic-dev/config-tsdown/.node.ts';
import {
  defineConfig,
  type UserConfig,
} from 'tsdown';

/**
 * Node-side tsdown build for `pi-spawn`.
 *
 * Builds both the Pi extension (`src/index.ts`) and the `spawn-pi` CLI (`src/cli.ts`).
 * `package.json#bin` points at `dist/final/node/cli.mjs` so command execution uses Node
 * without relying on a TypeScript source loader.
 *
 * @example
 * ```typescript
 * export default config;
 * ```
 */
const config: UserConfig = defineConfig({
  ...base,
  entry: [
    './src/index.ts',
    './src/cli.ts',
  ],
},);

export default config;
