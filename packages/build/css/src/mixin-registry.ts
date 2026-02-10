import type {
  AtRule,
  ChildNode,
} from 'postcss';

//region Mixin Registry

/**
 * Registry for mixin definitions.
 * Stores parsed CSS nodes for each mixin name.
 */
export const mixins = new Map<string, ChildNode[]>();

/**
 * Recursively expands \@apply rules within a set of nodes.
 * Looks up each \@apply reference in the mixin registry and inlines the body.
 * @param nodes - Array of CSS nodes to process
 * @returns Processed nodes with \@apply expanded
 */
function expandApplyInNodes(nodes: ChildNode[]): ChildNode[] {
  const result: ChildNode[] = [];

  for (const node of nodes) {
    if (node.type === 'atrule' && (node as AtRule).name === 'apply') {
      const mixinName = (node as AtRule).params.trim();
      const mixinNodes = mixins.get(mixinName);

      if (mixinNodes === undefined) {
        throw new Error(`Unknown mixin referenced in nested @apply: ${mixinName}`);
      }

      if (mixinNodes.length > 0) {
        const expanded = expandApplyInNodes(mixinNodes.map((childNode) => childNode.clone()));
        result.push(...expanded);
      }
    } else if ('nodes' in node && Array.isArray(node.nodes)) {
      const cloned = node.clone();
      cloned.nodes = expandApplyInNodes(node.nodes.map((childNode) => childNode.clone()));
      result.push(cloned);
    } else {
      result.push(node.clone());
    }
  }

  return result;
}

/**
 * Expands nested \@apply rules in all mixin definitions.
 * Runs multiple passes until stable to handle deeply nested mixin references.
 */
export function expandMixinBodies(): void {
  const MAX_PASSES = 10;
  let passCount = 0;
  let hasChanges = true;

  while (hasChanges) {
    if (passCount >= MAX_PASSES) {
      throw new Error(`Mixin expansion exceeded ${MAX_PASSES} passes — likely caused by circular @apply references between mixins`);
    }

    hasChanges = false;
    passCount++;

    for (const [mixinName, nodes] of mixins) {
      const expanded = expandApplyInNodes(nodes);
      const originalStr = nodes.map((node) => node.toString()).join('');
      const expandedStr = expanded.map((node) => node.toString()).join('');

      if (originalStr !== expandedStr) {
        hasChanges = true;
        mixins.set(mixinName, expanded);
      }
    }
  }
}

//endregion Mixin Registry
