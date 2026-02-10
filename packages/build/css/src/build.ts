import { mkdir, writeFile, } from 'node:fs/promises';
import {
  dirname,
  resolve,
} from 'node:path';
import { bundleAsync, } from 'lightningcss';
import { ResolverFactory, } from 'oxc-resolver';
import type {
  AtRule,
  ChildNode,
  Root,
} from 'postcss';
import postcss from 'postcss';

//region Types

/** Build options for the CSS processor */
export type BuildOptions = {
  /** Input CSS file path */
  input: string;
  /** Output CSS file path */
  output: string;
  /** Enable watch mode */
  watch?: boolean;
};

//endregion Types

//region Resolver

/**
 * Creates an oxc-resolver instance configured for CSS module resolution.
 * Supports package.json exports fields and style-specific main fields.
 * @returns Configured ResolverFactory
 */
export function createResolver(): ResolverFactory {
  return new ResolverFactory({
    extensions: ['.css'],
    mainFields: ['style', 'main'],
    conditionNames: ['style', 'default', 'import'],
    exportsFields: [['exports']],
  });
}

/**
 * Resolves a CSS import specifier to an absolute file path.
 * Uses oxc-resolver for node_modules and package.json exports resolution.
 * Falls back to relative resolution for bare specifiers that CSS treats as
 * relative paths (e.g. `\@import 'tods.css'` without `./` prefix).
 * @param resolver - Configured oxc-resolver instance
 * @param specifier - Import path from \@import statement
 * @param from - Absolute path of the importing file
 * @returns Resolved absolute path
 * @throws When the specifier cannot be resolved by any strategy
 */
export function resolveImport(resolver: ResolverFactory, specifier: string, from: string): string {
  const fromDir = dirname(from);
  const result = resolver.sync(fromDir, specifier);

  if (result.path) {
    return result.path;
  }

  // CSS @import treats bare specifiers like 'tods.css' as relative paths,
  // unlike JS where they would be package references. Try with './' prefix.
  if (!specifier.startsWith('.') && !specifier.startsWith('/') && !specifier.startsWith('@')) {
    const relativeResult = resolver.sync(fromDir, `./${specifier}`);
    if (relativeResult.path) {
      return relativeResult.path;
    }
  }

  throw new Error(
    `Failed to resolve CSS import '${specifier}' from '${from}': ${result.error ?? 'unknown error'}`,
  );
}

//endregion Resolver

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

      if (mixinNodes && mixinNodes.length > 0) {
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

  while (hasChanges && passCount < MAX_PASSES) {
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

//region Mixin Processing

/**
 * Collects \@mixin definitions from CSS and stores them in the registry.
 * A \@mixin with a body (`\@mixin --name { ... }`) is a definition.
 * A \@mixin without a body (`\@mixin --name;`) is treated as an \@apply
 * invocation for backward compatibility -- it gets renamed to \@apply
 * and left in the tree for expandApplyRules to process.
 * @param root - PostCSS root node
 */
export function collectMixins(root: Root): void {
  root.walkAtRules('mixin', (node: AtRule) => {
    const mixinName = node.params.trim();

    if (!mixinName) {
      return;
    }

    if (!node.nodes || node.nodes.length === 0) {
      // No body means this is an apply invocation, not a definition.
      // Rename to @apply so expandApplyRules handles it.
      node.name = 'apply';
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

    const clonedNodes = mixinNodes.map((child) => {
      const cloned = child.clone();
      cloned.source = node.source;
      return cloned;
    });

    node.replaceWith(...clonedNodes);
  });
}

//endregion Mixin Processing

//region Build

/**
 * Builds CSS by bundling imports with LightningCSS and processing mixins.
 * Pipeline: resolve imports -> bundle -> collect mixin definitions ->
 * expand nested mixin bodies -> inline \@apply rules -> write output.
 * @param options - Build configuration
 * @returns Processed CSS string
 */
export async function build(options: BuildOptions): Promise<string> {
  const { input, output, } = options;

  // Clear mixin registry for fresh build
  mixins.clear();

  const inputPath = resolve(input);
  const resolver = createResolver();

  // Step 1: Bundle with LightningCSS using oxc-resolver for imports
  const { code, } = await bundleAsync({
    filename: inputPath,
    minify: false,
    resolver: {
      resolve(specifier, from) {
        return resolveImport(resolver, specifier, from);
      },
    },
  });

  // Step 2: Parse bundled CSS with PostCSS
  const root = postcss.parse(code.toString(), { from: inputPath, });

  // Step 3: Collect mixin definitions (and rename bare @mixin to @apply)
  collectMixins(root);

  // Step 4: Expand nested @apply in mixin bodies
  expandMixinBodies();

  // Step 5: Expand @apply rules in CSS
  expandApplyRules(root);

  // Step 6: Generate and write output
  const result = root.toString();
  const outputPath = resolve(output);
  await mkdir(dirname(outputPath), { recursive: true, });
  await writeFile(outputPath, result);

  return result;
}

//endregion Build
