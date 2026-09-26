/**
 Scenario actors:
 worktree writes,
 commit attempts through the packed wrapper,
 auxiliary wrapper commands,
 and hook barriers.

 @module
 */

import {
  mkdir,
  readFile,
  rm,
  writeFile,
} from 'node:fs/promises';
import {
  dirname,
  join,
} from 'node:path';

import type {
  AttemptMode,
  AttemptRecord,
  CapturedPath,
  WorkloadLedger,
} from './ledger-fixture.ts';
import {
  type ProcessOutcome,
  type RunningProcess,
  runBytes,
  startProcess,
  waitForMarker,
} from './process-fixture.ts';
import {
  realGit,
  type ScenarioRepository,
} from './repository-fixture.ts';

//region Types

/**
 Shared scenario handles.
 */
export type ScenarioActors = Readonly<{
  /**
   Scenario repository.
   */
  repository: ScenarioRepository;
  /**
   Scenario ledger.
   */
  ledger: WorkloadLedger;
}>;

/**
 Started commit attempt.
 */
export type StartedAttempt = Readonly<{
  /**
   Message token.
   */
  token: string;
  /**
   Running wrapper process group.
   */
  running: RunningProcess;
  /**
   Kills the process group and records the attempt as deliberately killed.
   */
  kill: () => void;
  /**
   Settles with the recorded attempt.
   */
  finished: Promise<AttemptRecord>;
}>;

//endregion Types

//region Worktree

/**
 Writes or removes one worktree path and records the harness's intent.

 @param actors - scenario handles

 @param path - repository path

 @param bytes - new bytes, absent to remove

 @example
 ```ts
 await writeWorktree({ ...actors, path: 'a.txt', bytes: Buffer.from('a\n') });
 ```
 */
export async function writeWorktree({
  repository,
  ledger,
  path,
  bytes,
}: ScenarioActors & Readonly<{
  path: string;
  bytes?: Buffer;
}>,): Promise<void> {
  /**
   Absolute path.
   */
  const absolute = join(repository.worktree, path,);
  if (bytes === undefined)
    await rm(absolute, { force: true, },);
  else {
    await mkdir(dirname(absolute,), { recursive: true, },);
    await writeFile(absolute, bytes,);
  }
  ledger.recordWorktree({ path, ...(bytes === undefined ? {} : { bytes, }), },);
}

/**
 Reads worktree bytes of a path.

 @param repository - scenario repository

 @param path - repository path

 @returns captured path, without bytes when missing

 @example
 ```ts
 await readWorktree({ repository, path: 'a.txt' });
 ```
 */
export async function readWorktree({
  repository,
  path,
}: Readonly<{
  repository: ScenarioRepository;
  path: string;
}>,): Promise<CapturedPath> {
  try {
    return { path, bytes: await readFile(join(repository.worktree, path,),), };
  }
  catch (error: unknown) {
    if (Error.isError(error,) && ('code' in error) && (error.code === 'ENOENT'))
      return { path, };
    throw error;
  }
}

/**
 Reads the real index's stage-0 bytes of a path.

 @param repository - scenario repository

 @param path - repository path

 @returns captured path, without bytes when the index has no entry

 @example
 ```ts
 await readIndexEntry({ repository, path: 'a.txt' });
 ```
 */
async function readIndexEntry({
  repository,
  path,
}: Readonly<{
  repository: ScenarioRepository;
  path: string;
}>,): Promise<CapturedPath> {
  /**
   `ls-files` line naming the staged blob, empty when untracked.
   */
  const listed = await realGit({ repository, args: ['ls-files', '--stage', '-z', '--', path,], },);
  /**
   Staged blob ID.
   */
  const oid = listed.split(' ',)[1];
  if ((listed === '') || (oid === undefined))
    return { path, };
  return {
    path,
    bytes: await runBytes({ command: repository.realGit, args: ['cat-file', 'blob', oid,], cwd: repository.worktree, env: repository.realEnv, },),
  };
}

