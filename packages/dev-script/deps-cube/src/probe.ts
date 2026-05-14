/**
 * Per-catalog-entry probe orchestrator.
 *
 * For each catalog entry, calls field-level probes in
 * {@link ./probe-fields.ts} and assembles a {@link PackageProbe}. Fetches
 * are bounded by a small semaphore (8 concurrent at a time) so we don't
 * blow through `gh` rate limits or npmjs.org bandwidth.
 *
 * @example
 * ```ts
 * import { readCatalog } from './catalog.ts';
 * import { createCache } from './cache.ts';
 * import { probeAll } from './probe.ts';
 *
 * const entries = await readCatalog();
 * const cache = createCache();
 * const probes = await probeAll({ entries, cache });
 * ```
 */

import pLimit from 'p-limit';

import type { CatalogEntry, } from './catalog.ts';
import type { Cache, } from './cache.ts';
import {
  classifyLicense,
  type LicenseClass,
  parseRepository,
  probeDownloads,
  probeLanguages,
  probeLastCommit,
  probePackageManifest,
  type RepositoryInfo,
  resolveVersion,
} from './probe-fields.ts';
import { probeTransitive, } from './probe-transitive.ts';

//region Types

/**
 * Reason an attribute resolved to "unknown".
 */
export type UnknownReason = 'no-repo' | 'non-github' | 'monorepo' | 'private-or-404';

/**
 * Re-exported license-class type for downstream consumers.
 */
export type { LicenseClass, };

/**
 * Fully-resolved attribute vector for one catalog entry.
 *
 * Fields ending in `OrNull` are explicitly nullable: `null` means the value
 * could not be determined (typically because the package isn't on GitHub or
 * is monorepo-housed and Linguist would mismeasure it).
 */
export type PackageProbe = {
  /** Original key in the catalog (may be an alias). */
  catalogKey: string;
  /** Real npm package name (after alias resolution). */
  npmName: string;
  /** Concrete version used for all measurements. */
  resolvedVersion: string;

  /** `true` when `dependencies` is empty / absent; package has no runtime deps. */
  isLeaf: boolean;
  /** Weekly downloads from npm registry; 0 for niche packages, never null. */
  weeklyDownloads: number;
  /** Self install size (unpacked tarball) in bytes; from `dist.unpackedSize`. */
  installSizeBytes: number;
  /** Days since the package was first published. */
  packageAgeDays: number;
  /** License class inferred from the `license` field. */
  licenseClass: LicenseClass;
  /** Count of `dependencies` entries in the version manifest. */
  runtimeDepCount: number;
  /** Best-effort transitive dep count via depth-bounded registry walk; capped at depth 5. */
  transitiveDepCount: number;

  /** TS bytes / total bytes per GitHub Linguist; `null` when unknown. */
  tsRatioOrNull: number | null;
  /** Sum of TypeScript+JavaScript bytes per Linguist; `null` when unknown. */
  sourceBytesOrNull: number | null;
  /** Days since the most-recent commit (path-scoped for monorepo entries); `null` when unknown. */
  daysSinceLastCommitOrNull: number | null;

  /** Normalised repository URL when parseable; `null` if missing/non-URL. */
  repositoryUrlOrNull: string | null;
  /** `true` when `repository.directory` is set (Linguist measures the wrong scope). */
  isMonorepoHoused: boolean;
  /** Reason TS/SLOC/staleness are unknown, if any; `null` when all three are known. */
  unknownReason: UnknownReason | null;
};

//endregion Types

//region Constants

/** Concurrency cap for parallel probes. */
const CONCURRENCY = 8;
/** Milliseconds per day, for staleness math. */
const MS_PER_DAY = 24 * 60 * 60 * 1000;

//endregion Constants

//region Helpers

/**
 * Decides which of the four "unknown" reason codes applies to a probe based
 * on the repo info and the Linguist outcome.
 *
 * @param repoInfo - Normalised repository info, or `null` if missing.
 * @param isMonorepoHoused - `true` when `repository.directory` is set.
 * @param languages - Linguist response, or `null` when API failed.
 *
 * @returns A discriminated reason code, or `null` when all three GH-derived
 *   attributes are known.
 */
function computeUnknownReason(
  {
    repoInfo,
    isMonorepoHoused,
    languages,
  }: {
    repoInfo: RepositoryInfo;
    isMonorepoHoused: boolean;
    languages: Record<string, number> | null;
  },
): UnknownReason | null {
  if (repoInfo === null) return 'no-repo';
  if (repoInfo.host !== 'github') return 'non-github';
  if (isMonorepoHoused && languages === null) return 'monorepo';
  if (languages === null) return 'private-or-404';
  return null;
}

/**
 * Builds a stub probe representing a failed entry so the audit surfaces the
 * failure visually rather than crashing the run.
 *
 * @param entry - The catalog entry that failed.
 * @param err - The underlying error.
 *
 * @returns A {@link PackageProbe} with zeroed continuous fields and `unknownReason: 'private-or-404'`.
 */
function failedProbe(
  {
    entry,
    err,
  }: {
    entry: CatalogEntry;
    err: Error;
  },
): PackageProbe {
  console.error(`[probe] FAILED ${entry.npmName}: ${err.message}`,);
  return {
    catalogKey: entry.catalogKey,
    npmName: entry.npmName,
    resolvedVersion: entry.range,
    isLeaf: true,
    weeklyDownloads: 0,
    installSizeBytes: 0,
    packageAgeDays: 0,
    licenseClass: 'unknown',
    runtimeDepCount: 0,
    transitiveDepCount: 0,
    tsRatioOrNull: null,
    sourceBytesOrNull: null,
    daysSinceLastCommitOrNull: null,
    repositoryUrlOrNull: null,
    isMonorepoHoused: false,
    unknownReason: 'private-or-404',
  };
}

