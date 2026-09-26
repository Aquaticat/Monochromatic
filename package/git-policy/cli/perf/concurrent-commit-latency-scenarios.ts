/**
 Concurrent-commit scenario matrix from `SPEC.md` "Benchmark method".

 Each scenario warms up until its batch wall time is stable,
 then records {@link RECORDED_BATCHES} concurrent batches,
 each followed by its paired serialized batch
 (and,
 for disjoint paths,
 a direct real-Git serialized batch),
 so both see the same host conditions.

 @module
 */
import { join, } from 'node:path';
import {
  type BatchSample,
  type ConcurrentScenarioId,
  type ConcurrentScenarioResult,
  CONCURRENT_ROOT,
  DISJOINT_SCENARIOS,
  REAL_GIT,
  RECORDED_BATCHES,
  RESERVE_SWEEP,
  SLOW_HOOK_CONCURRENCY,
  SWEEP_CONCURRENCY,
} from './concurrent-commit-latency-contracts.ts';
import {
  disjointBatch,
  sameFileBatch,
} from './concurrent-commit-latency-batches.ts';
import { conflictBatch, } from './concurrent-commit-latency-conflict.ts';
import { prepareRepository, } from './concurrent-commit-latency-repositories.ts';
import {
  assertOutcome,
  distribution,
  type ExpectedOutcome,
  summarizeScenario,
  warmUp,
} from './concurrent-commit-latency-summary.ts';

/**
 Directory for phase markers and native-commit scratch.
 */
const MARKER_ROOT = join(
  CONCURRENT_ROOT,
  'markers',
);

/**
 Config with no policies, so concurrency defaults apply.
 */
const DEFAULT_CONFIG = 'export default { policies: {} };\n';

/**
 One scenario's batch runners.
 */
type ScenarioSpec = Readonly<{
  /**
   Scenario identity.
   */
  id: ConcurrentScenarioId;
  /**
   Commits per concurrent batch.
   */
  concurrency: number;
  /**
   Outcome every concurrent commit must reach.
   */
  expected: ExpectedOutcome;
  /**
   Runs one concurrent batch.
   */
  concurrent: (sequence: number) => Promise<BatchSample>;
  /**
   Runs the paired serialized batch.
   */
  serialized: (sequence: number) => Promise<BatchSample>;
  /**
   Runs the direct real-Git serialized batch, for disjoint paths.
   */
  direct?: (sequence: number) => Promise<BatchSample>;
}>;

/**
 Monotonic batch numbering shared by every scenario, so every edit is new.
 */
const sequenceCounter = { next: 1, };

/**
 Allocates the next batch number.

 @returns unique batch number
 */
function nextSequence(): number {
  /**
   Allocated number.
   */
  const sequence = sequenceCounter.next;
  sequenceCounter.next += 1;
  return sequence;
}

/**
 Measures one scenario.

 @param spec - scenario runners

 @returns scenario evidence
 */
async function measureScenario(spec: ScenarioSpec,): Promise<ConcurrentScenarioResult> {
  console.error(`concurrent-commit benchmark: ${spec.id}`,);
  /**
   Warm-up batches run.
   */
  const warmups = await warmUp({
    id: spec.id,
    runBatch: async function warmupBatch(): Promise<BatchSample> {
      /**
       Warm-up batch.
       */
      const sample = await spec.concurrent(nextSequence(),);
      assertOutcome({
        id: spec.id,
        sample,
        expected: spec.expected,
      },);
      return sample;
    },
  },);
  /**
   Recorded triples in order.
   */
  const recorded = await Array.from({ length: RECORDED_BATCHES, },)
    .reduce<Promise<readonly Readonly<{
    concurrent: BatchSample;
    serialized: BatchSample;
    direct?: BatchSample;
  }>[]>>(
    async function recordAfter(previous,) {
      /**
       Earlier recorded triples.
       */
      const earlier = await previous;
      /**
       Concurrent batch.
       */
      const concurrent = await spec.concurrent(nextSequence(),);
      assertOutcome({
        id: spec.id,
        sample: concurrent,
        expected: spec.expected,
      },);
      /**
       Paired serialized batch.
       */
      const serialized = await spec.serialized(nextSequence(),);
      assertOutcome({
        id: spec.id,
        sample: serialized,
        expected: 'landed',
      },);
      if (spec.direct === undefined)
        return [
          ...earlier,
          {
            concurrent,
            serialized,
          },
        ];
      /**
       Direct real-Git serialized batch.
       */
      const direct = await spec.direct(nextSequence(),);
      assertOutcome({
        id: spec.id,
        sample: direct,
        expected: 'landed',
      },);
      return [
        ...earlier,
        {
          concurrent,
          serialized,
          direct,
        },
      ];
    },
    Promise.resolve([],),
  );
  /**
   Direct batches, present only for disjoint paths.
   */
  const directSamples = recorded.flatMap(function directSample(triple,) {
    return triple.direct === undefined ? [] : [triple.direct,];
  },);
  return {
    ...summarizeScenario({
      id: spec.id,
      concurrency: spec.concurrency,
      warmups,
      samples: recorded.map(function concurrentSample(triple,) {
        return triple.concurrent;
      },),
      serializedSamples: recorded.map(function serializedSample(triple,) {
        return triple.serialized;
      },),
    },),
    ...(directSamples.length === 0
      ? {}
      : {
        directSerializedWall: distribution(directSamples.map(function directWall(sample,): number {
          return sample.wallMs;
        },),),
      }),
  };
}

