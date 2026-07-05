/**
 * Primary AST node visitor for `unbash` command-info traversal.
 *
 * @module
 */

import type {
  Node as UnbashNode,
  Redirect as UnbashRedirect,
} from 'unbash';
import { commandToInfo, } from './unbash-command-info-convert.ts';
import {
  commandWordItems,
  nodeWorkItems,
  redirectWorkItems,
  statementWorkItems,
  wordWorkItems,
  wordsWorkItems,
} from './unbash-command-info-items.ts';
import {
  EMPTY_REDIRECTS,
  EMPTY_VISIT_RESULT,
  type VisitResult,
} from './unbash-command-info-types.ts';
import { visitRemainingNode, } from './unbash-command-info-work-remaining.ts';

/**
 * Visit one AST node.
 *
 * Dispatches by node type: {@link commandToInfo} and {@link commandWordItems}
 * for `Command`, {@link nodeWorkItems} for `Pipeline`/`AndOr` children,
 * {@link statementWorkItems} for `If`/`For`/`Select`/`While` bodies,
 * {@link wordWorkItems} and {@link wordsWorkItems} for `For`/`Select` words,
 * {@link redirectWorkItems} for inherited redirects, and
 * {@link visitRemainingNode} for every other node type.
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
 * visitNode({ node, redirects: [], paramRefs: [] });
 * ```
 */
function visitNode(
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
      },],
    };
  }
  if (node.type === 'Command') {
    return {
      ...EMPTY_VISIT_RESULT,
      commands: [commandToInfo({
        command: node,
        inheritedRedirects: redirects,
        paramRefs,
      },),],
      workItems: commandWordItems({
        command: node,
        redirects,
      },),
    };
  }
  if (node.type === 'Pipeline') {
    return {
      ...EMPTY_VISIT_RESULT,
      isPipeline: node.operators
        .length
        > 0,
      workItems: [
        ...nodeWorkItems(node.commands,),
        ...redirectWorkItems(redirects,),
      ],
    };
  }
  if (node.type === 'AndOr') {
    return {
      ...EMPTY_VISIT_RESULT,
      workItems: [
        ...nodeWorkItems(node.commands,),
        ...redirectWorkItems(redirects,),
      ],
    };
  }
  if (node.type === 'If') {
    return {
      ...EMPTY_VISIT_RESULT,
      workItems: [
        ...statementWorkItems(node.clause
          .commands,),
        ...statementWorkItems(node.then
          .commands,),
        ...(node.else === undefined ? [] : [{
          kind: 'node' as const,
          node: node.else,
          redirects: EMPTY_REDIRECTS,
        },]),
        ...redirectWorkItems(redirects,),
      ],
    };
  }
  if ((node.type === 'For') || (node.type === 'Select')) {
    return {
      ...EMPTY_VISIT_RESULT,
      workItems: [
        ...wordWorkItems(node.name,),
        ...wordsWorkItems(node.wordlist,),
        ...statementWorkItems(node.body
          .commands,),
        ...redirectWorkItems(redirects,),
      ],
    };
  }
  if (node.type === 'While') {
    return {
      ...EMPTY_VISIT_RESULT,
      workItems: [
        ...statementWorkItems(node.clause
          .commands,),
        ...statementWorkItems(node.body
          .commands,),
        ...redirectWorkItems(redirects,),
      ],
    };
  }
  return visitRemainingNode({
    node,
    redirects,
    paramRefs,
  },);
}

export { visitNode, };
