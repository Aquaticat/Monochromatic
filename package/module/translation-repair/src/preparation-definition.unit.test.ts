import { describe, expect, it, } from '@monochromatic-dev/module-test/ts';
import {
  prepareBlockPairing, qualifyPreparedBlockPairing, readPreparationDefinitionRelations, PreparationQualificationError,
  type PreparationDefinitionDomain, type PreparationQualificationFailure, type RosterModelId,
} from '../dist/final/node/index.mjs';
import { QUALIFICATION_ROSTER, qualificationFixture, } from './qualified-block-pairing.test-fixture.ts';

const sourceText = 'Body[^1].\n\n[^1]: First note.\n\n[^2]: Second note.';
const targetText = 'Unpaired archive body.[^7]\n\n[^7]: Older note.\n\n[^8]: Other note.';
const reply = '{"pairs":[{"source":1,"target":1},{"source":2,"target":2}]}';
const domain: PreparationDefinitionDomain = { sourceIds: ['block/1', 'block/2'], targetIds: ['block/1', 'block/2'] };

function refusal(run: () => unknown): PreparationQualificationFailure | 'no-refusal' {
  try {
    run();
    return 'no-refusal';
  }
  catch (error) {
    if (!(error instanceof PreparationQualificationError)) throw error;
    return error.kind;
  }
}

async function acquire({ replies = [reply], modelIds = QUALIFICATION_ROSTER, targetText: archiveText = targetText }: {
  readonly replies?: readonly string[];
  readonly modelIds?: readonly RosterModelId[];
  readonly targetText?: string;
} = {}) {
  const fixture = qualificationFixture({ sourceText, targetText: archiveText, replies, modelIds: [...modelIds] });
  const prepared = await prepareBlockPairing(fixture.input);
  if ((prepared.kind !== 'paired' && prepared.kind !== 'fallback') || prepared.evidence.kind !== 'queried') throw new Error('expected actual questioned preparation');
  const input = { pair: fixture.input.pair, evidence: prepared.evidence, modelIds: fixture.input.modelIds, domain: structuredClone(domain), l: fixture.input.l };
  return { fixture, prepared, input };
}

