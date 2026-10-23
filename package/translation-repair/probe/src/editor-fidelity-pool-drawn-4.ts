import { REVIEWED_CORPUS_SHA, } from './fidelity-reference-manifest.ts';
import type { FidelityReferenceSpec, } from './fidelity-reference-model.ts';

//region Editor fidelity pool, drawn specifications 4
// Ids, offsets and hashes only; no corpus text. Drawn by the rule in `editor-fidelity-pool-manifest.ts`: entries from
// `MushroomGuuuu` to `Rentable_A` in id order.

/**
 Specifications 4 of 4 drawn from the pinned corpus for the editor fidelity pool, each a heading section of
 an entry with the hashes of its source, its archive text, its donor and its damaged twins.

 @example
 ```ts
 const drawn: readonly FidelityReferenceSpec[] = DRAWN_EDITOR_SPECS_4;
 ```
 */
export const DRAWN_EDITOR_SPECS_4: readonly FidelityReferenceSpec[] = [
  {
    id: 'MushroomGuuuu-s2',
    entryId: 'MushroomGuuuu',
    corpusSha: REVIEWED_CORPUS_SHA,
    source: {
      startOffset: 496,
      endOffset: 801,
      hash: '8d736bf3905428d6d238474bd14d1bb05527eb98ac5806bc08cccd3d28c0b3da',
    },
    archive: {
      startOffset: 1_437,
      endOffset: 2_167,
      hash: '4e6b522f74282a88fd3a34e54317be859f0ce194f63d6ef50a3164e11bdf67df',
    },
    referenceHash: '4e6b522f74282a88fd3a34e54317be859f0ce194f63d6ef50a3164e11bdf67df',
    referenceChars: 730,
    edits: [],
    donor: {
      startOffset: 105,
      endOffset: 1_105,
      hash: '9657ba4e2e7e0bf2a984f5223f587a2f489580e7113c3c6922b5b141a5f0cd5f',
    },
    damages: [
      {
        kind: 'alteration',
        hash: '48e70f4e966c35f28783cedbb8f41f27bb59a76e716cbfb4859544a3dfc7b947',
        changedChars: 9,
      },
    ],
    reviewedOn: '2026-10-23',
  },
  {
    id: 'NIGHT81473140-s0',
    entryId: 'NIGHT81473140',
    corpusSha: REVIEWED_CORPUS_SHA,
    source: {
      startOffset: 85,
      endOffset: 579,
      hash: '1335c8b8e093c177a0ea2d3d4599c4909175bd32c510aaa6e9938865b23fea0d',
    },
    archive: {
      startOffset: 112,
      endOffset: 1_853,
      hash: 'df31482a2307f5a7900c042919213a28a9d5509417a8633022d1628fb0d7dfa6',
    },
    referenceHash: 'df31482a2307f5a7900c042919213a28a9d5509417a8633022d1628fb0d7dfa6',
    referenceChars: 1_741,
    edits: [],
    donor: {
      startOffset: 13_354,
      endOffset: 13_916,
      hash: '0706d0824fb9b658ad9ddf2316494b5cc3a74f387acb7bee7949354255333d89',
    },
    damages: [
      {
        kind: 'insertion',
        hash: 'b529df70379ce2ac560aca309f35f15f9eb8be2d98b1eaf1c925aa202c461af4',
        changedChars: 93,
      },
    ],
    reviewedOn: '2026-10-23',
  },
  {
    id: 'NIGHT81473140-s1',
    entryId: 'NIGHT81473140',
    corpusSha: REVIEWED_CORPUS_SHA,
    source: {
      startOffset: 581,
      endOffset: 975,
      hash: '6a6cdb65507ab69d8a18a16b4daf9669fb020c1effacfe3c0f0f6387a828d535',
    },
    archive: {
      startOffset: 1_855,
      endOffset: 3_011,
      hash: '105aa47ad7436c05cb5e739c12254129d12e3b2ac90fc3faeb302f39b903daf7',
    },
    referenceHash: '105aa47ad7436c05cb5e739c12254129d12e3b2ac90fc3faeb302f39b903daf7',
    referenceChars: 1_156,
    edits: [],
    donor: {
      startOffset: 13_354,
      endOffset: 13_916,
      hash: '0706d0824fb9b658ad9ddf2316494b5cc3a74f387acb7bee7949354255333d89',
    },
    damages: [
      {
        kind: 'alteration',
        hash: '15ae0f3c7f2b8a2d69227fe73a0d3ae72d7555e86b78ecc3fb31f0364e4ea3e2',
        changedChars: 3,
      },
    ],
    reviewedOn: '2026-10-23',
  },
  {
    id: 'Proselyte093-s1',
    entryId: 'Proselyte093',
    corpusSha: REVIEWED_CORPUS_SHA,
    source: {
      startOffset: 308,
      endOffset: 753,
      hash: '0abbdd4fad5d93e0fa1125ad5e879bd426b365881c40ad44d74db8296a758101',
    },
    archive: {
      startOffset: 610,
      endOffset: 1_737,
      hash: 'ab6540695d2840b70187afec50285178dd02c494c1f5a41ff969ac98d17d16b0',
    },
    referenceHash: 'ab6540695d2840b70187afec50285178dd02c494c1f5a41ff969ac98d17d16b0',
    referenceChars: 1_127,
    edits: [],
    donor: {
      startOffset: 1_739,
      endOffset: 2_753,
      hash: '14a18c4279e1ff08d13fc1ac24abe9d1573832d49dfe231a066f9d31205398c2',
    },
    damages: [
      {
        kind: 'insertion',
        hash: 'dce599973bcd622a104cc3a05b3396a83373a5dbe0f25f99f21316d2f8527056',
        changedChars: 150,
      },
    ],
    reviewedOn: '2026-10-23',
  },
  {
    id: 'Proselyte093-s2',
    entryId: 'Proselyte093',
    corpusSha: REVIEWED_CORPUS_SHA,
    source: {
      startOffset: 755,
      endOffset: 1_191,
      hash: 'dfd878b9357a38b5e350c3eb0ba4813ed693da7c3297a66d802e12c00889d05a',
    },
    archive: {
      startOffset: 1_739,
      endOffset: 2_753,
      hash: '14a18c4279e1ff08d13fc1ac24abe9d1573832d49dfe231a066f9d31205398c2',
    },
    referenceHash: '14a18c4279e1ff08d13fc1ac24abe9d1573832d49dfe231a066f9d31205398c2',
    referenceChars: 1_014,
    edits: [],
    donor: {
      startOffset: 78,
      endOffset: 608,
      hash: 'cb90bfea49aa5047e4a62dedaa7d0a24d6dd485c4ac24fd0acec134499e03dbf',
    },
    damages: [
      {
        kind: 'alteration',
        hash: '711ec50b9864cf5f06708ea10f32876cdc8d7c1b68e2deafcef5986da1881b72',
        changedChars: 6,
      },
    ],
    reviewedOn: '2026-10-23',
  },
  {
    id: 'Rentable_A-s1',
    entryId: 'Rentable_A',
    corpusSha: REVIEWED_CORPUS_SHA,
    source: {
      startOffset: 174,
      endOffset: 437,
      hash: '258709f34f6a53c3041a357d94db7b3dece6d370f0c5f9fe6f1871da328bfc42',
    },
    archive: {
      startOffset: 391,
      endOffset: 1_009,
      hash: '1622dfda732ccd1a64a7c9728a6e06f0fab79378612a6ed7a971f40eb247d45d',
    },
    referenceHash: '1622dfda732ccd1a64a7c9728a6e06f0fab79378612a6ed7a971f40eb247d45d',
    referenceChars: 618,
    edits: [],
    donor: {
      startOffset: 1_011,
      endOffset: 1_565,
      hash: '6b9e3a27ef368593c95d90bb795c691e1ded19eac47340a16dd18d5dc596d3c4',
    },
    damages: [
      {
        kind: 'insertion',
        hash: '3cae03174882fc8505306b941c5d726a27a5c3e8bc6d706cc7250c8f2761d821',
        changedChars: 116,
      },
    ],
    reviewedOn: '2026-10-23',
  },
  {
    id: 'Rentable_A-s2',
    entryId: 'Rentable_A',
    corpusSha: REVIEWED_CORPUS_SHA,
    source: {
      startOffset: 439,
      endOffset: 760,
      hash: 'b1b121858c946ffadc0a84683856bd1db6b7881b147a0f934d59a8d0a72c8412',
    },
    archive: {
      startOffset: 1_011,
      endOffset: 1_565,
      hash: '6b9e3a27ef368593c95d90bb795c691e1ded19eac47340a16dd18d5dc596d3c4',
    },
    referenceHash: '6b9e3a27ef368593c95d90bb795c691e1ded19eac47340a16dd18d5dc596d3c4',
    referenceChars: 554,
    edits: [],
    donor: {
      startOffset: 113,
      endOffset: 389,
      hash: 'f936ee740637e74b09b5bc48c19d352cd3ff27ee7c6f3dbd72ee8555bac4507d',
    },
    damages: [
      {
        kind: 'alteration',
        hash: 'ad8b61710c0a9c6a016d2081e5fd9d75e815b11887324393de0754ebddbd7cb6',
        changedChars: 3,
      },
    ],
    reviewedOn: '2026-10-23',
  },
];

//endregion Editor fidelity pool, drawn specifications 4
