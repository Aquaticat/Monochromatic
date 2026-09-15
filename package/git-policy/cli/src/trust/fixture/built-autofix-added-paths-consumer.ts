/**
 * Packed verification of policy patches that add unchanged tracked paths to a commit.
 *
 * @module
 */
import {
  readFile,
  writeFile,
} from 'node:fs/promises';
import {
  assertAddedPathCommitted,
  gitText,
  realGit,
  resetScenario,
} from './built-autofix-added-paths-helpers.ts';
import { verifyAddedPathConclusions, } from './built-autofix-added-paths-conclusion.ts';
import { verifyAddedPathDirectFix, } from './built-autofix-added-paths-direct-fix.ts';
import { verifyAddedPathRecovery, } from './built-autofix-added-paths-recovery.ts';
import {
  assertIncludes,
  execute,
} from './built-consumer-helpers.ts';
import {
  assertFixtureEqual,
  initializePostCommitRepository,
} from './built-post-commit-helpers.ts';

/**
 * Trusted MJS policy: whenever `version.txt` differs from `HEAD`, `dependent.txt` must read `bumped`.
 * It targets `dependent.txt` through `trackedFiles`, so the engine adds that path when it is not a candidate.
 */
const ADDED_PATH_CONFIG = `export default {
  plugins: {
    fixture: {
      name: 'fixture',
      policies: [{
        name: 'dependent-bump',
        defaultSeverity: 'error',
        warnSafe: false,
        triggers: ['pre-forward', 'direct-fix'],
        check: async ({ context }) => {
          const candidates = await context.git.candidates();
          if (!candidates.some(({ path }) => path === 'version.txt')) return [];
          const [dependent] = await context.git.trackedFiles({ pathspecs: ['dependent.txt'] });
          if (dependent === undefined) throw new Error('fixture needs tracked dependent.txt');
          const value = new TextDecoder().decode(await dependent.bytes());
          if (value === 'bumped\\n') return [];
          const patch = [
            'diff --git a/dependent.txt b/dependent.txt',
            'index ' + dependent.revision + '..0000000000000000000000000000000000000000 100644',
            '--- a/dependent.txt',
            '+++ b/dependent.txt',
            '@@ -1 +1 @@',
            '-' + value.slice(0, -1),
            '+bumped',
            '',
          ].join('\\n');
          return [{
            code: 'dependent-stale',
            message: 'dependent.txt must follow version.txt',
            path: 'dependent.txt',
            patch: {
              kind: 'git-unified',
              targetId: dependent.targetId,
              path: 'dependent.txt',
              bytes: new TextEncoder().encode(patch),
            },
          }];
        },
      }],
    },
  },
};
`;

/**
 * Exercises explicit-path, index, amend, conflict, and read-only selection behavior for added paths.
 *
 * @param env - PATH-first packed shadow environment
 *
 * @example
 * ```ts
 * await verifyAutofixAddedPaths({ env: process.env });
 * ```
 */
