/**
 * Packed cherry-pick and revert conclusion autofix verification.
 *
 * @module
 */
import {
  rm,
  writeFile,
} from 'node:fs/promises';
import { execute, } from './built-consumer-helpers.ts';
import { assertFixtureEqual, } from './built-post-commit-helpers.ts';

/**
 * Resolves exact revision identity.
 *
 * @param repository - disposable repository
 *
 * @param revision - Git revision
 *
 * @returns exact OID
 */
async function oid({
  repository,
  revision,
}: Readonly<{
  repository: string;
  revision: string;
}>,): Promise<string> {
  return (await execute({
    command: '/usr/bin/git',
    args: [
      'rev-parse',
      revision,
    ],
    cwd: repository,
  },)).stdout
    .trim();
}

/**
 * Exercises cherry-pick and revert marker conclusions through copied indexes.
 *
 * @param repository - initialized trusted autofix repository
 *
 * @param env - packed shadow environment
 *
 * @example
 * ```ts
 * await verifyAutofixSequencers({ repository: '/work/repo', env: process.env });
 * ```
 */
export async function verifyAutofixSequencers({
  repository,
  env,
}: Readonly<{
  repository: string;
  env: NodeJS.ProcessEnv;
}>,): Promise<void> {
  /**
   * Source commit applied through synthetic pending cherry-pick marker.
   */
  await execute({
    command: '/usr/bin/git',
    args: [
      'branch',
      'sequencer-source',
    ],
    cwd: repository,
  },);
  await execute({
    command: '/usr/bin/git',
    args: [
      'checkout',
      '--quiet',
      'sequencer-source',
    ],
    cwd: repository,
  },);
  await writeFile(
    `${repository}/cherry.txt`,
    'cherry content\n',
  );
  await execute({
    command: '/usr/bin/git',
    args: [
      'add',
      'cherry.txt',
    ],
    cwd: repository,
  },);
  await execute({
    command: '/usr/bin/git',
    args: [
      'commit',
      '--quiet',
      '-m',
      'cherry source',
    ],
    cwd: repository,
  },);
  /**
   * Exact source commit applied without immediate commit.
   */
  const sourceOid = await oid({
    repository,
    revision: 'HEAD',
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
  await execute({
    command: '/usr/bin/git',
    args: [
      'cherry-pick',
      '--no-commit',
      sourceOid,
    ],
    cwd: repository,
  },);
  await writeFile(
    `${repository}/.git/CHERRY_PICK_HEAD`,
    `${sourceOid}\n`,
  );
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
  /**
   * Original HEAD expected as cherry conclusion parent.
   */
  const cherryParent = await oid({
    repository,
    revision: 'HEAD',
  },);
  await execute({
    command: 'git',
    args: [
      'commit',
      '--quiet',
      '-m',
      'cherry conclusion autofix',
    ],
    cwd: repository,
    env,
  },);
  assertFixtureEqual({
    actual: await oid({
      repository,
      revision: 'HEAD^',
    },),
    expected: cherryParent,
    context: 'cherry conclusion parent',
  },);
  assertFixtureEqual({
    actual: (await execute({
      command: '/usr/bin/git',
      args: [
        'show',
        'HEAD:selected.txt',
      ],
      cwd: repository,
    },)).stdout,
    expected: 'good\n',
    context: 'cherry conclusion canonical blob',
  },);
  await rm(
    `${repository}/.git/CHERRY_PICK_HEAD`,
    { force: true, },
  );

  /**
   * Target commit reversed through synthetic pending revert marker.
   */
  await writeFile(
    `${repository}/revert.txt`,
    'revert target\n',
  );
  await execute({
    command: '/usr/bin/git',
    args: [
      'add',
      'revert.txt',
    ],
    cwd: repository,
  },);
  await execute({
    command: '/usr/bin/git',
    args: [
      'commit',
      '--quiet',
      '-m',
      'revert target',
    ],
    cwd: repository,
  },);
  /**
   * Exact commit whose change is staged for reversal.
   */
  const revertTarget = await oid({
    repository,
    revision: 'HEAD',
  },);
  await execute({
    command: '/usr/bin/git',
    args: [
      'revert',
      '--no-commit',
      revertTarget,
    ],
    cwd: repository,
  },);
  await writeFile(
    `${repository}/.git/REVERT_HEAD`,
    `${revertTarget}\n`,
  );
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
  /**
   * Original HEAD expected as revert conclusion parent.
   */
  const revertParent = await oid({
    repository,
    revision: 'HEAD',
  },);
  await execute({
    command: 'git',
    args: [
      'commit',
      '--quiet',
      '-m',
      'revert conclusion autofix',
    ],
    cwd: repository,
    env,
  },);
  assertFixtureEqual({
    actual: await oid({
      repository,
      revision: 'HEAD^',
    },),
    expected: revertParent,
    context: 'revert conclusion parent',
  },);
  assertFixtureEqual({
    actual: (await execute({
      command: '/usr/bin/git',
      args: [
        'show',
        'HEAD:selected.txt',
      ],
      cwd: repository,
    },)).stdout,
    expected: 'good\n',
    context: 'revert conclusion canonical blob',
  },);
  await rm(
    `${repository}/.git/REVERT_HEAD`,
    { force: true, },
  );
}
