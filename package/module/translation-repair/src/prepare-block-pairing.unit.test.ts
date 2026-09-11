import { tagged, } from '@monochromatic-dev/module-logger/ts';
import { describe, expect, it, } from '@monochromatic-dev/module-test/ts';
import {
  alignDocumentSections,
  createSyntheticClient,
  type PairedSectionRecord,
  parseDocument,
  prepareBlockPairing,
  type SliceCache,
} from '../dist/final/node/index.mjs';

const roster = ['hf:zai-org/GLM-5.3-Flash', 'hf:Qwen/Qwen3.8-27B',] as const;
const l = tagged({ tag: 'one-parent-preparation-test', },);
const complete = '{"pairs":[{"source":0,"target":0},{"source":1,"target":1}]}';
type Fixture = {
  readonly input: Parameters<typeof prepareBlockPairing>[0];
  readonly stored: Map<string, PairedSectionRecord>;
  readonly writes: { readonly key: string; readonly serialized: string; }[];
  readonly calls: string[];
};
function fixture({ sourceText = '猫睡了。\n\n它喜欢盒子。', targetText = 'The cat slept.\n\nShe loves boxes.', reply = complete, cache = true, }: {
  readonly sourceText?: string; readonly targetText?: string; readonly reply?: string; readonly cache?: boolean;
} = {},): Fixture {
  const source = parseDocument({ text: sourceText, },);
  const target = parseDocument({ text: targetText, },);
  const [pair,] = alignDocumentSections({ source, target, },).pairs;
  if (pair === undefined) throw new Error('fixture requires one deterministic parent',);
  const stored = new Map<string, PairedSectionRecord>();
  const writes: Fixture['writes'] = [];
  const calls: string[] = [];
  const pairingCache: SliceCache<PairedSectionRecord> = {
    resumed: stored,
    persist: async record => {
      writes.push(record);
      stored.set(record.key, JSON.parse(record.serialized) as PairedSectionRecord);
    },
  };
  const client = createSyntheticClient({
    apiKey: 'fixture-key',
    transport: async exchange => {
      calls.push(exchange.bodyJson ?? '');
      return { status: 200, bodyText: `data: ${JSON.stringify({ choices: [{ index: 0, delta: { content: reply, }, },], },)}\n\ndata: [DONE]\n\n`, };
    },
  },);
  return { stored, writes, calls, input: {
    client, modelIds: roster, pair, pairIndex: 7, targetContainers: target.containers,
    signal: new AbortController().signal, exchangeTimeoutMs: 5_000, l,
    ...(cache ? { pairingCache } : {}),
  } };
}

