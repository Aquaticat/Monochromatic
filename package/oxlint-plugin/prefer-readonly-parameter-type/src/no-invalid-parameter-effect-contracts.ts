/**
 * Parameter effect-contract validation rule.
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
 * Reports invalid parameter effect contracts and ownership markers.
 *
 * @example
 * ```ts
 * plugin.rules['no-invalid-parameter-effect-contracts'];
 * ```
 */
export const noInvalidParameterEffectContracts: CreateOnceRule = {
  meta: {
    type: 'problem',
    hasSuggestions: true,
    docs: {
      description: 'Report stale, missing, or inconsistent parameter effect contracts.',
      recommended: true,
    },
    messages: {
      staleMutatesTag: 'Parameter "{{parameterName}}" has stale @mutates contract.',
      hostCapabilityContractRequired:
        'Parameter "{{parameterName}}" uses ForeignHostCapability for unresolved runtime behavior but lacks corresponding @mutates contract.',
      redundantForeignBorrowed:
        'Parameter "{{parameterName}}" carries a ForeignBorrowed marker that no longer affects classification: its underlying type is deeply readonly and no effect reaches it. Remove the marker, or mark the mutable foreign type it was intended to identify.',
      inconsistentMutatesContract: 'Mutation contracts disagree across callable signatures.',
    },
  },
  /**
   * Creates effect-contract reporter over shared semantic evidence.
   *
   * @param context - Foreign rule context receiving contract diagnostics.
   *
   * @returns visitor filtering invalid contracts and markers.
   *
   * @mutates context - Emits Oxlint diagnostics through foreign rule context.
   *
   * @example
   * ```ts
   * noInvalidParameterEffectContracts.createOnce(context);
   * ```
   */
  createOnce(context: ForeignBorrowed<Context>,): VisitorWithHooks {
    return createReadonlyRuleVisitor({
      context,
      category: 'effect-contract',
    },);
  },
};
