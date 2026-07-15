/**
 * Custom PostCSS plugin that inlines \@import rules.
 *
 * Replaces `lightningcss` bundling + `oxc-resolver` with a pure-JS
 * implementation that works in both Node/Bun and browser environments.
 *
 * Resolution strategy (mirrors CSS conventions):
 * 1. Relative paths (`./foo.css`, `../bar.css`): resolved against the importer
 * 2. Bare specifiers (`mixin.css`): tried as relative first (CSS treats these as relative)
 * 3. Package specifiers (`\@scope/pkg/path.css`, `pkg/path.css`): resolved via
 *    `node_modules` traversal, checking `exports` then `style`/`main` fields
 */
import {
  dirname,
  isAbsolute,
  resolve,
  sep,
} from '@monochromatic-dev/module-fs-path/ts';
import {
  type AtRule,
  parse,
  type Plugin,
  type Root,
} from 'postcss';
import {
  existsSync,
  readCssFileSync,
} from './fs.ts';
import { resolvePackage, } from './package-resolver.ts';
import {
  isPackageSpecifier,
  stripImportSpecifier,
} from './specifier.ts';

//region Import Resolution

/**
 * Resolves a CSS \@import specifier to an absolute file path, falling back to
 * {@link resolvePackage} for package specifiers.
 *
 * @param specifier - Bare import specifier (quotes/url() already stripped)
 *
 * @param fromFile - Absolute path of the importing file
 *
 * @returns Absolute path to the resolved CSS file
 *
 * @throws When the specifier cannot be resolved
 *
 * @example
 * ```ts
 * resolveSpecifier({
 *   specifier: './tokens.css',
 *   fromFile: '/project/src/main.css',
 * }); // → '/project/src/tokens.css'
 * ```
 */
function resolveSpecifier({
  specifier,
  fromFile,
}: {
  readonly specifier: string;
  readonly fromFile: string;
},): string {
  /**
   * Directory containing the importing file
   */
  const fromDir = dirname(fromFile,);

  // Absolute path (rare but possible)
  if (isAbsolute(specifier,)) {
    if (existsSync(specifier,))
      return specifier;
    throw new Error(`CSS @import absolute path not found: '${specifier}'`,);
  }

  // Explicit relative path
  if (specifier.startsWith('.',)) {
    /**
     * Resolved absolute path from relative specifier
     */
    const resolved = resolve(
      [
        fromDir,
        specifier,
      ],
    );
    if (existsSync(resolved,))
      return resolved;
    throw new Error(
      `CSS @import relative path not found: '${specifier}' from '${fromFile}'`,
    );
  }

  // Could be bare-local (CSS convention) or a package specifier.
  // Try relative first: CSS treats `@import 'foo.css'` as relative.
  if ((!isPackageSpecifier(specifier,))
    || ((!specifier.includes('/',)) && (!specifier.startsWith('@',))))
  {
    /**
     * Attempt to resolve as relative path
     */
    const asRelative = resolve(
      [
        fromDir,
        specifier,
      ],
    );
    if (existsSync(asRelative,))
      return asRelative;
  }

  // Package specifier
  return resolvePackage({
    specifier,
    fromDir,
  },);
}

//endregion Import Resolution

//region PostCSS Plugin

/**
 * PostCSS plugin that inlines \@import rules by resolving and parsing imported files
 * via {@link inlineImports}. Replaces each \@import with the parsed AST of the
 * imported file, then recursively processes nested \@import rules in the
 * inlined content.
 *
 * Tracks already-imported files to prevent circular imports and duplicate inlining.
 */
export const postcssInlineImport: Plugin = {
  postcssPlugin: 'postcss-inline-import',
  Once(root: Root,): void {
    /**
     * Set of absolute paths already inlined to prevent circular/duplicate imports
     */
    const imported = new Set<string>();

    /**
     * Source file path for the root stylesheet
     */
    const rootFrom = root.source
      ?.input
      .file;
    if (rootFrom !== undefined)
      imported.add(rootFrom,);

    inlineImports({
      root,
      fromFile: rootFrom ?? `${process.cwd()}${sep}input.css`,
      imported,
    },);
  },
};

/**
 * Recursively inlines \@import rules in a PostCSS root: each specifier is
 * resolved via {@link resolveSpecifier} and read with {@link readCssFileSync}.
 *
 * @param root - PostCSS root node to process
 *
 * @param fromFile - Absolute path of the file being processed
 *
 * @param imported - Set of already-imported absolute paths (prevents cycles)
 *
 * @example
 * ```ts
 * inlineImports({
 *   root: postcssRoot,
 *   fromFile: '/project/src/main.css',
 *   imported: new Set(),
 * });
 * ```
 */
function inlineImports({
  root,
  fromFile,
  imported,
}: {
  readonly root: Root;
  readonly fromFile: string;
  imported: Set<string>;
},): void {
  // Collect @import nodes first to avoid mutating the tree while walking
  /**
   * All \@import at-rules in the current root.
   */
  const importNodes: AtRule[] = [];
  root.walkAtRules(
    'import',
    function collectImportNode(node: AtRule,) {
      importNodes.push(node,);
    },
  );

  for (const node of importNodes) {
    /**
     * Bare specifier with quotes/url() stripped
     */
    const specifier = stripImportSpecifier(node.params,);

    /**
     * Absolute path to the imported file
     */
    const resolvedPath = resolveSpecifier({
      specifier,
      fromFile,
    },);

    // Skip already-imported files (prevents circular imports and duplicates)
    if (imported.has(resolvedPath,)) {
      node.remove();
      continue;
    }
    imported.add(resolvedPath,);

    /**
     * Raw CSS content of the imported file
     */
    const content = readCssFileSync(resolvedPath,);
    /**
     * Parsed AST of the imported file
     */
    const importedRoot = parse(
      content,
      { from: resolvedPath, },
    );

    // Recursively process nested @import rules
    inlineImports({
      root: importedRoot,
      fromFile: resolvedPath,
      imported,
    },);

    // Replace the @import node with the inlined content
    if (importedRoot.nodes
      .length
      > 0)
      node.replaceWith(...importedRoot.nodes,);
    else
      node.remove();
  }
}

//endregion PostCSS Plugin
