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

// These golden keys were captured from the built implementation before extraction, and captured again
// when PAIRING_CACHE_VERSION moved to 3 (2026-09-28, ledger M28).
// question-baseline-QWeptI retains its runtime entry hash, deciding source hashes and full protocols.
const cases: readonly KeyCase[] = [
  { name: 'both empty', source: [], target: [], key: 'def623e539be18ca61118ac894a09b7b65ce73d6346e2c4c61647c87cf262f16' },
  { name: 'source empty', source: [], target: ['Cat'], key: '4f9898f3a4c15e72e37dcd00ad59e7c7027b881959ac11cc8fe71a966d12a4de' },
  { name: 'target empty', source: ['Cat'], target: [], key: 'f4d1d2a42756dc6a04d00ab7ad5720cdb9ce8368ccc14b4549b21594831ae368' },
  { name: 'simple', source: ['Cat'], target: ['Chat'], key: '0bcdf52fedc008cd6088a9b9d909cb507211a2ab4dd565b5829faf39dd1273b3' },
  { name: 'reversed sides', source: ['Chat'], target: ['Cat'], key: '99032f6c7cea13972b06559bb3ba4afed156b0745c3855bcd63e7fe3ba223873' },
  { name: 'empty block text', source: [''], target: [''], key: 'aefdd0e83582680169740d208f2741b2737567299a648aad6a295855d4f2a450' },
  { name: 'Unicode and astral text', source: ['猫😺'], target: ['chaté'], key: 'aafb1078dd919b60e95f1e48571a0d8d1a462902c887817b37289672c7868f8f' },
  { name: 'embedded NUL left boundary', source: ['Cat\u0000Dog', 'Owl'], target: ['Chat'], key: 'cbf44f3cc0ec2e030e268bd2cf168146c89e64884bdf9881aa71f121e81e9edc' },
  { name: 'embedded NUL right boundary', source: ['Cat', 'Dog\u0000Owl'], target: ['Chat'], key: 'cbf44f3cc0ec2e030e268bd2cf168146c89e64884bdf9881aa71f121e81e9edc' },
  { name: 'syntax boundaries', source: ['```\nCat "quote" \\ tail', '</script>\n## Cat'], target: ["Chat 'quoted'\n````"], key: '19b388b78a492c1568c3263fb1b46c97a6eac902c1e08b74e50acff293d6f578' },
  { name: 'multiple blocks', source: ['Cat', 'Dog', 'Owl'], target: ['Chat', 'Chien'], key: '4e331430ebe0f1754bd0dc90fe71f9757a4af0e62934af13bb66a03641c4d86d' },
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
  describe({ name: 'picture context in the key (class thirty-four, 2026-09-16)', children: [
    it({
      name: 'changes the key when a picture context is given and keeps the golden bytes when none is',
      fn: async () => {
        const sourceBlocks = [{ index: 0, text: 'Cat' }];
        const targetBlocks = [{ index: 0, text: 'Chat' }];
        const bare = blockPairingQuestionKey({ sourceBlocks, targetBlocks });
        expect(bare).toBe('0bcdf52fedc008cd6088a9b9d909cb507211a2ab4dd565b5829faf39dd1273b3');
        const sighted = blockPairingQuestionKey({ sourceBlocks, targetBlocks, pictureContext: 'PICTURE nap.webp' });
        expect(sighted).not.toBe(bare);
        const pair = { source: chunk(['Cat']), target: chunk(['Chat']) };
        expect(blockPairingQuestion({ pair, pictureContext: 'PICTURE nap.webp' }).key).toBe(sighted);
        expect(blockPairingQuestion({ pair, pictureContext: '' }).key).toBe(bare);
      },
    }),
  ] }),
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
