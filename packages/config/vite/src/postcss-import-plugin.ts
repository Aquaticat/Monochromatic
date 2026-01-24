import { existsSync, readFileSync, } from 'node:fs';
import {
  dirname,
  isAbsolute,
  join,
  resolve,
} from 'node:path';
import type {
  AtRule,
  PluginCreator,
  Root,
} from 'postcss';

//region PostCSS Import Plugin -- Resolves @import including npm packages

/** Cache for resolved file contents to avoid re-reading */
const fileCache = new Map<string, string>();

/** Set of files currently being processed to detect circular imports */
const processing = new Set<string>();

/** Vite aliases for resolving package paths */
let aliases: Record<string, string> = {};

/**
 * Configures the import plugin with Vite aliases.
 * Call this before using the plugin.
 * @param viteAliases - Record of alias patterns to replacement paths
 */
function configureImportAliases(viteAliases: Record<string, string>): void {
  aliases = viteAliases;
}

/**
 * Resolves an import path to an absolute file path.
 * Handles relative paths, aliases, and attempts node_modules resolution.
 * @param importPath - The path from @import statement
 * @param fromFile - The file containing the @import
 * @returns Resolved absolute path or undefined if not found
 */
function resolveImportPath(importPath: string, fromFile: string): string | undefined {
  const fromDir = dirname(fromFile);

  // Handle relative imports
  if (importPath.startsWith('./') || importPath.startsWith('../')) {
    const resolved = resolve(fromDir, importPath);
    if (existsSync(resolved)) {
      return resolved;
    }
    // Try adding .css extension
    const withExt = resolved.endsWith('.css') ? resolved : `${resolved}.css`;
    if (existsSync(withExt)) {
      return withExt;
    }
    return undefined;
  }

  // Handle aliases
  for (const [alias, replacement] of Object.entries(aliases)) {
    if (importPath === alias || importPath.startsWith(`${alias}/`)) {
      const resolved = importPath.replace(alias, replacement);
      if (existsSync(resolved)) {
        return resolved;
      }
      const withExt = resolved.endsWith('.css') ? resolved : `${resolved}.css`;
      if (existsSync(withExt)) {
        return withExt;
      }
    }
  }

  // Handle node_modules - walk up directory tree
  let currentDir = fromDir;
  while (currentDir !== dirname(currentDir)) {
    const nodeModulesPath = join(currentDir, 'node_modules', importPath);
    if (existsSync(nodeModulesPath)) {
      return nodeModulesPath;
    }
    const withExt = nodeModulesPath.endsWith('.css') ? nodeModulesPath : `${nodeModulesPath}.css`;
    if (existsSync(withExt)) {
      return withExt;
    }
    currentDir = dirname(currentDir);
  }

  return undefined;
}

/**
 * Reads and parses a CSS file, recursively processing its @imports.
 * @param filePath - Absolute path to CSS file
 * @param postcss - PostCSS instance from helpers
 * @returns Parsed Root node with imports inlined
 */
function processFile(filePath: string, postcss: typeof import('postcss')): Root | undefined {
  if (processing.has(filePath)) {
    // Circular import detected, skip
    return undefined;
  }

  if (!existsSync(filePath)) {
    return undefined;
  }

  processing.add(filePath);

  let content = fileCache.get(filePath);
  if (content === undefined) {
    content = readFileSync(filePath, 'utf8');
    fileCache.set(filePath, content);
  }

  const root = postcss.parse(content, { from: filePath });

  // Process @imports in this file
  const importsToProcess: Array<{ node: AtRule; resolvedPath: string }> = [];

  root.walkAtRules('import', (node) => {
    const importPath = extractImportPath(node.params);
    if (importPath) {
      const resolvedPath = resolveImportPath(importPath, filePath);
      if (resolvedPath) {
        importsToProcess.push({ node, resolvedPath });
      }
    }
  });

  // Process imports in reverse order to maintain correct position
  for (const { node, resolvedPath } of importsToProcess.reverse()) {
    const importedRoot = processFile(resolvedPath, postcss);
    if (importedRoot && importedRoot.nodes) {
      node.replaceWith(...importedRoot.nodes);
    } else {
      node.remove();
    }
  }

  processing.delete(filePath);

  return root;
}

/**
 * Extracts the path from an @import params string.
 * Handles: @import 'path'; @import "path"; @import url('path'); @import url("path");
 * @param params - The params string from AtRule
 * @returns Extracted path or undefined
 */
function extractImportPath(params: string): string | undefined {
  const trimmed = params.trim();

  // Handle url() syntax
  const urlMatch = trimmed.match(/^url\(\s*(['"]?)(.+?)\1\s*\)/);
  if (urlMatch) {
    return urlMatch[2];
  }

  // Handle quoted string
  const quoteMatch = trimmed.match(/^(['"])(.+?)\1/);
  if (quoteMatch) {
    return quoteMatch[2];
  }

  return undefined;
}

/**
 * PostCSS plugin that resolves and inlines @import statements.
 * Supports relative paths, Vite aliases, and npm packages.
 * Run this plugin BEFORE the mixin plugin.
 */
const postcssImport: PluginCreator<void> = () => ({
  postcssPlugin: 'postcss-import-resolve',

  Once(root, { postcss, result }) {
    const fromFile = root.source?.input.file;
    if (!fromFile || !isAbsolute(fromFile)) {
      return;
    }

    const importsToProcess: Array<{ node: AtRule; resolvedPath: string }> = [];

    root.walkAtRules('import', (node) => {
      const importPath = extractImportPath(node.params);
      if (importPath) {
        const resolvedPath = resolveImportPath(importPath, fromFile);
        if (resolvedPath) {
          importsToProcess.push({ node, resolvedPath });
          // Add dependency for watching
          result.messages.push({
            type: 'dependency',
            plugin: 'postcss-import-resolve',
            file: resolvedPath,
            parent: fromFile,
          });
        }
      }
    });

    // Process imports in reverse order to maintain correct position
    for (const { node, resolvedPath } of importsToProcess.reverse()) {
      const importedRoot = processFile(resolvedPath, postcss);
      if (importedRoot && importedRoot.nodes) {
        // Clone nodes and update their source
        const clonedNodes = importedRoot.nodes.map((n) => {
          const cloned = n.clone();
          return cloned;
        });
        node.replaceWith(...clonedNodes);
      } else {
        node.remove();
      }
    }
  },
});

postcssImport.postcss = true;

//endregion PostCSS Import Plugin

export { configureImportAliases, postcssImport };
