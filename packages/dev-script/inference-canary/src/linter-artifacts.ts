/**
 * Lint artifact file management.
 *
 * Writes generated model output to `src/canary-lint/<model>/<probe>-<pass>-<timestamp>/canary.ts`
 * with a `meta.json` sidecar for traceability. Directory is gitignored and intentionally
 * kept after runs for debugging -- artifacts do not accumulate enough to matter.
 */
import { mkdir, writeFile, } from 'node:fs/promises';
import { join, } from 'node:path';

import { PACKAGE_DIR, } from './paths.ts';

export { PACKAGE_DIR, } from './paths.ts';

/** Root directory for all lint artifacts, gitignored via the package .gitignore. */
export const LINT_DIR = join(PACKAGE_DIR, 'src', 'canary-lint');

//region Artifact writing -- writes generated source and meta.json sidecar for oxlint/tsgo to consume

/** Metadata written alongside each generated canary.ts for traceability */
export type ArtifactMeta = {
  readonly model: string;
  readonly probe: string;
  readonly pass: 'initial' | 'fix';
  readonly timestamp: string;
};

/**
 * Extracts the short model name from an OpenRouter model ID.
 * "anthropic/claude-sonnet-4.6" -> "claude-sonnet-4.6"
 * @param modelId - full OpenRouter model ID
 * @returns short slug suitable for directory names
 */
function modelSlug(modelId: string): string {
  return modelId.split('/').pop() ?? modelId;
}

/**
 * Converts an ISO timestamp to a filesystem-safe string.
 * Replaces colons with hyphens so the directory name works on all platforms.
 * "2026-02-28T12:00:00.000Z" -> "2026-02-28T12-00-00.000Z"
 * @param timestamp - ISO 8601 timestamp string
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
 * Writes generated source and a meta.json sidecar into an artifact directory.
 *
 * Each run gets its own directory keyed by timestamp so all historical artifacts
 * are preserved for the web interface, not just the latest run.
 *
 * Directory structure: `src/canary-lint/<model>/<probe>-<pass>-<timestamp>/`
 *
 * @param source - TypeScript source to analyze
 * @param meta - artifact metadata (model, probe, pass, timestamp)
 * @returns file path and lint subdirectory path
 */
export async function writeLintFile(source: string, meta: ArtifactMeta): Promise<{
  readonly filePath: string;
  readonly lintDir: string;
}> {
  const slug = modelSlug(meta.model);
  const safeTs = timestampSlug(meta.timestamp);
  const lintDir = join(LINT_DIR, slug, `${meta.probe}-${meta.pass}-${safeTs}`);
  await mkdir(lintDir, { recursive: true, });
  const filePath = join(lintDir, 'canary.ts');
  await Promise.all([
    writeFile(filePath, source, 'utf8'),
    writeFile(join(lintDir, 'meta.json'), JSON.stringify(meta, null, 2), 'utf8'),
  ]);
  return { filePath, lintDir, };
}

//endregion Artifact writing
