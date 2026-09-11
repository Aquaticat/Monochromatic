import { execFile, } from 'node:child_process';
import { promisify, } from 'node:util';
import { resolveGit, } from '@monochromatic-dev/git-policy-cli/ts/resolve-git.ts';
import { tagged, } from '@monochromatic-dev/module-logger/ts';
import { ArchiveNamingEvidenceError, } from './archive-naming-error.ts';
import {
  CORPUS_GIT_FLAGS,
  corpusGitEnvironment,
} from './corpus-git-context.ts';
import type { CorpusPin, } from './corpus-source.ts';

//region Literal pinned Git reads
// No shell, replacement objects, text conversion, external diff or author-data logs.

/**
 * Archive history acquisition logger.
 */
const l = tagged({ tag: 'archive-naming-git', },);
/**
 * Byte-preserving capture; line-oriented subprocess helpers lose final newlines.
 */
// oxlint-disable-next-line typescript/strict-void-return -- promisify ignores execFile's ChildProcess return while adapting its callback
const execFileAsync = promisify(execFile,);
/**
 * Binary units used by the bounded subprocess buffer.
 */
const KIBI = 1_024;
/**
 * Maximum metadata output accepted from one history command.
 */
const MAX_METADATA_MEBIBYTES = 16;
/**
 * Byte ceiling; exceeding it is a read failure rather than truncated evidence.
 */
const MAX_METADATA_BYTES = MAX_METADATA_MEBIBYTES * KIBI
  * KIBI;

/**
 * Captures one literal Git history command without changing repository state.
 *
 * @param pin - immutable repository and commit context
 *
 * @param relPath - archive named in any failure
 *
 * @param args - known read-only argument vector
 *
 * @param signal - cancellation shared with entry preparation
 *
 * @returns Complete raw stdout; parsers normalize document lines using physical EOF evidence
 *
 * @throws {@link ArchiveNamingEvidenceError} when capture fails or exceeds its bound
 *
 * @example
 * ```ts
 * const shallow = await archiveGitOutput({ pin, relPath, args: ['rev-parse', '--is-shallow-repository'] });
 * ```
 */
export async function archiveGitOutput({
  pin,
  relPath,
  args,
  signal,
}: {
  readonly pin: CorpusPin;
  readonly relPath: string;
  readonly args: readonly string[];
  readonly signal?: AbortSignal;
},): Promise<string> {
  /**
   * Function-tagged logger records operations, never captured history metadata.
   */
  const rl = tagged({
    tag: archiveGitOutput.name,
    l,
  },);
  signal?.throwIfAborted();
  /**
   * Native Git rather than a command-policy shim.
   */
  const gitPath = pin.gitPath ?? await resolveGit();
  rl.debug(`reading ${args[0] ?? 'unknown operation'} for ${relPath}`,);
  try {
    /**
     * Complete bounded command output.
     */
    const result = await execFileAsync(
      gitPath,
      [
        ...CORPUS_GIT_FLAGS,
        '-C',
        pin.cloneDir,
        '-c',
        'core.quotePath=false',
        '-c',
        'color.ui=false',
        ...args,
      ],
      {
      encoding: 'utf8',
      maxBuffer: MAX_METADATA_BYTES,
      env: corpusGitEnvironment(),
      ...(signal === undefined ? {} : { signal, }),
    },
    );
    rl.debug(`received ${String(Buffer.byteLength(result.stdout,),)} metadata bytes`,);
    return result.stdout;
  }
  catch (cause) {
    rl.warn('history command did not complete; retaining its cause',);
    signal?.throwIfAborted();
    throw new ArchiveNamingEvidenceError({
      kind: 'history-read',
      relPath,
      cause,
    },);
  }
}

//endregion Literal pinned Git reads
