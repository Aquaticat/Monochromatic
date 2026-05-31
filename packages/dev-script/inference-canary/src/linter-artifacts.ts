/**
 * Lint artifact file management.
 *
 * Writes generated model output to `src/canary-lint/<model>/<probe>-<pass>-<timestamp>/canary.ts`
 * with a `meta.json` sidecar for traceability. Directory is gitignored and intentionally
 * kept after runs for debugging; artifacts do not accumulate enough to matter.
 */
import {
  mkdir,
  writeFile,
} from 'node:fs/promises';
import { join, } from 'node:path';

import { PACKAGE_DIR, } from './paths.ts';

import type {
  ConfigSnapshot,
  StreamTiming,
  StreamUsage,
} from './runner-types.ts';

export { PACKAGE_DIR, } from './paths.ts';

/**
 * Root directory for all lint artifacts, gitignored via the package .gitignore.
 */
export const LINT_DIR: string = join(
  PACKAGE_DIR,
  'src',
  'canary-lint',
);

//region Artifact writing: writes generated source and meta.json sidecar for oxlint/tsgo to consume

/**
 * Metadata written alongside each generated canary.ts for traceability
 */
export type ArtifactMeta = {
  readonly model: string;
  /**
   * Human-readable model label, used for directory naming and dedup
   */
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
  /**
   * Probe score for this specific artifact (per-run score for initial, pass2 score for fix)
   */
  readonly score: number;
  /**
   * Model's reasoning/thinking trace, empty string when the model produced none
   */
  readonly reasoning: string;
  /**
   * Per-chunk timing breakdown for the API call that produced this artifact
   */
  readonly timing: StreamTiming;
  /**
   * Token usage from the API, absent when the API did not report usage
   */
  readonly usage?: StreamUsage;
  /**
   * Why generation stopped (e.g. "stop", "length"), absent when not reported
   */
  readonly finishReason?: string;
  /**
   * Runner configuration snapshot for reproducibility
   */
  readonly config: ConfigSnapshot;
  /**
   * Diagnostic prompt sent to the model (fix pass only), absent for initial pass
   */
  readonly fixPrompt?: string;
  /**
   * True when this artifact contains partial data from an aborted or failed run
   */
  readonly partial?: boolean;
  /**
   * Error message when the run failed or was aborted
   */
  readonly error?: string;
};

/**
 * Metadata for a whole-model failure where no probes executed.
 * Written so the artifact directory records that a run was attempted.
 */
export type FailureArtifactMeta = {
  readonly model: string;
  /**
   * Human-readable model label, used for directory naming
   */
  readonly label: string;
  readonly timestamp: string;
  readonly failed: true;
  readonly error: string;
  readonly config: ConfigSnapshot;
};

/**
 * Failure meta as read back from a possibly-legacy artifact directory.
 *
 * Only the fields the recency scan consumes are typed, each `?:` because older
 * artifacts predate newer fields. Distinct from the always-complete
 * {@link FailureArtifactMeta} the runner writes: modelling the on-disk read view
 * with explicit optional properties avoids `Partial<FailureArtifactMeta>`, which
 * the no-optional-escape rule bans for reopening strict-optional holes.
 */
export type StoredFailureArtifactMeta = {
  /**
   * Model label recorded at write time; absent in legacy artifacts, so callers fall back to the directory name.
   */
  readonly label?: string;
  /**
   * Whole-model failure marker; absent or non-true on entries that are not failures.
   */
  readonly failed?: boolean;
};

/**
 * Probe meta as read back from a possibly-legacy artifact directory.
 *
 * Only the fields the recency scan consumes are typed, each `?:` because older
 * artifacts predate newer fields. Distinct from the always-complete
 * {@link ArtifactMeta} the runner writes: modelling the on-disk read view with
 * explicit optional properties avoids `Partial<ArtifactMeta>`, which the
 * no-optional-escape rule bans for reopening strict-optional holes.
 */
