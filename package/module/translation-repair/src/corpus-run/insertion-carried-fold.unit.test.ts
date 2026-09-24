/**
 Guards class one hundred ten (mikaela12, 2026-09-24): a source-only passage
 the roster found carried, whose evidence sits inside the archive span of the
 neighbouring paired slice, is folded into that carrier's source, so both
 lanes render it as part of the slice that carries it. Left apart, the
 translate lane wrote the carrier from its own source alone, the judges
 preferred the candidate without "the surrounding passage", and the guard at
 publish found the carried sentence gone. Cat-themed invention throughout; no
 corpus content appears here.

 @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  CARRIED_FOLDED_FINDING,
  type CarriedInsertion,
  type ChunkPair,
  foldCarriedInsertions,
  type InsertionAdmission,
  makeInsertionChunk,
  type PreparedDocumentPair,
} from '../../dist/final/node/index.mjs';

/**
 Heading both sides carry.
 */
const HEADING_SOURCE = '## 猫';

/**
 Archive's heading.
 */
const HEADING_TARGET = '## Cat';

/**
 Paragraph the archive folded into its next paragraph's rendering.
 */
const NAP_SOURCE = '猫在窗台睡了一下午。';

/**
 Archive's rendering of the nap, standing inside the homecoming's span.
 */
const NAP_TARGET = 'The cat slept on the sill all afternoon.';

/**
 Paragraph the roster paired with the two-paragraph archive span.
 */
const HOME_SOURCE = '后来猫回家了。';

/**
 Archive's rendering of the homecoming.
 */
const HOME_TARGET = 'Later the cat went home.';

/**
 Closing paragraph, paired one to one.
 */
const BATH_SOURCE = '猫不喜欢洗澡。';

/**
 Archive's rendering of the closing paragraph.
 */
const BATH_TARGET = 'The cat does not like baths.';

/**
 Whole original.
 */
const SOURCE_TEXT = `${HEADING_SOURCE}\n\n${NAP_SOURCE}\n\n${HOME_SOURCE}\n\n${BATH_SOURCE}\n`;

/**
 Whole archive: the nap and the homecoming share one paired span.
 */
const TARGET_TEXT = `${HEADING_TARGET}\n\n${NAP_TARGET}\n\n${HOME_TARGET}\n\n${BATH_TARGET}\n`;

/**
 Builds one content side over the text a fragment occupies.

 @param sliceIndex - where the slice stands

 @param text - whole document

 @param fragment - text the chunk covers, found in that document

 @returns Content chunk at the fragment's offsets

 @example
 ```ts
 const side = contentOver({ sliceIndex: 0, text: SOURCE_TEXT, fragment: HEADING_SOURCE, },);
 ```
 */
function contentOver(
  {
    sliceIndex,
    text,
    fragment,
  }: {
    readonly sliceIndex: number;
    readonly text: string;
    readonly fragment: string;
  },
): ChunkPair['source'] {
  /**
   Where the fragment starts.
   */
  const startOffset = text.indexOf(fragment,);
  if (startOffset < 0)
    throw new Error(`fixture fragment missing: ${fragment}`,);
  return {
    kind: 'content',
    sliceIndex,
    nodes: [],
    startOffset,
    endOffset: startOffset + fragment.length,
    text: fragment,
  };
}

/**
 The prepared pair the fixture describes: heading, nap (source only), the
 homecoming paired with the archive's nap-and-homecoming span, the bath.

 @returns Prepared pair with four slices

 @example
 ```ts
 const prepared = preparedPair();
 ```
 */
function preparedPair(): PreparedDocumentPair {
  return {
    sourceText: SOURCE_TEXT,
    targetText: TARGET_TEXT,
    slices: [
      {
        source: contentOver({ sliceIndex: 0, text: SOURCE_TEXT, fragment: HEADING_SOURCE, },),
        target: contentOver({ sliceIndex: 0, text: TARGET_TEXT, fragment: HEADING_TARGET, },),
      },
      {
        source: contentOver({ sliceIndex: 1, text: SOURCE_TEXT, fragment: NAP_SOURCE, },),
        target: makeInsertionChunk({ sliceIndex: 1, offset: TARGET_TEXT.indexOf(NAP_TARGET,), },),
      },
      {
        source: contentOver({ sliceIndex: 2, text: SOURCE_TEXT, fragment: HOME_SOURCE, },),
        target: contentOver({
          sliceIndex: 2,
          text: TARGET_TEXT,
          fragment: `${NAP_TARGET}\n\n${HOME_TARGET}`,
        },),
      },
      {
        source: contentOver({ sliceIndex: 3, text: SOURCE_TEXT, fragment: BATH_SOURCE, },),
        target: contentOver({ sliceIndex: 3, text: TARGET_TEXT, fragment: BATH_TARGET, },),
      },
    ],
  };
}

