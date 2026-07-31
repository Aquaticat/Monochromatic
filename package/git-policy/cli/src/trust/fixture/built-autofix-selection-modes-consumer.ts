/**
 * Packed native commit selection-mode verification.
 *
 * @module
 */
import { writeFile, } from 'node:fs/promises';
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

  /**
   * Path outside fixture plugin correction scope.
   */
  const warningPath = 'newline-selection.txt';
  for (const selectionFlag of [
    '--include',
    '--patch',
    '--interactive',
  ]) {
    /**
     * Distinct noncanonical bytes for current read-only selection mode.
     */
    const selectedValue = `bad ${selectionFlag}`;
    // oxlint-disable-next-line no-await-in-loop -- Each user-facing selection mode needs fresh noncanonical worktree bytes.
    await writeFile(
      `${repository}/${warningPath}`,
      selectedValue,
    );
    // oxlint-disable-next-line no-await-in-loop -- Each selection starts from exact staged noncanonical bytes.
    await execute({
      command: '/usr/bin/git',
      args: [
        'add',
        warningPath,
      ],
      cwd: repository,
    },);
    /**
     * Warning-only read-only selection result.
     */
    // oxlint-disable-next-line no-await-in-loop -- Each user-facing selection mode must be exercised independently.
    const warned = await execute({
      command: 'git',
      args: [
        'commit',
        selectionFlag,
        '--quiet',
        '-m',
        `warn ${selectionFlag}`,
        warningPath,
      ],
      cwd: repository,
      env,
    },);
    assertIncludes({
      text: warned.stderr,
      expected: '"policyId":"final-newline","severity":"warn"',
      context: `${selectionFlag} core final-newline warning`,
    },);
    assertIncludes({
      text: warned.stderr,
      expected: '"fix":"none"',
      context: `${selectionFlag} unavailable automatic correction`,
    },);
    /**
     * Exact noncanonical bytes committed after warning-only selection.
     */
    // oxlint-disable-next-line no-await-in-loop -- Every mode must prove warning-only commit bytes independently.
    const committed = await execute({
      command: '/usr/bin/git',
      args: [
        'show',
        `HEAD:${warningPath}`,
      ],
      cwd: repository,
    },);
    assertFixtureEqual({
      actual: committed.stdout,
      expected: selectedValue,
      context: `${selectionFlag} warning-only committed bytes`,
    },);
  }
}
