import base from '@monochromatic-dev/config-tsdown/.node.ts';
import {
  defineConfig,
  type UserConfig,
} from 'tsdown';

/**
 * Node-side tsdown build for `cli-mvm`.
 *
 * Two entries: the library re-exports (`src/index.ts`) and the CLI
 * (`src/cli.ts`). Both land under `dist/final/node/` as `.mjs`. The VM
 * manager uses `node:fs/promises`/`node:path`/`node:child_process` and
 * the bin uses `@optique/run`, so the bundle is node-only.
 * `package.json#bin` points at `dist/final/node/cli.mjs` so the bin runs
 * without a source-time TypeScript loader.
 */
const config: UserConfig = defineConfig({
  ...base,
  entry: [
    './src/index.ts',
    './src/cli.ts',
  ],
},);

export default config;
