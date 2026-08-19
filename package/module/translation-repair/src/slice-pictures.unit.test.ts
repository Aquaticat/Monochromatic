/**
 * Tests for which pictures one slice is shown, and what a stage is told about
 * a picture nobody could corroborate.
 *
 * WHAT THESE PIN is two claims bolted together. First, that
 * `slicePictureNames` takes one section each way exactly the way
 * `fidelity-window.ts`'s `neighbouringSource` does, including its RangeError
 * contract: an index that is not a position in `slices` must never silently
 * name no pictures, because that reads as a slice that shows none rather than
 * the mistake it is. Second, that `slicePictures` keeps a picture nobody could
 * corroborate out of the rendered prompt entirely and names it in `findings`
 * instead, since a stage handed a hedge it cannot weigh is worse off than one
 * simply not told the picture existed.
 *
 * BOTH READINGS TRAVEL for a picture that was corroborated, labelled by
 * model, which one case here asserts on an exact rendered block: the shorter
 * reading vouches for what it carries and the longer carries more, so a stage
 * shown only one of them loses either the vouching or the content.
 *
 * Fixtures are cat-themed invention. No corpus content appears here.
 *
 * @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  type ChunkPair,
  type PairedReading,
  slicePictureNames,
  slicePictures,
  type SyntheticModelId,
} from '../dist/final/node/index.mjs';

/**
 * Heading `slicePictures` renders before each picture's transcriptions.
 *
 * MIRRORS THE MODULE'S OWN CONSTANT, kept private in `slice-pictures.ts`: this
 * file states same literal directly rather than importing something not
 * exported.
 */
const PICTURE_HEADING = 'PICTURE';

/**
 * Placeholder corpus pages write for an entry's own directory.
 *
 * AN ESCAPED TEMPLATE LITERAL, so characters landing in a slice's text are
 * what corpus text carries rather than an interpolation this file performs
 * by accident. Mirrors `photo-reference.unit.test.ts`.
 */
const ENTRY = `\${path}`;

/**
 * Cat-themed stand-in for one vision reader's model id.
 *
 * A CAST THROUGH `unknown`, since `SyntheticModelId` is a closed union of
 * production identifiers and neither function under test validates one
 * against real roster: `slicePictures` only folds a reading's model id into a
 * rendered label.
 */
const WHISKERS = 'hf:cat/Whiskers' as unknown as SyntheticModelId;

/**
 * Cat-themed stand-in for other vision reader's model id.
 */
const MARMALADE = 'hf:cat/Marmalade' as unknown as SyntheticModelId;

/**
 * Builds one photo element naming given assets, in corpus's only form.
 *
 * @param assetNames - file names within entry's photos directory
 *
 * @returns Element as a page writes it
 *
 * @example
 * ```ts
 * const element = photoElement({ assetNames: ['sunbeam.webp',], },);
 * ```
 */
function photoElement({ assetNames, }: { readonly assetNames: readonly string[]; },): string {
  return `<PhotoScroll photos={[ ${
    assetNames.map(function quoted(assetName,): string {
      return `'${ENTRY}/photos/${assetName}'`;
    },)
      .join(', ',)
  } ]} />`;
}

/**
 * Builds one slice pair carrying given original text, target side empty.
 *
 * Offsets and nodes are named directly rather than parsed, mirroring
 * `fidelity-window.unit.test.ts`: what is under test here is which pictures a
 * slice's own and neighbouring text show, not how a slice was carved.
 *
 * @param text - original-side text this slice covers
 *
 * @param chunkIndex - position of this slice in its document
 *
 * @returns Pair whose original side carries that text
 *
 * @example
 * ```ts
 * const pair = sliceOf({ text: 'Tabby naps.\n', chunkIndex: 0, },);
 * ```
 */
function sliceOf(
  {
    text,
    chunkIndex,
  }: {
    readonly text: string;
    readonly chunkIndex: number;
  },
): ChunkPair {
  return {
    source: {
      chunkIndex,
      nodes: [],
      startOffset: 0,
      endOffset: text.length,
      text,
    },
    target: {
      chunkIndex,
      nodes: [],
      startOffset: 0,
      endOffset: 0,
      text: '',
    },
  };
}

/**
 * Three-slice document where every slice names a DIFFERENT picture, so
 * document order is visible in a returned name list rather than hidden
 * behind a repeat.
 */
const ORDERED_SLICES: readonly ChunkPair[] = [
  `Tabby suns herself on the windowsill.\n\n${photoElement({ assetNames: ['sunbeam.webp',], },)}\n`,
  `She stretches and yawns.\n\n${photoElement({ assetNames: ['stretch.webp',], },)}\n`,
  `Then she naps by the door.\n\n${photoElement({ assetNames: ['nap.webp',], },)}\n`,
].map(function toSlice(
  text,
  chunkIndex,
) {
  return sliceOf({
    text,
    chunkIndex,
  },);
},);

/**
 * Three-slice document where the slices EITHER SIDE of the middle one name
 * the SAME picture and the middle slice names none itself, so a returned
 * name list can be checked for exactly one entry rather than two.
 */
