import { fileURLToPath } from 'node:url';

import base from '@monochromatic-dev/config-tsdown/.node.ts';
import {
  defineConfig,
  type UserConfig,
} from 'tsdown';

/**
 * Absolute path to the local `sax` stub aliased in place of the blocklisted package.
 */
const saxStub = fileURLToPath(new URL(
  'src/sax-stub.ts',
  import.meta.url
));

/**
 * Node build for the key-helper daemon.
 *
 * Produces a single self-contained ESM bundle that Node SEA embeds. SEA cannot
 * resolve filesystem modules at runtime, so every runtime dependency is bundled;
 * only `node:` builtins (always external) and the optional native `usocket` are
 * left out. dbus-next falls back to `net` for the path-style session bus, so the
 * runtime `usocket` require throwing is expected and handled.
 *
 * @example
 * ```ts
 * export default config;
 * ```
 */
const config: UserConfig = defineConfig({
  ...base,
  entry: { index: './src/index.ts' },
  dts: false,
  alias: { sax: saxStub },
  deps: {
    alwaysBundle: function shouldBundle(id: string): boolean {
      return (!id.startsWith('node:')) && (id !== 'usocket');
    },
    neverBundle: ['usocket'],
  },
});

export default config;
