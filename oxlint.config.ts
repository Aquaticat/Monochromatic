/**
 * Root oxlint configuration for the Monochromatic monorepo.
 *
 * Spreads the shared config from `\@monochromatic-dev/config-oxlint`.
 * oxlint auto-discovers this file via `oxlint.config.ts` convention.
 *
 * Uses spread instead of `extends` because `extends` only merges rules --
 * top-level fields like `categories`, `env`, `ignorePatterns`, `overrides`,
 * and `plugins` are not inherited.
 */

import { defineConfig, } from 'oxlint';

import base from '@monochromatic-dev/config-oxlint';

export default defineConfig({
  ...base,
},);
