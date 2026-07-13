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
 * only `node:` builtins are left external. `@homebridge/dbus-native` speaks to
 * the path-style session bus over Node's `net`, so no native addon is bundled.
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
      return !id.startsWith('node:');
    },
  },
});

export default config;
