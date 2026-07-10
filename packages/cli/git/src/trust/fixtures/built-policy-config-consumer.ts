/**
 * Packed shadow-bin configurable safeguard verification. @module
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
 * Exercises trusted off/warn settings and complete escape controls.
 *
 * @param env - PATH-first packed shadow environment
 *
 * @example
 * ```ts
 * await verifyPolicyConfigConsumer({ env: process.env });
 * ```
 */
export async function verifyPolicyConfigConsumer({
  env,
}: Readonly<{
  env: NodeJS.ProcessEnv;
}>,): Promise<void> {
  /**
   * Disposable configured-policy repository.
   */
  const repository = '/work/policy-config';
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
  /**
   * Trusted severity configuration.
   */
  const configPath = join(
    repository,
    'cli-git.config.mjs',
  );
  await writeFile(
    configPath,
    `export default {
  policies: {
    'linked-worktree-only': 'off',
    'branch-worktree-only': 'warn',
    'add-explicit': 'warn',
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
      'initial config',
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
   * Disabled linked policy forwards guarded stash in main worktree.
   */
  await execute({
    command: 'git',
    args: ['stash',],
    cwd: repository,
    env,
  },);
  /**
   * Warn-safe branch finding forwards and creates branch.
   */
  const branch = await execute({
    command: 'git',
    args: [
      'branch',
      'warn-created',
    ],
    cwd: repository,
    env,
  },);
  assertIncludes({
    text: branch.stderr,
    expected: '"policyId":"branch-worktree-only"',
    context: 'branch warn finding',
  },);
  await execute({
    command: '/usr/bin/git',
    args: [
      'show-ref',
      '--verify',
      'refs/heads/warn-created',
    ],
    cwd: repository,
  },);
  /**
   * Warn-unsafe add finding forwards while retaining warning metadata.
   */
  await writeFile(
    join(
      repository,
      'tracked.txt',
    ),
    'content\n',
  );
  /**
   * Warn-unsafe bulk-add result.
   */
  const add = await execute({
    command: 'git',
    args: [
      'add',
      '.',
    ],
    cwd: repository,
    env,
  },);
  assertIncludes({
    text: add.stderr,
    expected: '"policyId":"add-explicit"',
    context: 'add warn finding',
  },);
  assertIncludes({
    text: add.stderr,
    expected: 'warn-unsafe',
    context: 'add warning metadata',
  },);
  /**
   * Legacy branch escape alias skips finding and is stripped before Git.
   */
  const escaped = await execute({
    command: 'git',
    args: [
      'branch',
      'escaped-created',
      '--no-enforce-worktree-branch',
    ],
    cwd: repository,
    env,
  },);
  if (escaped.stderr
    .includes('branch-worktree-only',))
    throw new Error(`Escaped branch emitted policy finding: ${escaped.stderr}`,);
  await execute({
    command: '/usr/bin/git',
    args: [
      'show-ref',
      '--verify',
      'refs/heads/escaped-created',
    ],
    cwd: repository,
  },);
  /**
   * No-config repository proving default enforcement and generic escapes.
   */
  const defaultsRepository = '/work/policy-defaults';
  await mkdir(defaultsRepository,);
  await execute({
    command: '/usr/bin/git',
    args: [
      'init',
      '--quiet',
    ],
    cwd: defaultsRepository,
  },);
  await execute({
    command: '/usr/bin/git',
    args: [
      'config',
      'user.email',
      'cli-git@example.invalid',
    ],
    cwd: defaultsRepository,
  },);
  await execute({
    command: '/usr/bin/git',
    args: [
      'config',
      'user.name',
      'cli-git fixture',
    ],
    cwd: defaultsRepository,
  },);
  await writeFile(
    join(
      defaultsRepository,
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
    cwd: defaultsRepository,
  },);
  await execute({
    command: '/usr/bin/git',
    args: [
      'commit',
      '--quiet',
      '-m',
      'initial',
    ],
    cwd: defaultsRepository,
  },);
  /**
   * Default linked-worktree policy rejection.
   */
  const linkedBlocked = await execute({
    command: 'git',
    args: ['stash',],
    expectedExit: 1,
    cwd: defaultsRepository,
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
    cwd: defaultsRepository,
    env,
  },);
  await writeFile(
    join(
      defaultsRepository,
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
    cwd: defaultsRepository,
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
    cwd: defaultsRepository,
    env,
  },);
  await execute({
    command: 'git',
    args: [
      'branch',
      'generic-escaped',
      '--no-enforce-branch-worktree-only',
    ],
    cwd: defaultsRepository,
    env,
  },);
  await execute({
    command: 'git',
    args: [
      'add',
      '.',
      '--no-enforce-add-explicit',
    ],
    cwd: defaultsRepository,
    env,
  },);
}
