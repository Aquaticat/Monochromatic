/**
 * Packed forbidden-strings lifecycle scenarios.
 *
 * @module
 */
import {
  mkdir,
  writeFile,
} from 'node:fs/promises';
import {
  assertIncludes,
  assertJsonl,
  execute,
} from './built-consumer-helpers.ts';
import {
  FINDING_CODE,
  forbiddenHeadOid,
  initializeForbiddenRepository,
} from './built-forbidden-strings-helpers.ts';

/**
 * Exercises predicted, direct, escaped, and manual-push content.
 *
 * @param env - packed wrapper environment
 *
 * @example
 * ```ts
 * await verifyForbiddenLifecycle(process.env);
 * ```
 */
export async function verifyForbiddenLifecycle(env: NodeJS.ProcessEnv,): Promise<void> {
  /**
   * Local policy repository.
   */
  const repository = '/work/forbidden-lifecycle';
  /**
   * Bare destination repository.
   */
  const remote = '/work/forbidden-lifecycle-origin.git';
  await initializeForbiddenRepository({
    repository,
    env,
  },);
  await mkdir(
    remote,
    { recursive: true, },
  );
  await execute({
    command: '/usr/bin/git',
    args: [
      'init',
      '--bare',
      '--quiet',
    ],
    cwd: remote,
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
      'HEAD:refs/heads/main',
    ],
    cwd: repository,
  },);

  await writeFile(
    `${repository}/direct.txt`,
    'FORBIDDEN_SCANNER\n',
  );
  /**
   * Direct-check scanner finding.
   */
  const direct = await execute({
    command: 'git',
    args: [
      'cli-git',
      'check',
      '--policy',
      'security/forbidden-strings',
      '--',
      'direct.txt',
    ],
    expectedExit: 1,
    cwd: repository,
    env,
  },);
  assertJsonl({
    text: direct.stdout,
    expectedCode: FINDING_CODE,
    context: 'forbidden direct check',
  },);

  await execute({
    command: '/usr/bin/git',
    args: [
      'add',
      'direct.txt',
    ],
    cwd: repository,
  },);
  /**
   * Commit state before blocked pre-forward policy.
   */
  const beforeBlocked = await forbiddenHeadOid(repository,);
  /**
   * Pre-forward scanner finding.
   */
  const blocked = await execute({
    command: 'git',
    args: [
      'commit',
      '--no-only',
      '--quiet',
      '-m',
      'blocked predicted content',
    ],
    expectedExit: 1,
    cwd: repository,
    env,
  },);
  assertJsonl({
    text: blocked.stderr,
    expectedCode: FINDING_CODE,
    context: 'forbidden pre-forward',
  },);
  if (await forbiddenHeadOid(repository,) !== beforeBlocked)
    throw new Error('Forbidden pre-forward finding created a commit.',);

  await execute({
    command: 'git',
    args: [
      'commit',
      '--no-only',
      '--quiet',
      '-m',
      'explicit lifecycle escape',
      '--no-enforce-security/forbidden-strings',
    ],
    cwd: repository,
    env,
  },);
  /**
   * Escaped commit backed up by auto-push.
   */
  const escapedOid = await forbiddenHeadOid(repository,);
  if ((await execute({
    command: '/usr/bin/git',
    args: [
      'rev-parse',
      'refs/heads/main',
    ],
    cwd: remote,
  },)).stdout !== escapedOid)
    throw new Error('Full-lifecycle escape did not permit commit backup.',);

  await writeFile(
    `${repository}/outside.txt`,
    'FORBIDDEN_SCANNER\n',
  );
  await execute({
    command: '/usr/bin/git',
    args: [
      'add',
      'outside.txt',
    ],
    cwd: repository,
  },);
  await execute({
    command: '/usr/bin/git',
    args: [
      'commit',
      '--quiet',
      '-m',
      'outside wrapper',
    ],
    cwd: repository,
  },);
  /**
   * Manual-push scanner finding.
   */
  const manual = await execute({
    command: 'git',
    args: [
      'push',
      'origin',
      'HEAD:refs/heads/main',
    ],
    expectedExit: 1,
    cwd: repository,
    env,
  },);
  assertJsonl({
    text: manual.stderr,
    expectedCode: FINDING_CODE,
    context: 'forbidden manual push',
  },);
  if ((await execute({
    command: '/usr/bin/git',
    args: [
      'rev-parse',
      'refs/heads/main',
    ],
    cwd: remote,
  },)).stdout !== escapedOid)
    throw new Error('Manual-push finding changed destination.',);
}

/**
 * Exercises landed-tree finding after clean predicted scan.
 *
 * @param env - packed wrapper environment
 *
 * @example
 * ```ts
 * await verifyForbiddenPostCommit(process.env);
 * ```
 */
export async function verifyForbiddenPostCommit(env: NodeJS.ProcessEnv,): Promise<void> {
  /**
   * Local post-commit repository.
   */
  const repository = '/work/forbidden-post';
  /**
   * Bare destination repository.
   */
  const remote = '/work/forbidden-post-origin.git';
  await initializeForbiddenRepository({
    repository,
    env,
  },);
  await mkdir(
    remote,
    { recursive: true, },
  );
  await execute({
    command: '/usr/bin/git',
    args: [
      'init',
      '--bare',
      '--quiet',
    ],
    cwd: remote,
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
      'HEAD:refs/heads/main',
    ],
    cwd: repository,
  },);
  /**
   * Destination state before landed finding.
   */
  const remoteBefore = (await execute({
    command: '/usr/bin/git',
    args: [
      'rev-parse',
      'refs/heads/main',
    ],
    cwd: remote,
  },)).stdout;
  await writeFile(
    `${repository}/post.txt`,
    'POST_ONLY_FORBIDDEN\n',
  );
  await execute({
    command: '/usr/bin/git',
    args: [
      'add',
      'post.txt',
    ],
    cwd: repository,
  },);
  /**
   * Post-commit scanner finding.
   */
  const result = await execute({
    command: 'git',
    args: [
      'commit',
      '--no-only',
      '-m',
      'land then block backup',
    ],
    expectedExit: 2,
    cwd: repository,
    env,
  },);
  assertIncludes({
    text: result.stderr,
    expected: FINDING_CODE,
    context: 'post-commit finding',
  },);
  assertIncludes({
    text: result.stderr,
    expected: 'commit-landed',
    context: 'post-commit landed state',
  },);
  if ((await forbiddenHeadOid(repository,)) === remoteBefore)
    throw new Error('Post-commit fixture did not retain landed commit.',);
  if ((await execute({
    command: '/usr/bin/git',
    args: [
      'rev-parse',
      'refs/heads/main',
    ],
    cwd: remote,
  },)).stdout !== remoteBefore)
    throw new Error('Post-commit finding reached destination.',);
}
