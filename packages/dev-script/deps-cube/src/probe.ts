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

import { MS_PER_DAY, } from '@monochromatic-dev/module-const';

import type { Cache, } from './cache.ts';
import type { CatalogEntry, } from './catalog.ts';
import {
  ABSENT,
  type Maybe,
} from './maybe.ts';
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
 * Fields ending in `OrNull` are optional: an absent field means the value
 * could not be determined (typically because the package isn't on GitHub or
 * is monorepo-housed and Linguist would mismeasure it). They keep the
 * `OrNull` suffix for call-site familiarity; "absent" replaces the former
 * `null`, since the workspace bans nullish unions.
 */
export type PackageProbe = Readonly<{
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

  /** TS bytes / total bytes per GitHub Linguist; absent when unknown. */
  tsRatioOrNull?: number;
  /** Sum of TypeScript+JavaScript bytes per Linguist; absent when unknown. */
  sourceBytesOrNull?: number;
  /** Days since the most-recent commit (path-scoped for monorepo entries); absent when unknown. */
  daysSinceLastCommitOrNull?: number;

  /** Normalised repository URL when parseable; absent if missing/non-URL. */
  repositoryUrlOrNull?: string;
  /** `true` when `repository.directory` is set (Linguist measures the wrong scope). */
  isMonorepoHoused: boolean;
  /** Reason TS/SLOC/staleness are unknown, if any; absent when all three are known. */
  unknownReason?: UnknownReason;
}>;

//endregion Types

//region Constants

/** Concurrency cap for parallel probes. */
const CONCURRENCY = 8;

//endregion Constants

//region Helpers

/**
 * Decides which of the four "unknown" reason codes applies to a probe based
 * on the repo info and the Linguist outcome.
 *
 * @param repoInfo - Normalised repository info, or `ABSENT` if missing.
 *
 * @param isMonorepoHoused - `true` when `repository.directory` is set.
 *
 * @param languages - Linguist response, or `ABSENT` when API failed.
 *
 * @returns Discriminated reason code, or `ABSENT` when all three GH-derived
 *   attributes are known.
 */
function computeUnknownReason(
  {
    repoInfo,
    isMonorepoHoused,
    languages,
  }: {
    readonly repoInfo: Maybe<RepositoryInfo>;
    readonly isMonorepoHoused: boolean;
    readonly languages: Maybe<Readonly<Record<string, number>>>;
  },
): Maybe<UnknownReason> {
  if (repoInfo === ABSENT)
    return 'no-repo';
  if (repoInfo.host
    !== 'github')
    return 'non-github';
  if (isMonorepoHoused && (languages === ABSENT))
    return 'monorepo';
  if (languages === ABSENT)
    return 'private-or-404';
  return ABSENT;
}

/**
 * Builds a stub probe representing a failed entry so the audit surfaces the
 * failure visually rather than crashing the run.
 *
 * @param entry - The catalog entry that failed.
 *
 * @param err - The underlying error.
 *
 * @returns A {@link PackageProbe} with zeroed continuous fields and `unknownReason: 'private-or-404'`.
 */
