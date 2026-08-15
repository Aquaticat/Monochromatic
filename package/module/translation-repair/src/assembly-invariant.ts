import type { ChunkPair, } from './chunk-document.ts';
import {
  type SliceReplacement,
  spliceSlices,
} from './splice-slices.ts';

//region Assembly invariant
// The checks both lanes run around assembly, because both lanes can otherwise
// report a change the returned document does not carry.
//
// WHAT THESE DEFEND AGAINST HAS MOVED, and the old answer is worth stating so
// nobody re-derives it. It used to be the slice cache: a resumed record was
// trusted on its chunk index alone, so one claiming a change while carrying the
// archive's own wording reached the guard as a replacement and landed in the
// shipped set beside a document nobody changed. Both lanes now refuse that
// record where they accept it, in `slice-record-agreement.ts`, and both derive `changed`
// from their own text rather than from a vote, so no fresh record reaches here
// contradicting itself either.
//
// So these are now a BACKSTOP: for a defect in a stage nobody has changed yet,
// for a future caller of the exported guard, and for the one relation no single
// slice can see, which is what the document-level check reads.
//
// ASSERTIONS rather than repairs on purpose: silently dropping a suspect
// replacement would leave a run reporting counts nobody can reproduce. The one
// place assembly DOES repair rather than refuse is the net-zero canonicalization
// in `guardFootnoteAssembly`, and it repairs because nobody did anything wrong
// there.

/**
 * Raised when assembly is handed, or produces, a document and a change set that
 * contradict each other.
 *
 * @example
 * ```ts
 * throw new AssemblyContractError({ message: 'slice 4 claims a change it does not make', },);
 * ```
 */
export class AssemblyContractError extends Error {
  /**
   * Builds the error with a message naming the contradiction.
   *
   * @param message - what disagreed, naming the slice where one exists
   *
   * @example
   * ```ts
   * throw new AssemblyContractError({ message: 'slice 4 claims a change it does not make', },);
   * ```
   */
  constructor({ message, }: { readonly message: string; },) {
    super(message,);
    this.name = 'AssemblyContractError';
  }
}

/**
 * Refuses a replacement whose text is what the slice already said.
 *
 * Writing a slice back over itself changes no byte of the document and still
 * counts, in every later rate and index set, as a slice the lane changed. That
 * is worse than a crash: the run settles, the artifact records it, and the
 * number is wrong wherever it is read afterwards.
 *
 * @param slices - prepared slice pairs, which supply each incumbent
 *
 * @param replacements - what the lane wants assembly to write
 *
 * @throws AssemblyContractError when a replacement names an unknown slice, or
 * repeats its incumbent verbatim
 *
 * @example
 * ```ts
 * assertReplacementsChange({ slices, replacements, },);
 * ```
 */
export function assertReplacementsChange(
  {
    slices,
    replacements,
  }: {
    readonly slices: readonly ChunkPair[];
    readonly replacements: readonly SliceReplacement[];
  },
): void {
  /**
   * Archive wording of each prepared slice.
   */
  const incumbentByIndex = new Map(slices.map(function toEntry(slice,): [
    number,
    string,
  ] {
    return [
      slice.target
        .chunkIndex,
      slice.target
        .text,
    ];
  },),);
  for (const replacement of replacements) {
    /**
     * What the archive said for this slice.
     */
    const incumbentText = incumbentByIndex.get(replacement.chunkIndex,);
    if (incumbentText === undefined)
      throw new AssemblyContractError({
        message: `replacement names slice ${
          String(replacement.chunkIndex,)
        }, which this preparation never produced`,
      },);
    if (replacement.replacementText === incumbentText)
      throw new AssemblyContractError({
        message: `slice ${String(replacement.chunkIndex,)} claims a change and carries the archive wording`,
      },);
  }
}

/**
 * Both index sets a lane result carries, checked and put in document order.
 *
 * @example
 * ```ts
 * const { shipped, withdrawn, } = orderedChangeSets({ sliceCount, shipped, withdrawn, },);
 * ```
 */
export type OrderedChangeSets = {
  /**
   * Slices the returned document carries a change for, ascending.
   */
  readonly shipped: readonly number[];

  /**
   * Slices whose change was taken back, ascending.
   */
  readonly withdrawn: readonly number[];
};

/**
 * Checks both index sets and returns them in document order.
 *
 * Both lane contracts claim these sets are disjoint, in range and free of
 * repeats, and until now nothing checked any of it. The shipped set was sorted
 * at each call site and the withdrawn set was passed through in whatever order
 * the guard took slices back, so two lanes compared slice by slice were being
 * read from lists ordered by different rules.
 *
 * @param sliceCount - slices the preparation produced, which bounds both sets
 *
 * @param shipped - slices the document carries a change for
 *
 * @param withdrawn - slices whose change was taken back
 *
 * @returns Both sets ascending
 *
 * @throws AssemblyContractError when an index is not a whole number, falls
 * outside the prepared slices, repeats within its set, or appears in both
 *
 * @example
 * ```ts
 * const ordered = orderedChangeSets({ sliceCount, shipped, withdrawn, },);
 * ```
 */
