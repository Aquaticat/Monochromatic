/**
 Disposable repositories for the concurrent-commit throughput benchmark.

 Every repository tracks {@link DISJOINT_FILE_COUNT} disjoint files and one shared file,
 carries a trusted `cli-git.config.mjs` holding only the concurrency keys its scenario varies,
 and has no remote,
 so auto-push stays out of the measurement.

 @module
 */
import {
  chmod,
  mkdir,
  writeFile,
} from 'node:fs/promises';
import { join, } from 'node:path';
import { execute, } from './lifecycle-latency-command.ts';
import {
  CONCURRENT_ROOT,
  DISJOINT_FILE_COUNT,
  PACKAGE_BIN,
  REAL_GIT,
  SHARED_FILE_LINES,
  SLOW_HOOK_SECONDS,
} from './concurrent-commit-latency-contracts.ts';

/**
 Executable mode for the slow hook.
 */
const EXECUTABLE_MODE = 0o755;

/**
 Repository-relative shared file edited by same-file and conflicting scenarios.
 */
export const SHARED_FILE = 'shared.txt';

/**
 One repository variant's configuration.
 */
export type RepositoryVariant = Readonly<{
  /**
   Directory name under {@link CONCURRENT_ROOT}.
   */
  name: string;
  /**
   Exact `cli-git.config.mjs` source, or no config for the direct-Git baseline.
   */
  config?: string;
  /**
   Whether the repository gets the slow `pre-commit` hook.
   */
  slowHook?: boolean;
}>;

/**
 Repository-relative path of one disjoint file.

 @param index - zero-based commit slot

 @returns disjoint file path

 @example
 ```ts
 disjointFile(3); // 'files/f-3.txt'
 ```
 */
export function disjointFile(index: number,): string {
  return join(
    'files',
    `f-${String(index,)}.txt`,
  );
}

/**
 Absolute repository path of one variant.

 @param name - variant name

 @returns repository path

 @example
 ```ts
 repositoryPath('default'); // '/work/concurrent/default'
 ```
 */
export function repositoryPath(name: string,): string {
  return join(
    CONCURRENT_ROOT,
    name,
  );
}

/**
 Shared file lines before any edit.

 @returns shared file lines

 @example
 ```ts
 sharedBaselineLines()[0]; // 'line 0'
 ```
 */
export function sharedBaselineLines(): readonly string[] {
  return Array.from(
    { length: SHARED_FILE_LINES, },
    function sharedLine(
      _unused,
      index,
    ) {
      return `line ${String(index,)}`;
    },
  );
}

/**
 Runs real Git in one repository.

 @param repository - repository path

 @param args - Git arguments

 @returns trimmed stdout
 */
async function realGit({
  repository,
  args,
}: Readonly<{
  repository: string;
  args: readonly string[];
}>,): Promise<string> {
  return await execute({
    command: REAL_GIT,
    args,
    cwd: repository,
  },);
}

/**
 Creates, commits, and trusts one repository variant.

 @param variant - repository variant

 @returns repository path

 @example
 ```ts
 await prepareRepository({ name: 'default', config: 'export default {};\n' });
 ```
 */
export async function prepareRepository(variant: RepositoryVariant,): Promise<string> {
  /**
   Repository path.
   */
  const repository = repositoryPath(variant.name,);
  await mkdir(
    join(
      repository,
      'files',
    ),
    { recursive: true, },
  );
  await realGit({
    repository,
    args: [
      'init',
      '--quiet',
      '--initial-branch=main',
    ],
  },);
  await realGit({
    repository,
    args: [
      'config',
      'user.email',
      'cli-git-benchmark@example.invalid',
    ],
  },);
  await realGit({
    repository,
    args: [
      'config',
      'user.name',
      'cli-git benchmark',
    ],
  },);
  await Promise.all(Array.from(
    { length: DISJOINT_FILE_COUNT, },
    async function writeDisjoint(
      _unused,
      index,
    ): Promise<void> {
      await writeFile(
        join(
          repository,
          disjointFile(index,),
        ),
        'baseline\n',
      );
    },
  ),);
  await writeFile(
    join(
      repository,
      SHARED_FILE,
    ),
    `${sharedBaselineLines()
      .join('\n',)}\n`,
  );
  if (variant.config !== undefined)
    await writeFile(
      join(
        repository,
        'cli-git.config.mjs',
      ),
      variant.config,
    );
  await realGit({
    repository,
    args: [
      'add',
      '--all',
    ],
  },);
  await realGit({
    repository,
    args: [
      'commit',
      '--quiet',
      '--message=baseline',
    ],
  },);
  if (variant.slowHook === true) {
    /**
     Hook path inside the Git directory.
     */
    const hookPath = join(
      repository,
      '.git',
      'hooks',
      'pre-commit',
    );
    await writeFile(
      hookPath,
      `#!/bin/sh\nexec sleep ${SLOW_HOOK_SECONDS}\n`,
    );
    await chmod(
      hookPath,
      EXECUTABLE_MODE,
    );
  }
  if (variant.config !== undefined)
    await execute({
      command: PACKAGE_BIN,
      args: [
        'cli-git',
        'trust',
        '--yes',
      ],
      cwd: repository,
    },);
  return repository;
}
