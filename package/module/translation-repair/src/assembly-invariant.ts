import type { ChunkPair, } from './chunk-document.ts';
import type { SliceReplacement, } from './splice-slices.ts';

//region Assembly invariant
// Two checks both lanes run around assembly, because both lanes can otherwise
// report a change the returned document does not carry.
//
// The reachable way in is the SLICE CACHE. A cached record is trusted on its
// chunk index alone, so a record claiming a change while carrying the archive's
// own wording is offered to the guard as a replacement, survives it, and lands
// in the shipped index set beside a document nobody changed. A truncated write
// that still parses, or a slicing that moved while the pipeline digest did not,
// both produce exactly that record.
//
// These are ASSERTIONS rather than repairs on purpose: silently dropping the
// suspect replacement would leave a run reporting counts nobody can reproduce.

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
 * Refuses a returned document whose text and change set disagree.
 *
 * BOTH DIRECTIONS, but only because the guard was taught to make the second one
 * true. A document that differs from the archive while no slice is named cannot
 * happen on any run: every byte of the difference came from some replacement,
 * and a replacement that survived is a slice that shipped.
 *
 * The other direction USED TO BE UNCHECKABLE. Two adjacent slices whose
 * replacements each differ from their own incumbent can concatenate back to the
 * archive text, say by moving a line break across the join: every replacement
 * is a real change, and the document is unchanged. Refusing that would have
 * crashed a run the models got right, so this assertion checked one direction
 * and the contradiction stayed reachable.
 *
 * `guardFootnoteAssembly` now canonicalizes exactly that case, withdrawing
 * every replacement that reassembles to the archive text and saying so in its
 * findings, which makes `(assembledText !== incumbentText) ===
 * (shipped.length > 0)` a guard postcondition rather than a hope. So the second
 * direction is back, and it now catches the case that motivated it: a shipped
 * set naming slices the returned document does not carry.
 *
 * @param incumbentText - archive document the lane started from
 *
 * @param assembledText - document the lane is about to return
 *
 * @param shippedChunkIndices - slices it says the returned document carries a
 * change for
 *
 * @throws AssemblyContractError when the document moved and no slice is named,
 * or when it did not move and some slice is
 *
 * @example
 * ```ts
 * assertDocumentChangeAgrees({ incumbentText, assembledText, shippedChunkIndices, },);
 * ```
 */
export function assertDocumentChangeAgrees(
  {
    incumbentText,
    assembledText,
    shippedChunkIndices,
  }: {
    readonly incumbentText: string;
    readonly assembledText: string;
    readonly shippedChunkIndices: readonly number[];
  },
): void {
  if ((assembledText !== incumbentText) && (shippedChunkIndices.length === 0))
    throw new AssemblyContractError({
      message: 'returned document differs from the archive while no slice is named as changed',
    },);
  if ((assembledText === incumbentText) && (shippedChunkIndices.length > 0))
    throw new AssemblyContractError({
      message: `returned document equals the archive while slices ${
        shippedChunkIndices.join(', ',)
      } are named as changed`,
    },);
}

//endregion Assembly invariant
