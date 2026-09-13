import { createHash, } from 'node:crypto';
import { tagged, } from '@monochromatic-dev/module-logger/ts';
import { describe, expect, it, } from '@monochromatic-dev/module-test/ts';
import { CORPUS_COMMIT_SHA, hashContent, readPreparationSelectionEvidence, PreparationRootError, type PreparationArtifactInput, } from '../dist/final/node/index.mjs';

const l = tagged({ tag: 'selection-support-test' });
function fixture() {
  const artifacts = [
    { path: '/unread/pool.bin', content: new Uint8Array([255, 0, 1, 13, 10]) },
    { path: '/unread/empty', content: new Uint8Array() },
    { path: '/unread/notes.md', content: new TextEncoder().encode('保留\r\n') },
  ];
  const orderedParentIds = Array.from({ length: 40 }, (_, index) => `fixture/source-section/${index}/target-section/${index}`);
  const record = { status: 'parent identities frozen; reading complete; no acquisition or writer approval',
    corpus: { cloneDir: '/unread', commitSha: CORPUS_COMMIT_SHA }, runtime: '/unread/runtime', runtimeDigest: `sha256-tree-v1:${hashContent({ content: 'runtime' })}`,
    populationDigest: hashContent({ content: 'population' }), poolDigest: hashContent({ content: 'pool' }), supersededPopulationDigest: hashContent({ content: 'old' }),
    baselineCoordinatesOnly: true, rules: ['Not executable.'], sampler: { name: 'pickSpreadSample', count: 40, seed: 'none', nodeVersion: 'v26.7.0', icuVersion: 'fixture' },
    census: { selectedParents: 40, selectedEntries: 1 }, exclusions: [], orderedParentIds,
    dependencies: orderedParentIds.map(parentId => ({ parentId, disposition: 'unqualified; failure aborts without substitution', requiredContext: ['Retained context.'],
      pictureEvidenceNeeded: false, scopeQualificationOpen: true })), completeEntryReadings: 1, completeParentReadings: 40, boundaries: ['No approval.'],
    references: artifacts.map(item => ({ path: item.path, hash: createHash('sha256').update(item.content).digest('hex') })) };
  const text = JSON.stringify(record);
  return { text, expectedDigest: hashContent({ content: text }), artifacts, l, record };
}
function failure(run: () => unknown): string {
  try {
    run();
    return 'no-refusal';
  }
  catch (error) {
    if (!(error instanceof PreparationRootError)) throw error;
    return error.kind;
  }
}

