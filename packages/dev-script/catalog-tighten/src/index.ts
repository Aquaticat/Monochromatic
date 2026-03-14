#!/usr/bin/env bun

/**
 * Tightens monorepo root `package.json` catalog `>=x.y.z` ranges
 * to match the versions actually installed in `node_modules`.
 *
 * Only touches entries in the default `workspaces.catalog` object
 * whose range starts with `>=`. Entries using `*`, exact versions,
 * GitHub references, or named catalogs are skipped.
 *
 * @example
 * ```sh
 * bun packages/dev-script/catalog-tighten/src/index.ts
 * bun packages/dev-script/catalog-tighten/src/index.ts --dry-run
 * ```
 */

import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join, resolve } from 'node:path';

export {};

//region Types

/**
 * Parsed `>=` range from a catalog entry.
 *
 * @example `{ prefix: "npm:\@jsr/zod__zod\@", range: ">=4.1.8" }` for `"npm:\@jsr/zod__zod\@>=4.1.8"`
 */
type ParsedRange = {
  /** Everything before the `>=` token, including any `npm:` alias prefix. Empty string for plain `>=x.y.z`. */
  prefix: string;
  /** Semver version string after `>=`, e.g. `"1.2.3"` or `"7.0.0-dev.20250311"`. */
  version: string;
};

/**
 * Result of comparing catalog range against installed version.
 */
type TightenResult = {
  /** Package name as it appears in the catalog key. */
  name: string;
  /** Original catalog range string, e.g. `">=1.2.0"`. */
  oldRange: string;
  /** New tightened range string, e.g. `">=1.3.0"`. */
  newRange: string;
};

//endregion Types

//region Semver parsing

/** Regex matching a `>=` range, optionally preceded by an npm alias prefix. */
const RANGE_RE = /^(?<prefix>.*?)>=(?<version>.+)$/;

/**
 * Extracts the `>=` version and any alias prefix from a catalog value.
 * Returns `undefined` for values that are not `>=` ranges.
 *
 * @param value - raw catalog entry value, e.g. `">=1.2.3"` or `"npm:@jsr/foo@>=1.0.0"`
 *
 * @returns parsed prefix and version, or `undefined`
 *
 * @example
 * ```ts
 * parseRange(">=1.2.3") // { prefix: "", version: "1.2.3" }
 * parseRange("npm:\@jsr/zod__zod\@>=4.1.8") // { prefix: "npm:\@jsr/zod__zod\@", version: "4.1.8" }
 * parseRange("*") // undefined
 * ```
 */
function parseRange(value: string): ParsedRange | undefined {
  const match = RANGE_RE.exec(value);
  if (match === null) {
    return undefined;
  }
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- regex named groups are guaranteed by RANGE_RE pattern
  const { prefix, version } = match.groups as { prefix: string; version: string };
  return { prefix, version };
}

/**
 * Splits a semver string into `[major, minor, patch, prerelease]`.
 * Prerelease is everything after the first `-`, or empty string.
 *
 * @param version - semver string, e.g. `"1.2.3"` or `"7.0.0-dev.20250311"`
 *
 * @returns tuple of `[major, minor, patch, prerelease]`
 *
 * @example
 * ```ts
 * splitSemver("1.2.3") // [1, 2, 3, ""]
 * splitSemver("7.0.0-dev.20250311") // [7, 0, 0, "dev.20250311"]
 * ```
 */
function splitSemver(version: string): [number, number, number, string] {
  const dashIndex = version.indexOf('-');
  const prerelease = dashIndex === -1 ? '' : version.slice(dashIndex + 1);
  const coreStr = dashIndex === -1 ? version : version.slice(0, dashIndex);
  const parts = coreStr.split('.');
  return [
    Number(parts[0]),
    Number(parts[1]),
    Number(parts[2]),
    prerelease,
  ];
}

/**
 * Determines whether `installed` is strictly greater than `cataloged`.
 * Follows semver ordering: major \> minor \> patch \> prerelease (lexicographic).
 * A release version (no prerelease) is greater than any prerelease of the same triple.
 *
 * @param cataloged - version from the catalog range
 *
 * @param installed - version from node_modules
 *
 * @returns `true` if `installed` is strictly newer
 *
 * @example
 * ```ts
 * isStrictlyGreater("1.2.0", "1.3.0") // true
 * isStrictlyGreater("1.2.0", "1.2.0") // false
 * isStrictlyGreater("7.0.0-dev.1", "7.0.0-dev.2") // true
 * ```
 */
function isStrictlyGreater(cataloged: string, installed: string): boolean {
  const [cMaj, cMin, cPat, cPre] = splitSemver(cataloged);
  const [iMaj, iMin, iPat, iPre] = splitSemver(installed);

  if (iMaj !== cMaj) {
    return iMaj > cMaj;
  }
  if (iMin !== cMin) {
    return iMin > cMin;
  }
  if (iPat !== cPat) {
    return iPat > cPat;
  }

  // Same major.minor.patch -- compare prerelease
  // No prerelease > any prerelease (release is "greater" than prerelease of same triple)
  if (cPre !== '' && iPre === '') {
    return true;
  }
  if (cPre === '' && iPre !== '') {
    // Installed is a prerelease of the same triple -- not greater
    return false;
  }
  // Both have prerelease or both have none
  return iPre > cPre;
}

