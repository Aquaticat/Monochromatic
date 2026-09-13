import {
  spawnSync,
  type SpawnSyncReturns,
} from 'node:child_process';
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
 * A CLI guard test cannot indefinitely wait for an unintended filesystem or subprocess operation.
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
   * Copied compiled entry retains the required standalone filename.
   */
  readonly executable: string;
};

/**
 * Copies the actual built bootstrap into one disposable test home.
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
   * Missing build output fails loud rather than skipping a CLI test.
   */
  const bytes = await readFile(CANDIDATE);
  /**
   * Each test receives independent writable state and no ambient application configuration.
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
 * Invokes the compiled CLI with an isolated home and native argv, never shell interpolation.
 *
 * @param fixture - isolated compiled entry and home
 *
 * @param arguments_ - exact test tokens
 *
 * @returns Native process result for ordinary status and diagnostic assertions
 *
 * @example
 * ```ts
 * const result = inputCli({ fixture, arguments_: ['--help'] });
 * ```
 */
export function inputCli({
  fixture,
  arguments_,
}: {
  readonly fixture: InputCliFixture;
  readonly arguments_: readonly string[]
},): SpawnSyncReturns<string> {
  return spawnSync(
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
      PATH: `${dirname(process.execPath)}:/usr/bin:/bin`
    },
    encoding: 'utf8',
    timeout: CLI_TEST_TIMEOUT,
  }
  );
}

/**
 * Writes fixture launch bytes and supplies their independently known identity to the CLI.
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
  readonly bytes: Uint8Array
},): Promise<readonly string[]> {
  /**
   * This fixture file has no corpus or user configuration authority.
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
