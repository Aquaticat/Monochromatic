import {
  eslintCompatPlugin,
  type Plugin,
} from '@oxlint/plugins';

import { noArrowFunction, } from './rules/no-arrow-function.ts';
import {
  noArrayCallbackReference,
} from './rules/no-array-callback-reference.ts';
import { noClass, } from './rules/no-class.ts';
import { noDisableMaxLines, } from './rules/no-disable-max-lines.ts';
import { noDisableNoArrowFunction, } from './rules/no-disable-no-arrow-function.ts';
import { noDisableNoEnum, } from './rules/no-disable-no-enum.ts';
import { noDisableNoForIn, } from './rules/no-disable-no-for-in.ts';
import { noDisableNoHasownproperty, } from './rules/no-disable-no-hasownproperty.ts';
import { noDisableNoMisusedPromises, } from './rules/no-disable-no-misused-promises.ts';
import {
  noDisableNoNonNullAssertion,
} from './rules/no-disable-no-non-null-assertion.ts';
import { noDisableNoPromiseCatch, } from './rules/no-disable-no-promise-catch.ts';
import { noDisableNoPromiseFinally, } from './rules/no-disable-no-promise-finally.ts';
import { noDisableNoRestParams, } from './rules/no-disable-no-rest-params.ts';
import { noDisableNoSwitch, } from './rules/no-disable-no-switch.ts';
import { noDisableNoTrimLeftRight, } from './rules/no-disable-no-trim-left-right.ts';
import { noDisableNoTryFinally, } from './rules/no-disable-no-try-finally.ts';
import { noDisableNoUselessReturn, } from './rules/no-disable-no-useless-return.ts';
import {
  noDisableNoVariableFunctionExpression,
} from './rules/no-disable-no-variable-function-expression.ts';
import { noDisablePreferReadonlyParameterTypes, } from './rules/no-disable-prefer-readonly-parameter-types.ts';
import { noDisablePreferRegexpExec, } from './rules/no-disable-prefer-regexp-exec.ts';
import {
  noDisableRequireDestructuredParams,
} from './rules/no-disable-require-destructured-params.ts';
import { noDisableRequireReturns, } from './rules/no-disable-require-returns.ts';
import { noDisableRequireTsdoc, } from './rules/no-disable-require-tsdoc.ts';
import { noEnum, } from './rules/no-enum.ts';
import { noForIn, } from './rules/no-for-in.ts';
import { noFunctionRootLet, } from './rules/no-function-root-let.ts';
import { noHasownproperty, } from './rules/no-hasownproperty.ts';
import { noImmediateMutation, } from './rules/no-immediate-mutation.ts';
import {
  noLowInformationSymbolDescription,
} from './rules/no-low-information-symbol-description/index.ts';
import { noModuleRootLet, } from './rules/no-module-root-let.ts';
import { noNullishUnion, } from './rules/no-nullish-union.ts';
import { catchBinding, } from './rules/catch-binding.ts';
import { noOptionalEscape, } from './rules/no-optional-escape.ts';
import { noPromiseCatch, } from './rules/no-promise-catch.ts';
import { noPromiseFinally, } from './rules/no-promise-finally.ts';
import { noRegex, } from './rules/no-regex.ts';
import { noRestParams, } from './rules/no-rest-params.ts';
import { noSwitch, } from './rules/no-switch.ts';
import { noSync, } from './rules/no-sync.ts';
import { noTrimLeftRight, } from './rules/no-trim-left-right.ts';
import { noTryFinally, } from './rules/no-try-finally.ts';
import {
  noVariableFunctionExpression,
} from './rules/no-variable-function-expression.ts';
import {
  preferDescribeFunctionRefName,
} from './rules/prefer-describe-function-ref-name.ts';
import { preferErrorIsError, } from './rules/prefer-error-is-error.ts';
import { preferReadonlyParameterTypes, } from './rules/prefer-readonly-parameter-types.ts';
import { requireDestructuredParams, } from './rules/require-destructured-params.ts';
import { requireQueryselectorGeneric, } from './rules/require-queryselector-generic.ts';

export {
  classifyReadonlyType,
  propertyIsReadonly,
  type ReadonlyClassification,
} from './rules/prefer-readonly-parameter-types/readonly-classifier.ts';

export {
  closeSemanticBridge,
  openSemanticFile,
  semanticBridgeCacheStats,
  type SemanticBridgeCacheStats,
  type SemanticFileSession,
} from './rules/prefer-readonly-parameter-types/typescript-sync-adapter.ts';

export {
  buildEffectSummaryIndex,
  NO_EFFECT_SUMMARY,
  type CallableEffectSummary,
  type EffectSummaryIndex,
} from './rules/prefer-readonly-parameter-types/effect-summaries.ts';

