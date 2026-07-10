import nanoSpawn, { SubprocessError, } from 'nano-spawn';
import { tagged, } from '@monochromatic-dev/module-logger/ts';

/**
 * Logger root for cli-git after removing the package log shim.
 *
 * @example
 * ```ts
 * const rl = tagged({ tag: someFunction.name, l, },);
 * ```
 */
const l = tagged({ tag: 'cli-git', },);

//region Auto-push output filter

/**
 * Prefix marking the GitHub server-side messages worth surfacing after a clean
 * push (banner notices, pull-request hints). Git relays these from the remote's
 * receive hooks and prints them verbatim as `remote: <text>` on stderr.
 */
const REMOTE_LINE_PREFIX = 'remote: ';

/**
 * Push argv used when the current branch has no upstream yet:
 * `--set-upstream origin HEAD` creates the branch on origin and records it
 * as the upstream. Branches that already have an upstream are pushed with
 * {@link UPSTREAM_PUSH_ARGS} instead, so an upstream pointing at another
 * remote is never silently re-pointed to origin.
 */
const AUTO_PUSH_ARGS: readonly string[] = [
  'push',
  '--set-upstream',
  'origin',
  'HEAD',
];

/**
 * Push argv used when the current branch already has an upstream: a plain
 * push follows the configured upstream (whatever remote it lives on) and
 * leaves the branch's tracking configuration untouched.
 */
const UPSTREAM_PUSH_ARGS: readonly string[] = ['push',];

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
 * Argv that resolves the current branch's configured upstream; a non-zero
 * exit means no upstream is configured (or HEAD is detached).
 */
const UPSTREAM_NAME_ARGS: readonly string[] = [
  'rev-parse',
  '--abbrev-ref',
  '--symbolic-full-name',
  '@{upstream}',
];

/**
 * Argv that resolves HEAD as a symbolic ref; a non-zero exit means HEAD is
 * detached (mid-rebase, mid-bisect, or a detached checkout).
 */
const SYMBOLIC_HEAD_ARGS: readonly string[] = [
  'symbolic-ref',
  '--quiet',
  'HEAD',
];

/**
 * Note surfaced when auto-push is skipped because HEAD is detached: pushing
 * `HEAD` requires a branch, and detached commits (rebase or cherry-pick
 * conflict resolution, detached experiments) have no upstream to back up to.
 */
const DETACHED_HEAD_NOTE =
  'cli-git: HEAD is detached (mid-rebase/cherry-pick or a detached checkout); skipping auto-push.';

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
 * Outcome of one auto-push attempt: `skipped` when there is nowhere to back
 * up to (no upstream and no origin) or HEAD is detached, `pushed` on a clean
 * push, `failed` when git rejected or could not reach the remote.
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
 * Reports whether a read-only git query exits zero in given directory. Used
 * for the yes/no probes auto-push needs: does origin exist, is an upstream
 * configured, is HEAD on a branch.
 *
 * @param gitPath - Absolute path to real git binary.
 *
 * @param cwd - Directory query runs in, matching where commit landed.
 *
 * @param args - Read-only git argv to probe with.
 *
 * @returns `true` when query exits zero.
 *
 * @throws When the probe fails for a reason nano-spawn does not model as a {@link SubprocessError}.
 *
 * @example
 * ```ts
 * await gitQuerySucceeds({
 *   gitPath: '/usr/bin/git',
 *   cwd: '/repo',
 *   args: ['remote', 'get-url', 'origin'],
 * });
 * // => true
 * ```
 */
async function gitQuerySucceeds({
  gitPath,
  cwd,
  args,
}: {
  readonly gitPath: string;
  readonly cwd: string;
  readonly args: readonly string[];
},): Promise<boolean> {
  try {
    await nanoSpawn(
      gitPath,
      [...args,],
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
 * Pushes the just-created commit to its upstream, then surfaces a
 * {@link filterPushOutput filtered view} of the push: only GitHub `remote:`
 * lines on success, the full output on failure. Always invoked with the real
 * git binary, so it does not re-enter the cli-git wrapper, yet the push still
 * fires git's native pre-push hook.
 *
 * A branch with a configured upstream is pushed plainly, following that
 * upstream wherever it lives; `--set-upstream origin HEAD` is used only when
 * no upstream exists yet, so a branch tracking another remote never has its
 * tracking configuration silently re-pointed to origin. Auto-push is skipped
 * silently when {@link gitQuerySucceeds} finds nowhere to back up to (no
 * upstream and no `origin`), and skipped with a printed note when HEAD is
 * detached (mid-rebase, mid-cherry-pick, or a detached checkout), where
 * pushing `HEAD` cannot work.
 * The commit has already happened by the time this runs, and git ignores
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

  /**
   * Whether the current branch already has a configured upstream; `false`
   * also covers detached HEAD, where `@{upstream}` cannot resolve.
   */
  const hasUpstream = await gitQuerySucceeds({
    gitPath,
    cwd,
    args: UPSTREAM_NAME_ARGS,
  },);

  if ((!hasUpstream) && (!(await gitQuerySucceeds({
    gitPath,
    cwd,
    args: ORIGIN_URL_ARGS,
  },)))) {
    rl.debug('no upstream and no origin remote; skipping auto-push',);
    return {
      outcome: 'skipped',
      exitCode: 0,
      shown: '',
    };
  }

  if (!(await gitQuerySucceeds({
    gitPath,
    cwd,
    args: SYMBOLIC_HEAD_ARGS,
  },))) {
    console.error(DETACHED_HEAD_NOTE,);
    return {
      outcome: 'skipped',
      exitCode: 0,
      shown: DETACHED_HEAD_NOTE,
    };
  }

  /**
   * Push argv chosen by upstream state: plain push follows an existing
   * upstream, first push creates the branch on origin.
   */
  const pushArgs = hasUpstream
    ? UPSTREAM_PUSH_ARGS
    : AUTO_PUSH_ARGS;

  rl.debug(
    hasUpstream
      ? 'auto-pushing committed work to its configured upstream'
      : 'auto-pushing committed work to origin HEAD with --set-upstream',
  );

  try {
    /**
     * Successful push result carrying interleaved output.
     */
    const result = await nanoSpawn(
      gitPath,
      [...pushArgs,],
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
