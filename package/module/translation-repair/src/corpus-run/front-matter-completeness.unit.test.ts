/**
 * Tests fail-closed front matter publication boundary.
 *
 * THE CASE THAT MATTERS IS THE KEPT INCUMBENT. Until 2026-09-02 this guard read
 * a page whose metadata equals the archive's as one nobody reviewed, and refused
 * it; the Carena0442 pass of that day lost 94 minutes of settled body work to
 * that reading. The first fix published any keep whose stage had heard a
 * translator, which was a misreading of the same pass: both of Carena's
 * metadata rounds ended in a judge indecision, and the incumbent shipped by
 * fallback. The guard now reads the translate lane's selection record, so this
 * suite proves a keep the judges chose publishes, a keep every heard translator
 * reproduced publishes, every fallback refuses by the name of its decision, and
 * a kept directory id refuses either way.
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
  type MetadataStanding,
  metadataStandingOf,
  type SliceSelection,
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
 * Standing of a keep the judges chose, which the accepting cases share.
 */
const JUDGED_KEEP: MetadataStanding = {
  kind: 'judged-keep',
  voteWeight: 3,
};

/**
 * Standing of a keep left by a lost voice, which the refusing cases share.
 */
const NO_VOICE_KEEP: MetadataStanding = {
  kind: 'fallback',
  decision: 'no-voice-heard',
};

/**
 * Incumbent producer nobody reproduced.
 */
const INCUMBENT_ALONE: SliceSelection['producer'] = {
  kind: 'incumbent',
  matched: [],
};

/**
 * Translate lane selection for the metadata slice under one decision.
 *
 * @param decision - how the round ended
 *
 * @param origin - whether the winning text was the archive's or fresh
 *
 * @param producer - who wrote the winning text
 *
 * @param voteWeight - weight the winner drew
 *
 * @param shipped - whether the document carries the decision
 *
 * @returns One selection at slice zero
 *
 * @example
 * ```ts
 * const selections = [metadataSelection({ decision: 'judged', },),];
 * ```
 */
