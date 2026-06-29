/**
 * Version resolution utilities for catalog-tighten.
 *
 * Handles npm alias resolution and installed version lookup
 * across node_modules, workspace roots, and the Bun store.
 */

import { readdir, } from 'node:fs/promises';
import { createRequire, } from 'node:module';
import { join, } from 'node:path';

import {
  type NO_INSTALLED_VERSION,
  NO_MANIFEST_VERSION,
  readVersionFromBunStore,
  readVersionFromPackageJson,
} from './version-read.ts';

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
 * resolveNpmNames({ catalogKey: "zod", catalogValue: "npm:\@jsr/zod__zod\@>=4.1.8" }) // ["zod", "\@jsr/zod__zod"]
 * resolveNpmNames({ catalogKey: "oxlint", catalogValue: ">=0.20.0" }) // ["oxlint"]
 * ```
 */
export function resolveNpmNames(
  {
    catalogKey,
    catalogValue,
  }: {
    readonly catalogKey: string;
    readonly catalogValue: string;
  },
): string[] {
  /**
   * Length of the `npm:` prefix
   */
  const NPM_PREFIX_LENGTH = 4;
  if (catalogValue.startsWith('npm:',)) {
    /**
     * Catalog value with the `npm:` prefix stripped, leaving `<target>@<range>` or `<target>` for further parsing.
     */
    const withoutNpm = catalogValue.slice(NPM_PREFIX_LENGTH,);
    // Find the last @ that isn't position 0 (scoped package)
    /**
     * Index of the version separator `@`; skipped at position 0 so scoped names like `@scope/name` survive intact.
     */
    const lastAt = withoutNpm.lastIndexOf('@',);
    /**
     * Registry-target name without the version suffix; the actual install lives here when bun honours the alias.
     */
    const aliasTarget = lastAt > 0
      ? withoutNpm.slice(
        0,
        lastAt,
      )
      : withoutNpm;
    // Key first (bun installs under alias name), then registry target as fallback
    if (aliasTarget !== catalogKey) {
      return [
        catalogKey,
        aliasTarget,
      ];
    }
    return [catalogKey,];
  }
  return [catalogKey,];
}

/**
 * Cached workspace root directories keyed by monorepo root path.
 */
const workspaceRootsCache = new Map<string, string[]>();

/**
 * Discovers all workspace package directories under `packages/{category}/{pkg}`.
 * Cached per `monorepoRoot` after first call.
 *
 * @param monorepoRoot - absolute path to the monorepo root
 *
 * @returns array of absolute paths to workspace package directories
 *
 * @example
 * ```ts
 * await discoverWorkspaceRoots("/home/user/Monochromatic")
 * // ["/home/user/Monochromatic/packages/dev-script/file-enforcer", ...]
 * ```
 */
async function discoverWorkspaceRoots(monorepoRoot: string,): Promise<string[]> {
  /**
   * Previously-computed roots for this `monorepoRoot`, if any; short-circuits the directory scan.
   */
  const cached = workspaceRootsCache.get(monorepoRoot,);
  if (cached !== undefined)
    return cached;

  /**
   * Top-level `packages/` directory; each entry is a category subdir holding individual workspace packages.
   */
  const packagesDir = join(
    monorepoRoot,
    'packages',
  );

  try {
    /**
     * Direct children of `packages/`, expected to be category directories (e.g. `module`, `dev-script`).
     */
    const categories = await readdir(
      packagesDir,
      { withFileTypes: true, },
    );
    /**
     * Workspace package roots discovered per package category.
     */
    const rootsByCategory = await Promise.all(categories
      .filter(function isDirectory(cat,): boolean {
        return cat.isDirectory();
      },)
      .map(async function readPackageCategory(cat,): Promise<readonly string[]> {
        /**
         * Absolute path to one category directory, scanned for the actual package folders.
         */
        const catPath = join(
          packagesDir,
          cat.name,
        );
        /**
         * Individual workspace packages nested under the category; each becomes one entry in `roots`.
         */
        const pkgs = await readdir(
          catPath,
          { withFileTypes: true, },
        );
        return pkgs
          .filter(function isPackageDirectory(pkg,): boolean {
            return pkg.isDirectory();
          },)
          .map(function toPackageRoot(pkg,): string {
            return join(
              catPath,
              pkg.name,
            );
          },);
      },),);
    /**
     * Flattened workspace package roots cached for the current monorepo.
     */
    const roots = rootsByCategory.flat();
    workspaceRootsCache.set(
      monorepoRoot,
      roots,
    );
    return roots;
  }
  catch (error) {
    if (!(error instanceof Error))
      throw error;

    workspaceRootsCache.set(
      monorepoRoot,
      [],
    );
    return [];
  }
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
 * @returns installed version string, or {@link NO_INSTALLED_VERSION} if not found
 *
 * @example
 * ```ts
 * await readInstalledVersion({ npmName: "oxlint", monorepoRoot: "/home/user/Monochromatic" }) // "0.21.0"
 * ```
 */
export async function readInstalledVersion(
  {
    npmName,
    monorepoRoot,
  }: {
    readonly npmName: string;
    readonly monorepoRoot: string;
  },
): Promise<string | typeof NO_INSTALLED_VERSION> {
  // Try root node_modules first
  /**
   * Expected hoisted location of the package's `package.json` directly under the monorepo root.
   */
  const rootPkgJson = join(
    monorepoRoot,
    'node_modules',
    npmName,
    'package.json',
  );
  /**
   * Version found at the hoisted root location, if any; short-circuits before slower fallbacks.
   */
  const version = await readVersionFromPackageJson(rootPkgJson,);
  if (version !== NO_MANIFEST_VERSION)
    return version;

  // Try resolving from monorepo root via createRequire
  try {
    /**
     * Node-style require anchored at the monorepo root, used to walk the resolution chain from there.
     */
    const require = createRequire(join(
      monorepoRoot,
      'package.json',
    ),);
    /**
     * Resolved absolute path to the package's `package.json` via Node resolution from the monorepo root.
     */
    const resolved = require.resolve(`${npmName}/package.json`,);
    /**
     * Version read from the require-resolved `package.json`; second attempt after the hoisted lookup.
     */
    const rootVersion = await readVersionFromPackageJson(resolved,);
    if (rootVersion !== NO_MANIFEST_VERSION)
      return rootVersion;
  }
  catch (error) {
    if (!(error instanceof Error))
      throw error;

    // Not resolvable from root
  }

  // Walk workspace packages and try resolving from each
  /**
   * Every workspace package directory, used as alternate require anchors when root resolution fails.
   */
  const workspaceRoots = await discoverWorkspaceRoots(monorepoRoot,);
  /**
   * Versions resolved from each workspace package anchor.
   */
  const workspaceVersions = await Promise.all(workspaceRoots.map(async function readWorkspaceVersion(
    wsRoot,
  ): Promise<string | typeof NO_MANIFEST_VERSION> {
    try {
      /**
       * Node-style require anchored at one workspace package, picking up its locally hoisted deps.
       */
      const require = createRequire(join(
        wsRoot,
        'package.json',
      ),);
      /**
       * Resolved absolute path to the package's `package.json` via require from this workspace anchor.
       */
      const resolved = require.resolve(`${npmName}/package.json`,);
      return await readVersionFromPackageJson(resolved,);
    }
    catch (error) {
      if (!(error instanceof Error))
        throw error;

      return NO_MANIFEST_VERSION;
    }
  },),);
  /**
   * First installed version found through workspace package resolution.
   */
  const wsVersion = workspaceVersions.find(function hasVersion(candidate,): boolean {
    return candidate !== NO_MANIFEST_VERSION;
  },);
  if (wsVersion !== undefined)
    return wsVersion;

  // Last resort: scan bun store directory names for transitive deps
  return await readVersionFromBunStore({
    npmName,
    monorepoRoot,
  },);
}

//endregion Version resolution
