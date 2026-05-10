/**
 * Package specifier resolution for CSS @import.
 *
 * Resolves bare package specifiers (e.g. `\@scope/pkg/index.css`, `pkg/path.css`)
 * to absolute file paths by traversing `node_modules` and consulting
 * `exports`, `style`, and `main` fields in `package.json`.
 */
import {
  dirname,
  join,
  resolve,
} from '@monochromatic-dev/module-es/ts/path/index.ts';
import {
  existsSync,
  readCssFileSync,
} from './fs.ts';
import { splitPackageSpecifier, } from './specifier.ts';

//region Package Resolution

/**
 * Walks up from `startDir` looking for a `node_modules/<packageName>` directory.
 * Mimics Node's module resolution algorithm.
 *
 * @param startDir - Directory to start searching from
 *
 * @param packageName - Package name (e.g. `\@scope/pkg`)
 *
 * @returns Absolute path to the package directory, or undefined if not found
 *
 * @example
 * ```ts
 * const dir = findPackageDir('/project/src', '\@scope/tokens');
 * // → '/project/node_modules/\@scope/tokens'
 * ```
 */
export function findPackageDir(
  startDir: string,
  packageName: string,
):
  | string
  | undefined
{
  let current = startDir;

  // Walk up to filesystem root looking for node_modules
  // oxlint-disable-next-line no-constant-condition
  while (true) {
    /** Candidate node_modules/<pkg> directory */
    const candidate = join(
      current,
      'node_modules',
      packageName,
    );
    if (existsSync(candidate,))
      return candidate;

    /** Parent directory */
    const parent = dirname(current,);
    // Reached filesystem root
    if (parent === current)
      return undefined;
    current = parent;
  }
}

/**
 * Reads and parses a package.json from the given directory.
 *
 * @param packageDir - Absolute path to the package directory
 *
 * @returns Parsed package.json or undefined if not found
 *
 * @example
 * ```ts
 * const pkg = readPackageJson('/project/node_modules/\@scope/tokens');
 * ```
 */
export function readPackageJson(
  packageDir: string,
): Record<string, unknown> | undefined {
  /** Path to package.json */
  const packageJsonPath = join(
    packageDir,
    'package.json',
  );
  try {
    /** Raw JSON text */
    const raw = readCssFileSync(packageJsonPath,);
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- JSON.parse returns unknown; package.json shape is Record<string, unknown>
    return JSON.parse(raw,) as Record<string, unknown>;
  }
  catch {
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
 *
 * @example
 * ```ts
 * resolveExports({ '.': { style: './dist/index.css' } }, '.') // → './dist/index.css'
 * ```
 */
export function resolveExports(
  exports: unknown,
  subpath: string,
): string | undefined {
  if (typeof exports !== 'object' || exports === null)
    return undefined;

  /** Exports object keyed by subpath pattern */
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- narrowing from object to Record for property access
  const exportsMap = exports as Record<string, unknown>;
  /** Value for the requested subpath */
  const entry = exportsMap[subpath];

  if (typeof entry === 'string')
    return entry;

  // Condition object: check style -> import -> default
  if (typeof entry === 'object' && entry !== null) {
    /** Condition map for this subpath */
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- narrowing from object to Record for condition access
    const conditions = entry as Record<string, unknown>;
    for (const key of [
      'style',
      'import',
      'default',
    ]) {
      if (typeof conditions[key] === 'string')
        return conditions[key];
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
 *
 * @example
 * ```ts
 * const path = resolvePackage('\@scope/tokens/index.css', '/project/src');
 * ```
 */
export function resolvePackage(
  specifier: string,
  fromDir: string,
): string {
  const [packageName, subpath,] = splitPackageSpecifier(specifier,);
  /** Absolute path to the package directory in node_modules */
  const packageDir = findPackageDir(
    fromDir,
    packageName,
  );

  if (packageDir === undefined)
    throw new Error(`Cannot find package '${packageName}' from '${fromDir}'`,);

  /** Parsed package.json for exports/main/style lookup */
  const packageJson = readPackageJson(packageDir,);

  if (packageJson !== undefined) {
    // Try exports field
    if (packageJson.exports !== undefined) {
      /** Resolved path from exports map */
      const resolved = resolveExports(
        packageJson.exports,
        subpath,
      );
      if (resolved !== undefined) {
        /** Absolute path from exports resolution */
        const absolutePath = resolve(
          packageDir,
          resolved,
        );
        if (existsSync(absolutePath,))
          return absolutePath;
      }
    }

    // For bare package reference (subpath is '.'), try style/main fields
    if (subpath === '.') {
      for (const field of [
        'style',
        'main',
      ]) {
        /** Field value from package.json */
        const value = packageJson[field];
        if (typeof value === 'string') {
          /** Absolute path from style/main field */
          const absolutePath = resolve(
            packageDir,
            value,
          );
          if (existsSync(absolutePath,))
            return absolutePath;
        }
      }
    }
  }

  // Direct file path fallback: resolve subpath relative to package directory
  if (subpath !== '.') {
    // subpath starts with './': strip it for join
    /** Relative portion after stripping leading ./ */
    const relativePart = subpath.startsWith('./',) ? subpath.slice(2,) : subpath;
    /** Absolute path from direct file reference */
    const directPath = join(
      packageDir,
      relativePart,
    );
    if (existsSync(directPath,))
      return directPath;
  }

  throw new Error(
    `Cannot resolve '${specifier}' from '${fromDir}': no matching export, style/main field, or direct file in '${packageDir}'`,
  );
}

//endregion Package Resolution
