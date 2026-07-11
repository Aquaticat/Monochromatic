/**
 * Disposable packed-package fixture for lifecycle latency benchmarks.
 *
 * @module
 */

import {
  chmod,
  mkdir,
  writeFile,
} from 'node:fs/promises';
import { join, } from 'node:path';
import { execute, } from './lifecycle-latency-command.ts';
import {
  BENCHMARK_FILE,
  DIRECT_COMMIT_REPOSITORY,
  MJS_REPOSITORY,
  NO_CONFIG_REPOSITORY,
  PACKAGE_BIN,
  REAL_GIT,
  SCANNER_PATH,
  TREE_FILE_COUNT,
  TREE_WRITE_BATCH_SIZE,
  TYPESCRIPT_REPOSITORY,
} from './lifecycle-latency-contracts.ts';

/**
 * Executable mode for synthetic scanner.
 */
const EXECUTABLE_MODE = 0o755;
/**
 * Decimal width for deterministic tree names.
 */
const TREE_NAME_WIDTH = 5;

/**
 * Prepared environment needed by measured scenarios.
 */
export type LifecycleFixture = Readonly<{
  /**
   * Exact relaxed-mode environment entry for TypeScript config.
   */
  relaxedEnvironment: Readonly<Record<string, string>>;
}>;

/**
 * Initializes one repository and author identity.
 *
 * @param path - repository path
 */
async function initializeRepository(path: string,): Promise<void> {
  await mkdir(
    path,
    { recursive: true, },
  );
  await execute({
    command: REAL_GIT,
    args: [
      'init',
      '--quiet',
      '--initial-branch=main',
    ],
    cwd: path,
  },);
  await execute({
    command: REAL_GIT,
    args: [
      'config',
      'user.email',
      'cli-git-benchmark@example.invalid',
    ],
    cwd: path,
  },);
  await execute({
    command: REAL_GIT,
    args: [
      'config',
      'user.name',
      'cli-git benchmark',
    ],
    cwd: path,
  },);
}

/**
 * Writes bounded repository-scale tracked tree.
 *
 * @param repository - target repository
 */
async function writeTrackedTree(repository: string,): Promise<void> {
  /**
   * Root containing repository-scale tracked files.
   */
  const treeRoot = join(
    repository,
    'tree',
  );
  await mkdir(
    treeRoot,
    { recursive: true, },
  );
  /**
   * Deterministic tracked file paths.
   */
  const paths = Array.from(
    { length: TREE_FILE_COUNT, },
    function treePath(
      _unused,
      index,
    ) {
      return join(
        treeRoot,
        `${String(index,)
          .padStart(
            TREE_NAME_WIDTH,
            '0'
          )}.txt`,
      );
    },
  );
  /**
   * Ordered starts for bounded write batches.
   */
  const batchStarts = Array.from(
    { length: Math.ceil(paths.length / TREE_WRITE_BATCH_SIZE,), },
    function batchStart(
      _unused,
      index,
    ) {
      return index * TREE_WRITE_BATCH_SIZE;
    },
  );
  await batchStarts.reduce(
    async function writeSequentialBatch(
      previous,
      start,
    ) {
      await previous;
      await Promise.all(paths
        .slice(
          start,
          start + TREE_WRITE_BATCH_SIZE,
        )
        .map(async function writeTrackedPath(path,) {
          await writeFile(
            path,
            'tracked\n',
          );
        },),);
    },
    Promise.resolve(),
  );
}

/**
 * Commits complete fixture baseline through real Git.
 *
 * @param repository - target repository
 */
async function commitBaseline(repository: string,): Promise<void> {
  await execute({
    command: REAL_GIT,
    args: [
      'add',
      '--all',
    ],
    cwd: repository,
  },);
  await execute({
    command: REAL_GIT,
    args: [
      'commit',
      '--quiet',
      '--message=baseline',
    ],
    cwd: repository,
  },);
}

