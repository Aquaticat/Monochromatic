import type { PreparationRootArtifacts, } from './preparation-root-artifacts.ts';
import { PreparationRootError, } from './preparation-root-error.ts';
import type { PreparationRootParent, } from './preparation-root-population-model.ts';
import type { FrozenPreparationObligation, } from './preparation-selection-model.ts';
import {
  assertPreparationRootEqual,
  preparationRootArray,
  preparationRootRecord,
  preparationRootString,
} from './preparation-root-value.ts';

//region Parent reading provenance preserves unresolved source channels

/**
 * Checks current note ownership or exact prior-journal carry-forward for one frozen parent.
 *
 * @param parent - current native parent under its frozen identity
 *
 * @param reading - already ordered parent journal record
 *
 * @param entryReading - already checked complete-entry journal record
 *
 * @param artifacts - owning semantic artifact reader
 *
 * @returns Checked source-obligation detail, not correspondence or call authority
 *
 * @throws PreparationRootError when note or carry-forward ownership differs
 *
 * @example
 * ```ts
 * const detail = parentReadingDetail({ parent, reading, entryReading, artifacts });
 * ```
 */
function parentReadingDetail({
  parent,
  reading,
  entryReading,
  artifacts,
}: {
  readonly parent: PreparationRootParent;
  readonly reading: Readonly<Record<string, unknown>>;
  readonly entryReading: Readonly<Record<string, unknown>>;
  readonly artifacts: PreparationRootArtifacts;
},): Readonly<Record<string, unknown>> {
  if (reading.noteFile !== undefined) {
    assertPreparationRootEqual({
      actual: reading.scopeReading,
      expected: 'reviewed-with-explicit-context-dependencies',
      kind: 'reading-provenance',
      input: parent.id,
    },);
    /**
     * A current reading must match its exact parent record in the bound note.
     */
    const detail = preparationRootRecord(reading.reading,);
    /**
     * The note remains data and is addressed only through a verified journal path/hash edge.
     */
    const note = artifacts.note({
      path: preparationRootString(reading.noteFile,),
      hash: preparationRootString(reading.noteHash,),
      consumer: parent.id,
    },);
    assertPreparationRootEqual({
      actual: note.entryId,
      expected: parent.entryId,
      kind: 'reading-provenance',
      input: parent.id,
    },);
    assertPreparationRootEqual({
      actual: note.readExtent,
      expected: 'complete source and normalized target entry',
      kind: 'reading-provenance',
      input: parent.id,
    },);
    /**
     * Duplicate parent details cannot be hidden by a first-match lookup.
     */
    const matches = preparationRootArray(note.parentReadings,)
      .map(preparationRootRecord,)
      .filter(function sameParent(item,): boolean { return item.pairIndex === parent.pairIndex; },);
    if (matches.length !== 1)
      throw new PreparationRootError({
        kind: 'reading-provenance',
        input: parent.id,
      },);
    assertPreparationRootEqual({
      actual: detail,
      expected: matches[0],
      kind: 'reading-provenance',
      input: parent.id,
    },);
    return detail;
  }
  assertPreparationRootEqual({
    actual: reading.scopeReading,
    expected: 'carried-by-exact-parent-and-entry-hashes',
    kind: 'reading-provenance',
    input: parent.id,
  },);
  assertPreparationRootEqual({
    actual: reading.reading,
    expected: undefined,
    kind: 'reading-provenance',
    input: parent.id,
  },);
  assertPreparationRootEqual({
    actual: reading.priorJournalHash,
    expected: artifacts.priorJournalHash,
    kind: 'reading-provenance',
    input: parent.id,
  },);
  assertPreparationRootEqual({
    actual: reading.priorEntryId,
    expected: parent.entryId,
    kind: 'reading-provenance',
    input: parent.id,
  },);
  /**
   * Prior entry membership is rechecked even when the complete entry also has a newer current note.
   */
  const prior = preparationRootRecord(entryReading.priorReading,);
  /**
   * Exact carried evidence must be present once in the bound prior journal.
   */
  const matches = preparationRootArray(artifacts.priorJournal
    .entries,)
    .map(preparationRootRecord,)
    .filter(function sameEntry(item,): boolean { return item.entryId === parent.entryId; },);
  if (matches.length !== 1)
    throw new PreparationRootError({
      kind: 'reading-provenance',
      input: parent.id,
    },);
  assertPreparationRootEqual({
    actual: prior,
    expected: matches[0],
    kind: 'reading-provenance',
    input: parent.id,
  },);
  assertPreparationRootEqual({
    actual: prior.sourceHash,
    expected: entryReading.sourceHash,
    kind: 'reading-provenance',
    input: parent.id,
  },);
  assertPreparationRootEqual({
    actual: prior.targetHash,
    expected: entryReading.targetHash,
    kind: 'reading-provenance',
    input: parent.id,
  },);
  if (!preparationRootArray(prior.selectedParentIndexes,)
    .includes(parent.pairIndex,))
    throw new PreparationRootError({
      kind: 'reading-provenance',
      input: parent.id,
    },);
  return prior;
}

