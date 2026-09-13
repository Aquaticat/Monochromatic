import { type Logger, } from '@monochromatic-dev/module-logger/ts';
import { describe, expect, it, } from '@monochromatic-dev/module-test/ts';
import { readPreparationDefinitionRelations, readPreparationOccurrence, PreparationQualificationError, } from '../dist/final/node/index.mjs';
import { receiptFixture, } from './preparation-receipt.test-fixture.ts';

await describe({ name: '', children: [describe({ name: 'definition evidence isolation and parser endpoints', children: [
  it({ name: 'does not give a failing full-parent fallback handoff veto over usable definition evidence', fn: async () => {
    const f = await receiptFixture({ sourceText: 'Body.\n\n[^1]: Source note.', targetText: 'Archive.\n\n[^7]: Archive note.', replies: ['{"pairs":[]}'] });
    expect(f.prepared.kind).toBe('fallback');
    const failure = new Error('controlled full-handoff failure');
    let handoffs = 0;
    const l: Logger = { ...f.input.l, warn(message: string): void {
      if (message.includes('[finishPreparedBlockPairing]')) {
        handoffs += 1;
        throw failure;
      }
      f.input.l.warn(message);
    } };
    let caught: unknown;
    try {
      readPreparationOccurrence({ ...f, l });
    }
    catch (error) { caught = error; }
    expect(caught).toBe(failure);
    expect(handoffs).toBe(1);
    handoffs = 0;
    const [result] = await Promise.allSettled([(async () => readPreparationDefinitionRelations({
      registration: { occurrence: f.expected, domain: { sourceIds: ['block/1'], targetIds: ['block/1'] } },
      receipt: f.receipt, sourceText: f.sourceText, targetText: f.targetText, l,
    }))()]);
    expect(result?.status).toBe('fulfilled');
    if (result?.status !== 'fulfilled') throw new Error('expected independent definition evidence');
    expect(result.value.definitionRelations).toEqual([]);
    expect(result.value.usable).toBe(2);
    expect(handoffs).toBe(0);
    expect(f.calls).toHaveLength(2);
  } }),
  it({ name: 'keeps definition relations invariant while unrelated native media claims change', fn: async () => {
    const token = ['$', '{path}'].join('');
    const marker = `<PhotoScroll photos={['${token}/photos/letter.webp']} />`;
    const sourceText = `About the cat.\n\n${marker}\n\nRemember the cat.\n\n[^1]: Source note.`;
    const variants = [
      { targetText: `About the cat.\n\n${marker}\n\nRemember the cat.\n\n[^7]: Archive note.`, targetDefinition: 3, bodyEnd: 2, media: false },
      { targetText: `About the cat.\n\n${marker}\n\n<details>\n<summary>Letter</summary>\n> Translated letter.\n</details>\n\nRemember the cat.\n\n[^7]: Archive note.`, targetDefinition: 5, bodyEnd: 4, media: true },
    ];
    const projections = [];
    for (const variant of variants) {
      const f = await receiptFixture({ sourceText, targetText: variant.targetText, replies: [JSON.stringify({ pairs: [
        { source: 0, target: 0 }, { source: 1, target: 1 }, { source: 2, target: variant.bodyEnd }, { source: 3, target: variant.targetDefinition },
      ] })] });
      const full = readPreparationOccurrence({ ...f, l: f.input.l });
      expect(full.prepared.findings.some(finding => finding.startsWith('block-pairing media-adjacent'))).toBe(variant.media);
      const definition = readPreparationDefinitionRelations({ registration: { occurrence: f.expected, domain: {
        sourceIds: ['block/3'], targetIds: [`block/${variant.targetDefinition}`],
      } }, receipt: f.receipt, sourceText, targetText: variant.targetText, l: f.input.l });
      expect(definition.definitionRelations).toEqual([{
        source: { nodeId: 'block/3', blockIndex: 3, label: '1' },
        target: { nodeId: `block/${variant.targetDefinition}`, blockIndex: variant.targetDefinition, label: '7' },
        authority: 'independent-endorsement',
      }]);
      projections.push(definition.definitionRelations.map(item => [item.source.label, item.target.label, item.authority]));
      expect(f.calls).toHaveLength(2);
    }
    expect(projections).toEqual([[['1', '7', 'independent-endorsement']], [['1', '7', 'independent-endorsement']]]);
  } }),
  ...[
    { name: 'indented', text: '  [^1]: Indented note.', label: '1' },
    { name: 'escaped closing delimiter', text: '[^a\\]b]: Escaped close.', label: 'a\\]b' },
    { name: 'escaped backslash', text: '[^a\\\\b]: Escaped slash.', label: 'a\\\\b' },
    { name: 'unicode', text: '[^猫]: Unicode.', label: '猫' },
    { name: 'multiline definition body', text: '[^2]: First line.\n    Second line.\n\n    Next paragraph.', label: '2' },
    { name: 'maximum active label extent', text: `[^${'a'.repeat(999)}]: Bounded label.`, label: 'a'.repeat(999) },
  ].map(example => it({ name: `reads exactly the parser-backed endpoint for ${example.name}`, fn: async () => {
    const text = `Body.\n\n${example.text}`;
    const f = await receiptFixture({ sourceText: text, targetText: text, replies: ['{"pairs":[{"source":1,"target":1}]}'] });
    expect(f.input.pair.source.nodes.filter(node => node.zone === 'footnote-definition').map(node => node.id)).toEqual(['block/1']);
    const result = readPreparationDefinitionRelations({ registration: { occurrence: f.expected, domain: { sourceIds: ['block/1'], targetIds: ['block/1'] } },
      receipt: f.receipt, sourceText: text, targetText: text, l: f.input.l });
    expect(result.definitionRelations).toEqual([{
      source: { nodeId: 'block/1', blockIndex: 1, label: example.label },
      target: { nodeId: 'block/1', blockIndex: 1, label: example.label }, authority: 'independent-endorsement',
    }]);
  } })),
  ...['[^]: Invalid.', '[^a  b]: Invalid whitespace.', `[^${'a'.repeat(1000)}]: Oversized label.`].map((text, index) => it({
    name: `does not fabricate an endpoint from parser-classified non-definition syntax ${index}`, fn: async () => {
      const document = `Body.\n\n${text}`;
      const f = await receiptFixture({ sourceText: document, targetText: document, replies: ['{"pairs":[{"source":1,"target":1}]}'] });
      expect(f.input.pair.source.nodes.every(node => node.zone !== 'footnote-definition')).toBe(true);
      let caught: unknown;
      try {
        readPreparationDefinitionRelations({ registration: { occurrence: f.expected, domain: { sourceIds: [], targetIds: [] } },
          receipt: f.receipt, sourceText: document, targetText: document, l: f.input.l });
      }
      catch (error) { caught = error; }
      expect(caught).toBeInstanceOf(PreparationQualificationError);
      expect((caught as PreparationQualificationError).kind).toBe('definition-domain-empty');
    },
  })),
] })] });