//endregion Helpers

//region Per-entry probe

/**
 * Runs the full probe pipeline for one catalog entry.
 *
 * @param entry - The catalog entry.
 * @param cache - Shared file cache handle.
 *
 * @returns Resolved {@link PackageProbe} with every field populated.
 */
async function probeOne(
  {
    entry,
    cache,
  }: {
    entry: CatalogEntry;
    cache: Cache;
  },
): Promise<PackageProbe> {
  const pkg = await probePackageManifest({
    npmName: entry.npmName,
    cache,
  },);
  const resolvedVersion = resolveVersion({
    range: entry.range,
    pkg,
  },) ?? entry.range;

  const versionManifest = pkg.versions?.[resolvedVersion] ?? {};
  const dependencies = versionManifest.dependencies ?? {};
  const runtimeDepCount = Object.keys(dependencies,).length;
  const isLeaf = runtimeDepCount === 0;
  const installSizeBytes = versionManifest.dist?.unpackedSize ?? 0;
  const licenseClass = classifyLicense(versionManifest.license,);

  const createdAt = pkg.time?.created;
  const packageAgeDays = createdAt === undefined
    ? 0
    : Math.floor((Date.now() - new Date(createdAt,).getTime()) / MS_PER_DAY,);

  const weeklyDownloads = await probeDownloads({
    npmName: entry.npmName,
    cache,
  },);

  const repoInfo = parseRepository(versionManifest.repository,);
  const isMonorepoHoused = repoInfo !== null && repoInfo.directory !== undefined;
  const isGitHub = repoInfo !== null && repoInfo.host === 'github';

  const [languages, lastCommitDate, transitiveDepCount,] = await Promise.all([
    isGitHub && !isMonorepoHoused
      ? probeLanguages({
        owner: repoInfo.owner,
        repo: repoInfo.repo,
        cache,
      },)
      : Promise.resolve(null,),
    isGitHub
      ? probeLastCommit({
        owner: repoInfo.owner,
        repo: repoInfo.repo,
        directory: repoInfo.directory,
        cache,
      },)
      : Promise.resolve(null,),
    probeTransitive({
      name: entry.npmName,
      version: resolvedVersion,
      cache,
      visited: new Set(),
      depth: 0,
    },),
  ],);

  const totalBytes = languages === null
    ? null
    : Object.values(languages,).reduce(function sumBytes(a, b,) {
      return a + b;
    }, 0,);
  const tsBytes = languages?.['TypeScript'] ?? null;
  const jsBytes = languages?.['JavaScript'] ?? 0;

  const tsRatioOrNull = totalBytes === null || totalBytes === 0 || tsBytes === null
    ? null
    : tsBytes / totalBytes;
  const sourceBytesOrNull = totalBytes === null
    ? null
    : (tsBytes ?? 0) + jsBytes;
  const daysSinceLastCommitOrNull = lastCommitDate === null
    ? null
    : Math.floor((Date.now() - new Date(lastCommitDate,).getTime()) / MS_PER_DAY,);

  const unknownReason = computeUnknownReason({
    repoInfo,
    isMonorepoHoused,
    languages,
  },);

  return {
    catalogKey: entry.catalogKey,
    npmName: entry.npmName,
    resolvedVersion,
    isLeaf,
    weeklyDownloads,
    installSizeBytes,
    packageAgeDays,
    licenseClass,
    runtimeDepCount,
    transitiveDepCount,
    tsRatioOrNull,
    sourceBytesOrNull,
    daysSinceLastCommitOrNull,
    repositoryUrlOrNull: repoInfo?.url ?? null,
    isMonorepoHoused,
    unknownReason,
  };
}

//endregion Per-entry probe

//region Public API

/**
 * Runs {@link probeOne} for every catalog entry, bounded to
 * {@link CONCURRENCY} in flight via {@link pLimit}.
 *
 * Per-entry errors are caught and surfaced as a stub probe via
 * {@link failedProbe} so a single failure doesn't abort the whole audit.
 *
 * @param entries - Catalog entries from {@link readCatalog}.
 * @param cache - Shared file cache handle.
 *
 * @returns Array of probes, in the same order as `entries`.
 *
 * @example
 * ```ts
 * const probes = await probeAll({ entries, cache });
 * ```
 */
export async function probeAll(
  {
    entries,
    cache,
  }: {
    entries: readonly CatalogEntry[];
    cache: Cache;
  },
): Promise<readonly PackageProbe[]> {
  const limit = pLimit(CONCURRENCY,);
  const total = entries.length;
  const tasks = entries.map(function buildTask(entry, index,) {
    return limit(async function runTask() {
      console.error(`[probe ${(index + 1).toString()}/${total.toString()}] ${entry.npmName}`,);
      try {
        return await probeOne({
          entry,
          cache,
        },);
      } catch (err) {
        return failedProbe({
          entry,
          err: err instanceof Error ? err : new Error(String(err,),),
        },);
      }
    },);
  },);
  return await Promise.all(tasks,);
}

//endregion Public API
