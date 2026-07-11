/**
 * Packed post-commit policy, landed-state, and escape verification. @module
 */
import { writeFile, } from 'node:fs/promises';
import {
  assertIncludes,
  execute,
  parseJsonObjectLines,
} from './built-consumer-helpers.ts';
import { verifyPostCommitDryAndFailure, } from './built-post-commit-dry-failure-consumer.ts';
import {
  assertFixtureEqual,
  initializeBareRemote,
  initializePostCommitRepository,
  resolveFixtureOid,
} from './built-post-commit-helpers.ts';

/**
 * Writes and stages one file through packed shadow Git.
 *
 * @param repository - disposable repository root
 *
 * @param path - repository-relative path
 *
 * @param contents - exact text
 *
 * @param env - packed shadow environment
 */
async function writeAndStageShadow({
  repository,
  path,
  contents,
  env,
}: Readonly<{
  repository: string;
  path: string;
  contents: string;
  env: NodeJS.ProcessEnv;
}>,): Promise<void> {
  await writeFile(
    `${repository}/${path}`,
    contents,
  );
  await execute({
    command: 'git',
    args: [
      'add',
      path,
    ],
    cwd: repository,
    env,
  },);
}

/**
 * Exercises landed-tree gates and explicit commit-exists outcomes.
 *
 * @param env - PATH-first packed shadow environment
 *
 * @example
 * ```ts
 * await verifyPostCommitPolicyConsumer({ env: process.env });
 * ```
 */
