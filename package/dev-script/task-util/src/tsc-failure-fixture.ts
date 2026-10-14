/**
 A disposable compiler executable exercises the built wrapper's real process boundary.

 @module
 */
import { execFile } from 'node:child_process';
import {
  chmod,
  mkdir,
  mkdtemp,
  rm,
  writeFile
} from 'node:fs/promises';
import { homedir } from 'node:os';
import {
  delimiter,
  join
} from 'node:path';
import { promisify } from 'node:util';

/** Owner-only permissions apply to the private fixture directory and executable. */
const PRIVATE_MODE = 0o700;
/** Node's native process API preserves the wrapper's exact output bytes. */
const execute = promisify(execFile);

/**
 Controlled compiler output distinguishes suppressed diagnostics from process failure.
 */
export type CompilerFailureCase = {
  readonly name: string;
  readonly stdout: string;
  readonly stderr: string;
  readonly exitCode: number;
  readonly expectedCode: number;
  readonly expectedStdout: string;
  readonly expectedStderr: string;
};

/**
 Invoke the actual built wrapper against an executable compiler in a disposable working directory.

 @param input - fixed compiler streams and exit status
 
 @returns observed wrapper process result
 
 @throws Error when the wrapper process cannot start or fails to exit normally
 
 @example
 ```ts
 const result = await runCompilerFailureCase(fixtureCase);
 ```
 */
export async function runCompilerFailureCase(input: CompilerFailureCase): Promise<{
  readonly status: number;
  readonly stdout: string;
  readonly stderr: string;
}> {
  /**
   Private scratch persists across machine restarts while each case owns its directory.
   */
  const scratch = join(
    homedir(),
    'temp',
    'agent'
  );
  await mkdir(
    scratch,
    {
      recursive: true,
      mode: PRIVATE_MODE
    }
  );
  await chmod(
    scratch,
    PRIVATE_MODE
  );
  /**
   Only this test's newly created directory is removed after the child exits.
   */
  const directory = await mkdtemp(join(
    scratch,
    'tsc-filter-failure-'
  ));
  /**
   Lexical cleanup also runs when process startup or an assertion fails.
   */
  await using fixture = {
    async [Symbol.asyncDispose](): Promise<void> {
      await rm(directory, { recursive: true, force: true });
    },
  };
  /**
   Compiler output crosses into JavaScript only through JSON string encoding.
   */
  const source = [
    '#!/usr/bin/env node',
    `process.stdout.write(${JSON.stringify(input.stdout)});`,
    `process.stderr.write(${JSON.stringify(input.stderr)});`,
    `process.exitCode = ${JSON.stringify(input.exitCode)};`,
    '',
  ].join('\n');
  await writeFile(
    join(
      directory,
      'tsc'
    ),
    source,
    { mode: PRIVATE_MODE }
  );
  /**
   The emitted CLI is the same entry invoked by package lint tasks.
   */
  const entry = join(
    import.meta.dirname,
    '..',
    'dist',
    'final',
    'node',
    'tsc-filter.mjs'
  );
  /**
   Only this child sees the disposable compiler ahead of the ambient executable search path.
   */
  try {
  const result = await execute(
    process.execPath,
    [
      entry,
      '--version'
    ],
    {
    cwd: directory,
    encoding: 'utf8',
    env: {
      ...process.env,
      PATH: `${directory}${delimiter}${process.env
        .PATH
        ?? ''}`
    },
    timeout: 10_000,
    maxBuffer: 1_048_576,
  }
  );
  return {
    status: 0,
    stdout: result.stdout,
    stderr: result.stderr
  };
  } catch (error) {
    if ((error instanceof Error) && ('code' in error) && (typeof error.code === 'number')
      && ('stdout' in error) && (typeof error.stdout === 'string')
      && ('stderr' in error) && (typeof error.stderr === 'string'))
      return { status: error.code, stdout: error.stdout, stderr: error.stderr };
    throw error;
  }
}
