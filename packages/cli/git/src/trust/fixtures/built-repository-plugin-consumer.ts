/**
 * Packed repository-plugin lifecycle verification.
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
import { assertFixtureEqual, } from './built-post-commit-helpers.ts';
import {
  installRepositoryPluginConfig,
  REPOSITORY_POLICY_FINDING_CODE,
} from './built-repository-plugin-config.ts';
import { verifyRepositoryPluginSeverities, } from './built-repository-plugin-severity.ts';

/**
 * Exercises repository plugin registration,
 * candidates,
 * severities,
 * escapes,
 * direct checks,
 * and strict trust.
 *
 * @param env - packed shadow environment
 *
 * @example
 * ```ts
 * await verifyRepositoryPluginConsumer({ env: process.env });
 * ```
 */
export async function verifyRepositoryPluginConsumer({ env, }: Readonly<{
  env: NodeJS.ProcessEnv;
}>,): Promise<void> {
  /**
   * Disposable plugin consumer repository.
   */
  const repository = '/work/repository-plugin';
  await mkdir(repository,);
  await execute({
    command: '/usr/bin/git',
    args: [
      'init',
      '--quiet',
      '--initial-branch=main',
    ],
    cwd: repository,
  },);
  await execute({
    command: '/usr/bin/git',
    args: [
      'config',
      'user.email',
      'plugin@example.invalid',
    ],
    cwd: repository,
  },);
  await execute({
    command: '/usr/bin/git',
    args: [
      'config',
      'user.name',
      'plugin fixture',
    ],
    cwd: repository,
  },);
  /**
   * Root trusted TypeScript config.
   */
  const configPath = `${repository}/cli-git.config.ts`;
  await installRepositoryPluginConfig({
    repository,
    configPath,
    severity: 'default',
    env,
  },);

  await mkdir(`${repository}/nested`,);
  await writeFile(
    `${repository}/nested/CONTEXT.md`,
    'nested allowed\n',
  );
  await writeFile(
    `${repository}/--no-enforce-require-root`,
    'literal pathspec\n',
  );
  /**
   * Nested and escape-looking literal pathspec add result.
   */
  const nestedAdd = await execute({
    command: 'git',
    args: [
      'add',
      '--',
      'nested/CONTEXT.md',
      '--no-enforce-require-root',
    ],
    cwd: repository,
    env,
  },);
  assertFixtureEqual({
    actual: nestedAdd.stderr,
    expected: '',
    context: 'nested and separator add output',
  },);
  await execute({
    command: '/usr/bin/git',
    args: [
      'reset',
      '--quiet',
      'HEAD',
      '--',
    ],
    cwd: repository,
  },);

  await writeFile(
    `${repository}/CONTEXT.md`,
    'root forbidden\n',
  );
  /**
   * Default error add finding on stderr with no real staging.
   */
  const blockedAdd = await execute({
    command: 'git',
    args: [
      'add',
      'CONTEXT.md',
    ],
    expectedExit: 1,
    cwd: repository,
    env,
  },);
  assertJsonl({
    text: blockedAdd.stderr,
    expectedCode: REPOSITORY_POLICY_FINDING_CODE,
    context: 'root add finding',
  },);
  assertFixtureEqual({
    actual: blockedAdd.stdout,
    expected: '',
    context: 'root add stdout',
  },);
  assertFixtureEqual({
    actual: (await execute({
      command: '/usr/bin/git',
      args: [
        'diff',
        '--cached',
        '--name-only',
      ],
      cwd: repository,
    },)).stdout,
    expected: '',
    context: 'blocked root add index',
  },);

  /**
   * Generic full-lifecycle escape is stripped and permits real add.
   */
  await execute({
    command: 'git',
    args: [
      'add',
      'CONTEXT.md',
      '--no-enforce-mono/forbidden-root-context',
    ],
    cwd: repository,
    env,
  },);
  await execute({
    command: '/usr/bin/git',
    args: [
      'reset',
      '--quiet',
      'HEAD',
      '--',
    ],
    cwd: repository,
  },);

  /**
   * Commit candidate from real index blocks while preserving staged state.
   */
  await execute({
    command: '/usr/bin/git',
    args: [
      'add',
      'CONTEXT.md',
    ],
    cwd: repository,
  },);
  /**
   * Blocking commit policy result.
   */
  const blockedCommit = await execute({
    command: 'git',
    args: [
      'commit',
      '--no-only',
      '--quiet',
      '-m',
      'blocked root context',
    ],
    expectedExit: 1,
    cwd: repository,
    env,
  },);
  assertJsonl({
    text: blockedCommit.stderr,
    expectedCode: REPOSITORY_POLICY_FINDING_CODE,
    context: 'root commit finding',
  },);
  assertIncludes({
    text: (await execute({
      command: '/usr/bin/git',
      args: [
        'diff',
        '--cached',
        '--name-only',
      ],
      cwd: repository,
    },)).stdout,
    expected: 'CONTEXT.md',
    context: 'blocked root commit index',
  },);
  await execute({
    command: '/usr/bin/git',
    args: [
      'reset',
      '--quiet',
      'HEAD',
      '--',
    ],
    cwd: repository,
  },);

  /**
   * Direct check finding is pure stdout JSONL.
   */
  const direct = await execute({
    command: 'git',
    args: [
      'cli-git',
      'check',
      '--policy',
      'mono/forbidden-root-context',
      '--',
      'CONTEXT.md',
    ],
    expectedExit: 1,
    cwd: repository,
    env,
  },);
  assertJsonl({
    text: direct.stdout,
    expectedCode: REPOSITORY_POLICY_FINDING_CODE,
    context: 'root direct check',
  },);
  assertFixtureEqual({
    actual: direct.stderr,
    expected: '',
    context: 'direct check stderr',
  },);
  await execute({
    command: 'git',
    args: [
      'cli-git',
      'check',
      '--policy',
      'mono/forbidden-root-context',
      '--',
      'nested/CONTEXT.md',
    ],
    cwd: repository,
    env,
  },);
  /**
   * Complete direct scope finds untracked root candidate on stdout.
   */
  const directAll = await execute({
    command: 'git',
    args: [
      'cli-git',
      'check',
      '--policy',
      'mono/forbidden-root-context',
      '--all',
    ],
    expectedExit: 1,
    cwd: repository,
    env,
  },);
  assertJsonl({
    text: directAll.stdout,
    expectedCode: REPOSITORY_POLICY_FINDING_CODE,
    context: 'root direct all check',
  },);
  assertFixtureEqual({
    actual: directAll.stderr,
    expected: '',
    context: 'direct all check stderr',
  },);

  await verifyRepositoryPluginSeverities({
    repository,
    configPath,
    env,
  },);
}
