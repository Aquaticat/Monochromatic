/**
 * Tests fail-closed front matter publication boundary.
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
  splitFrontMatter,
} from '../../dist/final/node/index.mjs';

/**
 * Complete source page fixture.
 */
const SOURCE_TEXT = '---\nname: 猫猫\ninfo:\n  alias: 猫猫\n---\n\nBody.\n';

/**
 * Complete target page fixture.
 */
const TARGET_TEXT = '---\nname: EntryId\ninfo:\n  alias: Maomao\n---\n\nBody.\n';

/**
 * Parsed source metadata fixture.
 */
const sourceFrontMatter = splitFrontMatter({ text: SOURCE_TEXT, }).frontMatter;
/**
 * Parsed target metadata fixture.
 */
const targetFrontMatter = splitFrontMatter({ text: TARGET_TEXT, }).frontMatter;
if ((sourceFrontMatter === undefined) || (targetFrontMatter === undefined))
  throw new Error('front matter fixture did not parse',);
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
          pageText: '---\nname: Maomao\ninfo:\n  alias: Maomao\n---\n\nBody.\n',
          slices: [sliceResult.slice,],
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
          pageText: '---\nname: Maomao\ninfo:\n  alias: Maomao\n---\n\nBody.\n',
          slices: [sourceOnly.slice,],
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
        },),).not.toThrow();
      },
    },),

    it({
      name: 'REFUSES EXACT INCUMBENT FALLBACK when source and target metadata differ',
      fn: async () => {
        expect(() => assertFrontMatterComplete({
          entryId: 'EntryId',
          sourceText: SOURCE_TEXT,
          archiveText: TARGET_TEXT,
          pageText: TARGET_TEXT,
          slices: [sliceResult.slice,],
        },),).toThrow(FrontMatterCompletenessError,);
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
          pageText: '---\nname: Maomao\ninfo:\n  alias: Maomao\n---\n\nBody.\n',
          slices: [{
            ...sliceResult.slice,
            source: {
              ...sliceResult.slice.source,
              sliceIndex: 1,
            },
          },],
        },),).toThrow(FrontMatterCompletenessError,);
        expect(() => assertFrontMatterComplete({
          entryId: 'EntryId',
          sourceText: SOURCE_TEXT,
          archiveText: TARGET_TEXT,
          pageText: '---\nname: Maomao\ninfo:\n  alias: Maomao\n---\n\nBody.\n',
          slices: [BODY_SLICE, sliceResult.slice,],
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
        },),).not.toThrow();
        expect(() => assertFrontMatterComplete({
          entryId: 'EntryId',
          sourceText: 'Body.\n',
          archiveText: 'Body.\n',
          pageText: '---\nname: Added\n---\n\nBody.\n',
          slices: [],
        },),).toThrow(FrontMatterCompletenessError,);
      },
    },),
  ],
},);
