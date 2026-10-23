import { REVIEWED_CORPUS_SHA, } from './fidelity-reference-manifest.ts';
import type { FidelityReferenceSpec, } from './fidelity-reference-model.ts';

//region Editor fidelity pool, drawn specifications 5
// Ids, offsets and hashes only; no corpus text. Drawn by the rule in `editor-fidelity-pool-manifest.ts` with seed `round-4`:
// entries `Xu_Yushu` to `Xu_Yushu` in the order of the draw.

/**
 Specifications 5 of 5 drawn from the pinned corpus for the editor fidelity pool, each a heading section of
 an entry with the hashes of its source, its archive text, its donor and its damaged twins.

 @example
 ```ts
 const drawn: readonly FidelityReferenceSpec[] = DRAWN_EDITOR_SPECS_5;
 ```
 */
export const DRAWN_EDITOR_SPECS_5: readonly FidelityReferenceSpec[] = [
  {
    id: 'Xu_Yushu-s3',
    entryId: 'Xu_Yushu',
    corpusSha: REVIEWED_CORPUS_SHA,
    source: {
      startOffset: 1_763,
      endOffset: 2_075,
      hash: 'f4fc89cf6d9e6de9da5046f329a63288c4437c122ef55fc666ebc80c06ab2653',
    },
    archive: {
      startOffset: 5_145,
      endOffset: 5_919,
      hash: 'd111fbd00316669ebecf8d266c750448895ec74ceb4453df526728376538c7c5',
    },
    referenceHash: 'd111fbd00316669ebecf8d266c750448895ec74ceb4453df526728376538c7c5',
    referenceChars: 774,
    edits: [],
    donor: {
      startOffset: 8_940,
      endOffset: 9_350,
      hash: '92d1da458e10dc5c4cdab762684751a17b10f351f091f66e917dbfb09ad75f6f',
    },
    damages: [
      {
        kind: 'alteration',
        hash: '7480827e89de94c81351c0440e4f934b2bd9908c3f73210d7d0ec0ca4bffeae3',
        changedChars: 2,
      },
    ],
    reviewedOn: '2026-10-23',
  },
];

//endregion Editor fidelity pool, drawn specifications 5
