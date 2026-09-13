import {
  type Logger,
  tagged,
} from '@monochromatic-dev/module-logger/ts';
import {
  listCorpusPeople,
  type CorpusPin,
} from './corpus-source.ts';
import type { AlignmentFinding, } from './chunk-document.ts';
import { readPreparationRootEntry, } from './preparation-root-entry.ts';
import { PreparationRootError, } from './preparation-root-error.ts';
import { preparationRootPopulationParent, } from './preparation-root-parent.ts';
import type {
  PreparationRootEntry,
  PreparationRootParent,
  PreparationRootPopulationParent,
  PreparationRootRawDocument,
} from './preparation-root-population-model.ts';
import type { PreparationRootExclusion, } from './preparation-root-reference-model.ts';
import {
  preparationRootRegistrations,
  preparationRootUnalignedDefinitions,
} from './preparation-root-registration.ts';
import type {
  PreparationRootRegistration,
  PreparationRootUnalignedDefinitions,
} from './preparation-root-registration-model.ts';
import { mapOverlapped, } from './overlapped-map.ts';
import { validParentEntry, } from './preparation-selection-records.ts';
import type { FrozenPreparationSelection, } from './preparation-selection-model.ts';

//region Current population reconstruction without a replacement sampler

/**
 * Native reconstruction used internally before frozen artifact relationships can be accepted.
 *
 * @example
 * ```ts
 * const current = await readPreparationRootPopulation({ pin, selection, l });
 * ```
 */
export type PreparationRootPopulation = {
  /**
   * Native complete listing, including policy-excluded entries.
   */
  readonly listedEntryIds: readonly string[];
  /**
   * Successful raw object reads keep byte identities even for incomplete pairs.
   */
  readonly rawDocuments: readonly PreparationRootRawDocument[];
  /**
   * Native policy exclusions preserve their original order.
   */
  readonly excluded: readonly PreparationRootExclusion[];
  /**
   * Eligible count includes unselected entries with no aligned parent.
   */
  readonly eligibleEntries: number;
  /**
   * Whole population metadata never includes unrelated full-parent prose.
   */
  readonly population: readonly PreparationRootPopulationParent[];
  /**
   * Selected current entry texts only.
   */
  readonly entries: readonly PreparationRootEntry[];
  /**
   * Exactly the original frozen parent order.
   */
  readonly parents: readonly PreparationRootParent[];
  /**
   * Every native alignment observation is compared with the frozen population record.
   */
  readonly observations: readonly {
    readonly entryId: string;
    readonly kind: 'section-alignment';
    readonly finding: AlignmentFinding
  }[];
  /**
   * Selected parents precede definition-only dependencies in deterministic order.
   */
  readonly registry: readonly PreparationRootRegistration[];
  /**
   * Unaligned definition inventories are retained without extending model scope.
   */
  readonly unalignedDefinitions: readonly PreparationRootUnalignedDefinitions[];
};

/**
 * Reconstructs the full native eligibility population, then looks up rather than redraws frozen parent identities.
 *
 * @param pin - independent pin already snapshotted and resolved by the owning entry point
 *
 * @param selection - owned byte-checked selection, not caller-supplied occurrence tables
 *
 * @param l - caller logger retaining root reconstruction scope
 *
 * @returns Current population and selected-entry closure for semantic validation
 *
 * @throws PreparationRootError when listing grammar or frozen parent membership differs
 *
 * @example
 * ```ts
 * const population = await readPreparationRootPopulation({ pin, selection, l });
 * ```
 */
