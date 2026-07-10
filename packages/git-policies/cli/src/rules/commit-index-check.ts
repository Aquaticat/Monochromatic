import nanoSpawn, { SubprocessError, } from 'nano-spawn';
import { tagged, } from '@monochromatic-dev/module-logger/ts';

import { resolveGit, } from '../resolve-git.ts';

/**
 * Logger root for cli-git after removing the package log shim.
 *
 * @example
 * ```ts
 * const rl = tagged({ tag: someFunction.name, l, },);
 * ```
 */
const l = tagged({ tag: 'cli-git', },);

//region Index-vs-HEAD check

/**
 * Comparison of staged content against HEAD. `unknown` means git could not
 * answer (unborn HEAD, missing repository); callers defer to real git to
 * surface those failures.
 */
export type IndexVsHeadState = 'differs' | 'matches' | 'unknown';

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
 * tests substitute fakes through {@link makeCommitOnly}.
 */
export type CheckIndexDiffersFromHead = (
  options: CheckIndexDiffersFromHeadOptions,
) => Promise<IndexVsHeadState>;

/**
 * Asks real git whether staged content differs from HEAD via
 * `git diff-index --quiet --cached HEAD --`, which exits 0 on a matching
 * index, 1 when staged changes exist, and other codes when the comparison
 * itself fails (for example before the first commit). Spawns the real git
 * binary resolved by {@link resolveGit} so the check does not re-enter the
 * wrapper.
 *
 * @param preSubcommandArgs - Pre-subcommand global options forwarded to git.
 *
 * @returns `'differs'` when staged changes exist, `'matches'` when index
 *   equals HEAD, `'unknown'` when {@link SubprocessError} reports a code other
 *   than `1` and git cannot answer.
 *
 * @example
 * ```ts
 * await indexDiffersFromHead({ preSubcommandArgs: ['-C', '/repo'] });
 * // => 'differs' when /repo has staged changes
 * ```
 */
export async function indexDiffersFromHead({
  preSubcommandArgs,
}: CheckIndexDiffersFromHeadOptions,): Promise<IndexVsHeadState> {
  /**
   * Tagged logger for the index-vs-HEAD check.
   */
  const rl = tagged({
    tag: indexDiffersFromHead.name,
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
    return 'matches';
  }
  catch (error) {
    if (error instanceof SubprocessError) {
      if (error.exitCode === 1) {
        rl.debug('index differs from HEAD',);
        return 'differs';
      }
      rl.debug(
        `cannot determine index state (exit code ${String(error.exitCode,)}); deferring to real git`,
      );
      return 'unknown';
    }
    throw error;
  }
}

//endregion Index-vs-HEAD check