/**
 The nap admitted as carried on the given evidence.

 @param evidence - regions the roster anchored

 @returns Admission carrying the nap alone

 @example
 ```ts
 const admission = carriedOn({ evidence: [NAP_TARGET,], },);
 ```
 */
function carriedOn({ evidence, }: { readonly evidence: readonly string[]; },): InsertionAdmission {
  /**
   The nap as the roster recorded it.
   */
  const nap: CarriedInsertion = {
    position: 1,
    sliceIndex: 1,
    sourceText: NAP_SOURCE,
    evidence,
  };
  return {
    positions: new Set(),
    carried: [nap,],
    findings: [],
  };
}

await describe({
  name: foldCarriedInsertions.name,
  children: [
    it({
      name: 'FOLDS a carried passage into the adjacent slice whose archive span holds every evidence region',
      fn: async () => {
        /**
         Same region quoted by three voices.
         */
        const folded = foldCarriedInsertions({
          prepared: preparedPair(),
          admission: carriedOn({ evidence: [NAP_TARGET, NAP_TARGET, NAP_TARGET,], },),
        },);
        /**
         The carrier after the fold.
         */
        const carrier = folded.prepared
          .slices[2];
        expect(carrier?.source.text,).toBe(`${NAP_SOURCE}\n\n${HOME_SOURCE}`,);
        expect(carrier?.source.startOffset,).toBe(SOURCE_TEXT.indexOf(NAP_SOURCE,),);
        expect(carrier?.source.endOffset,).toBe(SOURCE_TEXT.indexOf(HOME_SOURCE,) + HOME_SOURCE.length,);
        expect(carrier?.target.text,).toBe(`${NAP_TARGET}\n\n${HOME_TARGET}`,);
        expect(folded.prepared.slices.length,).toBe(4,);
        expect(folded.prepared.slices[1]?.target.kind,).toBe('insertion',);
        expect(folded.admission.carried,).toEqual([],);
        expect(folded.admission.folded,).toEqual([{ position: 1, sliceIndex: 1, carrierSliceIndex: 2, },],);
        expect(folded.findings,).toEqual([`${CARRIED_FOLDED_FINDING} (slice 1 into slice 2)`,],);
      },
    },),
    it({
      name: 'STANDS ASIDE where the evidence is not adjacent, not found, straddles two slices, or the source gap is not blank',
      fn: async () => {
        /**
         Evidence inside the bath slice, two positions away.
         */
        const apart = foldCarriedInsertions({
          prepared: preparedPair(),
          admission: carriedOn({ evidence: [BATH_TARGET,], },),
        },);
        expect(apart.prepared.slices[2]?.source.text,).toBe(HOME_SOURCE,);
        expect(apart.admission.carried?.length,).toBe(1,);
        expect(apart.admission.folded,).toEqual([],);
        expect(apart.findings,).toEqual([],);

        /**
         Evidence the page never carried.
         */
        const unfound = foldCarriedInsertions({
          prepared: preparedPair(),
          admission: carriedOn({ evidence: ['The dog barked.',], },),
        },);
        expect(unfound.prepared.slices[2]?.source.text,).toBe(HOME_SOURCE,);
        expect(unfound.admission.carried?.length,).toBe(1,);

        /**
         Evidence crossing from the homecoming into the bath.
         */
        const straddling = foldCarriedInsertions({
          prepared: preparedPair(),
          admission: carriedOn({ evidence: [`${HOME_TARGET}\n\n${BATH_TARGET}`,], },),
        },);
        expect(straddling.prepared.slices[2]?.source.text,).toBe(HOME_SOURCE,);
        expect(straddling.admission.carried?.length,).toBe(1,);

        /**
         A carrier whose source starts past a word the pairing left to nobody.
         */
        const gapped = preparedPair();
        /**
         The homecoming's source shifted one code point in.
         */
        const shifted: PreparedDocumentPair = {
          ...gapped,
          slices: gapped.slices.map(function shiftHome(slice,): ChunkPair {
            if (slice.target.sliceIndex !== 2)
              return slice;
            return {
              ...slice,
              source: {
                ...slice.source,
                startOffset: slice.source.startOffset + 1,
                text: slice.source.text.slice(1,),
              },
            };
          },),
        };
        const blocked = foldCarriedInsertions({
          prepared: shifted,
          admission: carriedOn({ evidence: [NAP_TARGET,], },),
        },);
        expect(blocked.prepared.slices[2]?.source.text,).toBe(HOME_SOURCE.slice(1,),);
        expect(blocked.admission.carried?.length,).toBe(1,);

        /**
         Nothing carried at all.
         */
        const idle = foldCarriedInsertions({
          prepared: preparedPair(),
          admission: { positions: new Set(), findings: [], },
        },);
        expect(idle.admission.folded,).toBeUndefined();
        expect(idle.findings,).toEqual([],);
      },
    },),
  ],
},);
