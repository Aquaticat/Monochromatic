import base from '@monochromatic-dev/config-tsdown/.node.ts';
import {
  defineConfig,
  type UserConfig,
} from 'tsdown';

/**
 * Node build for `config-oxlint`.
 *
 * Object entry so `src/index.node.ts` emits `dist/final/node/index.mjs` (the package
 * default export) alongside four plugin sidecars (`plugin-*.mjs`) that the built
 * config references by relative `file://` URL. `@oxlint/plugins` is added to
 * `alwaysBundle` so the sidecars are self-contained (config-oxlint does not declare
 * it as a runtime dependency); the base `@monochromatic-dev/**` glob already inlines
 * the plugin source and its workspace deps.
 */
const config: UserConfig = defineConfig({
  ...base,
  entry: {
    index: './src/index.node.ts',
    'plugin-tsdoc': './src/plugin-tsdoc.ts',
    'plugin-no-restricted-syntax': './src/plugin-no-restricted-syntax.ts',
    'plugin-prefer-readonly-parameter-type': './src/plugin-prefer-readonly-parameter-type.ts',
    'plugin-stylistic': './src/plugin-stylistic.ts',
  },
  deps: {
    ...base.deps,
    alwaysBundle: [
      '@monochromatic-dev/**',
      'find-up',
      'nano-spawn',
      '@oxlint/plugins',
    ],
  },
},);

export default config;
