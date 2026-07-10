/**
 * Packed shadow-bin default safeguard and generic escape verification. @module
 */
import {
  mkdir,
  writeFile,
} from 'node:fs/promises';
import { join, } from 'node:path';
import {
  assertIncludes,
  execute,
} from './built-consumer-helpers.ts';

/**
 * Proves no-config enforcement and generic one-invocation escapes.
 *
 * @param env - PATH-first packed shadow environment
 *
 * @example
 * ```ts
 * await verifyPolicyDefaultConsumer({ env: process.env });
 * ```
 */
export async function verifyPolicyDefaultConsumer({
  env,
}: Readonly<{
  env: NodeJS.ProcessEnv;
}>,): Promise<void> {
  /**
   * No-config repository proving defaults.
   */
  const repository = '/work/policy-defaults';
  await mkdir(repository,);
  await execute({
    command: '/usr/bin/git',
    args: [
      'init',
      '--quiet',
    ],
    cwd: repository,
  },);
  await execute({
    command: '/usr/bin/git',
    args: [
      'config',
      'user.email',
      'cli-git@example.invalid',
    ],
    cwd: repository,
  },);
  await execute({
    command: '/usr/bin/git',
    args: [
      'config',
      'user.name',
      'cli-git fixture',
    ],
    cwd: repository,
  },);
  await writeFile(
    join(
      repository,
      'initial.txt',
    ),
    'initial\n',
  );
  await execute({
    command: '/usr/bin/git',
    args: [
      'add',
      'initial.txt',
    ],
    cwd: repository,
  },);
  await execute({
    command: '/usr/bin/git',
    args: [
      'commit',
      '--quiet',
      '-m',
      'initial',
    ],
    cwd: repository,
  },);
  /**
   * Default linked-worktree policy rejection.
   */
  const linkedBlocked = await execute({
    command: 'git',
    args: ['stash',],
    expectedExit: 1,
    cwd: repository,
    env,
  },);
  /**
   * Default branch-worktree policy rejection.
   */
  const branchBlocked = await execute({
    command: 'git',
    args: [
      'branch',
      'blocked',
    ],
    expectedExit: 1,
    cwd: repository,
    env,
  },);
  await writeFile(
    join(
      repository,
      'bulk.txt',
    ),
    'bulk\n',
  );
  /**
   * Default add-explicit policy rejection.
   */
  const addBlocked = await execute({
    command: 'git',
    args: [
      'add',
      '.',
    ],
    expectedExit: 1,
    cwd: repository,
    env,
  },);
  assertIncludes({
    text: linkedBlocked.stderr,
    expected: '"policyId":"linked-worktree-only"',
    context: 'linked default',
  },);
  assertIncludes({
    text: branchBlocked.stderr,
    expected: '"policyId":"branch-worktree-only"',
    context: 'branch default',
  },);
  assertIncludes({
    text: addBlocked.stderr,
    expected: '"policyId":"add-explicit"',
    context: 'add default',
  },);
  await execute({
    command: 'git',
    args: [
      'stash',
      '--no-enforce-linked-worktree-only',
    ],
    cwd: repository,
    env,
  },);
  await execute({
    command: 'git',
    args: [
      'branch',
      'generic-escaped',
      '--no-enforce-branch-worktree-only',
    ],
    cwd: repository,
    env,
  },);
  await execute({
    command: 'git',
    args: [
      'add',
      '.',
      '--no-enforce-add-explicit',
    ],
    cwd: repository,
    env,
  },);
}
