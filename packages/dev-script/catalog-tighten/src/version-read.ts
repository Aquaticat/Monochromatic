/**
 * Low-level version reading utilities for catalog-tighten.
 *
 * Reads installed package versions from `package.json` files
 * and from the Bun store directory structure.
 */

import {
  readFile,
  readdir,
} from 'node:fs/promises';
import { join, } from 'node:path';

import { isStrictlyGreater, } from './version-parse.ts';

//region Version reading

/**
 * Sentinel returned by {@link readVersionFromPackageJson} when a manifest is
 * missing, unreadable, or has no `version` field. A `unique symbol`; callers
 * narrow with `=== NO_MANIFEST_VERSION`.
 */
export const NO_MANIFEST_VERSION: unique symbol = Symbol('catalog-tighten/no-manifest-version',);

/**
 * Sentinel returned by {@link readVersionFromBunStore} (and propagated by
 * `readInstalledVersion`) when no installed version is found. A `unique symbol`;
 * callers narrow with `=== NO_INSTALLED_VERSION`.
 */
export const NO_INSTALLED_VERSION: unique symbol = Symbol('catalog-tighten/no-installed-version',);

/**
 * Reads the `version` field from a `package.json` file path.
 *
 * @param pkgJsonPath - absolute path to a package.json file
 *
 * @returns version string, or {@link NO_MANIFEST_VERSION} if file does not exist or has no version
 *
 * @example
 * ```ts
 * await readVersionFromPackageJson("/path/to/node_modules/oxlint/package.json") // "0.21.0"
 * ```
 */
export async function readVersionFromPackageJson(pkgJsonPath: string,): Promise<string | typeof NO_MANIFEST_VERSION> {
  try {
    /**
     * Raw `package.json` text read from disk.
     */
    const content = await readFile(
      pkgJsonPath,
      'utf8',
    );
    /**
     * Parsed manifest narrowed to the only field this helper consults: `version`.
     */
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- JSON structure from package.json is well-known
    const parsed = JSON.parse(content,) as { version?: string; };
    return parsed.version ?? NO_MANIFEST_VERSION;
  }
  catch (error) {
    if (!(error instanceof Error))
      throw error;

    return NO_MANIFEST_VERSION;
  }
}

/**
 * Scans `node_modules/.bun/` directory names for a package version.
 * Bun stores packages as `name@version` (unscoped) or `@scope+name@version` (scoped),
 * optionally with a `+hash` dedup suffix. When multiple versions exist, returns
 * the highest by reading each candidate's `package.json`.
 *
 * @param npmName - npm package name, e.g. `"@oxc-project/runtime"` or `"chokidar"`
 *
 * @param monorepoRoot - absolute path to the monorepo root
 *
 * @returns installed version string, or {@link NO_INSTALLED_VERSION} if not found in store
 *
 * @example
 * ```ts
 * await readVersionFromBunStore({ npmName: "\@oxc-project/runtime", monorepoRoot: "/home/user/Monochromatic" }) // "1.1.0"
 * await readVersionFromBunStore({ npmName: "chokidar", monorepoRoot: "/home/user/Monochromatic" }) // "5.0.0"
 * ```
 */
export async function readVersionFromBunStore(
  {
    npmName,
    monorepoRoot,
  }: {
    readonly npmName: string;
    readonly monorepoRoot: string;
  },
): Promise<string | typeof NO_INSTALLED_VERSION> {
  /**
   * Top-level bun store directory holding all installed package versions for the monorepo.
   */
  const bunStoreDir = join(
    monorepoRoot,
    'node_modules',
    '.bun',
  );
  // Bun encodes `@scope/name` as `@scope+name` in store directory names
  /**
   * Package name rewritten with `/` → `+` so it matches bun's encoded store directory prefix.
   */
  const storePrefix = npmName.includes('/',)
    ? npmName.replace(
      '/',
      '+',
    )
    : npmName;

  /**
   * Direct children of the bun store directory.
   */
  let entries: string[] = [];
  try {
    entries = await readdir(bunStoreDir,);
  }
  catch (error) {
    if (!(error instanceof Error))
      throw error;

    return NO_INSTALLED_VERSION;
  }

  // Match directories starting with `prefix@` (the @ separates name from version)
  /**
   * Exact prefix used to filter store entries: encoded name plus the version separator `@`.
   */
  const matchPrefix = `${storePrefix}@`;
  /**
   * Store entries whose directory name starts with `<name>@`; each holds one installed version.
   */
  const candidates = entries.filter(function filterBunStoreEntry(entry,): boolean {
    return entry.startsWith(matchPrefix,);
  },);

  if (candidates.length
    === 0)
    return NO_INSTALLED_VERSION;

  // Read package.json from each candidate and pick the highest version
  /**
   * Versions read from every candidate store entry.
   */
  const candidateVersions = await Promise.all(candidates.map(async function readCandidateVersion(candidate,): Promise<string | typeof NO_MANIFEST_VERSION> {
    /**
     * Absolute path to the candidate's nested `package.json`; bun stores the real package under `node_modules/<name>`.
     */
    const pkgJsonPath = join(
      bunStoreDir,
      candidate,
      'node_modules',
      npmName,
      'package.json',
    );
    return await readVersionFromPackageJson(pkgJsonPath,);
  },),);

  /**
   * Highest semver seen across the candidate store entries.
   */
  return candidateVersions.reduce(function chooseHighest(
    bestVersion: string | typeof NO_INSTALLED_VERSION,
    candidateVersion,
  ): string | typeof NO_INSTALLED_VERSION {
    if (candidateVersion === NO_MANIFEST_VERSION)
      return bestVersion;
    if ((bestVersion === NO_INSTALLED_VERSION) || isStrictlyGreater({
      cataloged: bestVersion,
      installed: candidateVersion,
    },))
      return candidateVersion;
    return bestVersion;
  }, NO_INSTALLED_VERSION,);
}

//endregion Version reading
