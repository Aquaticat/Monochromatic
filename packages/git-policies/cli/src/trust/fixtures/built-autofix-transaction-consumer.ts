/**
 * Packed private-index autofix transaction verification.
 *
 * @module
 */
import {
  readFile,
  rm,
  writeFile,
} from 'node:fs/promises';
import { writeAutofixConfig, } from './built-autofix-config.ts';
import { execute, } from './built-consumer-helpers.ts';
import { verifyAutofixConcurrency, } from './built-autofix-concurrency-consumer.ts';
import { verifyAutofixFailures, } from './built-autofix-failure-consumer.ts';
import { verifyAutofixFilesystemFailure, } from './built-autofix-filesystem-consumer.ts';
import { verifyAutofixHistoryModes, } from './built-autofix-history-modes-consumer.ts';
import { verifyAutofixModes, } from './built-autofix-modes-consumer.ts';
import { verifyAutofixRecovery, } from './built-autofix-recovery-consumer.ts';
import { verifyAutofixSequencers, } from './built-autofix-sequencer-consumer.ts';
import { verifyAutofixUnmerged, } from './built-autofix-unmerged-consumer.ts';
import {
  assertFixtureEqual,
  initializePostCommitRepository,
} from './built-post-commit-helpers.ts';

/**
 * Executable private hook mode.
 */
const EXECUTABLE_MODE = 0o700;

/**
 * Resolves exact Git object or index text.
 *
 * @param repository - disposable repository
 *
 * @param revision - Git object expression
 *
 * @returns exact text bytes decoded as fixture UTF-8
 */
async function readGitText({
  repository,
  revision,
}: Readonly<{
  repository: string;
  revision: string;
}>,): Promise<string> {
  return (await execute({
    command: '/usr/bin/git',
    args: [
      'show',
      revision,
    ],
    cwd: repository,
  },)).stdout;
}

/**
 * Exercises both supported private-index commit modes through packed shadow Git.
 *
 * @param env - PATH-first packed shadow environment
 *
 * @example
 * ```ts
 * await verifyAutofixTransactionConsumer({ env: process.env });
 * ```
 */
export async function verifyAutofixTransactionConsumer({ env, }: Readonly<{
  env: NodeJS.ProcessEnv;
}>,): Promise<void> {
  /**
   * Disposable transaction repository.
   */
  const repository = '/work/autofix-transaction';
  await initializePostCommitRepository(repository,);
  await writeAutofixConfig(repository,);
  await writeFile(
    `${repository}/selected.txt`,
    'base\n',
  );
  await writeFile(
    `${repository}/unrelated.txt`,
    'base unrelated\n',
  );
  await writeFile(
    `${repository}/companion.txt`,
    'good companion\n',
  );
  await execute({
    command: '/usr/bin/git',
    args: [
      'add',
      'cli-git.config.mjs',
      'selected.txt',
      'unrelated.txt',
      'companion.txt',
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
   * Explicit-path transaction preserves unrelated staging and worktree tail.
   */
  await writeFile(
    `${repository}/selected.txt`,
    'bad\nTAIL\n',
  );
  await writeFile(
    `${repository}/unrelated.txt`,
    'staged unrelated\n',
  );
  await execute({
    command: '/usr/bin/git',
    args: [
      'add',
      'unrelated.txt',
    ],
    cwd: repository,
  },);
  /**
   * Hook proving inherited Git commands observe patched private index.
   */
  const hookPath = `${repository}/.git/hooks/pre-commit`;
  await writeFile(
    hookPath,
    `#!/usr/bin/env node
const { execFileSync } = require('node:child_process');
const { writeFileSync } = require('node:fs');
const value = execFileSync('/usr/bin/git', ['show', ':selected.txt'], { encoding: 'utf8' });
if (value !== 'good\\n') throw new Error('hook did not observe patched private index');
writeFileSync('.git/private-hook-seen', value);
`,
    { mode: EXECUTABLE_MODE, },
  );
  await execute({
    command: 'git',
    args: [
      '-C',
      repository,
      'commit',
      '--quiet',
      '-m',
      'explicit autofix',
      'selected.*',
    ],
    cwd: '/work',
    env,
  },);
  assertFixtureEqual({
    actual: await readFile(
      `${repository}/.git/private-hook-seen`,
      'utf8',
    ),
    expected: 'good\n',
    context: 'private index hook view',
  },);
  await rm(hookPath,);
  assertFixtureEqual({
    actual: await readGitText({
      repository,
      revision: 'HEAD:selected.txt',
    },),
    expected: 'good\n',
    context: 'explicit committed canonical blob',
  },);
  assertFixtureEqual({
    actual: await readGitText({
      repository,
      revision: ':unrelated.txt',
    },),
    expected: 'staged unrelated\n',
    context: 'explicit unrelated staged blob',
  },);
  assertFixtureEqual({
    actual: await readFile(
      `${repository}/selected.txt`,
      'utf8',
    ),
    expected: 'bad\nTAIL\n',
    context: 'explicit worktree tail',
  },);

  /**
   * Explicit index transaction commits copied staged state and preserves worktree tail.
   */
  await writeFile(
    `${repository}/selected.txt`,
    'bad\n',
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
    'bad\nTAIL\n',
  );
  await execute({
    command: 'git',
    args: [
      'commit',
      '--no-only',
      '--quiet',
      '-m',
      'index autofix',
    ],
    cwd: repository,
    env,
  },);
  assertFixtureEqual({
    actual: await readGitText({
      repository,
      revision: 'HEAD:selected.txt',
    },),
    expected: 'good\n',
    context: 'index committed canonical blob',
  },);
  assertFixtureEqual({
    actual: await readFile(
      `${repository}/selected.txt`,
      'utf8',
    ),
    expected: 'bad\nTAIL\n',
    context: 'index worktree tail',
  },);

  /**
   * Non-overlapping patches on distinct candidates compose in one private index.
   */
  await writeFile(
    `${repository}/selected.txt`,
    'bad\n',
  );
  await writeFile(
    `${repository}/companion.txt`,
    'bad companion\n',
  );
  await writeFile(
    `${repository}/marker.txt`,
    'composed marker\n',
  );
  await execute({
    command: '/usr/bin/git',
    args: [
      'add',
      'selected.txt',
      'companion.txt',
      'marker.txt',
    ],
    cwd: repository,
  },);
  await execute({
    command: 'git',
    args: [
      'commit',
      '--no-only',
      '--quiet',
      '-m',
      'composed autofix',
    ],
    cwd: repository,
    env,
  },);
  assertFixtureEqual({
    actual: await readGitText({
      repository,
      revision: 'HEAD:selected.txt',
    },),
    expected: 'good\n',
    context: 'composed selected blob',
  },);
  assertFixtureEqual({
    actual: await readGitText({
      repository,
      revision: 'HEAD:companion.txt',
    },),
    expected: 'good companion\n',
    context: 'composed companion blob',
  },);

  await verifyAutofixModes({
    repository,
    env,
  },);
  await verifyAutofixHistoryModes({
    repository,
    env,
  },);
  await verifyAutofixUnmerged({
    repository,
    env,
  },);
  await verifyAutofixSequencers({
    repository,
    env,
  },);
  await verifyAutofixConcurrency({
    repository,
    env,
  },);
  await verifyAutofixFailures({
    repository,
    env,
  },);
  await verifyAutofixFilesystemFailure({
    repository,
    env,
  },);
  await verifyAutofixRecovery({
    repository,
    env,
  },);
}
