import { REVIEWED_CORPUS_SHA, } from './fidelity-reference-manifest.ts';
import type { FidelityReferenceSpec, } from './fidelity-reference-model.ts';

//region Editor fidelity pool, drawn specifications 3
// Ids, offsets and hashes only; no corpus text. Drawn by the rule in `editor-fidelity-pool-manifest.ts`: entries from
// `LCG_Akiball` to `MushroomGuuuu` in id order.

/**
 Specifications 3 of 4 drawn from the pinned corpus for the editor fidelity pool, each a heading section of
 an entry with the hashes of its source, its archive text, its donor and its damaged twins.

 @example
 ```ts
 const drawn: readonly FidelityReferenceSpec[] = DRAWN_EDITOR_SPECS_3;
 ```
 */
export const DRAWN_EDITOR_SPECS_3: readonly FidelityReferenceSpec[] = [
  {
    id: 'LCG_Akiball-s0',
    entryId: 'LCG_Akiball',
    corpusSha: REVIEWED_CORPUS_SHA,
    source: {
      startOffset: 89,
      endOffset: 517,
      hash: 'f2d55510aa558e9f786f0e5937f8ba2ff7b5c4e1e5f1dad9438b556e3e07d0f8',
    },
    archive: {
      startOffset: 117,
      endOffset: 1_353,
      hash: '03a68aa44b897bbaf10a34360ea8525ac69630a8d5573ac3fb05a96e2d6d264f',
    },
    referenceHash: '03a68aa44b897bbaf10a34360ea8525ac69630a8d5573ac3fb05a96e2d6d264f',
    referenceChars: 1_236,
    edits: [],
    donor: {
      startOffset: 1_355,
      endOffset: 4_368,
      hash: '00812413dc27a5e9288cb981aa9c84c51ecb70df5a01c0585eaef3b53d89b1de',
    },
    damages: [
      {
        kind: 'insertion',
        hash: '4a54daefd32b5db996f31871774f2121aa3c34805aaf8f2769a0843407f7bd3f',
        changedChars: 203,
      },
      {
        kind: 'alteration',
        hash: 'ce1b1d4e3ff2b93a87697daa7297d38d313bd950effaaf48371b8751cbf2d988',
        changedChars: 4,
      },
    ],
    reviewedOn: '2026-10-23',
  },
  {
    id: 'MeowBot233-s1',
    entryId: 'MeowBot233',
    corpusSha: REVIEWED_CORPUS_SHA,
    source: {
      startOffset: 189,
      endOffset: 625,
      hash: 'b6dbc0703c06ce49cbef583fd8c3b6f1a031cf573290a99fd39c4085700c0c50',
    },
    archive: {
      startOffset: 386,
      endOffset: 1_866,
      hash: '898a6cd68cae232af9cdc449f7af3bc3a263c3d12912ab6cd9f8bb8e3af7b5f4',
    },
    referenceHash: '898a6cd68cae232af9cdc449f7af3bc3a263c3d12912ab6cd9f8bb8e3af7b5f4',
    referenceChars: 1_480,
    edits: [],
    donor: {
      startOffset: 2_114,
      endOffset: 3_053,
      hash: '46e2151d5333a0512f17129ba65ebefaaad55570d96f3353f881087cd99a14cf',
    },
    damages: [
      {
        kind: 'insertion',
        hash: 'cd07c2293a44b9b9347564ff292f13c0c810aa41bd43865ce628dc601497e916',
        changedChars: 94,
      },
    ],
    reviewedOn: '2026-10-23',
  },
  {
    id: 'MeowBot233-s3',
    entryId: 'MeowBot233',
    corpusSha: REVIEWED_CORPUS_SHA,
    source: {
      startOffset: 737,
      endOffset: 1_116,
      hash: '4f6e462b6230d1a86bb2f225fcff7b7ec8be67a9fb87fd703671b4a84aad2cc0',
    },
    archive: {
      startOffset: 2_114,
      endOffset: 3_053,
      hash: '46e2151d5333a0512f17129ba65ebefaaad55570d96f3353f881087cd99a14cf',
    },
    referenceHash: '46e2151d5333a0512f17129ba65ebefaaad55570d96f3353f881087cd99a14cf',
    referenceChars: 939,
    edits: [],
    donor: {
      startOffset: 109,
      endOffset: 384,
      hash: '6062a8bd348de7b49138f3d4d17609a0d2926ccf6f960467872dcd6bc5f7026c',
    },
    damages: [
      {
        kind: 'alteration',
        hash: '00f4096f6826dab1abb91ec3d39e69f86dd40af43b0af043503d16a895b8529d',
        changedChars: 4,
      },
    ],
    reviewedOn: '2026-10-23',
  },
  {
    id: 'Mio-s0',
    entryId: 'Mio',
    corpusSha: REVIEWED_CORPUS_SHA,
    source: {
      startOffset: 82,
      endOffset: 468,
      hash: '065758e6236cb52165520c03bb8c496d754ef8a3d76caf3e4a1dfa47436df5f1',
    },
    archive: {
      startOffset: 124,
      endOffset: 1_230,
      hash: '77054317152313ca8dd5bacda407f3e9228d7ea0514ec3d96b186683e93b313b',
    },
    referenceHash: '77054317152313ca8dd5bacda407f3e9228d7ea0514ec3d96b186683e93b313b',
    referenceChars: 1_106,
    edits: [],
    donor: {
      startOffset: 3_864,
      endOffset: 7_932,
      hash: 'aa213d0098bec6e73a6e9363a590a53ed6175d4b0b94ca0a451876b1090e34cc',
    },
    damages: [
      {
        kind: 'insertion',
        hash: '06922ba1e0c1d2f5dbe953329510f529173d6d2b75fb6d1eadf965138918d04f',
        changedChars: 168,
      },
    ],
    reviewedOn: '2026-10-23',
  },
  {
    id: 'MioCardMeow-s0',
    entryId: 'MioCardMeow',
    corpusSha: REVIEWED_CORPUS_SHA,
    source: {
      startOffset: 80,
      endOffset: 546,
      hash: '950129b278a58305dbc32e96ce6178ab53700ee4a0bd011cb8e430ff986eb947',
    },
    archive: {
      startOffset: 113,
      endOffset: 1_062,
      hash: '053578451bd528502703d2c39658b4c90c2ec2cfe2df81d4437e6a40480f9f4f',
    },
    referenceHash: '053578451bd528502703d2c39658b4c90c2ec2cfe2df81d4437e6a40480f9f4f',
    referenceChars: 949,
    edits: [],
    donor: {
      startOffset: 1_386,
      endOffset: 1_827,
      hash: '3e80a484cb32e95a39b651599e0303649b8e1a5040927e1cfcd4f787f2524ec9',
    },
    damages: [
      {
        kind: 'insertion',
        hash: '6f40f9a741aa31613e88ac1eb8ff9ef5ccaa7b4f22c752c05f6f0162baf05752',
        changedChars: 120,
      },
    ],
    reviewedOn: '2026-10-23',
  },
  {
    id: 'MioCardMeow-s2',
    entryId: 'MioCardMeow',
    corpusSha: REVIEWED_CORPUS_SHA,
    source: {
      startOffset: 738,
      endOffset: 984,
      hash: '0628df2c31580a1957009e49e03cad1b0296f5922e144653b19b1620510e2916',
    },
    archive: {
      startOffset: 1_386,
      endOffset: 1_827,
      hash: '3e80a484cb32e95a39b651599e0303649b8e1a5040927e1cfcd4f787f2524ec9',
    },
    referenceHash: '3e80a484cb32e95a39b651599e0303649b8e1a5040927e1cfcd4f787f2524ec9',
    referenceChars: 441,
    edits: [],
    donor: {
      startOffset: 113,
      endOffset: 1_062,
      hash: '053578451bd528502703d2c39658b4c90c2ec2cfe2df81d4437e6a40480f9f4f',
    },
    damages: [
      {
        kind: 'alteration',
        hash: '3431ee539616e99af1e8a89edf5bfc0d3f4f9563ea00622ce80397e613a99c1c',
        changedChars: 9,
      },
    ],
    reviewedOn: '2026-10-23',
  },
  {
    id: 'MocaKawai-s0',
    entryId: 'MocaKawai',
    corpusSha: REVIEWED_CORPUS_SHA,
    source: {
      startOffset: 82,
      endOffset: 774,
      hash: 'f857132d584edb7cef5b1403e5182f499f4d9c49a5d715a458fb1fdeeb02116e',
    },
    archive: {
      startOffset: 112,
      endOffset: 2_071,
      hash: 'c6d09ef500e5d6e86cea32d8e2ceb2c5ce6b3d958143e135f3a655b7efe21126',
    },
    referenceHash: 'c6d09ef500e5d6e86cea32d8e2ceb2c5ce6b3d958143e135f3a655b7efe21126',
    referenceChars: 1_959,
    edits: [],
    donor: {
      startOffset: 2_073,
      endOffset: 3_832,
      hash: '96128aa9be6a8338262965b2bb986dba914785a86fa630d6fb2aaeb3cd7f7821',
    },
    damages: [
      {
        kind: 'insertion',
        hash: '2c8978f7f3747c3f8f281a6bdc781c37a36f46e65ab48d6cc631d7d28ee05367',
        changedChars: 143,
      },
    ],
    reviewedOn: '2026-10-23',
  },
  {
    id: 'MocaKawai-s1',
    entryId: 'MocaKawai',
    corpusSha: REVIEWED_CORPUS_SHA,
    source: {
      startOffset: 776,
      endOffset: 1_311,
      hash: '21dd5becb4922b4628b55cb7e2c13b510328adfa4a9a048f52871136fc4b2e3a',
    },
    archive: {
      startOffset: 2_073,
      endOffset: 3_832,
      hash: '96128aa9be6a8338262965b2bb986dba914785a86fa630d6fb2aaeb3cd7f7821',
    },
    referenceHash: '96128aa9be6a8338262965b2bb986dba914785a86fa630d6fb2aaeb3cd7f7821',
    referenceChars: 1_759,
    edits: [],
    donor: {
      startOffset: 112,
      endOffset: 2_071,
      hash: 'c6d09ef500e5d6e86cea32d8e2ceb2c5ce6b3d958143e135f3a655b7efe21126',
    },
    damages: [
      {
        kind: 'alteration',
        hash: 'bbdeff691fcb15cf7d3877ed2283cbd28d3f48dbde4b456f80ca4db437b99567',
        changedChars: 4,
      },
    ],
    reviewedOn: '2026-10-23',
  },
  {
    id: 'MushroomGuuuu-s0',
    entryId: 'MushroomGuuuu',
    corpusSha: REVIEWED_CORPUS_SHA,
    source: {
      startOffset: 81,
      endOffset: 401,
      hash: 'e6702fc6485e6236e6c3f35e1a16aed624afc649f1970784ef779e84182fbf34',
    },
    archive: {
      startOffset: 105,
      endOffset: 1_105,
      hash: '9657ba4e2e7e0bf2a984f5223f587a2f489580e7113c3c6922b5b141a5f0cd5f',
    },
    referenceHash: '9657ba4e2e7e0bf2a984f5223f587a2f489580e7113c3c6922b5b141a5f0cd5f',
    referenceChars: 1_000,
    edits: [],
    donor: {
      startOffset: 1_437,
      endOffset: 2_167,
      hash: '4e6b522f74282a88fd3a34e54317be859f0ce194f63d6ef50a3164e11bdf67df',
    },
    damages: [
      {
        kind: 'insertion',
        hash: '208443ae453423e683cde6fece78fdf70e3b8225ea4e77a60d8692371e1bd405',
        changedChars: 155,
      },
    ],
    reviewedOn: '2026-10-23',
  },
];

//endregion Editor fidelity pool, drawn specifications 3
