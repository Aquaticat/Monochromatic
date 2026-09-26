/**
 One measured batch per scenario shape for the concurrent-commit benchmark.

 A concurrent batch starts every commit together;
 its paired serialized batch runs the same commits one after another.

 @module
 */
import {
  appendFile,
  mkdir,
  writeFile,
} from 'node:fs/promises';
import { join, } from 'node:path';
import { setTimeout as sleep, } from 'node:timers/promises';
import {
  type BatchSample,
  type CommitObservation,
  ConcurrentBenchmarkError,
  FIRST_EDIT_LINE,
  SECOND_EDIT_LINE,
} from './concurrent-commit-latency-contracts.ts';
import {
  disjointFile,
  SHARED_FILE,
  sharedBaselineLines,
} from './concurrent-commit-latency-repositories.ts';
import {
  nowMs,
  observeLocks,
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
 One commit to run: its arguments and extra environment.
 */
export type CommitPlan = Readonly<{
  /**
   Wrapper arguments.
   */
  args: readonly string[];
  /**
   Executable when not the packed wrapper.
   */
  command?: string;
}>;

/**
 Explicit-path commit arguments.

 @param path - committed path

 @param message - commit message

 @returns wrapper arguments

 @example
 ```ts
 commitArgs({ path: 'a.txt', message: 'x' });
 ```
 */
export function commitArgs({
  path,
  message,
}: Readonly<{
  path: string;
  message: string;
}>,): readonly string[] {
  return [
    'commit',
    '--quiet',
    `--message=${message}`,
    '--',
    path,
  ];
}

/**
 Runs plans together or one after another while observing the locks.

 @example
 ```ts
 await runPlans({ repository, plans: [{ args: ['commit', '-m', 'x', '--', 'a.txt'] }], serialized: true });
 ```

 @param repository - repository path

 @param plans - commits to run

 @param serialized - whether to run one after another

 @returns measured batch
 */
export async function runPlans({
  repository,
  plans,
  serialized,
}: Readonly<{
  repository: string;
  plans: readonly CommitPlan[];
  serialized: boolean;
}>,): Promise<BatchSample> {
  /**
   Lock observer for the batch.
   */
  const observer = await observeLocks(repository,);
  /**
   Batch start.
   */
  const startedAt = nowMs();
  /**
   Commits in plan order.
   */
  const commits = serialized
    ? await plans.reduce<Promise<readonly CommitObservation[]>>(
      async function runAfter(
        previous,
        plan,
      ) {
        return [
          ...await previous,
          await runCommit({
            repository,
            ...plan,
          },),
        ];
      },
      Promise.resolve([],),
    )
    : await Promise.all(plans.map(async function runTogether(plan,) {
      return await runCommit({
        repository,
        ...plan,
      },);
    },),);
  /**
   Batch wall time.
   */
  const wallMs = nowMs() - startedAt;
  return {
    wallMs,
    commits,
    ...observer.stop(),
  };
}

/**
 Runs one disjoint-path batch.

 @param repository - repository path

 @param concurrency - commits in the batch

 @param sequence - unique batch number

 @param serialized - whether to run the commits one after another

 @param command - executable, for the direct-Git baseline

 @returns measured batch

 @example
 ```ts
 await disjointBatch({ repository, concurrency: 4, sequence: 1, serialized: false });
 ```
 */
export async function disjointBatch({
  repository,
  concurrency,
  sequence,
  serialized,
  command,
}: Readonly<{
  repository: string;
  concurrency: number;
  sequence: number;
  serialized: boolean;
  command?: string;
}>,): Promise<BatchSample> {
  /**
   Commit slots.
   */
  const slots = Array.from(
    { length: concurrency, },
    function slot(
      _unused,
      index,
    ): number {
      return index;
    },
  );
  await Promise.all(slots.map(async function edit(slot,): Promise<void> {
    await appendFile(
      join(
        repository,
        disjointFile(slot,),
      ),
      `batch ${String(sequence,)}\n`,
    );
  },),);
  return await runPlans({
    repository,
    serialized,
    plans: slots.map(function plan(slot,): CommitPlan {
      return {
        args: commitArgs({
          path: disjointFile(slot,),
          message: `disjoint ${String(sequence,)} ${String(slot,)}`,
        },),
        ...(command === undefined ? {} : { command, }),
      };
    },),
  },);
}

/**
 Writes the shared file with the given lines replaced.

 @param repository - repository path

 @param edits - line index to text

 @returns written text

 @example
 ```ts
 await writeShared({ repository, edits: { 4: 'first 1' } });
 ```
 */
export async function writeShared({
  repository,
  edits,
}: Readonly<{
  repository: string;
  edits: Readonly<Record<number, string>>;
}>,): Promise<string> {
  /**
   Complete file text.
   */
  const text = `${sharedBaselineLines()
    .map(function edited(
      line,
      index,
    ): string {
      return edits[index] ?? line;
    },)
    .join('\n',)}\n`;
  await writeFile(
    join(
      repository,
      SHARED_FILE,
    ),
    text,
  );
  return text;
}

/**
 A commit started while another is paused.
 */
export type StartedCommit = Readonly<{
  /**
   The started commit's pending observation.
   */
  started: Promise<CommitObservation>;
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
 Starts a commit paused after preparation, waits until it prepared, runs a step, then releases it.

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
  const paused = (async function runPaused(): Promise<CommitObservation> {
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
  /**
   Commit the step started, if any.
   */
  const other = await whilePaused();
  await writeFile(
    join(
      markerDirectory,
      `${PAUSE_PHASE}.release`,
    ),
    '',
  );
  return other === 'no-commit' ? [await paused,] : await Promise.all([
    paused,
    other.started,
  ],);
}

/**
 Runs one same-file non-overlapping pair: far-apart lines of one file, the second captured while the first is prepared.

 @param repository - repository path

 @param sequence - unique batch number

 @param serialized - whether to run the commits one after another

 @param markerRoot - directory for phase markers

 @returns measured batch

 @example
 ```ts
 await sameFileBatch({ repository, sequence: 1, serialized: false, markerRoot: '/work/markers' });
 ```
 */
export async function sameFileBatch({
  repository,
  sequence,
  serialized,
  markerRoot,
}: Readonly<{
  repository: string;
  sequence: number;
  serialized: boolean;
  markerRoot: string;
}>,): Promise<BatchSample> {
  /**
   First edit alone.
   */
  const firstEdits = { [FIRST_EDIT_LINE]: `first ${String(sequence,)}`, };
  /**
   Both edits.
   */
  const bothEdits = {
    ...firstEdits,
    [SECOND_EDIT_LINE]: `second ${String(sequence,)}`,
  };
  if (serialized) {
    await writeShared({
      repository,
      edits: firstEdits,
    },);
    /**
     First commit.
     */
    const first = await runPlans({
      repository,
      serialized,
      plans: [{ args: commitArgs({
        path: SHARED_FILE,
        message: `first ${String(sequence,)}`,
      },), },],
    },);
    await writeShared({
      repository,
      edits: bothEdits,
    },);
    /**
     Second commit.
     */
    const second = await runPlans({
      repository,
      serialized,
      plans: [{ args: commitArgs({
        path: SHARED_FILE,
        message: `second ${String(sequence,)}`,
      },), },],
    },);
    return {
      wallMs: first.wallMs + second.wallMs,
      commits: [
        ...first.commits,
        ...second.commits,
      ],
      landingLockHoldMs: [
        ...first.landingLockHoldMs,
        ...second.landingLockHoldMs,
      ],
      indexLockHoldMs: [
        ...first.indexLockHoldMs,
        ...second.indexLockHoldMs,
      ],
    };
  }
  await writeShared({
    repository,
    edits: firstEdits,
  },);
  /**
   Lock observer for the batch.
   */
  const observer = await observeLocks(repository,);
  /**
   Batch start.
   */
  const startedAt = nowMs();
  /**
   Both commits.
   */
  const commits = await withPausedCommit({
    repository,
    markerDirectory: join(
      markerRoot,
      `same-file-${String(sequence,)}`,
    ),
    path: SHARED_FILE,
    message: `first ${String(sequence,)}`,
    whilePaused: async function startSecond(): Promise<StartedCommit> {
      await writeShared({
        repository,
        edits: bothEdits,
      },);
      return {
        started: runCommit({
          repository,
          args: commitArgs({
            path: SHARED_FILE,
            message: `second ${String(sequence,)}`,
          },),
        },),
      };
    },
  },);
  return {
    wallMs: nowMs() - startedAt,
    commits,
    ...observer.stop(),
  };
}
