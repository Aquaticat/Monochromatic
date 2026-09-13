import { describe, expect, it, } from '@monochromatic-dev/module-test/ts';
import {
  hashContent, qualifyPreparedBlockPairing, readPreparationDefinitionRelations, relabelArchiveFootnotes,
  PreparationQualificationError, PreparationReceiptError,
  type PreparationDefinitionDomain, type RosterModelId,
} from '../dist/final/node/index.mjs';
import { QUALIFICATION_ROSTER, } from './qualified-block-pairing.test-fixture.ts';
import { receiptFixture, } from './preparation-receipt.test-fixture.ts';

const sourceText = 'Body[^1].\n\n[^1]: First note.\n\n[^2]: Second note.';
const targetText = 'Unpaired archive body.[^7]\n\n[^7]: Older note.\n\n[^8]: Other note.';
const reply = '{"pairs":[{"source":1,"target":1},{"source":2,"target":2}]}';
const domain: PreparationDefinitionDomain = { sourceIds: ['block/1', 'block/2'], targetIds: ['block/1', 'block/2'] };

function refusal(run: () => unknown): string {
  try {
    run();
    return 'no-refusal';
  }
  catch (error) {
    if (error instanceof PreparationQualificationError) return `qualification:${error.kind}`;
    if (error instanceof PreparationReceiptError) return `receipt:${error.kind}`;
    throw error;
  }
}

async function acquire({ replies = [reply], modelIds = QUALIFICATION_ROSTER, sourceText: original = sourceText, targetText: archive = targetText,
  pairIndex = 0, registeredDomain = domain }: {
  readonly replies?: readonly string[];
  readonly modelIds?: readonly RosterModelId[];
  readonly sourceText?: string;
  readonly targetText?: string;
  readonly pairIndex?: number;
  readonly registeredDomain?: PreparationDefinitionDomain;
} = {}) {
  const fixture = await receiptFixture({ sourceText: original, targetText: archive, replies, modelIds: [...modelIds], pairIndex });
  const {prepared} = fixture;
  if (((prepared.kind !== 'paired') && (prepared.kind !== 'fallback')) || (prepared.evidence.kind !== 'queried')) throw new Error('expected native queried fixture');
  const input = { registration: { occurrence: structuredClone(fixture.expected), domain: structuredClone(registeredDomain) },
    receipt: fixture.receipt, sourceText: original, targetText: archive, l: fixture.input.l };
  return { fixture, prepared, input, evidence: prepared.evidence };
}

