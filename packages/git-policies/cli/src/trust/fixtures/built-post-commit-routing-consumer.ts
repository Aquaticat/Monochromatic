/**
 * Packed post-commit backup routing verification. @module
 */
import { writeFile, } from 'node:fs/promises';
import {
  assertIncludes,
  execute,
} from './built-consumer-helpers.ts';
import {
  assertFixtureEqual,
  initializeBareRemote,
  initializePostCommitRepository,
  resolveFixtureOid,
  writeAndStageReal,
} from './built-post-commit-helpers.ts';

/**
 * Commits one explicitly staged path through packed shadow Git.
 *
 * @param repository - disposable repository root
 *
 * @param path - repository-relative path
 *
 * @param message - commit subject
 *
 * @param env - packed shadow environment
 *
 * @returns captured wrapper output
 */
async function commitShadow({
  repository,
  path,
  message,
  env,
}: Readonly<{
  repository: string;
  path: string;
  message: string;
  env: NodeJS.ProcessEnv;
}>,): ReturnType<typeof execute> {
  await execute({
    command: 'git',
    args: [
      'add',
      path,
    ],
    cwd: repository,
    env,
  },);
  return execute({
    command: 'git',
    args: [
      'commit',
      '-m',
      message,
      path,
    ],
    cwd: repository,
    env,
  },);
}

/**
 * Exercises upstream, detached, and no-remote routing through packed shim.
 *
 * @param env - PATH-first packed shadow environment
 *
 * @example
 * ```ts
 * await verifyPostCommitRoutingConsumer({ env: process.env });
 * ```
 */
export async function verifyPostCommitRoutingConsumer({
  env,
}: Readonly<{
  env: NodeJS.ProcessEnv;
}>,): Promise<void> {
  /**
   * Repository with non-origin configured upstream.
   */
  const upstreamRepository = '/work/post-upstream';
  /**
   * Origin remote that must not win over configured upstream.
   */
  const originRemote = '/work/post-upstream-origin.git';
  /**
   * Non-origin configured upstream remote.
   */
  const backupRemote = '/work/post-upstream-backup.git';
  await initializePostCommitRepository(upstreamRepository,);
  await initializeBareRemote(originRemote,);
  await initializeBareRemote(backupRemote,);
  await writeAndStageReal({
    repository: upstreamRepository,
    path: 'initial.txt',
    contents: 'initial\n',
  },);
  await execute({
    command: '/usr/bin/git',
    args: [
      'commit',
      '--quiet',
      '-m',
      'initial',
    ],
    cwd: upstreamRepository,
  },);
  await execute({
    command: '/usr/bin/git',
    args: [
      'remote',
      'add',
      'origin',
      originRemote,
    ],
    cwd: upstreamRepository,
  },);
  await execute({
    command: '/usr/bin/git',
    args: [
      'remote',
      'add',
      'backup',
      backupRemote,
    ],
    cwd: upstreamRepository,
  },);
  await execute({
    command: '/usr/bin/git',
    args: [
      'push',
      '--quiet',
      'origin',
      'main',
    ],
    cwd: upstreamRepository,
  },);
  await execute({
    command: '/usr/bin/git',
    args: [
      'push',
      '--quiet',
      '--set-upstream',
      'backup',
      'main',
    ],
    cwd: upstreamRepository,
  },);
  /**
   * Origin OID before automatic upstream backup.
   */
  const originBaseline = await resolveFixtureOid({
    repository: originRemote,
    revision: 'refs/heads/main',
  },);
  await writeFile(
    `${upstreamRepository}/upstream.txt`,
    'upstream\n',
  );
  await commitShadow({
    repository: upstreamRepository,
    path: 'upstream.txt',
    message: 'upstream route',
    env,
  },);
  /**
   * Landed commit expected only at configured upstream.
   */
  const upstreamHead = await resolveFixtureOid({ repository: upstreamRepository, },);
  assertFixtureEqual({
    actual: await resolveFixtureOid({
      repository: backupRemote,
      revision: 'refs/heads/main',
    },),
    expected: upstreamHead,
    context: 'configured upstream',
  },);
  assertFixtureEqual({
    actual: await resolveFixtureOid({
      repository: originRemote,
      revision: 'refs/heads/main',
    },),
    expected: originBaseline,
    context: 'origin untouched',
  },);

  /**
   * Detached repository retains local commit and skips backup.
   */
  const detachedRepository = '/work/post-detached';
  /**
   * Origin retained while HEAD is detached.
   */
  const detachedRemote = '/work/post-detached-origin.git';
  await initializePostCommitRepository(detachedRepository,);
  await initializeBareRemote(detachedRemote,);
  await writeAndStageReal({
    repository: detachedRepository,
    path: 'initial.txt',
    contents: 'initial\n',
  },);
  await execute({
    command: '/usr/bin/git',
    args: [
      'commit',
      '--quiet',
      '-m',
      'initial',
    ],
    cwd: detachedRepository,
  },);
  await execute({
    command: '/usr/bin/git',
    args: [
      'remote',
      'add',
      'origin',
      detachedRemote,
    ],
    cwd: detachedRepository,
  },);
  await execute({
    command: '/usr/bin/git',
    args: [
      'push',
      '--quiet',
      'origin',
      'main',
    ],
    cwd: detachedRepository,
  },);
  /**
   * Remote OID before detached local commit.
   */
  const detachedBaseline = await resolveFixtureOid({
    repository: detachedRemote,
    revision: 'refs/heads/main',
  },);
  await execute({
    command: '/usr/bin/git',
    args: [
      'checkout',
      '--quiet',
      '--detach',
    ],
    cwd: detachedRepository,
  },);
  await writeFile(
    `${detachedRepository}/detached.txt`,
    'detached\n',
  );
  /**
   * Detached commit wrapper result.
   */
  const detached = await commitShadow({
    repository: detachedRepository,
    path: 'detached.txt',
    message: 'detached local',
    env,
  },);
  assertIncludes({
    text: detached.stderr,
    expected: 'HEAD is detached',
    context: 'detached backup skip',
  },);
  assertFixtureEqual({
    actual: await resolveFixtureOid({
      repository: detachedRemote,
      revision: 'refs/heads/main',
    },),
    expected: detachedBaseline,
    context: 'detached remote',
  },);

  /**
   * Repository without remotes still commits successfully and skips backup.
   */
  const noRemoteRepository = '/work/post-no-remote';
  await initializePostCommitRepository(noRemoteRepository,);
  await writeAndStageReal({
    repository: noRemoteRepository,
    path: 'initial.txt',
    contents: 'initial\n',
  },);
  await execute({
    command: '/usr/bin/git',
    args: [
      'commit',
      '--quiet',
      '-m',
      'initial',
    ],
    cwd: noRemoteRepository,
  },);
  /**
   * Local OID before no-remote commit.
   */
  const noRemoteBaseline = await resolveFixtureOid({ repository: noRemoteRepository, },);
  await writeFile(
    `${noRemoteRepository}/local.txt`,
    'local\n',
  );
  await commitShadow({
    repository: noRemoteRepository,
    path: 'local.txt',
    message: 'no remote',
    env,
  },);
  /**
   * Local OID after no-remote commit.
   */
  const noRemoteHead = await resolveFixtureOid({ repository: noRemoteRepository, },);
  if (noRemoteHead === noRemoteBaseline)
    throw new Error('No-remote shadow commit did not land.',);
}
