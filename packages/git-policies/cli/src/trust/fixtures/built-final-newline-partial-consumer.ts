/**
 * Packed final-newline partial-staging regression verification.
 *
 * @module
 */
import {
  readFile,
  writeFile,
} from 'node:fs/promises';
import { execute, } from './built-consumer-helpers.ts';
import {
  assertFixtureEqual,
  initializePostCommitRepository,
} from './built-post-commit-helpers.ts';

/**
 * Exercises missing-LF staged prefix with exact unstaged tail preservation.
 *
 * @param env - PATH-first packed shadow environment
 *
 * @example
 * ```ts
 * await verifyFinalNewlinePartialCommit({ env: process.env });
 * ```
 */
export async function verifyFinalNewlinePartialCommit({ env, }: Readonly<{
  env: NodeJS.ProcessEnv;
}>,): Promise<void> {
  /**
   * Disposable partial-staging repository.
   */
  const repository = '/work/final-newline-partial';
  await initializePostCommitRepository(repository,);
  await writeFile(
    `${repository}/cli-git.config.mjs`,
    'export default {};\n',
  );
  await writeFile(
    `${repository}/partial.txt`,
    'baseline\n',
  );
  await execute({
    command: '/usr/bin/git',
    args: [
      'add',
      'cli-git.config.mjs',
      'partial.txt',
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
    command: 'git',
    args: [
      'cli-git',
      'trust',
      '--yes',
    ],
    cwd: repository,
    env,
  },);
  await writeFile(
    `${repository}/partial.txt`,
    'staged',
  );
  await execute({
    command: '/usr/bin/git',
    args: [
      'add',
      'partial.txt',
    ],
    cwd: repository,
  },);
  await writeFile(
    `${repository}/partial.txt`,
    'staged\nunstaged\n',
  );
  /**
   * Exact partially staged worktree bytes before private correction.
   */
  const worktreeBefore = Buffer.from(await readFile(`${repository}/partial.txt`,))
    .toString('base64',);
  await execute({
    command: 'git',
    args: [
      'commit',
      '--quiet',
      '--message=partial newline correction',
      '--no-only',
    ],
    cwd: repository,
    env,
  },);
  /**
   * Canonical committed staged prefix.
   */
  const committed = await execute({
    command: '/usr/bin/git',
    args: [
      'show',
      'HEAD:partial.txt',
    ],
    cwd: repository,
  },);
  assertFixtureEqual({
    actual: committed.stdout,
    expected: 'staged\n',
    context: 'partial commit canonical blob',
  },);
  assertFixtureEqual({
    actual: Buffer.from(await readFile(`${repository}/partial.txt`,))
      .toString('base64',),
    expected: worktreeBefore,
    context: 'partial commit exact worktree tail',
  },);
}
