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
 * (node:fs/node:path, shells out to oxlint/tsgo/pnpm). The mise lint
 * templates invoke `task-oxlint`/`task-tsgo`/`task-pnpm` repo-wide via
 * the `.bin` symlinks, so `package.json#bin` must resolve to these built
 * files (flip the bin only after this build emits them).
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
