/**
 Conflicting-pair batches for the concurrent-commit benchmark.

 A wrapped commit edits one shared-file line and pauses after preparation;
 a native commit that bypasses cli-git then lands a different edit of the same line,
 so the wrapped commit's replay has no capture order to apply,
 falls through subsumption to the three-way merge,
 and must fail with exit `1` and a `concurrent-commit/replay-conflict` core finding.
 The serialized baseline lands the native commit first and then runs the wrapped commit,
 which then succeeds as an ordinary commit.

 @module
 */
import {
  mkdir,
  writeFile,
} from 'node:fs/promises';
import { join, } from 'node:path';
import { execute, } from './lifecycle-latency-command.ts';
import {
  type BatchSample,
  FIRST_EDIT_LINE,
  REAL_GIT,
} from './concurrent-commit-latency-contracts.ts';
import {
  runPlans,
  writeShared,
} from './concurrent-commit-latency-batches.ts';
import { withPausedCommit, } from './concurrent-commit-latency-pause.ts';
import {
  SHARED_FILE,
  sharedBaselineLines,
} from './concurrent-commit-latency-repositories.ts';
import {
  commitArgs,
  nowMs,
  observeLocks,
} from './concurrent-commit-latency-process.ts';

/**
 Lands a native commit that bypasses cli-git, changing one shared-file line, without touching the worktree or real index.

 @param repository - repository path

 @param scratch - scratch directory for the blob and temporary index

 @param text - line text
 */
async function landNativeLine({
  repository,
  scratch,
  text,
}: Readonly<{
  repository: string;
  scratch: string;
  text: string;
}>,): Promise<void> {
  await mkdir(
    scratch,
    { recursive: true, },
  );
  /**
   File holding the native bytes.
   */
  const blobSource = join(
    scratch,
    'native.txt',
  );
  await writeFile(
    blobSource,
    `${sharedBaselineLines()
      .map(function edited(
        line,
        index,
      ): string {
        return index === FIRST_EDIT_LINE ? text : line;
      },)
      .join('\n',)}\n`,
  );
  /**
   Temporary index environment.
   */
  const env = { GIT_INDEX_FILE: join(
    scratch,
    'index',
  ), };
  /**
   Current branch tip.
   */
  const parent = await execute({
    command: REAL_GIT,
    args: [
      'rev-parse',
      'HEAD',
    ],
    cwd: repository,
  },);
  /**
   Native blob.
   */
  const blob = await execute({
    command: REAL_GIT,
    args: [
      'hash-object',
      '-w',
      blobSource,
    ],
    cwd: repository,
  },);
  await execute({
    command: REAL_GIT,
    args: [
      'read-tree',
      parent,
    ],
    cwd: repository,
    env,
  },);
  await execute({
    command: REAL_GIT,
    args: [
      'update-index',
      '--cacheinfo',
      `100644,${blob},${SHARED_FILE}`,
    ],
    cwd: repository,
    env,
  },);
  /**
   Native tree.
   */
  const tree = await execute({
    command: REAL_GIT,
    args: ['write-tree',],
    cwd: repository,
    env,
  },);
  /**
   Native commit.
   */
  const commit = await execute({
    command: REAL_GIT,
    args: [
      'commit-tree',
      tree,
      '-p',
      parent,
      '-m',
      text,
    ],
    cwd: repository,
  },);
  await execute({
    command: REAL_GIT,
    args: [
      'update-ref',
      'refs/heads/main',
      commit,
      parent,
    ],
    cwd: repository,
  },);
}

/**
 Runs one conflicting pair.

 @param repository - repository path

 @param sequence - unique batch number

 @param serialized - whether to land the native commit before starting the wrapped one

 @param markerRoot - directory for phase markers and native scratch

 @returns measured batch; its one commit is the wrapped commit

 @example
 ```ts
 await conflictBatch({ repository, sequence: 1, serialized: false, markerRoot: '/work/markers' });
 ```
 */
export async function conflictBatch({
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
   Scratch for this pair.
   */
  const scratch = join(
    markerRoot,
    `conflict-${String(sequence,)}${serialized ? '-serialized' : ''}`,
  );
  /**
   Native line text.
   */
  const nativeText = `native ${String(sequence,)}`;
  /**
   Wrapped commit's edit.
   */
  const wrappedEdits = { [FIRST_EDIT_LINE]: `wrapped ${String(sequence,)}`, };
  if (serialized) {
    /**
     Native landing start.
     */
    const startedAt = nowMs();
    await landNativeLine({
      repository,
      scratch,
      text: nativeText,
    },);
    /**
     Native landing time, part of the serialized wall.
     */
    const nativeMs = nowMs() - startedAt;
    await writeShared({
      repository,
      edits: wrappedEdits,
    },);
    /**
     Wrapped commit after the native one.
     */
    const wrapped = await runPlans({
      repository,
      serialized,
      plans: [{ args: commitArgs({
        path: SHARED_FILE,
        message: `wrapped ${String(sequence,)}`,
      },), },],
    },);
    return {
      ...wrapped,
      wallMs: wrapped.wallMs + nativeMs,
    };
  }
  await writeShared({
    repository,
    edits: wrappedEdits,
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
   Wrapped commit alone; the native commit runs while it is paused.
   */
  const commits = await withPausedCommit({
    repository,
    markerDirectory: scratch,
    path: SHARED_FILE,
    message: `wrapped ${String(sequence,)}`,
    whilePaused: async function landNative(): Promise<'no-commit'> {
      await landNativeLine({
        repository,
        scratch,
        text: nativeText,
      },);
      return 'no-commit';
    },
  },);
  /**
   Measured batch.
   */
  const sample = {
    wallMs: nowMs() - startedAt,
    commits,
    ...observer.stop(),
  };
  // The failed commit left its edit on disk and the real index behind the native commit.
  await execute({
    command: REAL_GIT,
    args: [
      'reset',
      '--quiet',
      '--hard',
      'HEAD',
    ],
    cwd: repository,
  },);
  return sample;
}
