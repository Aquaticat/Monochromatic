/**
 * Tests fail-closed front matter publication boundary.
 *
 * THE CASE THAT MATTERS IS THE KEPT INCUMBENT. Until 2026-09-02 this guard read
 * a page whose metadata equals the archive's as one nobody reviewed, and refused
 * it; the Carena0442 pass of that day lost 94 minutes of settled body work to
 * that reading after its translate lane had judged the metadata slice twice and
 * kept a correct translation. The guard now reads the lane's own standing, so
 * this suite proves a judged keep of translated metadata publishes, a default
 * keep does not, and a kept directory id does not either way.
 *
 * @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  assertFrontMatterComplete,
  type ChunkPair,
  FrontMatterCompletenessError,
  frontMatterSlice,
  type LaneSliceText,
  metadataStandingOf,
  splitFrontMatter,
} from '../../dist/final/node/index.mjs';

/**
 * Complete source page fixture.
 */
const SOURCE_TEXT = '---\nname: 猫猫\ninfo:\n  alias: 猫猫\n---\n\nBody.\n';

/**
 * Complete target page fixture whose visible name is still the directory id.
 */
const TARGET_TEXT = '---\nname: EntryId\ninfo:\n  alias: Maomao\n---\n\nBody.\n';

/**
 * Complete target page fixture whose metadata is already translated.
 */
const TRANSLATED_TEXT = '---\nname: Maomao\ninfo:\n  alias: Maomao\n---\n\nBody.\n';

/**
 * Parsed source metadata fixture.
 */
const sourceFrontMatter = splitFrontMatter({ text: SOURCE_TEXT, }).frontMatter;
/**
 * Parsed target metadata fixture.
 */
const targetFrontMatter = splitFrontMatter({ text: TARGET_TEXT, }).frontMatter;
/**
 * Parsed translated target metadata fixture.
 */
const translatedFrontMatter = splitFrontMatter({ text: TRANSLATED_TEXT, }).frontMatter;
if ((sourceFrontMatter === undefined) || (targetFrontMatter === undefined) || (translatedFrontMatter === undefined))
  throw new Error('front matter fixture did not parse',);
/**
 * Raw translated metadata, held as a plain string because the narrowing above
 * does not reach into function declarations.
 */
const TRANSLATED_RAW: string = translatedFrontMatter.raw;
/**
 * Explicit metadata slice shared by guarded cases.
 */
const sliceResult = frontMatterSlice({
  source: sourceFrontMatter,
  target: targetFrontMatter,
},);
if (sliceResult.kind !== 'paired')
  throw new Error('front matter fixture did not pair',);
/**
 * Explicit metadata slice over the translated archive.
 */
const translatedSliceResult = frontMatterSlice({
  source: sourceFrontMatter,
  target: translatedFrontMatter,
},);
if (translatedSliceResult.kind !== 'paired')
  throw new Error('translated front matter fixture did not pair',);

/**
 * Source page whose name and alias differ, so the identity rule in
 * `validateFrontMatterTranslation` stays quiet and a kept directory id reaches
 * the completeness rule rather than being refused as an invalid page first.
 */
const DISTINCT_ALIAS_SOURCE_TEXT = '---\nname: 猫猫\ninfo:\n  alias: 猫咪\n---\n\nBody.\n';

/**
 * Parsed distinct-alias source metadata fixture.
 */
const distinctAliasFrontMatter = splitFrontMatter({ text: DISTINCT_ALIAS_SOURCE_TEXT, }).frontMatter;
if (distinctAliasFrontMatter === undefined)
  throw new Error('distinct-alias front matter fixture did not parse',);
/**
 * Explicit metadata slice pairing that source with the directory-id archive.
 */
const placeholderSliceResult = frontMatterSlice({
  source: distinctAliasFrontMatter,
  target: targetFrontMatter,
},);
if (placeholderSliceResult.kind !== 'paired')
  throw new Error('placeholder front matter fixture did not pair',);

/**
 * Ordinary body slice preceding metadata in invalid-order fixture.
 */