/**
 * Reconstructs one ordered source-obligation record per parent without upgrading reading notes into model evidence.
 *
 * @param parents - exact current frozen-parent order
 *
 * @param entryReadings - complete entry provenance already checked against current pinned text
 *
 * @param artifacts - fresh owned supporting-document interpretation
 *
 * @returns Explicit source/context obligations, including unresolved scope flags
 *
 * @throws PreparationRootError when parent reading identity, completion or obligation fields differ
 *
 * @example
 * ```ts
 * const obligations = preparationRootParentReadings({ parents, entryReadings, artifacts });
 * ```
 */
export function preparationRootParentReadings({
  parents,
  entryReadings,
  artifacts,
}: {
  readonly parents: readonly PreparationRootParent[];
  readonly entryReadings: ReadonlyMap<string, Readonly<Record<string, unknown>>>;
  readonly artifacts: PreparationRootArtifacts;
},): readonly FrozenPreparationObligation[] {
  /**
   * Full ordered identity equality rejects missing, duplicated and reordered reading rows.
   */
  const readings = preparationRootArray(artifacts.journal
    .parents,)
    .map(preparationRootRecord,);
  assertPreparationRootEqual({
    actual: readings.map(function identity(row,): unknown { return row.id; },),
    expected: parents.map(function identity(parent,): string { return parent.id; },),
    kind: 'reading-provenance',
  },);
  return parents.map(function obligation(
    parent,
    index,
  ): FrozenPreparationObligation {
    /**
     * Parent provenance cannot be detached from a checked complete-entry reading.
     */
    const entryReading = entryReadings.get(parent.entryId,);
    /**
     * Ordering is already checked, but absence still fails at this owning boundary.
     */
    const reading = readings[index];
    if ((reading === undefined) || (entryReading === undefined))
      throw new PreparationRootError({
        kind: 'reading-provenance',
        input: parent.id,
      },);
    assertPreparationRootEqual({
      actual: reading.entryId,
      expected: parent.entryId,
      kind: 'reading-provenance',
      input: parent.id,
    },);
    assertPreparationRootEqual({
      actual: reading.pairIndex,
      expected: parent.pairIndex,
      kind: 'reading-provenance',
      input: parent.id,
    },);
    assertPreparationRootEqual({
      actual: reading.sourceHash,
      expected: parent.source
        .hash,
      kind: 'reading-provenance',
      input: parent.id,
    },);
    assertPreparationRootEqual({
      actual: reading.targetHash,
      expected: parent.target
        .hash,
      kind: 'reading-provenance',
      input: parent.id,
    },);
    assertPreparationRootEqual({
      actual: reading.sourceChars,
      expected: parent.sourceText
        .length,
      kind: 'reading-provenance',
      input: parent.id,
    },);
    assertPreparationRootEqual({
      actual: reading.targetChars,
      expected: parent.incumbentText
        .length,
      kind: 'reading-provenance',
      input: parent.id,
    },);
    /**
     * The checked detail still explicitly withholds automatic correspondence verification.
     */
    const detail = parentReadingDetail({
      parent,
      reading,
      entryReading,
      artifacts,
    },);
    assertPreparationRootEqual({
      actual: detail.automaticPairingVerified,
      expected: false,
      kind: 'reading-provenance',
      input: parent.id,
    },);
    if (((typeof detail.pictureEvidenceNeeded) !== 'boolean')
      || ((detail.scopeQualificationOpen !== undefined) && ((typeof detail.scopeQualificationOpen) !== 'boolean')))
      throw new PreparationRootError({
        kind: 'reading-provenance',
        input: parent.id,
      },);
    /**
     * Original context strings remain unchanged, not executable instructions or a glossary.
     */
    const requiredContext = preparationRootArray(detail.requiredContext,)
      .map(preparationRootString,);
    if (requiredContext.length === 0)
      throw new PreparationRootError({
        kind: 'reading-provenance',
        input: parent.id,
      },);
    return {
      parentId: parent.id,
      requiredContext,
      pictureEvidenceNeeded: detail.pictureEvidenceNeeded,
      scopeQualificationOpen: detail.scopeQualificationOpen === true,
    };
  },);
}

//endregion Parent reading provenance preserves unresolved source channels