//endregion Semver parsing

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
function resolveNpmNames(catalogKey: string, catalogValue: string): string[] {
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

/** Cached workspace root directories. */
// oxlint-disable-next-line unicorn/no-useless-undefined -- init-declarations requires explicit initialization
let workspaceRootsCache: string[] | undefined = undefined;

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
function readInstalledVersion(npmName: string, monorepoRoot: string): string | undefined {
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
function readVersionFromBunStore(npmName: string, monorepoRoot: string): string | undefined {
  const bunStoreDir = join(monorepoRoot, 'node_modules', '.bun');
  // Bun encodes `@scope/name` as `@scope+name` in store directory names
  const storePrefix = npmName.includes('/')
    ? npmName.replace('/', '+')
    : npmName;

  let entries: string[] = [];
  try {
    entries = readdirSync(bunStoreDir);
  } catch {
    return undefined;
  }

  // Match directories starting with `prefix@` (the @ separates name from version)
  const matchPrefix = `${storePrefix}@`;
  const candidates = entries.filter(function filterBunStoreEntry(entry) {
    return entry.startsWith(matchPrefix);
  });

  if (candidates.length === 0) {
    return undefined;
  }

  // Read package.json from each candidate and pick the highest version
  let bestVersion: string | undefined = undefined;
  for (const candidate of candidates) {
    const pkgJsonPath = join(bunStoreDir, candidate, 'node_modules', npmName, 'package.json');
    const candidateVersion = readVersionFromPackageJson(pkgJsonPath);
    if (candidateVersion === undefined) {
      continue;
    }
    if (bestVersion === undefined || isStrictlyGreater(bestVersion, candidateVersion)) {
      bestVersion = candidateVersion;
    }
  }

  return bestVersion;
}

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
function readVersionFromPackageJson(pkgJsonPath: string): string | undefined {
  try {
    const content = readFileSync(pkgJsonPath, 'utf8');
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- JSON structure from package.json is well-known
    const parsed = JSON.parse(content) as { version?: string };
    return parsed.version;
  } catch {
    return undefined;
  }
}

//endregion Version resolution

//region Main

/** Whether `--dry-run` was passed on the command line. */
const dryRun = process.argv.includes('--dry-run');

/** Absolute path to the monorepo root (where this script is invoked from). */
const monorepoRoot = resolve('.');

/** Absolute path to the root package.json. */
const packageJsonPath = join(monorepoRoot, 'package.json');

/** Raw content of package.json, preserved for minimal-diff rewriting. */
const packageJsonContent = readFileSync(packageJsonPath, 'utf8');

/** Parsed root package.json. */
// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- root package.json structure is well-known
const packageJson = JSON.parse(packageJsonContent) as {
  workspaces?: {
    catalog?: Record<string, string>;
  };
};

/** Workspace catalog mapping package names to version ranges. */
const catalog = packageJson.workspaces?.catalog;
if (catalog === undefined) {
  console.error('No workspaces.catalog found in package.json');
  process.exitCode = 1;
  throw new Error('No workspaces.catalog found in package.json');
}

/** Collected tightening results for the summary log. */
const results: TightenResult[] = [];

/** Count of entries skipped (not `>=` ranges). */
let skippedCount = 0;

/** Count of entries where the installed version matched the catalog range (already tight). */
let alreadyTightCount = 0;

/** Count of entries where the package was not found in node_modules. */
let notFoundCount = 0;

/** Classifies and processes each catalog entry for tightening. */
Object.entries(catalog).forEach(function processEntry([name, value]) {
  /** Parsed range prefix and version, or `undefined` if not a `>=` range. */
  const parsed = parseRange(value);
  if (parsed === undefined) {
    skippedCount += 1;
    console.info(`SKIP  ${name}: ${value} (not a >= range)`);
    return;
  }

  /** Candidate npm package names to probe in node_modules. */
  const npmNames = resolveNpmNames(name, value);
  /** First npm name candidate whose installed version resolves. */
  const resolved = npmNames
    .map(function probeCandidate(candidate) {
      return { name: candidate, version: readInstalledVersion(candidate, monorepoRoot) };
    })
    .find(function hasVersion(r) { return r.version !== undefined; });

  if (resolved === undefined || resolved.version === undefined) {
    notFoundCount += 1;
    console.warn(`MISS  ${name}: not found in node_modules (tried ${npmNames.join(', ')})`);
    return;
  }

  if (!isStrictlyGreater(parsed.version, resolved.version)) {
    alreadyTightCount += 1;
    console.info(`OK    ${name}: >=${parsed.version} -- installed ${resolved.version} (already tight)`);
    return;
  }

  /** Tightened version range using the installed version as the lower bound. */
  const newRange = `${parsed.prefix}>=${resolved.version}`;
  results.push({ name, oldRange: value, newRange });
  console.info(`TIGHT ${name}: ${value} -> ${newRange} (installed ${resolved.version})`);
});

//region Write results

if (results.length === 0) {
  console.info('\nNo catalog entries to tighten.');
} else if (dryRun) {
  console.info(`\nDry run: ${String(results.length)} entries would be tightened.`);
} else {
  /**
   * Rewrite package.json using string replacement to preserve formatting.
   * Each catalog entry is replaced individually to avoid touching unrelated content.
   */
  const rewritten = results.reduce(function applyTightening(acc, { name, oldRange, newRange }) {
    return acc.replace(`"${name}": "${oldRange}"`, `"${name}": "${newRange}"`);
  }, packageJsonContent);

  writeFileSync(packageJsonPath, rewritten);
  console.info(`\nWrote ${String(results.length)} tightened entries to package.json.`);
}

//endregion Write results

//region Summary

console.info(`\nSummary:`);
console.info(`  Tightened: ${String(results.length)}`);
console.info(`  Already tight: ${String(alreadyTightCount)}`);
console.info(`  Skipped (not >=): ${String(skippedCount)}`);
console.info(`  Not found: ${String(notFoundCount)}`);

//endregion Summary

//endregion Main
