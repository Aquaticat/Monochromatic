import { type Logger, tagged, } from '@monochromatic-dev/module-logger/ts';
import { describe, expect, it, } from '@monochromatic-dev/module-test/ts';
import { alignDocumentSections, hashContent, isInsertionChunk, parseDocument, readRegisteredPreparationParent,
  PreparationReceiptError, type PreparationParentExpectation, } from '../dist/final/node/index.mjs';

const l = tagged({ tag: 'registered-parent-test' });
const sourceText = '# First\n\nFirst body.\n\n# Second\n\nSecond body.';
const targetText = '# First\n\nFirst archive.\n\n# Second\n\nSecond archive.';
const expected: PreparationParentExpectation = { sourceHash: hashContent({ content: sourceText }), targetHash: hashContent({ content: targetText }),
  pairIndex: 1, sourceIndex: 1, targetIndex: 1 };
function failure(run: () => unknown): string {
  try {
    run();
    return 'no-refusal';
  }
  catch (error) {
    if (!(error instanceof PreparationReceiptError)) throw error;
    return error.kind;
  }
}

await describe({ name: '', children: [describe({ name: readRegisteredPreparationParent.name, children: [
  it({ name: 'selects exact current full-document parent data without any receipt or qualification', fn: async () => {
    const source = parseDocument({ text: sourceText });
    const target = parseDocument({ text: targetText });
    const alignment = alignDocumentSections({ source, target });
    const selected = readRegisteredPreparationParent({ expected, sourceText, targetText, l });
    expect(selected).toEqual({ scope: 'registered-preparation-parent', source, target, pair: alignment.pairs[1], alignmentFindings: alignment.findings });
    expect(Object.keys(selected).toSorted()).toEqual(['alignmentFindings', 'pair', 'scope', 'source', 'target']);
  } }),
  it({ name: 'retains singleton structural planning without manufacturing model evidence', fn: async () => {
    const source = 'One original.';
    const target = 'One incumbent.';
    const selected = readRegisteredPreparationParent({ expected: { sourceHash: hashContent({ content: source }), targetHash: hashContent({ content: target }),
      pairIndex: 0, sourceIndex: 0, targetIndex: 0 }, sourceText: source, targetText: target, l });
    expect(selected.pair.source.nodes).toHaveLength(1);
    expect(selected.pair.target.nodes).toHaveLength(1);
    expect('receipt' in selected).toBe(false);
    expect('evidence' in selected).toBe(false);
  } }),
  it({ name: 'retains a native source insertion parent with an empty target anchor', fn: async () => {
    const source = '---\nname: whiskers\n---\n\n开场白：猫猫登场。\n\n## 其一：Mittens\n\n猫猫喜欢晒太阳，尾巴一摇一摇。\n\n## 其二：Boots\n\n猫猫每天下午都在窗台上打盹，直到太阳落下。\n\n## 其三：Paws\n\n猫猫和邻居家的黑猫是好朋友，它们常常一起追蝴蝶。\n';
    const target = '---\nname: whiskers\n---\n\nPrologue: the cat arrives.\n\n## Mittens\n\nThe cat loves sunbathing, tail swishing.\n\n## Paws\n\nThe cat and the black cat next door are friends.\n';
    const selected = readRegisteredPreparationParent({ expected: { sourceHash: hashContent({ content: source }), targetHash: hashContent({ content: target }),
      pairIndex: 2, sourceIndex: 2, targetIndex: 2 }, sourceText: source, targetText: target, l });
    expect(isInsertionChunk(selected.pair.target)).toBe(true);
    expect(selected.pair.target.nodes).toEqual([]);
    expect(selected.pair.target.startOffset).toBe(target.indexOf('## Paws'));
  } }),
  ...(['sourceText', 'targetText'] as const).map(side => it({ name: `rejects changed complete ${side} despite unchanged selected parent`, fn: async () => {
    const supplied = { sourceText, targetText };
    supplied[side] = supplied[side].replace('First body.', 'Other body.').replace('First archive.', 'Other archive.');
    expect(failure(() => readRegisteredPreparationParent({ expected, ...supplied, l }))).toBe('documents');
  } })),
  ...(['pairIndex', 'sourceIndex', 'targetIndex'] as const).flatMap(field => [-1, 0.5, Number.NaN, Number.POSITIVE_INFINITY, 9].map(value => it({
    name: `rejects invalid or unmatched ${field} ${String(value)}`, fn: async () => {
      expect(failure(() => readRegisteredPreparationParent({ expected: { ...expected, [field]: value }, sourceText, targetText, l }))).toBe('parent');
    },
  }))),
  it({ name: 'uses independently registered section correspondence before index selection', fn: async () => {
    const changed: PreparationParentExpectation = { ...expected, pairIndex: 0, sourceIndex: 0, targetIndex: 1, sectionPairing: [{ source: 0, target: 1 }] };
    const selected = readRegisteredPreparationParent({ expected: changed, sourceText, targetText, l });
    expect(selected.pair.source.sliceIndex).toBe(0);
    expect(selected.pair.target.sliceIndex).toBe(1);
    expect(selected.alignmentFindings.length > 0).toBe(true);
    const { sectionPairing: _pairing, ...defaulted } = changed;
    expect(failure(() => readRegisteredPreparationParent({ expected: defaulted, sourceText, targetText, l }))).toBe('parent');
  } }),
  ...(['source', 'target', 'both'] as const).map(side => it({ name: `does not invent a parent for an empty ${side} document`, fn: async () => {
    const source = side === 'target' ? sourceText : '';
    const target = side === 'source' ? targetText : '';
    expect(failure(() => readRegisteredPreparationParent({ expected: { sourceHash: hashContent({ content: source }), targetHash: hashContent({ content: target }),
      pairIndex: 0, sourceIndex: 0, targetIndex: 0 }, sourceText: source, targetText: target, l }))).toBe('parent');
  } })),
  it({ name: 'snapshots registered coordinates before caller logging callbacks and owns returned parsing', fn: async () => {
    const mutable = structuredClone(expected);
    let entries = 0;
    const logger: Logger = { ...l, debug(message: string): void {
      entries += 1;
      Object.assign(mutable, { sourceHash: 'later-source', pairIndex: 99 });
      l.debug(message);
    } };
    const selected = readRegisteredPreparationParent({ expected: mutable, sourceText, targetText, l: logger });
    expect(entries > 0).toBe(true);
    expect(selected.pair.source.sliceIndex).toBe(1);
    Object.assign(selected.source, { documentHash: 'later-result' });
    expect(expected.sourceHash).toBe(hashContent({ content: sourceText }));
    expect(readRegisteredPreparationParent({ expected, sourceText, targetText, l }).source.documentHash).toBe(expected.sourceHash);
  } }),
] })] });
