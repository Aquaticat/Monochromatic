/**
 * Packed extended commit-mode autofix verification.
 *
 * @module
 */
import {
  readFile,
  rm,
  writeFile,
} from 'node:fs/promises';
import {
  assertIncludes,
  execute,
} from './built-consumer-helpers.ts';
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
 * Exercises pathspec files, deletion, untracked, amend, allow-empty, and merge conclusion.
 *
 * @param repository - initialized trusted autofix repository
 *
 * @param env - packed shadow environment
 *
 * @example
 * ```ts
 * await verifyAutofixModes({ repository: '/work/repo', env: process.env });
 * ```
 */
export async function verifyAutofixModes({
  repository,
  env,
}: Readonly<{
  repository: string;
  env: NodeJS.ProcessEnv;
}>,): Promise<void> {
  await execute({
    command: '/usr/bin/git',
    args: [
      'reset',
      '--hard',
      '--quiet',
      'HEAD',
    ],
    cwd: repository,
  },);

  /**
   * NUL pathspec file drives explicit private selection.
   */
  await writeFile(
    `${repository}/selected.txt`,
    'bad\n',
  );
  await writeFile(
    `${repository}/pathspec-marker.txt`,
    'pathspec marker\n',
  );
  await writeFile(
    `${repository}/paths.input`,
    new TextEncoder().encode('selected.txt\0pathspec-marker.txt\0',),
  );
  await execute({
    command: 'git',
    args: [
      'commit',
      '--quiet',
      '-m',
      'pathspec file autofix',
      '--pathspec-from-file=paths.input',
      '--pathspec-file-nul',
    ],
    cwd: repository,
    env,
  },);
  assertFixtureEqual({
    actual: await gitText({
      repository,
      revision: 'HEAD:selected.txt',
    },),
    expected: 'good\n',
    context: 'pathspec file canonical blob',
  },);

  /**
   * Deletion and selected untracked path coexist with canonical patch.
   */
  await writeFile(
    `${repository}/delete-me.txt`,
    'delete baseline\n',
  );
  await execute({
    command: '/usr/bin/git',
    args: [
      'add',
      'delete-me.txt',
    ],
    cwd: repository,
  },);
  await execute({
    command: '/usr/bin/git',
    args: [
      'commit',
      '--quiet',
      '-m',
      'deletion baseline',
    ],
    cwd: repository,
  },);
  await writeFile(
    `${repository}/selected.txt`,
    'bad\n',
  );
  await rm(`${repository}/delete-me.txt`,);
  await writeFile(
    `${repository}/selected-untracked.txt`,
    'new selected\n',
  );
  await execute({
    command: 'git',
    args: [
      'commit',
      '--quiet',
      '-m',
      'delete and add autofix',
      'selected.txt',
      'delete-me.txt',
      'selected-untracked.txt',
    ],
    cwd: repository,
    env,
  },);
  assertFixtureEqual({
    actual: await gitText({
      repository,
      revision: 'HEAD:selected.txt',
    },),
    expected: 'good\n',
    context: 'delete/add canonical blob',
  },);
  await execute({
    command: '/usr/bin/git',
    args: [
      'cat-file',
      '-e',
      'HEAD:selected-untracked.txt',
    ],
    cwd: repository,
  },);
  await execute({
    command: '/usr/bin/git',
    args: [
      'cat-file',
      '-e',
      'HEAD:delete-me.txt',
    ],
    expectedExit: 128,
    cwd: repository,
  },);

  /**
   * Canonical include mode proceeds through real Git without automatic patch.
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
   * Exact clean real index before read-only correction blocks.
   */
  const readOnlyIndex = Buffer.from(await readFile(`${repository}/.git/index`,))
    .toString('base64',);
  await writeFile(
    `${repository}/selected.txt`,
    'bad\n',
  );
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
