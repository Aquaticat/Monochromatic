import { describe, expect, it, } from '@monochromatic-dev/module-test/ts';
import {
  blockPairingProtocol,
  blockPairingQuestion,
  hashContent,
  parseDocument,
  prepareDocumentPair,
  qualifyPreparedBlockPairing,
  readPreparationOccurrence,
  relabelArchiveFootnotes,
  translateSliceInput,
} from '../dist/final/node/index.mjs';
import { receiptFailure, receiptFixture, } from './preparation-receipt.test-fixture.ts';

await describe({ name: 'receipt reuse after an unrelated actual footnote transition', children: [it({
  name: 'reuses the registered terminal payload but reconstructs all moved occurrence coordinates and final native inputs',
  fn: async () => {
    const sourceText = 'Lead[^100].\n\n[^100]: Source note.\n\n## 猫\n\n猫睡了。';
    const targetText = 'Lead[^2].\n\n[^2]: Archive note.\n\n## Cat\n\n<div>\n\nThe cat slept.\n\n</div>';
    const definitions = await receiptFixture({ sourceText, targetText });
    const body = await receiptFixture({ sourceText, targetText, pairIndex: 1 });
    if ((definitions.prepared.kind !== 'paired') || (body.prepared.kind !== 'paired'))
      throw new Error('expected native paired fixture parents');
    const initial = prepareDocumentPair({ sourceText, targetText, sealArchiveOriginal: true,
      blockPairings: new Map([[0, definitions.prepared.pairs], [1, body.prepared.pairs]]) });
    const changed = relabelArchiveFootnotes({ entryId: 'receipt-footnote-fixture', sourceText, archiveText: targetText,
      slices: initial.slices, definitionPairs: definitions.prepared.definitionPairs, l: body.input.l });
    expect(changed.changed).toBe(true);
    expect(changed.withheld).toBeUndefined();
    expect(changed.archiveText).toBe(targetText.replaceAll('[^2]', '[^100]'));

    const expected = { ...body.expected, targetHash: hashContent({ content: changed.archiveText }) };
    const replayed = readPreparationOccurrence({ expected, receipt: body.receipt, sourceText, targetText: changed.archiveText, l: body.input.l });
    expect(replayed.target.documentHash).not.toBe(body.expected.targetHash);
    const offsetDelta = changed.archiveText.length - targetText.length;
    expect(offsetDelta).toBeGreaterThan(0);
    expect(body.input.pair.target.nodes.length).toBeGreaterThan(0);
    expect(replayed.pair.target.nodes.map(node => node.startOffset)).toEqual(body.input.pair.target.nodes.map(node => node.startOffset + offsetDelta));
    expect(body.input.targetContainers.length).toBeGreaterThan(0);
    expect(replayed.target.containers.map(container => container.openerStartOffset)).toEqual(body.input.targetContainers.map(container => container.openerStartOffset + offsetDelta));
    expect(replayed.pair.target).not.toEqual(body.input.pair.target);
    expect(replayed.pair.source).toEqual(body.input.pair.source);
    expect(
      blockPairingProtocol(blockPairingQuestion({ pair: replayed.pair })),
    ).toEqual(body.receipt.question.protocol);
    expect(replayed.prepared).toEqual(body.prepared);
    expect(body.calls).toHaveLength(2);
    expect(definitions.calls).toHaveLength(2);
    const qualified = qualifyPreparedBlockPairing({ pair: replayed.pair, pairIndex: expected.pairIndex,
      modelIds: expected.binding.modelIds, prepared: replayed.prepared, targetContainers: replayed.target.containers, l: body.input.l });
    expect(qualified.qualification).toBe('pairing-only');
    if (qualified.kind !== 'queried') throw new Error('expected queried body qualification');

    expect(receiptFailure(() => readPreparationOccurrence({ expected: { ...definitions.expected, targetHash: expected.targetHash },
      receipt: definitions.receipt, sourceText, targetText: changed.archiveText, l: body.input.l }))).toBe('question');
    const currentDefinitions = await receiptFixture({ sourceText, targetText: changed.archiveText });
    if (currentDefinitions.prepared.kind !== 'paired') throw new Error('expected current definition preparation');
    const final = prepareDocumentPair({ sourceText, targetText: changed.archiveText, sealArchiveOriginal: true,
      blockPairings: new Map([[0, currentDefinitions.prepared.pairs], [1, qualified.prepared.pairs]]) });
    const currentTarget = parseDocument({ text: changed.archiveText });
    expect(final.slices.flatMap(slice => slice.target.nodes)).toEqual(currentTarget.nodes);
    for (const slice of final.slices) {
      const projection = translateSliceInput({ slice, prepared: final });
      expect(projection.stageInput.incumbentText).toBe(slice.target.text);
      expect(projection.stageInput.lineStructured).toBe(final.lineStructuredSliceIndices.has(slice.target.sliceIndex));
      for (const node of slice.target.nodes) {
        expect(node.text).toBe(changed.archiveText.slice(node.startOffset, node.endOffset));
        expect(node.contentHash).toBe(hashContent({ content: node.text }));
      }
    }
    expect(body.calls).toHaveLength(2);
    expect(currentDefinitions.calls).toHaveLength(2);
  },
})] });
