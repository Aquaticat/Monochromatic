import { describe, expect, it, } from '@monochromatic-dev/module-test/ts';
import { PairingEvidenceError, readPreparationReceipt, } from '../dist/final/node/index.mjs';
import { receiptFailure, receiptFixture, } from './preparation-receipt.test-fixture.ts';

const f = await receiptFixture();
const input = { value: f.receipt, binding: f.expected.binding, question: f.receipt.question };

await describe({ name: readPreparationReceipt.name, children: [
  it({ name: 'reads actual native final outcomes without trusting an aggregate', fn: async () => {
    const result = readPreparationReceipt(input);
    expect(result).toEqual(f.receipt.outcomes);
    expect(result).not.toBe(f.receipt.outcomes);
    expect(f.calls).toHaveLength(2);
  } }),
  ...['acquisitionPlanDigest', 'attemptId', 'receiptId', 'pipelineDigest', 'requestConfigurationDigest'].map(field => it({
    name: `refuses changed ${field} rather than deriving expectations from the receipt`, fn: async () => {
      const value = { ...f.receipt, binding: { ...f.receipt.binding, [field]: 'different-fixture-binding' } };
      expect(receiptFailure(() => readPreparationReceipt({ ...input, value }))).toBe('binding');
    },
  })),
  ...['acquisitionPlanDigest', 'attemptId', 'receiptId', 'requestConfigurationDigest'].map(field => it({
    name: `refuses empty expected ${field} even when both sides agree`, fn: async () => {
      const binding = { ...input.binding, [field]: '' };
      expect(receiptFailure(() => readPreparationReceipt({ ...input, binding, value: { ...f.receipt, binding } }))).toBe('binding');
    },
  })),
  it({ name: 'requires the configured roster and order, not a shorter heard electorate', fn: async () => {
    for (const modelIds of [f.expected.binding.modelIds.toReversed(), f.expected.binding.modelIds.slice(0, 1)]) {
      expect(receiptFailure(() => readPreparationReceipt({ ...input, value: { ...f.receipt, binding: { ...f.receipt.binding, modelIds } } }))).toBe('binding');
    }
  } }),
  ...[undefined, null, [], { ...f.receipt, version: 2 }, { ...f.receipt, state: 'partial' },
    { ...f.receipt, pairs: [] }, { pairs: [], findings: [] }].map((value, index) => it({
      name: `refuses nonterminal or unsupported envelope fixture ${index}`, fn: async () => {
        expect(receiptFailure(() => readPreparationReceipt({ ...input, value }))).toBe('state');
      },
    })),
  it({ name: 'refuses prototype and hidden root state that serialization would discard', fn: async () => {
    const prototype = Object.setPrototypeOf(structuredClone(f.receipt), null);
    const hidden = Object.defineProperty(structuredClone(f.receipt), 'oldAggregate', { value: {} });
    const symbol = { ...f.receipt, [Symbol('unexpected hidden receipt metadata for test')]: true };
    for (const value of [prototype, hidden, symbol])
      expect(receiptFailure(() => readPreparationReceipt({ ...input, value }))).toBe('state');
  } }),
  it({ name: 'binds numbered bytes, exact schema and exact messages independently of the historical key', fn: async () => {
    const questions = [
      { ...f.receipt.question, sourceBlocks: [{ index: 0, text: 'different source' }] },
      { ...f.receipt.question, targetBlocks: [{ index: 7, text: 'different target' }] },
      { ...f.receipt.question, protocol: { ...f.receipt.question.protocol, messages: [] } },
      { ...f.receipt.question, protocol: { ...f.receipt.question.protocol, responseFormat: { type: 'json_object' } } },
      { ...f.receipt.question, freeOrder: { source: [], target: [] } },
    ];
    for (const question of questions)
      expect(receiptFailure(() => readPreparationReceipt({ ...input, value: { ...f.receipt, question } }))).toBe('question');
  } }),
  it({ name: 'retains sparse heard records and all loss booleans without manufacturing missing seats', fn: async () => {
    const [first] = f.receipt.outcomes;
    const sparse = { ...f.receipt, outcomes: [first] };
    expect(readPreparationReceipt({ ...input, value: sparse })).toEqual([first]);
    for (const answered of [true, false]) {
      for (const unreachable of [true, false]) {
        const outcomes = f.receipt.outcomes.map(record => ({ modelId: record.modelId, voice: { heard: false, answered, unreachable } }));
        expect(readPreparationReceipt({ ...input, value: { ...f.receipt, outcomes } })).toEqual(outcomes);
      }
    }
  } }),
  it({ name: 'rejects duplicate configured identities and duplicate or reordered asked seats', fn: async () => {
    const [first, second] = f.receipt.outcomes;
    expect(() => readPreparationReceipt({ ...input, binding: { ...input.binding, modelIds: [...input.binding.modelIds, ...input.binding.modelIds] } })).toThrow(PairingEvidenceError);
    for (const outcomes of [[first, first], [second, first]])
      expect(() => readPreparationReceipt({ ...input, value: { ...f.receipt, outcomes } })).toThrow(PairingEvidenceError);
  } }),
  it({ name: 'rejects malformed final seat fields and foreign identities rather than coercing them', fn: async () => {
    const modelId = f.expected.binding.modelIds[0];
    const values = [undefined, null, [], {}, { modelId }, { modelId: 'foreign-fixture-model', voice: { heard: false, answered: false, unreachable: true } },
      { modelId, voice: {} }, { modelId, voice: null }, { modelId, voice: { heard: 'true' } },
      { modelId, voice: { heard: true, value: { pairs: 'not an array' } } },
      { modelId, voice: { heard: true, value: { pairs: [] }, aggregate: [] } },
      { modelId, voice: { heard: false, answered: false } },
      { modelId, voice: { heard: false, answered: 'false', unreachable: false } },
      { modelId, voice: { heard: false, answered: true, unreachable: 0 } },
      { modelId, voice: { heard: false, answered: false, unreachable: false }, oldFinding: [] },
    ];
    for (const record of values)
      expect(receiptFailure(() => readPreparationReceipt({ ...input, value: { ...f.receipt, outcomes: [record] } }))).toBe('outcomes');
    for (const outcomes of [null, {}, [], [...f.receipt.outcomes, ...f.receipt.outcomes]])
      expect(receiptFailure(() => readPreparationReceipt({ ...input, value: { ...f.receipt, outcomes } }))).toBe('outcomes');
  } }),
  it({ name: 'owns nested heard wire without changing later reads', fn: async () => {
    const result = readPreparationReceipt(input);
    for (const outcome of result) {
      if (outcome.voice.heard)
        Object.defineProperty(outcome.voice.value, 'pairs', { value: [] });
    }
    expect(readPreparationReceipt(input)).toEqual(f.receipt.outcomes);
  } }),
] });
