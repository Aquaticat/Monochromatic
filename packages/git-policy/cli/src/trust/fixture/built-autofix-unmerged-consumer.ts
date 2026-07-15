/**
 * Packed unmerged-index autofix rejection verification.
 *
 * @module
 */
import {
  readFile,
  writeFile,
} from 'node:fs/promises';
import {
  assertIncludes,
  execute,
} from './built-consumer-helpers.ts';
import { assertFixtureEqual, } from './built-post-commit-helpers.ts';

/**
 * Exercises unmerged index rejection without real-state mutation.
 *
 * @param repository - initialized trusted autofix repository
 *
 * @param env - packed shadow environment
 *
 * @example
 * ```ts
 * await verifyAutofixUnmerged({ repository: '/work/repo', env: process.env });
 * ```
 */
export async function verifyAutofixUnmerged({
  repository,
  env,
}: Readonly<{
  repository: string;
  env: NodeJS.ProcessEnv;
}>,): Promise<void> {
  await execute({
    command: '/usr/bin/git',
    args: [
      'branch',
      'conflict-feature',
    ],
    cwd: repository,
  },);
  await execute({
    command: '/usr/bin/git',
    args: [
      'checkout',
      '--quiet',
      'conflict-feature',
    ],
    cwd: repository,
  },);
  await writeFile(
    `${repository}/conflict.txt`,
    'feature conflict\n',
  );
  await execute({
    command: '/usr/bin/git',
    args: [
      'add',
      'conflict.txt',
    ],
    cwd: repository,
  },);
  await execute({
    command: '/usr/bin/git',
    args: [
      'commit',
      '--quiet',
      '-m',
      'feature conflict',
    ],
    cwd: repository,
  },);
  await execute({
    command: '/usr/bin/git',
    args: [
      'checkout',
      '--quiet',
      'main',
    ],
    cwd: repository,
  },);
  await writeFile(
    `${repository}/conflict.txt`,
    'main conflict\n',
  );
  await execute({
    command: '/usr/bin/git',
    args: [
      'add',
      'conflict.txt',
    ],
    cwd: repository,
  },);
  await execute({
    command: '/usr/bin/git',
    args: [
      'commit',
      '--quiet',
      '-m',
      'main conflict',
    ],
    cwd: repository,
  },);
  await execute({
    command: '/usr/bin/git',
    args: [
      'merge',
      '--no-commit',
      '--no-ff',
      'conflict-feature',
    ],
    expectedExit: 1,
    cwd: repository,
  },);
  /**
   * Exact unmerged index before wrapper rejection.
   */
  const unmergedIndex = Buffer.from(await readFile(`${repository}/.git/index`,))
    .toString('base64',);
  /**
   * Stable wrapper rejection.
   */
  const unmerged = await execute({
    command: 'git',
    args: [
      'commit',
      '--quiet',
      '-m',
      'unmerged blocked',
    ],
    expectedExit: 2,
    cwd: repository,
    env,
  },);
  assertIncludes({
    text: unmerged.stderr,
    expected: 'unmerged index paths',
    context: 'unmerged rejection',
  },);
  assertFixtureEqual({
    actual: Buffer.from(await readFile(`${repository}/.git/index`,))
      .toString('base64',),
    expected: unmergedIndex,
    context: 'unmerged real index',
  },);
  await execute({
    command: '/usr/bin/git',
    args: [
      'merge',
      '--abort',
    ],
    cwd: repository,
  },);
}
