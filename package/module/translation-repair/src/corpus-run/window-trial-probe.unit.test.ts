/**
 Boundary test for the window trial command.

 The command spends quota and is composition over modules with their own
 suites, so what is checked here is the one thing only the built command can
 show: launched without both provider keys it refuses as stated, exits 6, and
 never reaches a call. The environment handed to the child carries no key, so
 the case cannot spend anything whatever the runner's own environment holds.

 @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import { runBuiltCommand, } from '../child-environment.test-fixture.ts';
import { scratchDir, } from '../scratch-dir.test-fixture.ts';

/**
 Exit code `reportingRefusals` sets for a stated refusal.
 */
const REFUSED_AS_STATED = 6;

/**
 What the built command wrote and how it exited.

 @example
 ```ts
 const run: CommandRun = { code: 6, stderr: 'window-trial-probe: ...', };
 ```
 */
type CommandRun = {
  /**
   Exit code, or -1 when the process was signalled.
   */
  readonly code: number;

  /**
   Everything written to stderr.
   */
  readonly stderr: string;
};

/**
 Runs the built command with every provider key withheld and a disposable
 runs directory.

 @returns Exit code and stderr

 @example
 ```ts
 const run = await runWithoutKeys();
 ```
 */
async function runWithoutKeys(): Promise<CommandRun> {
  /**
   Throwaway runs directory the child points at, removed once this function's
   `await using` scope ends (after the child's streams close).
   */
  await using scratch = await scratchDir({ prefix: 'window-trial-probe-', },);

  /**
   The command as it ended; the shared fixture removes every provider key
   from the child's environment, so the child can neither refuse for the
   wrong reason nor spend.
   */
  const run = await runBuiltCommand({
    command: 'window-trial-probe',
    env: { TRANSLATION_REPAIR_RUNS_DIR: scratch.path, },
  },);

  return run;
}

await describe({
  name: 'window-trial-probe',
  children: [
    it({
      name: 'REFUSES as stated and exits 6 when launched without both provider keys, before any call',
      fn: async () => {
        const run = await runWithoutKeys();

        expect(run.code,).toBe(REFUSED_AS_STATED,);
        expect(run.stderr,).toContain('window-trial-probe: ',);
        expect(run.stderr,).toContain('_API_KEY is not set',);
      },
    },),
  ],
},);
