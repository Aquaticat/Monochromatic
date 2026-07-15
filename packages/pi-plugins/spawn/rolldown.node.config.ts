import { nodeConfig, } from '@monochromatic-dev/config-rolldown/.node.ts';

/**
 * Node-side rolldown build for `pi-spawn`.
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
const config = nodeConfig({
  input: [
      './src/index.ts',
      './src/cli.ts',
    ],
},);

export default config;
