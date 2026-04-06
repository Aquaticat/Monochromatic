/**
 * Hashing utilities for the build cache.
 *
 * Provides SHA-256 content hashing for cache invalidation.
 */
import { createHash, } from 'node:crypto';
import { readFile, } from 'node:fs/promises';

/**
 * Computes a SHA-256 hex digest of a string.
 *
 * @param input - string to hash
 *
 * @returns hex-encoded SHA-256 digest
 *
 * @example
 * ```ts
 * const hash = sha256('hello world');
 * ```
 */
export function sha256(input: string,): string {
  return createHash('sha256',).update(input,).digest('hex',);
}

/**
 * Computes the pipeline hash by hashing the markdown.ts source file.
 *
 * When this hash changes, all cached content entries are invalidated
 * because the processing pipeline configuration has changed.
 *
 * @param pipelineSourcePath - path to the pipeline config source
 *
 * @returns hex-encoded SHA-256 digest of the pipeline source
 *
 * @example
 * ```ts
 * const hash = await computePipelineHash('src/lib/markdown.ts');
 * ```
 */
export async function computePipelineHash(
  pipelineSourcePath: string,
): Promise<string> {
  const source = await readFile(
    pipelineSourcePath,
    'utf8',
  );
  return sha256(source,);
}

/**
 * Computes a combined pipeline hash from multiple source files.
 *
 * When any source file changes, all cached content entries are invalidated.
 * File contents are joined with NUL bytes to prevent accidental collisions
 * between files whose contents could be split differently.
 *
 * @param pipelineSourcePaths - paths to all pipeline-affecting source files
 *
 * @returns hex-encoded SHA-256 digest of the combined sources
 *
 * @example
 * ```ts
 * const hash = await computePipelineHashMulti([
 *   'src/lib/markdown.ts',
 *   'src/lib/rehype-highlight.ts',
 *   'src/client/tags.ts',
 * ]);
 * ```
 */
export async function computePipelineHashMulti(
  pipelineSourcePaths: readonly string[],
): Promise<string> {
  const sources = await Promise.all(
    pipelineSourcePaths.map(function readSource(path,) {
      return readFile(
        path,
        'utf8',
      );
    },),
  );
  return sha256(sources.join('\0',),);
}