const DUPING_SLICES: readonly ChunkPair[] = [
  `Tabby watches from the sill.\n\n${photoElement({ assetNames: ['perch.webp',], },)}\n`,
  'Then she watches birds outside.\n',
  `By evening she returns to the sill.\n\n${photoElement({ assetNames: ['perch.webp',], },)}\n`,
].map(function toSlice(
  text,
  chunkIndex,
) {
  return sliceOf({
    text,
    chunkIndex,
  },);
},);

/**
 * Three-slice document whose middle slice names no picture itself but sits
 * between two that do, so `slicePictures` on the middle slice renders both
 * neighbours' pictures into one context block.
 */
const MULTI_PICTURE_SLICES: readonly ChunkPair[] = [
  `Tabby dozes in a sunbeam.\n\n${photoElement({ assetNames: ['sunbeam.webp',], },)}\n`,
  'She wakes and stretches.\n',
  `Then she settles for a nap.\n\n${photoElement({ assetNames: ['nap.webp',], },)}\n`,
].map(function toSlice(
  text,
  chunkIndex,
) {
  return sliceOf({
    text,
    chunkIndex,
  },);
},);

/**
 * What shorter reader transcribed from sunbeam picture, vouching for what it
 * carries without contradicting longer reading.
 */
const SUNBEAM_SHORT = 'A tabby cat dozes in a sunbeam.';

/**
 * What longer reader transcribed from same picture, carrying more than
 * shorter reading without contradicting it.
 */
const SUNBEAM_LONG = 'A tabby cat lies curled and dozing in a warm patch of sun by the window.';

/**
 * What shorter reader transcribed from nap picture.
 */
const NAP_SHORT = 'The cat naps beside the door.';

/**
 * What longer reader transcribed from same picture, carrying more than
 * shorter reading without contradicting it.
 */
const NAP_LONG = 'The tabby cat has curled up for a nap on the mat right beside the door.';

/**
 * Readings this document's slices resolve against: both neighbours of the
 * middle slice corroborated, so its rendered context carries both blocks.
 */
const MULTI_PICTURE_READINGS: ReadonlyMap<string, PairedReading> = new Map<string, PairedReading>([
  [
    'sunbeam.webp',
    {
      kind: 'corroborated',
      readings: [
        {
          modelId: WHISKERS,
          text: SUNBEAM_SHORT,
        },
        {
          modelId: MARMALADE,
          text: SUNBEAM_LONG,
        },
      ],
      overlap: 0.82,
    },
  ],
  [
    'nap.webp',
    {
      kind: 'corroborated',
      readings: [
        {
          modelId: WHISKERS,
          text: NAP_SHORT,
        },
        {
          modelId: MARMALADE,
          text: NAP_LONG,
        },
      ],
      overlap: 0.77,
    },
  ],
],);

/**
 * Reading naming one picture unavailable, carrying reason a finding must
 * surface.
 */
const UNAVAILABLE_READINGS: ReadonlyMap<string, PairedReading> = new Map<string, PairedReading>([
  [
    'startled.webp',
    {
      kind: 'unavailable',
      reason: 'readers-disagree',
      perReader: [],
      overlap: 0.04,
    },
  ],
],);

await describe({
  name: slicePictureNames.name,
  children: [
    it({
      name: 'NAMES THE PICTURES A SLICE AND BOTH NEIGHBOURS SHOW, IN DOCUMENT ORDER, since a '
        + 'slice shown only its own reference would be shown nothing about a picture a '
        + 'neighbouring slice already carries',
      fn: async () => {
        expect(slicePictureNames({
          slices: ORDERED_SLICES,
          sliceIndex: 1,
        },),).toEqual([
          'sunbeam.webp',
          'stretch.webp',
          'nap.webp',
        ],);
      },
    },),

    it({
      name: 'GIVES THE FIRST SLICE ONLY ITSELF AND ITS FOLLOWER, since asking for index minus '
        + 'one at the start of a document must not read the end of the array',
      fn: async () => {
        expect(slicePictureNames({
          slices: ORDERED_SLICES,
          sliceIndex: 0,
        },),).toEqual([
          'sunbeam.webp',
          'stretch.webp',
        ],);
      },
    },),

    it({
      name: 'GIVES THE LAST SLICE ONLY ITSELF AND ITS PREDECESSOR, reaching one section back '
        + 'rather than to the start of the document',
      fn: async () => {
        expect(slicePictureNames({
          slices: ORDERED_SLICES,
          sliceIndex: 2,
        },),).toEqual([
          'stretch.webp',
          'nap.webp',
        ],);
      },
    },),

    it({
      name: 'NAMES A PICTURE ONCE EVEN WHEN BOTH NEIGHBOURS SHOW IT, so a stage is not handed '
        + 'the same picture twice for one slice that sits between two references to it',
      fn: async () => {
        expect(slicePictureNames({
          slices: DUPING_SLICES,
          sliceIndex: 1,
        },),).toEqual(['perch.webp',],);
      },
    },),

    it({
      name: 'THROWS ON A NON-INTEGER INDEX rather than truncating it, since a fractional '
        + 'position is not a stamped mistake this can silently correct, it is a caller error',
      fn: async () => {
        expect(function askFractional() {
          return slicePictureNames({
            slices: ORDERED_SLICES,
            sliceIndex: 1.5,
          },);
        },).toThrow(RangeError,);
      },
    },),

    it({
      name: 'THROWS ON A NEGATIVE INDEX rather than reading the end of the array, since a '
        + 'caller that already subtracted one would otherwise be handed the LAST slice as a '
        + 'neighbour of the first',
      fn: async () => {
        expect(function askBeforeStart() {
          return slicePictureNames({
            slices: ORDERED_SLICES,
            sliceIndex: -1,
          },);
        },).toThrow(RangeError,);
      },
    },),

    it({
      name: 'THROWS ON AN INDEX PAST THE END rather than naming no pictures, because an index '
        + 'stamped elsewhere would silently name no pictures here, which reads as a slice that '
        + 'shows none rather than the mistake it is',
      fn: async () => {
        expect(function askPastEnd() {
          return slicePictureNames({
            slices: ORDERED_SLICES,
            sliceIndex: ORDERED_SLICES.length,
          },);
        },).toThrow(RangeError,);
      },
    },),
  ],
},);

