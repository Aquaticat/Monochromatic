/**
 * Custom PostCSS plugin that inlines \@import rules.
 *
 * Replaces `lightningcss` bundling + `oxc-resolver` with a pure-JS
 * implementation that works in both Node/Bun and browser environments.
 *
 * Resolution strategy (mirrors CSS conventions):
 * 1. Relative paths (`./foo.css`, `../bar.css`) — resolved against the importer
 * 2. Bare specifiers (`mixin.css`) — tried as relative first (CSS treats these as relative)
 * 3. Package specifiers (`\@scope/pkg/path.css`, `pkg/path.css`) — resolved via
 *    `node_modules` traversal, checking `exports` then `style`/`main` fields
 */
import {
  dirname,
  isAbsolute,
  join,
  resolve,
  sep,
} from '@monochromatic-dev/module-es/ts/path/index.ts';
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

//region Specifier Parsing

/**
 * Strips quotes and `url()` wrapper from a CSS \@import specifier.
 * Handles: `'foo.css'`, `"foo.css"`, `url('foo.css')`, `url("foo.css")`, `url(foo.css)`
 *
 * @param raw - Raw \@import params string
 *
 * @returns Bare specifier without quotes or url() wrapper
 */
function stripImportSpecifier(raw: string): string {
  /** Trimmed input for consistent handling */
  const trimmed = raw.trim();

  /** Length of the "url(" prefix. */
  const URL_PREFIX_LENGTH = 4;

  // url(...) wrapper
  if (trimmed.startsWith('url(') && trimmed.endsWith(')')) {
    /** Inner content of url() */
    const inner = trimmed.slice(URL_PREFIX_LENGTH, -1).trim();
    // Strip inner quotes if present
    if ((inner.startsWith("'") && inner.endsWith("'")) ||
        (inner.startsWith('"') && inner.endsWith('"'))) {
      return inner.slice(1, -1);
    }
    return inner;
  }

  // Quoted string
  if ((trimmed.startsWith("'") && trimmed.endsWith("'")) ||
      (trimmed.startsWith('"') && trimmed.endsWith('"'))) {
    return trimmed.slice(1, -1);
  }

  return trimmed;
}

/**
 * Whether a specifier looks like a package reference (not relative or absolute).
 *
 * @param specifier - Bare import specifier
 *
 * @returns True for package-like specifiers (`\@scope/pkg/...` or `pkg/...`)
 */
function isPackageSpecifier(specifier: string): boolean {
  return !specifier.startsWith('.') && !specifier.startsWith('/');
}

//endregion Specifier Parsing

//region Package Resolution

/**
 * Splits a package specifier into package name and subpath.
 * Handles scoped (`\@scope/pkg/sub.css`) and unscoped (`pkg/sub.css`) packages.
 *
 * @param specifier - Bare package specifier
 *
 * @returns Tuple of [packageName, subpath] where subpath starts with `./` or is `.`
 */
function splitPackageSpecifier(specifier: string): [string, string] {
  if (specifier.startsWith('@')) {
    // Scoped: @scope/pkg or @scope/pkg/sub/path.css
    /**
     * Index of the second slash (after \@scope/pkg).
     */
    const secondSlash = specifier.indexOf('/', specifier.indexOf('/') + 1);
    if (secondSlash === -1) {
      return [specifier, '.'];
    }
    return [specifier.slice(0, secondSlash), `./${specifier.slice(secondSlash + 1)}`];
  }

  // Unscoped: pkg or pkg/sub/path.css
  /** Index of the first slash */
  const firstSlash = specifier.indexOf('/');
  if (firstSlash === -1) {
    return [specifier, '.'];
  }
  return [specifier.slice(0, firstSlash), `./${specifier.slice(firstSlash + 1)}`];
}

/**
 * Walks up from `startDir` looking for a `node_modules/<packageName>` directory.
 * Mimics Node's module resolution algorithm.
 *
 * @param startDir - Directory to start searching from
 *
 * @param packageName - Package name (e.g. `\@scope/pkg`)
 *
 * @returns Absolute path to the package directory, or undefined if not found
 */