export async function readPreparationRootPopulation({
  pin,
  selection,
  l,
}: {
  readonly pin: CorpusPin;
  readonly selection: FrozenPreparationSelection;
  readonly l: Logger;
},): Promise<PreparationRootPopulation> {
  /**
   * Population reconstruction cannot inherit call permission from observations or failures.
   */
  const pl = tagged({
    tag: readPreparationRootPopulation.name,
    l,
  },);
  /**
   * Listing happens through the same independently resolved native pin as object reads.
   */
  const listedEntryIds = await listCorpusPeople({ pin, },);
  if ((new Set(listedEntryIds,).size !== listedEntryIds.length)
    || listedEntryIds.some(function invalid(entryId,): boolean { return entryId.includes('/',) || (!validParentEntry(entryId,)); },))
    throw new PreparationRootError({
      kind: 'corpus-identity',
      input: 'people/',
    },);
  /**
   * No sampler is invoked; these exact identities define the selected part of the current population.
   */
  const selectedParentIds = new Set(selection.parents
    .map(function identity(parent,): string { return parent.parentId; },),);
  /**
   * Only selected complete entries can contribute definition-only dependencies.
   */
  const selectedEntryIds = new Set(selection.parents
    .map(function identity(parent,): string { return parent.entryId; },),);
  /**
   * Owned result collections accumulate one entry at a time without corpus-wide read fan-out.
   */
  const rawDocuments: PreparationRootRawDocument[] = [];
  /**
   * Exclusions remain population evidence rather than disappearance from the denominator.
   */
  const excluded: PreparationRootExclusion[] = [];
  /**
   * Eligible identities retain content-free entries without inventing parents.
   */
  const eligibleEntryIds: string[] = [];
  /**
   * Only native metadata is retained for unselected parent scopes.
   */
  const population: PreparationRootPopulationParent[] = [];
  /**
   * Selected complete entries retain their current normalized source context.
   */
  const entries: PreparationRootEntry[] = [];
  /**
   * Frozen parent membership is verified before the final ordered projection.
   */
  const selectedParents = new Map<string, PreparationRootParent>();
  /**
   * Section observations do not become automatic section questions.
   */
  const observations: {
    readonly entryId: string;
    readonly kind: 'section-alignment';
    readonly finding: AlignmentFinding
  }[] = [];
  /**
   * Native closure records are ordered only after every selected entry has been reconstructed.
   */
  const registrations: PreparationRootRegistration[] = [];
  /**
   * Definition namespaces outside aligned parents are explicit but non-serving.
   */
  const unalignedDefinitions: PreparationRootUnalignedDefinitions[] = [];
  /**
   * Explicit single-entry resource envelope retains serial native reads without an unbounded promise fan-out.
   */
  const processedEntryIds = await mapOverlapped({
    items: listedEntryIds,
    overlap: 1,
    oneItem: async function collect({ item: entryId, },): Promise<string> {
    /**
     * This entry's parsed documents do not escape into unrelated population records.
     */
    const current = await readPreparationRootEntry({
      pin,
      entryId,
      l: pl,
    },);
    rawDocuments.push(...current.rawDocuments,);
    if (current.kind === 'excluded') {
      excluded.push(current.exclusion,);
      return entryId;
    }
    eligibleEntryIds.push(entryId,);
    population.push(...current.parents
      .map(preparationRootPopulationParent,),);
    observations.push(...current.entry
      .alignmentFindings
      .map(function observation(finding,): {
        readonly entryId: string;
        readonly kind: 'section-alignment';
        readonly finding: AlignmentFinding
      } {
      return {
        entryId,
        kind: 'section-alignment',
        finding,
      };
    },),);
    if (!selectedEntryIds.has(entryId,))
      return entryId;
    entries.push(current.entry,);
    for (const parent of current.parents) {
      if (!selectedParentIds.has(parent.id,))
        continue;
      if (selectedParents.has(parent.id,))
        throw new PreparationRootError({
          kind: 'population',
          input: parent.id,
        },);
      selectedParents.set(
        parent.id,
        parent,
      );
    }
    registrations.push(...preparationRootRegistrations({
      entryId,
      source: current.source,
      target: current.target,
      pairs: current.pairs,
      selectedParentIds,
    },),);
    /**
     * Only nonempty unaligned inventories need a namespace record.
     */
    const namespace = preparationRootUnalignedDefinitions({
      entryId,
      source: current.source,
      target: current.target,
      pairs: current.pairs,
    },);
    if ((namespace.source
      .length
      > 0) || (namespace.target
        .length
        > 0))
      unalignedDefinitions.push(namespace,);
    return entryId;
  },
  },);
  /**
   * Missing selected parents are refusals, never a reason to substitute another population member.
   */
  const parents = selection.parents
    .map(function selected(frozen,): PreparationRootParent {
    /**
     * Current parent identity is looked up under the original frozen spelling.
     */
    const parent = selectedParents.get(frozen.parentId,);
    if (parent === undefined)
      throw new PreparationRootError({
        kind: 'population',
        input: frozen.parentId,
      },);
    return parent;
  },);
  /**
   * Current registration identities must not merge distinct native parent occurrences.
   */
  const byParent = new Map<string, PreparationRootRegistration>();
  /**
   * Definition-only records retain native order while the same pass indexes selected identities.
   */
  const dependencies: PreparationRootRegistration[] = [];
  for (const registration of registrations) {
    byParent.set(
      registration.parentId,
      registration,
    );
    if (!selectedParentIds.has(registration.parentId,))
      dependencies.push(registration,);
  }
  if (byParent.size !== registrations.length)
    throw new PreparationRootError({
      kind: 'population',
      input: 'initial parent registry',
    },);
  /**
   * Writer-parent order is frozen; definition-only additions retain native entry/parent order.
   */
  const registry = [
    ...parents.map(function selected(parent,): PreparationRootRegistration {
      /**
       * Each selected parent must retain even a zero-question structural record.
       */
      const registration = byParent.get(parent.id,);
      if (registration === undefined)
        throw new PreparationRootError({
          kind: 'population',
          input: parent.id,
        },);
      return registration;
    },),
    ...dependencies,
  ];
  pl.info(`reconstructed ${String(population.length,)} current population parents and ${String(registry.length,)} initial scope records without redrawing`,);
  return {
    listedEntryIds: processedEntryIds,
    rawDocuments,
    excluded,
    eligibleEntries: eligibleEntryIds.length,
    population,
    entries,
    parents,
    observations,
    registry,
    unalignedDefinitions,
  };
}

//endregion Current population reconstruction without a replacement sampler
