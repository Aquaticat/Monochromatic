import { createHash, } from 'node:crypto';
import {
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from 'node:fs/promises';
import { tmpdir, } from 'node:os';
import {
  dirname,
  join,
} from 'node:path';
import { fileURLToPath, } from 'node:url';
import spawn, { SubprocessError, } from 'nano-spawn';

/**
 * Tests consume the separately built bootstrap, never sibling implementation source.
 */
const CANDIDATE = fileURLToPath(new URL(
  '../../node_modules/.producer-bootstrap-candidate/producer-prepare.mjs',
  import.meta.url,
));
/**
 * A guard test cannot wait indefinitely for unintended native work.
 */
const CLI_TEST_TIMEOUT = 30_000;

/**
 * Unexpected execution failures cannot become untyped promise rejections.
 */
class InputCliCompletionError extends Error {
  /**
   * The class owns its fixed diagnostic and interpolates no rejected value.
   */
  readonly messageNamesOnly: true = true;
  /**
   * @example
   * ```ts
   * throw new InputCliCompletionError();
   * ```
   */
  constructor() {
    super('Native CLI completion did not provide an Error object.');
    this.name = 'InputCliCompletionError';
  }
}

/**
 * Disposable compiled CLI fixture shared only by tests.
 */
export type InputCliFixture = AsyncDisposable & {
  /**
   * Private fixture home and working directory.
   */
  readonly directory: string;
  /**
   * Copied compiled entry retains its required standalone filename.
   */
  readonly executable: string;
};

/**
 * Only ordinary native exits become assertion data; spawn errors and signals still throw.
 */
type InputCliResult = {
  /**
   * Zero or an actual nonzero process exit, never a timeout sentinel.
   */
  readonly status: number;
  /**
   * Captured stdout with nano-spawn's final newline normalization.
   */
  readonly stdout: string;
  /**
   * Captured stderr with nano-spawn's final newline normalization.
   */
  readonly stderr: string;
};

/**
 * Copies the built bootstrap into one disposable test home.
 *
 * @returns Isolated compiled CLI fixture
 *
 * @example
 * ```ts
 * await using fixture = await inputCliFixture();
 * ```
 */
export async function inputCliFixture(): Promise<InputCliFixture> {
  /**
   * Missing build output fails rather than skipping the test.
   */
  const bytes = await readFile(CANDIDATE);
  /**
   * Each test owns writable state without ambient application configuration.
   */
  const directory = await mkdtemp(join(
    tmpdir(),
    'preparation-cli-test-',
  ));
  /**
   * The only executed package file is the compiled standalone artifact.
   */
  const executable = join(
    directory,
    'producer-prepare.mjs',
  );
  await writeFile(executable, bytes, { mode: 0o400, flag: 'wx' });
  return {
    directory,
    executable,
    async [Symbol.asyncDispose](): Promise<void> {
      await rm(directory, { recursive: true, force: true });
    },
  };
}

/**
 * Invokes the compiled CLI with isolated environment and native argv.
 *
 * @param fixture - isolated compiled entry and home
 *
 * @param arguments_ - exact test tokens, never shell text
 *
 * @returns Ordinary exit and newline-normalized output for assertions
 *
 * @throws Error on spawn failure, timeout, signal or an unexpected execution failure
 *
 * @example
 * ```ts
 * const result = await inputCli({ fixture, arguments_: ['--help'] });
 * ```
 */
export async function inputCli({
  fixture,
  arguments_,
}: {
  readonly fixture: InputCliFixture;
  readonly arguments_: readonly string[];
}): Promise<InputCliResult> {
  /**
   * Nano-spawn merges environments; Node omits explicitly undefined entries.
   * Enumerate parent names without copying their values before adding the exact fixture environment.
   */
  const cleared = Object.fromEntries(Object.keys(process.env).map(function unset(name) {
    return [name, undefined] as const;
  }));
  try {
    /**
     * The existing asynchronous process utility owns native completion and captured streams.
     */
    const result = await spawn(
      process.execPath,
      [fixture.executable, ...arguments_],
      {
        cwd: fixture.directory,
        env: {
          ...cleared,
          HOME: fixture.directory,
          TMPDIR: fixture.directory,
          PATH: `${dirname(process.execPath)}:/usr/bin:/bin`,
        },
        stdin: 'ignore',
        timeout: CLI_TEST_TIMEOUT,
      },
    );
    return { status: 0, stdout: result.stdout, stderr: result.stderr };
  }
  catch (error) {
    if (!Error.isError(error))
      throw new InputCliCompletionError();
    if (!(error instanceof SubprocessError))
      throw error;
    /**
     * Only an ordinary exit may become assertion data; cancellation and native failures remain errors.
     */
    const { exitCode, signalName, isCanceled, } = error;
    if ((exitCode === undefined) || !Number.isSafeInteger(exitCode) || (exitCode <= 0)
      || (signalName !== undefined) || isCanceled)
      throw error;
    return { status: exitCode, stdout: error.stdout, stderr: error.stderr };
  }
}

/**
 * Writes fixture launch bytes and supplies their independently known identity.
 *
 * @param fixture - isolated fixture home
 *
 * @param bytes - owned test input, never corpus passages
 *
 * @returns Explicit launch argv
 *
 * @example
 * ```ts
 * const arguments_ = await inputLaunchArguments({ fixture, bytes: new TextEncoder().encode('{}') });
 * ```
 */
export async function inputLaunchArguments({ fixture, bytes, }: {
  readonly fixture: InputCliFixture;
  readonly bytes: Uint8Array;
}): Promise<readonly string[]> {
  /**
   * This file has no corpus or user configuration authority.
   */
  const path = join(fixture.directory, 'launch.json');
  await writeFile(path, bytes, { mode: 0o600, flag: 'wx' });
  return ['--launch', path, '--launch-sha256', createHash('sha256').update(bytes).digest('hex'), '--launch-bytes', String(bytes.length)];
}
