/**
 Commits paused after preparation through the test-only phase signal,
 so the concurrent-commit benchmark can force an interleaving instead of leaving it to scheduling.

 @module
 */
import {
  mkdir,
  writeFile,
} from 'node:fs/promises';
import { join, } from 'node:path';
import { setTimeout as sleep, } from 'node:timers/promises';
import {
  type CommitObservation,
  ConcurrentBenchmarkError,
} from './concurrent-commit-latency-contracts.ts';
import {
  commitArgs,
  pathExists,
  runCommit,
} from './concurrent-commit-latency-process.ts';

/**
 Poll interval while waiting for a phase marker.
 */
const MARKER_POLL_MS = 1;

/**
 Phase at which a paused commit has captured and prepared.
 */
const PAUSE_PHASE = 'preparation-done';

/**
 A commit started while another is paused.
 */
export type StartedCommit = Readonly<{
  /**
   The started commit's pending observation.
   */
  started: Promise<CommitObservation>;
  /**
   Marker directory to release when the commit is paused.
   */
  releaseDirectory?: string;
}>;

/**
 Waits until a paused commit wrote its phase marker, failing when it exits first.

 @param markerDirectory - marker directory

 @param exited - set once the paused commit exited
 */
async function waitForMarker({
  markerDirectory,
  exited,
}: Readonly<{
  markerDirectory: string;
  exited: Readonly<{ done: boolean; }>;
}>,): Promise<void> {
  /**
   Marker the paused commit writes.
   */
  const marker = join(
    markerDirectory,
    `${PAUSE_PHASE}.reached`,
  );
  // The paused commit writes the marker once or exits; every iteration sleeps.
  // oxlint-disable-next-line no-await-in-loop -- Polling observes the paused commit in order.
  while (!(await pathExists(marker,))) {
    if (exited.done)
      throw new ConcurrentBenchmarkError(`A commit armed to pause at ${PAUSE_PHASE} exited before writing ${marker}.`,);
    // oxlint-disable-next-line no-await-in-loop -- Polling observes the paused commit in order.
    await sleep(MARKER_POLL_MS,);
  }
}

/**
 Starts a commit armed to pause after preparation and waits until it prepared.

 @param repository - repository path

 @param markerDirectory - fresh marker directory

 @param path - committed path

 @param message - commit message

 @returns the pending commit and the directory whose release file resumes it

 @example
 ```ts
 const first = await startPausedCommit({ repository, markerDirectory, path: 'a.txt', message: 'a' });
 ```
 */
export async function startPausedCommit({
  repository,
  markerDirectory,
  path,
  message,
}: Readonly<{
  repository: string;
  markerDirectory: string;
  path: string;
  message: string;
}>,): Promise<StartedCommit> {
  await mkdir(
    markerDirectory,
    { recursive: true, },
  );
  /**
   Whether the paused commit exited.
   */
  const exited = { done: false, };
  /**
   Paused commit, marking its exit.
   */
  const started = (async function runPaused(): Promise<CommitObservation> {
    /**
     Paused commit's observation.
     */
    const observation = await runCommit({
      repository,
      args: commitArgs({
        path,
        message,
      },),
      env: { CLI_GIT_TEST_ONLY_PHASE_SIGNAL: `${PAUSE_PHASE}:pause:${markerDirectory}`, },
    },);
    exited.done = true;
    return observation;
  })();
  await waitForMarker({
    markerDirectory,
    exited,
  },);
  return {
    started,
    releaseDirectory: markerDirectory,
  };
}

/**
 Resumes a paused commit.

 @param releaseDirectory - marker directory of the paused commit
 */
async function release(releaseDirectory: string,): Promise<void> {
  await writeFile(
    join(
      releaseDirectory,
      `${PAUSE_PHASE}.release`,
    ),
    '',
  );
}

/**
 Starts a commit paused after preparation, runs a step while it is paused, then releases every paused commit together.

 @param repository - repository path

 @param markerDirectory - fresh marker directory

 @param path - committed path

 @param message - commit message

 @param whilePaused - step run while the commit is paused, returning its own commit when it starts one

 @returns both observations: paused commit first

 @example
 ```ts
 await withPausedCommit({ repository, markerDirectory, path, message, whilePaused: async () => 'no-commit' });
 ```
 */
export async function withPausedCommit({
  repository,
  markerDirectory,
  path,
  message,
  whilePaused,
}: Readonly<{
  repository: string;
  markerDirectory: string;
  path: string;
  message: string;
  whilePaused: () => Promise<StartedCommit | 'no-commit'>;
}>,): Promise<readonly CommitObservation[]> {
  /**
   First paused commit.
   */
  const first = await startPausedCommit({
    repository,
    markerDirectory,
    path,
    message,
  },);
  /**
   Commit the step started, if any.
   */
  const other = await whilePaused();
  if (other === 'no-commit') {
    await release(markerDirectory,);
    return [await first.started,];
  }
  await Promise.all([
    release(markerDirectory,),
    ...(other.releaseDirectory === undefined ? [] : [release(other.releaseDirectory,),]),
  ],);
  return await Promise.all([
    first.started,
    other.started,
  ],);
}