const BODY_SLICE: ChunkPair = {
  source: {
    kind: 'content',
    sliceIndex: 0,
    nodes: [],
    startOffset: SOURCE_TEXT.length,
    endOffset: SOURCE_TEXT.length,
    text: '',
  },
  target: {
    kind: 'content',
    sliceIndex: 0,
    nodes: [],
    startOffset: TARGET_TEXT.length,
    endOffset: TARGET_TEXT.length,
    text: '',
  },
};

/**
 * Translate lane wording for the metadata slice under one outcome.
 *
 * @param outcome - what the lane did about the slice
 *
 * @returns One wording at slice zero
 *
 * @example
 * ```ts
 * const wordings = [metadataWording({ outcome: { kind: 'decided', acceptedText: '...', }, },),];
 * ```
 */
function metadataWording(
  { outcome, }: { readonly outcome: LaneSliceText['outcome']; },
): LaneSliceText {
  return {
    sliceIndex: 0,
    incumbentKind: 'present',
    incumbentText: TRANSLATED_RAW,
    outcome,
  };
}

await describe({
  name: metadataStandingOf.name,
  children: [
    it({
      name: 'READS a decided metadata slice as decided, the archive\'s own wording included, since a '
        + 'lane that judged the slice and kept the archive has reviewed it',
      fn: async () => {
        expect(metadataStandingOf({
          slices: [translatedSliceResult.slice,],
          sliceTexts: [metadataWording({
            outcome: {
              kind: 'decided',
              acceptedText: TRANSLATED_RAW,
            },
          },),],
        },),).toBe('decided',);
      },
    },),

    it({
      name: 'READS an unheard metadata slice as standing by default, which is what a lost voice '
        + 'looks like and what the guard exists to refuse',
      fn: async () => {
        expect(metadataStandingOf({
          slices: [translatedSliceResult.slice,],
          sliceTexts: [metadataWording({ outcome: { kind: 'incumbent-fallback', }, },),],
        },),).toBe('by-default',);
        expect(metadataStandingOf({
          slices: [translatedSliceResult.slice,],
          sliceTexts: [metadataWording({ outcome: { kind: 'not-evaluated', }, },),],
        },),).toBe('by-default',);
      },
    },),

    it({
      name: 'READS a preparation without a metadata slice, or a lane that never named it, as '
        + 'standing by default, leaving the structural check to say why',
      fn: async () => {
        expect(metadataStandingOf({
          slices: [BODY_SLICE,],
          sliceTexts: [],
        },),).toBe('by-default',);
        expect(metadataStandingOf({
          slices: [translatedSliceResult.slice,],
          sliceTexts: [],
        },),).toBe('by-default',);
      },
    },),
  ],
},);