function findPackageDir(startDir: string, packageName: string): string | undefined {
  let current = startDir;

  // Walk up to filesystem root looking for node_modules
  // oxlint-disable-next-line no-constant-condition
  while (true) {
    /** Candidate node_modules/<pkg> directory */
    const candidate = join(current, 'node_modules', packageName);
    if (existsSync(candidate)) {
      return candidate;
    }

    /** Parent directory */
    const parent = dirname(current);
    // Reached filesystem root
    if (parent === current) {
      return undefined;
    }
    current = parent;
  }
}

/**
 * Reads and parses a package.json from the given directory.
 *
 * @param packageDir - Absolute path to the package directory
 *
 * @returns Parsed package.json or undefined if not found
 */
function readPackageJson(packageDir: string): Record<string, unknown> | undefined {
  /** Path to package.json */
  const packageJsonPath = join(packageDir, 'package.json');
  try {
    /** Raw JSON text */
    const raw = readCssFileSync(packageJsonPath);
    // oxlint-disable-next-line no-unsafe-type-assertion -- JSON.parse returns unknown; package.json shape is Record<string, unknown>
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return undefined;
  }
}

/**
 * Resolves a subpath using package.json `exports` field.
 * Supports simple string mappings and condition objects with `style`, `import`, `default` keys.
 *
 * @param exports - The `exports` field value from package.json
 *
 * @param subpath - Subpath to resolve (e.g. `./index.css` or `.`)
 *
 * @returns Resolved relative path or undefined if no match
 */
function resolveExports(exports: unknown, subpath: string): string | undefined {
  if (typeof exports !== 'object' || exports === null) {
    return undefined;
  }

  /** Exports object keyed by subpath pattern */
  // oxlint-disable-next-line no-unsafe-type-assertion -- narrowing from object to Record for property access
  const exportsMap = exports as Record<string, unknown>;
  /** Value for the requested subpath */
  const entry = exportsMap[subpath];

  if (typeof entry === 'string') {
    return entry;
  }

  // Condition object: check style → import → default
  if (typeof entry === 'object' && entry !== null) {
    /** Condition map for this subpath */
    // oxlint-disable-next-line no-unsafe-type-assertion -- narrowing from object to Record for condition access
    const conditions = entry as Record<string, unknown>;
    for (const key of ['style', 'import', 'default']) {
      if (typeof conditions[key] === 'string') {
        return conditions[key];
      }
    }
  }

  return undefined;
}

/**
 * Resolves a package specifier to an absolute file path.
 * Tries `exports` field first, then falls back to `style`/`main` fields,
 * then to the direct file path within the package.
 *
 * @param specifier - Full package specifier (e.g. `\@scope/pkg/index.css`)
 *
 * @param fromDir - Directory of the importing file
 *
 * @returns Absolute resolved path
 *
 * @throws When the package or file cannot be found
 */
function resolvePackage(specifier: string, fromDir: string): string {
  const [packageName, subpath] = splitPackageSpecifier(specifier);
  /** Absolute path to the package directory in node_modules */
  const packageDir = findPackageDir(fromDir, packageName);

  if (packageDir === undefined) {
    throw new Error(`Cannot find package '${packageName}' from '${fromDir}'`);
  }

  /** Parsed package.json for exports/main/style lookup */
  const packageJson = readPackageJson(packageDir);

  if (packageJson !== undefined) {
    // Try exports field
    if (packageJson.exports !== undefined) {
      /** Resolved path from exports map */
      const resolved = resolveExports(packageJson.exports, subpath);
      if (resolved !== undefined) {
        /** Absolute path from exports resolution */
        const absolutePath = resolve(packageDir, resolved);
        if (existsSync(absolutePath)) {
          return absolutePath;
        }
      }
    }

    // For bare package reference (subpath is '.'), try style/main fields
    if (subpath === '.') {
      for (const field of ['style', 'main']) {
        /** Field value from package.json */
        const value = packageJson[field];
        if (typeof value === 'string') {
          /** Absolute path from style/main field */
          const absolutePath = resolve(packageDir, value);
          if (existsSync(absolutePath)) {
            return absolutePath;
          }
        }
      }
    }
  }

  // Direct file path fallback: resolve subpath relative to package directory
  if (subpath !== '.') {
    // subpath starts with './' — strip it for join
    /** Relative portion after stripping leading ./ */
    const relativePart = subpath.startsWith('./') ? subpath.slice(2) : subpath;
    /** Absolute path from direct file reference */
    const directPath = join(packageDir, relativePart);
    if (existsSync(directPath)) {
      return directPath;
    }
  }

  throw new Error(
    `Cannot resolve '${specifier}' from '${fromDir}': no matching export, style/main field, or direct file in '${packageDir}'`,
  );
}