export type StoredArtifactMeta = {
  /**
   * Model label recorded at write time; absent in legacy artifacts, so callers fall back to the directory name.
   */
  readonly label?: string;
  /**
   * Probe name recorded at write time; runs whose meta omit it are skipped.
   */
  readonly probe?: string;
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
function timestampSlug(timestamp: string,): string {
  return timestamp.replaceAll(
    ':',
    '-',
  );
}

/**
 * Computes the deterministic artifact directory path for a given metadata set.
 *
 * @param meta - artifact metadata (model, probe, pass, timestamp)
 *
 * @returns absolute directory path
 *
 * @example
 * ```ts
 * const dir = artifactDir({ model: 'opus', label: 'Opus', probe: 'stak', pass: 'initial', timestamp: '2026-03-06T12:00:00.000Z' });
 * ```
 */
export function artifactDir(meta: ArtifactMeta,): string {
  if ((typeof meta.label) !== 'string') {
    throw new TypeError(
      `ArtifactMeta.label must be a string, got ${typeof meta.label} (model=${meta.model}, probe=${meta.probe})`,
    );
  }
  /**
   * Timestamp slug with colons rewritten to hyphens so it is filesystem-safe across platforms.
   */
  const safeTs = timestampSlug(meta.timestamp,);
  return join(
    LINT_DIR,
    meta.label,
    `${meta.probe}-${meta.pass}-${safeTs}`,
  );
}

/**
 * Options for {@link writeLintFile}.
 *
 * @example
 * ```ts
 * const opts: WriteLintFileOptions = {
 *   source: 'const x = 1;',
 *   meta: { label: 'Opus 4.6', probe: 'sum', pass: 'initial', timestamp: '2026-03-06T12:00:00.000Z' },
 * };
 * ```
 */
type WriteLintFileOptions = {
  /**
   * TypeScript source to analyze
   */
  readonly source: string;
  /**
   * Artifact metadata (model, probe, pass, timestamp)
   */
  readonly meta: ArtifactMeta;
};

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
 *
 * @example
 * ```ts
 * const { filePath, lintDir } = await writeLintFile({ source: 'const x = 1;', meta });
 * ```
 */
export async function writeLintFile({
  source,
  meta,
}: WriteLintFileOptions,): Promise<{
  readonly filePath: string;
  readonly lintDir: string;
}> {
  /**
   * Per-run artifact directory; computed deterministically from {@link meta} so historical runs do not collide.
   */
  const lintDir = artifactDir(meta,);
  await mkdir(
    lintDir,
    { recursive: true, },
  );
  /**
   * Absolute path of the generated `canary.ts`, the file oxlint and tsgo consume downstream.
   */
  const filePath = join(
    lintDir,
    'canary.ts',
  );
  await Promise.all([
    writeFile(
      filePath,
      source,
      'utf8',
    ),
    writeFile(
      join(
        lintDir,
        'meta.json',
      ),
      JSON.stringify(
        meta,
        null,
        2,
      ),
      'utf8',
    ),
  ],);
  return {
    filePath,
    lintDir,
  };
}

/**
 * Options for {@link writeEnrichedArtifact}.
 *
 * @example
 * ```ts
 * const opts: WriteEnrichedArtifactOptions = {
 *   enriched: enrichedMeta,
 *   rawResponse: '```ts\nconst x = 1;\n```',
 * };
 * ```
 */
type WriteEnrichedArtifactOptions = {
  /**
   * Full enriched metadata including score and completion data
   */
  readonly enriched: EnrichedArtifactMeta;
  /**
   * Raw model output text
   */
  readonly rawResponse: string;
};

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
 *
 * @example
 * ```ts
 * await writeEnrichedArtifact({ enriched: enrichedMeta, rawResponse: '```ts\nconst x = 1;\n```' });
 * ```
 */
export async function writeEnrichedArtifact({
  enriched,
  rawResponse,
}: WriteEnrichedArtifactOptions,): Promise<void> {
  /**
   * Existing artifact directory; reused so the basic meta.json gets overwritten in place.
   */
  const dir = artifactDir(enriched,);
  await mkdir(
    dir,
    { recursive: true, },
  );
  await Promise.all([
    writeFile(
      join(
        dir,
        'meta.json',
      ),
      JSON.stringify(
        enriched,
        null,
        2,
      ),
      'utf8',
    ),
    writeFile(
      join(
        dir,
        'response.txt',
      ),
      rawResponse,
      'utf8',
    ),
  ],);
}

/**
 * Writes a failure artifact for a whole-model failure where no probes executed.
 *
 * Creates `src/canary-lint/<model-slug>/failure-<timestamp>/meta.json`
 * so the artifact directory records that a run was attempted and why it failed.
 *
 * @param meta - failure metadata with model, timestamp, and error
 *
 * @example
 * ```ts
 * await writeFailureArtifact({ model: 'opus', label: 'Opus', timestamp: '2026-03-06T12:00:00.000Z', failed: true, error: '429', config });
 * ```
 */
export async function writeFailureArtifact(meta: FailureArtifactMeta,): Promise<void> {
  /**
   * Filesystem-safe timestamp slug; same encoding as {@link artifactDir} for consistency.
   */
  const safeTs = timestampSlug(meta.timestamp,);
  /**
   * Failure-specific directory path under the model label, separate from per-probe directories.
   */
  const dir = join(
    LINT_DIR,
    meta.label,
    `failure-${safeTs}`,
  );
  await mkdir(
    dir,
    { recursive: true, },
  );
  await writeFile(
    join(
      dir,
      'meta.json',
    ),
    JSON.stringify(
      meta,
      null,
      2,
    ),
    'utf8',
  );
}

//endregion Artifact writing
