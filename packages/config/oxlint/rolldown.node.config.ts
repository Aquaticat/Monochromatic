import {
  nodeConfig,
  nodeExternal,
} from '@monochromatic-dev/config-rolldown/.node.ts';

/**
 * Node build for `config-oxlint`.
 *
 * Object input so `src/index.node.ts` emits `dist/final/node/index.mjs` (the package
 * default export) alongside four plugin sidecars (`plugin-*.mjs`) that the built
 * config references by relative `file://` URL. `@oxlint/plugins` is added to
 * the bundle-inclusion set so the sidecars are self-contained (config-oxlint does
 * not declare it as a runtime dependency); the base `@monochromatic-dev/**` glob
 * already inlines the plugin source and its workspace deps.
 */
const config = nodeConfig({
  input: {
    index: './src/index.node.ts',
    'plugin-tsdoc': './src/plugin-tsdoc.ts',
    'plugin-no-restricted-syntax': './src/plugin-no-restricted-syntax.ts',
    'plugin-prefer-readonly-parameter-type': './src/plugin-prefer-readonly-parameter-type.ts',
    'plugin-stylistic': './src/plugin-stylistic.ts',
  },
  external: await nodeExternal({
    alwaysBundle: [
      '@monochromatic-dev/**',
      'find-up',
      'nano-spawn',
      '@oxlint/plugins',
    ],
  },),
},);

export default config;
