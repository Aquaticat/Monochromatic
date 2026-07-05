import base from '@monochromatic-dev/config-tsdown/.node.ts';
import {
  defineConfig,
  type UserConfig,
} from 'tsdown';

/**
 * Node-side tsdown build for `cli-mutation-test`.
 *
 * Two entries: library re-exports (`src/index.ts`) and the host CLI
 * (`src/cli.ts`). Both land under `dist/final/node/` as `.mjs`.
 * `package.json#bin` points at `dist/final/node/cli.mjs` so the bin runs
 * without a source-time TypeScript loader. The container-side entrypoint
 * is executed from baked source with plain Node type stripping, so it is
 * intentionally not a bundle entry.
 */
const config: UserConfig = defineConfig({
  ...base,
  entry: [
    './src/index.ts',
    './src/cli.ts',
  ],
},);

export default config;
