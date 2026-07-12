import base from '@monochromatic-dev/config-tsdown/.node.ts';
import {
  defineConfig,
  type UserConfig,
} from 'tsdown';

/**
 * Node build for the key-helper daemon.
 *
 * Produces a single self-contained ESM bundle that Node SEA embeds. The optional
 * native `usocket` is externalized so the bundle stays addon-free; dbus-next
 * falls back to `net` for the path-style session bus, so the runtime `require`
 * throwing is expected and handled.
 *
 * @example
 * ```ts
 * export default config;
 * ```
 */
const config: UserConfig = defineConfig({
  ...base,
  entry: { index: './src/index.ts' },
  deps: {
    alwaysBundle: ['@monochromatic-dev/**'],
    neverBundle: ['usocket'],
  },
});

export default config;
