/**
 * Recent artifact scanning.
 *
 * Scans `src/canary-lint/` directories to find model:probe pairs tested within
 * the last 24 hours, allowing the runner to skip recently-tested combinations.
 * Also detects whole-model failure artifacts so the runner can skip all probes
 * for models that recently failed entirely (e.g. 429 errors).
 */
import {
  readdir,
  readFile,
} from 'node:fs/promises';
import { join, } from 'node:path';

import {
  ARTIFACT_DIR_PATTERN,
  FAILURE_DIR_PATTERN,
  isRecentTimestamp,
  type RecentArtifactScan,
  TWENTY_FOUR_HOURS_MS,
} from './linter-artifacts-timestamp.ts';
import {
  type ArtifactMeta,
  type FailureArtifactMeta,
  LINT_DIR,
} from './linter-artifacts.ts';

export type { RecentArtifactScan, };

/**
 * Scans artifact directories to find model:probe pairs tested within the last 24 hours.
 *
 * Derives recent results directly from artifact directory timestamps.
 * Only considers initial-pass artifacts (fix-pass artifacts always accompany an initial).
 * Also detects whole-model failure artifacts (`failure-<timestamp>`) so the runner
 * can skip all probes for models that recently failed entirely (e.g. 429 errors).
 *
 * @returns scan result with per-probe pairs and whole-model failure labels
 *
 * @example
 * ```ts
 * const scan = await getRecentArtifactPairs();
 * scan.probePairs.get('Opus 4.6')?.has('sudoku-solver');
 * ```
 */
export async function getRecentArtifactPairs(): Promise<RecentArtifactScan> {
  const cutoff = Date.now() - TWENTY_FOUR_HOURS_MS;
  const probePairs = new Map<string, Set<string>>();
  const failedModels = new Set<string>();

  let modelDirs: string[] = [];
  try {
    modelDirs = await readdir(LINT_DIR,);
  }
  catch {
    return {
      probePairs,
      failedModels,
    };
  }

  for (const modelDir of modelDirs) {
    const modelPath = join(
      LINT_DIR,
      modelDir,
    );
    let artifactDirs: string[] = [];
    try {
      // oxlint-disable-next-line no-await-in-loop -- sequential directory reads per model
      artifactDirs = await readdir(modelPath,);
    }
    catch {
      continue;
    }

    for (const dirName of artifactDirs) {
      //region Failure artifact detection: whole-model failures like 429 or auth errors
      const failureMatch = FAILURE_DIR_PATTERN.exec(dirName,);
      if (failureMatch !== null && failureMatch.groups !== undefined) {
        const rawTimestamp = failureMatch.groups['timestamp'];
        if (rawTimestamp !== undefined && isRecentTimestamp(
          rawTimestamp,
          cutoff,
        )) {
          // Read meta.json to get the model label (fall back to directory name)
          const metaPath = join(
            modelPath,
            dirName,
            'meta.json',
          );
          try {
            // oxlint-disable-next-line no-await-in-loop -- sequential meta.json reads within nested artifact scan
            const metaRaw = await readFile(
              metaPath,
              'utf8',
            );
            // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- JSON from meta.json has known shape
            const meta = JSON.parse(metaRaw,) as Partial<FailureArtifactMeta>;
            const label = meta.label ?? modelDir;
            if (meta.failed === true)
              failedModels.add(label,);
          }
          catch {
            // Missing or malformed meta.json: skip
          }
        }
        continue;
      }
      //endregion Failure artifact detection

      //region Per-probe artifact detection: individual probe results
      const match = ARTIFACT_DIR_PATTERN.exec(dirName,);
      if (match === null || match.groups === undefined)
        continue;
      if (match.groups['pass'] !== 'initial')
        continue;

      const rawTimestamp = match.groups['timestamp'];
      if (rawTimestamp === undefined)
        continue;
      if (!isRecentTimestamp(
        rawTimestamp,
        cutoff,
      )) {
        continue;
      }

      // Read meta.json to get the model label (old artifacts without label fall back to directory name)
      const metaPath = join(
        modelPath,
        dirName,
        'meta.json',
      );
      try {
        // oxlint-disable-next-line no-await-in-loop -- sequential meta.json reads within nested artifact scan
        const metaRaw = await readFile(
          metaPath,
          'utf8',
        );
        // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- JSON from meta.json has known shape
        const meta = JSON.parse(metaRaw,) as Partial<ArtifactMeta>;
        const label = meta.label ?? modelDir;
        const { probe, } = meta;
        if (probe === undefined)
          continue;
        const existing = probePairs.get(label,) ?? new Set<string>();
        existing.add(probe,);
        probePairs.set(
          label,
          existing,
        );
      }
      catch {
        // Missing or malformed meta.json; skip
      }
      //endregion Per-probe artifact detection
    }
  }

  return {
    probePairs,
    failedModels,
  };
}
