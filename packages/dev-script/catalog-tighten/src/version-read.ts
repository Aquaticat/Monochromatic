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

import {
  ABSENT,
  type Maybe,
} from './maybe.ts';
import { isStrictlyGreater, } from './version-parse.ts';

//region Version reading

/**
 * Reads the `version` field from a `package.json` file path.
 *
 * @param pkgJsonPath - absolute path to a package.json file
 *
 * @returns version string, or {@link ABSENT} if file does not exist or has no version
 *
 * @example
 * ```ts
 * readVersionFromPackageJson("/path/to/node_modules/oxlint/package.json") // "0.21.0"
 * ```
 */
export function readVersionFromPackageJson(pkgJsonPath: string,): Maybe<string> {
  try {
    /** Raw `package.json` text read from disk; deliberately read synchronously so callers stay sync. */
    const content = readFileSync(
      pkgJsonPath,
      'utf8',
    );
    /** Parsed manifest narrowed to the only field this helper consults: `version`. */
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- JSON structure from package.json is well-known
    const parsed = JSON.parse(content,) as { version?: string; };
    return parsed.version ?? ABSENT;
  }
  catch {
    return ABSENT;
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
 * @returns installed version string, or {@link ABSENT} if not found in store
 *
 * @example
 * ```ts
 * readVersionFromBunStore({ npmName: "\@oxc-project/runtime", monorepoRoot: "/home/user/Monochromatic" }) // "1.1.0"
 * readVersionFromBunStore({ npmName: "chokidar", monorepoRoot: "/home/user/Monochromatic" }) // "5.0.0"
 * ```
 */
export function readVersionFromBunStore(
  {
    npmName,
    monorepoRoot,
  }: {
    readonly npmName: string;
    readonly monorepoRoot: string;
  },
): Maybe<string> {
  /** Top-level bun store directory holding all installed package versions for the monorepo. */
  const bunStoreDir = join(
    monorepoRoot,
    'node_modules',
    '.bun',
  );
  // Bun encodes `@scope/name` as `@scope+name` in store directory names
  /** Package name rewritten with `/` → `+` so it matches bun's encoded store directory prefix. */
  const storePrefix = npmName.includes('/',)
    ? npmName.replace(
      '/',
      '+',
    )
    : npmName;

  /**
   * Direct children of the bun store directory.
   *
   * Initialised empty and populated only on successful read so the catch
   * branch falls through cleanly without leaking an undefined state.
   */
  let entries: string[] = [];
  try {
    entries = readdirSync(bunStoreDir,);
  }
  catch {
    return ABSENT;
  }

  // Match directories starting with `prefix@` (the @ separates name from version)
  /**
   * Exact prefix used to filter store entries: encoded name plus the version separator `@`.
   */
  const matchPrefix = `${storePrefix}@`;
  /**
   * Store entries whose directory name starts with `<name>@`; each holds one installed version.
   */
  const candidates = entries.filter(function filterBunStoreEntry(entry,) {
    return entry.startsWith(matchPrefix,);
  },);

  if (candidates.length
    === 0)
    return ABSENT;

  // Read package.json from each candidate and pick the highest version
  /**
   * Highest semver seen across the candidate store entries.
   *
   * Accumulator pattern: starts {@link ABSENT} so the first valid candidate
   * seeds the value, then later candidates only overwrite when strictly greater.
   */
  let bestVersion: Maybe<string> = ABSENT;
  for (const candidate of candidates) {
    /** Absolute path to the candidate's nested `package.json`; bun stores the real package under `node_modules/<name>`. */
    const pkgJsonPath = join(
      bunStoreDir,
      candidate,
      'node_modules',
      npmName,
      'package.json',
    );
    /** Version of one candidate; `ABSENT` skips this iteration without touching `bestVersion`. */
    const candidateVersion = readVersionFromPackageJson(pkgJsonPath,);
    if (candidateVersion === ABSENT)
      continue;
    if ((bestVersion === ABSENT) || isStrictlyGreater({
      cataloged: bestVersion,
      installed: candidateVersion,
    },)) {
      bestVersion = candidateVersion;
    }
  }

  return bestVersion;
}

//endregion Version reading
