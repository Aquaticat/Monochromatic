/**
 * Primary `unbash` node visitor for shell command analysis.
 *
 * @module
 */

import type {
  Node as UnbashNode,
  Redirect as UnbashRedirect,
} from 'unbash';
import type { ForeignBorrowed, } from '@monochromatic-dev/config-oxlint-shared/ts';
import { commandToInfo, } from './convert.ts';
import {
  EMPTY_REDIRECTS,
  EMPTY_VISIT_RESULT,
  type VisitResult,
} from './internal-types.ts';
import type { ShellCommandContext, } from './types.ts';
import { visitRemainingNode, } from './visit-node-remaining.ts';
import {
  commandWordItems,
  nodeWorkItems,
  redirectWorkItems,
  statementWorkItems,
  wordWorkItems,
  wordsWorkItems,
} from './work-items.ts';

/**
 * Visit one AST node.
 *
 * @param node - AST node to visit
 *
 * @param redirects - redirects inherited from wrapping statement nodes
 *
 * @param paramRefs - parameter references pre-scanned from raw source text
 *
 * @param context - execution context inherited by node
 *
 * @returns commands, child work, and flags emitted by node
 *
 * @example
 * ```ts
 * visitNode({ node, redirects: [], paramRefs: [], context });
 * ```
 */
function visitNode(
  {
    node,
    redirects,
    paramRefs,
    context,
  }: {
    readonly node: ForeignBorrowed<UnbashNode>;
    readonly redirects: readonly ForeignBorrowed<UnbashRedirect>[];
    readonly paramRefs: readonly string[];
    readonly context: ShellCommandContext;
  },
): VisitResult {
  if (node.type === 'Statement') {
    return {
      ...EMPTY_VISIT_RESULT,
      workItems: [{
        kind: 'node',
        node: node.command,
        redirects: [
          ...node.redirects,
          ...redirects,
        ],
        context,
      },],
      flags: {
        ...EMPTY_VISIT_RESULT.flags,
        hasBackground: node.background === true,
      },
    };
  }
  if (node.type === 'Command') {
    return {
      ...EMPTY_VISIT_RESULT,
      commands: [commandToInfo({
        command: node,
        inheritedRedirects: redirects,
        paramRefs,
        context,
      },),],
      workItems: commandWordItems({
        command: node,
        redirects,
        context,
      },),
    };
  }
  if (node.type === 'Pipeline') {
    return {
      ...EMPTY_VISIT_RESULT,
      flags: {
        ...EMPTY_VISIT_RESULT.flags,
        isPipeline: node.operators
          .length
          > 0,
      },
      workItems: [
        ...nodeWorkItems({
          nodes: node.commands,
          context,
        },),
        ...redirectWorkItems({
          redirects,
          context,
        },),
      ],
    };
  }
  if (node.type === 'AndOr') {
    return {
      ...EMPTY_VISIT_RESULT,
      workItems: [
        ...nodeWorkItems({
          nodes: node.commands,
          context,
        },),
        ...redirectWorkItems({
          redirects,
          context,
        },),
      ],
    };
  }
  if (node.type === 'If') {
    return {
      ...EMPTY_VISIT_RESULT,
      workItems: [
        ...statementWorkItems({
          statements: node.clause
            .commands,
          context,
        },),
        ...statementWorkItems({
          statements: node.then
            .commands,
          context,
        },),
        ...(node.else === undefined ? [] : [{
          kind: 'node' as const,
          node: node.else,
          redirects: EMPTY_REDIRECTS,
          context,
        }]),
        ...redirectWorkItems({
          redirects,
          context,
        },),
      ],
    };
  }
  if ((node.type === 'For') || (node.type === 'Select')) {
    return {
      ...EMPTY_VISIT_RESULT,
      workItems: [
        ...wordWorkItems({
          word: node.name,
          context,
        },),
        ...wordsWorkItems({
          words: node.wordlist,
          context,
        },),
        ...statementWorkItems({
          statements: node.body
            .commands,
          context,
        },),
        ...redirectWorkItems({
          redirects,
          context,
        },),
      ],
    };
  }
  if (node.type === 'While') {
    return {
      ...EMPTY_VISIT_RESULT,
      workItems: [
        ...statementWorkItems({
          statements: node.clause
            .commands,
          context,
        },),
        ...statementWorkItems({
          statements: node.body
            .commands,
          context,
        },),
        ...redirectWorkItems({
          redirects,
          context,
        },),
      ],
    };
  }
  return visitRemainingNode({
    node,
    redirects,
    paramRefs,
    context,
  },);
}

export { visitNode, };
