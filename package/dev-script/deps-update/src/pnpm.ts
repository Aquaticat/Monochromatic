/**
 Captured-output pnpm invocations used by the diagnosis.

 The runner is a parameter everywhere it is used so tests substitute a fake
 that simulates pnpm's file writes without network access.

 @module
 */

import spawn, { SubprocessError, } from 'nano-spawn';

import { tagged, } from '@monochromatic-dev/module-logger/ts';

/**
 Module logger for pnpm invocations.
 */
const l = tagged({ tag: 'deps-update/pnpm', },);

//region Types

/**
 Runs pnpm with arguments in a directory and returns its stdout.
 */
export type RunPnpm = (options: {
  readonly args: readonly string[];
  readonly cwd: string;
},) => Promise<string>;

//endregion Types

//region Errors

/**
 Thrown when a captured pnpm invocation exits unsuccessfully.
 */
export class PnpmCommandError extends Error {
  /**
   Builds the error with the command line and pnpm's stderr.

   @param args - pnpm arguments that failed

   @param cwd - directory pnpm ran in

   @param stderr - pnpm's captured standard error

   @param cause - underlying subprocess error

   @example
   ```ts
   throw new PnpmCommandError({ args: ['why', 'a'], cwd: '/repo', stderr: '', cause });
   ```
   */
  constructor({
    args,
    cwd,
    stderr,
    cause,
  }: {
    readonly args: readonly string[];
    readonly cwd: string;
    readonly stderr: string;
    readonly cause: unknown;
  },) {
    super(`pnpm ${args.join(' ',)} failed in ${cwd}:\n${stderr}`, { cause, },);
    this.name = 'PnpmCommandError';
  }
}

//endregion Errors

//region Runner

/**
 Default {@link RunPnpm}: spawns the `pnpm` on `PATH` with piped output.

 @param args - pnpm arguments

 @param cwd - working directory

 @returns pnpm's stdout

 @throws PnpmCommandError when pnpm exits nonzero or cannot start

 @example
 ```ts
 await runPnpm({ args: ['config', 'get', 'registry'], cwd: process.cwd() });
 ```
 */
export async function runPnpm({
  args,
  cwd,
}: {
  readonly args: readonly string[];
  readonly cwd: string;
},): Promise<string> {
  const rl = tagged({ tag: runPnpm.name, l, },);
  rl.debug(`pnpm ${args.join(' ',)} (cwd ${cwd})`,);
  try {
    /**
     Completed subprocess result.
     */
    const result = await spawn('pnpm', [...args,], { cwd, },);
    return result.stdout;
  }
  catch (error) {
    if (!(error instanceof SubprocessError))
      throw error;
    rl.debug(`pnpm exited ${String(error.exitCode,)}`,);
    throw new PnpmCommandError({
      args,
      cwd,
      stderr: error.stderr,
      cause: error,
    },);
  }
}

//endregion Runner
