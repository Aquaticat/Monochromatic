/**
 * Tests for the one spelling of a silent stage and the question the caches ask.
 *
 * `#238` cached a settlement reached while a stage heard nobody, because the
 * quorum gather reports shortfall as a finding and no cache read it. The cases
 * hold the producer's spelling and the consumers' reading together.
 *
 * @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  everyStageHeard,
  silentStagesOf,
  STAGE_QUORUM_UNMET_PREFIX,
  stageQuorumUnmetFinding,
} from '../dist/final/node/index.mjs';

await describe({
  name: stageQuorumUnmetFinding.name,
  children: [
    it({
      name: 'SPELLS the finding the way the caches read it, prefix first and shortfall closed',
      fn: async () => {
        /** Finding a critic stage two short of six would leave. */
        const finding = stageQuorumUnmetFinding({ shortfall: 'critic 2/6', },);
        expect(finding,).toBe('stage-quorum-unmet (critic 2/6)',);
        expect(finding.startsWith(STAGE_QUORUM_UNMET_PREFIX,),).toBe(true,);
      },
    },),
  ],
},);

await describe({
  name: everyStageHeard.name,
  children: [
    it({
      name: 'ANSWERS true for findings that carry no shortfall, lost voices included',
      fn: async () => {
        expect(everyStageHeard({ findings: [], },),).toBe(true,);
        expect(everyStageHeard({
          findings: [
            'stage-voice-lost (critic hf:zai-org/GLM-5.3-Flash)',
            'stage-short (critic 5/6)',
          ],
        },),).toBe(true,);
      },
    },),
    it({
      name: 'ANSWERS false when any stage fell short of quorum, wherever the finding sits (`#238`)',
      fn: async () => {
        expect(everyStageHeard({
          findings: [
            'stage-voice-lost (editor minimax-m3)',
            stageQuorumUnmetFinding({ shortfall: 'editor 1/3', },),
            'non-translation-dominance (0.2)',
          ],
        },),).toBe(false,);
      },
    },),
    it({
      name: 'NAMES every silent stage and nothing else, in order',
      fn: async () => {
        expect(silentStagesOf({
          findings: [
            stageQuorumUnmetFinding({ shortfall: 'critic 0/6', },),
            'stage-voice-lost (checker qwen3.8-max)',
            stageQuorumUnmetFinding({ shortfall: 'checker 1/3', },),
          ],
        },),).toStrictEqual([
          'stage-quorum-unmet (critic 0/6)',
          'stage-quorum-unmet (checker 1/3)',
        ],);
      },
    },),
  ],
},);
