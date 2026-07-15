/**
 * User-facing output emitted after successful real Git invocation.
 *
 * @module
 */
import { parseGlobalOptions, } from './parse-global-options.ts';
import { hasExplicitStatusHintsOverride, } from './rule/status-hints-off.ts';

/**
 * Git flags that request version output before subcommand.
 */
const VERSION_FLAGS: ReadonlySet<string> = new Set([
  '--version',
  '-v',
],);
/**
 * Status flags that produce machine-readable output.
 */
const STATUS_MACHINE_READABLE_FLAGS: ReadonlySet<string> = new Set([
  '--porcelain',
  '-s',
  '--short',
  '-z',
],);

/**
 * Prints wrapper version or human status note when applicable.
 *
 * @param rawArgs - exact user arguments
 *
 * @param processedArgs - final transformed arguments
 *
 * @example
 * ```ts
 * printPostCommandOutput({ rawArgs: ['version'], processedArgs: ['version'] });
 * ```
 */
export function printPostCommandOutput({
  rawArgs,
  processedArgs,
}: Readonly<{
  rawArgs: readonly string[];
  processedArgs: readonly string[];
}>,): void {
  /**
   * Final transformed command layout.
   */
  const layout = parseGlobalOptions(processedArgs,);
  /**
   * Final subcommand.
   */
  const subcommand = processedArgs[layout.subcommandIndex];
  /**
   * Global options preceding subcommand.
   */
  const preSubcommand = processedArgs.slice(
    0,
    layout.subcommandIndex,
  );
  /**
   * Arguments following subcommand.
   */
  const postSubcommand = processedArgs.slice(layout.subcommandIndex + 1,);
  /**
   * Whether invocation requests Git version.
   */
  const isVersionRequest = (subcommand === 'version')
    || preSubcommand.some(function isVersionFlag(arg,) {
      return VERSION_FLAGS.has(arg,);
    },);
  /**
   * Whether status output must remain machine-readable.
   */
  const isStatusMachineReadable = postSubcommand.some(function isMachineReadableFlag(arg,) {
    return STATUS_MACHINE_READABLE_FLAGS.has(arg,)
      || arg.startsWith('--porcelain=',);
  },);
  /**
   * Whether caller explicitly controls stock Git status hints.
   */
  const userOverrodeStatusHints = hasExplicitStatusHintsOverride(rawArgs,);
  /**
   * Whether human-readable status note is applicable.
   */
  const shouldPrintStatusNote = (subcommand === 'status')
    && (!isStatusMachineReadable)
    && (!userOverrodeStatusHints);
  if (isVersionRequest) {
    console.log(
      'cli-git wrapper (require-root, linked-worktree-only, branch-worktree-only, '
        + 'add-explicit, atomic-push, commit-only, status-hints-off, auto-push)',
    );
    return;
  }
  if (shouldPrintStatusNote) {
    console.log(
      'cli-git: bulk-add patterns (`.`, `*`, `-A`, `-u`), `git commit -a`, '
        + 'and current-worktree branch creation are rejected; stage with `git add <path>`, '
        + 'commit with `git commit -m <msg> <path>`, and branch with '
        + '`git worktree add -b <branch> <path>`.',
    );
  }
}
