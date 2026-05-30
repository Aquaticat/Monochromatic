import base from '@monochromatic-dev/config-tsdown/.node.ts';
import {
  defineConfig,
  type UserConfig,
} from 'tsdown';

/**
 * Node-side tsdown build for `dev-script-vm-builder`.
 *
 * The package has no `src/index.ts`; its declared `bin` is
 * `src/build-and-import.ts`, so the entry is overridden to that file. It
 * emits `dist/final/node/build-and-import.mjs` (shebang preserved). Uses
 * `node:child_process`/`node:fs` and shells out to sudo/podman/virsh, so
 * the bundle is node-only. The auxiliary `import.ts`/`sign-and-push.ts`
 * dev scripts are not bins and stay source-run via their mise tasks.
 */
const config: UserConfig = defineConfig({
  ...base,
  entry: [
    './src/build-and-import.ts',
  ],
},);

export default config;
