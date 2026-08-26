/**
 * Boundary test for the window trial command.
 *
 * The command spends quota and is composition over modules with their own
 * suites, so what is checked here is the one thing only the built command can
 * show: launched without both provider keys it refuses as stated, exits 6, and
 * never reaches a call. The environment handed to the child carries no key, so
 * the case cannot spend anything whatever the runner's own environment holds.
 *
 * @module
 */

import { spawn, } from 'node:child_process';
import { once, } from 'node:events';
import { mkdtemp, } from 'node:fs/promises';
import { tmpdir, } from 'node:os';
import { join, } from 'node:path';

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

/**
 * Exit code `reportingRefusals` sets for a stated refusal.
 */
const REFUSED_AS_STATED = 6;

/**
 * Exit reported when the child ended on a signal and so has no code.
 */
const SIGNALLED = -1;

/**
 * Built command under test.
 */
const COMMAND = join(import.meta.dirname, '../../dist/final/node/window-trial-probe.mjs',);

/**
 * What the built command wrote and how it exited.
 *
 * @example
 * ```ts
 * const run: CommandRun = { code: 6, stderr: 'window-trial-probe: ...', };
 * ```
 */
type CommandRun = {
  /**
   * Exit code, or -1 when the process was signalled.
   */
  readonly code: number;

  /**
   * Everything written to stderr.
   */
  readonly stderr: string;
};

/**
 * Runs the built command with every provider key withheld and a disposable
 * runs directory.
 *
 * @returns Exit code and stderr
 *
 * @example
 * ```ts
 * const run = await runWithoutKeys();
 * ```
 */
async function runWithoutKeys(): Promise<CommandRun> {
  /**
   * Runner environment with every provider key removed, so the child can
   * neither refuse for the wrong reason nor spend.
   */
  const env = Object.fromEntries(
    Object
      .entries(process.env,)
      .filter(function keepsNoKey([name,],): boolean {
        return !name.endsWith('_API_KEY',);
      },),
  );

  /**
   * Child running the command against a throwaway runs directory.
   */
  const child = spawn(
    process.execPath,
    [COMMAND,],
    {
      cwd: join(import.meta.dirname, '../..',),
      env: {
        ...env,
        TRANSLATION_REPAIR_RUNS_DIR: await mkdtemp(join(tmpdir(), 'window-trial-probe-',),),
      },
      stdio: [
        'ignore',
        'ignore',
        'pipe',
      ],
    },
  );

  /**
   * Stderr as it arrives.
   */
  const written: string[] = [];

  /**
   * Child's stderr, the only stream piped.
   */
  const { stderr, } = child;
  stderr.setEncoding('utf8',);
  stderr.on('data', function keep(chunk: string,): void {
    written.push(chunk,);
  },);

  // Wait for the streams to close, then read the exit off the child itself.
  await once(child, 'close',);

  return {
    code: child.exitCode ?? SIGNALLED,
    stderr: written.join('',),
  };
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