await describe({ name: '', children: [describe({ name: readPreparationDefinitionRelations.name, children: [
  it({ name: 'qualifies current definition endorsements without qualifying unrelated body coverage', fn: async () => {
    const { fixture, prepared, input } = await acquire();
    expect(fixture.calls).toHaveLength(2);
    expect(refusal(() => qualifyPreparedBlockPairing({ ...fixture.input, prepared }))).toBe('unclaimed-target');
    const result = readPreparationDefinitionRelations(input);
    expect(result).toEqual({ qualification: 'pairing-only', scope: 'footnote-definitions', questionKey: input.evidence.key,
      modelIds: input.modelIds, requiredUsable: 1, usable: 2, domain,
      definitionRelations: [
        { source: { nodeId: 'block/1', blockIndex: 1, label: '1' }, target: { nodeId: 'block/1', blockIndex: 1, label: '7' }, authority: 'independent-endorsement' },
        { source: { nodeId: 'block/2', blockIndex: 2, label: '2' }, target: { nodeId: 'block/2', blockIndex: 2, label: '8' }, authority: 'independent-endorsement' },
      ] });
    expect(Object.keys(result).toSorted()).toEqual(['definitionRelations', 'domain', 'modelIds', 'qualification', 'questionKey', 'requiredUsable', 'scope', 'usable']);
    expect(fixture.calls).toHaveLength(2);
  } }),
  it({ name: 'projects only definition endpoints even when body relations are independently endorsed', fn: async () => {
    const { input } = await acquire({ replies: ['{"pairs":[{"source":0,"target":0},{"source":1,"target":1},{"source":2,"target":2}]}'] });
    const result = readPreparationDefinitionRelations(input);
    expect(result.definitionRelations).toHaveLength(2);
    expect(result.definitionRelations.map(item => item.source.blockIndex)).toEqual([1, 2]);
  } }),
  it({ name: 'rejects definition-to-body wires rather than promoting their remaining relations', fn: async () => {
    const { input } = await acquire({ replies: ['{"pairs":[{"source":0,"target":0},{"source":1,"target":0},{"source":2,"target":2}]}'] });
    expect(input.evidence.outcome.usable).toBe(0);
    expect(refusal(() => readPreparationDefinitionRelations(input))).toBe('usable-quorum');
  } }),
  it({ name: 'requires configured usable quorum despite heard-invalid and unreachable voices', fn: async () => {
    // The Synthetic-only fixture cannot serve the MiniMax endpoint; the configured denominator still includes it.
    const { input } = await acquire({ modelIds: [...QUALIFICATION_ROSTER, 'hf:moonshotai/Kimi-K3', 'hf:openai/gpt-oss-120b', 'minimax-m3'],
      replies: [reply, '{"pairs":[{"source":99,"target":99}]}'] });
    expect(input.evidence.outcome.usable).toBeLessThan(3);
    expect(refusal(() => readPreparationDefinitionRelations(input))).toBe('usable-quorum');
  } }),
  it({ name: 'requires two model endorsements even when configured usable quorum is one', fn: async () => {
    const { input } = await acquire({ replies: [reply, '{"pairs":[]}'] });
    const result = readPreparationDefinitionRelations(input);
    expect(result.usable).toBe(2);
    expect(result.definitionRelations).toEqual([]);
  } }),
  it({ name: 'retains an empty endorsed set without inventing equal-spelling identity or body authority', fn: async () => {
    const { input } = await acquire({ replies: ['{"pairs":[]}'], targetText: sourceText });
    expect(readPreparationDefinitionRelations(input).definitionRelations).toEqual([]);
  } }),
  ...[
    { sourceIds: [], targetIds: domain.targetIds },
    { sourceIds: ['block/1', 'block/1'], targetIds: domain.targetIds },
    { sourceIds: ['block/0', 'block/2'], targetIds: domain.targetIds },
    { sourceIds: ['block/2', 'block/1'], targetIds: domain.targetIds },
    { sourceIds: domain.sourceIds, targetIds: ['foreign/1', 'block/2'] },
    { ...domain, bodyAuthority: true },
  ].map((changed, index) => it({ name: `refuses a widened, narrowed or reordered registered definition domain ${index}`, fn: async () => {
    const { input } = await acquire();
    expect(refusal(() => readPreparationDefinitionRelations({ ...input, domain: changed }))).toBe('definition-domain');
  } })),
  it({ name: 'refuses cached records rather than manufacturing current usable replies', fn: async () => {
    const { input } = await acquire();
    expect(refusal(() => readPreparationDefinitionRelations({ ...input, evidence: { kind: 'cached', key: input.evidence.key, record: { pairs: [], findings: [] } } }))).toBe('historical-cache');
  } }),
  it({ name: 'replays and compares the aggregate rather than trusting a definition-only summary', fn: async () => {
    const { input } = await acquire();
    const changed = structuredClone(input.evidence);
    expect(refusal(() => readPreparationDefinitionRelations({ ...input, evidence: { ...changed, outcome: { ...changed.outcome, usable: 0 } } }))).toBe('result');
    expect(refusal(() => readPreparationDefinitionRelations({ ...input, evidence: { ...changed, key: 'foreign-question' } }))).toBe('question');
  } }),
  it({ name: 'refuses a definition-zone endpoint without a parser-readable opening label', fn: async () => {
    const fixture = qualificationFixture({ sourceText, targetText, replies: [reply] });
    const pair = { ...fixture.input.pair, source: { ...fixture.input.pair.source,
      nodes: fixture.input.pair.source.nodes.map((node, index) => index === 1 ? { ...node, text: 'missing definition opener' } : node) } };
    const prepared = await prepareBlockPairing({ ...fixture.input, pair });
    if ((prepared.kind !== 'paired' && prepared.kind !== 'fallback') || prepared.evidence.kind !== 'queried') throw new Error('expected questioned malformed-label fixture');
    expect(refusal(() => readPreparationDefinitionRelations({ pair, evidence: prepared.evidence, modelIds: fixture.input.modelIds, domain, l: fixture.input.l }))).toBe('definition-label');
  } }),
  it({ name: 'refuses an endpoint removed by an evidence accessor after current numbering', fn: async () => {
    const { input } = await acquire();
    const nodes = [...input.pair.source.nodes];
    let reads = 0;
    const evidence = new Proxy(input.evidence, { get(target, property, receiver) {
      if (property === 'outcome') {
        reads += 1;
        if (reads === 2) delete nodes[1];
      }
      return Reflect.get(target, property, receiver);
    } });
    const pair = { ...input.pair, source: { ...input.pair.source, nodes } };
    expect(refusal(() => readPreparationDefinitionRelations({ ...input, pair, evidence }))).toBe('definition-domain');
    expect(reads).toBe(2);
  } }),
  it({ name: 'owns projected endpoint, domain and electorate data independently of caller mutation', fn: async () => {
    const { input } = await acquire();
    const result = readPreparationDefinitionRelations(input);
    const snapshot = structuredClone(result);
    (input.domain.sourceIds as string[]).push('later-source');
    (input.modelIds as RosterModelId[]).pop();
    (input.evidence.outcome.pairs as { source: number; target: number }[]).splice(0);
    expect(result).toEqual(snapshot);
    (result.domain.targetIds as string[]).push('later-target');
    expect(input.domain.targetIds).toEqual(domain.targetIds);
  } }),
  it({ name: 'refuses singleton question manufacture while native preparation buys no call', fn: async () => {
    const { input } = await acquire();
    const singleton = qualificationFixture({ sourceText: '[^1]: One note.', targetText: '[^7]: Another note.' });
    expect((await prepareBlockPairing(singleton.input)).kind).toBe('implicit');
    expect(singleton.calls).toEqual([]);
    expect(refusal(() => readPreparationDefinitionRelations({ ...input, pair: singleton.input.pair }))).toBe('definition-question');
  } }),
  ...(['source', 'target'] as const).map(side => it({ name: `refuses question manufacture for an empty ${side} side`, fn: async () => {
    const { input } = await acquire();
    const pair = { ...input.pair, [side]: { ...input.pair[side], nodes: [] } };
    expect(refusal(() => readPreparationDefinitionRelations({ ...input, pair }))).toBe('definition-question');
  } })),
] })] });
