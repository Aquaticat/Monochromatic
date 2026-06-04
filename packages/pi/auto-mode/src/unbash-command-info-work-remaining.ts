/**
 * Less-common AST node visitors for `unbash` command-info traversal.
 *
 * @module
 */

import type {
  Node as UnbashNode,
  Redirect as UnbashRedirect,
} from 'unbash';
import { redirectOnlyCommand, } from './unbash-command-info-convert.ts';
import {
  caseItemWorkItems,
  redirectWordItems,
  redirectWorkItems,
  statementWorkItems,
  wordWorkItems,
} from './unbash-command-info-items.ts';
import {
  EMPTY_REDIRECTS,
  EMPTY_VISIT_RESULT,
  type VisitResult,
} from './unbash-command-info-types.ts';

/**
 * Visit less-common node variants after primary command forms.
 *
 * @param node - AST node to visit
 *
 * @param redirects - redirects inherited from wrapping statement nodes
 *
 * @param paramRefs - parameter references pre-scanned from raw source text
 *
 * @returns commands, child work, and flags emitted by this node
 *
 * @example
 * ```typescript
 * visitRemainingNode({ node, redirects: [], paramRefs: [] });
 * ```
 */
function visitRemainingNode(
  {
    node,
    redirects,
    paramRefs,
  }: {
    readonly node: UnbashNode;
    readonly redirects: readonly UnbashRedirect[];
    readonly paramRefs: readonly string[];
  },
): VisitResult {
  if (node.type === 'Function') {
    return {
      ...EMPTY_VISIT_RESULT,
      workItems: [
        ...wordWorkItems(node.name,),
        {
          kind: 'node',
          node: node.body,
          redirects: node.redirects,
        },
        ...redirectWorkItems(redirects,),
      ],
    };
  }
  if ((node.type === 'Subshell') || (node.type === 'BraceGroup')) {
    return {
      ...EMPTY_VISIT_RESULT,
      workItems: [
        ...statementWorkItems(node.body
          .commands,),
        ...redirectWorkItems(redirects,),
      ],
    };
  }
  if (node.type === 'CompoundList') {
    return {
      ...EMPTY_VISIT_RESULT,
      workItems: [
        ...statementWorkItems(node.commands,),
        ...redirectWorkItems(redirects,),
      ],
    };
  }
  if (node.type === 'Case') {
    return {
      ...EMPTY_VISIT_RESULT,
      workItems: [
        ...wordWorkItems(node.word,),
        ...caseItemWorkItems(node,),
        ...redirectWorkItems(redirects,),
      ],
    };
  }
  return visitRemainingAfterCase({
    node,
    redirects,
    paramRefs,
  },);
}

/**
 * Visit remaining node variants after case statements.
 *
 * @param node - AST node to visit
 *
 * @param redirects - redirects inherited from wrapping statement nodes
 *
 * @param paramRefs - parameter references pre-scanned from raw source text
 *
 * @returns commands, child work, and flags emitted by this node
 *
 * @example
 * ```typescript
 * visitRemainingAfterCase({ node, redirects: [], paramRefs: [] });
 * ```
 */
function visitRemainingAfterCase(
  {
    node,
    redirects,
    paramRefs,
  }: {
    readonly node: UnbashNode;
    readonly redirects: readonly UnbashRedirect[];
    readonly paramRefs: readonly string[];
  },
): VisitResult {
  if (node.type === 'Coproc') {
    return {
      ...EMPTY_VISIT_RESULT,
      workItems: [
        ...(node.name === undefined ? [] : wordWorkItems(node.name,)),
        {
          kind: 'node',
          node: node.body,
          redirects: EMPTY_REDIRECTS,
        },
        ...redirectWorkItems([
          ...redirects,
          ...node.redirects,
        ],),
      ],
    };
  }
  if (node.type === 'ArithmeticFor') {
    return {
      ...EMPTY_VISIT_RESULT,
      workItems: [
        ...(node.initialize === undefined ? [] : [{
          kind: 'arithmetic' as const,
          expression: node.initialize,
        }]),
        ...(node.test === undefined ? [] : [{
          kind: 'arithmetic' as const,
          expression: node.test,
        }]),
        ...(node.update === undefined ? [] : [{
          kind: 'arithmetic' as const,
          expression: node.update,
        }]),
        ...statementWorkItems(node.body
          .commands,),
        ...redirectWorkItems(redirects,),
      ],
    };
  }
  if (node.type === 'TestCommand') {
    return {
      ...EMPTY_VISIT_RESULT,
      workItems: [
        {
          kind: 'test',
          expression: node.expression,
        },
        ...redirectWorkItems(redirects,),
      ],
    };
  }
  if (node.type === 'ArithmeticCommand') {
    return {
      ...EMPTY_VISIT_RESULT,
      workItems: [
        ...(node.expression === undefined ? [] : [{
          kind: 'arithmetic' as const,
          expression: node.expression,
        }]),
        ...redirectWorkItems(redirects,),
      ],
    };
  }
  return visitRedirectsItem({
    redirects,
    paramRefs,
  },);
}

/**
 * Visit redirects attached to compound syntax.
 *
 * @param redirects - redirects to surface as path signals
 *
 * @param paramRefs - parameter references pre-scanned from raw source text
 *
 * @returns redirect-only command plus redirect word traversal
 *
 * @example
 * ```typescript
 * visitRedirectsItem({ redirects, paramRefs: [] });
 * ```
 */
function visitRedirectsItem(
  {
    redirects,
    paramRefs,
  }: {
    readonly redirects: readonly UnbashRedirect[];
    readonly paramRefs: readonly string[];
  },
): VisitResult {
  if (redirects.length === 0)
    return EMPTY_VISIT_RESULT;
  return {
    ...EMPTY_VISIT_RESULT,
    commands: [redirectOnlyCommand({
      redirects,
      paramRefs,
    },),],
    workItems: redirectWordItems(redirects,),
  };
}

export {
  visitRedirectsItem,
  visitRemainingNode,
};
