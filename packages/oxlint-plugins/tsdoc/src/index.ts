import {
  eslintCompatPlugin,
  type Plugin,
} from '@oxlint/plugins';

import { checkMutates, } from './rules/mutates.ts';
import {
  checkParamNames,
  requireParam,
  requireParamDescription,
  requireParamName,
} from './rules/params.ts';
import { requireExample, } from './rules/require-example.ts';
import { requireTsdoc, } from './rules/require-tsdoc.ts';
import {
  requireReturns,
  requireReturnsCheck,
  requireReturnsDescription,
} from './rules/returns.ts';
import {
  checkAlignment,
  emptyTags,
  escapeInlineTags,
  multilineBlocks,
  noMultiAsterisks,
  tagLines,
} from './rules/structural.ts';
import {
  checkAccess,
  checkTagNames,
  noTypes,
  validTypes,
} from './rules/tag-validation.ts';
import {
  requireYields,
  requireYieldsCheck,
} from './rules/yields.ts';

/**
 * Oxlint JS plugin providing TSDoc validation rules.
 *
 * Ports the eslint-plugin-jsdoc recommended-typescript ruleset to the oxlint
 * jsPlugin API, adapting all rules to conform to TSDoc (not JSDoc) specs.
 * Uses an in-house TSDoc comment scanner for parsing, with no external
 * dependency on `\@microsoft/tsdoc`.
 *
 * @example
 * ```typescript
 * // oxlint.config.ts
 * import { defineConfig } from 'oxlint';
 * export default defineConfig({
 *   jsPlugins: ['\@monochromatic-dev/config-oxlint-tsdoc'],
 * });
 * ```
 */
const plugin: Plugin = eslintCompatPlugin({
  meta: {
    name: 'tsdoc',
  },
  rules: {
    //region Presence
    'require-tsdoc': requireTsdoc,
    'require-example': requireExample,
    //endregion Presence

    //region Structural formatting
    'check-alignment': checkAlignment,
    'multiline-blocks': multilineBlocks,
    'no-multi-asterisks': noMultiAsterisks,
    'tag-lines': tagLines,
    'empty-tags': emptyTags,
    'escape-inline-tags': escapeInlineTags,
    //endregion Structural formatting

    //region Tag validation
    'check-tag-names': checkTagNames,
    'check-access': checkAccess,
    'valid-types': validTypes,
    'no-types': noTypes,
    //endregion Tag validation

    //region Parameter documentation
    'check-param-names': checkParamNames,
    'require-param': requireParam,
    'require-param-name': requireParamName,
    'require-param-description': requireParamDescription,
    //endregion Parameter documentation

    //region Mutation contracts
    'check-mutates': checkMutates,
    //endregion Mutation contracts

    //region Return documentation
    'require-returns': requireReturns,
    'require-returns-check': requireReturnsCheck,
    'require-returns-description': requireReturnsDescription,
    //endregion Return documentation

    //region Yield documentation
    'require-yields': requireYields,
    'require-yields-check': requireYieldsCheck,
    //endregion Yield documentation
  },
},);

export default plugin;
