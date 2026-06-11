import nanoSpawn, { SubprocessError, } from 'nano-spawn';

import {
  l,
  tagged,
} from '../log.ts';
import { resolveGit, } from '../resolve-git.ts';

//region Index-vs-HEAD check

/**
 * Options for asking whether staged content differs from HEAD.
 */
export type CheckIndexDiffersFromHeadOptions = {
  /**
   * Pre-subcommand global git options (`-C <path>`, `--git-dir <path>`, ...)
   * forwarded verbatim so the check inspects the same repository the commit
   * will run in.
   */
  readonly preSubcommandArgs: readonly string[];
};

/**
 * Signature of the index-vs-HEAD checker consumed by the commit-only rule;
 * tests substitute fakes through `makeCommitOnly`.
 *
 * Resolves `true` when the index differs from HEAD, `false` when they match,
 * and `undefined` when git cannot answer (unborn HEAD, missing repository);
 * callers defer to real git to surface those failures.
 */
export type CheckIndexDiffersFromHead = (
  options: CheckIndexDiffersFromHeadOptions,
) => Promise<boolean | undefined>;

/**
 * Asks real git whether staged content differs from HEAD via
 * `git diff-index --quiet --cached HEAD --`, which exits 0 on a matching
 * index, 1 when staged changes exist, and other codes when the comparison
 * itself fails (for example before the first commit). Spawns the resolved
 * real git binary so the check does not re-enter the wrapper.
 *
 * @param options - Pre-subcommand global options forwarded to git.
 *
 * @returns `true` when staged changes exist, `false` when index matches
 *   HEAD, `undefined` when git cannot answer.
 *
 * @example
 * ```ts
 * await indexDiffersFromHead({ preSubcommandArgs: ['-C', '/repo'] });
 * // => true when /repo has staged changes
 * ```
 */
export const indexDiffersFromHead: CheckIndexDiffersFromHead = async function indexDiffersFromHead({
  preSubcommandArgs,
},) {
  /**
   * Tagged logger for the index-vs-HEAD check.
   */
  const rl = tagged({
    tag: 'indexDiffersFromHead',
    l,
  },);
  /**
   * Absolute path to the real git binary.
   */
  const gitPath = await resolveGit();

  try {
    await nanoSpawn(
      gitPath,
      [
        ...preSubcommandArgs,
        'diff-index',
        '--quiet',
        '--cached',
        'HEAD',
        '--',
      ],
    );
    rl.debug('index matches HEAD',);
    return false;
  }
  catch (error) {
    if (error instanceof SubprocessError) {
      if (error.exitCode === 1) {
        rl.debug('index differs from HEAD',);
        return true;
      }
      rl.debug(
        `cannot determine index state (exit code ${String(error.exitCode,)}); deferring to real git`,
      );
      return undefined;
    }
    throw error;
  }
};

//endregion Index-vs-HEAD check