//endregion Worktree

//region Commands

/**
 Builds the message token for an attempt label.

 @param label - unique label

 @returns token embedded in the commit message

 @example
 ```ts
 attemptToken('w1'); // => 'E2E-TOKEN-w1'
 ```
 */
export function attemptToken(label: string,): string {
  return `E2E-TOKEN-${label}`;
}

/**
 Starts a commit attempt through the wrapper and records it on settlement.

 @param actors - scenario handles

 @param label - unique label

 @param paths - explicit paths, or the index paths an index commit is expected to take

 @param mode - selection mode

 @param extraArgs - arguments before the message

 @param extraEnv - additional environment

 @returns started attempt

 @example
 ```ts
 const attempt = await startAttempt({ ...actors, label: 'w1', paths: ['a.txt'], mode: 'explicit' });
 await attempt.finished;
 ```
 */
export async function startAttempt({
  repository,
  ledger,
  label,
  paths,
  mode,
  extraArgs = [],
  extraEnv = {},
}: ScenarioActors & Readonly<{
  label: string;
  paths: readonly string[];
  mode: Exclude<AttemptMode, 'foreign'>;
  extraArgs?: readonly string[];
  extraEnv?: NodeJS.ProcessEnv;
}>,): Promise<StartedAttempt> {
  /**
   Message token.
   */
  const token = attemptToken(label,);
  /**
   Bytes at invocation: worktree for explicit and amend, real index for index commits.
   */
  const captured = await Promise.all(paths.map(async function capture(path,) {
    return mode === 'index' ? await readIndexEntry({ repository, path, },) : await readWorktree({ repository, path, },);
  },),);
  /**
   `HEAD` before start.
   */
  const headBefore = (await realGit({ repository, args: ['rev-parse', 'HEAD',], },)).trim();
  /**
   Mode-specific arguments.
   */
  const modeArgs = {
    explicit: ['--', ...paths,],
    amend: ['--amend', '--', ...paths,],
    index: ['--no-only',],
  }[mode];
  /**
   Running wrapper.
   */
  const running = startProcess({
    command: 'git',
    args: ['commit', '--quiet', ...extraArgs, '--message', `e2e ${label} [${token}]`, ...modeArgs,],
    cwd: repository.worktree,
    env: { ...repository.wrapperEnv, E2E_TOKEN: token, ...extraEnv, },
  },);
  /**
   Kill flag recorded with the attempt.
   */
  const state = { killed: false, };
  return {
    token,
    running,
    kill(): void {
      state.killed = true;
      running.killGroup();
    },
    finished: (async function record(): Promise<AttemptRecord> {
      /**
       Settled wrapper.
       */
      const outcome = await running.outcome;
      /**
       Recorded attempt.
       */
      const attempt: AttemptRecord = {
        label,
        token,
        mode,
        selectedPaths: paths,
        captured,
        headBefore,
        expectedBranch: repository.branch,
        outcome,
        killed: state.killed,
        // Auto-push never forces, so an amended pushed commit cannot reach the remote.
        requiresRemote: mode !== 'amend',
      };
      ledger.addAttempt(attempt,);
      return attempt;
    })(),
  };
}

