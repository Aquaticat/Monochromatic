/**
 Oxlint configuration for this package alone, spreading the shared configuration unchanged.

 The shared configuration ignores every path matching `**\/test-fixture/**`, and this package's
 directory is named `test-fixture`, so oxlint run from the repository root's configuration finds
 no file here ("No files found to lint"). Oxlint matches ignore patterns against paths relative to
 the directory of the configuration it loads, so a configuration placed in this directory sees
 `src/...` and lints the package like any other. Every rule, override and plugin is the shared one.

 @module
 */

import {
  defineConfig,
  type OxlintConfig,
} from 'oxlint';

import base from '@monochromatic-dev/config-oxlint';

/**
 The shared Oxlint configuration with an explicit public export type for isolated declarations.
 */
const config: OxlintConfig = defineConfig({
  ...base,
},);

export default config;