/**
 Builds a disjoint-path spec over one repository.

 @param id - scenario identity

 @param repository - repository path

 @param concurrency - commits per batch

 @param directRepository - repository for the direct real-Git baseline, when measured

 @returns scenario spec
 */
function disjointSpec({
  id,
  repository,
  concurrency,
  directRepository,
}: Readonly<{
  id: ConcurrentScenarioId;
  repository: string;
  concurrency: number;
  directRepository?: string;
}>,): ScenarioSpec {
  return {
    id,
    concurrency,
    expected: 'landed',
    concurrent: async function concurrentDisjoint(sequence,) {
      return await disjointBatch({
        repository,
        concurrency,
        sequence,
        serialized: false,
      },);
    },
    serialized: async function serializedDisjoint(sequence,) {
      return await disjointBatch({
        repository,
        concurrency,
        sequence,
        serialized: true,
      },);
    },
    ...(directRepository === undefined
      ? {}
      : {
        direct: async function directDisjoint(sequence: number,): Promise<BatchSample> {
          return await disjointBatch({
            repository: directRepository,
            concurrency,
            sequence,
            serialized: true,
            command: REAL_GIT,
          },);
        },
      }),
  };
}

/**
 Prepares every repository and measures the complete matrix.

 @returns every scenario's evidence in matrix order

 @example
 ```ts
 const scenarios = await collectConcurrentScenarios();
 ```
 */
export async function collectConcurrentScenarios(): Promise<readonly ConcurrentScenarioResult[]> {
  /**
   Default-config repository for disjoint levels.
   */
  const disjointRepository = await prepareRepository({
    name: 'disjoint',
    config: DEFAULT_CONFIG,
  },);
  /**
   Configless repository for the direct real-Git baseline.
   */
  const directRepository = await prepareRepository({ name: 'direct', },);
  /**
   Same-file repository.
   */
  const sameFileRepository = await prepareRepository({
    name: 'same-file',
    config: DEFAULT_CONFIG,
  },);
  /**
   Conflicting-pair repository.
   */
  const conflictRepository = await prepareRepository({
    name: 'conflict',
    config: DEFAULT_CONFIG,
  },);
  /**
   Slow-hook repositories by `hooks.concurrentCommits`.
   */
  const slowSerialized = await prepareRepository({
    name: 'slow-hook-serialized',
    config: 'export default { policies: {}, hooks: { concurrentCommits: false } };\n',
    slowHook: true,
  },);
  /**
   Slow-hook repository whose hooks may overlap.
   */
  const slowConcurrent = await prepareRepository({
    name: 'slow-hook-concurrent',
    config: 'export default { policies: {}, hooks: { concurrentCommits: true } };\n',
    slowHook: true,
  },);
  /**
   Sweep repositories by `landing.reserveAfterLostRaces`.
   */
  const sweepRepositories = await Promise.all(RESERVE_SWEEP.map(async function sweepRepository(sweep,): Promise<Readonly<{
    id: ConcurrentScenarioId;
    repository: string;
  }>> {
    return {
      id: sweep.id,
      repository: await prepareRepository({
        name: sweep.id,
        config: `export default { policies: {}, landing: { reserveAfterLostRaces: ${String(sweep.reserve,)} } };\n`,
      },),
    };
  },),);
  /**
   Complete ordered matrix.
   */
  const specs: readonly ScenarioSpec[] = [
    ...DISJOINT_SCENARIOS.map(function levelSpec(level,): ScenarioSpec {
      return disjointSpec({
        id: level.id,
        repository: disjointRepository,
        concurrency: level.concurrency,
        directRepository,
      },);
    },),
    {
      id: 'same-file-non-overlapping',
      concurrency: 2,
      expected: 'landed',
      concurrent: async function concurrentSameFile(sequence,) {
        return await sameFileBatch({
          repository: sameFileRepository,
          sequence,
          serialized: false,
          markerRoot: MARKER_ROOT,
        },);
      },
      serialized: async function serializedSameFile(sequence,) {
        return await sameFileBatch({
          repository: sameFileRepository,
          sequence,
          serialized: true,
          markerRoot: MARKER_ROOT,
        },);
      },
    },
    {
      id: 'conflicting-pair',
      concurrency: 1,
      expected: 'replay-conflict',
      concurrent: async function concurrentConflict(sequence,) {
        return await conflictBatch({
          repository: conflictRepository,
          sequence,
          serialized: false,
          markerRoot: MARKER_ROOT,
        },);
      },
      serialized: async function serializedConflict(sequence,) {
        return await conflictBatch({
          repository: conflictRepository,
          sequence,
          serialized: true,
          markerRoot: MARKER_ROOT,
        },);
      },
    },
    disjointSpec({
      id: 'slow-hook-serialized',
      repository: slowSerialized,
      concurrency: SLOW_HOOK_CONCURRENCY,
    },),
    disjointSpec({
      id: 'slow-hook-concurrent',
      repository: slowConcurrent,
      concurrency: SLOW_HOOK_CONCURRENCY,
    },),
    ...sweepRepositories.map(function sweepSpec(sweep,): ScenarioSpec {
      return disjointSpec({
        id: sweep.id,
        repository: sweep.repository,
        concurrency: SWEEP_CONCURRENCY,
      },);
    },),
  ];
  return await specs.reduce<Promise<readonly ConcurrentScenarioResult[]>>(
    async function measureAfter(
      previous,
      spec,
    ) {
      return [
        ...await previous,
        await measureScenario(spec,),
      ];
    },
    Promise.resolve([],),
  );
}
