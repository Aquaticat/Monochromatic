/**
 The one place a test starts a child process, so no child inherits a provider
 key.

 THE OWNER'S RULE: keys come from the repository's task runner, and a test's
 child must never inherit them. Every variable whose name ends in `_API_KEY`
 is removed from a child's environment, and so is every variable whose name
 starts with `TRANSLATION_REPAIR_`, so the machine's pool and clone settings
 cannot reach a child either: a case that wants one names it in `extra`.
 `nano-spawn` only adds to the parent's environment, so a removed name is
 stated with an `undefined` value, which its merge and node's own `spawn`
 both read as absent (`child-environment.unit.test.ts` shows it with real
 children). `test-children-keyless.unit.test.ts` fails any other test file
 that imports a spawning module or calls a spawning function.

 @module
 */

import { spawn, } from 'node:child_process';
import { once, } from 'node:events';
import { join, } from 'node:path';

import nanoSpawn, { type Result, } from 'nano-spawn';

/**
 Suffix of every variable that holds a credential.
 */
const KEY_SUFFIX = '_API_KEY';

/**
 Prefix of every variable the package reads for its own settings.
 */
const SETTING_PREFIX = 'TRANSLATION_REPAIR_';

/**
 Exit code reported when a child ended on a signal and so has none.
 */
const SIGNALLED = -1;

/**
 The package's directory, where built commands run unless a case says
 otherwise.
 */
const PACKAGE_ROOT = join(
  import.meta.dirname,
  '..',
);

/**
 Environment for a child: the parent's, with every variable the rule removes
 stated as absent, then the case's own variables.

 @param extra - variables the case sets for its child, which win over the
 removal so a case can hand one setting down by name

 @returns Environment for node's `spawn` and for `nano-spawn` alike

 @example
 ```ts
 const env = environmentWithoutKeys({ extra: { TRANSLATION_REPAIR_RUNS_DIR: runsDir, }, },);
 ```
 */
export function environmentWithoutKeys(
  { extra = {}, }: { readonly extra?: Readonly<Record<string, string>>; } = {},
): NodeJS.ProcessEnv {
  /**
   The parent's variables, each removed one stated as absent.
   */
  const kept: NodeJS.ProcessEnv = { ...process.env, };
  for (const name of Object.keys(kept,)) {
    if (name.endsWith(KEY_SUFFIX,) || name.startsWith(SETTING_PREFIX,))
      kept[name] = undefined;
  }
  return {
    ...kept,
    ...extra,
  };
}

/**
 Runs a program through `nano-spawn` with the keyless environment, as a case
 that wants the program's output and a refusal on any failed exit.

 @param file - program to run

 @param args - its arguments

 @param cwd - directory it runs in, the caller's own where absent

 @param extra - variables the case sets for it

 @returns Its result, whose output has the one final newline removed

 @throws SubprocessError when the program never started or exited with a failure

 @example
 ```ts
 const { stdout, } = await spawnKeyless({ file: 'git', args: ['status',], extra: { GIT_CONFIG_GLOBAL: devNull, }, },);
 ```
 */
export async function spawnKeyless(
  {
    file,
    args,
    cwd,
    extra = {},
  }: {
    readonly file: string;
    readonly args: readonly string[];
    readonly cwd?: string;
    readonly extra?: Readonly<Record<string, string>>;
  },
): Promise<Result> {
  return await nanoSpawn(
    file,
    args,
    {
      ...((cwd === undefined) ? {} : { cwd, }),
      env: environmentWithoutKeys({ extra, },),
    },
  );
}

/**
 What a child wrote and how it exited.

 @example
 ```ts
 const run: ChildRun = { code: 6, stdout: '', stderr: 'window-trial-probe: ...\n', };
 ```
 */
export type ChildRun = {
  /**
   Exit code, or -1 when the process was signalled.
   */
  readonly code: number;

  /**
   Everything written to stdout, whole.
   */
  readonly stdout: string;

  /**
   Everything written to stderr, whole.
   */
  readonly stderr: string;
};

/**
 Runs a program with the keyless environment and reports how it ended
 whatever its exit code, for a case that reads the finished process itself.

 @param file - program to run

 @param args - its arguments

 @param cwd - directory it runs in, the caller's own where absent

 @param extra - variables the case sets for it

 @returns Exit code, then stdout and stderr whole

 @throws Error when the process never started

 @example
 ```ts
 const done = await runKeyless({ file: process.execPath, args: [script,], cwd: scratch.path, },);
 ```
 */
export async function runKeyless(
  {
    file,
    args,
    cwd,
    extra = {},
  }: {
    readonly file: string;
    readonly args: readonly string[];
    readonly cwd?: string;
    readonly extra?: Readonly<Record<string, string>>;
  },
): Promise<ChildRun> {
  /**
   The child, its input closed.
   */
  const child = spawn(
    file,
    args,
    {
      ...((cwd === undefined) ? {} : { cwd, }),
      env: environmentWithoutKeys({ extra, },),
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
  child.stdout
    .setEncoding('utf8',);
  child.stdout
    .on(
      'data',
      function keepOut(chunk: string,): void {
        out.push(chunk,);
      },
    );
  child.stderr
    .setEncoding('utf8',);
  child.stderr
    .on(
      'data',
      function keepErr(chunk: string,): void {
        err.push(chunk,);
      },
    );
  // Wait for the streams to close, then read the exit off the child itself;
  // a process that never started rejects here.
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

/**
 Runs one built command (`dist/final/node/<command>.mjs`) with the keyless
 environment and reports how it ended whatever its exit code, for the
 as-built suites.

 @param command - command's name, which names its built file

 @param args - the command's arguments

 @param env - variables the case sets for it, such as the runs directory, the
 lookup cache directory or the corpus clone directory

 @param cwd - directory it runs in, the package's own where absent

 @returns Exit code, then stdout and stderr whole

 @throws Error when the process never started

 @example
 ```ts
 const run = await runBuiltCommand({ command: 'window-trial-probe', env: { TRANSLATION_REPAIR_RUNS_DIR: runsDir, }, },);
 ```
 */
export async function runBuiltCommand(
  {
    command,
    args = [],
    env = {},
    cwd = PACKAGE_ROOT,
  }: {
    readonly command: string;
    readonly args?: readonly string[];
    readonly env?: Readonly<Record<string, string>>;
    readonly cwd?: string;
  },
): Promise<ChildRun> {
  return await runKeyless({
    file: process.execPath,
    args: [
      join(
        PACKAGE_ROOT,
        'dist',
        'final',
        'node',
        `${command}.mjs`,
      ),
      ...args,
    ],
    cwd,
    extra: env,
  },);
}
