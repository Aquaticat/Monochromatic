import { tagged, } from '@monochromatic-dev/module-logger/ts';
import { describe, expect, it, } from '@monochromatic-dev/module-test/ts';
import {
  type BlockPairingWire,
  readBlockPairingOutcomes,
  type RoundOutcome,
} from '../dist/final/node/index.mjs';

const roster = ['hf:Qwen/Qwen3.8-27B', 'hf:moonshotai/Kimi-K3', 'hf:zai-org/GLM-5.3-Flash',] as const;
const l = tagged({ tag: 'pairing-recipe-reading-test', },);

await describe({
  name: readBlockPairingOutcomes.name,
  children: [
    it({
      name: 'keeps independently endorsed relations, not singleton relations or absent ballots',
      fn: async () => {
        const outcomes: readonly RoundOutcome<BlockPairingWire>[] = [
          { modelId: roster[0], voice: { heard: true, value: { pairs: [{ source: 0, target: 0, }, { source: 1, target: 1, },], }, }, },
          { modelId: roster[1], voice: { heard: true, value: { pairs: [{ source: 0, target: 0, },], }, }, },
          { modelId: roster[2], voice: { heard: false, answered: false, unreachable: true, }, },
        ];
        const result = readBlockPairingOutcomes({ outcomes, modelIds: roster, sourceCount: 2, targetCount: 2, l, },);
        expect(result.pairs,).toEqual([{ source: 0, target: 0, },],);
        expect(result.heard,).toBe(2,);
        expect(result.usable,).toBe(2,);
        expect(result.outcomes,).toEqual(outcomes,);
        expect(readBlockPairingOutcomes({ outcomes: structuredClone(outcomes,), modelIds: roster, sourceCount: 2, targetCount: 2, l, },),).toEqual(result,);
      },
    },),
    it({
      name: 'retains schema-heard invalid indexes as unusable evidence rather than accepting their relations',
      fn: async () => {
        const outcomes: readonly RoundOutcome<BlockPairingWire>[] = roster.map(modelId => ({
          modelId,
          voice: { heard: true, value: { pairs: [{ source: 9, target: 0, },], }, },
        }));
        const result = readBlockPairingOutcomes({ outcomes, modelIds: roster, sourceCount: 2, targetCount: 2, l, },);
        expect(result.pairs,).toEqual([],);
        expect(result.heard,).toBe(3,);
        expect(result.usable,).toBe(0,);
        expect(result.cacheEligible,).toBe(false,);
        expect(result.findings.filter(finding => finding.includes('unusable')),).toHaveLength(3,);
        expect(result.outcomes,).toEqual(outcomes,);
      },
    },),
    it({
      name: 'replays missing outcomes and distinguishes configured seats from asked seats',
      fn: async () => {
        const outcomes: readonly RoundOutcome<BlockPairingWire>[] = [
          { modelId: roster[1], voice: { heard: false, answered: true, unreachable: false, }, },
        ];
        const result = readBlockPairingOutcomes({ outcomes, modelIds: roster, sourceCount: 2, targetCount: 2, l, },);
        expect(result.pairs,).toEqual([],);
        expect(result.heard,).toBe(0,);
        expect(result.usable,).toBe(0,);
        expect(result.outcomes,).toEqual(outcomes,);
        expect(result.findings,).toEqual(['block-pairing no-usable-voice (0 heard of 3)',],);
      },
    },),
    it({
      name: 'uses the original definition exemptions when reading stored voice usability',
      fn: async () => {
        const outcomes: readonly RoundOutcome<BlockPairingWire>[] = roster.map(modelId => ({
          modelId,
          voice: { heard: true, value: { pairs: [{ source: 0, target: 1, }, { source: 1, target: 0, },], }, },
        }));
        const ordinary = readBlockPairingOutcomes({ outcomes, modelIds: roster, sourceCount: 2, targetCount: 2, l, },);
        const definitions = readBlockPairingOutcomes({ outcomes, modelIds: roster, sourceCount: 2, targetCount: 2,
          freeOrder: { source: new Set([0, 1,],), target: new Set([0, 1,],), }, l, },);
        expect(ordinary.usable,).toBe(0,);
        expect(definitions.usable,).toBe(3,);
        expect(definitions.outcomes,).toEqual(outcomes,);
      },
    },),
  ],
},);