export async function verifyPostCommitPolicyConsumer({
  env,
}: Readonly<{
  env: NodeJS.ProcessEnv;
}>,): Promise<void> {
  /**
   * Disposable policy repository and origin.
   */
  const repository = '/work/post-policy';
  /**
   * Bare origin receiving permitted backups.
   */
  const remote = '/work/post-policy-origin.git';
  await initializePostCommitRepository(repository,);
  await initializeBareRemote(remote,);
  /**
   * Self-contained landed-tree policy config.
   */
  const configPath = `${repository}/cli-git.config.mjs`;
  await writeFile(
    configPath,
    `export default {
  plugins: {
    fixture: {
      name: 'fixture',
      policies: [{
        name: 'landed-gate',
        defaultSeverity: 'error',
        warnSafe: false,
        triggers: ['post-commit'],
        check: async ({ context }) => {
          const oid = await context.git.landedCommitOid();
          if (typeof oid === 'symbol') throw new Error('landed oid absent');
          const candidates = await context.git.candidates();
          const control = candidates.find(({ path }) => path === 'control.txt');
          if (control === undefined) return [];
          const value = new TextDecoder().decode(await control.bytes());
          if (value.startsWith('throw')) throw new Error('fixture post-commit engine failure');
          return value.startsWith('block')
            ? [{ code: 'backup-blocked', message: 'blocked landed ' + oid }]
            : [];
        },
      }],
    },
  },
};
`,
  );
  await execute({
    command: '/usr/bin/git',
    args: [
      'add',
      'cli-git.config.mjs',
    ],
    cwd: repository,
  },);
  await execute({
    command: '/usr/bin/git',
    args: [
      'commit',
      '--quiet',
      '-m',
      'baseline',
    ],
    cwd: repository,
  },);
  await execute({
    command: '/usr/bin/git',
    args: [
      'remote',
      'add',
      'origin',
      remote,
    ],
    cwd: repository,
  },);
  await execute({
    command: '/usr/bin/git',
    args: [
      'push',
      '--quiet',
      'origin',
      'main',
    ],
    cwd: repository,
  },);
  await execute({
    command: 'git',
    args: [
      'cli-git',
      'trust',
      '--yes',
    ],
    cwd: repository,
    env,
  },);

  /**
   * Clean landed-tree gate permits successful origin backup.
   */
  await writeAndStageShadow({
    repository,
    path: 'control.txt',
    contents: 'allow\n',
    env,
  },);
  await execute({
    command: 'git',
    args: [
      'commit',
      '-m',
      'allow',
      'control.txt',
    ],
    cwd: repository,
    env,
  },);
  assertFixtureEqual({
    actual: await resolveFixtureOid({ repository, },),
    expected: await resolveFixtureOid({
      repository: remote,
      revision: 'refs/heads/main',
    },),
    context: 'allowed commit backup',
  },);

  /**
   * Engine failure returns two, retains commit, and blocks backup.
   */
  const remoteBeforeFailure = await resolveFixtureOid({
    repository: remote,
    revision: 'refs/heads/main',
  },);
  await writeAndStageShadow({
    repository,
    path: 'control.txt',
    contents: 'throw\n',
    env,
  },);
  /**
   * Wrapper result for post-commit engine failure.
   */
  const failedGate = await execute({
    command: 'git',
    args: [
      'commit',
      '-m',
      'throw gate',
      'control.txt',
    ],
    expectedExit: 2,
    cwd: repository,
    env,
  },);
  /**
   * Local commit retained after engine failure.
   */
  const failureOid = await resolveFixtureOid({ repository, },);
  /**
   * Exact canonical post-commit failure events in wire order.
   */
  const failureEvents = parseJsonObjectLines({
    text: failedGate.stderr,
    context: 'post-commit engine failure',
  },);
  /** Engine failure followed by landed-state event. */
  const [engineFailure, commitLanded,] = failureEvents;
  if ((failureEvents.length !== 2)
    || (engineFailure?.schemaVersion !== 1)
    || (engineFailure?.sequence !== 0)
    || (engineFailure?.type !== 'engine-failure')
    || (engineFailure?.trigger !== 'post-commit')
    || (engineFailure?.code !== 'plugin-threw')
    || (commitLanded?.schemaVersion !== 1)
    || (commitLanded?.sequence !== 1)
    || (commitLanded?.type !== 'commit-landed')
    || (commitLanded?.oid !== failureOid)
    || (commitLanded?.outcome !== 'post-commit-blocked'))
    throw new Error(`post-commit failure compatibility mismatch\n${failedGate.stderr}`,);
  assertFixtureEqual({
    actual: await resolveFixtureOid({
      repository: remote,
      revision: 'refs/heads/main',
    },),
    expected: remoteBeforeFailure,
    context: 'failed gate remote',
  },);

  /**
   * Error finding also returns two and leaves newer local commit unpushed.
   */
  await writeAndStageShadow({
    repository,
    path: 'control.txt',
    contents: 'block\n',
    env,
  },);
  /**
   * Wrapper result for blocking post-commit finding.
   */
  const blocked = await execute({
    command: 'git',
    args: [
      'commit',
      '-m',
      'blocked gate',
      'control.txt',
    ],
    expectedExit: 2,
    cwd: repository,
    env,
  },);
  /**
   * Local commit retained after blocking finding.
   */
  const blockedOid = await resolveFixtureOid({ repository, },);
  assertIncludes({
    text: blocked.stderr,
    expected: '"policyId":"fixture/landed-gate"',
    context: 'blocked finding',
  },);
  assertIncludes({
    text: blocked.stderr,
    expected: blockedOid,
    context: 'blocked landed oid',
  },);
  assertFixtureEqual({
    actual: await resolveFixtureOid({
      repository: remote,
      revision: 'refs/heads/main',
    },),
    expected: remoteBeforeFailure,
    context: 'blocked remote',
  },);

  /**
   * Full-lifecycle escape skips post gate and backs up accumulated commits.
   */
  await writeAndStageShadow({
    repository,
    path: 'control.txt',
    contents: 'block escaped\n',
    env,
  },);
  await execute({
    command: 'git',
    args: [
      'commit',
      '--no-enforce-fixture/landed-gate',
      '-m',
      'escaped gate',
      'control.txt',
    ],
    cwd: repository,
    env,
  },);
  /**
   * Escaped commit backed up after post gate skip.
   */
  const escapedOid = await resolveFixtureOid({ repository, },);
  assertFixtureEqual({
    actual: await resolveFixtureOid({
      repository: remote,
      revision: 'refs/heads/main',
    },),
    expected: escapedOid,
    context: 'escaped backup',
  },);

  await verifyPostCommitDryAndFailure({
    repository,
    remote,
    escapedOid,
    env,
  },);
}
