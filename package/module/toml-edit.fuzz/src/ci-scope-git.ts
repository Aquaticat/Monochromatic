/** Dependency-free Git boundary for the pre-install scope command. @module */

import { execFile, } from 'node:child_process';
import { promisify, } from 'node:util';

import { ScopeError, } from './ci-scope-error.ts';

/** Bound captured paths without silently truncating a comparison. */
const MAX_OUTPUT_BYTES = 16_777_216;
/** A stalled Git invocation must fail the scope step rather than wait indefinitely. */
const GIT_TIMEOUT_MILLISECONDS = 30_000;

/**
 * Promise adapter exposes only stdout; the ChildProcess handle is not part of this boundary.
 * The callback position is dictated by Node's promisify API.
 */
const executeGit = promisify(function executeGitCallback(
  args: readonly string[],
  callback: (error: unknown, stdout: string) => void,
): void {
  execFile(
    'git',
    [...args,],
    { encoding: 'utf8', maxBuffer: MAX_OUTPUT_BYTES, timeout: GIT_TIMEOUT_MILLISECONDS, },
    callback,
  );
},);

/**
 * Run Git without a shell and preserve every execution failure.
 *
 * @param args - Argument vector whose values cannot become shell syntax.
 * @returns Complete stdout only after a successful Git invocation.
 * @throws {@link ScopeError} When Git fails, stalls, or exceeds the capture limit.
 * @example
 * ```ts
 * const head = await scopeGit(['rev-parse', '--verify', 'HEAD^{commit}']);
 * ```
 */
export async function scopeGit(args: readonly string[],): Promise<string> {
  console.log(`Scope Git: ${args.join(' ',)}`,);
  try {
    /** Successful command result; execFile rejects failed commands before this assignment. */
    const stdout = await executeGit(args,);
    return stdout;
  }
  catch (error: unknown) {
    throw new ScopeError(
      `Cannot establish toml-edit scope: git ${args.join(' ',)} failed. No skip result was written.`,
      { cause: error, },
    );
  }
}
