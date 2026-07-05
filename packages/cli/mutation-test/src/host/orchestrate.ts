/**
 * Host orchestration: enumerate, shard, run, reshard on taint, confirm.
 *
 * Trust model: killed results are accepted from any shard position;
 * survived and timeout results are confirmed as mutant number 1 in a
 * fresh container unless they already ran at position 1. Taint-abandoned
 * remainders reshard at half size, bottoming out at single-mutant shards,
 * which guarantees termination.
 *
 * @example
 * ```ts
 * const outcome = await orchestrateRun(options);
 * ```
 */

import pLimit from 'p-limit';

import { tagged, } from '@monochromatic-dev/module-logger/ts';

import { enumeratePackage, } from './enumerate-package.ts';
import { ensureRuntimeImage, } from './image.ts';
import { runOneShard, } from './run-one-shard.ts';
import {
  composeShards,
  type MutantGroup,
} from './shards.ts';
import type { Mutant, } from '../engine/types.ts';
import type {
  FinalMutantResult,
  MutantEntry,
  OrchestrateOptions,
  RunOutcome,
} from './orchestrate-types.ts';
import type {
  ShardManifest,
  ShardReport,
} from '../shard-schema.ts';

export type {
  FinalMutantResult,
  OrchestrateOptions,
  RunOutcome,
} from './orchestrate-types.ts';

/**
 * Module logger for host orchestration.
 */
const l = tagged({ tag: 'mutation-test', },);

/**
 * Retries allowed for a single-mutant shard whose container fails
 * without producing a usable result; afterwards the mutant is final
 * runtimeError so the reshard loop always terminates.
 */
const MAX_SINGLE_RETRIES = 1;

/**
 * Runs the full orchestration flow against a prepared image.
 *
 * @param options - Run options.
 *
 * @returns Final per-mutant results with provenance.
 *
 * @throws Error when a shard reports a red baseline (infra failure).
 *
 * @example
 * ```ts
 * const outcome = await orchestrateRun(options);
 * ```
 */
