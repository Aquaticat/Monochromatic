import { REVIEWED_CORPUS_SHA, } from './fidelity-reference-manifest.ts';
import type { FidelityReferenceSpec, } from './fidelity-reference-model.ts';

//region Editor fidelity pool, drawn specifications 2
// Ids, offsets and hashes only; no corpus text. Drawn by the rule in `editor-fidelity-pool-manifest.ts`: entries from
// `Dethelly` to `Kotori` in id order.

/**
 Specifications 2 of 4 drawn from the pinned corpus for the editor fidelity pool, each a heading section of
 an entry with the hashes of its source, its archive text, its donor and its damaged twins.

 @example
 ```ts
 const drawn: readonly FidelityReferenceSpec[] = DRAWN_EDITOR_SPECS_2;
 ```
 */
export const DRAWN_EDITOR_SPECS_2: readonly FidelityReferenceSpec[] = [
  {
    id: 'Dethelly-s1',
    entryId: 'Dethelly',
    corpusSha: REVIEWED_CORPUS_SHA,
    source: {
      startOffset: 387,
      endOffset: 850,
      hash: '3d96c4b0526667fdd14ec57aa6409066080fe96e3b43688561e9d404e4446ceb',
    },
    archive: {
      startOffset: 1_249,
      endOffset: 2_783,
      hash: '2c345114e0357812a23899190ddb66104337c52b1c58e77e9116e66168c2a825',
    },
    referenceHash: '2c345114e0357812a23899190ddb66104337c52b1c58e77e9116e66168c2a825',
    referenceChars: 1_534,
    edits: [],
    donor: {
      startOffset: 6_374,
      endOffset: 7_528,
      hash: '4d25ff8b5938439535c773449a5fd4ed6d17952e6292d562915d648faeccda40',
    },
    damages: [
      {
        kind: 'alteration',
        hash: '4252046f60c1d5b35826d7e1567a3583542abff869582cd33c0dcb1646775280',
        changedChars: 4,
      },
    ],
    reviewedOn: '2026-10-23',
  },
  {
    id: 'Everythings99-s0',
    entryId: 'Everythings99',
    corpusSha: REVIEWED_CORPUS_SHA,
    source: {
      startOffset: 74,
      endOffset: 315,
      hash: 'ab30e9ea80ec7a4a57b30c458946cac2214a75c8a2f4ec170f00a50871fd97f0',
    },
    archive: {
      startOffset: 113,
      endOffset: 833,
      hash: '8f66f9dc3b0690ab482ed947401c5828f3f056dc2cd01b7a846ea3df9ea3c415',
    },
    referenceHash: '8f66f9dc3b0690ab482ed947401c5828f3f056dc2cd01b7a846ea3df9ea3c415',
    referenceChars: 720,
    edits: [],
    donor: {
      startOffset: 1_153,
      endOffset: 2_040,
      hash: '120fb43c39d4922361b56139d6cd3544db53bfb97df9e955520a069047d6479f',
    },
    damages: [
      {
        kind: 'insertion',
        hash: 'ee79a1307d7203ab384d03bb689bacbd7241e8ae5d4ae1cab10dce6900a62960',
        changedChars: 166,
      },
    ],
    reviewedOn: '2026-10-23',
  },
  {
    id: 'Everythings99-s2',
    entryId: 'Everythings99',
    corpusSha: REVIEWED_CORPUS_SHA,
    source: {
      startOffset: 510,
      endOffset: 800,
      hash: '055d3980ab9230e8f28195bc21f5062c596032e625591063deafc63b725d312b',
    },
    archive: {
      startOffset: 1_153,
      endOffset: 2_040,
      hash: '120fb43c39d4922361b56139d6cd3544db53bfb97df9e955520a069047d6479f',
    },
    referenceHash: '120fb43c39d4922361b56139d6cd3544db53bfb97df9e955520a069047d6479f',
    referenceChars: 887,
    edits: [],
    donor: {
      startOffset: 113,
      endOffset: 833,
      hash: '8f66f9dc3b0690ab482ed947401c5828f3f056dc2cd01b7a846ea3df9ea3c415',
    },
    damages: [
      {
        kind: 'alteration',
        hash: '399b122ddf8fb06fc043facbd940a727be51239d7e94fd441e0e1645af702e01',
        changedChars: 2,
      },
    ],
    reviewedOn: '2026-10-23',
  },
  {
    id: 'Futajuhuacha-s0',
    entryId: 'Futajuhuacha',
    corpusSha: REVIEWED_CORPUS_SHA,
    source: {
      startOffset: 82,
      endOffset: 582,
      hash: '59b59f43daf0220944951b7519980b517e0e587d6c4cec005251d3ddf119f094',
    },
    archive: {
      startOffset: 130,
      endOffset: 1_504,
      hash: '82cf3baa55b9535381e1590ab8eb817675ca4b89d193b94b20065159c43e55f3',
    },
    referenceHash: '82cf3baa55b9535381e1590ab8eb817675ca4b89d193b94b20065159c43e55f3',
    referenceChars: 1_374,
    edits: [],
    donor: {
      startOffset: 4_195,
      endOffset: 6_368,
      hash: '606b7d5ab86af3e2a51e9590565382cbb050ba3848b27b215200d374321f220e',
    },
    damages: [
      {
        kind: 'insertion',
        hash: 'f0dce473f33f821c3b8a03e892527523bd169a411219cfeb9dd7cb9a317d637c',
        changedChars: 228,
      },
    ],
    reviewedOn: '2026-10-23',
  },
  {
    id: 'Futajuhuacha-s2',
    entryId: 'Futajuhuacha',
    corpusSha: REVIEWED_CORPUS_SHA,
    source: {
      startOffset: 1_455,
      endOffset: 2_281,
      hash: 'fbaeb841ac856e4383178080fe769aa8f5e818ad85ad537a6fe10b01ef2ab3ce',
    },
    archive: {
      startOffset: 4_195,
      endOffset: 6_368,
      hash: '606b7d5ab86af3e2a51e9590565382cbb050ba3848b27b215200d374321f220e',
    },
    referenceHash: '606b7d5ab86af3e2a51e9590565382cbb050ba3848b27b215200d374321f220e',
    referenceChars: 2_173,
    edits: [],
    donor: {
      startOffset: 130,
      endOffset: 1_504,
      hash: '82cf3baa55b9535381e1590ab8eb817675ca4b89d193b94b20065159c43e55f3',
    },
    damages: [
      {
        kind: 'alteration',
        hash: '844ab03dfbdff3fe6df28fa5221dfd616e7460aaeef40469d0e97390f759c4ff',
        changedChars: 2,
      },
    ],
    reviewedOn: '2026-10-23',
  },
  {
    id: 'Huasheng-s0',
    entryId: 'Huasheng',
    corpusSha: REVIEWED_CORPUS_SHA,
    source: {
      startOffset: 87,
      endOffset: 217,
      hash: '07d804527dc8658190c09a8e851fdbf7f9b49109f43b518fecd817474bdb86bf',
    },
    archive: {
      startOffset: 147,
      endOffset: 549,
      hash: 'a103b9d25d3ea71275416ced098e011911b49c7e6aca378545125fb5d9dd5924',
    },
    referenceHash: 'a103b9d25d3ea71275416ced098e011911b49c7e6aca378545125fb5d9dd5924',
    referenceChars: 402,
    edits: [],
    donor: {
      startOffset: 5_677,
      endOffset: 7_914,
      hash: '2f4314fb840b22875d4b187c16335f7137cb3be5bafdd179515239456700a7d5',
    },
    damages: [
      {
        kind: 'insertion',
        hash: '5589925fc03a4f8b33bb8edab05ffbb3ddae50d83010c956f5a371fbf80acce1',
        changedChars: 411,
      },
    ],
    reviewedOn: '2026-10-23',
  },
  {
    id: 'Jennife80677612-s2',
    entryId: 'Jennife80677612',
    corpusSha: REVIEWED_CORPUS_SHA,
    source: {
      startOffset: 1_160,
      endOffset: 1_426,
      hash: '98fb54710a0faa6438367d7d528374e50b862595971696ae7f52728655040615',
    },
    archive: {
      startOffset: 3_449,
      endOffset: 4_275,
      hash: '252f477527a295909068d35c3ce6fb3fc47caf15ce75098400e2301a4a12a7db',
    },
    referenceHash: '252f477527a295909068d35c3ce6fb3fc47caf15ce75098400e2301a4a12a7db',
    referenceChars: 826,
    edits: [],
    donor: {
      startOffset: 393,
      endOffset: 3_447,
      hash: '927479d2ef6e7da124f5bcc3f0ec8249ca203d16aa5d4e4e19c900e635cab119',
    },
    damages: [
      {
        kind: 'insertion',
        hash: '0219c2cb9aa280b46215909f8709fafe8d4710b71191c52a60bb0a3df7d19957',
        changedChars: 156,
      },
    ],
    reviewedOn: '2026-10-23',
  },
  {
    id: 'Kotori-s1',
    entryId: 'Kotori',
    corpusSha: REVIEWED_CORPUS_SHA,
    source: {
      startOffset: 128,
      endOffset: 483,
      hash: '3c6eaa0aac03a3cc103b4c8ac74175aa42649b3829a4da69f4b0c614295d6bb6',
    },
    archive: {
      startOffset: 268,
      endOffset: 1_778,
      hash: '0f5749da7c13ef15462f1d6fecf5d2cf81d62e6be176021b44ba7dfd477e17a3',
    },
    referenceHash: '0f5749da7c13ef15462f1d6fecf5d2cf81d62e6be176021b44ba7dfd477e17a3',
    referenceChars: 1_510,
    edits: [],
    donor: {
      startOffset: 2_192,
      endOffset: 3_151,
      hash: '193a7bc457be0490dc987caf186cb0ce2d6e52347d69ad6ffa8243d1da3cba94',
    },
    damages: [
      {
        kind: 'insertion',
        hash: '40e47870879fa531a7b72873cebc7e5ab3a8be03214a17c2065401655dcfedb3',
        changedChars: 121,
      },
    ],
    reviewedOn: '2026-10-23',
  },
  {
    id: 'Kotori-s2',
    entryId: 'Kotori',
    corpusSha: REVIEWED_CORPUS_SHA,
    source: {
      startOffset: 485,
      endOffset: 624,
      hash: 'b480ad47654867be63b256342122af1cbcc1756b78894bb5b83abc943d218adb',
    },
    archive: {
      startOffset: 1_780,
      endOffset: 2_190,
      hash: '8db19121d696b358687b4133078479bed0d5666d74f1759baa9d83c23d9a3a5e',
    },
    referenceHash: '8db19121d696b358687b4133078479bed0d5666d74f1759baa9d83c23d9a3a5e',
    referenceChars: 410,
    edits: [],
    donor: {
      startOffset: 211,
      endOffset: 266,
      hash: '72f8014caa8ce298820a042728ddca0d9cb9dc33580ee6f3a6ce936929c4bfc5',
    },
    damages: [
      {
        kind: 'alteration',
        hash: '513c7e82b13f63e41905aee78c9e90e843321f16df780f7c2a6db98bfa8427dd',
        changedChars: 4,
      },
    ],
    reviewedOn: '2026-10-23',
  },
];

//endregion Editor fidelity pool, drawn specifications 2
