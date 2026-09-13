import { createHash, } from 'node:crypto';
import { inspect, } from 'node:util';
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
    const expectedBytes = f.artifacts.map(item => [...item.content]);
    const result = readPreparationSelectionEvidence({ ...f, artifacts: f.artifacts.toReversed() });
    expect(result.scope).toBe('matched-selection-artifacts');
    expect(result.artifacts.map(item => ({ path: item.path, hash: item.hash }))).toEqual(f.record.references);
    expect(result.artifacts.map(item => [...item.content])).toEqual(expectedBytes);
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
  ...[null, 1, 'not-a-record', [], {}, { path: 1 }].map((item, index) => it({ name: `refuses invalid entries inside a complete-sized inventory ${index}`, fn: async () => {
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
  ...['prototype', 'iterator'].map(trap => it({ name: `refuses byte proxies without invoking their ${trap} trap`, fn: async () => {
    const f = fixture();
    const canary = new Error('q7z9k2');
    let calls = 0;
    const content = new Proxy(new Uint8Array([255, 0, 1, 13, 10]), {
      getPrototypeOf(target) {
        if (trap === 'prototype') { calls += 1; throw canary; }
        return Reflect.getPrototypeOf(target);
      },
      get(target, key, receiver) {
        if (key === Symbol.iterator) { calls += 1; throw canary; }
        return Reflect.get(target, key, receiver) as unknown;
      },
    });
    let exposed: unknown;
    try {
      if (trap === 'prototype') Reflect.getPrototypeOf(content);
      else Reflect.get(content, Symbol.iterator);
    }
    catch (error) { exposed = error; }
    expect(exposed).toBe(canary);
    expect(calls).toBe(1);
    calls = 0;
    f.artifacts[0] = { path: '/unread/pool.bin', content };
    let caught: unknown;
    try { readPreparationSelectionEvidence(f); }
    catch (error) { caught = error; }
    expect(caught).toBeInstanceOf(PreparationRootError);
    expect((caught as PreparationRootError).kind).toBe('reference-content');
    expect(calls).toBe(0);
    expect(inspect(caught, { depth: null })).not.toContain('q7z9k2');
  } })),
  ...['inventory', 'entry', 'bytes'].map(boundary => it({ name: `classifies revoked ${boundary} proxies without retaining native causes`, fn: async () => {
    const f = fixture();
    const first = f.artifacts[0];
    if (first === undefined) throw new Error('expected revocation witness');
    const target = boundary === 'inventory' ? f.artifacts : boundary === 'entry' ? first : first.content;
    const revoked = Proxy.revocable(target, {});
    revoked.revoke();
    let exposed: unknown;
    try { Reflect.getPrototypeOf(revoked.proxy); }
    catch (error) { exposed = error; }
    expect(exposed).toBeInstanceOf(TypeError);
    const artifacts = boundary === 'inventory' ? revoked.proxy : [boundary === 'entry' ? revoked.proxy : { ...first, content: revoked.proxy }, ...f.artifacts.slice(1)];
    let caught: unknown;
    try { readPreparationSelectionEvidence({ ...f, artifacts: artifacts as readonly PreparationArtifactInput[] }); }
    catch (error) { caught = error; }
    expect(caught).toBeInstanceOf(PreparationRootError);
    expect((caught as PreparationRootError).kind).toBe(boundary === 'bytes' ? 'reference-content' : 'reference-inventory');
    expect((caught as Error).cause).toBeUndefined();
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
    expect(result.artifacts.map(item => [...item.content])).toEqual(f.artifacts.map(item => [...item.content]));
    expect(result.artifacts.every(item => !Buffer.isBuffer(item.content))).toBe(true);
  } }),
  it({ name: 'copies shared input views into non-shared matched snapshots', fn: async () => {
    const f = fixture();
    const shared = new Uint8Array(new SharedArrayBuffer(5));
    shared.set([255, 0, 1, 13, 10]);
    const artifacts = f.artifacts.map((item, index) => index === 0 ? { ...item, content: shared } : item);
    const result = readPreparationSelectionEvidence({ ...f, artifacts });
    shared.fill(23);
    expect([...result.artifacts[0]?.content ?? []]).toEqual([255, 0, 1, 13, 10]);
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
    expect([...callerBytes]).toEqual([17, 17, 17, 17, 17]);
    expect(result).toEqual(before);
    const callerAfterMutation = f.artifacts.map(item => [...item.content]);
    const content = result.artifacts[0]?.content;
    expect(content).toBeDefined();
    if (content === undefined) throw new Error('expected owned byte witness');
    (content as Uint8Array).fill(19);
    expect(f.artifacts.map(item => [...item.content])).toEqual(callerAfterMutation);
  } }),
  it({ name: 'copies only the input view rather than its larger backing buffer', fn: async () => {
    const f = fixture();
    const backing = new Uint8Array([99, 99, 255, 0, 1, 13, 10, 99]);
    f.artifacts[0] = { path: '/unread/pool.bin', content: backing.subarray(2, 7) };
    const result = readPreparationSelectionEvidence(f);
    expect([...result.artifacts[0]?.content ?? []]).toEqual([255, 0, 1, 13, 10]);
    expect(result.artifacts[0]?.bytes).toBe(5);
  } }),
  it({ name: 'does not alias outputs when two registered artifacts share an input view', fn: async () => {
    const f = fixture();
    const shared = new Uint8Array([4, 5, 6]);
    const artifacts = f.artifacts.map((item, index) => (index === 0) || (index === 2) ? { ...item, content: shared } : item);
    f.record.references = artifacts.map(item => ({ path: item.path, hash: createHash('sha256').update(item.content).digest('hex') }));
    const text = JSON.stringify(f.record);
    const result = readPreparationSelectionEvidence({ ...f, text, expectedDigest: hashContent({ content: text }), artifacts });
    const first = result.artifacts[0]?.content;
    expect(first).toBeDefined();
    if (first === undefined) throw new Error('expected first matched view');
    (first as Uint8Array).fill(31);
    expect([...result.artifacts[2]?.content ?? []]).toEqual([4, 5, 6]);
    expect([...shared]).toEqual([4, 5, 6]);
  } }),
  it({ name: 'requires downstream revalidation after a consumer changes its owned matched bytes', fn: async () => {
    const f = fixture();
    const result = readPreparationSelectionEvidence(f);
    const first = result.artifacts[0]?.content;
    expect(first).toBeDefined();
    if (first === undefined) throw new Error('expected matched content');
    (first as Uint8Array).fill(41);
    expect(failure(() => readPreparationSelectionEvidence({ ...f, artifacts: result.artifacts }))).toBe('reference-content');
  } }),
  it({ name: 'ignores a custom array iterator rather than delegating the frozen inventory to it', fn: async () => {
    const f = fixture();
    const artifacts = [...f.artifacts];
    const [first] = artifacts;
    if (first === undefined) throw new Error('expected iterator witness');
    let iterations = 0;
    Object.defineProperty(artifacts, Symbol.iterator, { value: function incompleteIterator() {
      iterations += 1;
      return [first].values();
    } });
    expect([...artifacts]).toHaveLength(1);
    expect(iterations).toBe(1);
    iterations = 0;
    expect(readPreparationSelectionEvidence({ ...f, artifacts }).artifacts).toHaveLength(3);
    expect(iterations).toBe(0);
  } }),
  ...(['path', 'content'] as const).flatMap(property => ['error', 'primitive'].map(kind => it({ name: `sanitizes throwing ${property} accessors carrying ${kind} private data`, fn: async () => {
    const f = fixture();
    const canary = 'q7z9k2';
    const abort = AbortSignal.abort(canary);
    let nativeReason: unknown;
    try {
      abort.throwIfAborted();
    }
    catch (error) { nativeReason = error; }
    expect(nativeReason).toBe(canary);
    const [original] = f.artifacts;
    if (original === undefined) throw new Error('expected accessor witness');
    const bad = { ...original };
    let reads = 0;
    Object.defineProperty(bad, property, { get() {
      reads += 1;
      if (kind === 'error') throw new Error(canary);
      // Native cancellation can throw a caller-supplied non-Error reason.
      abort.throwIfAborted();
    } });
    let caught: unknown;
    try {
      readPreparationSelectionEvidence({ ...f, artifacts: [bad, ...f.artifacts.slice(1)] });
    }
    catch (error) { caught = error; }
    expect(reads).toBe(1);
    expect(caught).toBeInstanceOf(PreparationRootError);
    expect((caught as PreparationRootError).kind).toBe(property === 'path' ? 'reference-inventory' : 'reference-content');
    expect(inspect(caught, { depth: null })).not.toContain(canary);
  } }))),
  ...['length', '0'].map(property => it({ name: `sanitizes a throwing inventory ${property} read`, fn: async () => {
    const f = fixture();
    const artifacts = new Proxy(f.artifacts, { get(target, key, receiver) {
      if (key === property) throw new Error('q7z9k2');
      return Reflect.get(target, key, receiver) as unknown;
    } });
    let caught: unknown;
    try {
      readPreparationSelectionEvidence({ ...f, artifacts });
    }
    catch (error) { caught = error; }
    expect(caught).toBeInstanceOf(PreparationRootError);
    expect((caught as PreparationRootError).kind).toBe('reference-inventory');
    expect(inspect(caught, { depth: null })).not.toContain('q7z9k2');
  } })),
  it({ name: 'snapshots each locator once before matching its content', fn: async () => {
    const f = fixture();
    const [original] = f.artifacts;
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
