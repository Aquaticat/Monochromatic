import { inspect, } from 'node:util';
import { tagged, } from '@monochromatic-dev/module-logger/ts';
import { describe, expect, it, } from '@monochromatic-dev/module-test/ts';
import { CORPUS_COMMIT_SHA, hashContent, readFrozenPreparationSelection, PreparationRootError, } from '../dist/final/node/index.mjs';

const l = tagged({ tag: 'frozen-selection-test' });
function artifact() {
  const orderedParentIds = Array.from({ length: 40 }, (_, index) => `fixture/source-section/${index}/target-section/${index}`);
  return {
    status: 'parent identities frozen; reading complete; no acquisition or writer approval',
    corpus: { cloneDir: '/unread-corpus', commitSha: CORPUS_COMMIT_SHA, gitPath: '/unexecuted-git' },
    runtime: '/unread-runtime', runtimeDigest: `sha256-tree-v1:${hashContent({ content: 'selection implementation' })}`,
    populationDigest: hashContent({ content: 'frozen population' }), poolDigest: hashContent({ content: 'frozen parent pool' }),
    supersededPopulationDigest: hashContent({ content: 'superseded population' }), baselineCoordinatesOnly: true,
    rules: ['Frozen fixture policy; not an execution instruction.'],
    sampler: { name: 'pickSpreadSample', count: 40, seed: 'none', nodeVersion: 'v26.7.0', icuVersion: 'fixture-icu', order: ['source length'], position: 'fixture position', collator: { locale: 'fixture' } },
    census: { listed: 1, eligibleEntries: 1, populationParents: 40, selectedEntries: 1, selectedParents: 40 },
    exclusions: [], orderedParentIds,
    dependencies: orderedParentIds.map((parentId, index) => ({ parentId, disposition: 'unqualified; failure aborts without substitution',
      requiredContext: [` Preserve 猫 context ${index}. `], pictureEvidenceNeeded: index === 0, scopeQualificationOpen: index === 1 })),
    completeEntryReadings: 1, completeParentReadings: 40, boundaries: ['No acquisition or writer approval.'],
    references: [{ path: '/deliberately-absent/frozen-support.json', hash: hashContent({ content: 'unread support' }) }],
  };
}
function outcome(value: unknown): string {
  const text = JSON.stringify(value);
  try {
    readFrozenPreparationSelection({ text, expectedDigest: hashContent({ content: text }), l });
    return 'no-refusal';
  }
  catch (error) {
    if (!(error instanceof PreparationRootError)) throw error;
    return error.kind;
  }
}
await describe({ name: '', children: [describe({ name: readFrozenPreparationSelection.name, children: [
  it({ name: 'retains ordered frozen identities and unresolved obligations without reading supporting paths', fn: async () => {
    const value = artifact();
    const text = `${JSON.stringify(value, null, 2)}\r\n`;
    const expectedDigest = hashContent({ content: text });
    const result = readFrozenPreparationSelection({ text, expectedDigest, l });
    expect(result.scope).toBe('frozen-selection-identity');
    expect(result.digest).toBe(expectedDigest);
    expect(result.bytes).toBe(Buffer.byteLength(text, 'utf8'));
    expect(result.parents).toEqual(value.orderedParentIds.map((parentId, index) => ({ parentId, entryId: 'fixture', sourceIndex: index, targetIndex: index })));
    expect(result.obligations.map(item => item.requiredContext)).toEqual(value.dependencies.map(item => item.requiredContext));
    expect(result.obligations[0]?.pictureEvidenceNeeded).toBe(true);
    expect(result.obligations[1]?.scopeQualificationOpen).toBe(true);
    expect(result.references).toEqual(value.references);
    expect(result.corpusCommitSha).toBe(CORPUS_COMMIT_SHA);
    expect(result.populationDigest).toBe(value.populationDigest);
    expect(result.poolDigest).toBe(value.poolDigest);
    expect(result.selectionRuntimeDigest).toBe(value.runtimeDigest);
    expect(result.samplerNodeVersion).toBe('v26.7.0');
    expect(result.samplerIcuVersion).toBe('fixture-icu');
    expect('samplerDigest' in result).toBe(false);
    expect('approved' in result).toBe(false);
    expect('client' in result).toBe(false);
  } }),
  it({ name: 'checks independent digest before parsing and does not promote changed order', fn: async () => {
    const value = artifact();
    const original = JSON.stringify(value);
    const expectedDigest = hashContent({ content: original });
    for (const text of ['not-json', JSON.stringify({ ...value, orderedParentIds: value.orderedParentIds.toReversed() }), `${original}\n`]) {
      let caught: unknown;
      try {
        readFrozenPreparationSelection({ text, expectedDigest, l });
      }
      catch (error) { caught = error; }
      expect(caught).toBeInstanceOf(PreparationRootError);
      expect((caught as PreparationRootError).kind).toBe('selection-digest');
    }
  } }),
  it({ name: 'does not retain native parser excerpts for an independently matched malformed artifact', fn: async () => {
    const text = 'q7z9k2';
    let native: unknown;
    try {
      JSON.parse(text);
    }
    catch (error) { native = error; }
    expect(inspect(native, { depth: null })).toContain(text);
    let caught: unknown;
    try {
      readFrozenPreparationSelection({ text, expectedDigest: hashContent({ content: text }), l });
    }
    catch (error) { caught = error; }
    expect(caught).toBeInstanceOf(PreparationRootError);
    expect((caught as PreparationRootError).kind).toBe('selection-syntax');
    expect(inspect(caught, { depth: null })).not.toContain(text);
  } }),
  ...[null, [], 'text', 1, true].map((value, index) => it({ name: `rejects non-record selection ${index}`, fn: async () => {
    expect(outcome(value)).toBe('selection-shape');
  } })),
  ...[
    { status: 'approved' }, { baselineCoordinatesOnly: false }, { approved: true }, { corpus: { commitSha: 'different' } },
    { sampler: [] }, { populationDigest: 'wrong' }, { poolDigest: 'G'.repeat(64) }, { runtimeDigest: 'different-format' },
    { runtimeDigest: 'sha256-tree-v1:short' }, { rules: [1] }, { boundaries: '' }, { exclusions: [null] },
  ].map((change, index) => it({ name: `rejects unsupported frozen format ${index}`, fn: async () => {
    expect(outcome({ ...artifact(), ...change })).toBe('selection-shape');
  } })),
  ...['sampler-count', 'sampler-name', 'sampler-seed', 'parent-count', 'duplicate-parent', 'census-parents', 'census-entries', 'parent-readings', 'entry-readings'].map(kind => it({
    name: `refuses incomplete or inconsistent selection ${kind}`, fn: async () => {
      const value = artifact();
      if (kind === 'sampler-count') value.sampler.count = 39;
      else if (kind === 'sampler-name') value.sampler.name = 'different';
      else if (kind === 'sampler-seed') value.sampler.seed = 'redraw';
      else if (kind === 'parent-count') value.orderedParentIds.pop();
      else if (kind === 'duplicate-parent') value.orderedParentIds[1] = 'fixture/source-section/0/target-section/0';
      else if (kind === 'census-parents') value.census.selectedParents = 39;
      else if (kind === 'census-entries') value.census.selectedEntries = 2;
      else if (kind === 'parent-readings') value.completeParentReadings = 39;
      else value.completeEntryReadings = 0;
      expect(outcome(value)).toBe('selection-parents');
    },
  })),
  ...['../source-section/0/target-section/0', ' fixture/source-section/0/target-section/0', 'fixture /source-section/0/target-section/0',
    'fi\nxture/source-section/0/target-section/0', 'fi\u007fxture/source-section/0/target-section/0', 'fi\u009fxture/source-section/0/target-section/0', String.raw`folder\escape/source-section/0/target-section/0`, 'fixture/source-section/01/target-section/0',
    'fixture/source-section/-1/target-section/0', 'fixture/source-section/0/target-section/1e1', 'fixture/other/0/target-section/0', 'fixture/source-section/0/other/0', 'fixture/source-section/0'].map((id, index) => it({
    name: `refuses noncanonical frozen parent identity ${index}`, fn: async () => {
      const value = artifact();
      value.orderedParentIds[0] = id;
      expect(outcome(value)).toBe('selection-parents');
    },
  })),
  ...['empty', 'duplicate', 'hash'].map(kind => it({ name: `refuses invalid reference inventory ${kind}`, fn: async () => {
    const value = artifact();
    if (kind === 'empty') value.references.splice(0);
    else if (kind === 'duplicate') value.references.push({ path: '/deliberately-absent/frozen-support.json', hash: hashContent({ content: 'unread support' }) });
    else value.references[0] = { path: '/still-unread', hash: 'invalid' };
    expect(outcome(value)).toBe('selection-references');
  } })),
  ...['missing', 'reordered', 'approved', 'no-context', 'flag'].map(kind => it({ name: `retains every source obligation instead of accepting ${kind}`, fn: async () => {
    const value = artifact();
    if (kind === 'missing') value.dependencies.pop();
    else if (kind === 'reordered') value.dependencies.reverse();
    else {
      const [first] = value.dependencies;
      if (first === undefined) throw new Error('expected fixture obligation');
      if (kind === 'approved') first.disposition = 'approved';
      else if (kind === 'no-context') first.requiredContext = [];
      else Object.assign(first, { scopeQualificationOpen: 'not-a-boolean' });
    }
    expect(outcome(value)).toBe('selection-obligations');
  } })),
  it({ name: 'does not share retained arrays across independent reads of the same frozen bytes', fn: async () => {
    const text = JSON.stringify(artifact());
    const expectedDigest = hashContent({ content: text });
    const first = readFrozenPreparationSelection({ text, expectedDigest, l });
    const snapshot = structuredClone(first);
    (first.references as unknown[]).splice(0);
    const context = first.obligations[0]?.requiredContext;
    expect(context).toBeDefined();
    if (context === undefined) throw new Error('expected owned context witness');
    (context as string[]).push('changed result');
    const second = readFrozenPreparationSelection({ text, expectedDigest, l });
    expect(second).toEqual(snapshot);
  } }),
] })] });
