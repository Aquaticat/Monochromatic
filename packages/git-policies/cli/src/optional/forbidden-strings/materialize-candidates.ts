// Generated from `packages/git-policies/forbidden-strings/src/materialize-candidates.ts` by file-enforcer; edit canonical source owner.
/**
 * Plugin-owned scanner candidate materialization.
 *
 * @module
 */
import {
  mkdtemp,
  rm,
  writeFile,
} from 'node:fs/promises';
import { tmpdir, } from 'node:os';
import { join, } from 'node:path';
import type { CandidateFile, } from '../../api/index.ts';

/**
 * Plugin-owned disposable scanner files.
 */
export type MaterializedCandidates = Readonly<{
  /**
   * Materialized file paths in scanner argument order.
   */
  paths: readonly string[];
  /**
   * Exact scanner path to policy candidate lookup.
   */
  candidatesByPath: ReadonlyMap<string, CandidateFile>;
  /**
   * Removes plugin-owned files.
   */
  [Symbol.asyncDispose]: () => Promise<void>;
}>;

/**
 * Materializes exact non-deleted candidate bytes under syntax-free names.
 *
 * @param candidates - exact lazy Git candidates
 *
 * @returns disposable scanner inputs
 *
 * @example
 * ```ts
 * await using inputs = await materializeCandidates([]);
 * ```
 */
export async function materializeCandidates(
  candidates: readonly CandidateFile[],
): Promise<MaterializedCandidates> {
  /**
   * Private plugin-owned temporary directory.
   */
  const directory = await mkdtemp(join(
    tmpdir(),
    'cli-git-forbidden-strings-',
  ),);
  /**
   * Content-bearing candidate states.
   */
  const contentCandidates = candidates.filter(function hasContent(candidate,): boolean {
    return candidate.change !== 'deleted';
  },);
  /**
   * Stable plugin-owned paths independent of repository path grammar.
   */
  const paths = contentCandidates.map(function scannerPath(
    _candidate,
    index,
  ): string {
    return join(
      directory,
      `candidate-${String(index,)}`,
    );
  },);
  await Promise.all(contentCandidates.map(async function writeCandidate(
    candidate,
    index,
  ): Promise<void> {
    await writeFile(
      paths[index] ?? '',
      await candidate.bytes(),
    );
  },),);
  return {
    paths,
    candidatesByPath: new Map(paths.map(function mapCandidate(
      path,
      index,
    ): readonly [
      string,
      CandidateFile
    ] {
      /**
       * Candidate aligned with generated path.
       */
      const candidate = contentCandidates[index];
      if (candidate === undefined)
        throw new Error('Candidate materialization index was not aligned.',);
      return [
        path,
        candidate,
      ];
    },),),
    async [Symbol.asyncDispose](): Promise<void> {
      await rm(
        directory,
        {
          recursive: true,
          force: true,
        },
      );
    },
  };
}