await describe({
  name: prepareBlockPairing.name,
  children: [
    it({
      name: 'shares cold cache bytes and warm findings without inventing new cached seat outcomes',
      fn: async () => {
        const f = fixture();
        const cold = await prepareBlockPairing(f.input);
        expect(cold.kind).toBe('paired');
        expect(f.calls).toHaveLength(2);
        expect(f.writes).toHaveLength(1);
        if (cold.kind !== 'paired') throw new Error('expected explicit pairing');
        expect(cold.evidence.kind).toBe('queried');
        expect(cold.findings.join(' ')).toContain('section 7 paired 2 of 2');
        const warm = await prepareBlockPairing(f.input);
        expect(f.calls).toHaveLength(2);
        expect(f.writes).toHaveLength(1);
        expect(warm.findings).toEqual(cold.findings);
        if (warm.kind !== 'paired') throw new Error('expected warm explicit pairing');
        expect(warm.pairs).toEqual(cold.pairs);
        expect(warm.evidence.kind).toBe('cached');
        expect('outcome' in warm.evidence).toBe(false);
      },
    },),
    it({
      name: 'keeps uncached acquisition usable without introducing a persistence dependency',
      fn: async () => {
        const f = fixture({ cache: false });
        const result = await prepareBlockPairing(f.input);
        expect(result.kind).toBe('paired');
        expect(f.calls).toHaveLength(2);
        expect(f.writes).toHaveLength(0);
      },
    },),
    it({
      name: 'retains a cached empty pairing as fallback with its exact historical findings',
      fn: async () => {
        const f = fixture();
        const initial = await prepareBlockPairing(f.input);
        if (initial.kind !== 'paired') throw new Error('expected cacheable initial pairing');
        f.stored.set(initial.evidence.key, { pairs: [], findings: ['historical unresolved parent'], });
        const result = await prepareBlockPairing(f.input);
        expect(result.kind).toBe('fallback');
        expect(result.findings).toEqual(['historical unresolved parent']);
        expect(f.calls).toHaveLength(2);
        expect(f.writes).toHaveLength(1);
      },
    },),
    ...[
      { name: 'no agreed relations', reply: '{"pairs":[]}', writes: 1, },
      { name: 'no usable voice', reply: '{"noPairs":true}', writes: 0, },
      { name: 'heard but invalid block indexes', reply: '{"pairs":[{"source":9,"target":0}]}', writes: 0, },
    ].map(test => it({
      name: `names ${test.name} as queried fallback rather than implicit correspondence`,
      fn: async () => {
        const f = fixture({ reply: test.reply });
        const result = await prepareBlockPairing(f.input);
        expect(result.kind).toBe('fallback');
        expect(result.findings.join(' ')).toContain('fell back to scoring');
        expect(f.writes).toHaveLength(test.writes);
        if (result.kind !== 'fallback') throw new Error('expected unresolved question');
        expect(result.evidence.kind).toBe('queried');
      },
    },)),
    it({
      name: 'does not cache a paired parent whose archive still has unclaimed blocks',
      fn: async () => {
        const f = fixture({ targetText: 'The cat slept.\n\nShe loves boxes.\n\nAn additional note about quilts.', reply: complete });
        const result = await prepareBlockPairing(f.input);
        expect(result.kind).toBe('paired');
        expect(result.findings.join(' ')).toContain('unresolved, not cached');
        expect(f.writes).toHaveLength(0);
      },
    },),
    it({
      name: 'preserves the conservative non-decline when a source block remains unplaced',
      fn: async () => {
        const f = fixture({ reply: '{"pairs":[{"source":0,"target":0}]}' });
        const result = await prepareBlockPairing(f.input);
        expect(result.kind).toBe('paired');
        expect(result.findings.join(' ')).not.toContain('unresolved, not cached');
        expect(f.writes).toHaveLength(1);
      },
    },),
    it({
      name: 'preserves structural singletons without model calls or cache writes',
      fn: async () => {
        const f = fixture({ sourceText: '## 猫', targetText: '## Cat' });
        const result = await prepareBlockPairing(f.input);
        expect(result).toEqual({ kind: 'implicit', findings: [], definitionPairs: [] });
        expect(f.calls).toHaveLength(0);
        expect(f.writes).toHaveLength(0);
      },
    },),
    ...(['source', 'target'] as const).map(side => it({
      name: `does not buy a question for an empty ${side} side`,
      fn: async () => {
        const f = fixture();
        const pair = { ...f.input.pair, [side]: { ...f.input.pair[side], nodes: [], text: '', startOffset: 0, endOffset: 0 } };
        expect((await prepareBlockPairing({ ...f.input, pair })).kind).toBe('empty');
        expect(f.calls).toHaveLength(0);
        expect(f.writes).toHaveLength(0);
      },
    },)),
    it({
      name: 'preserves crossing definition labels while supplying the existing empty body pairing',
      fn: async () => {
        const f = fixture({ sourceText: '[^1]: 猫。\n\n[^2]: 盒子。', targetText: '[^b]: Box.\n\n[^a]: Cat.' });
        const initial = await prepareBlockPairing(f.input);
        if (initial.kind !== 'paired') throw new Error('expected cacheable definition pairing');
        f.stored.set(initial.evidence.key, { pairs: [{ source: 0, target: 1 }, { source: 1, target: 0 }], findings: [] });
        const result = await prepareBlockPairing(f.input);
        if (result.kind !== 'paired') throw new Error('expected explicit definition-separated map entry');
        expect(result.pairs).toEqual([]);
        expect(result.definitionPairs).toEqual([{ sourceLabel: '1', targetLabel: 'a' }, { sourceLabel: '2', targetLabel: 'b' }]);
        expect(result.findings.join(' ')).toContain('footnote definitions cross');
        expect(f.calls).toHaveLength(2);
      },
    },),
    it({
      name: 'propagates persistence failure instead of returning a completed preparation',
      fn: async () => {
        const f = fixture();
        const failure = new Error('fixture persistence failed');
        let caught: unknown;
        try {
          await prepareBlockPairing({ ...f.input, pairingCache: { resumed: f.stored, persist: async () => { throw failure; } } });
        } catch (error) { caught = error; }
        expect(caught).toBe(failure);
      },
    },),
    it({
      name: 'honors cancellation before acquisition without writing cache state',
      fn: async () => {
        const f = fixture();
        const failure = new Error('fixture canceled');
        let caught: unknown;
        try { await prepareBlockPairing({ ...f.input, signal: AbortSignal.abort(failure) }); }
        catch (error) { caught = error; }
        expect(caught).toBe(failure);
        expect(f.writes).toHaveLength(0);
      },
    },),
  ],
},);
