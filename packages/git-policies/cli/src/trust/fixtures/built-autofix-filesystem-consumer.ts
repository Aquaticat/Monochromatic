/**
 * Packed transaction filesystem-error verification.
 *
 * @module
 */
import {
  readFile,
  writeFile,
} from 'node:fs/promises';
import {
  assertJsonl,
  execute,
} from './built-consumer-helpers.ts';
import {
  assertFixtureEqual,
  resolveFixtureOid,
} from './built-post-commit-helpers.ts';

/**
 * Exercises read-only administrative filesystem failure and next-shim health.
 *
 * @param repository - initialized trusted autofix repository
 *
 * @param env - packed shadow environment
 *
 * @example
 * ```ts
 * await verifyAutofixFilesystemFailure({ repository: '/work/repo', env: process.env });
 * ```
 */
export async function verifyAutofixFilesystemFailure({
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
  await writeFile(
    `${repository}/selected.txt`,
    'bad\n',
  );
  await writeFile(
    `${repository}/filesystem-marker.txt`,
    'filesystem marker\n',
  );
  await execute({
    command: '/usr/bin/git',
    args: [
      'add',
      'selected.txt',
      'filesystem-marker.txt',
    ],
    cwd: repository,
  },);
  /**
   * Exact original ref before read-only failure.
   */
  const originalHead = await resolveFixtureOid({ repository, },);
  /**
   * Exact original index before read-only failure.
   */
  const originalIndex = Buffer.from(await readFile(`${repository}/.git/index`,))
    .toString('base64',);
  /**
   * Administrative directory mounted read-only inside disposable container.
   */
  const gitDirectory = `${repository}/.git`;
  await execute({
    command: '/usr/bin/mount',
    args: [
      '--bind',
      gitDirectory,
      gitDirectory,
    ],
  },);
  {
    /**
     * Scope-bound administrative mount cleanup.
     */
    await using mountCleanup = {
      [Symbol.asyncDispose]: async function unmountAdministrativeDirectory(): Promise<void> {
        await execute({
          command: '/usr/bin/umount',
          args: [gitDirectory,],
        },);
      },
    };
    await execute({
      command: '/usr/bin/mount',
      args: [
        '--options',
        'remount,bind,ro',
        gitDirectory,
      ],
    },);
    /** Direct-fix setup failure routed only to stdout. */
    const directBlocked = await execute({
      command: 'git',
      args: [
        'cli-git',
        'fix',
        '--policy',
        'final-newline',
        '--',
        'selected.txt',
      ],
      expectedExit: 2,
      cwd: repository,
      env,
    },);
    assertJsonl({
      text: directBlocked.stdout,
      expectedCode: 'transaction-failed',
      context: 'read-only direct-fix setup failure',
    },);
    if (directBlocked.stderr !== '')
      throw new Error(`direct-fix setup failure leaked stderr\n${directBlocked.stderr}`,);
    /**
     * Stable engine failure from transaction workspace creation.
     */
    const blocked = await execute({
      command: 'git',
      args: [
        'commit',
        '--no-only',
        '--quiet',
        '-m',
        'filesystem failure',
      ],
      expectedExit: 2,
      cwd: repository,
      env,
    },);
    assertJsonl({
      text: blocked.stderr,
      expectedCode: 'transaction-failed',
      context: 'read-only transaction filesystem failure',
    },);
    if (blocked.stdout !== '')
      throw new Error(`commit transaction failure leaked stdout\n${blocked.stdout}`,);
  }
  assertFixtureEqual({
    actual: await resolveFixtureOid({ repository, },),
    expected: originalHead,
    context: 'filesystem failure HEAD',
  },);
  assertFixtureEqual({
    actual: Buffer.from(await readFile(`${repository}/.git/index`,))
      .toString('base64',),
    expected: originalIndex,
    context: 'filesystem failure real index',
  },);
  assertFixtureEqual({
    actual: await readFile(
      `${repository}/selected.txt`,
      'utf8',
    ),
    expected: 'bad\n',
    context: 'filesystem failure worktree',
  },);
  await execute({
    command: 'git',
    args: [
      'status',
      '--short',
    ],
    cwd: repository,
    env,
  },);
}
