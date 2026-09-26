/**
 Foreign Git activity that bypasses the wrapper:
 a real-Git `commit --all` by absolute path whose editor holds `index.lock` until released.

 @module
 */

import { startProcess, } from './process-fixture.ts';
import { realGit, } from './repository-fixture.ts';
import {
  attemptToken,
  readWorktree,
  type ScenarioActors,
  type StartedAttempt,
  trackAttempt,
} from './worker-fixture.ts';

//region Foreign commit

/**
 Starts a real-Git `commit --all` by absolute path that bypasses the wrapper
 and holds `index.lock` while its editor waits for release.

 @param repository - scenario repository

 @param ledger - scenario ledger

 @param label - unique label

 @param paths - tracked paths modified before the start; `commit --all` takes exactly these

 @returns started attempt

 @example
 ```ts
 const foreign = await startForeignCommit({ ...actors, label: 'foreign', paths: ['f.txt'] });
 ```
 */
export async function startForeignCommit({
  repository,
  ledger,
  label,
  paths,
}: ScenarioActors & Readonly<{
  label: string;
  paths: readonly string[];
}>,): Promise<StartedAttempt> {
  /**
   Message token the editor writes.
   */
  const token = attemptToken(label,);
  /**
   Worktree bytes `commit --all` stages.
   */
  const captured = await Promise.all(paths.map(async function capture(path,) {
    return await readWorktree({
      repository,
      path,
    },);
  },),);
  /**
   `HEAD` read immediately before start.
   */
  const headBefore = (await realGit({
    repository,
    args: [
      'rev-parse',
      'HEAD',
    ],
  },)).trim();
  return trackAttempt({
    ledger,
    pending: {
      label,
      token,
      mode: 'foreign',
      selectedPaths: paths,
      captured,
      headBefore,
      expectedBranch: repository.branch,
      // Real Git never auto-pushes.
      requiresRemote: false,
    },
    running: startProcess({
      command: repository.realGit,
      args: [
        'commit',
        '--quiet',
        '--all',
      ],
      cwd: repository.worktree,
      env: {
        ...repository.realEnv,
        E2E_TOKEN: token,
        GIT_EDITOR: repository.editorProgram,
      },
    },),
  },);
}

//endregion Foreign commit
