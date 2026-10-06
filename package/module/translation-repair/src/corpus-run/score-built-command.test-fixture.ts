/**
 Runs a built score command in a child process for the suites named
 "<runner> as built".

 The child's environment carries no variable whose name ends in `_API_KEY`
 and no other `TRANSLATION_REPAIR_` setting the runner could pick up from the
 machine, so a case can neither spend nor read the operator's runs. The runs
 directory is the one the case hands in, a directory it wrote itself.

 Fixtures are cat-themed invention. No corpus content appears here.

 @module
 */

import { spawn, } from 'node:child_process';
import { once, } from 'node:events';
import { join, } from 'node:path';

import { digestPipeline, } from '../../dist/final/node/index.mjs';

/**
 Exit reported when the child ended on a signal and so has no code.
 */
const SIGNALLED = -1;

/**
 What a built command wrote and how it exited.

 @example
 ```ts
 const run: BuiltRun = { code: 0, stdout: 'SOURCE /runs/artifacts\n', stderr: '', };
 ```
 */
type BuiltRun = {
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
 Path of a built command.

 @param name - runner name, which is the built file's name

 @returns Absolute path of the built `.mjs`

 @example
 ```ts
 const command = builtCommand({ name: 'score-verify', },);
 ```
 */
export function builtCommand({ name, }: { readonly name: string; },): string {
  return join(
    import.meta.dirname,
    '../../dist/final/node',
    `${name}.mjs`,
  );
}

/**
 Digest of the built output, which the pool prints as the pipeline that read it.

 @returns Digest text, as the pool's `POOL read by pipeline` line carries it

 @example
 ```ts
 const stamp = await builtPipelineDigest();
 ```
 */
export async function builtPipelineDigest(): Promise<string> {
  /**
   Stamp of the directory the built commands and the index sit in.
   */
  const { digest, } = await digestPipeline({
    dir: join(
      import.meta.dirname,
      '../../dist/final/node',
    ),
  },);
  return digest;
}

/**
 Runner environment without any key or any setting of the package, so the
 child can neither refuse for the wrong reason nor spend.

 @returns Environment entries the child may inherit

 @example
 ```ts
 const inherited = environmentWithoutKeys();
 ```
 */
function environmentWithoutKeys(): NodeJS.ProcessEnv {
  return Object.fromEntries(
    Object
      .entries(process.env,)
      .filter(function keepsNoKey([name,],): boolean {
        return !(name.endsWith('_API_KEY',) || name.startsWith('TRANSLATION_REPAIR_',));
      },),
  );
}

/**
 Runs a built score command against a runs directory the case wrote.

 @param command - built entry file, from `builtCommand`

 @param args - arguments after it

 @param runsDir - directory the case wrote, handed over as the runs directory

 @param setting - further settings the case sets for the child, by name

 @returns Exit code and both streams

 @example
 ```ts
 const run = await runBuiltScore({ command, args: [], runsDir: scratch.path, setting: {}, },);
 ```
 */
export async function runBuiltScore(
  {
    command,
    args,
    runsDir,
    setting,
  }: {
    readonly command: string;
    readonly args: readonly string[];
    readonly runsDir: string;
    readonly setting: Readonly<Record<string, string>>;
  },
): Promise<BuiltRun> {
  /**
   Child running the command.
   */
  const child = spawn(
    process.execPath,
    [
      command,
      ...args,
    ],
    {
      cwd: join(
        import.meta.dirname,
        '../..',
      ),
      env: {
        ...environmentWithoutKeys(),
        ...setting,
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
   Child's two piped streams.
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
