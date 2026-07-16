/**
 * Commit-pair scenarios for the lifecycle latency benchmark.
 *
 * @module
 */
import { appendFile, } from 'node:fs/promises';
import { join, } from 'node:path';
import {
  execute,
  measure,
} from './lifecycle-latency-command.ts';
import {
  BENCHMARK_FILE,
  DIRECT_COMMIT_REPOSITORY,
  PACKAGE_BIN,
  REAL_GIT,
  type CommandRequest,
  type CommandSample,
  type ScenarioSummary,
  TREE_DIRECTORY,
  TREE_NAME_WIDTH,
  TYPESCRIPT_REPOSITORY,
  WARMUP_RUNS,
  WIDE_COMMIT_FILE_COUNT,
} from './lifecycle-latency-contracts.ts';
import {
  measurementIndices,
  metricValues,
  summarize,
} from './lifecycle-latency-summary.ts';
import { assertStableWarmups, } from './lifecycle-latency-warmup.ts';

/**
 * Prepares next commit command.
 *
 * @param repository - target repository
 *
 * @param command - Git executable
 *
 * @param iteration - unique content sequence
 *
 * @returns measured commit request
 */
async function commitRequest({
  repository,
  command,
  iteration,
}: Readonly<{
  repository: string;
  command: string;
  iteration: number;
}>,): Promise<CommandRequest> {
  await appendFile(
    join(
      repository,
      BENCHMARK_FILE,
    ),
    `commit-${String(iteration,)}\n`,
  );
  await execute({
    command: REAL_GIT,
    args: [
      'add',
      '--',
      BENCHMARK_FILE,
    ],
    cwd: repository,
  },);
  return {
    command,
    args: [
      'commit',
      `--message=benchmark-${String(iteration,)}`,
      '--',
      BENCHMARK_FILE,
    ],
    cwd: repository,
  };
}

/**
 * Repository-relative paths one wide commit changes.
 */
const WIDE_COMMIT_PATHS: readonly string[] = Array.from(
  { length: WIDE_COMMIT_FILE_COUNT, },
  function wideCommitPath(
    _unused,
    index,
  ) {
    return join(
      TREE_DIRECTORY,
      `${String(index,)
        .padStart(
          TREE_NAME_WIDTH,
          '0',
        )}.txt`,
    );
  },
);

/**
 * Prepares next wide commit naming every changed path.
 *
 * Changes {@link WIDE_COMMIT_FILE_COUNT} already-tracked files so the measured
 * command carries a delta, and an argv, as wide as a mechanical sweep.
 *
 * @param repository - target repository
 *
 * @param command - Git executable
 *
 * @param iteration - unique content sequence
 *
 * @returns measured wide commit request
 */
async function wideCommitRequest({
  repository,
  command,
  iteration,
}: Readonly<{
  repository: string;
  command: string;
  iteration: number;
}>,): Promise<CommandRequest> {
  await Promise.all(WIDE_COMMIT_PATHS.map(function appendChange(path,) {
    return appendFile(
      join(
        repository,
        path,
      ),
      `wide-${String(iteration,)}\n`,
    );
  },),);
  await execute({
    command: REAL_GIT,
    args: [
      'add',
      '--',
      ...WIDE_COMMIT_PATHS,
    ],
    cwd: repository,
  },);
  return {
    command,
    args: [
      'commit',
      `--message=wide-${String(iteration,)}`,
      '--',
      ...WIDE_COMMIT_PATHS,
    ],
    cwd: repository,
  };
}

/**
 * Collects wide-commit pairs with equivalent prepared mutations.
 *
 * @returns enforced wide-commit wrapper-added summary
 *
 * @example
 * ```ts
 * await collectWideCommit();
 * ```
 */
export async function collectWideCommit(): Promise<ScenarioSummary> {
  /**
   * Complete sequential wide-commit-pair collection.
   */
  const allSamples = await measurementIndices()
    .reduce(
      async function appendWideCommitPair(
        previousPromise,
        index,
      ) {
        /**
         * Earlier sequential wide-commit samples.
         */
        const previous = await previousPromise;
        /**
         * Prepared direct wide commit request.
         */
        const direct = await wideCommitRequest({
          repository: DIRECT_COMMIT_REPOSITORY,
          command: REAL_GIT,
          iteration: index,
        },);
        /**
         * Prepared wrapper wide commit request.
         */
        const wrapper = await wideCommitRequest({
          repository: TYPESCRIPT_REPOSITORY,
          command: PACKAGE_BIN,
          iteration: index,
        },);
        /**
         * Direct wide commit duration.
         */
        const directCommitMs = await measure(direct,);
        /**
         * Direct local push duration paired with wrapper auto-push.
         */
        const directPushMs = await measure({
          command: REAL_GIT,
          args: ['push',],
          cwd: DIRECT_COMMIT_REPOSITORY,
        },);
        /**
         * Complete direct wide commit and push duration.
         */
        const directMs = directCommitMs + directPushMs;
        /**
         * Wrapper wide commit including local auto-push duration.
         */
        const wrapperMs = await measure(wrapper,);
        return [
          ...previous,
          {
            directMs,
            wrapperMs,
            addedMs: wrapperMs - directMs,
          },
        ];
      },
      Promise.resolve<readonly CommandSample[]>([],),
    );
  assertStableWarmups({
    id: 'wide-commit',
    values: metricValues({ samples: allSamples, },),
  },);
  return summarize({
    id: 'wide-commit',
    metric: 'wrapper-added',
    samples: allSamples.slice(WARMUP_RUNS,),
  },);
}

/**
 * Collects post-commit pairs with equivalent prepared mutations.
 *
 * @returns enforced post-commit wrapper-added summary
 *
 * @example
 * ```ts
 * await collectPostCommit();
 * ```
 */
export async function collectPostCommit(): Promise<ScenarioSummary> {
  /**
   * Complete sequential commit-pair collection.
   */
  const allSamples = await measurementIndices()
    .reduce(
    async function appendCommitPair(
      previousPromise,
      index,
    ) {
      /**
       * Earlier sequential commit samples.
       */
      const previous = await previousPromise;
      /**
       * Prepared direct commit request.
       */
      const direct = await commitRequest({
        repository: DIRECT_COMMIT_REPOSITORY,
        command: REAL_GIT,
        iteration: index,
      },);
      /**
       * Prepared wrapper commit request.
       */
      const wrapper = await commitRequest({
        repository: TYPESCRIPT_REPOSITORY,
        command: PACKAGE_BIN,
        iteration: index,
      },);
      /**
       * Direct commit duration.
       */
      const directCommitMs = await measure(direct,);
      /**
       * Direct local push duration paired with wrapper auto-push.
       */
      const directPushMs = await measure({
        command: REAL_GIT,
        args: ['push',],
        cwd: DIRECT_COMMIT_REPOSITORY,
      },);
      /**
       * Complete direct commit and push duration.
       */
      const directMs = directCommitMs + directPushMs;
      /**
       * Wrapper commit including local auto-push duration.
       */
      const wrapperMs = await measure(wrapper,);
      return [
        ...previous,
        {
          directMs,
          wrapperMs,
          addedMs: wrapperMs - directMs,
        },
      ];
    },
    Promise.resolve<readonly CommandSample[]>([],),
  );
  assertStableWarmups({
    id: 'post-commit',
    values: metricValues({ samples: allSamples, },),
  },);
  return summarize({
    id: 'post-commit',
    metric: 'wrapper-added',
    samples: allSamples.slice(WARMUP_RUNS,),
  },);
}