/**
 * Prepares package installation, trusted configs, and equivalent repositories.
 *
 * @returns reusable benchmark fixture facts
 *
 * @example
 * ```ts
 * await prepareLifecycleFixture();
 * ```
 */
export async function prepareLifecycleFixture(): Promise<LifecycleFixture> {
  await writeFile(
    SCANNER_PATH,
    `#!${process.execPath}\nprocess.exitCode = 0;\n`,
  );
  await chmod(
    SCANNER_PATH,
    EXECUTABLE_MODE,
  );

  await initializeRepository(NO_CONFIG_REPOSITORY,);
  await writeFile(
    join(
      NO_CONFIG_REPOSITORY,
      BENCHMARK_FILE,
    ),
    'baseline\n',
  );
  await commitBaseline(NO_CONFIG_REPOSITORY,);

  await initializeRepository(MJS_REPOSITORY,);
  await writeFile(
    join(
      MJS_REPOSITORY,
      BENCHMARK_FILE,
    ),
    'baseline\n',
  );
  await writeFile(
    join(
      MJS_REPOSITORY,
      'cli-git.config.mjs',
    ),
    'export default { policies: {} };\n',
  );
  await commitBaseline(MJS_REPOSITORY,);
  await execute({
    command: PACKAGE_BIN,
    args: [
      'cli-git',
      'trust',
      '--yes',
    ],
    cwd: MJS_REPOSITORY,
  },);

  await initializeRepository(TYPESCRIPT_REPOSITORY,);
  await writeTrackedTree(TYPESCRIPT_REPOSITORY,);
  await writeFile(
    join(
      TYPESCRIPT_REPOSITORY,
      BENCHMARK_FILE,
    ),
    'baseline\n',
  );
  await writeFile(
    join(
      TYPESCRIPT_REPOSITORY,
      'cli-git.config.ts',
    ),
    `import { defineConfig, forbiddenStringsPlugin } from '@monochromatic-dev/cli-git';
export default defineConfig({
  plugins: { security: forbiddenStringsPlugin },
  policies: {
    'security/forbidden-strings': ['error', { executable: '${SCANNER_PATH}' }],
  },
});
`,
  );
  await commitBaseline(TYPESCRIPT_REPOSITORY,);
  await execute({
    command: PACKAGE_BIN,
    args: [
      'cli-git',
      'trust',
      '--yes',
    ],
    cwd: TYPESCRIPT_REPOSITORY,
  },);

  await execute({
    command: REAL_GIT,
    args: [
      'clone',
      '--quiet',
      TYPESCRIPT_REPOSITORY,
      DIRECT_COMMIT_REPOSITORY,
    ],
    cwd: '/work',
  },);
  await execute({
    command: REAL_GIT,
    args: [
      'remote',
      'remove',
      'origin',
    ],
    cwd: DIRECT_COMMIT_REPOSITORY,
  },);
  await execute({
    command: REAL_GIT,
    args: [
      'config',
      'user.email',
      'cli-git-benchmark@example.invalid',
    ],
    cwd: DIRECT_COMMIT_REPOSITORY,
  },);
  await execute({
    command: REAL_GIT,
    args: [
      'config',
      'user.name',
      'cli-git benchmark',
    ],
    cwd: DIRECT_COMMIT_REPOSITORY,
  },);

  /**
   * Unknown JSON trust-status boundary.
   */
  const trustStatus: unknown = JSON.parse(await execute({
    command: PACKAGE_BIN,
    args: [
      'cli-git',
      'status',
    ],
    cwd: TYPESCRIPT_REPOSITORY,
  },),);
  if (((typeof trustStatus) !== 'object') || (trustStatus === null)
    || (!('filesystemId' in trustStatus))
    || ((typeof trustStatus.filesystemId) !== 'string'))
    throw new TypeError('TypeScript trust status omitted filesystem identity.',);
  return {
    relaxedEnvironment: {
      CLI_GIT_NO_PARANOID: `${trustStatus.filesystemId}:${join(
        TYPESCRIPT_REPOSITORY,
        'cli-git.config.ts',
      )}`,
    },
  };
}
