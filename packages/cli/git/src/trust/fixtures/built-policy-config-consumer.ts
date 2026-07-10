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
  plugins: {
    fixture: {
      name: 'fixture',
      policies: [{
        name: 'transform-view',
        defaultSeverity: 'error',
        warnSafe: false,
        triggers: ['pre-forward'],
        check: async ({ context }) => {
          if (context.command.subcommand !== 'commit') return [];
          const raw = context.command.rawArgs.join('\\0');
          const transformed = context.command.transformedArgs.join('\\0');
          const expectedRaw = ['commit', '-m', 'plugin view', 'plugin.txt'].join('\\0');
          const expectedTransformed = ['commit', '-o', '-m', 'plugin view', 'plugin.txt'].join('\\0');
          return raw === expectedRaw && transformed === expectedTransformed
            ? []
            : [{ code: 'view-mismatch', message: 'fixed transform command facts differ' }];
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
   * Plugin receives exact raw commit plus fixed transformed commit.
   */
  await writeFile(
    join(
      repository,
      'plugin.txt',
    ),
    'plugin\n',
  );
  await execute({
    command: 'git',
    args: [
      'add',
      'plugin.txt',
    ],
    cwd: repository,
    env,
  },);
  await execute({
    command: 'git',
    args: [
      'commit',
      '-m',
      'plugin view',
      'plugin.txt',
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
  assertIncludes({
    text: branch.stderr,
    expected: '"type":"configuration-warning"',
    context: 'machine-readable warning metadata',
  },);
  if (branch.stderr
    .includes('cli-git: Policy',))
    throw new Error(`Warning output was not pure JSONL: ${branch.stderr}`,);
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
}
