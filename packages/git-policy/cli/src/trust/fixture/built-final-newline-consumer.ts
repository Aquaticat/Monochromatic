/**
 * Packed core final-newline lifecycle verification.
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
import { verifyFinalNewlineExclusions, } from './built-final-newline-exclusions-consumer.ts';
import { verifyFinalNewlinePartialCommit, } from './built-final-newline-partial-consumer.ts';
import {
  assertFixtureEqual,
  initializeBareRemote,
  initializePostCommitRepository,
} from './built-post-commit-helpers.ts';

/**
 * Reads exact file or Git metadata bytes as base64 fixture text.
 *
 * @param path - filesystem path whose bytes must be preserved
 *
 * @returns exact bytes encoded for deterministic comparison
 *
 * @example
 * ```ts
 * await readBase64('/work/repo/.git/index');
 * ```
 */
async function readBase64(path: string,): Promise<string> {
  return Buffer.from(await readFile(path,))
    .toString('base64',);
}

/**
 * Exercises check, fix, commit, and push through packed shadow executable.
 *
 * @param env - PATH-first packed shadow environment
 *
 * @example
 * ```ts
 * await verifyFinalNewlineConsumer({ env: process.env });
 * ```
 */
export async function verifyFinalNewlineConsumer({ env, }: Readonly<{
  env: NodeJS.ProcessEnv;
}>,): Promise<void> {
  /**
   * Disposable final-newline repository.
   */
  const repository = '/work/final-newline';
  /**
   * Disposable bare remote used for read-only push rejection.
   */
  const remote = '/work/final-newline-origin.git';
  await initializePostCommitRepository(repository,);
  await initializeBareRemote(remote,);
  await writeFile(
    `${repository}/cli-git.config.mjs`,
    'export default {};\n',
  );
  await writeFile(
    `${repository}/check.txt`,
    'check baseline\n',
  );
  await writeFile(
    `${repository}/fix.txt`,
    'fix baseline\n',
  );
  await writeFile(
    `${repository}/commit.txt`,
    'commit baseline\n',
  );
  await writeFile(
    `${repository}/push.txt`,
    'push baseline\n',
  );
  await execute({
    command: '/usr/bin/git',
    args: [
      'add',
      'cli-git.config.mjs',
      'check.txt',
      'fix.txt',
      'commit.txt',
      'push.txt',
    ],
    cwd: repository,
  },);
  await execute({
    command: '/usr/bin/git',
    args: [
      'commit',
      '--quiet',
      '--message=baseline',
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
      'main:main',
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
   * Exact real index bytes before direct lifecycle operations.
   */
  const directIndex = await readBase64(`${repository}/.git/index`,);
  await writeFile(
    `${repository}/check.txt`,
    'check missing',
  );
  /**
   * Read-only direct-check finding.
   */
  const checked = await execute({
    command: 'git',
    args: [
      'cli-git',
      'check',
      '--policy',
      'final-newline',
      '--',
      'check.txt',
    ],
    expectedExit: 1,
    cwd: repository,
    env,
  },);
  assertIncludes({
    text: checked.stdout,
    expected: '"policyId":"final-newline"',
    context: 'packed final-newline direct check',
  },);
  assertFixtureEqual({
    actual: await readBase64(`${repository}/check.txt`,),
    expected: Buffer.from('check missing',)
      .toString('base64',),
    context: 'direct-check worktree bytes',
  },);
  assertFixtureEqual({
    actual: await readBase64(`${repository}/.git/index`,),
    expected: directIndex,
    context: 'direct-check index bytes',
  },);

  await writeFile(
    `${repository}/fix.txt`,
    'fix missing',
  );
  /**
   * Converged direct-fix summary.
   */
  const fixed = await execute({
    command: 'git',
    args: [
      'cli-git',
      'fix',
      '--policy',
      'final-newline',
      '--',
      'fix.txt',
    ],
    cwd: repository,
    env,
  },);
  assertFixtureEqual({
    actual: fixed.stdout,
    expected: '{"schemaVersion":1,"sequence":0,"type":"fix-summary","trigger":"direct-fix","passes":1,"changedPaths":["fix.txt"]}\n',
    context: 'direct-fix final-only JSONL',
  },);
  assertFixtureEqual({
    actual: await readBase64(`${repository}/fix.txt`,),
    expected: Buffer.from('fix missing\n',)
      .toString('base64',),
    context: 'direct-fix worktree bytes',
  },);
  assertFixtureEqual({
    actual: await readBase64(`${repository}/.git/index`,),
    expected: directIndex,
    context: 'direct-fix index bytes',
  },);

  await writeFile(
    `${repository}/commit.txt`,
    'commit missing',
  );
  await execute({
    command: '/usr/bin/git',
    args: [
      'add',
      'commit.txt',
    ],
    cwd: repository,
  },);
  /**
   * Packed commit correction summary routed to wrapper stderr.
   */
  const committed = await execute({
    command: 'git',
    args: [
      'commit',
      '--quiet',
      '--no-verify',
      '--message=normalize commit',
      '--',
      'commit.txt',
    ],
    cwd: repository,
    env,
  },);
  assertFixtureEqual({
    actual: committed.stderr,
    expected: '{"schemaVersion":1,"sequence":0,"type":"fix-summary","trigger":"pre-forward","passes":1,"changedPaths":["commit.txt"]}\n',
    context: 'packed commit final-only summary',
  },);
  /**
   * Exact committed canonical text.
   */
  const committedBlob = await execute({
    command: '/usr/bin/git',
    args: [
      'show',
      'HEAD:commit.txt',
    ],
    cwd: repository,
  },);
  assertFixtureEqual({
    actual: committedBlob.stdout,
    expected: 'commit missing\n',
    context: 'packed commit canonical blob',
  },);
  assertFixtureEqual({
    actual: await readBase64(`${repository}/commit.txt`,),
    expected: Buffer.from('commit missing',)
      .toString('base64',),
    context: 'packed commit worktree bytes',
  },);

  /**
   * Remote main before intentionally noncanonical local commit.
   */
  const remoteBefore = (await execute({
    command: '/usr/bin/git',
    args: [
      '--git-dir',
      remote,
      'rev-parse',
      'refs/heads/main',
    ],
  },)).stdout;
  await writeFile(
    `${repository}/push.txt`,
    'push missing',
  );
  await execute({
    command: '/usr/bin/git',
    args: [
      'add',
      'push.txt',
    ],
    cwd: repository,
  },);
  await execute({
    command: '/usr/bin/git',
    args: [
      'commit',
      '--quiet',
      '--message=noncanonical push fixture',
    ],
    cwd: repository,
  },);
  /**
   * Read-only manual-push finding from packed wrapper.
   */
  const pushed = await execute({
    command: 'git',
    args: [
      'push',
      'origin',
      'main:main',
    ],
    expectedExit: 1,
    cwd: repository,
    env,
  },);
  assertIncludes({
    text: pushed.stderr,
    expected: '"policyId":"final-newline"',
    context: 'packed final-newline manual push',
  },);
  /**
   * Remote main after rejected noncanonical push.
   */
  const remoteAfter = (await execute({
    command: '/usr/bin/git',
    args: [
      '--git-dir',
      remote,
      'rev-parse',
      'refs/heads/main',
    ],
  },)).stdout;
  assertFixtureEqual({
    actual: remoteAfter,
    expected: remoteBefore,
    context: 'manual-push remote ref',
  },);
  /**
   * Exact noncanonical local committed blob after read-only push.
   */
  const pushedBlob = await execute({
    command: '/usr/bin/git',
    args: [
      'show',
      'HEAD:push.txt',
    ],
    cwd: repository,
  },);
  assertFixtureEqual({
    actual: pushedBlob.stdout,
    expected: 'push missing',
    context: 'manual-push committed blob bytes',
  },);
  await verifyFinalNewlinePartialCommit({ env, },);
  await verifyFinalNewlineExclusions({ env, },);
}