await describe({ name: '', children: [describe({ name: readPreparationSelectionEvidence.name, children: [
  it({ name: 'matches all raw bytes and extents in frozen order without interpreting their paths or contents', fn: async () => {
    const f = fixture();
    const expectedBytes = f.artifacts.map(item => Array.from(item.content));
    const result = readPreparationSelectionEvidence({ ...f, artifacts: f.artifacts.toReversed() });
    expect(result.scope).toBe('matched-selection-artifacts');
    expect(result.artifacts.map(item => ({ path: item.path, hash: item.hash }))).toEqual(f.record.references);
    expect(result.artifacts.map(item => Array.from(item.content))).toEqual(expectedBytes);
    expect(result.artifacts.map(item => item.bytes)).toEqual(f.artifacts.map(item => item.content.byteLength));
    expect(result.artifacts[1]?.bytes).toBe(0);
    expect(Object.keys(result).toSorted()).toEqual(['artifacts', 'scope', 'selection']);
    expect(Object.keys(result.artifacts[0] ?? {}).toSorted()).toEqual(['bytes', 'content', 'hash', 'path']);
    expect(result.selection.obligations.every(item => item.scopeQualificationOpen)).toBe(true);
  } }),
  it({ name: 'checks independent selection before reading any supporting content', fn: async () => {
    const f = fixture();
    let reads = 0;
    const artifacts = f.artifacts.map(item => ({ path: item.path, get content() {
      reads += 1;
      return item.content;
    } }));
    expect(readPreparationSelectionEvidence({ ...f, artifacts }).artifacts).toHaveLength(3);
    expect(reads).toBe(3);
    reads = 0;
    expect(failure(() => readPreparationSelectionEvidence({ ...f, text: `${f.text}\n`, artifacts }))).toBe('selection-digest');
    expect(reads).toBe(0);
  } }),
  ...['missing', 'extra', 'duplicate', 'foreign'].map(kind => it({ name: `refuses ${kind} supporting inventory before reading content`, fn: async () => {
    const f = fixture();
    let reads = 0;
    const artifacts = f.artifacts.map(item => ({ path: item.path, get content() {
      reads += 1;
      return item.content;
    } }));
    function unexpectedContent(): Uint8Array<ArrayBuffer> {
      reads += 1;
      return new Uint8Array();
    }
    if (kind === 'missing') artifacts.pop();
    else if (kind === 'extra') artifacts.push({ path: '/unregistered', get content() {
      return unexpectedContent();
    } });
    else if (kind === 'duplicate') artifacts[1] = { path: '/unread/pool.bin', get content() {
      return unexpectedContent();
    } };
    else artifacts[1] = { path: '/unregistered', get content() {
      return unexpectedContent();
    } };
    expect(failure(() => readPreparationSelectionEvidence({ ...f, artifacts }))).toBe('reference-inventory');
    expect(reads).toBe(0);
  } })),
  ...[null, {}, [null]].map((value, index) => it({ name: `refuses malformed artifact inventory ${index}`, fn: async () => {
    const f = fixture();
    expect(failure(() => readPreparationSelectionEvidence({ ...f, artifacts: value as unknown as readonly PreparationArtifactInput[] }))).toBe('reference-inventory');
  } })),
  ...[null, 1, 'not-a-record'].map((item, index) => it({ name: `refuses invalid entries inside a complete-sized inventory ${index}`, fn: async () => {
    const f = fixture();
    const artifacts = [item, ...f.artifacts.slice(1)] as unknown as readonly PreparationArtifactInput[];
    expect(failure(() => readPreparationSelectionEvidence({ ...f, artifacts }))).toBe('reference-inventory');
  } })),
  it({ name: 'refuses changed bytes instead of trusting a caller-declared hash', fn: async () => {
    const f = fixture();
    f.artifacts[0] = { ...f.artifacts[0], path: '/unread/pool.bin', content: new Uint8Array([254, 0, 1, 13, 10]) };
    expect(failure(() => readPreparationSelectionEvidence(f))).toBe('reference-content');
  } }),
  it({ name: 'refuses newline normalization of exact supporting bytes', fn: async () => {
    const f = fixture();
    f.artifacts[2] = { path: '/unread/notes.md', content: new TextEncoder().encode('保留\n') };
    expect(failure(() => readPreparationSelectionEvidence(f))).toBe('reference-content');
  } }),
  ...['text', 'array', 'data-view'].map(kind => it({ name: `refuses non-byte-array content ${kind}`, fn: async () => {
    const f = fixture();
    const content = kind === 'text' ? 'not bytes' : kind === 'array' ? [255, 0, 1, 13, 10] : new DataView(new ArrayBuffer(5));
    const artifacts = f.artifacts.map((item, index) => index === 0 ? { ...item, content: content as unknown as Uint8Array } : item);
    expect(failure(() => readPreparationSelectionEvidence({ ...f, artifacts }))).toBe('reference-content');
  } })),
  it({ name: 'names unreadable detached supporting bytes without leaking them', fn: async () => {
    const f = fixture();
    const detached = new Uint8Array([255, 0, 1, 13, 10]);
    structuredClone(detached.buffer, { transfer: [detached.buffer] });
    f.artifacts[0] = { path: '/unread/pool.bin', content: detached };
    let caught: unknown;
    try {
      readPreparationSelectionEvidence(f);
    }
    catch (error) { caught = error; }
    expect(caught).toBeInstanceOf(PreparationRootError);
    expect((caught as PreparationRootError).kind).toBe('reference-content');
  } }),
  it({ name: 'accepts native Buffer input while returning owned ordinary byte arrays', fn: async () => {
    const f = fixture();
    const artifacts = f.artifacts.map(item => ({ path: item.path, content: Buffer.from(item.content) }));
    const result = readPreparationSelectionEvidence({ ...f, artifacts });
    expect(result.artifacts.map(item => Array.from(item.content))).toEqual(f.artifacts.map(item => Array.from(item.content)));
    expect(result.artifacts.every(item => !Buffer.isBuffer(item.content))).toBe(true);
  } }),
  it({ name: 'copies shared input views into non-shared matched snapshots', fn: async () => {
    const f = fixture();
    const shared = new Uint8Array(new SharedArrayBuffer(5));
    shared.set([255, 0, 1, 13, 10]);
    const artifacts = f.artifacts.map((item, index) => index === 0 ? { ...item, content: shared } : item);
    const result = readPreparationSelectionEvidence({ ...f, artifacts });
    shared.fill(23);
    expect(Array.from(result.artifacts[0]?.content ?? [])).toEqual([255, 0, 1, 13, 10]);
    expect(result.artifacts[0]?.content.buffer).toBeInstanceOf(ArrayBuffer);
  } }),
  it({ name: 'owns matched bytes independently in both mutation directions', fn: async () => {
    const f = fixture();
    const result = readPreparationSelectionEvidence(f);
    const before = structuredClone(result);
    const callerBytes = f.artifacts[0]?.content;
    expect(callerBytes).toBeDefined();
    if (callerBytes === undefined) throw new Error('expected caller byte witness');
    callerBytes.fill(17);
    expect(Array.from(callerBytes)).toEqual([17, 17, 17, 17, 17]);
    expect(result).toEqual(before);
    const callerAfterMutation = f.artifacts.map(item => Array.from(item.content));
    const content = result.artifacts[0]?.content;
    expect(content).toBeDefined();
    if (content === undefined) throw new Error('expected owned byte witness');
    (content as Uint8Array).fill(19);
    expect(f.artifacts.map(item => Array.from(item.content))).toEqual(callerAfterMutation);
  } }),
  it({ name: 'snapshots each locator once before matching its content', fn: async () => {
    const f = fixture();
    const original = f.artifacts[0];
    if (original === undefined) throw new Error('expected locator witness');
    let reads = 0;
    const first = { get path() {
      reads += 1;
      return reads === 1 ? original.path : '/changed-after-snapshot';
    }, content: original.content };
    const result = readPreparationSelectionEvidence({ ...f, artifacts: [first, ...f.artifacts.slice(1)] });
    expect(reads).toBe(1);
    expect(result.artifacts[0]?.path).toBe('/unread/pool.bin');
  } }),
] })] });
