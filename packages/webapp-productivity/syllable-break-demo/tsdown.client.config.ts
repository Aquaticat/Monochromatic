import base from '@monochromatic-dev/config-tsdown/.client.ts';
import {
  defineConfig,
  type UserConfig,
} from 'tsdown';

/**
 * Client-side browser bundle config for the syllable break demo.
 * Bundles the hyphenation library and UI logic into a single `dist/client/main.js`
 * for HTML embedding.
 */
const config: UserConfig = defineConfig({
  ...base,
  entry: ['./src/client/main.ts',],
  deps: {
    ...base.deps,
    alwaysBundle: [
      ...(Array.isArray(base.deps?.alwaysBundle,) ? base.deps.alwaysBundle : []),
      // oxlint-disable-next-line no-restricted-syntax/no-regex -- Anchored prefix match on package names ('hyphen', 'hyphen-en', etc.); literal input is a finite list of npm names, no backtracking surface.
      /^hyphen/u,
    ],
  },
},);
export default config;
