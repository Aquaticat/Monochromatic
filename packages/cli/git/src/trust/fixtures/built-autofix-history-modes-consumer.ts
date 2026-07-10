/**
 * Packed history-changing commit-mode autofix verification.
 *
 * @module
 */
import { writeFile, } from 'node:fs/promises';
import { execute, } from './built-consumer-helpers.ts';
import { assertFixtureEqual, } from './built-post-commit-helpers.ts';

/**
 * Reads exact Git object text.
 *
 * @param repository - disposable repository
 *
 * @param revision - Git object expression
 *
 * @returns exact text
 */
async function gitText({
  repository,
  revision,
}: Readonly<{
  repository: string;
  revision: string;
}>,): Promise<string> {
  return (await execute({
    command: '/usr/bin/git',
    args: [
      'show',
      revision,
    ],
    cwd: repository,
  },)).stdout;
}

/**
 * Exercises amend, allow-empty, and merge conclusion.
 *
 * @param repository - initialized trusted autofix repository
 *
 * @param env - packed shadow environment
 *
 * @example
 * ```ts
 * await verifyAutofixHistoryModes({ repository: '/work/repo', env: process.env });
 * ```
 */
export async function verifyAutofixHistoryModes({
  repository,
  env,
}: Readonly<{
  repository: string;
  env: NodeJS.ProcessEnv;
}>,): Promise<void> {
  /**
   * Explicit-path amend replaces HEAD while preserving its parent.
   */
  const beforeAmend = (await execute({
    command: '/usr/bin/git',
    args: [
      'rev-parse',
      'HEAD',
    ],
    cwd: repository,
  },)).stdout
    .trim();
  /**
   * Parent expected after amend replacement.
   */
  const expectedAmendParent = (await execute({
    command: '/usr/bin/git',
    args: [
      'rev-parse',
      'HEAD^',
    ],
    cwd: repository,
  },)).stdout
    .trim();
  await writeFile(
    `${repository}/selected.txt`,
    'bad\n',
  );
  await writeFile(
    `${repository}/amend-marker.txt`,
    'amend marker\n',
  );
  await execute({
    command: 'git',
    args: [
      'commit',
      '--amend',
      '--quiet',
      '-m',
      'amended autofix',
      'selected.txt',
      'amend-marker.txt',
    ],
    cwd: repository,
    env,
  },);
  /**
   * Replaced commit identity.
   */
  const amended = (await execute({
    command: '/usr/bin/git',
    args: [
      'rev-parse',
      'HEAD',
    ],
    cwd: repository,
  },)).stdout
    .trim();
  if (amended === beforeAmend)
    throw new Error('amend did not replace commit',);
  assertFixtureEqual({
    actual: (await execute({
      command: '/usr/bin/git',
      args: [
        'rev-parse',
        'HEAD^',
      ],
      cwd: repository,
    },)).stdout
      .trim(),
    expected: expectedAmendParent,
    context: 'amend parent',
  },);
  assertFixtureEqual({
    actual: await gitText({
      repository,
      revision: 'HEAD:selected.txt',
    },),
    expected: 'good\n',
    context: 'amend canonical blob',
  },);

  /**
   * Pathless allow-empty retains tree while creating commit.
   */
  const allowEmptyTree = (await execute({
    command: '/usr/bin/git',
    args: [
      'rev-parse',
      'HEAD^{tree}',
    ],
    cwd: repository,
  },)).stdout
    .trim();
  await execute({
    command: 'git',
    args: [
      'commit',
      '--allow-empty',
      '--no-only',
      '--quiet',
      '-m',
      'allowed empty',
    ],
    cwd: repository,
    env,
  },);
  assertFixtureEqual({
    actual: (await execute({
      command: '/usr/bin/git',
      args: [
        'rev-parse',
        'HEAD^{tree}',
      ],
      cwd: repository,
    },)).stdout
      .trim(),
    expected: allowEmptyTree,
    context: 'allow-empty tree',
  },);

  /**
   * Merge conclusion uses copied index and preserves both parents.
   */
  await execute({
    command: '/usr/bin/git',
    args: [
      'branch',
      'fixture-feature',
    ],
    cwd: repository,
  },);
  await execute({
    command: '/usr/bin/git',
    args: [
      'checkout',
      '--quiet',
      'fixture-feature',
    ],
    cwd: repository,
  },);
  await writeFile(
    `${repository}/feature.txt`,
    'feature\n',
  );
  await execute({
    command: '/usr/bin/git',
    args: [
      'add',
      'feature.txt',
    ],
    cwd: repository,
  },);
  await execute({
    command: '/usr/bin/git',
    args: [
      'commit',
      '--quiet',
      '-m',
      'feature',
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
    `${repository}/main-side.txt`,
    'main side\n',
  );
  await execute({
    command: '/usr/bin/git',
    args: [
      'add',
      'main-side.txt',
    ],
    cwd: repository,
  },);
  await execute({
    command: '/usr/bin/git',
    args: [
      'commit',
      '--quiet',
      '-m',
      'main side',
    ],
    cwd: repository,
  },);
  await execute({
    command: '/usr/bin/git',
    args: [
      'merge',
      '--no-commit',
      '--no-ff',
      'fixture-feature',
    ],
    cwd: repository,
  },);
  await writeFile(
    `${repository}/selected.txt`,
    'bad\n',
  );
  await execute({
    command: '/usr/bin/git',
    args: [
      'add',
      'selected.txt',
    ],
    cwd: repository,
  },);
  await execute({
    command: 'git',
    args: [
      'commit',
      '--quiet',
      '-m',
      'merge autofix',
    ],
    cwd: repository,
    env,
  },);
  assertFixtureEqual({
    actual: (await execute({
      command: '/usr/bin/git',
      args: [
        'rev-list',
        '--parents',
        '--max-count=1',
        'HEAD',
      ],
      cwd: repository,
    },)).stdout
      .trim()
      .split(' ',)
      .length
      .toString(),
    expected: '3',
    context: 'merge parent count',
  },);
  assertFixtureEqual({
    actual: await gitText({
      repository,
      revision: 'HEAD:selected.txt',
    },),
    expected: 'good\n',
    context: 'merge canonical blob',
  },);

}
