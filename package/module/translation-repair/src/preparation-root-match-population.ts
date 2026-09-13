import { hashContent, } from './document-node.ts';
import type { PreparationRootArtifacts, } from './preparation-root-artifacts.ts';
import type { PreparationRootPopulation, } from './preparation-root-population.ts';
import type { PreparationRootEntry, } from './preparation-root-population-model.ts';
import type { FrozenPreparationSelection, } from './preparation-selection-model.ts';
import {
  assertPreparationRootEqual,
  preparationRootRecord,
} from './preparation-root-value.ts';

//region Current native evidence compared with historical frozen population

/**
 * Entry projection matches the original producer schema without treating extra current provenance as legacy data.
 *
 * @param entry - current selected entry
 *
 * @returns Exact historical entry projection for whole-record comparison
 *
 * @example
 * ```ts
 * const legacy = frozenRootEntryProjection(entry);
 * ```
 */
function frozenRootEntryProjection(entry: PreparationRootEntry,): Pick<PreparationRootEntry,
  'entryId' | 'sourceText' | 'archiveText' | 'targetText' | 'sourceHash' | 'archiveHash' | 'targetHash' | 'originalPolicy'
> {
  return {
    entryId: entry.entryId,
    sourceText: entry.sourceText,
    archiveText: entry.archiveText,
    targetText: entry.targetText,
    sourceHash: entry.sourceHash,
    archiveHash: entry.archiveHash,
    targetHash: entry.targetHash,
    originalPolicy: entry.originalPolicy,
  };
}

/**
 * Validates the complete consumed population semantics without running the historical sampler or repair code.
 * Legacy JSON-based digests are reproduced only under their original producer representation.
 *
 * @param selection - independently byte-bound parent selection
 *
 * @param record - owned complete frozen JSON, including fields absent from its partial projection
 *
 * @param artifacts - owned semantic documents from registered supporting bytes
 *
 * @param current - independently reconstructed native pinned population
 *
 * @throws PreparationRootError when policy, counts, hashes, node membership or frozen parent order differs
 *
 * @example
 * ```ts
 * matchPreparationRootPopulation({ selection, record, artifacts, current });
 * ```
 */
export function matchPreparationRootPopulation({
  selection,
  record,
  artifacts,
  current,
}: {
  readonly selection: FrozenPreparationSelection;
  readonly record: Readonly<Record<string, unknown>>;
  readonly artifacts: PreparationRootArtifacts;
  readonly current: PreparationRootPopulation;
},): void {
  /**
   * The historical pool is selection evidence, not a promoted execution plan.
   */
  const {
    pool,
    journal,
  } = artifacts;
  assertPreparationRootEqual({
    actual: pool.status,
    expected: 'provider-free policy population draft; no paid acquisition or writer execution approval',
    kind: 'reference-role',
  },);
  assertPreparationRootEqual({
    actual: pool.corpusSha,
    expected: selection.corpusCommitSha,
    kind: 'corpus-identity',
  },);
  assertPreparationRootEqual({
    actual: journal.corpusSha,
    expected: selection.corpusCommitSha,
    kind: 'corpus-identity',
  },);
  assertPreparationRootEqual({
    actual: pool.runtimeDigest,
    expected: selection.selectionRuntimeDigest,
    kind: 'reference-role',
  },);
  assertPreparationRootEqual({
    actual: pool.rules,
    expected: record.rules,
    kind: 'reference-role',
  },);
  /**
   * Historical order is a checked description; no invocation redraws its frozen membership.
   */
  const sampler = preparationRootRecord(record.sampler,);
  assertPreparationRootEqual({
    actual: sampler.order,
    expected: [
      'source UTF-16 length',
      'entry localeCompare',
      'source section index',
    ],
    kind: 'reference-role',
  },);
  assertPreparationRootEqual({
    actual: sampler.position,
    expected: 'floor((position + 0.5) * population.length / min(count, population.length))',
    kind: 'reference-role',
  },);
  /**
   * Reported complete population counts are checked against actual native reads, not each other.
   */
  const census = {
    listed: current.listedEntryIds
      .length,
    eligibleEntries: current.eligibleEntries,
    populationParents: current.population
      .length,
    selectedEntries: current.entries
      .length,
    selectedParents: current.parents
      .length,
  };
  assertPreparationRootEqual({
    actual: census,
    expected: record.census,
    kind: 'population',
  },);
  assertPreparationRootEqual({
    actual: current.population
      .length,
    expected: pool.populationCount,
    kind: 'population',
  },);
  assertPreparationRootEqual({
    actual: current.parents
      .length,
    expected: pool.parentCount,
    kind: 'population',
  },);
  assertPreparationRootEqual({
    actual: current.excluded,
    expected: record.exclusions,
    kind: 'population',
  },);
  assertPreparationRootEqual({
    actual: current.excluded,
    expected: pool.excluded,
    kind: 'population',
  },);
  assertPreparationRootEqual({
    actual: current.observations,
    expected: pool.observations,
    kind: 'population',
  },);
  assertPreparationRootEqual({
    actual: current.population,
    expected: pool.population,
    kind: 'population',
  },);
  /** Frozen parent and exclusion records must identity-bind every listed entry, including unselected entries. */
  const coveredEntries = new Set([
    ...current.population.map(function entry(parent,): string { return parent.entryId; },),
    ...current.excluded.map(function entry(exclusion,): string { return exclusion.entryId; },),
  ],);
  assertPreparationRootEqual({ actual: [...coveredEntries,].toSorted(), expected: current.listedEntryIds.toSorted(), kind: 'population', input: 'frozen entry identity coverage', },);
  /**
   * This is the original task40 population digest representation, not a new ambiguous sampler digest.
   */
  const populationDigest = hashContent({ content: JSON.stringify(current.population
    .map(function legacy(parent,): unknown {
    return {
      id: parent.id,
      source: parent.source,
      target: parent.target,
      originalProtection: parent.originalProtection,
    };
  },),), },);
  assertPreparationRootEqual({
    actual: populationDigest,
    expected: selection.populationDigest,
    kind: 'population',
  },);
  assertPreparationRootEqual({
    actual: populationDigest,
    expected: pool.populationDigest,
    kind: 'population',
  },);
  assertPreparationRootEqual({
    actual: populationDigest,
    expected: journal.populationDigest,
    kind: 'population',
  },);
  assertPreparationRootEqual({
    actual: current.parents,
    expected: pool.pool,
    kind: 'population',
  },);
  /**
   * Selected pool bytes preserve their original record order and producer key order.
   */
  const poolDigest = hashContent({ content: JSON.stringify(current.parents,), },);
  assertPreparationRootEqual({
    actual: poolDigest,
    expected: selection.poolDigest,
    kind: 'population',
  },);
  assertPreparationRootEqual({
    actual: poolDigest,
    expected: pool.poolDigest,
    kind: 'population',
  },);
  assertPreparationRootEqual({
    actual: poolDigest,
    expected: journal.poolDigest,
    kind: 'population',
  },);
  assertPreparationRootEqual({
    actual: current.entries
      .map(frozenRootEntryProjection,),
    expected: pool.entries,
    kind: 'population',
  },);
}

//endregion Current native evidence compared with historical frozen population