await describe({ name: '', children: [describe({ name: readPreparationDefinitionRelations.name, children: [
  it({ name: 'binds current definition endorsements to a receipt occurrence without qualifying unrelated body coverage', fn: async () => {
    const { fixture, prepared, input } = await acquire();
    expect(refusal(() => qualifyPreparedBlockPairing({ ...fixture.input, prepared }))).toBe('qualification:unclaimed-target');
    const result = readPreparationDefinitionRelations(input);
    expect(result).toEqual({ qualification: 'pairing-only', scope: 'footnote-definitions', occurrence: input.registration.occurrence,
      questionKey: prepared.evidence.key, modelIds: fixture.input.modelIds, requiredUsable: 1, usable: 2, domain,
      definitionRelations: [
        { source: { nodeId: 'block/1', blockIndex: 1, label: '1' }, target: { nodeId: 'block/1', blockIndex: 1, label: '7' }, authority: 'independent-endorsement' },
        { source: { nodeId: 'block/2', blockIndex: 2, label: '2' }, target: { nodeId: 'block/2', blockIndex: 2, label: '8' }, authority: 'independent-endorsement' },
      ] });
    expect(Object.keys(result).toSorted()).toEqual(['definitionRelations', 'domain', 'modelIds', 'occurrence', 'qualification', 'questionKey', 'requiredUsable', 'scope', 'usable']);
    expect(result.definitionRelations.every(item => result.domain.sourceIds.includes(item.source.nodeId) && result.domain.targetIds.includes(item.target.nodeId))).toBe(true);
    expect(fixture.calls).toHaveLength(2);
  } }),
  it({ name: 'feeds only deterministic footnote relabel and refuses old receipt data after the question changes', fn: async () => {
    const { input, fixture } = await acquire();
    const evidence = readPreparationDefinitionRelations(input);
    const relabel = relabelArchiveFootnotes({ entryId: 'definition-only-fixture', sourceText, archiveText: targetText, slices: [],
      definitionPairs: evidence.definitionRelations.map(item => ({ sourceLabel: item.source.label, targetLabel: item.target.label })), l: input.l });
    expect(relabel.changed).toBe(true);
    expect(relabel.archiveText).toBe('Unpaired archive body.[^1]\n\n[^1]: Older note.\n\n[^2]: Other note.');
    const registration = { ...input.registration, occurrence: { ...input.registration.occurrence, targetHash: hashContent({ content: relabel.archiveText }) } };
    expect(refusal(() => readPreparationDefinitionRelations({ ...input, registration, targetText: relabel.archiveText }))).toBe('receipt:question');
    expect(fixture.calls).toHaveLength(2);
    const fresh = await acquire({ targetText: relabel.archiveText });
    const result = readPreparationDefinitionRelations(fresh.input);
    expect(result.definitionRelations.map(item => [item.source.label, item.target.label])).toEqual([['1', '1'], ['2', '2']]);
    expect(result.occurrence.targetHash).toBe(hashContent({ content: relabel.archiveText }));
    expect(refusal(() => qualifyPreparedBlockPairing({ ...fresh.fixture.input, prepared: fresh.prepared }))).toBe('qualification:unclaimed-target');
    expect(fresh.fixture.calls).toHaveLength(2);
  } }),
  it({ name: 'projects only definitions even when native body relations are endorsed', fn: async () => {
    const { input } = await acquire({ replies: ['{"pairs":[{"source":0,"target":0},{"source":1,"target":1},{"source":2,"target":2}]}'] });
    const [outcome] = await Promise.allSettled([(async () => readPreparationDefinitionRelations(input))()]);
    expect(outcome?.status).toBe('fulfilled');
    if (outcome?.status !== 'fulfilled') throw new Error('expected definition-only projection');
    expect(outcome.value.definitionRelations.map(item => item.source.blockIndex)).toEqual([1, 2]);
  } }),
  it({ name: 'retains a partial definition endorsement without inventing its unmatched counterpart', fn: async () => {
    const { input } = await acquire({ replies: ['{"pairs":[{"source":1,"target":1}]}'] });
    const result = readPreparationDefinitionRelations(input);
    expect(result.definitionRelations).toEqual([
      { source: { nodeId: 'block/1', blockIndex: 1, label: '1' }, target: { nodeId: 'block/1', blockIndex: 1, label: '7' }, authority: 'independent-endorsement' },
    ]);
    expect(result.domain).toEqual(domain);
  } }),
  it({ name: 'retains native crossing-definition agreement without restoring a dropped edge', fn: async () => {
    const { input, evidence } = await acquire({ replies: ['{"pairs":[{"source":1,"target":2},{"source":2,"target":1}]}'] });
    expect(evidence.outcome.usable).toBe(2);
    const result = readPreparationDefinitionRelations(input);
    expect(result.definitionRelations).toEqual([
      { source: { nodeId: 'block/1', blockIndex: 1, label: '1' }, target: { nodeId: 'block/2', blockIndex: 2, label: '8' }, authority: 'independent-endorsement' },
    ]);
  } }),
  it({ name: 'rejects mixed definition-body wires rather than promoting their remaining relations', fn: async () => {
    const { input, evidence } = await acquire({ replies: ['{"pairs":[{"source":0,"target":0},{"source":1,"target":0},{"source":2,"target":2}]}'] });
    expect(evidence.outcome.usable).toBe(0);
    expect(refusal(() => readPreparationDefinitionRelations(input))).toBe('qualification:usable-quorum');
  } }),
  it({ name: 'requires configured usable quorum despite heard-invalid and unreachable voices', fn: async () => {
    // The Synthetic-only adapter cannot serve MiniMax; its configured seat still belongs to the denominator.
    const { input, evidence } = await acquire({ modelIds: [...QUALIFICATION_ROSTER, 'hf:moonshotai/Kimi-K3', 'hf:openai/gpt-oss-120b', 'minimax-m3'],
      replies: [reply, '{"pairs":[{"source":99,"target":99}]}'] });
    expect(evidence.outcome.usable).toBeLessThan(3);
    expect(refusal(() => readPreparationDefinitionRelations(input))).toBe('qualification:usable-quorum');
  } }),
  it({ name: 'requires two endorsing models rather than merely the one-usable-reply quorum', fn: async () => {
    const { input } = await acquire({ replies: [reply, '{"pairs":[]}'] });
    const result = readPreparationDefinitionRelations(input);
    expect(result.usable).toBe(2);
    expect(result.definitionRelations).toEqual([]);
  } }),
  it({ name: 'does not invent equal-spelling identities from an empty endorsed set', fn: async () => {
    const { input } = await acquire({ replies: ['{"pairs":[]}'], targetText: sourceText });
    expect(readPreparationDefinitionRelations(input).definitionRelations).toEqual([]);
  } }),
  ...(['source', 'target'] as const).map(side => it({ name: `retains ${side}-only definition inventory without inventing counterpart definitions`, fn: async () => {
    const body = 'First body.\n\nSecond body.';
    const { input } = await acquire({ sourceText: side === 'source' ? sourceText : body, targetText: side === 'target' ? targetText : body,
      replies: ['{"pairs":[{"source":0,"target":0}]}'], registeredDomain: { sourceIds: side === 'source' ? domain.sourceIds : [], targetIds: side === 'target' ? domain.targetIds : [] } });
    const result = readPreparationDefinitionRelations(input);
    expect(result.definitionRelations).toEqual([]);
    expect(result.domain).toEqual({ sourceIds: side === 'source' ? ['block/1', 'block/2'] : [], targetIds: side === 'target' ? ['block/1', 'block/2'] : [] });
  } })),
  it({ name: 'refuses a body-only question instead of returning meaningless definition qualification', fn: async () => {
    const { input } = await acquire({ sourceText: 'First body.\n\nSecond body.', targetText: 'First archive.\n\nSecond archive.',
      replies: ['{"pairs":[{"source":0,"target":0},{"source":1,"target":1}]}'], registeredDomain: { sourceIds: [], targetIds: [] } });
    expect(refusal(() => readPreparationDefinitionRelations(input))).toBe('qualification:definition-domain-empty');
  } }),
  ...[
    { sourceIds: [], targetIds: domain.targetIds },
    { sourceIds: ['block/1', 'block/1'], targetIds: domain.targetIds },
    { sourceIds: ['block/0', 'block/2'], targetIds: domain.targetIds },
    { sourceIds: ['block/2', 'block/1'], targetIds: domain.targetIds },
    { sourceIds: domain.sourceIds, targetIds: ['foreign/1', 'block/2'] },
    { ...domain, bodyAuthority: true },
  ].map((changed, index) => it({ name: `refuses a changed independently registered current definition domain ${index}`, fn: async () => {
    const { input } = await acquire();
    expect(refusal(() => readPreparationDefinitionRelations({ ...input, registration: { ...input.registration, domain: changed } }))).toBe('qualification:definition-domain');
  } })),
  ...(['attemptId', 'receiptId', 'requestConfigurationDigest'] as const).map(field => it({ name: `refuses a foreign receipt ${field} instead of adopting its identity`, fn: async () => {
    const { input } = await acquire();
    const receipt = { ...input.receipt, binding: { ...input.receipt.binding, [field]: 'foreign' } };
    expect(refusal(() => readPreparationDefinitionRelations({ ...input, receipt }))).toBe('receipt:binding');
  } })),
  it({ name: 'refuses partial receipt data and historical cache-shaped data', fn: async () => {
    const { input } = await acquire();
    expect(refusal(() => readPreparationDefinitionRelations({ ...input, receipt: { ...input.receipt, state: 'partial' } }))).toBe('receipt:state');
    expect(refusal(() => readPreparationDefinitionRelations({ ...input, receipt: { cacheKey: 'old', record: { pairs: [], findings: [] } } }))).toBe('receipt:state');
  } }),
  ...(['sourceText', 'targetText'] as const).map(side => it({ name: `binds identical local questions to registered complete ${side}`, fn: async () => {
    const preface = '# Context\n\nFirst preface.\n\n# Work\n\n';
    const { fixture, input } = await acquire({ sourceText: preface + sourceText, targetText: preface + targetText, pairIndex: 1,
      replies: ['{"pairs":[{"source":2,"target":2},{"source":3,"target":3}]}'], registeredDomain: { sourceIds: ['block/4', 'block/5'], targetIds: ['block/4', 'block/5'] } });
    const before = readPreparationDefinitionRelations(input);
    expect(before.occurrence.pairIndex).toBe(1);
    const foreign = input[side].replace('First preface.', 'Other preface.');
    expect(refusal(() => readPreparationDefinitionRelations({ ...input, [side]: foreign }))).toBe('receipt:documents');
    expect(fixture.calls).toHaveLength(2);
  } })),
  it({ name: 'snapshots registration before a receipt accessor can alter caller-owned expectations', fn: async () => {
    const { input } = await acquire();
    const before = structuredClone(input.registration);
    const {question} = input.receipt;
    let reads = 0;
    const receipt = { ...input.receipt, get question() {
      reads += 1;
      (input.registration.domain.sourceIds as string[]).splice(0);
      Object.assign(input.registration.occurrence, { pairIndex: 99 });
      return question;
    } };
    const [outcome] = await Promise.allSettled([(async () => readPreparationDefinitionRelations({ ...input, receipt }))()]);
    expect(outcome?.status).toBe('fulfilled');
    if (outcome?.status !== 'fulfilled') throw new Error('expected snapshotted registration');
    expect(reads > 0).toBe(true);
    expect(outcome.value.occurrence).toEqual(before.occurrence);
    expect(outcome.value.domain).toEqual(before.domain);
  } }),
  it({ name: 'owns endpoint, occurrence, domain and electorate data after caller mutation', fn: async () => {
    const { input } = await acquire();
    const registeredModels = [...input.registration.occurrence.binding.modelIds];
    const result = readPreparationDefinitionRelations(input);
    const snapshot = structuredClone(result);
    (input.registration.domain.sourceIds as string[]).push('later-source');
    (input.registration.occurrence.binding.modelIds as RosterModelId[]).pop();
    (input.receipt.outcomes as unknown[]).splice(0);
    expect(result).toEqual(snapshot);
    expect(result.modelIds).toEqual(registeredModels);
    expect(result.occurrence.binding.modelIds).toEqual(registeredModels);
    const callerAfterMutation = structuredClone(input.registration);
    const receiptAfterMutation = structuredClone(input.receipt);
    (result.domain.targetIds as string[]).push('later-target');
    (result.modelIds as RosterModelId[]).pop();
    (result.occurrence.binding.modelIds as RosterModelId[]).pop();
    const sourceEndpoint = result.definitionRelations[0]?.source;
    expect(sourceEndpoint).toBeDefined();
    if (sourceEndpoint === undefined) throw new Error('expected owned endpoint witness');
    Object.assign(sourceEndpoint, { label: 'changed-output-label' });
    expect(input.registration).toEqual(callerAfterMutation);
    expect(input.receipt).toEqual(receiptAfterMutation);
  } }),
  ...(['singleton', 'empty-source', 'empty-target'] as const).map(kind => it({ name: `refuses ${kind} occurrence receipt manufacture`, fn: async () => {
    const { input, fixture } = await acquire();
    const source = kind === 'empty-source' ? '' : '[^1]: One note.';
    const target = kind === 'empty-target' ? '' : '[^7]: Another note.';
    const registration = { ...input.registration, occurrence: { ...input.registration.occurrence, sourceHash: hashContent({ content: source }), targetHash: hashContent({ content: target }) } };
    expect(refusal(() => readPreparationDefinitionRelations({ ...input, registration, sourceText: source, targetText: target }))).toBe('receipt:parent');
    expect(fixture.calls).toHaveLength(2);
  } })),
] })] });
