/**
 * Tests fail-closed front matter publication boundary.
 *
 * STRUCTURAL CHECKS ONLY, by the owner's decision of 2026-09-02: the metadata
 * slice sits where the preparation put it, the page parses, the identity and
 * attribution rules hold, and the visible name is not the directory id where
 * the source names the person differently. A page whose metadata equals the
 * archive's is not a question this guard asks any more; the lanes, the contest
 * and the gate judge metadata like every other slice, and the artifact keeps
 * their records.
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
 * `validateFrontMatterTranslation` stays quiet and a directory id as the
 * visible name reaches its own check rather than being refused as an invalid
 * page first.
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
 * What the guard threw, or `undefined` when it accepted.
 *
 * @param run - guarded call
 *
 * @returns Thrown value
 *
 * @example
 * ```ts
 * const refusal = thrownBy({ run: () => assertFrontMatterComplete({ ... },), },);
 * ```
 */
function thrownBy({ run, }: { readonly run: () => void; },): unknown {
  try {
    run();
    return undefined;
  }
  catch (error) {
    return error;
  }
}

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
        },),).not.toThrow();
      },
    },),

    it({
      name: 'ACCEPTS A PAGE WHOSE METADATA EQUALS THE ARCHIVE\'S translated metadata, which the '
        + '2026-08-28 rule refused as unreviewed: whether the lanes kept it or replaced it is '
        + 'the lanes\' business and the artifact\'s record, not this guard\'s question',
      fn: async () => {
        expect(() => assertFrontMatterComplete({
          entryId: 'EntryId',
          sourceText: SOURCE_TEXT,
          archiveText: TRANSLATED_TEXT,
          pageText: TRANSLATED_TEXT,
          slices: [translatedSliceResult.slice,],
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
          pageText: TRANSLATED_TEXT,
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
      name: 'REFUSES A VISIBLE NAME THAT IS THE DIRECTORY ID, naming directory-id-name, whether the '
        + 'page kept the archive byte for byte or changed another field, since the person would '
        + 'ship under the folder either way',
      fn: async () => {
        /**
         * What the guard threw for the archive kept byte for byte.
         */
        const keptRefusal = thrownBy({
          run: () => assertFrontMatterComplete({
            entryId: 'EntryId',
            sourceText: DISTINCT_ALIAS_SOURCE_TEXT,
            archiveText: TARGET_TEXT,
            pageText: TARGET_TEXT,
            slices: [placeholderSliceResult.slice,],
          },),
        },);
        expect(keptRefusal,).toBeInstanceOf(FrontMatterCompletenessError,);
        expect((keptRefusal as Error).message,).toContain('directory-id-name',);

        /**
         * What the guard threw for a page that changed the alias and left the
         * directory id as the name.
         */
        const changedRefusal = thrownBy({
          run: () => assertFrontMatterComplete({
            entryId: 'EntryId',
            sourceText: DISTINCT_ALIAS_SOURCE_TEXT,
            archiveText: TARGET_TEXT,
            pageText: '---\nname: EntryId\ninfo:\n  alias: Kitty\n---\n\nBody.\n',
            slices: [placeholderSliceResult.slice,],
          },),
        },);
        expect(changedRefusal,).toBeInstanceOf(FrontMatterCompletenessError,);
        expect((changedRefusal as Error).message,).toContain('directory-id-name',);
      },
    },),

    it({
      name: 'ACCEPTS A VISIBLE NAME THAT IS THE DIRECTORY ID when the source names the person so '
        + 'too, since the handle is then the name: eight of the pinned corpus\'s 92 entries '
        + '(keyword233, Mio, mone among them) are named after their directory in both languages',
      fn: async () => {
        /**
         * Source page whose name is the directory id, as a handle-named entry's is.
         */
        const handleSourceText = '---\nname: EntryId\ninfo:\n  alias: EntryId\n---\n\n正文。\n';
        /**
         * Archive and page carrying the same handle.
         */
        const handlePageText = '---\nname: EntryId\ninfo:\n  alias: EntryId\n---\n\nBody.\n';
        /**
         * Parsed handle source metadata.
         */
        const source = splitFrontMatter({ text: handleSourceText, },).frontMatter;
        /**
         * Parsed handle page metadata.
         */
        const target = splitFrontMatter({ text: handlePageText, },).frontMatter;
        if ((source === undefined) || (target === undefined))
          throw new Error('handle fixture did not parse',);
        /**
         * Explicit metadata slice over the handle pages.
         */
        const result = frontMatterSlice({ source, target, },);
        if (result.kind !== 'paired')
          throw new Error('handle fixture did not pair',);
        expect(() => assertFrontMatterComplete({
          entryId: 'EntryId',
          sourceText: handleSourceText,
          archiveText: handlePageText,
          pageText: handlePageText,
          slices: [result.slice,],
        },),).not.toThrow();
      },
    },),

    it({
      name: 'REFUSES A CHANGED PAGE whose name and alias diverge where the source\'s agree, as '
        + 'invalid-page, which is the identity rule',
      fn: async () => {
        /**
         * What the guard threw for a changed page breaking the identity rule.
         */
        const refusal = thrownBy({
          run: () => assertFrontMatterComplete({
            entryId: 'EntryId',
            sourceText: SOURCE_TEXT,
            archiveText: TARGET_TEXT,
            pageText: '---\nname: EntryId2\ninfo:\n  alias: Maomao\n---\n\nBody.\n',
            slices: [sliceResult.slice,],
          },),
        },);
        expect(refusal,).toBeInstanceOf(FrontMatterCompletenessError,);
        expect((refusal as Error).message,).toContain('invalid-page',);
      },
    },),

    it({
      name: 'ACCEPTS A PAGE WHOSE ALIAS CARRIES THE NAME AMONG OTHER RENDERINGS where the source\'s '
        + 'name and alias agree, the owner\'s decision of 2026-09-04: seven archives at the pinned corpus '
        + 'publish the original script beside the romanisation, and equality refused one of them after a '
        + 'full run',
      fn: async () => {
        // A throw here fails the test on its own.
        assertFrontMatterComplete({
          entryId: 'EntryId',
          sourceText: SOURCE_TEXT,
          archiveText: TARGET_TEXT,
          pageText: '---\nname: Maomao\ninfo:\n  alias: 猫猫, Maomao\n---\n\nBody.\n',
          slices: [sliceResult.slice,],
        },);
        /**
         * What the guard threw for an alias that names the person by something
         * else entirely.
         */
        const refusal = thrownBy({
          run: () => assertFrontMatterComplete({
            entryId: 'EntryId',
            sourceText: SOURCE_TEXT,
            archiveText: TARGET_TEXT,
            pageText: '---\nname: Maomao\ninfo:\n  alias: 猫猫, Kitty\n---\n\nBody.\n',
            slices: [sliceResult.slice,],
          },),
        },);
        expect(refusal,).toBeInstanceOf(FrontMatterCompletenessError,);
        expect((refusal as Error).message,).toContain('invalid-page',);
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
          pageText: TRANSLATED_TEXT,
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
          pageText: TRANSLATED_TEXT,
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
