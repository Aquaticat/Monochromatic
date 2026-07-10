/**
 * Packed post-commit dry-run and ordinary backup-failure verification. @module
 */
import { writeFile, } from 'node:fs/promises';
import {
  assertIncludes,
  execute,
} from './built-consumer-helpers.ts';
import {
  assertFixtureEqual,
  resolveFixtureOid,
} from './built-post-commit-helpers.ts';

/**
 * Verifies dry-run exclusion and non-policy push failure semantics.
 *
 * @param repository - prepared trusted policy repository
 *
 * @param remote - prepared origin repository
 *
 * @param escapedOid - OID already backed up after escaped gate
 *
 * @param env - packed shadow environment
 *
 * @example
 * ```ts
 * await verifyPostCommitDryAndFailure({ repository: '/work/repo', remote: '/work/origin.git', escapedOid: 'abc', env: process.env });
 * ```
 */
export async function verifyPostCommitDryAndFailure({
  repository,
  remote,
  escapedOid,
  env,
}: Readonly<{
  repository: string;
  remote: string;
  escapedOid: string;
  env: NodeJS.ProcessEnv;
}>,): Promise<void> {
  /**
   * Stage blocking content for dry-run commands.
   */
  await writeFile(
    `${repository}/control.txt`,
    'block\n',
  );
  await execute({
    command: 'git',
    args: [
      'add',
      'control.txt',
    ],
    cwd: repository,
    env,
  },);
  await execute({
    command: 'git',
    args: [
      'commit',
      '--dry-run',
      '-m',
      'dry gate',
      'control.txt',
    ],
    cwd: repository,
    env,
  },);
  await execute({
    command: 'git',
    args: [
      'commit',
      '--porcelain',
      '-m',
      'porcelain gate',
      'control.txt',
    ],
    cwd: repository,
    env,
  },);
  assertFixtureEqual({
    actual: await resolveFixtureOid({ repository, },),
    expected: escapedOid,
    context: 'dry-run local head',
  },);
  assertFixtureEqual({
    actual: await resolveFixtureOid({
      repository: remote,
      revision: 'refs/heads/main',
    },),
    expected: escapedOid,
    context: 'dry-run remote',
  },);

  /**
   * Missing origin proves ordinary backup failure retains successful commit result.
   */
  await execute({
    command: '/usr/bin/git',
    args: [
      'remote',
      'set-url',
      'origin',
      '/work/missing-post-origin.git',
    ],
    cwd: repository,
  },);
  await writeFile(
    `${repository}/control.txt`,
    'allow\n',
  );
  await execute({
    command: 'git',
    args: [
      'add',
      'control.txt',
    ],
    cwd: repository,
    env,
  },);
  /**
   * Successful commit with failed automatic backup output.
   */
  const failedBackup = await execute({
    command: 'git',
    args: [
      'commit',
      '-m',
      'local backup failure',
      'control.txt',
    ],
    cwd: repository,
    env,
  },);
  assertIncludes({
    text: failedBackup.stderr,
    expected: 'commit saved locally',
    context: 'ordinary backup failure',
  },);
}
