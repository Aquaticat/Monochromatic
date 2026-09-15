/**
 * Packed verification that merge, cherry-pick, and revert conclusions add unchanged tracked paths.
 *
 * @module
 */
import {
  rm,
  writeFile,
} from 'node:fs/promises';
import {
  assertAddedPathCommitted,
  commitFiles,
  realGit,
} from './built-autofix-added-paths-helpers.ts';
import { execute, } from './built-consumer-helpers.ts';
import {
  assertFixtureEqual,
  resolveFixtureOid,
} from './built-post-commit-helpers.ts';

/**
 * Concludes a pending sequencer or merge state through the packed shim.
 *
 * @param repository - disposable repository
 *
 * @param env - packed shadow environment
 *
 * @param message - conclusion commit message
 */
async function concludeThroughShim({
  repository,
  env,
  message,
}: Readonly<{
  repository: string;
  env: NodeJS.ProcessEnv;
  message: string;
}>,): Promise<void> {
  await execute({
    command: 'git',
    args: [
      'commit',
      '--quiet',
      '-m',
      message,
    ],
    cwd: repository,
    env,
  },);
}

/**
 * Exercises merge, cherry-pick, and revert conclusions whose staged `version.txt` requires adding `dependent.txt`.
 *
 * @param repository - trusted added-path repository on `main`
 *
 * @param env - packed shadow environment
 *
 * @example
 * ```ts
 * await verifyAddedPathConclusions({ repository: '/work/autofix-added-paths', env: process.env });
 * ```
 */
export async function verifyAddedPathConclusions({
  repository,
  env,
}: Readonly<{
  repository: string;
  env: NodeJS.ProcessEnv;
}>,): Promise<void> {
  //region Merge conclusion adds the clean dependent

  await commitFiles({
    repository,
    files: {
      'version.txt': 'merge base\n',
      'dependent.txt': 'stale\n',
    },
    message: 'merge baseline',
  },);
  await realGit({
    repository,
    args: [
      'switch',
      '--quiet',
      '--create',
      'added-merge-feature',
    ],
  },);
  await commitFiles({
    repository,
    files: { 'version.txt': 'merge feature\n', },
    message: 'merge feature bump',
  },);
  await realGit({
    repository,
    args: [
      'switch',
      '--quiet',
      'main',
    ],
  },);
  await commitFiles({
    repository,
    files: { 'merge-side.txt': 'main side\n', },
    message: 'merge main side',
  },);
  await realGit({
    repository,
    args: [
      'merge',
      '--quiet',
      '--no-commit',
      '--no-ff',
      'added-merge-feature',
    ],
  },);
  await concludeThroughShim({
    repository,
    env,
    message: 'merge added path',
  },);
  assertFixtureEqual({
    actual: (await realGit({
      repository,
      args: [
        'rev-list',
        '--parents',
        '--max-count=1',
        'HEAD',
      ],
    },))
      .trim()
      .split(' ',)
      .length
      .toString(),
    expected: '3',
    context: 'added-path merge parent count',
  },);
  await assertAddedPathCommitted({
    repository,
    context: 'merge conclusion',
  },);

  //endregion Merge conclusion adds the clean dependent

  //region Cherry-pick conclusion adds the clean dependent

  await commitFiles({
    repository,
    files: { 'dependent.txt': 'stale\n', },
    message: 'cherry baseline',
  },);
  await realGit({
    repository,
    args: [
      'switch',
      '--quiet',
      '--create',
      'added-cherry-source',
    ],
  },);
  await commitFiles({
    repository,
    files: { 'version.txt': 'cherry source\n', },
    message: 'cherry source bump',
  },);
  /**
   * Commit applied without an immediate commit.
   */
  const cherrySource = await resolveFixtureOid({ repository, },);
  await realGit({
    repository,
    args: [
      'switch',
      '--quiet',
      'main',
    ],
  },);
  /**
   * `main` before the conclusion, expected as its parent.
   */
  const cherryParent = await resolveFixtureOid({ repository, },);
  await realGit({
    repository,
    args: [
      'cherry-pick',
      '--no-commit',
      cherrySource,
    ],
  },);
  // `--no-commit` leaves no pending marker, so the fixture writes the one a conflicted pick would leave.
  await writeFile(
    `${repository}/.git/CHERRY_PICK_HEAD`,
    `${cherrySource}\n`,
  );
  await concludeThroughShim({
    repository,
    env,
    message: 'cherry-pick added path',
  },);
  assertFixtureEqual({
    actual: await resolveFixtureOid({
      repository,
      revision: 'HEAD^',
    },),
    expected: cherryParent,
    context: 'added-path cherry-pick parent',
  },);
  await assertAddedPathCommitted({
    repository,
    context: 'cherry-pick conclusion',
  },);
  await rm(
    `${repository}/.git/CHERRY_PICK_HEAD`,
    { force: true, },
  );

  //endregion Cherry-pick conclusion adds the clean dependent

  //region Revert conclusion adds the clean dependent

  await commitFiles({
    repository,
    files: { 'dependent.txt': 'stale\n', },
    message: 'revert baseline',
  },);
  await commitFiles({
    repository,
    files: { 'version.txt': 'revert target\n', },
    message: 'revert target bump',
  },);
  /**
   * Commit whose version change is staged for reversal.
   */
  const revertTarget = await resolveFixtureOid({ repository, },);
  await realGit({
    repository,
    args: [
      'revert',
      '--no-commit',
      revertTarget,
    ],
  },);
  // `--no-commit` leaves no pending marker, so the fixture writes the one a conflicted revert would leave.
  await writeFile(
    `${repository}/.git/REVERT_HEAD`,
    `${revertTarget}\n`,
  );
  await concludeThroughShim({
    repository,
    env,
    message: 'revert added path',
  },);
  assertFixtureEqual({
    actual: await resolveFixtureOid({
      repository,
      revision: 'HEAD^',
    },),
    expected: revertTarget,
    context: 'added-path revert parent',
  },);
  await assertAddedPathCommitted({
    repository,
    context: 'revert conclusion',
  },);
  await rm(
    `${repository}/.git/REVERT_HEAD`,
    { force: true, },
  );

  //endregion Revert conclusion adds the clean dependent
}
