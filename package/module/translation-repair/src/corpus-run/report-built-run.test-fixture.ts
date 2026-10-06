import { spawn, } from 'node:child_process';
import { once, } from 'node:events';
import { join, } from 'node:path';

//region Report built run
// RUNS A BUILT REPORT COMMAND IN A CHILD PROCESS THAT HOLDS NO PROVIDER KEY.
//
// The environment handed to the child is the runner's own with every variable
// whose name ends in `_API_KEY` removed, so a case can neither refuse for the
// wrong reason nor spend, whatever the runner's own environment holds. The runs
// directory is the one the case names, never the operator's. The reports of
// this family read files and print, so nothing here needs more than that.

/**
 Exit reported when the child ended on a signal and so has no code.
 */
const SIGNALLED = -1;

/**
 What a built command wrote and how it exited.

 @example
 ```ts
 const run: BuiltReportRun = { code: 0, stdout: 'meter-report: ...\n', stderr: '', };
 ```
 */
type BuiltReportRun = {
  /**
   Exit code, or -1 when the process was signalled.
   */
  readonly code: number;

  /**
   Everything written to stdout.
   */
  readonly stdout: string;

  /**
   Everything written to stderr.
   */
  readonly stderr: string;
};

/**
 Runs one built report command with every provider key withheld.

 @param command - runner's name, which names `dist/final/node/<command>.mjs`

 @param args - command line after the script

 @param runsDir - directory the child takes for its runs directory

 @returns Exit code and both streams

 @example
 ```ts
 const run = await runBuiltReport({ command: 'meter-report', args: [path,], runsDir: scratch.path, },);
 ```
 */
export async function runBuiltReport(
  {
    command,
    args,
    runsDir,
  }: {
    readonly command: string;
    readonly args: readonly string[];
    readonly runsDir: string;
  },
): Promise<BuiltReportRun> {
  /**
   Runner environment with every provider key removed.
   */
  const env = Object.fromEntries(
    Object
      .entries(process.env,)
      .filter(function keepsNoKey([name,],): boolean {
        return !name.endsWith('_API_KEY',);
      },),
  );

  /**
   Child running the built command against the named runs directory.
   */
  const child = spawn(
    process.execPath,
    [
      join(
        import.meta.dirname,
        '../../dist/final/node',
        `${command}.mjs`,
      ),
      ...args,
    ],
    {
      cwd: join(
        import.meta.dirname,
        '../..',
      ),
      env: {
        ...env,
        TRANSLATION_REPAIR_RUNS_DIR: runsDir,
      },
      stdio: [
        'ignore',
        'pipe',
        'pipe',
      ],
    },
  );

  /**
   Stdout as it arrives.
   */
  const out: string[] = [];

  /**
   Stderr as it arrives.
   */
  const err: string[] = [];

  /**
   Child's streams, both piped.
   */
  const {
    stdout,
    stderr,
  } = child;
  stdout.setEncoding('utf8',);
  stdout.on(
    'data',
    function keepOut(chunk: string,): void {
      out.push(chunk,);
    },
  );
  stderr.setEncoding('utf8',);
  stderr.on(
    'data',
    function keepErr(chunk: string,): void {
      err.push(chunk,);
    },
  );

  // Wait for the streams to close, then read the exit off the child itself.
  await once(
    child,
    'close',
  );

  return {
    code: child.exitCode ?? SIGNALLED,
    stdout: out.join('',),
    stderr: err.join('',),
  };
}

//endregion Report built run
