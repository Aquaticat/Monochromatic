import { createHash, } from 'node:crypto';
import { describe, expect, it, } from '@monochromatic-dev/module-test/ts';
import {
  blockPairingQuestion,
  blockPairingQuestionKey,
  SEAT_HYPER_OPENROUTER_VISION_EDITOR,
  SEAT_SYNTHETIC_VISION_NO_OPENROUTER,
  SEAT_SYNTHETIC_VISION_WITHHELD,
  type ContentChunk,
  type DocumentNode,
} from '../dist/final/node/index.mjs';

type KeyCase = {
  readonly name: string;
  readonly source: readonly string[];
  readonly target: readonly string[];
  readonly key: string;
};

// These golden keys were captured from the built implementation before extraction, captured again
// when PAIRING_CACHE_VERSION moved to 3 (2026-09-28, ledger M28), and again when the roster that
// answers joined the key under ROSTER (2026-09-28, ledger X13).
// question-baseline-QWeptI retains its runtime entry hash, deciding source hashes and full protocols.
// Roster every golden key is taken under.
const ROSTER = [SEAT_HYPER_OPENROUTER_VISION_EDITOR, SEAT_SYNTHETIC_VISION_NO_OPENROUTER,] as const;

const cases: readonly KeyCase[] = [
  { name: 'both empty', source: [], target: [], key: '6fb5bd859a6e5a35c23f2874c9c200e8fd7ccc0f844968967723d0306678e80a' },
  { name: 'source empty', source: [], target: ['Cat'], key: '96f8cc8395148704dee9dee7588e701e6313ff4ac8c8a2b9f3dc2a9f2d101535' },
  { name: 'target empty', source: ['Cat'], target: [], key: 'ff0fde94e4e2c5aa30ff0f2b601d1181adcb4f4059a87b4ff94f39cd0a3a5f75' },
  { name: 'simple', source: ['Cat'], target: ['Chat'], key: 'e9dd1537df1f031193c2eb4c8fdaba6841ef3cda30d079ab82076b75e3a6522b' },
  { name: 'reversed sides', source: ['Chat'], target: ['Cat'], key: 'aa4eb43710cf6f65f0583721bf634aef612eaf74035564981e7194b535b8893c' },
  { name: 'empty block text', source: [''], target: [''], key: '821423ed8d76382e09672b053cd0c452d2924285d33c95f18a2a94579f1f3107' },
  { name: 'Unicode and astral text', source: ['猫😺'], target: ['chaté'], key: 'cb7aafeebcc4439b2e7f61353305b3e6990250254b3b5c2ee7b54d05ce69d0ba' },
  { name: 'embedded NUL left boundary', source: ['Cat\u0000Dog', 'Owl'], target: ['Chat'], key: 'acdb94030e6948f82b5bf9ff34bc6ea6c1a2403e13c7b7939e2e8eabaaafd14a' },
  { name: 'embedded NUL right boundary', source: ['Cat', 'Dog\u0000Owl'], target: ['Chat'], key: 'acdb94030e6948f82b5bf9ff34bc6ea6c1a2403e13c7b7939e2e8eabaaafd14a' },
  { name: 'syntax boundaries', source: ['```\nCat "quote" \\ tail', '</script>\n## Cat'], target: ["Chat 'quoted'\n````"], key: '1c6fddd283203b576f068ab166f7f9bec3aee059686d9dca274e3eeee968b0f3' },
  { name: 'multiple blocks', source: ['Cat', 'Dog', 'Owl'], target: ['Chat', 'Chien'], key: 'cf8db86265e5c064cf820d366690e948e1a70590e8e8803309c6bdc33107de00' },
];

// One pairing question's texts, each side in document order.
type Question = { readonly source: readonly string[]; readonly target: readonly string[] };

// Pairs of different questions the key must tell apart (ledger X15): a NUL-joined layout
// aliased each pair, and UTF-8 folds both lone surrogates into U+FFFD.
const distinctQuestions: readonly { readonly label: string; readonly left: Question; readonly right: Question }[] = [
  {
    label: 'an empty text beside the side boundary',
    left: { source: ['Cat', ''], target: ['Chat'] },
    right: { source: ['Cat'], target: ['', 'Chat'] },
  },
  {
    label: 'a NUL inside a text, across a block boundary',
    left: { source: ['Cat\u0000Dog', 'Owl'], target: ['Chat'] },
    right: { source: ['Cat', 'Dog\u0000Owl'], target: ['Chat'] },
  },
  {
    label: 'two different lone surrogates',
    left: { source: ['\uD800'], target: ['Chat'] },
    right: { source: ['\uDC00'], target: ['Chat'] },
  },
];

// Key of one question under the fixture roster.
function keyOf(question: Question): string {
  return blockPairingQuestionKey({
    sourceBlocks: question.source.map((text, index) => ({ index, text })),
    targetBlocks: question.target.map((text, index) => ({ index, text })),
    modelIds: ROSTER,
  });
}

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
        const bare = blockPairingQuestionKey({ sourceBlocks, targetBlocks, modelIds: ROSTER });
        expect(bare).toBe('e9dd1537df1f031193c2eb4c8fdaba6841ef3cda30d079ab82076b75e3a6522b');
        const sighted = blockPairingQuestionKey({ sourceBlocks, targetBlocks, pictureContext: 'PICTURE nap.webp', modelIds: ROSTER });
        expect(sighted).not.toBe(bare);
        const pair = { source: chunk(['Cat']), target: chunk(['Chat']) };
        expect(blockPairingQuestion({ pair, pictureContext: 'PICTURE nap.webp', modelIds: ROSTER }).key).toBe(sighted);
        expect(blockPairingQuestion({ pair, pictureContext: '', modelIds: ROSTER }).key).toBe(bare);
      },
    }),
  ] }),
  describe({ name: 'roster in the key (ledger X13, 2026-09-28)', children: [
    it({
      name: 'moves the key for another roster, so a pairing one bench settled is never resumed for another',
      fn: async () => {
        const sourceBlocks = [{ index: 0, text: 'Cat' }];
        const targetBlocks = [{ index: 0, text: 'Chat' }];
        const settled = blockPairingQuestionKey({ sourceBlocks, targetBlocks, modelIds: ROSTER });
        expect(blockPairingQuestionKey({ sourceBlocks, targetBlocks, modelIds: [...ROSTER] })).toBe(settled);
        expect(blockPairingQuestionKey({
          sourceBlocks, targetBlocks, modelIds: [SEAT_SYNTHETIC_VISION_WITHHELD, SEAT_SYNTHETIC_VISION_NO_OPENROUTER],
        })).not.toBe(settled);
      },
    }),
  ] }),
  describe({ name: 'one key per question (ledger X15, 2026-09-28)', children: distinctQuestions.map(({ label, left, right }) => it({
    name: `KEYS TWO DIFFERENT QUESTIONS APART: ${label}`,
    fn: async () => {
      expect(keyOf(left)).not.toBe(keyOf(right));
    },
  })) }),
  describe({ name: blockPairingQuestionKey.name, children: cases.map(({ name, source, target, key }) => it({
    name: `preserves pre-extraction ${name} bytes`,
    fn: async () => {
      const sourceBlocks = source.map((text, index) => ({ index, text }));
      const targetBlocks = target.map((text, index) => ({ index, text }));
      expect(blockPairingQuestionKey({ sourceBlocks, targetBlocks, modelIds: ROSTER })).toBe(key);
      const pair = { source: chunk(source), target: chunk(target) };
      expect(blockPairingQuestion({ pair, modelIds: ROSTER }).key).toBe(key);
    },
  })) }),
] });
