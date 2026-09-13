import { chmod, mkdtemp, readFile, rm, writeFile, } from 'node:fs/promises';
import { join, } from 'node:path';
import { tmpdir, } from 'node:os';
import { inspect, } from 'node:util';
import { createHash, } from 'node:crypto';
import { tagged, } from '@monochromatic-dev/module-logger/ts';
import { describe, expect, it, } from '@monochromatic-dev/module-test/ts';
import { alignDocumentSections, buildPreparationRootInputs, CORPUS_COMMIT_SHA, hashContent, parseDocument, passArchiveText, PreparationRootError, } from '../dist/final/node/index.mjs';

const l = tagged({ tag: 'root-input-owner-test' });
const digest = (content: string) => hashContent({ content });
async function fixture() {
  const dir = await mkdtemp(join(tmpdir(), 'root-input-fixture-'));
  const sourceText = `${Array.from({ length: 41 }, (_, index) => `## 猫 ${index}\n\n猫猫 ${index}。`).join('\n\n')  }\n\n## Notes\n\n[^1]: 猫注。\n`;
  const sourceRaw = sourceText.replaceAll('\n', '\r\n');
  const archiveText = `(To-Do)\n\n${  Array.from({ length: 41 }, (_, index) => `## Cat ${index}\n\nCat ${index} is non‑binary.`).join('\n\n')  }\n\n## Notes\n\n[^1]: Cat note.\n`;
  const targetText = passArchiveText({ text: archiveText, l });
  const source = parseDocument({ text: sourceText });
  const target = parseDocument({ text: targetText });
  const alignment = alignDocumentSections({ source, target });
  expect(alignment.pairs).toHaveLength(42);
  const node = (value: (typeof source.nodes)[number]) => ({ id: value.id, kind: value.kind, zone: value.zone, startOffset: value.startOffset, endOffset: value.endOffset, contentHash: value.contentHash });
  // Independent historical representation, not the root owner's snapshot helper.
  const parents = alignment.pairs.map((pair, pairIndex) => ({
    id: `fixture/source-section/${pair.source.sliceIndex}/target-section/${pair.target.sliceIndex}`, entryId: 'fixture', index: pair.source.sliceIndex, pairIndex,
    sourceSectionIndex: pair.source.sliceIndex, targetSectionIndex: pair.target.sliceIndex, sourceText: pair.source.text, incumbentText: pair.target.text,
    source: { startOffset: pair.source.startOffset, endOffset: pair.source.endOffset, hash: digest(pair.source.text), nodes: pair.source.nodes.map(node) },
    target: { startOffset: pair.target.startOffset, endOffset: pair.target.endOffset, hash: digest(pair.target.text), nodes: pair.target.nodes.map(node) },
    originalProtection: { intersections: [], sealedTargetNodeIds: [], straddlingNodeIds: [], allTargetNodesSealed: false },
  }));
  // This frozen order is neither a prefix nor native section order; resampling cannot stand in for lookup.
  const selected = parents.filter(parent => (parent.pairIndex !== 17) && (parent.pairIndex !== 41)).toReversed();
  const population = parents.map(parent => ({ id: parent.id, entryId: parent.entryId, pairIndex: parent.pairIndex,
    sourceSectionIndex: parent.sourceSectionIndex, targetSectionIndex: parent.targetSectionIndex, source: parent.source, target: parent.target, originalProtection: parent.originalProtection }));
  const populationDigest = digest(
    JSON.stringify(parents.map(parent => ({ id: parent.id, source: parent.source, target: parent.target, originalProtection: parent.originalProtection }))),
  );
  const poolDigest = digest(JSON.stringify(selected));
  const runtimeDigest = `sha256-tree-v1:${digest('historical implementation')}`;
  const entry = { entryId: 'fixture', sourceText, archiveText, targetText, sourceHash: digest(sourceText), archiveHash: digest(archiveText), targetHash: digest(targetText), originalPolicy: { inherited: 'none', normalized: 'none', spans: [] } };
  const pool = { status: 'provider-free policy population draft; no paid acquisition or writer execution approval', corpusSha: CORPUS_COMMIT_SHA,
    runtimeDigest, rules: ['Current native eligibility, not an execution instruction.'], populationCount: parents.length, populationDigest, population: structuredClone(population),
    parentCount: 40, poolDigest, pool: structuredClone(selected), entries: [structuredClone(entry)], excluded: [], observations: alignment.findings.map(finding => ({ entryId: 'fixture', kind: 'section-alignment', finding })) };
  const details = selected.map((parent, index) => ({ pairIndex: parent.pairIndex, requiredContext: [` Context ${parent.pairIndex}. `], pictureEvidenceNeeded: index === 0,
    scopeQualificationOpen: index === 1, automaticPairingVerified: false }));
  const note = { entryId: 'fixture', readExtent: 'complete source and normalized target entry', parentReadings: structuredClone(details) };
  const prior = { entries: [] };
  const frame = `# fixture\n\nSelected parent indexes: ${selected.map(parent => parent.pairIndex).join(', ')}\n\nDeclared-original policy: none\n\n## Full original\n\n${sourceText}\n\n## Full normalized incumbent\n\n${targetText}\n`;
  const notePath = '/never-open/root-note.json';
  const framePath = '/never-open/frame.md';
  const journal = { corpusSha: CORPUS_COMMIT_SHA, poolDigest, populationDigest, priorJournalHash: digest(JSON.stringify(prior)),
    entries: [{ entryId: 'fixture', sourceHash: entry.sourceHash, targetHash: entry.targetHash, selectedParentIndexes: selected.map(parent => parent.pairIndex),
      file: 'frame.md', fileHash: digest(frame), completeEntryReading: 'read-current-policy-entry', currentNoteFile: notePath, currentNoteHash: digest(JSON.stringify(note)) }],
    parents: selected.map((parent, index) => ({ id: parent.id, entryId: 'fixture', pairIndex: parent.pairIndex, sourceHash: parent.source.hash, targetHash: parent.target.hash,
      scopeReading: 'reviewed-with-explicit-context-dependencies', sourceChars: parent.sourceText.length, targetChars: parent.incumbentText.length,
      reading: structuredClone(details[index]), noteFile: notePath, noteHash: digest(JSON.stringify(note)) })) };
  const selection = { status: 'parent identities frozen; reading complete; no acquisition or writer approval', corpus: { cloneDir: '/unopened-historical-location', commitSha: CORPUS_COMMIT_SHA },
    runtime: '/unexecuted/historical-runtime', runtimeDigest, populationDigest, poolDigest, supersededPopulationDigest: digest('old'), baselineCoordinatesOnly: true,
    rules: pool.rules, sampler: { name: 'pickSpreadSample', count: 40, seed: 'none', order: ['source UTF-16 length', 'entry localeCompare', 'source section index'],
      position: 'floor((position + 0.5) * population.length / min(count, population.length))', nodeVersion: 'v26.7.0', icuVersion: 'fixture' },
    census: { listed: 1, eligibleEntries: 1, populationParents: 42, selectedEntries: 1, selectedParents: 40 }, exclusions: [], orderedParentIds: selected.map(parent => parent.id),
    dependencies: details.map((detail, index) => ({ parentId: selected[index]?.id, disposition: 'unqualified; failure aborts without substitution',
      requiredContext: [...detail.requiredContext], pictureEvidenceNeeded: detail.pictureEvidenceNeeded, scopeQualificationOpen: detail.scopeQualificationOpen })),
    completeEntryReadings: 1, completeParentReadings: 40, boundaries: ['No acquisition or writer approval.'], references: [] as { path: string; hash: string }[] };
  const storePath = join(dir, 'objects.json');
  const tracePath = join(dir, 'trace.jsonl');
  const files = { 'people/fixture/page.md': sourceRaw, 'people/fixture/page.en.md': archiveText };
  await writeFile(storePath, JSON.stringify({ files, fail: '' }));
  const gitPath = join(dir, 'git.mjs');
  // JSON encoding is the destination-JavaScript boundary for disposable paths.
  await writeFile(gitPath, `#!/usr/bin/env node
import { readFile, appendFile } from 'node:fs/promises';
const args = process.argv.slice(2);
const data = JSON.parse(await readFile(${JSON.stringify(storePath)}, 'utf8'));
await appendFile(${JSON.stringify(tracePath)}, JSON.stringify(args) + '\\n');
if (args.includes('ls-tree')) process.stdout.write('people/fixture\\n');
else if (args.includes('show')) {
  const spec = args[args.length - 1];
  const key = spec.slice(spec.indexOf(':') + 1);
  if (data.fail === key) { process.stdout.write('q7z9k2'); process.stderr.write('fixture read refused q7z9k2'); process.exitCode = 128; }
  else if (Object.hasOwn(data.files, key)) process.stdout.write(data.files[key]);
  else { process.stderr.write("fatal: path '" + key + "' does not exist in '" + spec.split(':')[0] + "'"); process.exitCode = 128; }
} else { process.stderr.write('Unexpected fake Git operation'); process.exitCode = 2; }
`);
  await chmod(gitPath, 0o700);
  const values = { pool, journal, prior, note, frame, opaque: 'throw new Error("historical support must not execute");' };
  function request() {
    const contents = [
      { path: '/never-open/pool.json', text: JSON.stringify(values.pool) },
      { path: '/never-open/journal.json', text: JSON.stringify(values.journal) },
      { path: '/never-open/prior.json', text: JSON.stringify(values.prior) },
      { path: framePath, text: values.frame }, { path: notePath, text: JSON.stringify(values.note) },
      { path: '/never-open/history.mts', text: values.opaque },
    ];
    const artifacts = contents.map(item => ({ path: item.path, content: new TextEncoder().encode(item.text) }));
    selection.references = artifacts.map(item => ({ path: item.path, hash: createHash('sha256').update(item.content).digest('hex') }));
    const text = JSON.stringify(selection);
    return { text, expectedDigest: digest(text), artifacts, pin: { cloneDir: dir, commitSha: CORPUS_COMMIT_SHA, gitPath }, l };
  }
  return { dir, storePath, tracePath, files, values, selection, request, sourceRaw, sourceText, targetText,
    [Symbol.asyncDispose]: async () => { await rm(dir, { recursive: true, force: true }); } };
}
async function refusal(body: () => Promise<unknown>) {
  let caught: unknown;
  try {
    await body();
  }
  catch (error) { caught = error; }
  expect(caught).toBeInstanceOf(PreparationRootError);
  if (!(caught instanceof PreparationRootError)) throw new Error('expected root refusal');
  return caught;
}

