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
const UNKNOWN_CALL_CHANGE_EXPLANATION = '\n\nAnalysis cannot inspect enough of these calls to determine their effects. They can change the input, change an object stored inside it, invoke a function stored inside it, retain reachable state, or arrange for an effect to happen later.';

/**
 * Supported remediations for calls whose implementation remains unknown.
 */
const UNKNOWN_CALL_REMEDIATION = '\n\nResolve the uncertainty through one of these changes:'
  + '\n1. Include the exact repository-owned implementation in the nearest tsconfig.json so analysis can inspect it.'
  + '\n2. Pass only primitives or a separately verified isolated snapshot sharing no caller-owned identity or capability.'
  + '\n3. Remove or replace the call so caller-owned input does not reach unresolved code.'
  + '\n4. For exact runtime-owned host input, use ForeignHostCapability and document every possible effect with @mutates.'
  + '\n\nAn @mutates block documents known effects but does not prove an unresolved implementation safe.';

/**
 * Explanation for collection calls carrying caller state.
 */
const COLLECTION_CHANGE_EXPLANATION = '\n\nA readonly type stops local writes through the input. It does not stop a collection call from handing elements to unresolved code or carrying those elements into an escaping result.';

/**
 * Supported remediations for unresolved collection-member effects.
 */
const COLLECTION_REMEDIATION = '\n\nResolve the uncertainty through one of these changes:'
  + '\n1. Give the call an observer whose implementation this repository owns.'
  + '\n2. Keep the result inside this function when no caller-owned element escapes through it.'
  + '\n3. Fold to a primitive such as a count, sum, or joined string.'
  + '\n4. Iterate directly with for...of when the result is unnecessary.'
  + '\n\nForeignHostCapability marks runtime-owned host objects, not ordinary collection data.';

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
        `{{inputSubject}} reaches these unresolved calls: {{boundaries}}.${UNKNOWN_CALL_CHANGE_EXPLANATION}${UNKNOWN_CALL_REMEDIATION}`,
      opaqueMethodEffect:
        `{{inputSubject}} is the receiver of these unresolved method calls: {{boundaries}}.\n\nA method can change state stored inside its receiver or in the system it controls.${UNKNOWN_CALL_CHANGE_EXPLANATION}${UNKNOWN_CALL_REMEDIATION}`,
      opaqueCollectionEffect:
        `{{inputSubject}} reaches these unresolved collection calls: {{boundaries}}.${COLLECTION_CHANGE_EXPLANATION}${COLLECTION_REMEDIATION}`,
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
