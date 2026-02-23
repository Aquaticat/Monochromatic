/**
 * Lint artifact file management.
 *
 * Writes generated model output to `src/canary-lint/<model>/<probe>-<pass>/canary.ts`
 * with a `meta.json` sidecar for traceability. Directory is gitignored and intentionally
 * kept after runs for debugging -- artifacts do not accumulate enough to matter.
 */
import { mkdir, writeFile, } from 'node:fs/promises';
import { join, } from 'node:path';

//region Paths -- package-relative constants for locating the canary-lint artifact directory

/**
 * Canary lint artifact directory. Lives under src/ so both tsgo (via the
 * package tsconfig's `src\/**\/*.ts` include) and oxlint pick it up without
 * any config overrides. No leading dot because TS globs skip dotdirs.
 */
export const PACKAGE_DIR = new URL('..', import.meta.url).pathname;

/** Root directory for all lint artifacts, gitignored via the package .gitignore. */
export const LINT_DIR = join(PACKAGE_DIR, 'src', 'canary-lint');

//endregion Paths

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
 * Writes generated source and a meta.json sidecar into an artifact directory.
 * @param source - TypeScript source to analyze
 * @param meta - artifact metadata (model, probe, pass, timestamp)
 * @returns file path and lint subdirectory path
 */
export async function writeLintFile(source: string, meta: ArtifactMeta): Promise<{
  readonly filePath: string;
  readonly lintDir: string;
}> {
  const slug = modelSlug(meta.model);
  const lintDir = join(LINT_DIR, slug, `${meta.probe}-${meta.pass}`);
  await mkdir(lintDir, { recursive: true, });
  const filePath = join(lintDir, 'canary.ts');
  await Promise.all([
    writeFile(filePath, source, 'utf8'),
    writeFile(join(lintDir, 'meta.json'), JSON.stringify(meta, null, 2), 'utf8'),
  ]);
  return { filePath, lintDir, };
}

//endregion Artifact writing