await describe({ name: '', concurrency: 1, children: [describe({ name: buildPreparationRootInputs.name, children: [
  it({ name: 'reconstructs frozen parents, raw identities, reading ownership and definition-only additions without redrawing', fn: async () => {
    await using f = await fixture();
    const inputs = await buildPreparationRootInputs(f.request());
    expect(inputs.scope).toBe('unqualified-preparation-root-inputs');
    expect(inputs.parents.map(parent => parent.id)).toEqual(f.selection.orderedParentIds);
    expect(inputs.population).toHaveLength(42);
    expect(inputs.registry).toHaveLength(41);
    expect(inputs.registry.slice(0, 40).every(parent => parent.roles.includes('writer-parent'))).toBe(true);
    expect(inputs.registry[40]?.roles).toEqual(['footnote-definitions']);
    expect(inputs.registry[40]?.parentId).toBe('fixture/source-section/41/target-section/41');
    expect(inputs.parents.some(parent => parent.pairIndex === 41)).toBe(false);
    expect(inputs.parents[0]?.pairIndex).toBe(40);
    expect(inputs.entries[0]?.sourceText).toBe(f.sourceText);
    expect(inputs.entries[0]?.targetText).toBe(f.targetText);
    expect(inputs.rawDocuments[0]?.rawHash).toBe(digest(f.sourceRaw));
    expect(inputs.rawDocuments[0]?.effectiveHash).toBe(digest(f.sourceText));
    expect(inputs.rawDocuments[0]?.foldedCrLf).toBe(f.sourceRaw.length - f.sourceText.length);
    expect(inputs.obligations[0]?.pictureEvidenceNeeded).toBe(true);
    expect(inputs.obligations[1]?.scopeQualificationOpen).toBe(true);
    expect(inputs.sectionPairing).toBe('not-registered');
    expect(inputs.references[5]?.bindings).toEqual([{ role: 'opaque-selection-support', consumer: 'selection' }]);
    expect(inputs.references[4]?.bindings).toHaveLength(41);
    expect(inputs.references.every(item => !('content' in item))).toBe(true);
    expect(inputs.population.every(item => (!('sourceText' in item)) && (!('incumbentText' in item)))).toBe(true);
  } }),
  ...['pool-order', 'population-coordinate', 'pool-hash', 'census', 'exclusion'].map(kind => it({ name: `refuses changed semantic population evidence ${kind}`, fn: async () => {
    await using f = await fixture();
    if (kind === 'pool-order') f.values.pool.pool.reverse();
    else if (kind === 'population-coordinate') {
      const [first] = f.values.pool.population;
      if (first === undefined) throw new Error('expected population witness');
      first.source.startOffset += 1;
    } else if (kind === 'pool-hash') f.values.pool.poolDigest = digest('different');
    else if (kind === 'census') f.selection.census.populationParents = 40;
    else Object.assign(f.values.pool, { excluded: [{ entryId: 'invented', kind: 'missing-corpus-side' }] });
    expect((await refusal(async () => await buildPreparationRootInputs(f.request()))).kind).toBe('population');
  } })),
  ...['entry-order', 'entry-hash', 'frame', 'parent-order', 'parent-hash', 'note-link', 'note-detail', 'obligation'].map(kind => it({ name: `refuses altered entry or parent provenance ${kind}`, fn: async () => {
    await using f = await fixture();
    const [entry] = f.values.journal.entries;
    const [parent] = f.values.journal.parents;
    if ((entry === undefined) || (parent === undefined)) throw new Error('expected provenance witnesses');
    if (kind === 'entry-order') entry.entryId = 'foreign';
    else if (kind === 'entry-hash') entry.sourceHash = digest('foreign');
    else if (kind === 'frame') {
      f.values.frame += 'changed';
      entry.fileHash = digest(f.values.frame);
    }
    else if (kind === 'parent-order') f.values.journal.parents.reverse();
    else if (kind === 'parent-hash') parent.sourceHash = digest('foreign');
    else if (kind === 'note-link') parent.noteFile = '/not-registered';
    else if (kind === 'note-detail') {
      if (parent.reading === undefined) throw new Error('expected current detail');
      parent.reading.requiredContext = ['changed journal detail'];
    } else {
      const [first] = f.selection.dependencies;
      if (first === undefined) throw new Error('expected obligation');
      first.requiredContext = ['changed frozen obligation'];
    }
    expect((await refusal(async () => await buildPreparationRootInputs(f.request()))).kind).toBe('reading-provenance');
  } })),
  it({ name: 'refuses complete-document drift despite an unchanged selected first parent', fn: async () => {
    await using f = await fixture();
    await writeFile(f.storePath, JSON.stringify({ files: { ...f.files, 'people/fixture/page.md': `${f.sourceRaw  }\r\nUnrelated changed tail.` }, fail: '' }));
    expect((await refusal(async () => await buildPreparationRootInputs(f.request()))).kind).toBe('population');
  } }),
  it({ name: 'keeps selected parent and population snapshots independent in both mutation directions', fn: async () => {
    await using f = await fixture();
    const inputs = await buildPreparationRootInputs(f.request());
    const populationBefore = structuredClone(inputs.population);
    const [parent] = inputs.parents;
    if (parent === undefined) throw new Error('expected parent ownership witness');
    (parent.source as { startOffset: number }).startOffset += 1;
    expect(inputs.population).toEqual(populationBefore);
    const parentsBefore = structuredClone(inputs.parents);
    const matching = inputs.population.find(item => item.id === parent.id);
    if (matching === undefined) throw new Error('expected population ownership witness');
    (matching.target as { endOffset: number }).endOffset += 1;
    expect(inputs.parents).toEqual(parentsBefore);
  } }),
  it({ name: 'names unexpected native corpus failures without retaining subprocess content', fn: async () => {
    await using f = await fixture();
    await writeFile(f.storePath, JSON.stringify({ files: f.files, fail: 'people/fixture/page.md' }));
    const error = await refusal(async () => await buildPreparationRootInputs(f.request()));
    expect(error.kind).toBe('corpus-read');
    expect(error.input).toBe('people/fixture/page.md');
    expect(inspect(error, { depth: null })).not.toContain('q7z9k2');
  } }),
  it({ name: 'checks independent selection bytes before invoking the configured corpus executable', fn: async () => {
    await using f = await fixture();
    const request = f.request();
    const refusalError = await refusal(async () => await buildPreparationRootInputs({ ...request, text: `${request.text}\n` }));
    expect(refusalError.kind).toBe('selection-digest');
    let absent = false;
    try {
      await readFile(f.tracePath);
    }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      absent = true;
    }
    expect(absent).toBe(true);
  } }),
] })] });
