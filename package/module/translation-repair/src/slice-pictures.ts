import type { ChunkPair, } from './chunk-document.ts';
import type { PairedReading, } from './image-reading-pair.ts';
import { photoReferences, } from './photo-reference.ts';

//region Slice pictures
// WHICH PICTURES ONE SLICE IS SHOWN, and what a stage is told about them.
//
// THE SLICE'S OWN AND ITS NEIGHBOURS'. Measured over the pinned corpus, 79 of
// 1260 slices name a picture on the source side and NONE names one on the target
// side without also naming it on the source, so the source's own references are
// the whole attachment surface. But `Zha_Ke/1` carries 3652 characters
// transcribing a letter that `Zha_Ke/2` names, one slice later, so a slice shown
// only its own pictures would be shown nothing about the one it transcribes.
//
// ONE SECTION EACH WAY, which is the width the fidelity window already uses and
// the width the phenomenon has: measured 2026-08-18 over 92 entries, every
// relocation pair in the corpus is adjacent and the longest run of flagged
// slices anywhere is three.
//
// A REFUSED READING BECOMES A FINDING, NOT A CAVEAT IN THE PROMPT. A stage told
// "there is a picture here and nobody could read it" is being handed a hedge it
// has to weigh, and it has no way to weigh it. It is told about the pictures
// that WERE read, and the run records the rest where a person reads findings.

/**
 * How a picture's readings are labelled for the model shown them.
 */
const PICTURE_HEADING = 'PICTURE';

/**
 * What one slice is shown about the pictures around it.
 *
 * @example
 * ```ts
 * const pictures: SlicePictures = { context: '', findings: [], };
 * ```
 */
export type SlicePictures = {
  /**
   * Readings rendered for a prompt, empty when nothing was corroborated.
   */
  readonly context: string;

  /**
   * One line per picture no reading is available for, naming which picture and
   * why, in the wording a scorecard can group.
   */
  readonly findings: readonly string[];
};

/**
 * Pictures named by one slice and by the slices either side of it.
 *
 * @param slices - prepared slice pairs of one entry
 *
 * @param sliceIndex - POSITION IN `slices`, never a stamped `chunkIndex`
 *
 * @returns Asset names in document order, each once
 *
 * @throws {@link RangeError} when `sliceIndex` is not a position in `slices`,
 * since an index stamped elsewhere would silently name no pictures and read as
 * a slice that shows none
 *
 * @example
 * ```ts
 * const names = slicePictureNames({ slices, sliceIndex, },);
 * ```
 */
export function slicePictureNames(
  {
    slices,
    sliceIndex,
  }: {
    readonly slices: readonly ChunkPair[];
    readonly sliceIndex: number;
  },
): readonly string[] {
  if ((!Number.isInteger(sliceIndex,))
    || (sliceIndex < 0)
    || (sliceIndex >= slices.length)) {
    throw new RangeError(
      `slicePictureNames asked for slice ${String(sliceIndex,)} of `
        + `${String(slices.length,)}: not a position in this entry. An index `
        + `stamped elsewhere would name no pictures here, which reads as a `
        + `slice that shows none.`,
    );
  }

  /**
   * Names gathered so far, in order, each once.
   */
  const named = new Set<string>();

  for (const at of [
    sliceIndex - 1,
    sliceIndex,
    sliceIndex + 1,
  ]) {
    /**
     * That slice, absent at either end of the document.
     */
    const beside = slices[at];
    if (beside === undefined)
      continue;
    for (const reference of photoReferences({
      text: beside.source
        .text,
    },))
      named.add(reference.assetName,);
  }

  return [...named,];
}

/**
 * Renders what is known about one slice's pictures, and names what is not.
 *
 * @param slices - prepared slice pairs of one entry
 *
 * @param sliceIndex - POSITION IN `slices`
 *
 * @param readings - what reading produced per asset name, for this entry
 *
 * @returns Prompt block for corroborated readings, plus findings for the rest
 *
 * @throws {@link RangeError} by way of {@link slicePictureNames}
 *
 * @example
 * ```ts
 * const pictures = slicePictures({ slices, sliceIndex, readings, },);
 * ```
 */
export function slicePictures(
  {
    slices,
    sliceIndex,
    readings,
  }: {
    readonly slices: readonly ChunkPair[];
    readonly sliceIndex: number;
    readonly readings: ReadonlyMap<string, PairedReading>;
  },
): SlicePictures {
  /**
   * Pictures this slice and its neighbours show.
   */
  const names = slicePictureNames({
    slices,
    sliceIndex,
  },);

  /**
   * Rendered blocks, one per picture that was read.
   */
  const blocks: string[] = [];

  /**
   * Findings, one per picture that was not.
   */
  const findings: string[] = [];

  for (const assetName of names) {
    /**
     * What reading this picture produced, absent when the entry's readings were
     * never gathered.
     */
    const reading = readings.get(assetName,);
    if (reading === undefined) {
      findings.push(`picture ${assetName}: not read`,);
      continue;
    }
    if (reading.kind === 'unavailable') {
      findings.push(`picture ${assetName}: no reading, ${reading.reason}`,);
      continue;
    }
    if (reading.kind === 'no-text') {
      // WORDED AS A FACT ABOUT THE PICTURE, not about the pipeline. Two thirds
      // of this corpus's pictures are photographs, so a slice showing one is
      // not missing evidence and whoever reads the finding should not go
      // looking for it.
      findings.push(`picture ${assetName}: carries no text`,);
      continue;
    }

    /**
     * Each reader's transcription, named by the model that produced it, since
     * agreement establishes that two readers describe the same picture rather
     * than the same AMOUNT of it: the shorter vouches, the longer informs.
     */
    const transcriptions = reading.readings
      .map(function labelled(one,): string {
        return `${one.modelId}:\n${one.text}`;
      },);
    blocks.push(`${PICTURE_HEADING} ${assetName}\n${transcriptions.join('\n\n',)}`,);
  }

  return {
    context: blocks.join('\n\n',),
    findings,
  };
}

//endregion Slice pictures
