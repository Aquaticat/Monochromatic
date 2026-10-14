/**
 A disposable compiler executable exercises the built wrapper's real process boundary.

 @module
 */
import { spawnSync } from 'node:child_process';
import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { delimiter, join } from 'node:path';

/** Controlled compiler output distinguishes suppressed diagnostics from process failure. */
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
 const result = runCompilerFailureCase(fixtureCase);
 ```
 */
export function runCompilerFailureCase(input: CompilerFailureCase): {
  readonly status: number;
  readonly stdout: string;
  readonly stderr: string;
} {
  /** Private scratch persists across machine restarts while each case owns its directory. */
  const scratch = join(homedir(), 'temp', 'agent');
  mkdirSync(scratch, { recursive: true, mode: 0o700 });
  chmodSync(scratch, 0o700);
  /** Only this test's newly created directory is removed after the child exits. */
  const directory = mkdtempSync(join(scratch, 'tsc-filter-failure-'));
  /** Lexical cleanup also runs when process startup or an assertion fails. */
  using fixture = {
    [Symbol.dispose](): void { rmSync(directory, { recursive: true, force: true }); },
  };
  /** Compiler output crosses into JavaScript only through JSON string encoding. */
  const source = [
    '#!/usr/bin/env node',
    `process.stdout.write(${JSON.stringify(input.stdout)});`,
    `process.stderr.write(${JSON.stringify(input.stderr)});`,
    `process.exitCode = ${JSON.stringify(input.exitCode)};`,
    '',
  ].join('\n');
  writeFileSync(join(directory, 'tsc'), source, { mode: 0o700 });
  /** The emitted CLI is the same entry invoked by package lint tasks. */
  const entry = join(import.meta.dirname, '..', 'dist', 'final', 'node', 'tsc-filter.mjs');
  /** Only this child sees the disposable compiler ahead of the ambient executable search path. */
  const result = spawnSync(process.execPath, [entry, '--version'], {
    cwd: directory,
    encoding: 'utf8',
    env: { ...process.env, PATH: `${directory}${delimiter}${process.env.PATH ?? ''}` },
    timeout: 10_000,
    maxBuffer: 1_048_576,
  });
  if (result.error !== undefined) throw result.error;
  if (result.status === null) throw new Error('Compiler-wrapper fixture did not exit normally');
  return { status: result.status, stdout: result.stdout, stderr: result.stderr };
}