export function orderedChangeSets(
  {
    sliceCount,
    shipped,
    withdrawn,
  }: {
    readonly sliceCount: number;
    readonly shipped: readonly number[];
    readonly withdrawn: readonly number[];
  },
): OrderedChangeSets {
  /**
   * Every index either set names, since the range and integrality rules are
   * the same for both.
   */
  const named = [
    ...shipped,
    ...withdrawn,
  ];
  for (const index of named) {
    if (!Number.isInteger(index,))
      throw new AssemblyContractError({
        message: `change set holds ${String(index,)}, which is not a slice index`,
      },);
    if ((index < 0) || (index >= sliceCount))
      throw new AssemblyContractError({
        message: `change set names slice ${String(index,)} of ${String(sliceCount,)} prepared`,
      },);
  }
  if (new Set(shipped,).size !== shipped.length)
    throw new AssemblyContractError({ message: 'shipped slices repeat', },);
  if (new Set(withdrawn,).size !== withdrawn.length)
    throw new AssemblyContractError({ message: 'withdrawn slices repeat', },);

  /**
   * Slices claimed by both sets, which no slice can be.
   */
  const both = shipped.filter(function isWithdrawnToo(index,): boolean {
    return withdrawn.includes(index,);
  },);
  if (both.length > 0)
    throw new AssemblyContractError({
      message: `slices ${both.join(', ',)} are named as both shipped and withdrawn`,
    },);

  return {
    shipped: shipped.toSorted(function ascending(
      left,
      right,
    ): number {
      return left - right;
    },),
    withdrawn: withdrawn.toSorted(function ascending(
      left,
      right,
    ): number {
      return left - right;
    },),
  };
}

/**
 * Names the slices a returned document carries a change for, refusing any
 * document its own surviving replacements do not reconstruct.
 *
 * DERIVED RATHER THAN ACCEPTED, which is the whole point. Both lanes used to
 * map the surviving replacements to indices themselves and hand the result here
 * as an independent argument, so a caller passing a set that named the wrong
 * slices was checked only for being empty or not. A document changed in slices
 * 2 and 3 while reporting only slice 1 passed. Taking the replacements instead
 * makes the two impossible to disagree, and re-splicing them is what proves the
 * returned text is the one those replacements make.
 *
 * THE EMPTINESS CHECK SURVIVES THE RE-SPLICE, and is not redundant with it. A
 * net-zero set genuinely re-splices to the archive text, so exact reconstruction
 * accepts it; what refuses it is the second direction, which enforces
 * `guardFootnoteAssembly`'s canonical answer that such a set ships nothing.
 * That direction was unenforceable until the guard learned to canonicalize:
 * two adjacent slices whose replacements each differ from their own incumbent
 * can reassemble to the archive text, and refusing THAT would crash a run the
 * models got right.
 *
 * PRECONDITION, and the only way a legitimate run reaches a refusal here: the
 * replacements must be what `guardFootnoteAssembly` LET STAND, not what a lane
 * proposed. The guard is where a net-zero set becomes no survivors, so calling
 * this first, on a set that reassembles to the archive text, refuses a run
 * nobody got wrong. The message says so, because the fix is the call order
 * rather than anything about the document.
 *
 * @param incumbentText - archive document the lane started from
 *
 * @param assembledText - document the lane is about to return
 *
 * @param slices - prepared slices, which place every replacement
 *
 * @param survivingReplacements - what `guardFootnoteAssembly` let stand, which
 * is the only admissible source for both the text and the index set; a set that
 * has not been through the guard can be a legitimate net-zero this refuses
 *
 * @returns Slices the returned document carries a change for
 *
 * @throws AssemblyContractError when a surviving replacement repeats its own
 * incumbent, when re-splicing them does not reproduce the returned document,
 * when that document moved while nothing survived, or when it did not move
 * while something did
 *
 * @example
 * ```ts
 * const shipped = deriveShippedIndices({ incumbentText, assembledText, slices, survivingReplacements, },);
 * ```
 */
export function deriveShippedIndices(
  {
    incumbentText,
    assembledText,
    slices,
    survivingReplacements,
  }: {
    readonly incumbentText: string;
    readonly assembledText: string;
    readonly slices: readonly ChunkPair[];
    readonly survivingReplacements: readonly SliceReplacement[];
  },
): readonly number[] {
  // Sound when called on its own, rather than relying on every caller having
  // run this before the guard. A replacement repeating its incumbent survives
  // assembly untouched and would otherwise be named as shipped.
  assertReplacementsChange({
    slices,
    replacements: survivingReplacements,
  },);

  /**
   * Document those replacements make, computed here rather than trusted.
   */
  const reconstructed = spliceSlices({
    targetText: incumbentText,
    slices,
    replacements: survivingReplacements,
  },);
  if (reconstructed !== assembledText)
    throw new AssemblyContractError({
      message: `returned document is not what its ${
        String(survivingReplacements.length,)
      } surviving replacements assemble to`,
    },);

  /**
   * Slices those replacements name.
   */
  const shipped = survivingReplacements.map(function toIndex(replacement,): number {
    return replacement.chunkIndex;
  },);
  if ((assembledText !== incumbentText) && (shipped.length === 0))
    throw new AssemblyContractError({
      message: 'returned document differs from the archive while no slice is named as changed',
    },);
  if ((assembledText === incumbentText) && (shipped.length > 0))
    throw new AssemblyContractError({
      message: `returned document equals the archive while slices ${
        shipped.join(', ',)
      } are named as changed: a set that reassembles to the archive is a net-zero `
        + 'assembly, which `guardFootnoteAssembly` canonicalizes to no survivors, '
        + 'so pass what the guard let stand rather than what a lane proposed',
    },);
  return shipped;
}

//endregion Assembly invariant
