// Slightly over 100 lines; splitting the type guard or expandApplyInNodes into
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
  return node.type
    === 'atrule';
}

//endregion Type Guards

//region Mixin Registry: stores mixin definitions and expands nested @apply references

/**
 * Registry for mixin definitions.
 * Stored at module level because the build pipeline is single-threaded and
 * sequential; cleared at the start of each build in index.ts.
 */
export const mixins: Map<string, ChildNode[]> = new Map<string, ChildNode[]>();

/**
 * Safety limit to detect circular \@apply references between mixins.
 * Module-level because both {@link runMixinPasses} and {@link expandMixinBodies}
 * reference it for the bound check and the error message.
 */
const MAX_PASSES = 10;

/**
 * Recursively expands \@apply rules within a set of nodes.
 * Looks up each \@apply reference in the mixin registry and inlines the body.
 *
 * Uses reduce with a callback per node because each node may expand into zero,
 * one, or many replacement nodes; flatMap would work but obscure the three
 * distinct branches (apply-expansion, container-recursion, leaf-clone).
 *
 * @param nodes - Array of CSS nodes to process
 *
 * @returns Processed nodes with \@apply expanded
 *
 * @mutates nodes through https://github.com/postcss/postcss clone constructor, accessor, or proxy effects
 *
 * @throws When an \@apply references an unknown mixin name
 */
function expandApplyInNodes(nodes: readonly ChildNode[],): ChildNode[] {
  return nodes.reduce<ChildNode[]>(
    /**
     * Expands one source node into accumulator.
     *
     * @param result - expanded nodes accumulated so far
     *
     * @param node - current source node
     *
     * @returns updated accumulator
     *
     * @mutates node through https://github.com/postcss/postcss clone constructor, accessor, or proxy effects
     */
    function accumulateExpandedNode(
      result,
      node,
    ) {
      if (isAtRule(node,)
        && (node.name
          === 'apply')) {
        /**
         * Trimmed at-rule parameter identifying which mixin to inline
         */
        const mixinName = node.params
          .trim();
        /**
         * Stored body nodes for the referenced mixin
         */
        const mixinNodes = mixins.get(mixinName,);

        if (mixinNodes === undefined)
          throw new Error(`Unknown mixin referenced in nested @apply: ${mixinName}`,);

        if (mixinNodes.length
          > 0) {
          /**
           * Recursively expanded clones of the mixin body
           */
          const expanded = expandApplyInNodes(
            mixinNodes.map(
              /**
               * Clones one stored mixin child.
               *
               * @param childNode - stored child
               *
               * @returns isolated clone
               *
               * @mutates childNode through https://github.com/postcss/postcss clone constructor, accessor, or proxy effects
               */
              function cloneChild(childNode,) {
                return childNode.clone();
              },
            ),
          );
          result.push(...expanded,);
        }
      }
      else if (('nodes' in node) && Array
        .isArray(node.nodes,)) {
        /**
         * Deep clone so mutations don't affect the original mixin registry
         */
        const cloned = node.clone();
        cloned.nodes = expandApplyInNodes(node.nodes
          .map(
            /**
             * Clones one nested child.
             *
             * @param childNode - nested child
             *
             * @returns isolated clone
             *
             * @mutates childNode through https://github.com/postcss/postcss clone constructor, accessor, or proxy effects
             */
            function cloneChild(childNode,) {
              return childNode.clone();
            },
          ),);
        result.push(cloned,);
      }
      else {
        result.push(node.clone(),);
      }

      return result;
    },
    [],
  );
}

/**
 * Runs a single expansion pass over every registered mixin via
 * {@link expandApplyInNodes}. Returns whether any mixin body changed during
 * this pass.
 *
 * @returns True when at least one mixin was replaced with an expanded body
 */
function runSingleMixinPass(): boolean {
  // Iterates every entry (rather than `.some`) so each pass evaluates every
  // mixin and writes back any that changed; the reduce aggregates the
  // per-entry change flag without a function-root `let`.
  return [...mixins,].reduce(
    /**
     * Expands and compares one registered mixin.
     *
     * @param changedSoFar - whether prior entry changed
     *
     * @param entry - mixin name and body nodes
     *
     * @returns whether current or prior entry changed
     *
     * @mutates entry through https://github.com/postcss/postcss clone constructor, accessor, or proxy effects
     *
     * @mutates entry through https://github.com/postcss/postcss toString stringifier and property effects
     */
    function detectAnyChange(
      changedSoFar: boolean,
      entry: readonly [
        string,
        ChildNode[],
      ],
    ) {
      /**
       * Mixin name and body nodes from current registry entry.
       */
      const [mixinName, nodes,] = entry;
      /**
       * Result of recursively expanding any nested \@apply in this mixin's body.
       */
      const expanded = expandApplyInNodes(nodes,);
      /**
       * Serialized original body for change detection
       */
      const originalStr = nodes
        .map(
          /**
           * Serializes one original node.
           *
           * @param node - original node
           *
           * @returns CSS text
           *
           * @mutates node through https://github.com/postcss/postcss toString stringifier and property effects
           */
          function nodeToString(node,) {
            return node.toString();
          },
        )
        .join('',);
      /**
       * Serialized expanded body for change detection
       */
      const expandedStr = expanded
        .map(
          /**
           * Serializes one expanded node.
           *
           * @param node - expanded node
           *
           * @returns CSS text
           *
           * @mutates node through https://github.com/postcss/postcss toString stringifier and property effects
           */
          function nodeToString(node,) {
            return node.toString();
          },
        )
        .join('',);

      if (originalStr !== expandedStr) {
        mixins.set(
          mixinName,
          expanded,
        );
        return true;
      }
      return changedSoFar;
    },
    false,
  );
}

/**
 * Recursively runs expansion passes until a pass produces no changes,
 * or the remaining attempt counter reaches zero (circular reference guard).
 *
 * @param remainingAttempts - Passes still allowed before the cycle guard trips
 *
 * @throws When `remainingAttempts` hits zero with changes still occurring
 */
function runMixinPasses(remainingAttempts: number,): void {
  if (remainingAttempts === 0) {
    throw new Error(
      `Mixin expansion exceeded ${MAX_PASSES} passes: likely caused by circular @apply references between mixins`,
    );
  }
  if (runSingleMixinPass())
    runMixinPasses(remainingAttempts - 1,);
}

/**
 * Expands nested \@apply rules in all mixin definitions.
 * Runs multiple passes until stable to handle deeply nested mixin references.
 *
 * Fixed-point iteration drives convergence: each pass may reveal new nested
 * \@apply rules that only become visible after a prior pass expanded their
 * parent mixin. {@link runMixinPasses} bounds the recursion at {@link MAX_PASSES}.
 *
 * @throws When expansion exceeds the pass limit (circular \@apply references)
 *
 * @example
 * ```ts
 * collectMixins(root);
 * expandMixinBodies();
 * ```
 */
export function expandMixinBodies(): void {
  runMixinPasses(MAX_PASSES,);
}

//endregion Mixin Registry