//endregion Package Resolution

//region Import Resolution

/**
 * Resolves a CSS \@import specifier to an absolute file path.
 *
 * @param specifier - Bare import specifier (quotes/url() already stripped)
 *
 * @param fromFile - Absolute path of the importing file
 *
 * @returns Absolute path to the resolved CSS file
 *
 * @throws When the specifier cannot be resolved
 */
function resolveSpecifier(specifier: string, fromFile: string): string {
  /** Directory containing the importing file */
  const fromDir = dirname(fromFile);

  // Absolute path (rare but possible)
  if (isAbsolute(specifier)) {
    if (existsSync(specifier)) {
      return specifier;
    }
    throw new Error(`CSS @import absolute path not found: '${specifier}'`);
  }

  // Explicit relative path
  if (specifier.startsWith('.')) {
    /** Resolved absolute path from relative specifier */
    const resolved = resolve(fromDir, specifier);
    if (existsSync(resolved)) {
      return resolved;
    }
    throw new Error(`CSS @import relative path not found: '${specifier}' from '${fromFile}'`);
  }

  // Could be bare-local (CSS convention) or a package specifier.
  // Try relative first — CSS treats `@import 'foo.css'` as relative.
  if (!isPackageSpecifier(specifier) || !specifier.includes('/') && !specifier.startsWith('@')) {
    /** Attempt to resolve as relative path */
    const asRelative = resolve(fromDir, specifier);
    if (existsSync(asRelative)) {
      return asRelative;
    }
  }

  // Package specifier
  return resolvePackage(specifier, fromDir);
}

//endregion Import Resolution

//region PostCSS Plugin

/**
 * PostCSS plugin that inlines \@import rules by resolving and parsing imported files.
 * Replaces each \@import with the parsed AST of the imported file, then recursively
 * processes nested \@import rules in the inlined content.
 *
 * Tracks already-imported files to prevent circular imports and duplicate inlining.
 */
export const postcssInlineImport: Plugin = {
  postcssPlugin: 'postcss-inline-import',
  Once(root: Root): void {
    /** Set of absolute paths already inlined to prevent circular/duplicate imports */
    const imported = new Set<string>();

    /** Source file path for the root stylesheet */
    const rootFrom = root.source?.input.file;
    if (rootFrom !== undefined) {
      imported.add(rootFrom);
    }

    inlineImports(root, rootFrom ?? `${process.cwd()}${sep}input.css`, imported);
  },
};

/**
 * Recursively inlines \@import rules in a PostCSS root.
 *
 * @param root - PostCSS root node to process
 *
 * @param fromFile - Absolute path of the file being processed
 *
 * @param imported - Set of already-imported absolute paths (prevents cycles)
 */
function inlineImports(root: Root, fromFile: string, imported: Set<string>): void {
  // Collect @import nodes first to avoid mutating the tree while walking
  /**
   * All \@import at-rules in the current root.
   */
  const importNodes: AtRule[] = [];
  root.walkAtRules('import', function collectImportNode(node: AtRule) {
    importNodes.push(node);
  });

  for (const node of importNodes) {
    /** Bare specifier with quotes/url() stripped */
    const specifier = stripImportSpecifier(node.params);

    /** Absolute path to the imported file */
    const resolvedPath = resolveSpecifier(specifier, fromFile);

    // Skip already-imported files (prevents circular imports and duplicates)
    if (imported.has(resolvedPath)) {
      node.remove();
      continue;
    }
    imported.add(resolvedPath);

    /** Raw CSS content of the imported file */
    const content = readCssFileSync(resolvedPath);
    /** Parsed AST of the imported file */
    const importedRoot = parse(content, { from: resolvedPath, });

    // Recursively process nested @import rules
    inlineImports(importedRoot, resolvedPath, imported);

    // Replace the @import node with the inlined content
    if (importedRoot.nodes.length > 0) {
      node.replaceWith(...importedRoot.nodes);
    } else {
      node.remove();
    }
  }
}

//endregion PostCSS Plugin
