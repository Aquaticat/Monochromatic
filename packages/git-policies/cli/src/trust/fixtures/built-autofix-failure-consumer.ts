/**
 * Packed private-index autofix failure preservation verification.
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
import {
  assertFixtureEqual,
  resolveFixtureOid,
} from './built-post-commit-helpers.ts';

/**
 * Executable private hook mode.
 */
const EXECUTABLE_MODE = 0o700;

/**
 * Encodes exact binary real index for equality checks.
 *
 * @param repository - disposable repository
 *
 * @returns reversible index bytes
 */
async function readIndexBase64(repository: string,): Promise<string> {
  return Buffer.from(await readFile(`${repository}/.git/index`,))
    .toString('base64',);
}

/**
 * Exercises policy and overlap failures without real-state mutation.
 *
 * @param repository - initialized trusted fixture repository
 *
 * @param env - PATH-first packed shadow environment
 *
 * @example
 * ```ts
 * await verifyAutofixFailures({ repository: '/work/repo', env: process.env });
 * ```
 */
export async function verifyAutofixFailures({
  repository,
  env,
}: Readonly<{
  repository: string;
  env: NodeJS.ProcessEnv;
}>,): Promise<void> {
  /**
   * Failed real Git commit after patching leaves real state unchanged.
   */
  await writeFile(
    `${repository}/selected.txt`,
    'bad\n',
  );
  await writeFile(
    `${repository}/hook-marker.txt`,
    'hook marker\n',
  );
  await execute({
    command: '/usr/bin/git',
    args: [
      'add',
      'selected.txt',
      'hook-marker.txt',
    ],
    cwd: repository,
  },);
  await writeFile(
    `${repository}/selected.txt`,
    'bad\nTAIL\n',
  );
  /**
   * Exact index before hook-rejected commit.
   */
  const hookIndex = await readIndexBase64(repository,);
  /**
   * Exact ref before hook-rejected commit.
   */
  const hookHead = await resolveFixtureOid({ repository, },);
  /**
   * Disposable failing Node pre-commit hook.
   */
  const hookPath = `${repository}/.git/hooks/pre-commit`;
  await writeFile(
    hookPath,
    '#!/usr/bin/env node\nthrow new Error("fixture hook failure");\n',
    { mode: EXECUTABLE_MODE, },
  );
  await execute({
    command: 'git',
    args: [
      'commit',
      '--no-only',
      '--quiet',
      '-m',
      'hook failure',
    ],
    expectedExit: 1,
    cwd: repository,
    env,
  },);
  await rm(hookPath,);
  assertFixtureEqual({
    actual: await readIndexBase64(repository,),
    expected: hookIndex,
    context: 'hook failure index',
  },);
  assertFixtureEqual({
    actual: await resolveFixtureOid({ repository, },),
    expected: hookHead,
    context: 'hook failure ref',
  },);
  assertFixtureEqual({
    actual: await readFile(
      `${repository}/selected.txt`,
      'utf8',
    ),
    expected: 'bad\nTAIL\n',
    context: 'hook failure worktree',
  },);

  /**
   * Policy failure leaves exact real index, worktree, and ref unchanged.
   */
  await writeFile(
    `${repository}/selected.txt`,
    'throw\n',
  );
  await execute({
    command: '/usr/bin/git',
    args: [
      'add',
      'selected.txt',
    ],
    cwd: repository,
  },);
  await writeFile(
    `${repository}/selected.txt`,
    'throw\nTAIL\n',
  );
  /**
   * Exact real index before policy exception.
   */
  const failureIndex = await readIndexBase64(repository,);
  /**
   * Exact ref before policy exception.
   */
  const failureHead = await resolveFixtureOid({ repository, },);
  /**
   * Captured stable policy failure.
   */
  const failed = await execute({
    command: 'git',
    args: [
      'commit',
      '--no-only',
      '--quiet',
      '-m',
      'failed autofix',
    ],
    expectedExit: 2,
    cwd: repository,
    env,
  },);
  assertIncludes({
    text: failed.stderr,
    expected: 'fixture autofix failure',
    context: 'policy failure diagnostic',
  },);
  assertFixtureEqual({
    actual: await readIndexBase64(repository,),
    expected: failureIndex,
    context: 'policy failure index',
  },);
  assertFixtureEqual({
    actual: await resolveFixtureOid({ repository, },),
    expected: failureHead,
    context: 'policy failure ref',
  },);
  assertFixtureEqual({
    actual: await readFile(
      `${repository}/selected.txt`,
      'utf8',
    ),
    expected: 'throw\nTAIL\n',
    context: 'policy failure worktree',
  },);

  /**
   * Overlapping proposals conflict only in private state and block.
   */
  await writeFile(
    `${repository}/selected.txt`,
    'overlap\n',
  );
  await execute({
    command: '/usr/bin/git',
    args: [
      'add',
      'selected.txt',
    ],
    cwd: repository,
  },);
  await writeFile(
    `${repository}/selected.txt`,
    'overlap\nTAIL\n',
  );
  /**
   * Exact real index before overlap conflict.
   */
  const conflictIndex = await readIndexBase64(repository,);
  /**
   * Exact ref before overlap conflict.
   */
  const conflictHead = await resolveFixtureOid({ repository, },);
  /**
   * Captured private patch conflict.
   */
  const conflicted = await execute({
    command: 'git',
    args: [
      'commit',
      '--no-only',
      '--quiet',
      '-m',
      'conflicting autofix',
    ],
    expectedExit: 2,
    cwd: repository,
    env,
  },);
  assertIncludes({
    text: conflicted.stderr,
    expected: '"code":"patch-conflict"',
    context: 'patch conflict diagnostic',
  },);
  assertIncludes({
    text: conflicted.stderr,
    expected: '"path":"selected.txt"',
    context: 'patch conflict path',
  },);
  assertFixtureEqual({
    actual: await readIndexBase64(repository,),
    expected: conflictIndex,
    context: 'patch conflict index',
  },);
  assertFixtureEqual({
    actual: await resolveFixtureOid({ repository, },),
    expected: conflictHead,
    context: 'patch conflict ref',
  },);
  assertFixtureEqual({
    actual: await readFile(
      `${repository}/selected.txt`,
      'utf8',
    ),
    expected: 'overlap\nTAIL\n',
    context: 'patch conflict worktree',
  },);
}
