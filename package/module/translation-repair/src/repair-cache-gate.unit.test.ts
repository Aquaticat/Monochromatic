/**
 Tests for why a settled repair slice may not be cached, said as reasons the
 driver's warn line prints.

 A slice no critic was heard on, and one where a stage fell short of quorum,
 must not be kept, since a resumed run would read either as "examined and
 found nothing to change". Fixtures are cat-themed invention.

 @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  cacheRefusalsOf,
  frontMatterRepairOutcome,
  stageQuorumUnmetFinding,
} from '../dist/final/node/index.mjs';

/**
 Settled outcome the cases vary, heard by three critics and carrying no
 finding of its own.
 */
const HEARD = {
  ...frontMatterRepairOutcome({
    sliceIndex: 4,
    targetText: 'The kitten naps on the windowsill.',
  },),
  heardCritics: 3,
  findings: [],
};

await describe({
  name: cacheRefusalsOf.name,
  children: [
    it({
      name: 'REFUSES a slice no critic was heard on, whatever else its findings say',
      fn: async () => {
        expect(cacheRefusalsOf({
          outcome: {
            ...HEARD,
            heardCritics: 0,
            findings: [stageQuorumUnmetFinding({ shortfall: 'checker 1/3', },),],
          },
        },),).toStrictEqual(['no critic was heard',],);
      },
    },),
    it({
      name: 'NAMES every stage that fell short of quorum, in order, and not a stage that only lost '
        + 'a voice',
      fn: async () => {
        expect(cacheRefusalsOf({
          outcome: {
            ...HEARD,
            findings: [
              stageQuorumUnmetFinding({ shortfall: 'panel 1/3', },),
              'stage-voice-lost (editor tabby-large)',
              stageQuorumUnmetFinding({ shortfall: 'checker 1/3', },),
            ],
          },
        },),).toStrictEqual([
          'a stage heard fewer than quorum (stage-quorum-unmet (panel 1/3))',
          'a stage heard fewer than quorum (stage-quorum-unmet (checker 1/3))',
        ],);
      },
    },),
    it({
      name: 'ADMITS a slice every stage heard to quorum',
      fn: async () => {
        expect(cacheRefusalsOf({ outcome: HEARD, },),).toStrictEqual([],);
      },
    },),
  ],
},);