export async function orchestrateRun(options: OrchestrateOptions,): Promise<RunOutcome> {
  /**
   * Logger scoped to the run.
   */
  const rl = tagged({
    tag: orchestrateRun.name,
    l,
  },);
  /**
   * Enumerated per-file groups and suppression-ignored mutants.
   */
  const {
    groups,
    ignored,
  } = await enumeratePackage(options,);
  /**
   * Mutant lookup by id for reshard rounds.
   */
  const mutantById = new Map<string, MutantEntry>(
    groups.flatMap(function toEntries(group,): readonly (readonly [
      string,
      MutantEntry,
    ])[] {
      return group.mutants
        .map(function toEntry(mutant,): readonly [
          string,
          MutantEntry,
        ] {
          return [
            mutant.id,
            {
              mutant,
              tests: group.tests,
            },
          ];
        },);
    },),
  );
  /**
   * Usable runtime image reference.
   */
  const image = await ensureRuntimeImage({
    repoRoot: options.repoRoot,
    skipImageBuild: options.skipImageBuild,
  },);
  /**
   * Bounded concurrency gate across shard containers.
   */
  const limit = pLimit(options.containers,);
  /**
   * Final result per mutant id.
   */
  const finals = new Map<string, FinalMutantResult>();
  /**
   * Reshard round counter per mutant id.
   */
  const rerunCounts = new Map<string, number>();
  /**
   * Container-failure retries per mutant id at shard size 1.
   */
  const singleRetries = new Map<string, number>();
  /**
   * Infrastructure anomalies observed across shards.
   */
  const infraErrors: string[] = [];
  /**
   * Total shard containers launched.
   */
  const counters = { shards: 0, };

  /**
   * Fetches one mutant entry, throwing on unknown ids.
   *
   * @param id - Mutant id from a shard report.
   *
   * @returns Lookup entry.
   */
  function entryOrThrow(id: string,): MutantEntry {
    /**
     * Lookup entry for this id.
     */
    const entry = mutantById.get(id,);

    if (entry === undefined)
      throw new Error(`unknown mutant id ${id} in shard results`,);

    return entry;
  }

  /**
   * Records taint fallout for one unrun id, finalising ids whose
   * single-mutant containers keep failing.
   *
   * @param options2 - Unrun id and the shard size it failed under.
   *
   * @returns Whether the id still needs resharding.
   */
  function recordUnrun(options2: {
    readonly id: string;
    readonly failedSize: number;
  },): boolean {
    rerunCounts.set(
      options2.id,
      (rerunCounts.get(options2.id,) ?? 0) + 1,
    );

    if (options2.failedSize > 1)
      return true;

    /**
     * Container-failure retries already spent on this mutant.
     */
    const retries = singleRetries.get(options2.id,) ?? 0;

    if (retries < MAX_SINGLE_RETRIES) {
      singleRetries.set(
        options2.id,
        retries + 1,
      );
      return true;
    }

    finals.set(
      options2.id,
      {
        mutant: entryOrThrow(options2.id,)
          .mutant,
        status: 'runtimeError',
        position: 1,
        rerunCount: rerunCounts.get(options2.id,) ?? 0,
        confirmed: true,
        detail: 'container failed repeatedly on single-mutant shard',
      },
    );
    return false;
  }

  /**
   * Runs one round of manifests, returning ids needing another round.
   *
   * @param manifests - Manifests for this round.
   *
   * @returns Mutant ids to reshard.
   */
  async function runRound(manifests: readonly ShardManifest[],): Promise<readonly string[]> {
    /**
     * Reports from every shard in this round.
     */
    const reports = await Promise.all(manifests.map(
      async function runLimited(manifest,): Promise<ShardReport> {
        counters.shards += 1;
        return await limit(
          async function launch(): Promise<ShardReport> {
            return await runOneShard({
              manifest,
              image,
              repoRoot: options.repoRoot,
              resources: options.resources,
              selinuxRelabel: options.selinuxRelabel,
            },);
          },
        );
      },
    ),);
    /**
     * Ids requiring resharding after this round.
     */
    const needsReshard: string[] = [];

    for (const [
      manifestIndex,
      report,
    ] of reports.entries()) {
      if (!report.baseline
        .green)
        throw new Error(
          `red baseline in shard ${report.shardId}: ${report.baseline
            .detail}; unmutated package fails its own gates`,
        );

      if (report.anomaly !== '')
        infraErrors.push(`${report.shardId}: ${report.anomaly}`,);

      for (const result of report.results) {
        finals.set(
          result.id,
          {
            mutant: entryOrThrow(result.id,)
              .mutant,
            status: result.status,
            position: result.position,
            rerunCount: rerunCounts.get(result.id,) ?? 0,
            confirmed: result.position === 1,
            detail: result.detail,
          },
        );
      }

      for (const id of report.unrun) {
        if (recordUnrun({
          id,
          failedSize: manifests[manifestIndex]
            ?.mutants
            .length
            ?? 1,
        },))
          needsReshard.push(id,);
      }
    }

    return needsReshard;
  }

  /**
   * Builds manifests for one set of reshard ids at a given size.
   *
   * @param options2 - Ids to reshard and the shard size.
   *
   * @returns Manifests grouped per source file.
   */
  function reshardManifests(options2: {
    readonly ids: readonly string[];
    readonly size: number;
  },): readonly ShardManifest[] {
    /**
     * Reshard groups keyed by source file.
     */
    const byFile = new Map<string, {
      readonly mutants: Mutant[];
      readonly tests: readonly string[];
    }>();

    for (const id of options2.ids) {
      /**
       * Lookup entry for this reshard id.
       */
      const entry = entryOrThrow(id,);
      /**
       * Existing bucket for this mutant's file.
       */
      const bucket = byFile.get(entry.mutant
        .file,);

      if (bucket === undefined)
        byFile.set(
          entry.mutant
            .file,
          {
            mutants: [entry.mutant,],
            tests: entry.tests,
          },
        );
      else
        bucket.mutants
          .push(entry.mutant,);
    }

    return composeShards({
      groups: [...byFile.entries(),]
        .map(function toGroup(entry,): MutantGroup {
          return {
            file: entry[0],
            mutants: entry[1]
              .mutants,
            tests: entry[1]
              .tests,
          };
        },),
      shardSize: options2.size,
      timeoutFloorMs: options.timeoutFloorMs,
      timeoutFactor: options.timeoutFactor,
      packagePath: options.packagePath,
    },);
  }

  /* oxlint-disable no-await-in-loop */
  // Rounds are inherently sequential: each consumes the previous round's
  // taint fallout. Parallelism lives inside runRound via the p-limit gate.
  {
    /**
     * Mutable round state: manifests to run and their shard size.
     */
    const round = {
      manifests: composeShards({
        groups,
        shardSize: options.shardSize,
        timeoutFloorMs: options.timeoutFloorMs,
        timeoutFactor: options.timeoutFactor,
        packagePath: options.packagePath,
      },),
      size: options.shardSize,
    };

    while (round.manifests
      .length
      > 0) {
      rl.info(
        `round: ${String(round.manifests
          .length,)} shards at size ${String(round.size,)}`,
      );

      /**
       * Ids needing another round after taint fallout.
       */
      const ids = await runRound(round.manifests,);
      round.size = Math.max(
        1,
        Math.floor(round.size / 2,),
      );
      round.manifests = reshardManifests({
        ids,
        size: round.size,
      },);
    }

    /**
     * Survived or timed-out results needing position-1 confirmation.
     */
    const toConfirm = [...finals.values(),]
      .filter(function needsConfirmation(result,): boolean {
        return ((result.status === 'survived') || (result.status === 'timeout'))
          && (!result.confirmed);
      },);

    if (toConfirm.length > 0) {
      rl.info(`confirming ${String(toConfirm.length,)} survivors/timeouts in fresh containers`,);

      /**
       * Mutable confirmation state; failed confirmation containers loop
       * until MAX_SINGLE_RETRIES finalises them as runtimeError.
       */
      const confirmation = {
        ids: toConfirm.map(function toId(result,): string {
          return result.mutant
            .id;
        },),
      };

      while (confirmation.ids
        .length
        > 0) {
        confirmation.ids = [...await runRound(reshardManifests({
          ids: confirmation.ids,
          size: 1,
        },),),];
      }
    }
  }
  /* oxlint-enable no-await-in-loop */

  /**
   * Mutant ids with no final result after all rounds; must be empty.
   */
  const missing = [...mutantById.keys(),]
    .filter(function unresolved(id,): boolean {
      return !finals.has(id,);
    },);

  if (missing.length > 0)
    throw new Error(`run finished with ${String(missing.length,)} unresolved mutants`,);

  return {
    results: [...finals.values(),]
      .toSorted(function byFileLine(
        a,
        b,
      ): number {
        return (a.mutant
          .file
          < b.mutant
          .file ? -1 : (a.mutant
            .file
            > b.mutant
            .file ? 1 : 0))
          || (a.mutant
            .start
            - b.mutant
            .start);
      },),
    ignored,
    infraErrors,
    shardCount: counters.shards,
  };
}