await describe({
  name: slicePictures.name,
  children: [
    it({
      name: 'RENDERS EVERY CORROBORATED PICTURE INTO CONTEXT WITH BOTH READINGS LABELLED BY '
        + 'MODEL, not only the longer one, since agreement establishes the two describe the '
        + 'same picture rather than the same amount of it, and reports no finding for a picture '
        + 'that rendered',
      fn: async () => {
        /**
         * What middle slice and both its neighbours resolve to.
         */
        const rendered = slicePictures({
          slices: MULTI_PICTURE_SLICES,
          sliceIndex: 1,
          readings: MULTI_PICTURE_READINGS,
        },);

        /**
         * Exact rendered context: two blocks in document order, each
         * carrying both readings under their own model id.
         */
        const expectedContext = `${PICTURE_HEADING} sunbeam.webp\n${WHISKERS}:\n${SUNBEAM_SHORT}`
          + `\n\n${MARMALADE}:\n${SUNBEAM_LONG}\n\n${PICTURE_HEADING} nap.webp\n${WHISKERS}:\n`
          + `${NAP_SHORT}\n\n${MARMALADE}:\n${NAP_LONG}`;

        expect(rendered.context,).toBe(expectedContext,);
        expect(rendered.findings,).toEqual([],);
      },
    },),

    it({
      name: 'NAMES AN UNAVAILABLE PICTURE IN FINDINGS WITH ITS REASON, and renders nothing '
        + 'about it in context, since a stage handed a hedge it cannot weigh is worse off than '
        + 'one simply not told the picture existed',
      fn: async () => {
        /**
         * What one slice naming an unavailable picture resolves to.
         */
        const rendered = slicePictures({
          slices: [sliceOf({
            text: `A shadow startles her off the sill.\n\n`
              + `${photoElement({ assetNames: ['startled.webp',], },)}\n`,
            chunkIndex: 0,
          },),],
          sliceIndex: 0,
          readings: UNAVAILABLE_READINGS,
        },);

        expect(rendered.context,).toBe('',);
        expect(rendered.findings,).toEqual(['picture startled.webp: no reading, readers-disagree',],);
      },
    },),

    it({
      name: 'NAMES A PICTURE NEVER READ AS `not read`, WORDED APART FROM AN UNAVAILABLE '
        + 'READING, so a person reading findings can tell a picture whose readings were never '
        + 'gathered from one nobody could corroborate',
      fn: async () => {
        /**
         * What one slice naming a picture absent from the readings map
         * entirely resolves to.
         */
        const rendered = slicePictures({
          slices: [sliceOf({
            text: `She hides behind a plant pot.\n\n`
              + `${photoElement({ assetNames: ['shadow.webp',], },)}\n`,
            chunkIndex: 0,
          },),],
          sliceIndex: 0,
          readings: new Map<string, PairedReading>(),
        },);

        expect(rendered.context,).toBe('',);
        expect(rendered.findings,).toEqual(['picture shadow.webp: not read',],);
      },
    },),

    it({
      name: 'RENDERS AN EMPTY CONTEXT AND NO FINDINGS FOR A SLICE THAT SHOWS NO PICTURES, '
        + 'which is most slices in the corpus',
      fn: async () => {
        /**
         * What a single quiet slice, naming no picture itself and standing
         * alone with no neighbours, resolves to.
         */
        const rendered = slicePictures({
          slices: [sliceOf({
            text: 'Tabby sleeps through the whole afternoon.\n',
            chunkIndex: 0,
          },),],
          sliceIndex: 0,
          readings: new Map<string, PairedReading>(),
        },);

        expect(rendered.context,).toBe('',);
        expect(rendered.findings,).toEqual([],);
      },
    },),
  ],
},);
