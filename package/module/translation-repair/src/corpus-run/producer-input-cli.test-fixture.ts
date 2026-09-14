import { execFile, } from 'node:child_process';
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

/**
 * Tests consume the separately built bootstrap, never sibling implementation source.
 */
const CANDIDATE = fileURLToPath(new URL(
  '../../node_modules/.producer-bootstrap-candidate/producer-prepare.mjs',
  import.meta.url
));
/**
 * A guard test cannot wait indefinitely for unintended native work.
 */
const CLI_TEST_TIMEOUT = 30_000;
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
   * Complete captured CLI output.
   */
  readonly stdout: string;
  /**
   * Complete captured names-only refusal output.
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
    'preparation-cli-test-'
  ));
  /**
   * The only executed package file is the compiled standalone artifact.
   */
  const executable = join(
    directory,
    'producer-prepare.mjs'
  );
  await writeFile(
    executable,
    bytes,
    {
      mode: 0o400,
      flag: 'wx'
    }
  );
  return {
    directory,
    executable,
    async [Symbol.asyncDispose](): Promise<void> {
      await rm(
        directory,
        {
          recursive: true,
          force: true
        }
      );
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
 * @returns Ordinary process exit and captured output for assertions
 *
 * @throws Error on spawn failure, timeout, signal or an unexpected native error shape
 *
 * @example
 * ```ts
 * const result = await inputCli({ fixture, arguments_: ['--help'] });
 * ```
 */
export function inputCli({
  fixture,
  arguments_,
}: {
  readonly fixture: InputCliFixture;
  readonly arguments_: readonly string[];
}): Promise<InputCliResult> {
  /**
   * Native completion owns both output streams and the ordinary-exit versus execution-failure distinction.
   */
  const {
    promise,
    resolve,
    reject,
  } = Promise.withResolvers<InputCliResult>();
  execFile(
    process.execPath,
    [
      fixture.executable,
      ...arguments_
    ],
    {
      cwd: fixture.directory,
      env: {
        HOME: fixture.directory,
        TMPDIR: fixture.directory,
        PATH: `${dirname(process.execPath)}:/usr/bin:/bin`,
      },
      encoding: 'utf8',
      timeout: CLI_TEST_TIMEOUT,
    },
    /**
     * Error-first completion preserves both streams even for a deliberate CLI refusal.
     *
     * @param error - native outcome narrowed from unknown, without copying a nullish API type
     *
     * @param stdout - captured output from this exact invocation
     *
     * @param stderr - captured diagnostics from this exact invocation
     */
    function completed(
      error: unknown,
      stdout: string,
      stderr: string,
    ): void {
      if (error === null) {
        resolve({
          status: 0,
          stdout,
          stderr,
        });
        return;
      }
      if ((!Error.isError(error)) || (!('code' in error)) || (!('signal' in error))) {
        reject(error);
        return;
      }
      /**
       * Own the primitive exit code before rejecting spawn failures or signal termination.
       */
      const { code, } = error;
      if (((typeof code) !== 'number') || (!Number.isSafeInteger(code))
        || (code <= 0)
        || (error.signal !== null)) {
        reject(error);
        return;
      }
      resolve({
        status: code,
        stdout,
        stderr,
      });
    },
  );
  return promise;
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
export async function inputLaunchArguments({
  fixture,
  bytes,
}: {
  readonly fixture: InputCliFixture;
  readonly bytes: Uint8Array;
}): Promise<readonly string[]> {
  /**
   * This file has no corpus or user configuration authority.
   */
  const path = join(
    fixture.directory,
    'launch.json'
  );
  await writeFile(
    path,
    bytes,
    {
      mode: 0o600,
      flag: 'wx'
    }
  );
  return [
    '--launch',
    path,
    '--launch-sha256',
    createHash('sha256')
      .update(bytes)
      .digest('hex'),
    '--launch-bytes',
    String(bytes.length)
  ];
}
