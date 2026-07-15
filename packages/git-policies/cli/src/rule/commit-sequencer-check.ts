import { access, } from 'node:fs/promises';

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

//region Sequencer-state check

/**
 * Whether a merge, cherry-pick, or revert is awaiting its concluding commit.
 * `none` also covers query failures (missing repository), because callers then
 * fall back to normal enforcement and real git surfaces its own error.
 */
export type SequencerState = 'in-progress' | 'none';

/**
 * Options for asking whether a merge/cherry-pick/revert is in progress.
 */
export type CheckSequencerInProgressOptions = {
  /**
   * Pre-subcommand global git options (`-C <path>`, `--git-dir <path>`, ...)
   * forwarded verbatim so the check inspects the same repository the commit
   * will run in.
   */
  readonly preSubcommandArgs: readonly string[];
};

/**
 * Signature of the sequencer-state checker consumed by the commit-only rule;
 * tests substitute fakes through {@link makeCommitOnly}.
 */
export type CheckSequencerInProgress = (
  options: CheckSequencerInProgressOptions,
) => Promise<SequencerState>;

/**
 * Git-dir files whose presence marks an operation awaiting a concluding
 * commit: a conflicted merge, cherry-pick, or revert. While any of them
 * exists, git forbids partial commits, so a pathless `git commit` is the
 * documented conclusion.
 */
const SEQUENCER_HEAD_FILES: readonly string[] = [
  'MERGE_HEAD',
  'CHERRY_PICK_HEAD',
  'REVERT_HEAD',
];

/**
 * Reports whether a path exists without throwing.
 *
 * @param path - Absolute filesystem path to probe.
 *
 * @returns `true` when path is accessible.
 *
 * @example
 * ```ts
 * await pathExists('/repo/.git/MERGE_HEAD');
 * // => true mid-merge
 * ```
 */
async function pathExists(path: string,): Promise<boolean> {
  /**
   * Tagged logger for sequencer head existence checks.
   */
  const rl = tagged({
    tag: pathExists.name,
    l,
  },);
  try {
    await access(path,);
    return true;
  }
  catch (error: unknown) {
    rl.debug(`sequencer head path is absent or inaccessible: ${String(error,)}`,);
    return false;
  }
}

/**
 * Asks real git whether a merge, cherry-pick, or revert is awaiting its
 * concluding commit, by resolving the absolute git-dir paths of the
 * {@link SEQUENCER_HEAD_FILES} and probing each with {@link pathExists}.
 * Spawns the real git binary resolved by {@link resolveGit} so the check does
 * not re-enter the wrapper.
 *
 * @param preSubcommandArgs - Pre-subcommand global options forwarded to git.
 *
 * @returns `'in-progress'` when any sequencer head file exists, `'none'`
 *   otherwise or when {@link SubprocessError} reports git cannot answer.
 *
 * @example
 * ```ts
 * await sequencerInProgress({ preSubcommandArgs: ['-C', '/repo'] });
 * // => 'in-progress' while /repo has a conflicted merge
 * ```
 */
export async function sequencerInProgress({
  preSubcommandArgs,
}: CheckSequencerInProgressOptions,): Promise<SequencerState> {
  /**
   * Tagged logger for the sequencer-state check.
   */
  const rl = tagged({
    tag: sequencerInProgress.name,
    l,
  },);
  /**
   * Absolute path to the real git binary.
   */
  const gitPath = await resolveGit();

  try {
    /**
     * Result whose stdout carries one absolute git-dir path per head file.
     */
    const result = await nanoSpawn(
      gitPath,
      [
        ...preSubcommandArgs,
        'rev-parse',
        '--path-format=absolute',
        ...SEQUENCER_HEAD_FILES.flatMap(function asGitPathFlag(headFile,) {
          return [
            '--git-path',
            headFile,
          ];
        },),
      ],
    );
    /**
     * Absolute paths of the sequencer head files, one per output line.
     */
    const headPaths = result.stdout
      .split('\n',)
      .filter(function isNonEmpty(line,) {
        return line !== '';
      },);
    /**
     * Existence of each sequencer head file, probed concurrently.
     */
    const present = await Promise.all(
      headPaths.map(function probeHeadPath(headPath,) {
        return pathExists(headPath,);
      },),
    );

    if (present.includes(true,)) {
      rl.debug('merge/cherry-pick/revert head file present',);
      return 'in-progress';
    }
    rl.debug('no sequencer head file present',);
    return 'none';
  }
  catch (error) {
    if (error instanceof SubprocessError) {
      rl.debug(
        `cannot determine sequencer state (exit code ${String(error.exitCode,)}); deferring to normal enforcement`,
      );
      return 'none';
    }
    throw error;
  }
}

//endregion Sequencer-state check
