import { createHash, } from 'node:crypto';
import { describe, expect, it, } from '@monochromatic-dev/module-test/ts';
import {
  blockPairingQuestion,
  blockPairingQuestionKey,
  type ContentChunk,
  type DocumentNode,
} from '../dist/final/node/index.mjs';

type KeyCase = {
  readonly name: string;
  readonly source: readonly string[];
  readonly target: readonly string[];
  readonly key: string;
};

// These golden keys were captured from the built implementation before extraction.
// question-baseline-QWeptI retains its runtime entry hash, deciding source hashes and full protocols.
const cases: readonly KeyCase[] = [
  { name: 'both empty', source: [], target: [], key: 'faa9f8664ec3ce096ea3523a41deee37e2640518b48708faab5208d38cf44871' },
  { name: 'source empty', source: [], target: ['Cat'], key: '66d67307df376450f77820ec2c186682509c2efb418025503a53f29cf8a515f2' },
  { name: 'target empty', source: ['Cat'], target: [], key: '7ca4215f9d7e547b5a4d3c19f35eb2e1b8c966a74e37e762cc51b0a6456af6a6' },
  { name: 'simple', source: ['Cat'], target: ['Chat'], key: 'eb8709c8003493de12d097d1bf1dc2e7d6fbc8da298af2d9e4e0f39af6b64e48' },
  { name: 'reversed sides', source: ['Chat'], target: ['Cat'], key: 'ec443a04d8b2642c63c19b6c225680c3b382b58aafd2c8fea87216bf8aec2d37' },
  { name: 'empty block text', source: [''], target: [''], key: '8c95cd9ac282c2a4846bd5979371009847f750c9f4336cb5170ba20a0ce76fe6' },
  { name: 'Unicode and astral text', source: ['猫😺'], target: ['chaté'], key: '96787a436447c857f64947cdfa1fe317b2ed6ef269fdca69ce4c45f17eb227d3' },
  { name: 'embedded NUL left boundary', source: ['Cat\u0000Dog', 'Owl'], target: ['Chat'], key: '1cf09674a7ea3f01cda797fb651d823988d99f626826990e2f5e27ace5c81e25' },
  { name: 'embedded NUL right boundary', source: ['Cat', 'Dog\u0000Owl'], target: ['Chat'], key: '1cf09674a7ea3f01cda797fb651d823988d99f626826990e2f5e27ace5c81e25' },
  { name: 'syntax boundaries', source: ['```\nCat "quote" \\ tail', '</script>\n## Cat'], target: ["Chat 'quoted'\n````"], key: 'd6096f2cceef4510adc067ffd0d62614bb9b15952132941ccfd731da1935f9e5' },
  { name: 'multiple blocks', source: ['Cat', 'Dog', 'Owl'], target: ['Chat', 'Chien'], key: '4f2ea49a7cab301d50d4e20e76be5774c8ace027e8b117232cb9b1e9fa1914ec' },
];

function chunk(texts: readonly string[]): ContentChunk {
  const nodes: DocumentNode[] = [];
  texts.reduce(function placeNode(
    offset,
    text,
    index,
  ): number {
    nodes.push({
      id: `block/${String(index)}`, kind: 'paragraph', zone: 'body', text,
      startOffset: offset, endOffset: offset + text.length,
      contentHash: createHash('sha256').update(text).digest('hex'),
    });
    return offset + text.length + 1;
  }, 0);
  const text = texts.join('\n');
  return { sliceIndex: 0, nodes, startOffset: 0, endOffset: text.length, text };
}

await describe({ name: '', children: [
  describe({ name: blockPairingQuestionKey.name, children: cases.map(({ name, source, target, key }) => it({
    name: `preserves pre-extraction ${name} bytes`,
    fn: async () => {
      const sourceBlocks = source.map((text, index) => ({ index, text }));
      const targetBlocks = target.map((text, index) => ({ index, text }));
      expect(blockPairingQuestionKey({ sourceBlocks, targetBlocks })).toBe(key);
      const pair = { source: chunk(source), target: chunk(target) };
      expect(blockPairingQuestion({ pair }).key).toBe(key);
    },
  })) }),
] });
