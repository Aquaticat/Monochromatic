/**
 * Low-level version reading utilities for catalog-tighten.
 *
 * Reads installed package versions from `package.json` files
 * and from the Bun store directory structure.
 */

import {
  readdirSync,
  readFileSync,
} from 'node:fs';
import { join, } from 'node:path';

import { isStrictlyGreater, } from './version-parse.ts';

//region Version reading

/**
 * Reads the `version` field from a `package.json` file path.
 *
 * @param pkgJsonPath - absolute path to a package.json file
 *
 * @returns version string, or `undefined` if file does not exist or has no version
 *
 * @example
 * ```ts
 * readVersionFromPackageJson("/path/to/node_modules/eslint/package.json") // "10.0.0"
 * ```
 */
export function readVersionFromPackageJson(pkgJsonPath: string,): string | undefined {
  try {
    const content = readFileSync(
      pkgJsonPath,
      'utf8',
    );
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- JSON structure from package.json is well-known
    const parsed = JSON.parse(content,) as { version?: string; };
    return parsed.version;
  }
  catch {
    return undefined;
  }
}

/**
 * Scans `node_modules/.bun/` directory names for a package version.
 * Bun stores packages as `name@version` (unscoped) or `@scope+name@version` (scoped),
 * optionally with a `+hash` dedup suffix. When multiple versions exist, returns
 * the highest by reading each candidate's `package.json`.
 *
 * @param npmName - npm package name, e.g. `"@eslint/core"` or `"chokidar"`
 *
 * @param monorepoRoot - absolute path to the monorepo root
 *
 * @returns installed version string, or `undefined` if not found in store
 *
 * @example
 * ```ts
 * readVersionFromBunStore("\@eslint/core", "/home/user/Monochromatic") // "1.1.0"
 * readVersionFromBunStore("chokidar", "/home/user/Monochromatic") // "5.0.0"
 * ```
 */
export function readVersionFromBunStore(
  npmName: string,
  monorepoRoot: string,
):
  | string
  | undefined
{
  const bunStoreDir = join(
    monorepoRoot,
    'node_modules',
    '.bun',
  );
  // Bun encodes `@scope/name` as `@scope+name` in store directory names
  const storePrefix = npmName.includes('/',)
    ? npmName.replace(
      '/',
      '+',
    )
    : npmName;

  let entries: string[] = [];
  try {
    entries = readdirSync(bunStoreDir,);
  }
  catch {
    return undefined;
  }

  // Match directories starting with `prefix@` (the @ separates name from version)
  const matchPrefix = `${storePrefix}@`;
  const candidates = entries.filter(function filterBunStoreEntry(entry,) {
    return entry.startsWith(matchPrefix,);
  },);

  if (candidates.length === 0)
    return undefined;

  // Read package.json from each candidate and pick the highest version
  let bestVersion: string | undefined = undefined;
  for (const candidate of candidates) {
    const pkgJsonPath = join(
      bunStoreDir,
      candidate,
      'node_modules',
      npmName,
      'package.json',
    );
    const candidateVersion = readVersionFromPackageJson(pkgJsonPath,);
    if (candidateVersion === undefined)
      continue;
    if (bestVersion === undefined || isStrictlyGreater(
      bestVersion,
      candidateVersion,
    ))
      bestVersion = candidateVersion;
  }

  return bestVersion;
}

//endregion Version reading
