import { describe, expect, it, } from '@monochromatic-dev/module-test/ts';
import { PairingEvidenceError, prepareBlockPairing, qualifyPreparedBlockPairing, } from '../dist/final/node/index.mjs';
import { QUALIFICATION_ROSTER, qualificationFailure, qualificationFixture, } from './qualified-block-pairing.test-fixture.ts';

await describe({ name: 'qualified current pairing boundaries', children: [
  ...[
    { name: 'source', sourceText: '', targetText: 'Cat.\n\nBox.', },
    { name: 'target', sourceText: '猫。\n\n盒子。', targetText: '', },
  ].map(test => it({ name: `retains actual empty ${test.name} dispatch without inventing votes`, fn: async () => {
    const f = qualificationFixture(test);
    const prepared = await prepareBlockPairing(f.input);
    expect(qualifyPreparedBlockPairing({ ...f.input, prepared })).toEqual({ kind: 'empty', prepared });
    expect(f.calls).toHaveLength(0);
  } })),
  it({ name: 'retains actual singleton dispatch without declaring semantic endorsement', fn: async () => {
    const f = qualificationFixture({ sourceText: '## 猫', targetText: '## Cat' });
    const prepared = await prepareBlockPairing(f.input);
    const result = qualifyPreparedBlockPairing({ ...f.input, prepared });
    expect(result).toEqual({ kind: 'implicit', prepared });
    expect('outcome' in result).toBe(false);
    expect(f.calls).toHaveLength(0);
  } }),
  ...(['implicit', 'empty'] as const).map(kind => it({ name: `rejects a fabricated ${kind} fast path over multiple current blocks`, fn: async () => {
    const f = qualificationFixture();
    expect(qualificationFailure(() => qualifyPreparedBlockPairing({ ...f.input,
      prepared: { kind, findings: [], definitionPairs: [] } }))).toBe('fast-path');
    expect(f.calls).toHaveLength(0);
  } })),
  ...[
    { name: 'findings', fields: { findings: ['not a zero-question result'] } },
    { name: 'definition relations', fields: { definitionPairs: [{ sourceLabel: '1', targetLabel: 'a' }] } },
    { name: 'hidden acquisition evidence', fields: { evidence: { kind: 'cached' } } },
  ].map(test => it({ name: `rejects ${test.name} smuggled into singleton dispatch`, fn: async () => {
    const f = qualificationFixture({ sourceText: '猫。', targetText: 'Cat.' });
    const prepared = { kind: 'implicit' as const, findings: [], definitionPairs: [], ...test.fields };
    expect(qualificationFailure(() => qualifyPreparedBlockPairing({ ...f.input, prepared }))).toBe('fast-path');
  } })),
  it({ name: 'refuses acquired evidence when current blocks require a zero-question path', fn: async () => {
    const f = qualificationFixture();
    const prepared = await prepareBlockPairing(f.input);
    const singleton = qualificationFixture({ sourceText: '猫。', targetText: 'Cat.' });
    expect(qualificationFailure(() => qualifyPreparedBlockPairing({ ...singleton.input, prepared }))).toBe('fast-path');
  } }),
  it({ name: 'binds the evidence to the current question rather than only block counts', fn: async () => {
    const f = qualificationFixture();
    const prepared = await prepareBlockPairing(f.input);
    const changed = qualificationFixture({ sourceText: '猫醒了。\n\n它喜欢盒子。' });
    expect(qualificationFailure(() => qualifyPreparedBlockPairing({ ...changed.input, prepared }))).toBe('question');
  } }),
  ...[
    { name: 'heard count', fields: { heard: 99 } },
    { name: 'usable count', fields: { usable: 99 } },
    { name: 'cache flag', fields: { cacheEligible: false } },
    { name: 'relations', fields: { pairs: [{ source: 0, target: 1 }] } },
    { name: 'findings', fields: { findings: ['invented aggregate finding'] } },
  ].map(test => it({ name: `rejects forged ${test.name} instead of trusting supplied aggregates`, fn: async () => {
    const f = qualificationFixture();
    const prepared = await prepareBlockPairing(f.input);
    if (prepared.kind !== 'paired' || prepared.evidence.kind !== 'queried') throw new Error('expected current acquisition');
    const changed = { ...prepared, evidence: { ...prepared.evidence, outcome: { ...prepared.evidence.outcome, ...test.fields } } };
    expect(qualificationFailure(() => qualifyPreparedBlockPairing({ ...f.input, prepared: changed }))).toBe('result');
  } })),
  ...[
    { name: 'slicing relations', fields: { pairs: [] } },
    { name: 'definition handoff', fields: { definitionPairs: [{ sourceLabel: '1', targetLabel: 'x' }] } },
    { name: 'fallback disposition', fields: { kind: 'fallback' as const } },
  ].map(test => it({ name: `rejects inconsistent ${test.name} after replaying current evidence`, fn: async () => {
    const f = qualificationFixture();
    const prepared = await prepareBlockPairing(f.input);
    if (prepared.kind !== 'paired') throw new Error('expected explicit pairing');
    expect(qualificationFailure(() => qualifyPreparedBlockPairing({ ...f.input, prepared: { ...prepared, ...test.fields } }))).toBe('result');
  } })),
  it({ name: 'keeps definition provenance alongside the actual production slicing map', fn: async () => {
    const f = qualificationFixture({ sourceText: '[^1]: 猫。\n\n[^2]: 盒子。', targetText: '[^a]: Cat.\n\n[^b]: Box.' });
    const prepared = await prepareBlockPairing(f.input);
    const result = qualifyPreparedBlockPairing({ ...f.input, prepared });
    expect(result.kind).toBe('queried');
    if (result.kind !== 'queried') throw new Error('expected current definition evidence');
    expect(result.prepared.definitionPairs).toEqual([{ sourceLabel: '1', targetLabel: 'a' }, { sourceLabel: '2', targetLabel: 'b' }]);
    expect(result.relations).toHaveLength(2);
    expect(result.targetDeclines).toEqual([]);
  } }),
  it({ name: 'does not silently repair crossed agreement or promote it before footnote normalization', fn: async () => {
    const f = qualificationFixture({ sourceText: '[^1]: 猫。\n\n[^2]: 盒子。', targetText: '[^b]: Box.\n\n[^a]: Cat.',
      replies: ['{"pairs":[{"source":0,"target":1},{"source":1,"target":0}]}'] });
    const prepared = await prepareBlockPairing(f.input);
    expect(qualificationFailure(() => qualifyPreparedBlockPairing({ ...f.input, prepared }))).toBe('unclaimed-target');
  } }),
  it({ name: 'retains an owned evidence snapshot after the caller mutates the original result', fn: async () => {
    const f = qualificationFixture();
    const prepared = await prepareBlockPairing(f.input);
    const result = qualifyPreparedBlockPairing({ ...f.input, prepared });
    expect(result.kind).toBe('queried');
    if (result.kind !== 'queried' || prepared.kind !== 'paired' || prepared.evidence.kind !== 'queried') throw new Error('expected current evidence');
    const originalFindings = [...prepared.findings];
    // Deliberately violate the caller's readonly type to verify the retained journal owns its data.
    const mutableFindings = prepared.findings as string[];
    mutableFindings.push('later caller mutation');
    expect(result.prepared.findings).toEqual(originalFindings);
    expect(result.prepared).not.toBe(prepared);
    expect(result.outcome.outcomes).not.toBe(prepared.evidence.outcome.outcomes);
    expect(result.modelIds).not.toBe(QUALIFICATION_ROSTER);
  } }),
  it({ name: 'keeps the independent-seat guard on both zero-question and queried inputs', fn: async () => {
    const f = qualificationFixture({ sourceText: '猫。', targetText: 'Cat.' });
    const prepared = await prepareBlockPairing(f.input);
    expect(() => qualifyPreparedBlockPairing({ ...f.input, prepared, modelIds: [] })).toThrow(PairingEvidenceError);
    expect(() => qualifyPreparedBlockPairing({ ...f.input, prepared, modelIds: [QUALIFICATION_ROSTER[0], QUALIFICATION_ROSTER[0]] })).toThrow(PairingEvidenceError);
    const questioned = qualificationFixture();
    const acquired = await prepareBlockPairing(questioned.input);
    expect(() => qualifyPreparedBlockPairing({ ...questioned.input, prepared: acquired,
      modelIds: [QUALIFICATION_ROSTER[0], QUALIFICATION_ROSTER[0]] })).toThrow(PairingEvidenceError);
  } }),
] });
