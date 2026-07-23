import { isTokenWhitespace, } from '@csstools/css-tokenizer';
import type {
  CssNode,
  CssStylesheet,
  CssTrivia,
} from './node.ts';
import { isCssTrivia, } from './node.ts';

//region Visitor contract

/**
 * Replacement decision for one visited node: the same node (keep), a different
 * node (replace), a node array (splice in place, empty allowed), or null
 * (remove).
 */
export type CssVisitResult = CssNode | readonly CssNode[] | null;

/**
 * Callback deciding each node's fate. Called bottom-up: a container's children
 * are transformed before the container itself is visited, so the visitor sees
 * containers with already-rewritten bodies.
 */
export type CssVisitor = (node: CssNode,) => CssVisitResult;

//endregion Visitor contract

//region Transform

/**
 * Rebuilds a node list immutably under a visitor, bottom-up.
 *
 * Containers (rules and block-bearing at-rules) get their block children
 * transformed first; the visitor then sees the rebuilt container. Untouched
 * subtrees keep reference identity, and when nothing changes at all the
 * original array returns unchanged, giving cheap structural sharing.
 *
 * @param nodes - Nodes to transform.
 *
 * @param visit - Per-node replacement decision.
 *
 * @param pruneTriviaBeforeRemoved - Whether removing a node also drops the
 * trivia run immediately before it, so deletions do not leave doubled blank
 * space (mirrors how postcss removal ate the node's leading whitespace).
 *
 * @returns Transformed node list; reference-equal to the input when no node changed.
 *
 * @example
 * ```ts
 * transformNodes({
 *   nodes: state.root.children,
 *   visit: (node) => node.kind === 'atRule' && node.name === 'mixin' ? null : node,
 *   pruneTriviaBeforeRemoved: true,
 * });
 * ```
 */
export function transformNodes({
  nodes,
  visit,
  pruneTriviaBeforeRemoved = false,
}: {
  readonly nodes: readonly CssNode[];
  readonly visit: CssVisitor;
  readonly pruneTriviaBeforeRemoved?: boolean;
},): readonly CssNode[] {
  /**
   * Whether any node differs from the input; gates the structural-sharing return.
   */
  let changed = false;
  /**
   * Rebuilt node list.
   */
  const out: CssNode[] = [];

  for (const node of nodes) {
    /**
     * Node with its block children already transformed, when it has any.
     */
    const inner = rebuildContainer({
      node,
      visit,
      pruneTriviaBeforeRemoved,
    },);
    if (inner !== node)
      changed = true;

    /**
     * Visitor's decision for the rebuilt node.
     */
    const result = visit(inner,);

    if (result === null) {
      changed = true;
      /**
       * Node currently last in the rebuilt list, candidate leading trivia.
       */
      const last = out.at(-1,);
      if (pruneTriviaBeforeRemoved && (last !== undefined) && isCssTrivia(last,)) {
        out.pop();
        /**
         * Trivia with whitespace after its last comment dropped; comments
         * themselves survive removal, mirroring postcss (which stored only
         * the whitespace run on the removed node).
         */
        const kept = trimTrailingWhitespace(last,);
        if (kept !== undefined)
          out.push(kept,);
      }
      continue;
    }

    if (Array.isArray(result,)) {
      changed = true;
      out.push(
        /* oxlint-disable typescript/no-unsafe-type-assertion -- Array.isArray narrows to any[]; the visitor contract fixes the element type */
        ...result as readonly CssNode[],
        /* oxlint-enable typescript/no-unsafe-type-assertion */
      );
      continue;
    }

    if (result !== inner)
      changed = true;
    /* oxlint-disable typescript/no-unsafe-type-assertion -- non-array, non-null CssVisitResult is a CssNode */
    out.push(result as CssNode,);
    /* oxlint-enable typescript/no-unsafe-type-assertion */
  }

  return changed ? out : nodes;
}

/**
 * Drops the whitespace tokens trailing a trivia run's last comment, so node
 * removal eats the blank space that led into the node without eating the
 * comments before it.
 *
 * @param trivia - Trivia run preceding a removed node.
 *
 * @returns Trimmed trivia, or undefined when the run was whitespace-only.
 */
function trimTrailingWhitespace(trivia: CssTrivia,): CssTrivia | undefined {
  /**
   * Index one past the run's last non-whitespace token.
   */
  const keepEnd = trivia.tokens
    .findLastIndex(
      /**
       * Reports whether one token must survive the trim.
       *
       * @param token - Trivia token.
       *
       * @returns Whether the token is not plain whitespace.
       */
      function isNotWhitespace(token,) {
        return !isTokenWhitespace(token,);
      },
    ) + 1;
  if (keepEnd === 0)
    return undefined;
  if (keepEnd === trivia.tokens.length)
    return trivia;
  return {
    kind: 'trivia',
    tokens: trivia.tokens.slice(
      0,
      keepEnd,
    ),
  };
}

/**
 * Transforms the children of a container node, returning a rebuilt container
 * when they changed and the original node otherwise. Non-containers pass
 * through untouched.
 *
 * @param node - Candidate container.
 *
 * @param visit - Per-node replacement decision, forwarded to the recursion.
 *
 * @param pruneTriviaBeforeRemoved - Removal policy, forwarded to the recursion.
 *
 * @returns Node with transformed block children, or the input node.
 */
function rebuildContainer({
  node,
  visit,
  pruneTriviaBeforeRemoved,
}: {
  readonly node: CssNode;
  readonly visit: CssVisitor;
  readonly pruneTriviaBeforeRemoved: boolean;
},): CssNode {
  if ((node.kind !== 'rule') && (node.kind !== 'atRule'))
    return node;
  /**
   * Block owned by the container, absent on statement at-rules.
   */
  const { block, } = node;
  if (block === undefined)
    return node;

  /**
   * Transformed block children.
   */
  const children = transformNodes({
    nodes: block.children,
    visit,
    pruneTriviaBeforeRemoved,
  },);
  if (children === block.children)
    return node;

  return {
    ...node,
    block: {
      ...block,
      children,
    },
  };
}

//endregion Transform

/**
 * Convenience wrapper transforming a whole stylesheet, returning a fresh root
 * when anything changed.
 *
 * @param root - Stylesheet to transform.
 *
 * @param visit - Per-node replacement decision.
 *
 * @param pruneTriviaBeforeRemoved - Removal policy for leading trivia.
 *
 * @returns Transformed stylesheet; reference-equal to the input when unchanged.
 *
 * @example
 * ```ts
 * transformStylesheet({ root: state.root, visit: dropMixins });
 * ```
 */
export function transformStylesheet({
  root,
  visit,
  pruneTriviaBeforeRemoved = false,
}: {
  readonly root: CssStylesheet;
  readonly visit: CssVisitor;
  readonly pruneTriviaBeforeRemoved?: boolean;
},): CssStylesheet {
  /**
   * Transformed top-level children.
   */
  const children = transformNodes({
    nodes: root.children,
    visit,
    pruneTriviaBeforeRemoved,
  },);
  if (children === root.children)
    return root;
  return {
    kind: 'stylesheet',
    children,
  };
}
