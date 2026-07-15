/**
 * Packed native commit selection-mode verification.
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
 * Exercises canonical native selections and read-only correction blocks.
 *
 * @param repository - initialized trusted autofix repository
 *
 * @param env - packed shadow environment
 *
 * @example
 * ```ts
 * await verifyAutofixSelectionModes({ repository: '/work/repo', env: process.env });
 * ```
 */
export async function verifyAutofixSelectionModes({
  repository,
  env,
}: Readonly<{
  repository: string;
  env: NodeJS.ProcessEnv;
}>,): Promise<void> {
  /**
   * Canonical include selection proceeds through real Git.
   */
  await writeFile(
    `${repository}/include-marker.txt`,
    'include baseline\n',
  );
  await execute({
    command: '/usr/bin/git',
    args: [
      'add',
      'include-marker.txt',
    ],
    cwd: repository,
  },);
  await execute({
    command: '/usr/bin/git',
    args: [
      'commit',
      '--quiet',
      '-m',
      'include baseline',
    ],
    cwd: repository,
  },);
  await writeFile(
    `${repository}/include-marker.txt`,
    'include marker\n',
  );
  await execute({
    command: 'git',
    args: [
      'commit',
      '--include',
      '--quiet',
      '-m',
      'canonical include',
      'include-marker.txt',
    ],
    cwd: repository,
    env,
  },);

  /**
   * Canonical native patch selection commits exact chosen private state.
   */
  await writeFile(
    `${repository}/patch-canonical.txt`,
    'patch baseline\n',
  );
  await execute({
    command: '/usr/bin/git',
    args: [
      'add',
      'patch-canonical.txt',
    ],
    cwd: repository,
  },);
  await execute({
    command: '/usr/bin/git',
    args: [
      'commit',
      '--quiet',
      '-m',
      'patch baseline',
    ],
    cwd: repository,
  },);
  await writeFile(
    `${repository}/patch-canonical.txt`,
    'patch canonical\n',
  );
  await execute({
    command: 'git',
    args: [
      'commit',
      '--patch',
      '--quiet',
      '-m',
      'canonical patch',
      'patch-canonical.txt',
    ],
    cwd: repository,
    env,
    input: 'y\n',
  },);

  /**
   * Canonical native interactive selection commits exact chosen private state.
   */
  await writeFile(
    `${repository}/interactive-canonical.txt`,
    'interactive baseline\n',
  );
  await execute({
    command: '/usr/bin/git',
    args: [
      'add',
      'interactive-canonical.txt',
    ],
    cwd: repository,
  },);
  await execute({
    command: '/usr/bin/git',
    args: [
      'commit',
      '--quiet',
      '-m',
      'interactive baseline',
    ],
    cwd: repository,
  },);
  await writeFile(
    `${repository}/interactive-canonical.txt`,
    'interactive canonical\n',
  );
  await execute({
    command: 'git',
    args: [
      'commit',
      '--interactive',
      '--quiet',
      '-m',
      'canonical interactive',
      'interactive-canonical.txt',
    ],
    cwd: repository,
    env,
    input: 'u\n1\n\nq\n',
  },);

  await writeFile(
    `${repository}/selected.txt`,
    'bad',
  );
  await execute({
    command: '/usr/bin/git',
    args: [
      'add',
      'selected.txt',
    ],
    cwd: repository,
  },);
  /**
   * Exact staged real index before read-only correction blocks.
   */
  const readOnlyIndex = Buffer.from(await readFile(`${repository}/.git/index`,))
    .toString('base64',);
  for (const selectionFlag of [
    '--include',
    '--patch',
    '--interactive',
  ]) {
    /**
     * Read-only selection result requiring direct correction.
     */
    // oxlint-disable-next-line no-await-in-loop -- Each user-facing selection mode must be exercised independently.
    const blocked = await execute({
      command: 'git',
      args: [
        'commit',
        selectionFlag,
        '--quiet',
        '-m',
        `blocked ${selectionFlag}`,
        'selected.txt',
      ],
      expectedExit: 1,
      cwd: repository,
      env,
    },);
    assertIncludes({
      text: blocked.stderr,
      expected: '"policyId":"final-newline"',
      context: `${selectionFlag} core final-newline guidance`,
    },);
    assertIncludes({
      text: blocked.stderr,
      expected: '"fix":"available"',
      context: `${selectionFlag} direct-fix guidance`,
    },);
    assertFixtureEqual({
      // oxlint-disable-next-line no-await-in-loop -- Exact index preservation is asserted after each independent mode.
      actual: Buffer.from(await readFile(`${repository}/.git/index`,))
        .toString('base64',),
      expected: readOnlyIndex,
      context: `${selectionFlag} real index`,
    },);
  }
}
