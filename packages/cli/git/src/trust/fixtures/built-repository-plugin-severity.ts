/**
 * Packed repository-plugin trust and severity verification.
 *
 * @module
 */
import { writeFile, } from 'node:fs/promises';
import {
  assertIncludes,
  assertJsonl,
  execute,
} from './built-consumer-helpers.ts';
import { assertFixtureEqual, } from './built-post-commit-helpers.ts';
import {
  installRepositoryPluginConfig,
  REPOSITORY_POLICY_FINDING_CODE,
  repositoryPluginConfigSource,
} from './built-repository-plugin-config.ts';

/**
 * Exercises changed-source trust plus warn and off severities.
 *
 * @param repository - disposable repository
 *
 * @param configPath - root TypeScript config
 *
 * @param env - packed wrapper environment
 *
 * @example
 * ```ts
 * await verifyRepositoryPluginSeverities({ repository, configPath, env });
 * ```
 */
export async function verifyRepositoryPluginSeverities({
  repository,
  configPath,
  env,
}: Readonly<{
  repository: string;
  configPath: string;
  env: NodeJS.ProcessEnv;
}>,): Promise<void> {
  await writeFile(
    configPath,
    repositoryPluginConfigSource('warn',),
  );
  /**
   * Strict changed-source trust rejection.
   */
  const changed = await execute({
    command: 'git',
    args: ['future-command',],
    expectedExit: 2,
    cwd: repository,
    env,
  },);
  assertIncludes({
    text: changed.stderr,
    expected: '"type":"engine-failure"',
    context: 'changed TypeScript config',
  },);
  await execute({
    command: '/usr/bin/git',
    args: [
      'add',
      'cli-git.config.ts',
    ],
    cwd: repository,
  },);
  await execute({
    command: '/usr/bin/git',
    args: [
      'commit',
      '--quiet',
      '-m',
      'config warn',
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
   * Warn-safe finding forwards add while retaining JSONL.
   */
  const warned = await execute({
    command: 'git',
    args: [
      'add',
      'CONTEXT.md',
    ],
    cwd: repository,
    env,
  },);
  assertJsonl({
    text: warned.stderr,
    expectedCode: REPOSITORY_POLICY_FINDING_CODE,
    context: 'warn root add',
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

  await installRepositoryPluginConfig({
    repository,
    configPath,
    severity: 'off',
    env,
  },);
  /**
   * Off severity forwards without plugin output.
   */
  const disabled = await execute({
    command: 'git',
    args: [
      'add',
      'CONTEXT.md',
    ],
    cwd: repository,
    env,
  },);
  assertFixtureEqual({
    actual: disabled.stderr,
    expected: '',
    context: 'off root add output',
  },);
}
