import base from '@monochromatic-dev/config-tsdown/.node.ts';
import {
  defineConfig,
  type UserConfig,
} from 'tsdown';

/**
 * Node-side tsdown build for `build-tool-css`.
 *
 * Two entries: the library (`src/index.ts`, emitted as `index.mjs`, the `.`
 * export) and the CLI (`src/cli.ts`, emitted as `cli.mjs`, the `build-css`
 * bin, shebang preserved). Package `build:css` tasks use inline `node -e`
 * dispatch (runWorkspaceNode) to call the built file directly when present,
 * otherwise `src/cli.ts`, so bootstrap does not depend on pnpm linking the
 * `build-css` shim.
 * node-only (postcss, optique, node fs via module-fs-path).
 */
const config: UserConfig = defineConfig({
  ...base,
  entry: [
    './src/index.ts',
    './src/cli.ts',
  ],
},);

export default config;