export async function verifyAutofixAddedPaths({ env, }: Readonly<{
  env: NodeJS.ProcessEnv;
}>,): Promise<void> {
  /**
   * Disposable repository for added-path scenarios.
   */
  const repository = '/work/autofix-added-paths';
  await initializePostCommitRepository(repository,);
  await writeFile(
    `${repository}/cli-git.config.mjs`,
    ADDED_PATH_CONFIG,
  );
  await writeFile(
    `${repository}/version.txt`,
    'v0\n',
  );
  await writeFile(
    `${repository}/dependent.txt`,
    'stale\n',
  );
  await realGit({
    repository,
    args: [
      'add',
      'cli-git.config.mjs',
      'version.txt',
      'dependent.txt',
    ],
  },);
  await realGit({
    repository,
    args: [
      'commit',
      '--quiet',
      '-m',
      'baseline',
    ],
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

  //region Explicit-path commit adds the clean dependent

  await writeFile(
    `${repository}/version.txt`,
    'v1\n',
  );
  await execute({
    command: 'git',
    args: [
      'commit',
      '--quiet',
      '-m',
      'explicit bump',
      'version.txt',
    ],
    cwd: repository,
    env,
  },);
  await assertAddedPathCommitted({
    repository,
    context: 'explicit-path',
  },);

  //endregion Explicit-path commit adds the clean dependent

  //region Index commit adds the clean dependent

  await resetScenario({
    repository,
    round: 'v2',
  },);
  await realGit({
    repository,
    args: [
      'add',
      'version.txt',
    ],
  },);
  await execute({
    command: 'git',
    args: [
      'commit',
      '--no-only',
      '--quiet',
      '-m',
      'index bump',
    ],
    cwd: repository,
    env,
  },);
  await assertAddedPathCommitted({
    repository,
    context: 'index',
  },);

  //endregion Index commit adds the clean dependent

  //region Amend adds the clean dependent

  await resetScenario({
    repository,
    round: 'v3',
  },);
  await realGit({
    repository,
    args: [
      'add',
      'version.txt',
    ],
  },);
  await realGit({
    repository,
    args: [
      'commit',
      '--quiet',
      '-m',
      'bump without policy',
    ],
  },);
  await realGit({
    repository,
    args: [
      'commit',
      '--quiet',
      '--allow-empty',
      '-m',
      'placeholder',
    ],
  },);
  await writeFile(
    `${repository}/version.txt`,
    'v3 amended\n',
  );
  await execute({
    command: 'git',
    args: [
      'commit',
      '--amend',
      '--quiet',
      '-m',
      'amended bump',
      'version.txt',
    ],
    cwd: repository,
    env,
  },);
  await assertAddedPathCommitted({
    repository,
    context: 'amend',
  },);

  //endregion Amend adds the clean dependent

  //region Local changes to the dependent block without touching state

  await resetScenario({
    repository,
    round: 'v4',
  },);
  await writeFile(
    `${repository}/dependent.txt`,
    'local edit\n',
  );
  /**
   * HEAD before the blocked commit.
   */
  const headBeforeDirty = await realGit({
    repository,
    args: [
      'rev-parse',
      'HEAD',
    ],
  },);
  /**
   * Blocked dirty-worktree commit.
   */
  const dirty = await execute({
    command: 'git',
    args: [
      'commit',
      '--quiet',
      '-m',
      'dirty dependent',
      'version.txt',
    ],
    cwd: repository,
    env,
    expectedExit: 2,
  },);
  assertIncludes({
    text: `${dirty.stdout}${dirty.stderr}`,
    expected: 'its worktree copy has unstaged changes',
    context: 'dirty dependent diagnostic',
  },);
  assertIncludes({
    text: dirty.stderr,
    expected: '"code":"patch-conflict"',
    context: 'dirty dependent failure code',
  },);
  assertFixtureEqual({
    actual: await realGit({
      repository,
      args: [
        'rev-parse',
        'HEAD',
      ],
    },),
    expected: headBeforeDirty,
    context: 'dirty dependent HEAD unchanged',
  },);
  assertFixtureEqual({
    actual: await readFile(
      `${repository}/dependent.txt`,
      'utf8',
    ),
    expected: 'local edit\n',
    context: 'dirty dependent worktree unchanged',
  },);

  await writeFile(
    `${repository}/dependent.txt`,
    'staged edit\n',
  );
  await realGit({
    repository,
    args: [
      'add',
      'dependent.txt',
    ],
  },);
  await writeFile(
    `${repository}/dependent.txt`,
    'stale\n',
  );
  /**
   * Blocked commit whose dependent has staged changes outside the explicit selection.
   */
  const staged = await execute({
    command: 'git',
    args: [
      'commit',
      '--quiet',
      '-m',
      'staged dependent',
      'version.txt',
    ],
    cwd: repository,
    env,
    expectedExit: 2,
  },);
  assertIncludes({
    text: `${staged.stdout}${staged.stderr}`,
    expected: 'it has staged changes',
    context: 'staged dependent diagnostic',
  },);
  assertFixtureEqual({
    actual: await gitText({
      repository,
      revision: ':dependent.txt',
    },),
    expected: 'staged edit\n',
    context: 'staged dependent index unchanged',
  },);
  await realGit({
    repository,
    args: [
      'restore',
      '--staged',
      '--worktree',
      '--',
      'dependent.txt',
    ],
  },);

  //endregion Local changes to the dependent block without touching state

  //region Read-only selection refuses automatic fixes

  /**
   * Blocked include-selection commit.
   */
  const include = await execute({
    command: 'git',
    args: [
      'commit',
      '--quiet',
      '--include',
      '-m',
      'include bump',
      'version.txt',
    ],
    cwd: repository,
    env,
    expectedExit: 1,
  },);
  assertIncludes({
    text: `${include.stdout}${include.stderr}`,
    expected: '"code":"fixture/dependent-bump/dependent-stale"',
    context: 'include selection finding',
  },);
  assertFixtureEqual({
    actual: await readFile(
      `${repository}/dependent.txt`,
      'utf8',
    ),
    expected: 'stale\n',
    context: 'include selection worktree unchanged',
  },);

  //endregion Read-only selection refuses automatic fixes

  await verifyAddedPathConclusions({
    repository,
    env,
  },);
  await verifyAddedPathRecovery({
    repository,
    env,
  },);
  await verifyAddedPathDirectFix({
    repository,
    env,
  },);
}
