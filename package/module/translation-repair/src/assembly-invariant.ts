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
  const incumbentByIndex = new Map(slices.map(function toEntry(slice,): [number, string,] {
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
 * Refuses a returned document that disagrees with its own change set.
 *
 * The one check that covers paths nobody has thought of yet: whatever route a
 * replacement took, a document that differs from the archive must name at least
 * one changed slice, and a document identical to it must name none.
 *
 * @param incumbentText - archive document the lane started from
 *
 * @param assembledText - document the lane is about to return
 *
 * @param shippedChunkIndices - slices it says the returned document carries a
 * change for
 *
 * @throws AssemblyContractError when exactly one of the two says a change
 * happened
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
  /**
   * Whether the returned document moved off the archive at all.
   */
  const documentMoved = assembledText !== incumbentText;

  /**
   * Whether the lane says any slice moved.
   */
  const anyShipped = shippedChunkIndices.length > 0;
  if (documentMoved === anyShipped)
    return;

  throw new AssemblyContractError({
    message: documentMoved
      ? 'returned document differs from the archive while no slice is named as changed'
      : `returned document equals the archive while ${
        String(shippedChunkIndices.length,)
      } slices are named as changed`,
  },);
}

//endregion Assembly invariant
