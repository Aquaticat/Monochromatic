import base from '@monochromatic-dev/config-tsdown/.client.ts';
import {
  importAttributesPlugin,
} from '@monochromatic-dev/rolldown-plugin-import-attributes/ts';
import {
  defineConfig,
  type UserConfig,
} from 'tsdown';

/**
 * Base `alwaysBundle` list. `Array.isArray` below narrows the
 * `Arrayable<string | RegExp> | NoExternalFn | undefined` union to its
 * array arm so the merge stays null-free without a type assertion.
 */
const baseAlwaysBundle = base.deps
  ?.alwaysBundle;

/**
 * Client-side browser bundle config for the messages-demo webapp.
 *
 * Three entry points:
 * - `index.ts`: main page entry; loads storage probes and identity
 *   store, lazy-imports the composer on first focus.
 * - `composer.worker.ts`: Web Worker that hosts the markdown compile +
 *   chunk-upload pipeline. Loaded via dynamic `new Worker(...)` from the
 *   composer module.
 * - `editor/buffer.worker.ts`: Web Worker that hosts the custom
 *   editor's piece-table buffer. Listed explicitly because rolldown
 *   leaves the original `.ts` URL in the output if we rely on its
 *   automatic worker detection (verified empirically with the v1
 *   release-candidate build at the time of writing).
 */
const config: UserConfig = defineConfig({
  ...base,
  entry: [
    './src/client/index.ts',
    './src/client/composer.worker.ts',
    './src/client/editor/buffer.worker.ts',
  ],
  plugins: [importAttributesPlugin(),],
  // The base config bundles workspace and lezer packages but leaves
  // npm packages external. micromark must be bundled for the browser
  // because there is no module resolver in the browser to fetch a bare
  // specifier from a CDN. We merge the demo's bundle list into the
  // base's `alwaysBundle` (tsdown rejects `noExternal` alongside it).
  deps: {
    ...base.deps,
    alwaysBundle: [
      // Spread the base's RegExp array; the type is `Arrayable<string |
      // RegExp> | NoExternalFn`, but the base config always uses an array.
      ...(Array.isArray(baseAlwaysBundle,)
        ? baseAlwaysBundle
        : []),
      /* oxlint-disable no-restricted-syntax/no-regex -- anchored package-name matchers consumed by tsdown's alwaysBundle list; each pattern is `^literal` or `^literal-` with no quantifiers, matching one short specifier per dependency at build time */
      /^micromark/u,
      /^micromark-/u,
      /^decode-named-character-reference$/u,
      /^debug$/u,
      /^ms$/u,
      /^character-entities/u,
      /* oxlint-enable no-restricted-syntax/no-regex */
    ],
  },
},);
export default config;
