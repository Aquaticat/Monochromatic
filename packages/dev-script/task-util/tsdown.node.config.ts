import base from '@monochromatic-dev/config-tsdown/.node.ts';
import {
  defineConfig,
  type UserConfig,
} from 'tsdown';

/**
 * Node-side tsdown build for `dev-script-task-util`.
 *
 * Six bin entries, one per declared `bin` (task-command, task-append,
 * task-depends, task-oxlint, task-pnpm, task-tsgo). Each lands under
 * `dist/final/node/` as `.mjs` with its shebang preserved. node-only
 * (node:fs/node:path, shells out to oxlint/tsgo/pnpm). `package.json#bin`
 * still resolves to these built files for normal shell use. Bootstrap-critical
 * mise tasks use inline `node -e` dispatch (runWorkspaceNode) to call the built
 * file directly when present, otherwise the matching TypeScript source, so they
 * do not depend on pnpm `.bin` shims.
 */
const config: UserConfig = defineConfig({
  ...base,
  entry: [
    './src/command.ts',
    './src/append.ts',
    './src/depends.ts',
    './src/oxlint-wrapper.ts',
    './src/pnpm-filter.ts',
    './src/tsgo-filter.ts',
  ],
},);

export default config;
