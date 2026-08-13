/**
 * Proved mutation rule for readonly parameter declarations.
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
 * Reports proved caller-reachable mutations through readonly parameters.
 *
 * @example
 * ```ts
 * plugin.rules['no-readonly-parameter-mutations'];
 * ```
 */
export const noReadonlyParameterMutations: CreateOnceRule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Report proved caller-reachable mutations through readonly parameters.',
      recommended: true,
    },
    messages: {
      readonlyParameterMutation:
        'Parameter "{{parameterName}}" is declared readonly, but analysis proved a reachable mutation: {{reason}}.',
    },
  },
  /**
   * Creates mutation reporter over shared semantic evidence.
   *
   * @param context - Foreign rule context receiving mutation diagnostics.
   *
   * @returns visitor filtering proved readonly mutations.
   *
   * @mutates context - Emits Oxlint diagnostics through foreign rule context.
   *
   * @example
   * ```ts
   * noReadonlyParameterMutations.createOnce(context);
   * ```
   */
  createOnce(context: ForeignBorrowed<Context>,): VisitorWithHooks {
    return createReadonlyRuleVisitor({
      context,
      category: 'mutation',
    },);
  },
};
