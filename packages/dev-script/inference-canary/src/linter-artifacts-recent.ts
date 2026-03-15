/**
 * Recent artifact scanning.
 *
 * Scans `src/canary-lint/` directories to find model:probe pairs tested within
 * the last 24 hours, allowing the runner to skip recently-tested combinations.
 * Also detects whole-model failure artifacts so the runner can skip all probes
 * for models that recently failed entirely (e.g. 429 errors).
 */
import { readdir, readFile, } from 'node:fs/promises';
import { join, } from 'node:path';

import { LINT_DIR, } from './linter-artifacts.ts';

import type { ArtifactMeta, FailureArtifactMeta, } from './linter-artifacts.ts';

/** Hours in a day */
const HOURS_PER_DAY = 24;

/** Minutes per hour */
const MINUTES_PER_HOUR = 60;

/** Seconds per minute */
const SECONDS_PER_MINUTE = 60;

/** Milliseconds per second */
const MS_PER_SECOND = 1_000;

/** 24 hours in milliseconds */
const TWENTY_FOUR_HOURS_MS = HOURS_PER_DAY * MINUTES_PER_HOUR * SECONDS_PER_MINUTE * MS_PER_SECOND;

/**
 * Regex to parse artifact directory names into (probe, pass, timestamp) components.
 * Matches: `<probe>-<pass>-<timestamp>` where pass is "initial" or "fix".
 * The timestamp has colons replaced with hyphens by `timestampSlug`.
 *
 * @example
 * ```ts
 * ARTIFACT_DIR_PATTERN.exec('csv-rfc4180-initial-2026-03-06T12-00-00.000Z');
 * // groups: { probe: 'csv-rfc4180', pass: 'initial', timestamp: '2026-03-06T12-00-00.000Z' }
 * ```
 */
const ARTIFACT_DIR_PATTERN = /^(?<probe>.+)-(?<pass>initial|fix)-(?<timestamp>\d{4}-.+)$/;

/**
 * Result of scanning artifact directories for recent activity.
 * Contains both per-probe pairs and whole-model failures so the runner can
 * skip probes that were already attempted (successfully or not) within 24 hours.
 */
export type RecentArtifactScan = {
  /** Map from model label to set of recently-tested probe names */
  readonly probePairs: ReadonlyMap<string, ReadonlySet<string>>;
  /** Model labels that had a whole-model failure (e.g. 429, auth error) within 24 hours */
  readonly failedModels: ReadonlySet<string>;
};

/**
 * Regex to parse failure artifact directory names into timestamp components.
 * Matches: `failure-<timestamp>` where the timestamp has colons replaced with hyphens.
 *
 * @example
 * ```ts
 * FAILURE_DIR_PATTERN.exec('failure-2026-03-06T12-00-00.000Z');
 * // groups: { timestamp: '2026-03-06T12-00-00.000Z' }
 * ```
 */
const FAILURE_DIR_PATTERN = /^failure-(?<timestamp>\d{4}-.+)$/;

/**
 * Restores an ISO timestamp from its filesystem-safe slug form.
 * Reverses the transformation done by `timestampSlug`: hyphens back to colons,
 * then fixes the date portion (year-MM-DD) which was incorrectly colonized.
 *
 * @param rawTimestamp - filesystem-safe timestamp slug (e.g. "2026-03-06T12-00-00.000Z")
 *
 * @returns ISO 8601 timestamp string, or undefined if parsing fails
 */
function restoreTimestamp(rawTimestamp: string): string {
  const withColons = rawTimestamp.replaceAll('-', ':').replace('T:', 'T');
  // Fix the date part: year:MM:DD -> year-MM-DD (first two colons after year are date separators)
  return withColons.replace(
    /^(\d{4}):(\d{2}):(\d{2})/,
    '$1-$2-$3',
  );
}

/**
 * Checks whether a filesystem-safe timestamp slug falls within the recent cutoff.
 *
 * @param rawTimestamp - filesystem-safe timestamp slug
 *
 * @param cutoff - cutoff time in milliseconds since epoch
 *
 * @returns true if the timestamp is recent (after the cutoff)
 */
function isRecentTimestamp(rawTimestamp: string, cutoff: number): boolean {
  const fixed = restoreTimestamp(rawTimestamp);
  const entryTime = new Date(fixed).getTime();
  return !Number.isNaN(entryTime) && entryTime >= cutoff;
}

/**
 * Scans artifact directories to find model:probe pairs tested within the last 24 hours.
 *
 * Derives recent results directly from artifact directory timestamps.
 * Only considers initial-pass artifacts (fix-pass artifacts always accompany an initial).
 * Also detects whole-model failure artifacts (`failure-<timestamp>`) so the runner
 * can skip all probes for models that recently failed entirely (e.g. 429 errors).
 *
 * @returns scan result with per-probe pairs and whole-model failure labels
 */
export async function getRecentArtifactPairs(): Promise<RecentArtifactScan> {
  const cutoff = Date.now() - TWENTY_FOUR_HOURS_MS;
  const probePairs = new Map<string, Set<string>>();
  const failedModels = new Set<string>();

  let modelDirs: string[] = [];
  try {
    modelDirs = await readdir(LINT_DIR);
  } catch {
    return { probePairs, failedModels, };
  }

  for (const modelDir of modelDirs) {
    const modelPath = join(LINT_DIR, modelDir);
    let artifactDirs: string[] = [];
    try {
      artifactDirs = await readdir(modelPath);
    } catch {
      continue;
    }

    for (const dirName of artifactDirs) {
      //region Failure artifact detection -- whole-model failures like 429 or auth errors
      const failureMatch = FAILURE_DIR_PATTERN.exec(dirName);
      if (failureMatch !== null && failureMatch.groups !== undefined) {
        const rawTimestamp = failureMatch.groups['timestamp'];
        if (rawTimestamp !== undefined && isRecentTimestamp(rawTimestamp, cutoff)) {
          // Read meta.json to get the model label (fall back to directory name)
          const metaPath = join(modelPath, dirName, 'meta.json');
          try {
            const metaRaw = await readFile(metaPath, 'utf8');
            // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- JSON from meta.json has known shape
            const meta = JSON.parse(metaRaw) as Partial<FailureArtifactMeta>;
            const label = meta.label ?? modelDir;
            if (meta.failed === true) {
              failedModels.add(label);
            }
          } catch {
            // Missing or malformed meta.json -- skip
          }
        }
        continue;
      }
      //endregion Failure artifact detection

      //region Per-probe artifact detection -- individual probe results
      const match = ARTIFACT_DIR_PATTERN.exec(dirName);
      if (match === null || match.groups === undefined) continue;
      if (match.groups['pass'] !== 'initial') continue;

      const rawTimestamp = match.groups['timestamp'];
      if (rawTimestamp === undefined) continue;
      if (!isRecentTimestamp(rawTimestamp, cutoff)) continue;

      // Read meta.json to get the model label (old artifacts without label fall back to directory name)
      const metaPath = join(modelPath, dirName, 'meta.json');
      try {
        const metaRaw = await readFile(metaPath, 'utf8');
        // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- JSON from meta.json has known shape
        const meta = JSON.parse(metaRaw) as Partial<ArtifactMeta>;
        const label = meta.label ?? modelDir;
        const {probe} = meta;
        if (probe === undefined) continue;
        const existing = probePairs.get(label) ?? new Set<string>();
        existing.add(probe);
        probePairs.set(label, existing);
      } catch {
        // Missing or malformed meta.json -- skip
      }
      //endregion Per-probe artifact detection
    }
  }

  return { probePairs, failedModels, };
}
