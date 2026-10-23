import { REVIEWED_CORPUS_SHA, } from './fidelity-reference-manifest.ts';
import type { FidelityReferenceSpec, } from './fidelity-reference-model.ts';

//region Editor fidelity pool, drawn specifications 1
// Ids, offsets and hashes only; no corpus text. Drawn by the rule in `editor-fidelity-pool-manifest.ts`: entries from
// `Acheron` to `Dethelly` in id order.

/**
 Specifications 1 of 4 drawn from the pinned corpus for the editor fidelity pool, each a heading section of
 an entry with the hashes of its source, its archive text, its donor and its damaged twins.

 @example
 ```ts
 const drawn: readonly FidelityReferenceSpec[] = DRAWN_EDITOR_SPECS_1;
 ```
 */
export const DRAWN_EDITOR_SPECS_1: readonly FidelityReferenceSpec[] = [
  {
    id: 'Acheron-s0',
    entryId: 'Acheron',
    corpusSha: REVIEWED_CORPUS_SHA,
    source: {
      startOffset: 56,
      endOffset: 219,
      hash: '9f7aa2f2321a826fa994553b27808fbd20b4f8ad841098f2f7b84fa3748ef81b',
    },
    archive: {
      startOffset: 56,
      endOffset: 641,
      hash: 'c05de67059d03ea4b7852302c363333aeeea316bb027dac52b3444ba82c71fe9',
    },
    referenceHash: 'c05de67059d03ea4b7852302c363333aeeea316bb027dac52b3444ba82c71fe9',
    referenceChars: 585,
    edits: [],
    donor: {
      startOffset: 643,
      endOffset: 1_268,
      hash: '184e9aa4180cfb2e13c6324d3ff943d8e00280b036f61c4c6cf1f68ba16e3b02',
    },
    damages: [
      {
        kind: 'insertion',
        hash: '0e89c8911c8f3a8e8ad3219830f4966e58b214e60b4b6e04fe30cf43f36bcb8c',
        changedChars: 107,
      },
      {
        kind: 'alteration',
        hash: '592c58626916dde0dea47486735098282a8a77c74b9299e902ab557eaa55dd39',
        changedChars: 2,
      },
    ],
    reviewedOn: '2026-10-23',
  },
  {
    id: 'Anilovr-s1',
    entryId: 'Anilovr',
    corpusSha: REVIEWED_CORPUS_SHA,
    source: {
      startOffset: 153,
      endOffset: 956,
      hash: '5b7e134c91413ff4cd6c7887940d51629e7ec2d1f831de425bbac07cc8cd81da',
    },
    archive: {
      startOffset: 234,
      endOffset: 2_235,
      hash: 'e417825ff5cf356cb27116c31545942bce4e1b0f68223a9ff6c8c0979a7543fc',
    },
    referenceHash: 'e417825ff5cf356cb27116c31545942bce4e1b0f68223a9ff6c8c0979a7543fc',
    referenceChars: 2_001,
    edits: [],
    donor: {
      startOffset: 116,
      endOffset: 232,
      hash: '8ec74366ff85ceb8cef6990764fca844b2a48c76c62b02559a8abd57b617436a',
    },
    damages: [
      {
        kind: 'alteration',
        hash: '527113c12da3e6d4070e19aca9d40a4c206c238b99cbb4ca9f099eb401db9d78',
        changedChars: 6,
      },
    ],
    reviewedOn: '2026-10-23',
  },
  {
    id: 'BI4PBV-s1',
    entryId: 'BI4PBV',
    corpusSha: REVIEWED_CORPUS_SHA,
    source: {
      startOffset: 124,
      endOffset: 435,
      hash: '1cfd28dcd857f25c18fa85b9677f15c259589740cb8c5cc38a52cf229516c264',
    },
    archive: {
      startOffset: 153,
      endOffset: 652,
      hash: '73657e7fa43457eee461a8f1b4a318db6e00db724e504ac1909a00faca9a7224',
    },
    referenceHash: '73657e7fa43457eee461a8f1b4a318db6e00db724e504ac1909a00faca9a7224',
    referenceChars: 499,
    edits: [],
    donor: {
      startOffset: 654,
      endOffset: 1_041,
      hash: '27375ce6d7a87626be098ae2949d7365a37b45772670318192c5f46aa6987ecf',
    },
    damages: [
      {
        kind: 'insertion',
        hash: 'cd6290b7ea3d982bc1f1a977d6025eae9a0eb9431805b1ea4ee99c6da364ae60',
        changedChars: 129,
      },
    ],
    reviewedOn: '2026-10-23',
  },
  {
    id: 'Chinatsu_Suzuki-s0',
    entryId: 'Chinatsu_Suzuki',
    corpusSha: REVIEWED_CORPUS_SHA,
    source: {
      startOffset: 85,
      endOffset: 298,
      hash: 'a47acf50d10543c3cc885f3bf1457bb3ba0647a628814146e774790d868e7e56',
    },
    archive: {
      startOffset: 89,
      endOffset: 724,
      hash: '1e6d247646346c8b308d1dd554a5ebe68e2fa264e5682ff791080940a21caa93',
    },
    referenceHash: '1e6d247646346c8b308d1dd554a5ebe68e2fa264e5682ff791080940a21caa93',
    referenceChars: 635,
    edits: [],
    donor: {
      startOffset: 5_058,
      endOffset: 6_054,
      hash: '4f7974e5c8fd9285f7255c6c949112de0b21e8dbb63b2f199a3e55870ee50338',
    },
    damages: [
      {
        kind: 'insertion',
        hash: 'e1dc8526845db9d9c27f1350cbe75cc8b22819ab103c6a81f44217c129cd43f3',
        changedChars: 101,
      },
    ],
    reviewedOn: '2026-10-23',
  },
  {
    id: 'Chinatsu_Suzuki-s6',
    entryId: 'Chinatsu_Suzuki',
    corpusSha: REVIEWED_CORPUS_SHA,
    source: {
      startOffset: 1_537,
      endOffset: 2_228,
      hash: '0606b801239b56ac3f33a89655f204762595e831ebaef6f04f3ead1ac4e9b087',
    },
    archive: {
      startOffset: 5_058,
      endOffset: 6_054,
      hash: '4f7974e5c8fd9285f7255c6c949112de0b21e8dbb63b2f199a3e55870ee50338',
    },
    referenceHash: '4f7974e5c8fd9285f7255c6c949112de0b21e8dbb63b2f199a3e55870ee50338',
    referenceChars: 996,
    edits: [],
    donor: {
      startOffset: 89,
      endOffset: 724,
      hash: '1e6d247646346c8b308d1dd554a5ebe68e2fa264e5682ff791080940a21caa93',
    },
    damages: [
      {
        kind: 'alteration',
        hash: '7dd005571a09947ab02b0b33989a271a0828a99c9c61dd3e4ad9e26a83c4bc5d',
        changedChars: 2,
      },
    ],
    reviewedOn: '2026-10-23',
  },
  {
    id: 'Considerate_cat-s3',
    entryId: 'Considerate_cat',
    corpusSha: REVIEWED_CORPUS_SHA,
    source: {
      startOffset: 352,
      endOffset: 625,
      hash: '7c1576ec0b2593a7d43d88a92b94b44ef5a8ac3038203ad578cb97a7d4beec92',
    },
    archive: {
      startOffset: 870,
      endOffset: 1_583,
      hash: 'f53929f9e9127dfe5986bed7a5e5b67254318d1fb9919cd5053b1fb309be2da1',
    },
    referenceHash: 'f53929f9e9127dfe5986bed7a5e5b67254318d1fb9919cd5053b1fb309be2da1',
    referenceChars: 713,
    edits: [],
    donor: {
      startOffset: 2_952,
      endOffset: 3_652,
      hash: 'ae8ccaaa6d594e13a057b2e18091d9788b32ea1235843f655f6d83d04dca1aae',
    },
    damages: [
      {
        kind: 'insertion',
        hash: '73957a83f64d64bcd73eefe3b4de0322acf2c7712aa7e4fd9a4c98e606307c54',
        changedChars: 102,
      },
    ],
    reviewedOn: '2026-10-23',
  },
  {
    id: 'Considerate_cat-s4',
    entryId: 'Considerate_cat',
    corpusSha: REVIEWED_CORPUS_SHA,
    source: {
      startOffset: 627,
      endOffset: 1_086,
      hash: '735452459f9e25c44e195c04aa020b01693f13e308a1aa483b134af4b75738c6',
    },
    archive: {
      startOffset: 1_585,
      endOffset: 2_754,
      hash: '10b5807b25c9d64f7196991cef727e1e98781f22b588923f0ceaaf5aa4da19e0',
    },
    referenceHash: '10b5807b25c9d64f7196991cef727e1e98781f22b588923f0ceaaf5aa4da19e0',
    referenceChars: 1_169,
    edits: [],
    donor: {
      startOffset: 100,
      endOffset: 252,
      hash: '73a3e1bff7b68bd156c173281e1216116fc5a389625e4e1b7216627f2d78bd76',
    },
    damages: [
      {
        kind: 'alteration',
        hash: '3fda4ad99a8df97c8777c0e2be76fe9523c20158558b6fdea2a15cb963da0e1b',
        changedChars: 2,
      },
    ],
    reviewedOn: '2026-10-23',
  },
  {
    id: 'CutOceanHeyFis1-s2',
    entryId: 'CutOceanHeyFis1',
    corpusSha: REVIEWED_CORPUS_SHA,
    source: {
      startOffset: 295,
      endOffset: 442,
      hash: 'c81e64a8992debf60472c3774a9d2c5f2243db90721f7dffdd0c61328da9f304',
    },
    archive: {
      startOffset: 717,
      endOffset: 1_206,
      hash: '6a8c95bf222a546944d41694bf574ff2d46723b2fe5a51e6eae9d8f9b510b3d1',
    },
    referenceHash: '6a8c95bf222a546944d41694bf574ff2d46723b2fe5a51e6eae9d8f9b510b3d1',
    referenceChars: 489,
    edits: [],
    donor: {
      startOffset: 92,
      endOffset: 715,
      hash: '5e932c7e8481e9f019729fb761ecce9f01cfb037d67ce44287abef22367c42bf',
    },
    damages: [
      {
        kind: 'insertion',
        hash: 'b022b917e73ae752dab3fabd6318a877c08aedebc2d329584dab2d996b40e4c2',
        changedChars: 121,
      },
      {
        kind: 'alteration',
        hash: 'd9c631fcd5f795bd25ff7f42a5b759f3a79e4daa9e9c77488de16f8c15ae5af3',
        changedChars: 4,
      },
    ],
    reviewedOn: '2026-10-23',
  },
  {
    id: 'Dethelly-s0',
    entryId: 'Dethelly',
    corpusSha: REVIEWED_CORPUS_SHA,
    source: {
      startOffset: 144,
      endOffset: 385,
      hash: '9cebe0ac13dcb428d8d4388f3027997ae168f4ed8956f1b5bbe436c154bb9a12',
    },
    archive: {
      startOffset: 261,
      endOffset: 1_247,
      hash: '9a1bc5b5dcd8951f2be42828f51788899a2aa5c61d4705c660236ac4322aee8d',
    },
    referenceHash: '9a1bc5b5dcd8951f2be42828f51788899a2aa5c61d4705c660236ac4322aee8d',
    referenceChars: 986,
    edits: [],
    donor: {
      startOffset: 6_374,
      endOffset: 7_528,
      hash: '4d25ff8b5938439535c773449a5fd4ed6d17952e6292d562915d648faeccda40',
    },
    damages: [
      {
        kind: 'insertion',
        hash: '91bc717476c596a97584b4da764fa63283b52c61d3730fb1e4f3586232583fed',
        changedChars: 84,
      },
    ],
    reviewedOn: '2026-10-23',
  },
];

//endregion Editor fidelity pool, drawn specifications 1
