import { describe, expect, it, } from '@monochromatic-dev/module-test/ts';
import {
  hashContent,
  parseDocument,
  prepareBlockPairing,
  prepareDocumentPair,
  qualifyPreparedBlockPairing,
  relabelArchiveFootnotes,
  translateSliceInput,
} from '../dist/final/node/index.mjs';
import { qualificationFailure, qualificationFixture, } from './qualified-block-pairing.test-fixture.ts';

const sourceText = 'Alpha[^10]  \nBeta[^200]  \nGamma.\n\n[^10]: First source note.\n\n[^200]: Second source note.';
const archiveBody = 'Alpha archive[^2]  \nBeta archive[^1]  \nGamma archive.';
const directDefinitions = '[^2]: First archive note.\n\n[^1]: Second archive note.';
const crossedDefinitions = '[^1]: Second archive note.\n\n[^2]: First archive note.';
const finalText = 'Alpha archive[^10]  \nBeta archive[^200]  \nGamma archive.\n\n[^10]: First archive note.\n\n[^200]: Second archive note.';
const directReply = '{"pairs":[{"source":0,"target":0},{"source":1,"target":1},{"source":2,"target":2}]}';
const crossedReply = '{"pairs":[{"source":0,"target":0},{"source":1,"target":2},{"source":2,"target":1}]}';

await describe({ name: 'current qualification after actual footnote normalization', children: [false, true].map(crossed => it({
  name: crossed ? 'retains initially unqualified crossed evidence, then qualifies only the newly acquired normalized preparation'
    : 'rejects formerly qualifying evidence against relabeled current text and qualifies the fresh preparation',
  fn: async () => {
    const archiveText = `${archiveBody}\n\n${crossed ? crossedDefinitions : directDefinitions}`;
    const before = qualificationFixture({ sourceText, targetText: archiveText, replies: [crossed ? crossedReply : directReply] });
    const acquired = await prepareBlockPairing(before.input);
    expect(acquired.kind).toBe('paired');
    if (acquired.kind !== 'paired') throw new Error('expected current definition-bearing preparation');
    expect(acquired.evidence.kind).toBe('queried');
    if (crossed) {
      expect(qualificationFailure(() => qualifyPreparedBlockPairing({ ...before.input, prepared: acquired }))).toBe('unclaimed-target');
      expect(acquired.definitionPairs).toEqual([{ sourceLabel: '10', targetLabel: '2' }]);
    } else {
      expect(qualifyPreparedBlockPairing({ ...before.input, prepared: acquired }).kind).toBe('queried');
      expect(acquired.definitionPairs).toHaveLength(2);
    }
    const initial = prepareDocumentPair({ sourceText, targetText: archiveText, blockPairings: new Map([[0, acquired.pairs]]), sealArchiveOriginal: true });
    const rewritten = relabelArchiveFootnotes({ entryId: 'qualification-footnote-fixture', slices: initial.slices,
      definitionPairs: acquired.definitionPairs, sourceText, archiveText, l: before.input.l });
    expect(rewritten.changed).toBe(true);
    expect(rewritten.withheld).toBeUndefined();
    expect(rewritten.archiveText).toBe(finalText);

    const after = qualificationFixture({ sourceText, targetText: rewritten.archiveText, replies: [directReply] });
    expect(qualificationFailure(() => qualifyPreparedBlockPairing({ ...after.input, prepared: acquired }))).toBe('question');
    const current = await prepareBlockPairing(after.input);
    const qualified = qualifyPreparedBlockPairing({ ...after.input, prepared: current });
    expect(qualified.kind).toBe('queried');
    if (qualified.kind !== 'queried') throw new Error('expected newly qualified current evidence');
    expect(qualified.qualification).toBe('pairing-only');
    expect(qualified.prepared.evidence.kind).toBe('queried');
    expect(qualified.prepared.evidence.key).not.toBe(acquired.evidence.key);
    expect(qualified.prepared.definitionPairs).toEqual([{ sourceLabel: '10', targetLabel: '10' }, { sourceLabel: '200', targetLabel: '200' }]);
    expect(qualified.sourceInsertions).toEqual([]);
    expect(qualified.targetDeclines).toEqual([]);
    expect(qualified.relations).toEqual([
      { source: 0, target: 0, authority: 'independent-endorsement' },
      { source: 1, target: 1, authority: 'independent-endorsement' },
      { source: 2, target: 2, authority: 'independent-endorsement' },
    ]);
    expect(before.calls).toHaveLength(2);
    expect(after.calls).toHaveLength(2);

    const prepared = prepareDocumentPair({ sourceText, targetText: rewritten.archiveText,
      blockPairings: new Map([[0, qualified.prepared.pairs]]), sealArchiveOriginal: true });
    const document = parseDocument({ text: rewritten.archiveText });
    expect(document.footnoteGraph.findings).toEqual([]);
    expect(prepared.targetText).toBe(finalText);
    expect(prepared.slices.flatMap(slice => slice.target.nodes)).toEqual(document.nodes);
    for (const slice of prepared.slices) {
      const input = translateSliceInput({ slice, prepared });
      expect(input.stageInput.incumbentText).toBe(slice.target.text);
      expect(input.stageInput.lineStructured).toBe(prepared.lineStructuredSliceIndices.has(slice.target.sliceIndex));
      for (const node of slice.target.nodes) {
        expect(node.text).toBe(rewritten.archiveText.slice(node.startOffset, node.endOffset));
        expect(node.contentHash).toBe(hashContent({ content: node.text }));
      }
    }
  },
})), });