function metadataSelection(
  {
    decision,
    origin = 'incumbent',
    producer = INCUMBENT_ALONE,
    voteWeight = 0,
    shipped = false,
  }: {
    readonly decision: string;
    readonly origin?: string;
    readonly producer?: SliceSelection['producer'];
    readonly voteWeight?: number;
    readonly shipped?: boolean;
  },
): SliceSelection {
  return {
    sliceIndex: 0,
    origin,
    producer,
    decision,
    voteWeight,
    shipped,
    round: {
      producers: [producer,],
      ballots: [],
    },
  };
}

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
  name: metadataStandingOf.name,
  children: [
    it({
      name: 'READS a judged incumbent win as a judged keep carrying its weight, since that is the '
        + 'one keep the judges are evidence for',
      fn: async () => {
        expect(metadataStandingOf({
          slices: [translatedSliceResult.slice,],
          sliceSelections: [metadataSelection({
            decision: 'judged',
            voteWeight: 3,
          },),],
        },),).toEqual({
          kind: 'judged-keep',
          voteWeight: 3,
        },);
      },
    },),

    it({
      name: 'READS a sole incumbent every heard translator reproduced as a matched keep naming '
        + 'them, and a sole incumbent nobody matched as a fallback, since the incumbent is on '
        + 'the slate whenever it has text and a slate of one is either case',
      fn: async () => {
        expect(metadataStandingOf({
          slices: [translatedSliceResult.slice,],
          sliceSelections: [metadataSelection({
            decision: 'sole-candidate',
            producer: {
              kind: 'incumbent',
              matched: ['hf:zai-org/GLM-5.3-Flash', 'minimax-m3',],
            },
          },),],
        },),).toEqual({
          kind: 'matched-keep',
          matchedBy: ['hf:zai-org/GLM-5.3-Flash', 'minimax-m3',],
        },);
        expect(metadataStandingOf({
          slices: [translatedSliceResult.slice,],
          sliceSelections: [metadataSelection({ decision: 'sole-candidate', },),],
        },),).toEqual({
          kind: 'fallback',
          decision: 'sole-candidate-unmatched',
        },);
      },
    },),

    it({
      name: 'READS every decline and empty-slate decision as a fallback named by the decision, '
        + 'which is the Carena0442 case: four judges split and the incumbent shipped unchosen',
      fn: async () => {
        for (const decision of [
          'declined-indecision',
          'declined-rejection',
          'no-candidate-backed',
          'no-candidate',
          'no-voice-heard',
        ]) {
          expect(metadataStandingOf({
            slices: [translatedSliceResult.slice,],
            sliceSelections: [metadataSelection({ decision, },),],
          },),).toEqual({
            kind: 'fallback',
            decision,
          },);
        }
      },
    },),

    it({
      name: 'READS a judged fresh win as a replacement carrying whether the document shipped it',
      fn: async () => {
        expect(metadataStandingOf({
          slices: [translatedSliceResult.slice,],
          sliceSelections: [metadataSelection({
            decision: 'judged',
            origin: 'fresh',
            producer: {
              kind: 'model',
              modelId: 'minimax-m3',
            },
            voteWeight: 3.5,
            shipped: true,
          },),],
        },),).toEqual({
          kind: 'replaced',
          shipped: true,
        },);
      },
    },),

    it({
      name: 'READS a preparation without a metadata slice, or a lane that never recorded it, as '
        + 'unrecorded, leaving the structural check to say why',
      fn: async () => {
        expect(metadataStandingOf({
          slices: [BODY_SLICE,],
          sliceSelections: [],
        },),).toEqual({ kind: 'unrecorded', },);
        expect(metadataStandingOf({
          slices: [translatedSliceResult.slice,],
          sliceSelections: [],
        },),).toEqual({ kind: 'unrecorded', },);
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
          metadataStanding: JUDGED_KEEP,
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
          metadataStanding: JUDGED_KEEP,
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
          metadataStanding: JUDGED_KEEP,
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
          metadataStanding: NO_VOICE_KEEP,
        },),).not.toThrow();
      },
    },),

    it({
      name: 'REFUSES A FALLBACK KEEP of translated archive metadata naming the decision after '
        + 'incumbent-fallback, for a lost voice, an indecision, an unmatched sole incumbent, '
        + 'a withdrawn replacement and an unrecorded slice alike, since none of them is a '
        + 'review of the incumbent',
      fn: async () => {
        for (const [standing, detail,] of [
          [NO_VOICE_KEEP, 'no-voice-heard',],
          [{ kind: 'fallback', decision: 'declined-indecision', }, 'declined-indecision',],
          [{ kind: 'fallback', decision: 'sole-candidate-unmatched', }, 'sole-candidate-unmatched',],
          [{ kind: 'replaced', shipped: false, }, 'replacement-withdrawn',],
          [{ kind: 'replaced', shipped: true, }, 'replacement-not-carried',],
          [{ kind: 'unrecorded', }, 'unrecorded',],
        ] as const) {
          /**
           * What the guard threw for translated metadata standing by fallback.
           */
          const refusal = thrownBy({
            run: () => assertFrontMatterComplete({
              entryId: 'EntryId',
              sourceText: SOURCE_TEXT,
              archiveText: TRANSLATED_TEXT,
              pageText: TRANSLATED_TEXT,
              slices: [translatedSliceResult.slice,],
              metadataStanding: standing,
            },),
          },);
          expect(refusal,).toBeInstanceOf(FrontMatterCompletenessError,);
          expect((refusal as Error).message,).toContain(`incumbent-fallback: ${detail}`,);
        }
      },
    },),

    it({
      name: 'ACCEPTS A JUDGED KEEP and A MATCHED KEEP of translated archive metadata, since the '
        + 'judges choosing the archive or every heard translator reproducing it is a review '
        + 'that found nothing to change, and bytes equal to the archive\'s are not evidence '
        + 'that nobody looked',
      fn: async () => {
        for (const standing of [
          JUDGED_KEEP,
          {
            kind: 'matched-keep',
            matchedBy: ['minimax-m3',],
          },
        ] as const) {
          expect(() => assertFrontMatterComplete({
            entryId: 'EntryId',
            sourceText: SOURCE_TEXT,
            archiveText: TRANSLATED_TEXT,
            pageText: TRANSLATED_TEXT,
            slices: [translatedSliceResult.slice,],
            metadataStanding: standing,
          },),).not.toThrow();
        }
      },
    },),

    it({
      name: 'REFUSES A KEPT DIRECTORY ID as the visible name whether or not the judges chose to '
        + 'keep it, naming directory-id-name, since that is the one kept incumbent bytes alone '
        + 'did catch and the page would ship the person under the folder',
      fn: async () => {
        /**
         * What the guard threw for a judged keep of the directory id.
         */
        const refusal = thrownBy({
          run: () => assertFrontMatterComplete({
            entryId: 'EntryId',
            sourceText: DISTINCT_ALIAS_SOURCE_TEXT,
            archiveText: TARGET_TEXT,
            pageText: TARGET_TEXT,
            slices: [placeholderSliceResult.slice,],
            metadataStanding: JUDGED_KEEP,
          },),
        },);
        expect(refusal,).toBeInstanceOf(FrontMatterCompletenessError,);
        expect((refusal as Error).message,).toContain('directory-id-name',);

        /**
         * What the guard threw for a fallback keep of the same directory id,
         * which names the fallback first since nobody chose anything.
         */
        const fallbackRefusal = thrownBy({
          run: () => assertFrontMatterComplete({
            entryId: 'EntryId',
            sourceText: DISTINCT_ALIAS_SOURCE_TEXT,
            archiveText: TARGET_TEXT,
            pageText: TARGET_TEXT,
            slices: [placeholderSliceResult.slice,],
            metadataStanding: NO_VOICE_KEEP,
          },),
        },);
        expect(fallbackRefusal,).toBeInstanceOf(FrontMatterCompletenessError,);
        expect((fallbackRefusal as Error).message,).toContain('incumbent-fallback: no-voice-heard',);
      },
    },),

    it({
      name: 'REFUSES A CHANGED PAGE whose name and alias diverge where the source\'s agree, as '
        + 'invalid-page, which is the identity rule and not the directory-id rule: a page that '
        + 'changed is never a kept incumbent',
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
            metadataStanding: JUDGED_KEEP,
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
          metadataStanding: JUDGED_KEEP,
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
          metadataStanding: JUDGED_KEEP,
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
          metadataStanding: JUDGED_KEEP,
        },),).toThrow(FrontMatterCompletenessError,);
        expect(() => assertFrontMatterComplete({
          entryId: 'EntryId',
          sourceText: SOURCE_TEXT,
          archiveText: TARGET_TEXT,
          pageText: TRANSLATED_TEXT,
          slices: [BODY_SLICE, sliceResult.slice,],
          metadataStanding: JUDGED_KEEP,
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
          metadataStanding: NO_VOICE_KEEP,
        },),).not.toThrow();
        expect(() => assertFrontMatterComplete({
          entryId: 'EntryId',
          sourceText: 'Body.\n',
          archiveText: 'Body.\n',
          pageText: '---\nname: Added\n---\n\nBody.\n',
          slices: [],
          metadataStanding: NO_VOICE_KEEP,
        },),).toThrow(FrontMatterCompletenessError,);
      },
    },),
  ],
},);
