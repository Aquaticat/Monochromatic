import { describe, expect, it, } from '@monochromatic-dev/module-test/ts';
import {
  preparationInputObligation,
  preparationInputSelection,
  preparationInputSelectionParent,
  preparationInputSelectionReference,
  PreparationRootError,
} from '../dist/final/node/preparation-input-read.mjs';

const path = 'inputs.selection';
const parent = { parentId: 'Tabby/source-section/0/target-section/0', entryId: 'Tabby', sourceIndex: 0, targetIndex: 0 };
const obligation = { parentId: parent.parentId, requiredContext: ['Cat fixture source context.'], pictureEvidenceNeeded: false, scopeQualificationOpen: true };
const reference = { path: '/unopened/cat-note.json', hash: 'a'.repeat(64) };
const template = {
  scope: 'frozen-selection-identity' as const,
  digest: 'a'.repeat(64),
  bytes: 1,
  corpusCommitSha: 'b'.repeat(40),
  populationDigest: 'c'.repeat(64),
  poolDigest: 'd'.repeat(64),
  parents: [parent],
  references: [reference],
  obligations: [obligation],
  selectionRuntimeDigest: 'e'.repeat(64),
  samplerNodeVersion: 'v26.8.2',
  samplerIcuVersion: '78.3',
};

function fixture(): typeof template {
  return structuredClone(template);
}
function refused(fn: () => unknown): PreparationRootError {
  try {
    fn();
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

await describe({ name: 'persisted frozen selection projection', children: [
  it({ name: 'decodes and freezes complete projection without imposing current plan census', fn: async () => {
    const value = fixture();
    const result = preparationInputSelection({ value, path });
    expect(result).toEqual(value);
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.parents)).toBe(true);
    expect(Object.isFrozen(result.parents[0])).toBe(true);
    expect(Object.isFrozen(result.references[0])).toBe(true);
    expect(Object.isFrozen(result.obligations[0])).toBe(true);
    expect(Object.isFrozen(result.obligations[0]?.requiredContext)).toBe(true);
    const [changedParent] = value.parents;
    const [changedObligation] = value.obligations;
    if ((changedParent === undefined) || (changedObligation === undefined)) throw new Error('Expected complete selection fixture');
    changedParent.entryId = 'Changed';
    changedObligation.requiredContext.push('later caller note');
    expect(result.parents[0]?.entryId).toBe('Tabby');
    expect(result.obligations[0]?.requiredContext).toEqual(['Cat fixture source context.']);
  } }),
  ...Object.keys(template).map(key => it({ name: `requires selection field ${key}`, fn: async () => {
    const value = fixture();
    Reflect.deleteProperty(value, key);
    expect(refused(() => preparationInputSelection({ value, path })).kind).toBe('input-shape');
  } })),
  it({ name: 'refuses fabricated version or approval fields', fn: async () => {
    refused(() => preparationInputSelection({ value: { ...fixture(), version: 1 }, path }));
    refused(() => preparationInputSelection({ value: { ...fixture(), approved: 'q7z9k2' }, path }));
    refused(() => preparationInputSelection({ value: { ...fixture(), scope: 'reviewed-root' }, path }));
  } }),
  ...['digest', 'corpusCommitSha', 'populationDigest', 'poolDigest', 'selectionRuntimeDigest'].map(key => it({ name: `requires exact identity grammar for ${key}`, fn: async () => {
    refused(() => preparationInputSelection({ value: { ...fixture(), [key]: 'Q7Z9K2' }, path }));
  } })),
  ...['samplerNodeVersion', 'samplerIcuVersion'].map(key => it({ name: `requires explicit historical ${key}`, fn: async () => {
    refused(() => preparationInputSelection({ value: { ...fixture(), [key]: ' ' }, path }));
  } })),
  it({ name: 'refuses zero original extent and duplicate parent or reference identities', fn: async () => {
    expect(refused(() => preparationInputSelection({ value: { ...fixture(), bytes: 0 }, path })).kind).toBe('input-relations');
    expect(refused(() => preparationInputSelection({ value: { ...fixture(), parents: [parent, parent], obligations: [obligation, obligation] }, path })).kind).toBe('input-relations');
    expect(refused(() => preparationInputSelection({ value: { ...fixture(), references: [reference, reference] }, path })).kind).toBe('input-relations');
  } }),
  it({ name: 'requires complete ordered obligation membership', fn: async () => {
    expect(refused(() => preparationInputSelection({ value: { ...fixture(), obligations: [] }, path })).kind).toBe('input-relations');
    expect(refused(() => preparationInputSelection({ value: { ...fixture(), obligations: [{ ...obligation, parentId: 'Other/source-section/0/target-section/0' }] }, path })).kind).toBe('input-relations');
  } }),
  it({ name: 'reads standalone canonical parent identity', fn: async () => {
    expect(preparationInputSelectionParent({ value: parent, path })).toEqual(parent);
  } }),
  ...['', '..', 'Tabby/extra', 'Tabby\\extra', 'Tabby\u007F'].map(entryId => it({ name: `refuses parent entry component ${JSON.stringify(entryId)}`, fn: async () => {
    refused(() => preparationInputSelectionParent({ value: { ...parent, entryId }, path }));
  } })),
  it({ name: 'requires canonical parent-coordinate correspondence', fn: async () => {
    refused(() => preparationInputSelectionParent({ value: { ...parent, sourceIndex: -1 }, path }));
    refused(() => preparationInputSelectionParent({ value: { ...parent, sourceIndex: 1 }, path }));
    refused(() => preparationInputSelectionParent({ value: { ...parent, parentId: 'Tabby/source-section/00/target-section/0' }, path }));
  } }),
  it({ name: 'keeps reference locators unexecuted and rejects blank or malformed identities', fn: async () => {
    expect(preparationInputSelectionReference({ value: reference, path })).toEqual(reference);
    refused(() => preparationInputSelectionReference({ value: { ...reference, path: '' }, path }));
    refused(() => preparationInputSelectionReference({ value: { ...reference, hash: 'private q7z9k2' }, path }));
  } }),
  it({ name: 'preserves open source obligations and explicit false flags', fn: async () => {
    expect(preparationInputObligation({ value: obligation, path })).toEqual(obligation);
    expect(preparationInputObligation({ value: { ...obligation, requiredContext: [] }, path }).requiredContext).toEqual([]);
    refused(() => preparationInputObligation({ value: { ...obligation, requiredContext: [' '] }, path }));
    refused(() => preparationInputObligation({ value: { ...obligation, scopeQualificationOpen: undefined }, path }));
    refused(() => preparationInputObligation({ value: { ...obligation, pictureEvidenceNeeded: 'false' }, path }));
  } }),
] });
