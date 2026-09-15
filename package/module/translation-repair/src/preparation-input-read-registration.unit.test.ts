import { describe, expect, it, } from '@monochromatic-dev/module-test/ts';
import {
  blockPairingProtocol,
  blockPairingQuestionKey,
  hashContent,
  type PreparationRootParentIdentity,
} from '../dist/final/node/index.mjs';
import { preparationInputRegistration, PreparationRootError, } from '../dist/final/node/preparation-input-read.mjs';

type Queried = Extract<ReturnType<typeof preparationInputRegistration>, { readonly dispatch: 'queried' }>;
const path = 'inputs.registry[0]';
function identity(): PreparationRootParentIdentity {
  return { parentId: 'Cat/source-section/2/target-section/7', entryId: 'Cat', roles: ['writer-parent', 'footnote-definitions'], sourceHash: 'a'.repeat(64), targetHash: 'b'.repeat(64), pairIndex: 0, sourceIndex: 2, targetIndex: 7, definitionDomain: { sourceIds: ['block/4'], targetIds: [] } };
}
function queried(): Queried {
  const sourceBlocks = [{ index: 0, text: 'Cat' }, { index: 1, text: 'Cat note' }];
  const targetBlocks = [{ index: 0, text: 'Chat' }, { index: 1, text: 'More chat' }];
  const question = { sourceBlocks, targetBlocks, protocol: blockPairingProtocol({ sourceBlocks, targetBlocks }) };
  return { ...identity(), dispatch: 'queried', question, questionKey: blockPairingQuestionKey(question), questionDigest: hashContent({ content: JSON.stringify(question) }), freeOrder: { source: [1], target: [] } };
}
function writerQuestion({ source, target }: { readonly source: readonly string[]; readonly target: readonly string[] }): Queried {
  const sourceBlocks = source.map((text, index) => ({ index, text }));
  const targetBlocks = target.map((text, index) => ({ index, text }));
  const question = { sourceBlocks, targetBlocks, protocol: blockPairingProtocol({ sourceBlocks, targetBlocks }) };
  return { ...identity(), roles: ['writer-parent'], definitionDomain: { sourceIds: [], targetIds: [] }, dispatch: 'queried', question, questionKey: blockPairingQuestionKey(question), questionDigest: hashContent({ content: JSON.stringify(question) }), freeOrder: { source: [], target: [] } };
}
function refused(value: unknown): PreparationRootError {
  try {
    preparationInputRegistration({ value, path });
  }
  catch (error) {
    expect(error).toBeInstanceOf(PreparationRootError);
    if (!(error instanceof PreparationRootError)) throw error;
    expect(error.message).not.toContain('q7z9k2');
    return error;
  }
  expect(false).toBe(true);
  throw new Error('Unreachable after missing-refusal assertion');
}

