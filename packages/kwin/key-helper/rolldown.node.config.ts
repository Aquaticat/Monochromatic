import { fileURLToPath } from 'node:url';

import {
  defineConfig,
  type RolldownOptions,
} from 'rolldown';

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
 * No declarations: the SEA bundle has no type consumers.
 *
 * @example
 * ```ts
 * export default config;
 * ```
 */
const config: RolldownOptions = defineConfig({
  input: { index: './src/index.ts' },
  platform: 'node',
  transform: { target: 'node22', },
  resolve: { alias: { sax: saxStub }, },
  external: [
    // oxlint-disable-next-line no-restricted-syntax/no-regex -- Anchored protocol prefix test for node builtins; input is one bare import specifier; no repetition, no backtracking.
    /^node:/u,
  ],
  output: {
    dir: 'dist/final/node',
    format: 'es',
    entryFileNames: '[name].mjs',
    chunkFileNames: '[name]-[hash].mjs',
    cleanDir: true,
    minify: {
      compress: true,
      // Mangle breaks func.name and makes output difficult for users to audit.
      mangle: false,
      codegen: true,
    },
  },
});

export default config;