await describe({
  name: assertFrontMatterComplete.name,
  children: [
    it({
      name: 'ACCEPTS PARSEABLE SAME-SHAPE METADATA under explicit reviewed slice',
      fn: async () => {
        expect(() => assertFrontMatterComplete({
          entryId: 'EntryId',
          sourceText: SOURCE_TEXT,
          archiveText: TARGET_TEXT,
          pageText: TRANSLATED_TEXT,
          slices: [sliceResult.slice,],
          metadataStanding: 'decided',
        },),).not.toThrow();
      },
    },),

    it({
      name: 'REFUSES MISSING REVIEW SLICE when both sides declare metadata',
      fn: async () => {
        expect(() => assertFrontMatterComplete({
          entryId: 'EntryId',
          sourceText: SOURCE_TEXT,
          archiveText: TARGET_TEXT,
          pageText: TARGET_TEXT,
          slices: [],
          metadataStanding: 'decided',
        },),).toThrow(FrontMatterCompletenessError,);
      },
    },),

    it({
      name: 'ACCEPTS TRANSLATED SOURCE-ONLY METADATA through insertion slice',
      fn: async () => {
        const sourceOnly = frontMatterSlice({ source: sourceFrontMatter, },);
        if (sourceOnly.kind !== 'paired')
          throw new Error('source-only front matter fixture did not pair',);
        expect(() => assertFrontMatterComplete({
          entryId: 'EntryId',
          sourceText: SOURCE_TEXT,
          archiveText: 'Body.\n',
          pageText: TRANSLATED_TEXT,
          slices: [sourceOnly.slice,],
          metadataStanding: 'decided',
        },),).not.toThrow();
      },
    },),

    it({
      name: 'ACCEPTS UNCHANGED TARGET-ONLY METADATA without localized slice',
      fn: async () => {
        expect(() => assertFrontMatterComplete({
          entryId: 'EntryId',
          sourceText: 'Body.\n',
          archiveText: TARGET_TEXT,
          pageText: TARGET_TEXT,
          slices: [],
          metadataStanding: 'by-default',
        },),).not.toThrow();
      },
    },),

    it({
      name: 'REFUSES A DEFAULT KEEP of the archive metadata when the source\'s differs, naming '
        + 'incumbent-fallback, since nobody produced anything and the archive stands unreviewed',
      fn: async () => {
        /**
         * What the guard threw for translated metadata nobody decided.
         */
        const refusal = (() => {
          try {
            assertFrontMatterComplete({
              entryId: 'EntryId',
              sourceText: SOURCE_TEXT,
              archiveText: TRANSLATED_TEXT,
              pageText: TRANSLATED_TEXT,
              slices: [translatedSliceResult.slice,],
              metadataStanding: 'by-default',
            },);
            return undefined;
          }
          catch (error) {
            return error;
          }
        })();

        expect(refusal,).toBeInstanceOf(FrontMatterCompletenessError,);
        expect((refusal as Error).message,).toContain('incumbent-fallback',);
      },
    },),

    it({
      name: 'ACCEPTS A DECIDED KEEP of translated archive metadata, which is the Carena0442 case: '
        + 'the lane judged the slice and kept a correct translation, and bytes equal to the '
        + 'archive\'s are not evidence that nobody looked',
      fn: async () => {
        expect(() => assertFrontMatterComplete({
          entryId: 'EntryId',
          sourceText: SOURCE_TEXT,
          archiveText: TRANSLATED_TEXT,
          pageText: TRANSLATED_TEXT,
          slices: [translatedSliceResult.slice,],
          metadataStanding: 'decided',
        },),).not.toThrow();
      },
    },),

    it({
      name: 'REFUSES A KEPT DIRECTORY ID as the visible name whether or not a lane decided to keep '
        + 'it, naming directory-id-name, since that is the one kept incumbent bytes alone did '
        + 'catch and the page would ship the person under the folder',
      fn: async () => {
        /**
         * What the guard threw for a decided keep of the directory id.
         */
        const refusal = (() => {
          try {
            assertFrontMatterComplete({
              entryId: 'EntryId',
              sourceText: DISTINCT_ALIAS_SOURCE_TEXT,
              archiveText: TARGET_TEXT,
              pageText: TARGET_TEXT,
              slices: [placeholderSliceResult.slice,],
              metadataStanding: 'decided',
            },);
            return undefined;
          }
          catch (error) {
            return error;
          }
        })();

        expect(refusal,).toBeInstanceOf(FrontMatterCompletenessError,);
        expect((refusal as Error).message,).toContain('directory-id-name',);

        /**
         * What the guard threw for a default keep of the same directory id,
         * which names the default first since nobody decided anything.
         */
        const defaultRefusal = (() => {
          try {
            assertFrontMatterComplete({
              entryId: 'EntryId',
              sourceText: DISTINCT_ALIAS_SOURCE_TEXT,
              archiveText: TARGET_TEXT,
              pageText: TARGET_TEXT,
              slices: [placeholderSliceResult.slice,],
              metadataStanding: 'by-default',
            },);
            return undefined;
          }
          catch (error) {
            return error;
          }
        })();

        expect(defaultRefusal,).toBeInstanceOf(FrontMatterCompletenessError,);
        expect((defaultRefusal as Error).message,).toContain('incumbent-fallback',);
      },
    },),

    it({
      name: 'REFUSES CHANGED PAGE retaining directory id as visible name',
      fn: async () => {
        expect(() => assertFrontMatterComplete({
          entryId: 'EntryId',
          sourceText: SOURCE_TEXT,
          archiveText: TARGET_TEXT,
          pageText: '---\nname: EntryId2\ninfo:\n  alias: Maomao\n---\n\nBody.\n',
          slices: [sliceResult.slice,],
          metadataStanding: 'decided',
        },),).toThrow(FrontMatterCompletenessError,);
      },
    },),

    it({
      name: 'REFUSES SOURCE-SCRIPT COMMENT ATTRIBUTION replacing established target form',
      fn: async () => {
        /**
         * Source page carrying contributor attribution in location comment.
         */
        const sourceText = '---\nname: 猫猫\ninfo:\n  alias: 猫猫\n  location: 广东 #清远, by 魔骨\n---\n\nBody.\n';
        /**
         * Archive page establishing target contributor spelling.
         */
        const archiveText = '---\nname: Maomao\ninfo:\n  alias: Maomao\n  location: Guangdong #Qingyuan, by MoguHandle\n---\n\nBody.\n';
        /**
         * Candidate retaining source-script attribution.
         */
        const pageText = '---\nname: Maomao\ninfo:\n  alias: Maomao\n  location: Guangdong #Qingyuan, by 魔骨\n---\n\nBody.\n';
        /**
         * Parsed source metadata.
         */
        const source = splitFrontMatter({ text: sourceText, }).frontMatter;
        /**
         * Parsed archive metadata.
         */
        const target = splitFrontMatter({ text: archiveText, }).frontMatter;
        if ((source === undefined) || (target === undefined))
          throw new Error('comment authority fixture did not parse',);
        /**
         * Explicit metadata slice at publication boundary.
         */
        const result = frontMatterSlice({ source, target, });
        if (result.kind !== 'paired')
          throw new Error('comment authority fixture did not pair',);
        expect(() => assertFrontMatterComplete({
          entryId: 'CatEntry',
          sourceText,
          archiveText,
          pageText,
          slices: [result.slice,],
          metadataStanding: 'decided',
        },),).toThrow(FrontMatterCompletenessError,);
      },
    },),

    it({
      name: 'REFUSES PAGE THAT DROPS TARGET METADATA FIELD',
      fn: async () => {
        expect(() => assertFrontMatterComplete({
          entryId: 'EntryId',
          sourceText: SOURCE_TEXT,
          archiveText: TARGET_TEXT,
          pageText: '---\nname: Maomao\n---\n\nBody.\n',
          slices: [sliceResult.slice,],
          metadataStanding: 'decided',
        },),).toThrow(FrontMatterCompletenessError,);
      },
    },),

    it({
      name: 'REFUSES METADATA SLICE AT WRONG INDEX OR SPAN',
      fn: async () => {
        expect(() => assertFrontMatterComplete({
          entryId: 'EntryId',
          sourceText: SOURCE_TEXT,
          archiveText: TARGET_TEXT,
          pageText: TRANSLATED_TEXT,
          slices: [{
            ...sliceResult.slice,
            source: {
              ...sliceResult.slice.source,
              sliceIndex: 1,
            },
          },],
          metadataStanding: 'decided',
        },),).toThrow(FrontMatterCompletenessError,);
        expect(() => assertFrontMatterComplete({
          entryId: 'EntryId',
          sourceText: SOURCE_TEXT,
          archiveText: TARGET_TEXT,
          pageText: TRANSLATED_TEXT,
          slices: [BODY_SLICE, sliceResult.slice,],
          metadataStanding: 'decided',
        },),).toThrow(FrontMatterCompletenessError,);
      },
    },),

    it({
      name: 'ACCEPTS TWO PAGES WITHOUT FRONT MATTER and requires no synthetic slice',
      fn: async () => {
        expect(() => assertFrontMatterComplete({
          entryId: 'EntryId',
          sourceText: 'Body.\n',
          archiveText: 'Body.\n',
          pageText: 'Body.\n',
          slices: [],
          metadataStanding: 'by-default',
        },),).not.toThrow();
        expect(() => assertFrontMatterComplete({
          entryId: 'EntryId',
          sourceText: 'Body.\n',
          archiveText: 'Body.\n',
          pageText: '---\nname: Added\n---\n\nBody.\n',
          slices: [],
          metadataStanding: 'by-default',
        },),).toThrow(FrontMatterCompletenessError,);
      },
    },),
  ],
},);
