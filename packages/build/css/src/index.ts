import { watch, } from 'node:fs';
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
interface BuildOptions {
  /** Input CSS file path */
  input: string;
  /** Output CSS file path */
  output: string;
  /** Enable watch mode */
  watch?: boolean;
}

//endregion Types

//region Resolver

/** oxc-resolver instance for module resolution */
const resolver = new ResolverFactory({
  extensions: ['.css'],
  mainFields: ['style', 'main'],
});

/**
 * Resolves an import specifier using oxc-resolver.
 * Handles both relative paths and package imports.
 * @param specifier - Import path from @import statement
 * @param from - Absolute path of the importing file
 * @returns Resolved absolute path
 */
function resolveImport(specifier: string, from: string): string {
  const fromDir = dirname(from);
  const result = resolver.sync(fromDir, specifier);

  if (result.path) {
    return result.path;
  }

  // Fallback to relative resolution
  return resolve(fromDir, specifier);
}

//endregion Resolver

//region Mixin Registry

/**
 * Registry for mixin definitions.
 * Stores parsed CSS nodes for each mixin name.
 */
const mixins = new Map<string, ChildNode[]>();

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
 * Expands nested @apply rules in all mixin definitions.
 * Runs multiple passes until stable (handles deeply nested mixins).
 */
function expandMixinBodies(): void {
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
 * Collects @mixin definitions from CSS and stores in registry.
 * @param root - PostCSS root node
 */
function collectMixins(root: Root): void {
  root.walkAtRules('mixin', (node: AtRule) => {
    const mixinName = node.params.trim();

    if (!mixinName) {
      return;
    }

    if (!node.nodes || node.nodes.length === 0) {
      mixins.set(mixinName, []);
    } else {
      mixins.set(mixinName, node.nodes.map((child) => child.clone()));
    }

    node.remove();
  });
}

/**
 * Expands @apply rules using the mixin registry.
 * @param root - PostCSS root node
 */
function expandApplyRules(root: Root): void {
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
 * @param options - Build options
 * @returns Processed CSS string
 */
async function build(options: BuildOptions): Promise<string> {
  const { input, output, } = options;

  // Clear mixin registry for fresh build
  mixins.clear();

  const inputPath = resolve(input);

  // Step 1: Bundle with LightningCSS using oxc-resolver for imports
  const { code, } = await bundleAsync({
    filename: inputPath,
    minify: false,
    resolver: {
      resolve(specifier, from) {
        return resolveImport(specifier, from);
      },
    },
  });

  // Step 2: Parse bundled CSS with PostCSS
  const root = postcss.parse(code.toString(), { from: inputPath, });

  // Step 3: Collect mixin definitions
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

//region CLI

/**
 * Parses command line arguments.
 * Usage: bun index.ts <input> <output> [--watch]
 */
function parseArgs(): BuildOptions {
  const args = process.argv.slice(2);

  if (args.length < 2) {
    throw new Error('Usage: bun index.ts <input> <output> [--watch]');
  }

  const input = args[0]!;
  const output = args[1]!;
  const watchMode = args.includes('--watch');

  return { input, output, watch: watchMode, };
}

/**
 * Runs the build and optionally watches for changes.
 */
async function run(): Promise<void> {
  const options = parseArgs();

  console.log(`Building CSS: ${options.input} -> ${options.output}`);
  await build(options);
  console.log('Build complete');

  if (options.watch) {
    // Watch the input directory for changes
    const inputDir = dirname(resolve(options.input));
    console.log(`Watching directory: ${inputDir}`);

    watch(inputDir, { recursive: true, }, async (eventType, filename) => {
      if (filename && filename.endsWith('.css')) {
        console.log(`Change detected: ${filename}`);
        try {
          await build(options);
          console.log('Rebuild complete');
        } catch (rebuildError) {
          console.error('Rebuild failed:', rebuildError);
        }
      }
    });
  }
}

await run();

//endregion CLI

export { build, type BuildOptions, };