function failedProbe(
  {
    entry,
    err,
  }: {
    readonly entry: CatalogEntry;
    readonly err: Error;
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
 *
 * @param cache - Shared file cache handle.
 *
 * @returns Resolved {@link PackageProbe} with every field populated.
 */
async function probeOne(
  {
    entry,
    cache,
  }: {
    readonly entry: CatalogEntry;
    readonly cache: Cache;
  },
): Promise<PackageProbe> {
  /** npm registry manifest for the package; the source of every static field below. */
  const pkg = await probePackageManifest({
    npmName: entry.npmName,
    cache,
  },);
  /** Resolved version, or `ABSENT` when neither pin nor latest resolves. */
  const resolved = resolveVersion({
    range: entry.range,
    pkg,
  },);
  /** Concrete version actually used for measurements; falls back to the raw range string when resolution returns `ABSENT`. */
  const resolvedVersion = resolved === ABSENT ? entry.range : resolved;

  /** Version-scoped sub-manifest for `resolvedVersion`; `{}` when the registry response is incomplete. */
  const versionManifest = pkg.versions?.[resolvedVersion]
    ?? {};
  /** Runtime dependency map declared in the version manifest. */
  const dependencies = versionManifest.dependencies
    ?? {};
  /** Count of direct runtime deps; drives the `isLeaf` flag and the runtime-dep visual channel. */
  const runtimeDepCount = Object.keys(dependencies,)
    .length;
  /** `true` when the package has no runtime deps; convenience flag derived from `runtimeDepCount`. */
  const isLeaf = runtimeDepCount === 0;
  /** Self install size in bytes; `0` when the registry omits `dist.unpackedSize`. */
  const installSizeBytes = versionManifest.dist
    ?.unpackedSize
    ?? 0;
  /** Bucketed license class derived from the SPDX-ish `license` field; coarser than the raw string for visualisation. */
  const licenseClass = classifyLicense(versionManifest.license,);

  /** ISO timestamp of first publish; missing on some legacy packages. */
  const createdAt = pkg.time
    ?.created;
  /** Days since first publish, computed from `createdAt`; `0` when `createdAt` is missing. */
  const packageAgeDays = createdAt === undefined
    ? 0
    : Math.floor((Date.now()
      - new Date(createdAt,)
      .getTime()) / MS_PER_DAY,);

  /** Weekly download count from the npm registry; surfaces popularity as a visual channel. */
  const weeklyDownloads = await probeDownloads({
    npmName: entry.npmName,
    cache,
  },);

  /** Parsed repository pointer, or `ABSENT` when the manifest lacks a usable repo URL. */
  const repoInfo = parseRepository(versionManifest.repository,);
  /** Repo pointer with `ABSENT` collapsed to `undefined` so the guards below narrow it cleanly. */
  const repo = repoInfo === ABSENT ? undefined : repoInfo;
  /** `true` when the package lives inside a monorepo; Linguist measures the wrong scope here so we skip it. */
  const isMonorepoHoused = (repo !== undefined) && (repo.directory
    !== undefined);
  /** `true` when the repo is on GitHub; gates the GH-specific probes below. */
  const isGitHub = (repo !== undefined) && (repo.host
    === 'github');

  /** `true` when the package is on GitHub and not buried inside a monorepo; gates the Linguist probe. */
  const isStandaloneGitHub = isGitHub && (!isMonorepoHoused);

  /** Tuple of parallel GH/registry probe results: Linguist languages, last-commit ISO, transitive dep count. */
  const [
    languages,
    lastCommitDate,
    transitiveDepCount,
  ] = await Promise.all([
    (isStandaloneGitHub && (repo !== undefined))
      ? probeLanguages({
        owner: repo.owner,
        repo: repo.repo,
        cache,
      },)
      : Promise.resolve<Maybe<Record<string, number>>>(ABSENT,),
    (isGitHub && (repo !== undefined))
      ? probeLastCommit({
        owner: repo.owner,
        repo: repo.repo,
        ...((repo.directory
          === undefined)
          ? {}
          : { directory: repo.directory, }),
        cache,
      },)
      : Promise.resolve<Maybe<string>>(ABSENT,),
    probeTransitive({
      name: entry.npmName,
      version: resolvedVersion,
      cache,
      visited: new Set(),
      depth: 0,
    },),
  ],);

  /** Linguist languages record, or `undefined` when the probe was skipped or failed; narrows the symbol away. */
  const knownLanguages = languages === ABSENT ? undefined : languages;
  /** Sum of Linguist byte counts across every detected language; denominator for the TS ratio, `ABSENT` when Linguist did not run. */
  const totalBytes: Maybe<number> = knownLanguages === undefined
    ? ABSENT
    : Object.values(knownLanguages,)
      .reduce(
      function sumBytes(
        a,
        b,
      ) {
        return a + b;
      },
      0,
    );
  /** Bytes Linguist attributes to TypeScript; `undefined` when Linguist did not run or did not detect TS. */
  const tsBytes = knownLanguages?.TypeScript;
  /** Bytes Linguist attributes to JavaScript; `0` when Linguist did not detect JS. */
  const jsBytes = knownLanguages?.JavaScript
    ?? 0;

  /** TS-share of total source bytes, in `[0, 1]`; `ABSENT` when Linguist data is missing or unusable. */
  const tsRatioOrNull: Maybe<number> = (totalBytes === ABSENT)
    || (totalBytes === 0)
    || (tsBytes === undefined)
    ? ABSENT
    : tsBytes / totalBytes;
  /** Combined TS+JS bytes; `ABSENT` when Linguist data is missing. */
  const sourceBytesOrNull: Maybe<number> = totalBytes === ABSENT
    ? ABSENT
    : (tsBytes ?? 0) + jsBytes;
  /** Days since the most-recent commit; `ABSENT` when the last-commit probe failed or was skipped. */
  const daysSinceLastCommitOrNull: Maybe<number> = lastCommitDate === ABSENT
    ? ABSENT
    : Math.floor((Date.now()
      - new Date(lastCommitDate,)
      .getTime()) / MS_PER_DAY,);

  /** Discriminated reason for any unknown GH-derived field, or `ABSENT` when all three are known. */
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
    isMonorepoHoused,
    ...(tsRatioOrNull === ABSENT ? {} : { tsRatioOrNull, }),
    ...(sourceBytesOrNull === ABSENT ? {} : { sourceBytesOrNull, }),
    ...(daysSinceLastCommitOrNull === ABSENT
      ? {}
      : { daysSinceLastCommitOrNull, }),
    ...(repo === undefined ? {} : { repositoryUrlOrNull: repo.url, }),
    ...(unknownReason === ABSENT ? {} : { unknownReason, }),
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
 *
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
    readonly entries: readonly CatalogEntry[];
    readonly cache: Cache;
  },
): Promise<readonly PackageProbe[]> {
  /** Semaphore that bounds in-flight probes so we don't blow through rate limits. */
  const limit = pLimit(CONCURRENCY,);
  /** Total entry count, cached for log messages. */
  const total = entries.length;
  /** Per-entry probe promises queued through `limit`; resolved in input order via `Promise.all`. */
  const tasks = entries.map(function buildTask(
    entry,
    index,
  ) {
    return limit(async function runTask() {
      console.error(
        `[probe ${(index + 1).toString()}/${total.toString()}] ${entry.npmName}`,
      );
      try {
        return await probeOne({
          entry,
          cache,
        },);
      }
      catch (err) {
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
