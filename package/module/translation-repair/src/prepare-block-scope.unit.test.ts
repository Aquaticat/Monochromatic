import { tagged, } from '@monochromatic-dev/module-logger/ts';
import { describe, expect, it, } from '@monochromatic-dev/module-test/ts';
import {
  alignDocumentSections,
  createSyntheticClient,
  parseDocument,
  prepareBlockPairing,
  prepareDocumentPair,
  subdivideChunkPair,
  validateTranslatedSlice,
} from '../dist/final/node/index.mjs';

const sourceText = `## 猫\n\n${'猫在暖和的房间里睡觉。'.repeat(12)} [回来](https://example.test/cat)`;
const paragraph = 'The cat slept in the warm room, where the cat could rest all afternoon.'.repeat(2);
const targetText = `## Cat\n\n${paragraph}\n\n${paragraph}\n\n${paragraph}\n\nThe cat rested. [Return](https://example.test/cat)`;
const l = tagged({ tag: 'prepared-block-scope-test' });

await describe({
  name: 'acquired pairing reaches writer scope',
  children: [
    it({
      name: 'keeps a heading independent and its body complete after two distinct pairing voices',
      fn: async () => {
        const source = parseDocument({ text: sourceText });
        const target = parseDocument({ text: targetText });
        const [pair] = alignDocumentSections({ source, target }).pairs;
        if (pair === undefined) throw new Error('fixture needs an aligned parent');
        const legacy = subdivideChunkPair({ pair, sourceText, targetText, baseIndex: 0 });
        const legacyHeading = legacy.find(slice => (slice.source.nodes.length === 1) && (slice.source.nodes[0]?.kind === 'heading'));
        if (legacyHeading === undefined) throw new Error('fixture needs the isolated legacy heading');
        expect(validateTranslatedSlice({ sourceText: legacyHeading.source.text, pageText: legacyHeading.target.text, candidateText: '## Cat' }).kind).toBe('invalid');
        let calls = 0;
        const relations = [{ source: 0, target: 0 }, ...[1, 2, 3, 4].map(targetIndex => ({ source: 1, target: targetIndex }))];
        const client = createSyntheticClient({ apiKey: 'fixture-key', transport: async () => {
          calls += 1;
          return { status: 200, bodyText: `data: ${JSON.stringify({ choices: [{ index: 0, delta: { content: JSON.stringify({ pairs: relations }) } }] })}\n\ndata: [DONE]\n\n` };
        } });
        const acquired = await prepareBlockPairing({ client, modelIds: ['hf:zai-org/GLM-5.3-Flash', 'hf:Qwen/Qwen3.8-27B'],
          pair, pairIndex: 0, targetContainers: target.containers, signal: new AbortController().signal, exchangeTimeoutMs: 5_000, l });
        expect(calls).toBe(2);
        if ((acquired.kind !== 'paired') || (acquired.evidence.kind !== 'queried')) throw new Error('fixture requires current acquired relations');
        expect(new Set(acquired.evidence.outcome.outcomes.map(outcome => outcome.modelId)).size).toBe(2);
        const prepared = prepareDocumentPair({ sourceText, targetText, frontMatterAuthority: 'archive', blockPairings: new Map([[0, acquired.pairs]]) });
        const heading = prepared.slices.find(slice => (slice.source.nodes.length === 1) && (slice.source.nodes[0]?.kind === 'heading'));
        const body = prepared.slices.find(slice => (slice.source.nodes.length === 1) && (slice.source.nodes[0]?.kind === 'paragraph'));
        if ((heading === undefined) || (body === undefined)) throw new Error('fixture requires independently scoped heading and body');
        expect(heading.target.text).toBe('## Cat');
        expect(body.target.nodes).toHaveLength(4);
        expect(body.source.text).toBe(pair.source.nodes[1]?.text);
        expect(prepared.slices.flatMap(slice => slice.source.nodes.map(node => node.id))).toEqual(pair.source.nodes.map(node => node.id));
        expect(prepared.slices.flatMap(slice => slice.target.nodes.map(node => node.id))).toEqual(pair.target.nodes.map(node => node.id));
        expect(validateTranslatedSlice({ sourceText: heading.source.text, pageText: heading.target.text, candidateText: heading.target.text }).kind).toBe('valid');
        expect(validateTranslatedSlice({ sourceText: body.source.text, pageText: body.target.text, candidateText: body.target.text }).kind).toBe('valid');
      },
    }),
  ],
});
