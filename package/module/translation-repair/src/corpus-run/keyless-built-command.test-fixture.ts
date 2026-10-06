import { spawn, } from 'node:child_process';
import { once, } from 'node:events';
import { join, } from 'node:path';

//region Keyless built command
// RUNS A BUILT RUNNER IN A CHILD PROCESS THAT CARRIES NO PROVIDER KEY, so a
// case can read what the real command prints and how it exits without any
// chance of a call leaving the machine, whatever the parent's own
// environment holds.
//
// TEST SUPPORT, NOT PACKAGE SOURCE. The environment is the parent's with
// every variable whose name ends in `_API_KEY` removed, and the three places
// a runner reads from the operator's machine (the runs directory, the lookup
// cache and the corpus clone) point at directories the case owns.

/**
 Exit reported when the child ended on a signal and so has no code.
 */
const SIGNALLED = -1;

/**
 What the built command wrote and how it exited.

 @example
 ```ts
 const run: BuiltCommandRun = { code: 6, stdout: '', stderr: 'probe-sensitivity: ...\n', };
 ```
 */
type BuiltCommandRun = {
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
 Parent environment with every provider key removed.

 @returns Environment entries whose names do not end in `_API_KEY`

 @example
 ```ts
 const env = environmentWithoutKeys();
 ```
 */
function environmentWithoutKeys(): Record<string, string> {
  return Object.fromEntries(
    Object
      .entries(process.env,)
      .flatMap(function keepsNoKey([name, value,],): readonly (readonly [
        string,
        string,
      ])[] {
        return (name.endsWith('_API_KEY',) || (value === undefined))
          ? []
          : [
            [
              name,
              value,
            ],
          ];
      },),
  );
}

/**
 The whole stderr a runner leaves when it reaches its first call with no
 provider key set: the stated refusal `createRunClient` raises, as
 `reportingRefusals` prints it.

 @param command - name of the built runner, which starts the line

 @returns The refusal line with its newline

 @example
 ```ts
 expect(run.stderr,).toBe(noKeyRefusal({ command: 'probe-sensitivity', },),);
 ```
 */
export function noKeyRefusal({ command, }: { readonly command: string; },): string {
  return `${command}: TRANSLATION_REPAIR_SYNTHETIC_API_KEY, TRANSLATION_REPAIR_CHARM_HYPER_API_KEY, `
    + 'TRANSLATION_REPAIR_AMAZON_BEDROCK_API_KEY or TRANSLATION_REPAIR_OPENROUTER_API_KEY is not set; '
    + 'run under mise so sops injects it\n';
}

/**
 Runs one built runner with every provider key withheld.

 @param command - name of the built runner, as `build-entries.ts` names it

 @param runsDir - directory the child treats as its runs directory, owned by
 the calling case

 @param scratchDir - directory the child's lookup cache and corpus clone
 variables point under, so neither names the operator's own

 @param args - arguments after the script, none by default

 @returns Exit code and both streams

 @example
 ```ts
 const run = await runBuiltWithoutKeys({ command: 'probe-sensitivity', runsDir, scratchDir, },);
 ```
 */
export async function runBuiltWithoutKeys(
  {
    command,
    runsDir,
    scratchDir,
    args = [],
  }: {
    readonly command: string;
    readonly runsDir: string;
    readonly scratchDir: string;
    readonly args?: readonly string[];
  },
): Promise<BuiltCommandRun> {
  /**
   Child running the built command with no key in its environment.
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
        ...environmentWithoutKeys(),
        TRANSLATION_REPAIR_RUNS_DIR: runsDir,
        TRANSLATION_REPAIR_LOOKUP_CACHE_DIR: join(
          scratchDir,
          'lookup-cache',
        ),
        TRANSLATION_REPAIR_CORPUS_CLONE_DIR: join(
          scratchDir,
          'corpus-clone',
        ),
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
   The child's two piped streams.
   */
  const {
    stdout,
    stderr,
  } = child;
  stdout.setEncoding('utf8',);
  stderr.setEncoding('utf8',);
  stdout.on(
    'data',
    function keepOut(chunk: string,): void {
      out.push(chunk,);
    },
  );
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

//endregion Keyless built command
