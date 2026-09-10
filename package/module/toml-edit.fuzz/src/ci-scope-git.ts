/** Dependency-free Git boundary for the pre-install scope command. @module */

import { execFile, } from 'node:child_process';
import { promisify, } from 'node:util';

import { ScopeError, } from './ci-scope-error.ts';

/** Promise adapter retains execFile's nonzero-status and signal rejection behavior. */
const executeFile = promisify(execFile,);
/** Bound captured paths without silently truncating a comparison. */
const MAX_OUTPUT_BYTES = 16 * 1024 * 1024;
/** A stalled Git invocation must fail the scope step rather than wait indefinitely. */
const GIT_TIMEOUT_MILLISECONDS = 30_000;

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
    const result = await executeFile(
      'git',
      [...args,],
      {
        encoding: 'utf8',
        maxBuffer: MAX_OUTPUT_BYTES,
        timeout: GIT_TIMEOUT_MILLISECONDS,
      },
    );
    return result.stdout;
  }
  catch (error: unknown) {
    throw new ScopeError(
      `Cannot establish toml-edit scope: git ${args.join(' ',)} failed. No skip result was written.`,
      { cause: error, },
    );
  }
}
