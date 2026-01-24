import { existsSync, readFileSync } from 'node:fs';
import type {
  AtRule,
  ChildNode,
  PluginCreator,
  Root,
} from 'postcss';
import postcss from 'postcss';

//region PostCSS Mixin Plugin -- Handles @mixin --name { } and @apply --name; syntax

/**
 * Global registry for mixin definitions.
 * Persists across PostCSS processing of multiple files.
 */
const globalMixins = new Map<string, ChildNode[]>();

/** Whether mixins have been preloaded */
let mixinsPreloaded = false;

/**
 * Recursively expands @apply rules within a set of nodes.
 * @param nodes - Array of CSS nodes to process
 * @returns Processed nodes with @apply expanded
 */
function expandApplyInNodes(nodes: ChildNode[]): ChildNode[] {
  const result: ChildNode[] = [];

  for (const node of nodes) {
    if (node.type === 'atrule' && (node as AtRule).name === 'apply') {
      const mixinName = (node as AtRule).params.trim();
      const mixinNodes = globalMixins.get(mixinName);

      if (mixinNodes && mixinNodes.length > 0) {
        // Recursively expand and add mixin content
        const expanded = expandApplyInNodes(mixinNodes.map((n) => n.clone()));
        result.push(...expanded);
      }
      // Skip the @apply rule itself (don't add it to result)
    } else if ('nodes' in node && Array.isArray(node.nodes)) {
      // Recursively process child nodes
      const cloned = node.clone();
      cloned.nodes = expandApplyInNodes(node.nodes.map((n) => n.clone()));
      result.push(cloned);
    } else {
      result.push(node.clone());
    }
  }

  return result;
}

/**
 * Preloads mixin definitions from specified files.
 * Processes files in two passes:
 * 1. Collect all mixin definitions
 * 2. Expand @apply rules within mixin bodies
 * @param mixinFiles - Array of absolute paths to mixin CSS files
 */
function preloadMixins(mixinFiles: string[]): void {
  // First pass: collect all mixin definitions
  for (const filePath of mixinFiles) {
    if (!existsSync(filePath)) {
      continue;
    }

    const content = readFileSync(filePath, 'utf8');
    const root = postcss.parse(content, { from: filePath });

    root.walkAtRules('mixin', (node: AtRule) => {
      const mixinName = node.params.trim();

      if (!mixinName) {
        return;
      }

      if (!node.nodes || node.nodes.length === 0) {
        globalMixins.set(mixinName, []);
      } else {
        const clonedNodes = node.nodes.map((child) => child.clone());
        globalMixins.set(mixinName, clonedNodes);
      }
    });
  }

  // Second pass: expand @apply rules within mixin bodies
  // Run multiple passes until no more changes (handles nested @apply)
  let hasChanges = true;
  const MAX_PASSES = 10;
  let passCount = 0;

  while (hasChanges && passCount < MAX_PASSES) {
    hasChanges = false;
    passCount++;

    for (const [mixinName, nodes] of globalMixins) {
      const expanded = expandApplyInNodes(nodes);
      // Check if anything changed by comparing string representations
      const originalStr = nodes.map((n) => n.toString()).join('');
      const expandedStr = expanded.map((n) => n.toString()).join('');

      if (originalStr !== expandedStr) {
        hasChanges = true;
        globalMixins.set(mixinName, expanded);
      }
    }
  }

  mixinsPreloaded = true;
}

/**
 * PostCSS plugin that processes @mixin and @apply at-rules.
 * Uses a global mixin registry to share definitions across files.
 * 
 * Processing strategy:
 * 1. First pass: collect all @mixin definitions into global registry
 * 2. Second pass: expand all @apply rules using global registry
 * 
 * Syntax matches native CSS proposals:
 * - `@mixin --name { declarations }` defines a mixin
 * - `@apply --name;` applies a mixin's declarations
 */
const postcssMixin: PluginCreator<void> = () => ({
  postcssPlugin: 'postcss-mixin',

  Once(root: Root) {
    // First pass: collect all mixin definitions into global registry
    root.walkAtRules('mixin', (node: AtRule) => {
      const mixinName = node.params.trim();

      if (!mixinName) {
        throw node.error('Mixin name is required: @mixin --name { }');
      }

      if (!node.nodes || node.nodes.length === 0) {
        globalMixins.set(mixinName, []);
      } else {
        const clonedNodes = node.nodes.map((child) => child.clone());
        globalMixins.set(mixinName, clonedNodes);
      }

      node.remove();
    });

    // Second pass: expand all @apply rules using global registry
    root.walkAtRules('apply', (node: AtRule) => {
      const mixinName = node.params.trim();

      if (!mixinName) {
        throw node.error('Mixin name is required: @apply --name;');
      }

      const mixinNodes = globalMixins.get(mixinName);

      if (mixinNodes === undefined) {
        // Leave @apply in place if mixin not found yet
        // It will be processed when the file containing the mixin is processed
        return;
      }

      if (mixinNodes.length === 0) {
        node.remove();
        return;
      }

      const clonedNodes = mixinNodes.map((child) => {
        const cloned = child.clone();
        cloned.source = node.source;
        return cloned;
      });

      node.replaceWith(...clonedNodes);
    });
  },
});

postcssMixin.postcss = true;

//endregion PostCSS Mixin Plugin

export { postcssMixin, preloadMixins };
