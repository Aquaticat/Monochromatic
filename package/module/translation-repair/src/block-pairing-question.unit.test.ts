import { createHash, } from 'node:crypto';
import { describe, expect, it, } from '@monochromatic-dev/module-test/ts';
import {
  alignDocumentSections,
  blockPairingQuestion,
  type ChunkPair,
  parseDocument,
} from '../dist/final/node/index.mjs';

/**
 * Builds one complete parser-backed parent without transport.
 *
 * @param sourceText - original fixture
 *
 * @param targetText - incumbent fixture
 *
 * @returns Corresponding first parent
 *
 * @example
 * ```ts
 * const pair = parent({ sourceText: '猫。', targetText: 'Cat.', });
 * ```
 */
function parent({ sourceText, targetText, }: {
  readonly sourceText: string;
  readonly targetText: string;
},): ChunkPair {
  /** Parser output retaining exact node text. */
  const source = parseDocument({ text: sourceText, },);
  /** Archive parser output under the same grammar. */
  const target = parseDocument({ text: targetText, },);
  /** Parent using production section alignment. */
  const [pair,] = alignDocumentSections({ source, target, },).pairs;
  if (pair === undefined) throw new Error('fixture requires a parent',);
  return pair;
}

await describe({ name: blockPairingQuestion.name, children: [
  it({ name: 'preserves the established numbered texts and version-two cache key', fn: () => {
    /** Complete source and archive paragraphs. */
    const pair = parent({ sourceText: '猫睡了。\n\n它喜欢盒子。', targetText: 'The cat slept.\n\nShe loves boxes.', },);
    /** Actual shared question. */
    const question = blockPairingQuestion({ pair, },);
    expect(question.sourceBlocks,).toEqual([{ index: 0, text: '猫睡了。', }, { index: 1, text: '它喜欢盒子。', },]);
    expect(question.targetBlocks,).toEqual([{ index: 0, text: 'The cat slept.', }, { index: 1, text: 'She loves boxes.', },]);
    expect(question.freeOrder,).toEqual({ source: new Set(), target: new Set(), });
    expect(question.key,).toBe(createHash('sha256',)
      .update('2\u0000猫睡了。\u0000它喜欢盒子。\u0000\u0000\u0000The cat slept.\u0000She loves boxes.', 'utf8',)
      .digest('hex',));
  }, },),
  it({ name: 'numbers definition exemptions within the current parent on each side', fn: () => {
    /** Definitions have different local indexes on the two sides. */
    const pair = parent({ sourceText: '猫[^a]。\n\n[^a]: 盒子。\n\n[^b]: 枕头。', targetText: '[^z]: Pillow.\n\n[^y]: Box.', },);
    /** Definition sets must follow parsed positions, not label spelling. */
    const question = blockPairingQuestion({ pair, },);
    expect([...question.freeOrder.source,],).toEqual([1, 2,]);
    expect([...question.freeOrder.target,],).toEqual([0, 1,]);
    expect(question.sourceBlocks.map(block => block.index,),).toEqual([0, 1, 2,]);
    expect(question.targetBlocks.map(block => block.index,),).toEqual([0, 1,]);
  }, },),
  ...(['source', 'target',] as const).map(side => it({ name: `binds changed ${side} text and order`, fn: () => {
    /** Initial parent and derived current question. */
    const pair = parent({ sourceText: '猫。\n\n盒子。', targetText: 'Cat.\n\nBox.', },);
    /** Existing identity to compare with positive changes. */
    const original = blockPairingQuestion({ pair, },);
    /** Reordered nodes must not retain the old key. */
    const reordered = { ...pair, [side]: { ...pair[side], nodes: pair[side].nodes.toReversed(), }, };
    expect(blockPairingQuestion({ pair: reordered, },).key,).not.toBe(original.key,);
    /** Changed node text must reach numbering and identity together. */
    const changed = { ...pair, [side]: { ...pair[side], nodes: pair[side].nodes.map(node => ({ ...node, text: `${node.text}！`, })), }, };
    expect(blockPairingQuestion({ pair: changed, },).key,).not.toBe(original.key,);
  }, },)),
  it({ name: 'does not normalize embedded quotes, escapes or line endings', fn: () => {
    /** Parser-authorized bytes, not prompt or JSON interpolation. */
    const pair = parent({ sourceText: '“猫” \\[note]。\r\n第二行。', targetText: '“Cat” \\[note].\r\nSecond line.', },);
    /** Question copies each exact parsed node without interpreting its syntax. */
    const question = blockPairingQuestion({ pair, },);
    expect(question.sourceBlocks,).toEqual(pair.source.nodes.map((node, index,) => ({ index, text: node.text, })),);
    expect(question.targetBlocks,).toEqual(pair.target.nodes.map((node, index,) => ({ index, text: node.text, })),);
  }, },),
  it({ name: 'represents an empty side without inventing a numbered block or correspondence', fn: () => {
    /** Complete original singleton used only to derive a structural empty fixture. */
    const pair = parent({ sourceText: '猫。', targetText: 'Cat.', },);
    /** Empty source is representable without buying a question. */
    const empty = { ...pair, source: { ...pair.source, nodes: [], text: '', }, };
    /** Construction describes input, never an acquired relation. */
    const question = blockPairingQuestion({ pair: empty, },);
    expect(question.sourceBlocks,).toEqual([],);
    expect([...question.freeOrder.source,],).toEqual([],);
    expect(question.targetBlocks,).toEqual([{ index: 0, text: 'Cat.', },]);
    expect(Object.keys(question,).toSorted(),).toEqual(['freeOrder', 'key', 'sourceBlocks', 'targetBlocks',]);
  }, },),
], },);
