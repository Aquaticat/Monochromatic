// Slightly over 100 lines — splitting the type guard or expandApplyInNodes into
// a separate file would create a circular dependency with the mixins Map.
import type {
  AtRule,
  ChildNode,
} from 'postcss';

//region Type Guards

/**
 * Narrows a PostCSS ChildNode to AtRule when its type is 'atrule'.
 *
 * @param node - PostCSS child node to check
 *
 * @returns Whether the node is an AtRule
 */
function isAtRule(node: ChildNode,): node is AtRule {
  return node.type === 'atrule';
}

//endregion Type Guards

//region Mixin Registry -- stores mixin definitions and expands nested @apply references

/**
 * Registry for mixin definitions.
 * Stored at module level because the build pipeline is single-threaded and
 * sequential — cleared at the start of each build in index.ts.
 */
export const mixins: Map<string, ChildNode[]> = new Map<string, ChildNode[]>();

/**
 * Recursively expands \@apply rules within a set of nodes.
 * Looks up each \@apply reference in the mixin registry and inlines the body.
 *
 * Uses an imperative loop with push because each node may expand into zero,
 * one, or many replacement nodes — flatMap would work but obscure the three
 * distinct branches (apply-expansion, container-recursion, leaf-clone).
 *
 * @param nodes - Array of CSS nodes to process
 *
 * @returns Processed nodes with \@apply expanded
 *
 * @throws When an \@apply references an unknown mixin name
 */
function expandApplyInNodes(nodes: readonly ChildNode[],): ChildNode[] {
  // flatMap would work but obscure the three distinct branches
  // (apply-expansion, container-recursion, leaf-clone) that each produce
  // a different number of output nodes.
  /**
   * Accumulates expanded nodes from each input node.
   *
   * @param result - Accumulator array of processed nodes
   *
   * @param node - Current node to expand
   *
   * @returns Accumulator with new nodes appended
   */
  function accumulateExpandedNode(
    result: ChildNode[],
    node: ChildNode,
  ): ChildNode[] {
    if (isAtRule(node,) && node.name === 'apply') {
      /** Trimmed at-rule parameter identifying which mixin to inline */
      const mixinName = node.params.trim();
      /** Stored body nodes for the referenced mixin */
      const mixinNodes = mixins.get(mixinName,);

      if (mixinNodes === undefined)
        throw new Error(`Unknown mixin referenced in nested @apply: ${mixinName}`,);

      if (mixinNodes.length > 0) {
        /** Recursively expanded clones of the mixin body */
        const expanded = expandApplyInNodes(
          mixinNodes.map(function cloneChild(childNode,) {
            return childNode.clone();
          },),
        );
        result.push(...expanded,);
      }
    }
    else if ('nodes' in node && Array.isArray(node.nodes,)) {
      /** Deep clone so mutations don't affect the original mixin registry */
      const cloned = node.clone();
      cloned.nodes = expandApplyInNodes(node.nodes.map(function cloneChild(childNode,) {
        return childNode.clone();
      },),);
      result.push(cloned,);
    }
    else {
      result.push(node.clone(),);
    }

    return result;
  }

  return nodes.reduce<ChildNode[]>(
    function accumulate(result, node,) {
      return accumulateExpandedNode(result, node,);
    },
    [],
  );
}

/**
 * Expands nested \@apply rules in all mixin definitions.
 * Runs multiple passes until stable to handle deeply nested mixin references.
 *
 * Fixed-point iteration requires mutable pass tracking — each pass may reveal
 * new nested \@apply rules that only become visible after a prior pass expanded
 * their parent mixin. A functional approach would need to thread state through
 * recursive calls with no clarity benefit.
 *
 * @throws When expansion exceeds the pass limit (circular \@apply references)
 */
export function expandMixinBodies(): void {
  /**
   * Safety limit to detect circular \@apply references between mixins.
   */
  const MAX_PASSES = 10;
  // Mutable counters needed for fixed-point iteration convergence tracking
  let passCount = 0;
  let hasChanges = true;

  while (hasChanges) {
    if (passCount >= MAX_PASSES) {
      throw new Error(
        `Mixin expansion exceeded ${MAX_PASSES} passes — likely caused by circular @apply references between mixins`,
      );
    }

    hasChanges = false;
    passCount++;

    // for...of over the Map because each entry may mutate the map (replacing
    // its own value with an expanded copy), which is inherently imperative.
    for (const [mixinName, nodes,] of mixins) {
      /**
       * Result of recursively expanding any nested \@apply in this mixin's body.
       */
      const expanded = expandApplyInNodes(nodes,);
      /** Serialized original body for change detection */
      const originalStr = nodes
        .map(function nodeToString(node,) {
          return node.toString();
        },)
        .join('',);
      /** Serialized expanded body for change detection */
      const expandedStr = expanded
        .map(function nodeToString(node,) {
          return node.toString();
        },)
        .join('',);

      if (originalStr !== expandedStr) {
        hasChanges = true;
        mixins.set(
          mixinName,
          expanded,
        );
      }
    }
  }
}

//endregion Mixin Registry
