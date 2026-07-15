import type {
  AtRule,
  Root,
} from 'postcss';
import { mixins, } from './mixin-registry.ts';

// Re-export from the registry so consumers import from mixin.ts only:
// mixin-registry.ts is a private implementation detail.
export {
  expandMixinBodies,
  mixins,
} from './mixin-registry.ts';

//region Mixin Processing

/**
 * Collects \@mixin definitions from CSS and stores them in the registry.
 * A \@mixin with a body (`\@mixin --name { ... }`) is a definition.
 * A \@mixin without a body is malformed and throws an error.
 *
 * @param root - PostCSS root node
 *
 * @mutates root through https://github.com/postcss/postcss clone constructor, accessor, or proxy effects
 *
 * @throws When a \@mixin has no body (definitions require content)
 *
 * @example
 * ```ts
 * const root = postcss.parse('\@mixin --card { padding: 1rem; }');
 * collectMixins(root);
 * ```
 */
export function collectMixins(root: Root,): void {
  root.walkAtRules(
    'mixin',
    /**
     * Stores and removes one mixin definition.
     *
     * @param node - mixin at-rule
     *
     * @mutates node through https://github.com/postcss/postcss clone constructor, accessor, or proxy effects
     */
    function processMixin(node: AtRule,) {
      /**
       * Trimmed at-rule parameter used as the mixin identifier
       */
      const mixinName = node.params
        .trim();

      if (!mixinName)
        throw new Error('@mixin requires a name: @mixin --name { ... }',);

      if ((!node.nodes) || (node.nodes
        .length
        === 0))
        throw new Error('mixin definition must include body',);
      else {
        mixins.set(
          mixinName,
          node.nodes
            .map(
              /**
               * Clones one definition child.
               *
               * @param child - definition child
               *
               * @returns isolated clone
               *
               * @mutates child through https://github.com/postcss/postcss clone constructor, accessor, or proxy effects
               */
              function cloneChild(child,) {
                return child.clone();
              },
            ),
        );
        node.remove();
      }
    },
  );
}

/**
 * Expands \@apply rules by inlining the referenced mixin body.
 *
 * @param root - PostCSS root node
 *
 * @mutates root through https://github.com/postcss/postcss error source, option, getter, or proxy effects
 *
 * @mutates root through https://github.com/postcss/postcss clone constructor, accessor, or proxy effects
 *
 * @throws When an \@apply references an unknown mixin
 *
 * @example
 * ```ts
 * const root = postcss.parse('.btn { \@apply --card; }');
 * expandApplyRules(root);
 * ```
 */
export function expandApplyRules(root: Root,): void {
  root.walkAtRules(
    'apply',
    /**
     * Expands one apply at-rule.
     *
     * @param node - apply at-rule
     *
     * @mutates node through https://github.com/postcss/postcss error source, option, getter, or proxy effects
     */
    function processApply(node: AtRule,) {
      /**
       * Trimmed at-rule parameter identifying which mixin to inline
       */
      const mixinName = node.params
        .trim();

      if (!mixinName)
        throw node.error('Mixin name is required: @apply --name;',);

      /**
       * Stored body nodes for the referenced mixin
       */
      const mixinNodes = mixins.get(mixinName,);

      if (mixinNodes === undefined)
        throw node.error(`Unknown mixin: ${mixinName}`,);

      if (mixinNodes.length
        === 0) {
        node.remove();
        return;
      }

      /**
       * Source location from the \@apply node, propagated to cloned replacements.
       */
      const { source, } = node;

      if (source === undefined) {
        throw new Error(
          `@apply ${mixinName} is missing its source location: parsed nodes should always have one, so PostCSS may have received a programmatically constructed node instead of a parsed one`,
        );
      }

      /**
       * Cloned mixin body with source locations pointing back to the \@apply site.
       */
      const clonedNodes = mixinNodes.map(
        /**
         * Clones one stored node with apply-site source.
         *
         * @param child - stored body node
         *
         * @returns isolated source-adjusted clone
         *
         * @mutates child through https://github.com/postcss/postcss clone constructor, accessor, or proxy effects
         */
        function cloneWithSource(child,) {
          /**
           * Cloning isolates the registry's body from per-call source rewrites.
           */
          const cloned = child.clone();
          cloned.source = source;
          return cloned;
        },
      );

      node.replaceWith(...clonedNodes,);
    },
  );
}

//endregion Mixin Processing
