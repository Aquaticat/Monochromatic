/**
 * Packed verification that index installs carry the prepared index's timestamps (#544).
 *
 * A `reference-transaction` hook runs during the landing, after cli-git computed `post-1.index`,
 * rewrites the pinned file with same-size bytes,
 * and gives `post-1.index` the pinned second,
 * as if the prepared index had been written in the same second as the entry's cached stat.
 * The install must keep that second on the real index,
 * or Git trusts the cached stat and hides the edit.
 *
 * @module
 */
import {
  rm,
  writeFile,
} from 'node:fs/promises';
import {
  KILL_LANDING_SOURCE,
  LANDING_HOOK,
  waitForOrphan,
} from './built-autofix-recovery-consumer.ts';
import { execute, } from './built-consumer-helpers.ts';
import { transactionFileExpression, } from './built-transaction-registry.ts';
import {
  assertEditVisible,
  initializeRacyRepository,
  pinCachedStat,
  racyEditStatements,
} from './built-racy-index-helpers.ts';

/**
 * Executable private hook mode.
 */
const EXECUTABLE_MODE = 0o700;

/**
 * Prepares a trusted repository with a staged fix candidate and a pinned, still unedited entry.
 *
 * @param repository - disposable repository root
 *
 * @param env - PATH-first packed shadow environment
 *
 * @returns hook statements that edit the entry and pin `post-1.index`
 *
 * @example
 * ```ts
 * await prepareInstallScenario({ repository: '/work/racy-install', env });
 * ```
 */
async function prepareInstallScenario({
  repository,
  env,
}: Readonly<{
  repository: string;
  env: NodeJS.ProcessEnv;
}>,): Promise<string> {
  await initializeRacyRepository({
    repository,
    files: {
      'hold.txt': 'racy hold base\n',
      'other.txt': 'other base\n',
    },
    env,
  },);
  await writeFile(
    `${repository}/other.txt`,
    'other changed',
  );
  await execute({
    command: '/usr/bin/git',
    args: [
      'add',
      'other.txt',
    ],
    cwd: repository,
  },);
  /**
   * Cached stat second of the unedited entry.
   */
  const pinnedSecond = await pinCachedStat({
    repository,
    path: 'hold.txt',
  },);
  return `${racyEditStatements({
    path: 'hold.txt',
    edited: 'racy hold edit\n',
    pinnedSecond,
  },)}require('node:fs').utimesSync(${transactionFileExpression('post-1.index',)}, ${String(pinnedSecond,)}, ${String(pinnedSecond,)});
`;
}

/**
 * Exercises the normal index install and the startup-recovery index install.
 *
 * @param env - PATH-first packed shadow environment
 *
 * @example
 * ```ts
 * await verifyRacyIndexInstall({ env: process.env });
 * ```
 */
export async function verifyRacyIndexInstall({ env, }: Readonly<{
  env: NodeJS.ProcessEnv;
}>,): Promise<void> {
  //region normal install keeps the prepared index timestamp

  /**
   * Normal-install repository.
   */
  const installRepository = '/work/racy-index-install';
  /**
   * Hook statements editing the entry after `post-1.index` exists.
   */
  const installStatements = await prepareInstallScenario({
    repository: installRepository,
    env,
  },);
  await writeFile(
    `${installRepository}/.git/hooks/${LANDING_HOOK}`,
    `#!/usr/bin/env node\nrequire('node:fs').readFileSync(0);\nif (process.argv[2] === 'committed') {\n${installStatements}}\n`,
    { mode: EXECUTABLE_MODE, },
  );
  await execute({
    command: 'git',
    args: [
      'commit',
      '--no-only',
      '--quiet',
      '--message=install beside racy edit',
    ],
    cwd: installRepository,
    env,
  },);
  await rm(`${installRepository}/.git/hooks/${LANDING_HOOK}`,);
  await assertEditVisible({
    repository: installRepository,
    path: 'hold.txt',
    context: 'index install',
  },);

  //endregion normal install keeps the prepared index timestamp

  //region recovery install keeps the prepared index timestamp

  /**
   * Recovery-install repository.
   */
  const recoveryRepository = '/work/racy-index-recovery';
  /**
   * Hook statements editing the entry before the wrapper is killed.
   */
  const recoveryStatements = await prepareInstallScenario({
    repository: recoveryRepository,
    env,
  },);
  await writeFile(
    `${recoveryRepository}/.git/hooks/${LANDING_HOOK}`,
    KILL_LANDING_SOURCE.replace(
      "if (process.argv[2] === 'committed') {\n",
      `if (process.argv[2] === 'committed') {\n${recoveryStatements}`,
    ),
    { mode: EXECUTABLE_MODE, },
  );
  await execute({
    command: 'git',
    args: [
      'commit',
      '--no-only',
      '--quiet',
      '--message=interrupted beside racy edit',
    ],
    expectedExit: -1,
    cwd: recoveryRepository,
    env,
  },);
  await waitForOrphan();
  await rm(`${recoveryRepository}/.git/hooks/${LANDING_HOOK}`,);
  // The shim recovers before forwarding, and real `git status` then reads the recovered index.
  await execute({
    command: 'git',
    args: [
      'status',
      '--short',
    ],
    cwd: recoveryRepository,
    env,
  },);
  await assertEditVisible({
    repository: recoveryRepository,
    path: 'hold.txt',
    context: 'recovery index install',
  },);

  //endregion recovery install keeps the prepared index timestamp
}
