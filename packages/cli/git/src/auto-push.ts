import nanoSpawn, { SubprocessError, } from 'nano-spawn';

import {
  l,
  tagged,
} from './log.ts';

//region Auto-push output filter

/**
 * Prefix marking the GitHub server-side messages worth surfacing after a clean
 * push (banner notices, pull-request hints). Git relays these from the remote's
 * receive hooks and prints them verbatim as `remote: <text>` on stderr.
 */
const REMOTE_LINE_PREFIX = 'remote: ';

/**
 * Push argv used to back up the just-created commit. `--set-upstream origin
 * HEAD` creates the upstream branch on first push and only re-points the
 * already-correct upstream on later pushes, so one command serves both.
 */
const AUTO_PUSH_ARGS: readonly string[] = [
  'push',
  '--set-upstream',
  'origin',
  'HEAD',
];

/**
 * Argv that prints the `origin` remote URL, used only to detect whether an
 * origin exists; a non-zero exit means there is nothing to back up to.
 */
const ORIGIN_URL_ARGS: readonly string[] = [
  'remote',
  'get-url',
  'origin',
];

/**
 * Selects which push output to surface: on a clean push only the GitHub
 * `remote:` lines, on a failed push the full interleaved output so a rejection,
 * a forbidden-strings block, or an offline error stays diagnosable.
 *
 * @param output - Interleaved stdout and stderr captured from push.
 *
 * @param exitCode - Push exit code; any non-zero value surfaces full output.
 *
 * @returns Text to surface; empty string when a clean push emitted no `remote:` lines.
 *
 * @example
 * ```ts
 * filterPushOutput({ output: 'remote: hi\nTo origin', exitCode: 0 });
 * // => 'remote: hi'
 * ```
 */
export function filterPushOutput({
  output,
  exitCode,
}: {
  readonly output: string;
  readonly exitCode: number;
},): string {
  if (exitCode !== 0)
    return output;

  return output
    .split('\n',)
    .filter(function isRemoteLine(line,): boolean {
      return line.startsWith(REMOTE_LINE_PREFIX,);
    },)
    .join('\n',);
}

//endregion Auto-push output filter

//region Auto-push orchestration

/**
 * Outcome of one auto-push attempt: `skipped` when no origin exists, `pushed`
 * on a clean push, `failed` when git rejected or could not reach the remote.
 */
export type AutoPushOutcome = 'skipped' | 'pushed' | 'failed';

/**
 * Result of one auto-push attempt: what happened, the push exit code, and the
 * text surfaced to the terminal.
 */
export type AutoPushResult = {
  /**
   * Which branch the auto-push took.
   */
  readonly outcome: AutoPushOutcome;
  /**
   * Push exit code; `0` when skipped or pushed, git's code (or `1`) on failure.
   */
  readonly exitCode: number;
  /**
   * Text surfaced to stderr; empty on a skip or a quiet clean push.
   */
  readonly shown: string;
};

/**
 * Reports whether the repository has an `origin` remote to back up to.
 *
 * @param gitPath - Absolute path to real git binary.
 *
 * @param cwd - Directory query runs in, matching where commit landed.
 *
 * @returns `true` when `git remote get-url origin` exits zero.
 *
 * @example
 * ```ts
 * await originExists({ gitPath: '/usr/bin/git', cwd: '/repo' });
 * // => true
 * ```
 */
async function originExists({
  gitPath,
  cwd,
}: {
  readonly gitPath: string;
  readonly cwd: string;
},): Promise<boolean> {
  try {
    await nanoSpawn(
      gitPath,
      [...ORIGIN_URL_ARGS,],
      { cwd, },
    );
    return true;
  }
  catch (error) {
    if (!(error instanceof SubprocessError))
      throw error;

    return false;
  }
}

/**
 * Pushes the just-created commit to its upstream, then surfaces a filtered view
 * of the push: only GitHub `remote:` lines on success, the full output on
 * failure. Always invoked with the real git binary, so it does not re-enter the
 * cli-git wrapper, yet the push still fires git's native pre-push hook.
 *
 * Auto-push is skipped when no `origin` exists, since there is nowhere to back
 * up to. The commit has already happened by the time this runs, and git ignores
 * a post-commit hook's exit status, so a failed backup push is surfaced in the
 * output but never changes the commit command's exit code; the caller leaves
 * `process.exitCode` untouched on a failed push.
 *
 * Raw `console.error` rather than a tagged logger is intentional: the surfaced
 * lines must be exactly git's output with no tag prefixes, matching how the
 * wrapper prints its other user-facing notes.
 *
 * @param gitPath - Absolute path to real git binary resolved by wrapper.
 *
 * @param cwd - Directory push runs in: effective cwd after `-C` chaining.
 *
 * @returns Outcome, exit code, and surfaced text of push.
 *
 * @throws When git fails for a reason nano-spawn does not model as a {@link SubprocessError}.
 *
 * @example
 * ```ts
 * await autoPush({ gitPath: '/usr/bin/git', cwd: '/repo' });
 * ```
 */
export async function autoPush({
  gitPath,
  cwd,
}: {
  readonly gitPath: string;
  readonly cwd: string;
},): Promise<AutoPushResult> {
  /**
   * Tagged logger for the auto-push step.
   */
  const rl = tagged({
    tag: autoPush.name,
    l,
  },);

  if (!(await originExists({
    gitPath,
    cwd,
  },))) {
    rl.debug('no origin remote; skipping auto-push',);
    return {
      outcome: 'skipped',
      exitCode: 0,
      shown: '',
    };
  }

  rl.debug('auto-pushing committed work to origin HEAD',);

  try {
    /**
     * Successful push result carrying interleaved output.
     */
    const result = await nanoSpawn(
      gitPath,
      [...AUTO_PUSH_ARGS,],
      { cwd, },
    );
    /**
     * Only the GitHub `remote:` lines from this clean push.
     */
    const shown = filterPushOutput({
      output: result.output,
      exitCode: 0,
    },);

    if (shown)
      console.error(shown,);

    return {
      outcome: 'pushed',
      exitCode: 0,
      shown,
    };
  }
  catch (error) {
    if (!(error instanceof SubprocessError))
      throw error;

    /**
     * Push exit code; absent code (spawn failure or signal) counts as failure.
     */
    const exitCode = error.exitCode
      ?? 1;
    /**
     * Full push output so the failure reason stays visible.
     */
    const shown = filterPushOutput({
      output: error.output,
      exitCode,
    },);

    if (shown)
      console.error(shown,);

    console.error(
      'cli-git: commit saved locally, but auto-push to origin failed; run `git push` when ready.',
    );

    return {
      outcome: 'failed',
      exitCode,
      shown,
    };
  }
}

//endregion Auto-push orchestration
