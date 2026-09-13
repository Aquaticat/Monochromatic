import type { PreparationRootArtifacts, } from './preparation-root-artifacts.ts';
import { PreparationRootError, } from './preparation-root-error.ts';
import type { PreparationRootPopulation, } from './preparation-root-population.ts';
import {
  assertPreparationRootEqual,
  preparationRootArray,
  preparationRootRecord,
  preparationRootString,
} from './preparation-root-value.ts';

//region Complete entry reading provenance before parent obligations

/**
 * Binds every complete entry frame and its current or carried reading to the current pinned corpus.
 *
 * @param artifacts - private reader over freshly byte-matched support
 *
 * @param current - independently reconstructed selected entry contexts
 *
 * @returns Owned journal entries keyed by the verified native entry identities
 *
 * @throws PreparationRootError when reading order, hashes, frames or carry-forward provenance differs
 *
 * @example
 * ```ts
 * const readings = preparationRootEntryReadings({ artifacts, current });
 * ```
 */
export function preparationRootEntryReadings({
  artifacts,
  current,
}: {
  readonly artifacts: PreparationRootArtifacts;
  readonly current: PreparationRootPopulation;
},): ReadonlyMap<string, Readonly<Record<string, unknown>>> {
  /**
   * The journal's whole prior-artifact identity is independent of selected row assertions.
   */
  const {
    journal,
    priorJournal,
    priorJournalHash,
  } = artifacts;
  assertPreparationRootEqual({
    actual: journal.priorJournalHash,
    expected: priorJournalHash,
    kind: 'reading-provenance',
  },);
  /**
   * Native entry order must not be replaced with a subset or a lookup that hides duplicates.
   */
  const readings = preparationRootArray(journal.entries,)
    .map(function record(value,): Readonly<Record<string, unknown>> { return preparationRootRecord(value,); },);
  assertPreparationRootEqual({
    actual: readings.map(function identity(row,): unknown { return row.entryId; },),
    expected: current.entries
      .map(function identity(entry,): string { return entry.entryId; },),
    kind: 'reading-provenance',
  },);
  /**
   * Prior rows stay byte-bound; only exact carried relationships are interpreted.
   */
  const priorEntries = preparationRootArray(priorJournal.entries,)
    .map(function record(value,): Readonly<Record<string, unknown>> { return preparationRootRecord(value,); },);
  /**
   * Result ownership remains local to the root operation.
   */
  const byEntry = new Map<string, Readonly<Record<string, unknown>>>();
  for (const [index, entry,] of current.entries
    .entries()) {
    /**
     * Positional equality has already established which journal row owns this entry.
     */
    const reading = readings[index];
    if (reading === undefined)
      throw new PreparationRootError({
        kind: 'reading-provenance',
        input: entry.entryId,
      },);
    assertPreparationRootEqual({
      actual: reading.sourceHash,
      expected: entry.sourceHash,
      kind: 'reading-provenance',
      input: entry.entryId,
    },);
    assertPreparationRootEqual({
      actual: reading.targetHash,
      expected: entry.targetHash,
      kind: 'reading-provenance',
      input: entry.entryId,
    },);
    /**
     * Frozen pool order, not section sorting, determines the frame's selected-parent list.
     */
    const selectedIndexes = current.parents
      .filter(function belongs(parent,): boolean { return parent.entryId === entry.entryId; },)
      .map(function position(parent,): number { return parent.pairIndex; },);
    assertPreparationRootEqual({
      actual: reading.selectedParentIndexes,
      expected: selectedIndexes,
      kind: 'reading-provenance',
      input: entry.entryId,
    },);
    artifacts.frame({
      file: preparationRootString(reading.file,),
      hash: preparationRootString(reading.fileHash,),
      consumer: entry.entryId,
      expectedText: `# ${entry.entryId}\n\nSelected parent indexes: ${selectedIndexes.join(', ',)}\n\nDeclared-original policy: ${entry.originalPolicy
        .normalized}\n\n## Full original\n\n${entry.sourceText}\n\n## Full normalized incumbent\n\n${entry.targetText}\n`,
    },);
    if (reading.currentNoteFile !== undefined) {
      assertPreparationRootEqual({
        actual: reading.completeEntryReading,
        expected: 'read-current-policy-entry',
        kind: 'reading-provenance',
        input: entry.entryId,
      },);
      /**
       * The current note is independently linked by both locator and exact byte identity.
       */
      const note = artifacts.note({
        path: preparationRootString(reading.currentNoteFile,),
        hash: preparationRootString(reading.currentNoteHash,),
        consumer: entry.entryId,
      },);
      assertPreparationRootEqual({
        actual: note.entryId,
        expected: entry.entryId,
        kind: 'reading-provenance',
        input: entry.entryId,
      },);
      assertPreparationRootEqual({
        actual: note.readExtent,
        expected: 'complete source and normalized target entry',
        kind: 'reading-provenance',
        input: entry.entryId,
      },);
    }
    else {
      assertPreparationRootEqual({
        actual: reading.completeEntryReading,
        expected: 'carried-by-exact-entry-hashes',
        kind: 'reading-provenance',
        input: entry.entryId,
      },);
      assertPreparationRootEqual({
        actual: reading.priorJournalHash,
        expected: priorJournalHash,
        kind: 'reading-provenance',
        input: entry.entryId,
      },);
      /**
       * A carried row is not established merely by repeating its own hashes.
       */
      const prior = preparationRootRecord(reading.priorReading,);
      /**
       * Exact prior membership must be unique before it can carry reading provenance.
       */
      const priorMatches = priorEntries.filter(function sameEntry(row,): boolean {
        return row.entryId === entry.entryId;
      },);
      if (priorMatches.length !== 1)
        throw new PreparationRootError({
          kind: 'reading-provenance',
          input: entry.entryId,
        },);
      assertPreparationRootEqual({
        actual: prior,
        expected: priorMatches[0],
        kind: 'reading-provenance',
        input: entry.entryId,
      },);
      assertPreparationRootEqual({
        actual: prior.sourceHash,
        expected: entry.sourceHash,
        kind: 'reading-provenance',
        input: entry.entryId,
      },);
      assertPreparationRootEqual({
        actual: prior.targetHash,
        expected: entry.targetHash,
        kind: 'reading-provenance',
        input: entry.entryId,
      },);
    }
    byEntry.set(
      entry.entryId,
      reading,
    );
  }
  return byEntry;
}

//endregion Complete entry reading provenance before parent obligations
