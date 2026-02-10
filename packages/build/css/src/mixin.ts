import type {
  AtRule,
  Root,
} from 'postcss';
import { mixins, } from './mixin-registry.ts';

export { mixins, expandMixinBodies, } from './mixin-registry.ts';

//region Mixin Processing

/**
 * Collects \@mixin definitions from CSS and stores them in the registry.
 * A \@mixin with a body (`\@mixin --name { ... }`) is a definition.
 * A \@mixin without a body is malformed and throws an error.
 * @param root - PostCSS root node
 * @throws When a \@mixin has no body (definitions require content)
 */
export function collectMixins(root: Root): void {
  root.walkAtRules('mixin', (node: AtRule) => {
    const mixinName = node.params.trim();

    if (!mixinName) {
      throw new Error('@mixin requires a name: @mixin --name { ... }');
    }

    if (!node.nodes || node.nodes.length === 0) {
      throw new Error("mixin definition must include body");
    } else {
      mixins.set(mixinName, node.nodes.map((child) => child.clone()));
      node.remove();
    }
  });
}

/**
 * Expands \@apply rules by inlining the referenced mixin body.
 * @param root - PostCSS root node
 * @throws When an \@apply references an unknown mixin
 */
export function expandApplyRules(root: Root): void {
  root.walkAtRules('apply', (node: AtRule) => {
    const mixinName = node.params.trim();

    if (!mixinName) {
      throw node.error('Mixin name is required: @apply --name;');
    }

    const mixinNodes = mixins.get(mixinName);

    if (mixinNodes === undefined) {
      throw node.error(`Unknown mixin: ${mixinName}`);
    }

    if (mixinNodes.length === 0) {
      node.remove();
      return;
    }

    const { source } = node;

    if (source === undefined) {
      throw new Error(`@apply ${mixinName} is missing its source location — parsed nodes should always have one, so PostCSS may have received a programmatically constructed node instead of a parsed one`);
    }

    const clonedNodes = mixinNodes.map((child) => {
      const cloned = child.clone();
      cloned.source = source;
      return cloned;
    });

    node.replaceWith(...clonedNodes);
  });
}

//endregion Mixin Processing
