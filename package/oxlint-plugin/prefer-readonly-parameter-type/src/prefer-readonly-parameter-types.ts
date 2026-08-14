/**
 * Positive-evidence readonly parameter preference rule.
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
 * Reports mutable parameters with proved deeply readonly replacements.
 *
 * @example
 * ```ts
 * plugin.rules['prefer-readonly-parameter-types'];
 * ```
 */
export const preferReadonlyParameterTypes: CreateOnceRule = {
  meta: {
    type: 'problem',
    fixable: 'code',
    hasSuggestions: true,
    docs: {
      description: 'Report parameters with a proved deeply readonly replacement.',
      recommended: true,
    },
    messages: {
      shouldBeReadonly: '{{parameterSubject}} can be deeply readonly: {{reason}}. {{guidance}}',
    },
  },
  /**
   * Creates preference reporter over shared semantic evidence.
   *
   * @param context - Foreign rule context receiving preference diagnostics.
   *
   * @returns visitor filtering proved readonly replacements.
   *
   * @mutates context - Emits Oxlint diagnostics through foreign rule context.
   *
   * @example
   * ```ts
   * preferReadonlyParameterTypes.createOnce(context);
   * ```
   */
  createOnce(context: ForeignBorrowed<Context>,): VisitorWithHooks {
    return createReadonlyRuleVisitor({
      context,
      category: 'preference',
    },);
  },
};
