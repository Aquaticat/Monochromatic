/**
 * Unresolved parameter-reachable effect audit rule.
 *
 * @module
 */

import type { ForeignBorrowed, } from '@monochromatic-dev/ownership-marker-foreign-borrowed/ts';
import type {
  Context,
  CreateOnceRule,
  VisitorWithHooks,
} from '@oxlint/plugins';

import { createReadonlyRuleVisitor, } from './prefer-readonly-parameter-types/readonly-rule-visitor.ts';

/**
 * Plain-language explanation for calls whose implementation remains unknown.
 */
const UNKNOWN_CALL_CHANGE_EXPLANATION = '\n\nThis rule cannot inspect enough of those calls to know what they might change. They could change the input itself, change an object stored inside it, call a function stored inside it, or arrange for one of those changes to happen later.';

/**
 * Supported remediations for calls whose implementation remains unknown.
 */
const UNKNOWN_CALL_REMEDIATION = '\n\nResolve the call by one of these proof-preserving changes:'
  + '\n1. Include the exact repository-owned implementation in the nearest tsconfig.json so the rule can inspect it.'
  + '\n2. Pass only primitive values or a separately verified isolated snapshot that shares no caller-owned identity or capability.'
  + '\n3. Remove or replace the call so no caller-owned input reaches unresolved code.'
  + '\n4. After source and source-map inference are exhausted, mark exact runtime-owned host input as ForeignHostCapability and document its possible effects with @mutates.'
  + '\n\nAn @mutates block alone documents known effects but cannot make an unresolved implementation safe.';

/**
 * Explanation for collection calls carrying caller state.
 */
const COLLECTION_CHANGE_EXPLANATION = '\n\nA readonly type stops this code from writing through the input. It does not stop the call from handing an element to code this rule cannot follow, and that is what stays unproven here: not what this function does to the input, but which of its values leave.';

/**
 * Supported remediations for unresolved collection-member effects.
 */
const COLLECTION_REMEDIATION = '\n\nResolve it by one of these changes:'
  + '\n1. Give the call an observer this repository owns, so its effects can be read. A function declared here resolves; one imported from a package whose implementation is unavailable does not.'
  + '\n2. Keep the result inside this function. A result that is returned, stored, or handed to a call this rule cannot resolve leaves what the analysis can follow.'
  + '\n3. Fold to a primitive instead of building a collection. A count, a sum or a joined string carries no element onward.'
  + '\n4. Iterate directly with for...of when the result itself is not needed.'
  + '\n\nForeignHostCapability does not apply here. It marks runtime-owned host objects, not ordinary collection data.';

/**
 * Reports unresolved effects reachable from parameter state.
 *
 * @example
 * ```ts
 * plugin.rules['no-opaque-parameter-effects'];
 * ```
 */
export const noOpaqueParameterEffects: CreateOnceRule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Report unresolved effects reachable from parameter state.',
      recommended: true,
    },
    messages: {
      opaqueEffect:
        `{{inputSubject}} exposed to these unresolved calls: {{boundaries}}.${UNKNOWN_CALL_CHANGE_EXPLANATION}${UNKNOWN_CALL_REMEDIATION}`,
      opaqueMethodEffect:
        `{{inputSubject}} the receiver of these unresolved method calls: {{boundaries}}.\n\nA method can change state stored inside its receiver or in the system it controls.${UNKNOWN_CALL_CHANGE_EXPLANATION}${UNKNOWN_CALL_REMEDIATION}`,
      opaqueCollectionEffect:
        `{{inputSubject}} exposed through these unresolved collection calls: {{boundaries}}.${COLLECTION_CHANGE_EXPLANATION}${COLLECTION_REMEDIATION}`,
      projectedCallableCapability:
        'Parameter "{{parameterName}}" uses a readonly projection that retains unresolved callable capability: {{reason}}. Replace it with a data-only readonly view or make the exact callable effects available to analysis.',
    },
  },
  /**
   * Creates unresolved-effect reporter over shared semantic evidence.
   *
   * @param context - Foreign rule context receiving opacity diagnostics.
   *
   * @returns visitor filtering unresolved parameter effects.
   *
   * @mutates context - Emits Oxlint diagnostics through foreign rule context.
   *
   * @example
   * ```ts
   * noOpaqueParameterEffects.createOnce(context);
   * ```
   */
  createOnce(context: ForeignBorrowed<Context>,): VisitorWithHooks {
    return createReadonlyRuleVisitor({
      context,
      category: 'opaque-effect',
    },);
  },
};
