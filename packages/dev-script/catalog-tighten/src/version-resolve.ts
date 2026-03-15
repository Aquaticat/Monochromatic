/**
 * Version resolution utilities for catalog-tighten.
 *
 * Handles npm alias resolution and installed version lookup
 * across node_modules, workspace roots, and the Bun store.
 */

import { readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';

import { readVersionFromBunStore, readVersionFromPackageJson } from './version-read.ts';

//region Version resolution

/**
 * Resolves candidate npm package names to look up in node_modules.
 * Bun installs `npm:` aliased packages under the **key** name (e.g. `zod`),
 * not the registry target (e.g. `@jsr/zod__zod`). Returns the key first,
 * then the alias target as fallback.
 *
 * @param catalogKey - package name key in catalog, e.g. `"zod"`
 *
 * @param catalogValue - raw catalog value, e.g. `"npm:@jsr/zod__zod@>=4.1.8"`
 *
 * @returns ordered list of npm names to try resolving
 *
 * @example
 * ```ts
 * resolveNpmNames("zod", "npm:\@jsr/zod__zod\@>=4.1.8") // ["zod", "\@jsr/zod__zod"]
 * resolveNpmNames("eslint", ">=9.29.0") // ["eslint"]
 * ```
 */
export function resolveNpmNames(catalogKey: string, catalogValue: string): string[] {
  /** Length of the `npm:` prefix */
  const NPM_PREFIX_LENGTH = 4;
  if (catalogValue.startsWith('npm:')) {
    const withoutNpm = catalogValue.slice(NPM_PREFIX_LENGTH);
    // Find the last @ that isn't position 0 (scoped package)
    const lastAt = withoutNpm.lastIndexOf('@');
    const aliasTarget = lastAt > 0 ? withoutNpm.slice(0, lastAt) : withoutNpm;
    // Key first (bun installs under alias name), then registry target as fallback
    if (aliasTarget !== catalogKey) {
      return [catalogKey, aliasTarget];
    }
    return [catalogKey];
  }
  return [catalogKey];
}

/** Cached workspace root directories. */
let workspaceRootsCache: string[] | undefined = undefined;

/**
 * Discovers all workspace package directories under `packages/{category}/{pkg}`.
 * Cached after first call.
 *
 * @param monorepoRoot - absolute path to the monorepo root
 *
 * @returns array of absolute paths to workspace package directories
 *
 * @example
 * ```ts
 * discoverWorkspaceRoots("/home/user/Monochromatic")
 * // ["/home/user/Monochromatic/packages/dev-script/file-enforcer", ...]
 * ```
 */
function discoverWorkspaceRoots(monorepoRoot: string): string[] {
  if (workspaceRootsCache !== undefined) {
    return workspaceRootsCache;
  }

  const packagesDir = join(monorepoRoot, 'packages');
  const roots: string[] = [];

  try {
    const categories = readdirSync(packagesDir, { withFileTypes: true });
    for (const cat of categories) {
      if (!cat.isDirectory()) {
        continue;
      }
      const catPath = join(packagesDir, cat.name);
      const pkgs = readdirSync(catPath, { withFileTypes: true });
      for (const pkg of pkgs) {
        if (!pkg.isDirectory()) {
          continue;
        }
        roots.push(join(catPath, pkg.name));
      }
    }
  } catch {
    // packages/ dir not found -- return empty
  }

  workspaceRootsCache = roots;
  return roots;
}

/**
 * Reads the installed version of a package from node_modules.
 * Tries resolution in this order:
 * 1. Root `node_modules/<name>/package.json`
 * 2. `createRequire().resolve()` from monorepo root
 * 3. `createRequire().resolve()` from each workspace package directory
 * 4. Bun store (`node_modules/.bun/`) directory name scan for transitive deps
 *
 * @param npmName - npm package name to look up
 *
 * @param monorepoRoot - absolute path to the monorepo root
 *
 * @returns installed version string, or `undefined` if not found
 *
 * @example
 * ```ts
 * readInstalledVersion("eslint", "/home/user/Monochromatic") // "10.0.0"
 * ```
 */
export function readInstalledVersion(npmName: string, monorepoRoot: string): string | undefined {
  // Try root node_modules first
  const rootPkgJson = join(monorepoRoot, 'node_modules', npmName, 'package.json');
  const version = readVersionFromPackageJson(rootPkgJson);
  if (version !== undefined) {
    return version;
  }

  // Try resolving from monorepo root via createRequire
  try {
    const require = createRequire(join(monorepoRoot, 'package.json'));
    const resolved = require.resolve(`${npmName}/package.json`);
    const rootVersion = readVersionFromPackageJson(resolved);
    if (rootVersion !== undefined) {
      return rootVersion;
    }
  } catch {
    // Not resolvable from root
  }

  // Walk workspace packages and try resolving from each
  const workspaceRoots = discoverWorkspaceRoots(monorepoRoot);
  for (const wsRoot of workspaceRoots) {
    try {
      const require = createRequire(join(wsRoot, 'package.json'));
      const resolved = require.resolve(`${npmName}/package.json`);
      const wsVersion = readVersionFromPackageJson(resolved);
      if (wsVersion !== undefined) {
        return wsVersion;
      }
    } catch {
      // Not resolvable from this workspace root
    }
  }

  // Last resort: scan bun store directory names for transitive deps
  return readVersionFromBunStore(npmName, monorepoRoot);
}

//endregion Version resolution