/**
 Starts a real-Git `commit -a` by absolute path that bypasses the wrapper
 and holds `index.lock` while its editor waits for release.

 @param actors - scenario handles

 @param label - unique label

 @param paths - tracked paths modified before the start; `commit -a` takes exactly these

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
   Worktree bytes `commit -a` stages.
   */
  const captured = await Promise.all(paths.map(async function capture(path,) {
    return await readWorktree({ repository, path, },);
  },),);
  /**
   `HEAD` before start.
   */
  const headBefore = (await realGit({ repository, args: ['rev-parse', 'HEAD',], },)).trim();
  /**
   Running real Git.
   */
  const running = startProcess({
    command: repository.realGit,
    args: ['commit', '--quiet', '--all',],
    cwd: repository.worktree,
    env: { ...repository.realEnv, E2E_TOKEN: token, GIT_EDITOR: repository.editorProgram, },
  },);
  /**
   Kill flag recorded with the attempt.
   */
  const state = { killed: false, };
  return {
    token,
    running,
    kill(): void {
      state.killed = true;
      running.killGroup();
    },
    finished: (async function record(): Promise<AttemptRecord> {
      /**
       Recorded attempt; real Git never auto-pushes.
       */
      const attempt: AttemptRecord = {
        label,
        token,
        mode: 'foreign',
        selectedPaths: paths,
        captured,
        headBefore,
        expectedBranch: repository.branch,
        outcome: await running.outcome,
        killed: state.killed,
        requiresRemote: false,
      };
      ledger.addAttempt(attempt,);
      return attempt;
    })(),
  };
}

/**
 Runs one wrapper command to settlement and records it.

 @param actors - scenario handles

 @param label - unique label

 @param args - Git arguments

 @param mustSucceed - whether the accepted design requires exit 0

 @returns settled outcome

 @example
 ```ts
 await runWrapper({ ...actors, label: 'add b', args: ['add', 'b.txt'], mustSucceed: true });
 ```
 */
export async function runWrapper({
  repository,
  ledger,
  label,
  args,
  mustSucceed,
}: ScenarioActors & Readonly<{
  label: string;
  args: readonly string[];
  mustSucceed: boolean;
}>,): Promise<ProcessOutcome> {
  /**
   Settled wrapper.
   */
  const outcome = await startProcess({ command: 'git', args, cwd: repository.worktree, env: repository.wrapperEnv, },).outcome;
  ledger.addAuxiliary({ label, outcome, mustSucceed, wrapper: true, },);
  return outcome;
}

//endregion Commands

//region Barriers

/**
 Hook barrier bound for one wait.
 */
export const BARRIER_TIMEOUT_MS = 60_000;

/**
 Arms a hook barrier so the named event blocks until released.

 @param repository - scenario repository

 @param token - attempt token

 @param event - hook event or `editor`

 @example
 ```ts
 await holdAt({ repository, token, event: 'pre-commit' });
 ```
 */
export async function holdAt({
  repository,
  token,
  event,
}: Readonly<{
  repository: ScenarioRepository;
  token: string;
  event: string;
}>,): Promise<void> {
  await writeFile(join(repository.markerDir, `${token}.${event}.hold`,), '',);
}

/**
 Releases a hook barrier.

 @param repository - scenario repository

 @param token - attempt token

 @param event - hook event or `editor`

 @example
 ```ts
 await releaseAt({ repository, token, event: 'pre-commit' });
 ```
 */
export async function releaseAt({
  repository,
  token,
  event,
}: Readonly<{
  repository: ScenarioRepository;
  token: string;
  event: string;
}>,): Promise<void> {
  await writeFile(join(repository.markerDir, `${token}.${event}.release`,), '',);
}

/**
 Waits until an attempt's hook reaches an event or the attempt settles.

 @param repository - scenario repository

 @param attempt - started attempt

 @param event - hook event or `editor`

 @returns `marker`, `settled`, or `timeout`

 @example
 ```ts
 await reached({ repository, attempt, event: 'pre-commit' });
 ```
 */
export async function reached({
  repository,
  token,
  running,
  event,
}: Readonly<{
  repository: ScenarioRepository;
  token: string;
  running: Pick<RunningProcess, 'isSettled'>;
  event: string;
}>,): Promise<'marker' | 'settled' | 'timeout'> {
  return await waitForMarker({
    path: join(repository.markerDir, `${token}.${event}`,),
    timeoutMs: BARRIER_TIMEOUT_MS,
    isSettled: running.isSettled,
  },);
}

//endregion Barriers
