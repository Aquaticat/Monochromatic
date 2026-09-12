import { describe, expect, it, } from '@monochromatic-dev/module-test/ts';
import { prepareBlockPairing, qualifyPreparedBlockPairing, } from '../dist/final/node/index.mjs';
import { COMPLETE_PAIRING_REPLY, QUALIFICATION_ROSTER, qualificationFailure, qualificationFixture, } from './qualified-block-pairing.test-fixture.ts';

const widerRoster = [...QUALIFICATION_ROSTER, 'hf:moonshotai/Kimi-K3', 'hf:openai/gpt-oss-120b', 'glm-5.3',] as const;

await describe({ name: qualifyPreparedBlockPairing.name, children: [
  it({ name: 'qualifies actual current client outcomes without buying another call', fn: async () => {
    const f = qualificationFixture();
    const prepared = await prepareBlockPairing(f.input,);
    const result = qualifyPreparedBlockPairing({ ...f.input, prepared, },);
    expect(result.kind,).toBe('queried');
    if (result.kind !== 'queried') throw new Error('expected queried evidence');
    expect(f.calls,).toHaveLength(2);
    expect(result.prepared,).toEqual(prepared);
    expect(result.modelIds,).toEqual(QUALIFICATION_ROSTER);
    expect(result.requiredUsable,).toBe(1);
    expect(result.outcome.usable,).toBe(2);
    expect(result.relations,).toEqual([
      { source: 0, target: 0, authority: 'independent-endorsement' },
      { source: 1, target: 1, authority: 'independent-endorsement' },
    ]);
    expect(result.sourceInsertions,).toEqual([]);
    expect(result.targetDeclines,).toEqual([]);
  }, },),
  it({ name: 'rejects historical cache even when its stored relations match the current question', fn: async () => {
    const f = qualificationFixture();
    const prepared = await prepareBlockPairing(f.input,);
    if (prepared.kind !== 'paired') throw new Error('expected explicit pairing');
    const historical = { ...prepared, evidence: { kind: 'cached' as const, key: prepared.evidence.key,
      record: { pairs: prepared.pairs, findings: prepared.findings } } };
    expect(qualificationFailure(() => qualifyPreparedBlockPairing({ ...f.input, prepared: historical })),).toBe('historical-cache');
    expect(f.calls,).toHaveLength(2);
  }, },),
  it({ name: 'uses the configured denominator rather than the heard subset', fn: async () => {
    const f = qualificationFixture();
    const prepared = await prepareBlockPairing(f.input,);
    expect(qualificationFailure(() => qualifyPreparedBlockPairing({ ...f.input, modelIds: widerRoster, prepared })),).toBe('usable-quorum');
  }, },),
  it({ name: 'requires usable replies rather than schema-valid heard replies', fn: async () => {
    const f = qualificationFixture({ modelIds: widerRoster,
      replies: [COMPLETE_PAIRING_REPLY, COMPLETE_PAIRING_REPLY, '{"pairs":[{"source":99,"target":0}]}'] });
    const prepared = await prepareBlockPairing(f.input,);
    if (prepared.kind !== 'paired' || prepared.evidence.kind !== 'queried') throw new Error('expected current partial usability');
    expect(prepared.evidence.outcome.heard,).toBe(5);
    expect(prepared.evidence.outcome.usable,).toBe(2);
    expect(qualificationFailure(() => qualifyPreparedBlockPairing({ ...f.input, prepared })),).toBe('usable-quorum');
  }, },),
  it({ name: 'does not qualify a cache-eligible empty agreement as correspondence', fn: async () => {
    const f = qualificationFixture({ replies: ['{"pairs":[]}'] });
    const prepared = await prepareBlockPairing(f.input,);
    if (prepared.kind !== 'fallback' || prepared.evidence.kind !== 'queried') throw new Error('expected current fallback');
    expect(prepared.evidence.outcome.cacheEligible,).toBe(true);
    expect(prepared.evidence.outcome.usable,).toBe(2);
    expect(qualificationFailure(() => qualifyPreparedBlockPairing({ ...f.input, prepared })),).toBe('fallback');
  }, },),
  it({ name: 'does not manufacture two endorsements from a single configured identity', fn: async () => {
    const f = qualificationFixture({ modelIds: [QUALIFICATION_ROSTER[0]] });
    const prepared = await prepareBlockPairing(f.input,);
    expect(qualificationFailure(() => qualifyPreparedBlockPairing({ ...f.input, prepared })),).toBe('fallback');
    expect(f.calls,).toHaveLength(1);
  }, },),
  it({ name: 'retains unplaced originals as source insertions when every archive block is claimed', fn: async () => {
    const f = qualificationFixture({ targetText: 'The cat slept.', replies: ['{"pairs":[{"source":0,"target":0}]}'] });
    const prepared = await prepareBlockPairing(f.input,);
    const result = qualifyPreparedBlockPairing({ ...f.input, prepared });
    expect(result.kind,).toBe('queried');
    if (result.kind !== 'queried') throw new Error('expected insertion qualification');
    expect(result.sourceInsertions,).toEqual([f.input.pair.source.nodes[1]?.id]);
    expect(result.targetDeclines,).toEqual([]);
  }, },),
  it({ name: 'refuses unclaimed archive scope while any original remains unplaced', fn: async () => {
    const f = qualificationFixture({ replies: ['{"pairs":[{"source":0,"target":0}]}'] });
    const prepared = await prepareBlockPairing(f.input,);
    if (prepared.kind !== 'paired' || prepared.evidence.kind !== 'queried') throw new Error('expected partial current pairing');
    expect(prepared.evidence.outcome.cacheEligible,).toBe(true);
    expect(qualificationFailure(() => qualifyPreparedBlockPairing({ ...f.input, prepared })),).toBe('unclaimed-target');
  }, },),
  it({ name: 'retains policy-backed target declines despite an unendorsed relation making the result uncacheable', fn: async () => {
    const f = qualificationFixture({ targetText: 'The cat slept.\n\nShe loves boxes.\n\nA spare archive note.', replies: [
      '{"pairs":[{"source":0,"target":0},{"source":1,"target":1},{"source":1,"target":2}]}',
      COMPLETE_PAIRING_REPLY,
    ] });
    const prepared = await prepareBlockPairing(f.input,);
    const result = qualifyPreparedBlockPairing({ ...f.input, prepared });
    expect(result.kind,).toBe('queried');
    if (result.kind !== 'queried') throw new Error('expected policy-backed decline');
    expect(result.outcome.cacheEligible,).toBe(false);
    expect(result.targetDeclines,).toEqual([f.input.pair.target.nodes[2]?.id]);
    expect(result.sourceInsertions,).toEqual([]);
    expect(result.relations,).toHaveLength(2);
  }, },),
  it({ name: 'does not invent endorsement for a retained gap inside a split rendering', fn: async () => {
    const f = qualificationFixture({ sourceText: '猫睡了。', targetText: 'The cat slept.\n\nAn intervening archive note.\n\nShe woke.',
      replies: ['{"pairs":[{"source":0,"target":0},{"source":0,"target":2}]}'] });
    const prepared = await prepareBlockPairing(f.input,);
    expect(qualificationFailure(() => qualifyPreparedBlockPairing({ ...f.input, prepared })),).toBe('unclaimed-target');
  }, },),
  it({ name: 'preserves independently endorsed many-to-many relations', fn: async () => {
    const f = qualificationFixture({ targetText: 'Cat.\n\nShared box.\n\nPillow.',
      replies: ['{"pairs":[{"source":0,"target":0},{"source":0,"target":1},{"source":1,"target":1},{"source":1,"target":2}]}'] });
    const prepared = await prepareBlockPairing(f.input,);
    const result = qualifyPreparedBlockPairing({ ...f.input, prepared });
    expect(result.kind,).toBe('queried');
    if (result.kind !== 'queried') throw new Error('expected many-to-many qualification');
    expect(result.relations,).toHaveLength(4);
    expect(result.relations.every(relation => relation.authority === 'independent-endorsement'),).toBe(true);
    expect(result.sourceInsertions,).toEqual([]);
    expect(result.targetDeclines,).toEqual([]);
  }, },),
  it({ name: 'records deterministic media ownership separately from the endorsed media anchor', fn: async () => {
    const token = ['$', '{path}'].join('');
    const marker = `<PhotoScroll photos={['${token}/photos/letter.webp']} />`;
    const f = qualificationFixture({ sourceText: `About the cat.\n\n${marker}\n\nRemember the cat.`,
      targetText: `About the cat.\n\n${marker}\n\n<details>\n<summary>Letter</summary>\n> Translated letter.\n</details>\n\nRemember the cat.`,
      replies: ['{"pairs":[{"source":0,"target":0},{"source":1,"target":1},{"source":2,"target":4}]}'] });
    const prepared = await prepareBlockPairing(f.input,);
    const result = qualifyPreparedBlockPairing({ ...f.input, prepared });
    expect(result.kind,).toBe('queried');
    if (result.kind !== 'queried') throw new Error('expected media ownership qualification');
    expect(result.relations.filter(relation => relation.source === 1),).toEqual([
      { source: 1, target: 1, authority: 'independent-endorsement' },
      { source: 1, target: 2, authority: 'deterministic-media-adjacency' },
      { source: 1, target: 3, authority: 'deterministic-media-adjacency' },
    ]);
    expect(result.targetDeclines,).toEqual([]);
    expect(f.calls,).toHaveLength(2);
  }, },),
], },);
