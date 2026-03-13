/**
 * Lint artifact file management.
 *
 * Writes generated model output to `src/canary-lint/<model>/<probe>-<pass>-<timestamp>/canary.ts`
 * with a `meta.json` sidecar for traceability. Directory is gitignored and intentionally
 * kept after runs for debugging -- artifacts do not accumulate enough to matter.
 */
import { mkdir, readdir, readFile, writeFile, } from 'node:fs/promises';
import { join, } from 'node:path';

import { PACKAGE_DIR, } from './paths.ts';

import type { ConfigSnapshot, StreamTiming, StreamUsage, } from './runner-types.ts';

export { PACKAGE_DIR, } from './paths.ts';

/** Root directory for all lint artifacts, gitignored via the package .gitignore. */
export const LINT_DIR = join(PACKAGE_DIR, 'src', 'canary-lint');

//region Artifact writing -- writes generated source and meta.json sidecar for oxlint/tsgo to consume

/** Metadata written alongside each generated canary.ts for traceability */
export type ArtifactMeta = {
  readonly model: string;
  /** Human-readable model label, used for directory naming and dedup */
  readonly label: string;
  readonly probe: string;
  readonly pass: 'initial' | 'fix';
  readonly timestamp: string;
};

/**
 * Extended metadata written after scoring completes.
 * Overwrites the basic {@link ArtifactMeta} in meta.json with additional fields
 * from the completion result and scoring pipeline.
 */
export type EnrichedArtifactMeta = ArtifactMeta & {
  /** Probe score for this specific artifact (per-run score for initial, pass2 score for fix) */
  readonly score: number;
  /** Model's reasoning/thinking trace, empty string when the model produced none */
  readonly reasoning: string;
  /** Per-chunk timing breakdown for the API call that produced this artifact */
  readonly timing: StreamTiming;
  /** Token usage from the API, undefined when the API did not report usage */
  readonly usage: StreamUsage | undefined;
  /** Why generation stopped (e.g. "stop", "length"), undefined when not reported */
  readonly finishReason: string | undefined;
  /** Runner configuration snapshot for reproducibility */
  readonly config: ConfigSnapshot;
  /** Diagnostic prompt sent to the model (fix pass only), undefined for initial pass */
  readonly fixPrompt?: string | undefined;
  /** True when this artifact contains partial data from an aborted or failed run */
  readonly partial?: boolean | undefined;
  /** Error message when the run failed or was aborted */
  readonly error?: string | undefined;
};

/**
 * Metadata for a whole-model failure where no probes executed.
 * Written so the artifact directory records that a run was attempted.
 */
export type FailureArtifactMeta = {
  readonly model: string;
  /** Human-readable model label, used for directory naming */
  readonly label: string;
  readonly timestamp: string;
  readonly failed: true;
  readonly error: string;
  readonly config: ConfigSnapshot;
};

/**
 * Converts an ISO timestamp to a filesystem-safe string.
 * Replaces colons with hyphens so the directory name works on all platforms.
 * "2026-02-28T12:00:00.000Z" -\> "2026-02-28T12-00-00.000Z"
 *
 * @param timestamp - ISO 8601 timestamp string
 *
 * @returns filesystem-safe timestamp slug
 *
 * @example
 * ```ts
 * timestampSlug('2026-02-28T12:00:00.000Z'); // "2026-02-28T12-00-00.000Z"
 * ```
 */
function timestampSlug(timestamp: string): string {
  return timestamp.replaceAll(':', '-');
}

/**
 * Computes the deterministic artifact directory path for a given metadata set.
 *
 * @param meta - artifact metadata (model, probe, pass, timestamp)
 *
 * @returns absolute directory path
 */
export function artifactDir(meta: ArtifactMeta): string {
  if (typeof meta.label !== 'string') {
    throw new TypeError(`ArtifactMeta.label must be a string, got ${typeof meta.label} (model=${String(meta.model)}, probe=${String(meta.probe)})`);
  }
  const safeTs = timestampSlug(meta.timestamp);
  return join(LINT_DIR, meta.label, `${meta.probe}-${meta.pass}-${safeTs}`);
}

/**
 * Writes generated source and a meta.json sidecar into an artifact directory.
 *
 * Each run gets its own directory keyed by timestamp so all historical artifacts
 * are preserved for the web interface, not just the latest run.
 *
 * Directory structure: `src/canary-lint/<model>/<probe>-<pass>-<timestamp>/`
 *
 * @param source - TypeScript source to analyze
 *
 * @param meta - artifact metadata (model, probe, pass, timestamp)
 *
 * @returns file path and lint subdirectory path
 */
export async function writeLintFile(source: string, meta: ArtifactMeta): Promise<{
  readonly filePath: string;
  readonly lintDir: string;
}> {
  const lintDir = artifactDir(meta);
  await mkdir(lintDir, { recursive: true, });
  const filePath = join(lintDir, 'canary.ts');
  await Promise.all([
    writeFile(filePath, source, 'utf8'),
    writeFile(join(lintDir, 'meta.json'), JSON.stringify(meta, null, 2), 'utf8'),
  ]);
  return { filePath, lintDir, };
}

/**
 * Writes enriched metadata and the raw response to an artifact directory.
 *
 * Overwrites the basic meta.json written by {@link writeLintFile} with all
 * completion data (reasoning, timing, usage, score, config). Also writes
 * `response.txt` containing the raw model output for debugging.
 *
 * For probes without code artifacts (simulation, simple), creates the directory
 * and writes meta.json + response.txt as the sole outputs.
 *
 * @param enriched - full enriched metadata including score and completion data
 *
 * @param rawResponse - raw model output text
 */
export async function writeEnrichedArtifact(enriched: EnrichedArtifactMeta, rawResponse: string): Promise<void> {
  const dir = artifactDir(enriched);
  await mkdir(dir, { recursive: true, });
  await Promise.all([
    writeFile(join(dir, 'meta.json'), JSON.stringify(enriched, null, 2), 'utf8'),
    writeFile(join(dir, 'response.txt'), rawResponse, 'utf8'),
  ]);
}

/**
 * Writes a failure artifact for a whole-model failure where no probes executed.
 *
 * Creates `src/canary-lint/<model-slug>/failure-<timestamp>/meta.json`
 * so the artifact directory records that a run was attempted and why it failed.
 *
 * @param meta - failure metadata with model, timestamp, and error
 */
export async function writeFailureArtifact(meta: FailureArtifactMeta): Promise<void> {
  const safeTs = timestampSlug(meta.timestamp);
  const dir = join(LINT_DIR, meta.label, `failure-${safeTs}`);
  await mkdir(dir, { recursive: true, });
  await writeFile(join(dir, 'meta.json'), JSON.stringify(meta, null, 2), 'utf8');
}

//endregion Artifact writing

//region Recent artifact detection -- scans artifact directories to find model:probe pairs tested recently

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
 * The timestamp has colons replaced with hyphens by {@link timestampSlug}.
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
 * Reverses the transformation done by {@link timestampSlug}: hyphens back to colons,
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
 * Replaces the history-based {@link getRecentModelProbePairs} for the runner,
 * deriving recent results directly from artifact directory timestamps.
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

//endregion Recent artifact detection
