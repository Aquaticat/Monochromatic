/**
 * Best-effort artifact reader for canary lint outputs.
 *
 * Walks the `src/canary-lint/` directory from the inference-canary package
 * and collects whatever artifacts are present. Missing or unreadable artifacts
 * are silently skipped -- the viewer degrades gracefully.
 *
 * Directory structure: `src/canary-lint/<model-slug>/<probe>-<pass>-<timestamp>/`
 * Each directory contains `canary.ts` (source) and `meta.json` (metadata sidecar).
 */
import { readdir, readFile, } from 'node:fs/promises';
import { join, } from 'node:path';

import { LINT_DIR, } from '@monochromatic-dev/dev-script-inference-canary/src/linter-artifacts.ts';
import type { ArtifactMeta, } from '@monochromatic-dev/dev-script-inference-canary/src/linter-artifacts.ts';

export { LINT_DIR, };

/** Single artifact with source code and metadata */
export type Artifact = {
  readonly meta: ArtifactMeta;
  readonly source: string;
  /** Absolute path to the artifact directory */
  readonly dir: string;
};

/**
 * Unique key for grouping initial/fix artifact pairs by model, probe, and timestamp.
 * @param meta - artifact metadata
 * @returns composite key string
 *
 * @example
 * ```ts
 * artifactKey({ model: 'anthropic/claude-sonnet-4.6', probe: 'css-mixin-transpiler', pass: 'initial', timestamp: '2026-03-01T00:00:00.000Z' });
 * // "anthropic/claude-sonnet-4.6::css-mixin-transpiler::2026-03-01T00:00:00.000Z"
 * ```
 */
export function artifactKey(meta: ArtifactMeta): string {
  return `${meta.model}::${meta.probe}::${meta.timestamp}`;
}

/** Paired initial and fix artifacts for a single probe run */
export type ArtifactPair = {
  readonly initial?: Artifact | undefined;
  readonly fix?: Artifact | undefined;
};

/**
 * Reads all available artifacts from the canary lint directory.
 * @returns map from artifact key to paired initial/fix artifacts
 */
export async function readArtifacts(): Promise<ReadonlyMap<string, ArtifactPair>> {
  const pairs = new Map<string, { initial?: Artifact; fix?: Artifact; }>();

  let modelDirs: string[];
  try {
    modelDirs = await readdir(LINT_DIR);
  } catch {
    console.error('[viewer] no artifact directory found, skipping artifact loading');
    return pairs;
  }

  for (const modelDir of modelDirs) {
    const modelPath = join(LINT_DIR, modelDir);
    let probeDirs: string[];
    try {
      probeDirs = await readdir(modelPath);
    } catch {
      continue;
    }

    for (const probeDir of probeDirs) {
      const dirPath = join(modelPath, probeDir);
      try {
        const [metaRaw, source] = await Promise.all([
          readFile(join(dirPath, 'meta.json'), 'utf8'),
          readFile(join(dirPath, 'canary.ts'), 'utf8'),
        ]);
        const meta = JSON.parse(metaRaw) as ArtifactMeta;
        const artifact: Artifact = { meta, source, dir: dirPath, };
        const key = artifactKey(meta);
        const existing = pairs.get(key) ?? {};
        if (meta.pass === 'initial') {
          pairs.set(key, { ...existing, initial: artifact, });
        } else {
          pairs.set(key, { ...existing, fix: artifact, });
        }
      } catch {
        // Missing or malformed artifact -- skip silently
      }
    }
  }

  console.error(`[viewer] loaded ${String(pairs.size)} artifact pairs`);
  return pairs;
}