export {
  intrinsicEffectQuery,
  intrinsicProvenance,
  NO_INTRINSIC_PROVENANCE,
  NO_INTRINSIC_QUERY,
} from './rules/prefer-readonly-parameter-types/intrinsic-effect-query.ts';

export {
  INTRINSIC_EFFECTS,
  intrinsicEffect,
  NO_INTRINSIC_EFFECT,
  type IntrinsicEffectEntry,
  type IntrinsicEffectQuery,
  type IntrinsicEffectTarget,
  type IntrinsicProvenance,
} from './rules/prefer-readonly-parameter-types/intrinsic-effect-catalog.ts';

export {
  findNodeAtOffset,
  typescriptOffset,
} from './rules/prefer-readonly-parameter-types/typescript-node-map.ts';

/**
 * Oxlint JS plugin implementing `no-restricted-syntax` rules
 * that oxlint does not support natively.
 *
 * Oxlint lacks ESLint's `no-restricted-syntax` rule because it requires
 * a full AST selector engine. This plugin provides individual rules
 * for each banned syntax pattern instead.
 *
 * Also includes `no-disable-*` rules that prevent inline `oxlint-disable`
 * comments from suppressing specific rules. These enforce that certain
 * conventions cannot be sidestepped with disable comments.
 *
 * @example
 * ```typescript
 * // oxlint.config.ts
 * import { defineConfig } from 'oxlint';
 * export default defineConfig({
 *   jsPlugins: ['\@monochromatic-dev/config-oxlint-no-restricted-syntax'],
 * });
 * ```
 */
const plugin: Plugin = eslintCompatPlugin({
  meta: {
    name: 'no-restricted-syntax',
  },
  rules: {
    //region Syntax rules
    'no-arrow-function': noArrowFunction,
    'no-array-callback-reference': noArrayCallbackReference,
    'no-class': noClass,
    'no-enum': noEnum,
    'no-for-in': noForIn,
    'no-function-root-let': noFunctionRootLet,
    'no-hasownproperty': noHasownproperty,
    'no-immediate-mutation': noImmediateMutation,
    'no-low-information-symbol-description': noLowInformationSymbolDescription,
    'no-module-root-let': noModuleRootLet,
    'no-nullish-union': noNullishUnion,
    'catch-binding': catchBinding,
    'no-optional-escape': noOptionalEscape,
    'no-promise-catch': noPromiseCatch,
    'no-promise-finally': noPromiseFinally,
    'no-regex': noRegex,
    'no-rest-params': noRestParams,
    'no-switch': noSwitch,
    'no-sync': noSync,
    'no-trim-left-right': noTrimLeftRight,
    'no-try-finally': noTryFinally,
    'no-variable-function-expression': noVariableFunctionExpression,
    'prefer-describe-function-ref-name': preferDescribeFunctionRefName,
    'prefer-error-is-error': preferErrorIsError,
    'prefer-readonly-parameter-types': preferReadonlyParameterTypes,
    'require-destructured-params': requireDestructuredParams,
    'require-queryselector-generic': requireQueryselectorGeneric,
    //endregion Syntax rules

    //region Ban-disable rules -- prevent inline oxlint-disable for specific rules
    'no-disable-max-lines': noDisableMaxLines,
    'no-disable-no-arrow-function': noDisableNoArrowFunction,
    'no-disable-no-enum': noDisableNoEnum,
    'no-disable-no-for-in': noDisableNoForIn,
    'no-disable-no-hasownproperty': noDisableNoHasownproperty,
    'no-disable-no-misused-promises': noDisableNoMisusedPromises,
    'no-disable-no-promise-catch': noDisableNoPromiseCatch,
    'no-disable-no-promise-finally': noDisableNoPromiseFinally,
    'no-disable-no-rest-params': noDisableNoRestParams,
    'no-disable-no-switch': noDisableNoSwitch,
    'no-disable-no-trim-left-right': noDisableNoTrimLeftRight,
    'no-disable-no-try-finally': noDisableNoTryFinally,
    'no-disable-no-useless-return': noDisableNoUselessReturn,
    'no-disable-no-variable-function-expression': noDisableNoVariableFunctionExpression,
    'no-disable-no-non-null-assertion': noDisableNoNonNullAssertion,
    'no-disable-prefer-readonly-parameter-types': noDisablePreferReadonlyParameterTypes,
    'no-disable-prefer-regexp-exec': noDisablePreferRegexpExec,
    'no-disable-require-destructured-params': noDisableRequireDestructuredParams,
    'no-disable-require-returns': noDisableRequireReturns,
    'no-disable-require-tsdoc': noDisableRequireTsdoc,
    //endregion Ban-disable rules
  },
},);

export default plugin;
