/**
 * Packed private-index autofix transaction verification.
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
  /**
   * Trusted policy that canonicalizes selected fixture content.
   */
  const configPath = `${repository}/cli-git.config.mjs`;
  await writeFile(
    configPath,
    `export default {
  plugins: {
    fixture: {
      name: 'fixture',
      policies: [{
        name: 'canonical',
        defaultSeverity: 'error',
        warnSafe: false,
        triggers: ['pre-forward'],
        check: async ({ context }) => {
          const candidates = await context.git.candidates();
          const candidate = candidates.find(({ path }) => path === 'selected.txt');
          if (candidate === undefined) return [];
          const value = new TextDecoder().decode(await candidate.bytes());
          if (value === 'good\\n') return [];
          if (typeof candidate.revision === 'symbol') throw new Error('fixture needs tracked candidate');
          const oldLines = value.endsWith('\\n')
            ? value.slice(0, -1).split('\\n')
            : value.split('\\n');
          const patch = [
            'diff --git a/selected.txt b/selected.txt',
            'index ' + candidate.revision + '..0000000000000000000000000000000000000000 100644',
            '--- a/selected.txt',
            '+++ b/selected.txt',
            '@@ -1,' + oldLines.length + ' +1 @@',
            ...oldLines.map((line) => '-' + line),
            '+good',
            '',
          ].join('\\n');
          return [{
            code: 'noncanonical',
            message: 'selected content is not canonical',
            path: candidate.path,
            patch: {
              kind: 'git-unified',
              targetId: candidate.targetId,
              path: candidate.path,
              bytes: new TextEncoder().encode(patch),
            },
          }];
        },
      }],
    },
  },
};
`,
  );
  await writeFile(
    `${repository}/selected.txt`,
    'base\n',
  );
  await writeFile(
    `${repository}/unrelated.txt`,
    'base unrelated\n',
  );
  await execute({
    command: '/usr/bin/git',
    args: [
      'add',
      'cli-git.config.mjs',
      'selected.txt',
      'unrelated.txt',
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
  await execute({
    command: 'git',
    args: [
      'commit',
      '--quiet',
      '-m',
      'explicit autofix',
      'selected.txt',
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
}
