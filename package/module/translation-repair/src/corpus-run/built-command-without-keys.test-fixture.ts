import { spawn, } from 'node:child_process';
import { once, } from 'node:events';
import { join, } from 'node:path';

//region Built command without keys
// RUNS A BUILT COMMAND IN A CHILD PROCESS whose environment holds no provider
// key and none of the package's own `TRANSLATION_REPAIR_` variables the
// runner's own environment carries, so a case can neither spend nor read the
// operator's runs, caches or clone whatever the process running the suite
// holds. A case names the variables its command reads, each at a scratch
// location it made.
//
// TEST SUPPORT, NOT PACKAGE SOURCE. The as-built suites of the report runners
// import this rather than each keeping a copy of the spawn.

/**
 Exit reported when the child ended on a signal and so has no code.
 */
const SIGNALLED = -1;

/**
 Package directory, where the mise tasks run a command from.
 */
const PACKAGE_DIRECTORY = join(
  import.meta.dirname,
  '../..',
);

/**
 What a built command wrote and how it exited.

 @example
 ```ts
 const run: BuiltCommandRun = { code: 0, stdout: 'ok\n', stderr: '', };
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
 Whether the runner's environment variable is one the child must not inherit:
 a provider key, or a variable the package reads its locations from.

 @param name - variable's name

 @returns True for a name ending in `_API_KEY` or starting `TRANSLATION_REPAIR_`

 @example
 ```ts
 withheldFromChild({ name: 'HYPER_API_KEY', },); // true
 ```
 */
function withheldFromChild({ name, }: { readonly name: string; },): boolean {
  return name.endsWith('_API_KEY',) || name.startsWith('TRANSLATION_REPAIR_',);
}

/**
 Runs a built command with every provider key withheld.

 @param command - built entry's name, such as `cap-census`

 @param args - arguments after it

 @param env - variables the command reads, each pointing at a scratch location
 the case made

 @param cwd - directory to run it from, the package directory when omitted

 @returns Exit code and both streams

 @example
 ```ts
 const run = await runBuiltWithoutKeys({ command: 'cap-census', args: [logPath,], env: {}, },);
 ```
 */
export async function runBuiltWithoutKeys(
  {
    command,
    args,
    env,
    cwd = PACKAGE_DIRECTORY,
  }: {
    readonly command: string;
    readonly args: readonly string[];
    readonly env: Readonly<Record<string, string>>;
    readonly cwd?: string;
  },
): Promise<BuiltCommandRun> {
  /**
   Runner environment with every provider key and every package location
   variable removed.
   */
  const inherited = Object.fromEntries(
    Object
      .entries(process.env,)
      .filter(function keepsNoKey([name,],): boolean {
        return !withheldFromChild({ name, },);
      },),
  );

  /**
   Child running the command.
   */
  const child = spawn(
    process.execPath,
    [
      join(
        PACKAGE_DIRECTORY,
        'dist/final/node',
        `${command}.mjs`,
      ),
      ...args,
    ],
    {
      cwd,
      env: {
        ...inherited,
        ...env,
      },
      stdio: [
        'ignore',
        'pipe',
        'pipe',
      ],
    },
  );

  /**
   Both streams as they arrive.
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

//endregion Built command without keys
