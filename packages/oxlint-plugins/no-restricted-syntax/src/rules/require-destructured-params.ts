import type {
  CreateOnceRule,
  ESTree,
} from '@oxlint/plugins';
import type { ForeignBorrowed, } from '@monochromatic-dev/config-oxlint-shared/ts';

import { simpleBanRule, } from './_simple-ban-rule.ts';

/**
 * Friendly diagnostic for declarations that should use named parameters.
 *
 * @example
 * ```ts
 * REQUIRE_DESTRUCTURED_PARAMS_MESSAGE;
 * ```
 */
const REQUIRE_DESTRUCTURED_PARAMS_MESSAGE = [
  'For function declarations with 2 or more inputs, use one destructured object parameter, ',
  'for example `function createUser({ name, age }) { ... }`. ',
  'Allowed positional parameters: single-parameter declarations, ',
  'and callback function expressions whose API supplies the argument list, ',
  'such as `items.toSorted(function byName(left, right) { ... })`.',
].join('',);

/**
 * Requires function declarations with 2 or more parameters to use
 * a single destructured object parameter (named params pattern). Built via
 * {@link simpleBanRule}.
 *
 * Only fires on `function` declarations, which are always user-controlled.
 * Function expressions passed as callbacks are exempt because their
 * signatures are often dictated by external APIs.
 *
 * @example
 * ```ts
 * // Bad; multiple positional parameters
 * function createUser(name: string, age: number): User { }
 *
 * // Good; single destructured object
 * function createUser({ name, age }: { name: string; age: number }): User { }
 *
 * // Good; single parameter (exempt)
 * function greet(name: string): void { }
 * ```
 */
export const requireDestructuredParams: CreateOnceRule = simpleBanRule({
  type: 'suggestion',
  nodeType: 'FunctionDeclaration',
  description:
    'Require function declarations with 2+ params to use a single destructured object parameter.',
  messageId: 'required',
  message: REQUIRE_DESTRUCTURED_PARAMS_MESSAGE,
  shouldReport(node: ForeignBorrowed<ESTree.Node>,): boolean {
    /**
     * Minimum parameter count that triggers the rule.
     */
    const minParams = 2;
    if (node.type !== 'FunctionDeclaration')
      return false;
    /**
     * Function declaration parameters.
     */
    const { params, } = node;
    /**
     * Function declaration parameter count.
     */
    const paramCount = params.length;
    return paramCount >= minParams;
  },
},);
