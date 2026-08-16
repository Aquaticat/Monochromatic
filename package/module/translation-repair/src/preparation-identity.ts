import { createHash, } from 'node:crypto';

import type { ChunkPair, } from './chunk-document.ts';
import { isInsertionChunk, } from './chunk-placement.ts';
import type { PreparedDocumentPair, } from './document-preparation.ts';

//region Preparation identity
// WHICH SLICING a result describes, as against which entry it names.
//
// Two lanes are compared slice by slice, joined on a global index. Equal slice
// counts, equal indices and equal incumbent text do not prove the two ran over
// one preparation: the same wording can cover different source passages, and
// every insertion anchor's incumbent is the empty string, so a document with
// several untranslated sections offers several rows that look identical. A
// comparison joining two slicings is undetectable afterwards, because every row
// it produces is individually well formed.
//
// So a preparation names itself, once, and everything derived from it records
// that name.
//
// WHAT IT COVERS is the preparation and nothing else: both documents, every
// slice's placement, offsets and exact text, the pairing between the two sides,
// the line-structured flag, and the identity context. What it deliberately
// EXCLUDES is everything about the run: the commit, the pipeline digest, the
// rosters, the call configuration, timings, cache state, and any lane's output.
// A resumed run over the same slicing must produce the same identity, or the
// field answers "was this the same attempt" rather than the question it is for.
//
// The target's PLACEMENT KIND is the field that earns this. Without it a
// content slice that happens to be blank and a place the archive never
// translated hash identically, which is the pair every other guard here exists
// to separate.

/**
 * Hash behind the identity.
 */
const DIGEST_ALGORITHM = 'sha256';

/**
 * Name of the scheme a recorded identity was produced by.
 *
 * Carried in the value rather than assumed, so changing what is hashed or how
 * it is framed makes a DIFFERENT string rather than a same-looking one. Without
 * it, a later scheme would silently make two incomparable values comparable.
 */
const IDENTITY_FORMAT = 'sha256-preparation-v1';

/**
 * Character between the scheme name and the hex, chosen because neither side
 * can contain it.
 */
const FORMAT_SEPARATOR = ':';

/**
 * Identity of one slicing of one document pair.
 *
 * Branded so it cannot be assigned where a pipeline digest or a git object id
 * belongs. All three are 64 hex characters behind a label and they answer
 * different questions: this one names WHAT WAS SLICED, not what ran or when.
 *
 * @example
 * ```ts
 * const identity: PreparationIdentity = preparationIdentity({ prepared, },);
 * ```
 */
export type PreparationIdentity = string & { readonly __brand: 'PreparationIdentity'; };

/**
 * Frames one field so no field's content can forge another's boundary.
 *
 * LENGTH PREFIXED rather than separated by a byte assumed absent from the text.
 * Slice text is arbitrary document content: it can hold any separator anyone
 * might pick, including newlines and null bytes, so a separator scheme would be
 * forgeable by a document that contained it. A byte count cannot be forged by
 * the bytes it counts.
 *
 * @param value - field content
 *
 * @returns Byte count, a colon, then the content
 *
 * @example
 * ```ts
 * const framed = framed({ value: 'The cat naps.', },);
 * ```
 */
function framed({ value, }: { readonly value: string; },): string {
  return `${String(Buffer.byteLength(value, 'utf8',),)}:${value}`;
}

/**
 * Frames a number, so a count and a string cannot collide.
 *
 * @param value - number to frame
 *
 * @returns Framed decimal form
 *
 * @example
 * ```ts
 * const framedIndex = framedNumber({ value: 3, },);
 * ```
 */
function framedNumber({ value, }: { readonly value: number; },): string {
  return framed({ value: String(value,), },);
}

/**
 * Canonical form of one prepared slice.
 *
 * BOTH SIDES IN ONE ROW, which is what records the pairing: two preparations
 * that produced the same passages and paired them differently have the same
 * fields in a different order, and hashing rows rather than two lists is what
 * makes that a different identity.
 *
 * @param slice - prepared pair
 *
 * @param lineStructured - whether this slice is governed line by line, which
 * changes what every stage is allowed to do to it
 *
 * @returns Framed fields of this slice, in fixed order
 *
 * @example
 * ```ts
 * const row = sliceRow({ slice, lineStructured: false, },);
 * ```
 */
function sliceRow(
  {
    slice,
    lineStructured,
  }: {
    readonly slice: ChunkPair;
    readonly lineStructured: boolean;
  },
): string {
  return [
    framedNumber({ value: slice.target
      .chunkIndex, },),
    // The source side is always existing content; its kind is framed anyway, so
    // a later one-sided slicing cannot change the meaning of a row without
    // changing its bytes.
    framed({ value: 'content', },),
    framedNumber({ value: slice.source
      .startOffset, },),
    framedNumber({ value: slice.source
      .endOffset, },),
    framed({ value: slice.source
      .text, },),
    framed({ value: isInsertionChunk(slice.target,) ? 'insertion' : 'content', },),
    framedNumber({ value: slice.target
      .startOffset, },),
    framedNumber({ value: slice.target
      .endOffset, },),
    framed({ value: slice.target
      .text, },),
    framed({ value: lineStructured ? 'line-structured' : 'free', },),
  ].join('',);
}

/**
 * Names the slicing a prepared pair represents.
 *
 * @param prepared - preparation to name, read as it stands rather than from any
 * record derived from it
 *
 * @returns Identity of this slicing, stable across runs and resumptions
 *
 * @example
 * ```ts
 * const identity = preparationIdentity({ prepared, },);
 * ```
 */
export function preparationIdentity(
  { prepared, }: { readonly prepared: PreparedDocumentPair; },
): PreparationIdentity {
  /**
   * Whole payload, framed field by field in a fixed order.
   *
   * Both document texts are hashed beside the slices rather than trusted to be
   * implied by them: a section neither side sliced appears in no row, so two
   * preparations differing only outside every slice would otherwise agree.
   */
  const payload = [
    framed({ value: IDENTITY_FORMAT, },),
    framed({ value: prepared.sourceText, },),
    framed({ value: prepared.targetText, },),
    framedNumber({ value: prepared.slices
      .length, },),
    ...prepared.slices
      .map(function toRow(slice,): string {
        return sliceRow({
          slice,
          lineStructured: prepared.lineStructuredSliceIndices
            .has(slice.target
              .chunkIndex,),
        },);
      },),
    // STATED EITHER WAY, because absent context and empty context are different
    // preparations: one asks the models about a document with no declared
    // names, the other about one whose declared names are nothing.
    framed({ value: (prepared.identityContext === undefined) ? 'no-identity-context' : 'identity-context', },),
    framed({ value: prepared.identityContext ?? '', },),
  ].join('',);
  return `${IDENTITY_FORMAT}${FORMAT_SEPARATOR}${
    createHash(DIGEST_ALGORITHM,)
      .update(payload, 'utf8',)
      .digest('hex',)
  }` as PreparationIdentity;
}

//endregion Preparation identity
