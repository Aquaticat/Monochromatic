/**
 * Forbidden-strings scanner process adapter.
 *
 * @module
 */
import type {
  CandidateFile,
  PolicyFinding,
} from '@monochromatic-dev/git-policy-api/ts';
import nanoSpawn, { SubprocessError, } from 'nano-spawn';
import { ForbiddenStringsPluginError, } from './errors.ts';
import { materializeCandidates, } from './materialize-candidates.ts';
import { parseScannerOutput, } from './scanner-output.ts';

/**
 * Runs external scanner over exact candidate bytes.
 *
 * @param executable - PATH-resolved command or configured executable path
 *
 * @param repositoryRoot - scanner cwd controlling rules-file precedence
 *
 * @param candidates - exact Git candidates
 *
 * @param signal - engine cancellation signal
 *
 * @returns redacted policy findings
 *
 * @example
 * ```ts
 * await scanCandidates({ executable: 'forbidden-strings', repositoryRoot: '/repo', candidates: [], signal: new AbortController().signal });
 * ```
 */
export async function scanCandidates({
  executable,
  repositoryRoot,
  candidates,
  signal,
}: Readonly<{
  executable: string;
  repositoryRoot: string;
  candidates: readonly CandidateFile[];
  signal: AbortSignal;
}>): Promise<readonly PolicyFinding[]> {
  /**
   * Disposable exact scanner inputs.
   */
  await using materialized = await materializeCandidates(candidates,);
  if (materialized.paths
    .length
    === 0)
    return [];
  try {
    await nanoSpawn(
      executable,
      materialized.paths,
      {
        cwd: repositoryRoot,
        signal,
      },
    );
    return [];
  }
  catch (error: unknown) {
    if (!(error instanceof SubprocessError))
      throw error;
    if (error.exitCode === 1)
      return parseScannerOutput({
        stderr: error.stderr,
        candidateForPath: function candidateForPath(path,): CandidateFile {
          /**
           * Exact mapped candidate.
           */
          const candidate = materialized.candidatesByPath
            .get(path,);
          if (candidate === undefined)
            throw new ForbiddenStringsPluginError(`Forbidden-strings scanner reported unknown candidate: ${path}`,);
          return candidate;
        },
      },);
    if (error.signalName !== undefined)
      throw new ForbiddenStringsPluginError(
        `Forbidden-strings scanner was interrupted by ${error.signalName}.`,
        { cause: error, },
      );
    if (error.exitCode === undefined)
      throw new ForbiddenStringsPluginError(
        'Forbidden-strings scanner executable could not be started.',
        { cause: error, },
      );
    throw new ForbiddenStringsPluginError(
      `Forbidden-strings scanner exited with infrastructure status ${String(error.exitCode,)}.`,
      { cause: error, },
    );
  }
}