await describe({ name: 'complete persisted registration variants', children: [
  it({ name: 'rebuilds queried data with independent document and question identities', fn: async () => {
    const value = queried();
    const result = preparationInputRegistration({ value, path });
    expect(result).toEqual(value);
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.roles)).toBe(true);
    expect(Object.isFrozen(result.definitionDomain)).toBe(true);
    if (result.dispatch !== 'queried') throw new Error('Fixture requires queried data');
    expect(Object.isFrozen(result.question)).toBe(true);
    expect(Object.isFrozen(result.freeOrder.source)).toBe(true);
    expect(result.sourceHash).not.toBe(result.questionKey);
  } }),
  ...['empty', 'implicit'].map(dispatch => it({ name: `retains structural ${dispatch} without question or outcome fields`, fn: async () => {
    const value = { ...identity(), dispatch };
    const result = preparationInputRegistration({ value, path });
    expect(result).toEqual(value);
    expect(Object.isFrozen(result)).toBe(true);
    for (const key of ['question', 'questionKey', 'questionDigest', 'freeOrder', 'outcomes']) refused({ ...value, [key]: 'q7z9k2' });
  } })),
  ...Object.keys(queried()).map(key => it({ name: `requires queried registration ${key}`, fn: async () => {
    const value = queried();
    Reflect.deleteProperty(value, key);
    refused(value);
  } })),
  ...Object.keys(identity()).map(key => it({ name: `requires structural identity ${key}`, fn: async () => {
    const value = { ...identity(), dispatch: 'implicit' };
    Reflect.deleteProperty(value, key);
    refused(value);
  } })),
  it({ name: 'rejects unsupported dispatch, extra authority fields and noncanonical identity', fn: async () => {
    refused({ ...identity(), dispatch: 'fallback' });
    refused({ ...queried(), approval: true });
    refused({ ...queried(), parentId: 'Cat/source-section/02/target-section/7' });
    refused({ ...queried(), sourceIndex: 0 });
    refused({ ...queried(), targetIndex: 0 });
    refused({ ...queried(), pairIndex: -1 });
  } }),
  ...['sourceHash', 'targetHash', 'questionKey', 'questionDigest'].map(key => it({ name: `checks ${key} spelling`, fn: async () => {
    expect(refused({ ...queried(), [key]: 'q7z9k2' }).kind).toBe('input-shape');
  } })),
  ...['questionKey', 'questionDigest'].map(key => it({ name: `checks ${key} against the decoded native question`, fn: async () => {
    expect(refused({ ...queried(), [key]: 'f'.repeat(64) }).kind).toBe('input-relations');
  } })),
  it({ name: 'keeps writer-only and definition-only roles distinct', fn: async () => {
    const value = queried();
    const definitionOnly = { ...value, roles: ['footnote-definitions'] };
    expect(preparationInputRegistration({ value: definitionOnly, path })).toEqual(definitionOnly);
    const writerOnly = writerQuestion({ source: ['Cat'], target: ['Chat', 'More'] });
    expect(preparationInputRegistration({ value: writerOnly, path })).toEqual(writerOnly);
  } }),
  ...[[], ['writer-parent', 'writer-parent', 'footnote-definitions'], ['footnote-definitions', 'writer-parent'], ['writer-parent'], ['q7z9k2']].map((roles, index) => it({ name: `rejects inconsistent role fixture ${String(index)}`, fn: async () => {
    refused({ ...queried(), roles });
  } })),
  it({ name: 'rejects definition responsibility without a represented definition inventory', fn: async () => {
    refused({ ...queried(), definitionDomain: { sourceIds: [], targetIds: [] }, freeOrder: { source: [], target: [] } });
  } }),
  ...[
    { source: [], target: ['Chat', 'More'] },
    { source: ['Cat', 'More'], target: [] },
    { source: ['Cat'], target: ['Chat'] },
  ].map((sides, index) => it({ name: `refuses queried structural dispatch fixture ${String(index)}`, fn: async () => {
    expect(refused(writerQuestion(sides)).kind).toBe('input-relations');
  } })),
  it({ name: 'checks source order cardinality and local range against its own blocks', fn: async () => {
    const value = queried();
    refused({ ...value, freeOrder: { source: [], target: [] } });
    refused({ ...value, freeOrder: { source: [2], target: [] } });
    refused({ ...value, definitionDomain: { sourceIds: ['block/4', 'block/5'], targetIds: [] } });
  } }),
  it({ name: 'checks target order cardinality and local range independently', fn: async () => {
    const value = queried();
    const withTarget = { ...value, definitionDomain: { sourceIds: ['block/4'], targetIds: ['block/9'] }, freeOrder: { source: [1], target: [0] } };
    expect(preparationInputRegistration({ value: withTarget, path })).toEqual(withTarget);
    refused({ ...withTarget, freeOrder: { source: [1], target: [] } });
    refused({ ...withTarget, freeOrder: { source: [1], target: [2] } });
  } }),
  it({ name: 'retains distinct full questions even when the historical NUL key aliases them', fn: async () => {
    const first = writerQuestion({ source: ['Cat\u0000Dog', 'Owl'], target: ['Chat'] });
    const second = writerQuestion({ source: ['Cat', 'Dog\u0000Owl'], target: ['Chat'] });
    expect(first.questionKey).toBe(second.questionKey);
    expect(first.questionDigest).not.toBe(second.questionDigest);
    expect(preparationInputRegistration({ value: first, path })).toEqual(first);
    expect(preparationInputRegistration({ value: second, path })).toEqual(second);
  } }),
] });
