import { tagged, } from '@monochromatic-dev/module-logger/ts';
import { describe, expect, it, } from '@monochromatic-dev/module-test/ts';
import {
  type BlockPairingWire,
  createSyntheticClient,
  pairBlocksWithRoster,
  readBlockPairingOutcomes,
  type RosterModelId,
  type RoundOutcome,
} from '../dist/final/node/index.mjs';

const roster = ['hf:Qwen/Qwen3.8-27B', 'hf:moonshotai/Kimi-K3', 'hf:zai-org/GLM-5.3-Flash',] as const;
const l = tagged({ tag: 'pairing-evidence-identity-test', },);
const wire: BlockPairingWire = { pairs: [{ source: 0, target: 0, },], };
const heard = (modelId: RosterModelId): RoundOutcome<BlockPairingWire> => ({ modelId, voice: { heard: true, value: wire, }, });
const missing = (modelId: RosterModelId): RoundOutcome<BlockPairingWire> => ({ modelId, voice: { heard: false, answered: false, unreachable: false, }, });
const invalid: readonly {
  readonly name: string;
  readonly modelIds: readonly RosterModelId[];
  readonly outcomes: readonly RoundOutcome<BlockPairingWire>[];
}[] = [
  { name: 'one identity cannot manufacture two endorsements', modelIds: roster, outcomes: [heard(roster[0]), heard(roster[0]),], },
  { name: 'unconfigured outcomes are not electorate members', modelIds: roster, outcomes: [heard('hf:openai/gpt-oss-120b'),], },
  { name: 'reordered outcomes are not a final roster-ordered record', modelIds: roster, outcomes: [heard(roster[1]), heard(roster[0]),], },
  { name: 'duplicate missing outcomes are still duplicate seat evidence', modelIds: roster, outcomes: [missing(roster[0]), missing(roster[0]),], },
  { name: 'an empty electorate is not a pairing configuration', modelIds: [], outcomes: [], },
  { name: 'a duplicated electorate is not independent configuration', modelIds: [roster[0], roster[0],], outcomes: [heard(roster[0]),], },
];

await describe({
  name: 'pairing evidence identity',
  children: [
    ...invalid.map(test => it({
      name: test.name,
      fn: async () => {
        expect(() => readBlockPairingOutcomes({ ...test, sourceCount: 2, targetCount: 2, l, },),).toThrow('pairing evidence',);
      },
    },)),
    it({
      name: 'accepts a sparse ordered subset without inventing the spared seat',
      fn: async () => {
        const outcomes = [heard(roster[0]), heard(roster[2]),];
        const result = readBlockPairingOutcomes({ outcomes, modelIds: roster, sourceCount: 2, targetCount: 2, l, },);
        expect(result.pairs,).toEqual(wire.pairs,);
        expect(result.outcomes,).toEqual(outcomes,);
      },
    },),
    it({
      name: 'a single configured identity remains insufficient for two endorsements',
      fn: async () => {
        const result = readBlockPairingOutcomes({ outcomes: [heard(roster[0]),], modelIds: [roster[0],], sourceCount: 2, targetCount: 2, l, },);
        expect(result.usable,).toBe(1,);
        expect(result.pairs,).toEqual([],);
      },
    },),
    ...[
      { name: 'duplicated', modelIds: [roster[0], roster[0],], },
      { name: 'empty', modelIds: [], },
    ].map(test => it({
      name: `refuses a ${test.name} live electorate before any model transport`,
      fn: async () => {
        let calls = 0;
        const client = createSyntheticClient({
          apiKey: 'fixture-key',
          transport: async () => {
            calls += 1;
            return { status: 200, bodyText: `data: ${JSON.stringify({ choices: [{ index: 0, delta: { content: JSON.stringify(wire,), }, },], },)}\n\ndata: [DONE]\n\n`, };
          },
        },);
        let caught: unknown;
        try {
          await pairBlocksWithRoster({ client, modelIds: test.modelIds, sourceBlocks: [{ index: 0, text: '猫睡了。', },],
            targetBlocks: [{ index: 0, text: 'The cat slept.', },], signal: new AbortController().signal,
            exchangeTimeoutMs: 5_000, l, fanOut: 'whole-bench', },);
        }
        catch (error) {
          caught = error;
        }
        expect(caught,).toBeInstanceOf(Error,);
        expect(calls,).toBe(0,);
      },
    },)),
  ],
},);
