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
