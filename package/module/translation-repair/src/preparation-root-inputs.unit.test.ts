import { chmod, mkdir, mkdtemp, readFile, rm, symlink, writeFile, } from 'node:fs/promises';
import { join, relative, } from 'node:path';
import { tmpdir, } from 'node:os';
import { inspect, } from 'node:util';
import { createHash, } from 'node:crypto';
import { tagged, } from '@monochromatic-dev/module-logger/ts';
import { describe, expect, it, } from '@monochromatic-dev/module-test/ts';
import { alignDocumentSections, archiveOriginalReadingOf, buildPreparationRootInputs, CORPUS_COMMIT_SHA, hashContent, parseDocument, passArchiveText, PreparationRootError, } from '../dist/final/node/index.mjs';

const l = tagged({ tag: 'root-input-owner-test' });
const digest = (content: string) => hashContent({ content });
const uniqueHeading = (index: number) => `## Unique${String.fromCharCode(65 + Math.floor(index / 26), 65 + index % 26)}section`;
async function fixture({ repeatedQuestions = false, implicitFirst = false, targetNamespace = false, emptyTarget = false }: { readonly repeatedQuestions?: boolean; readonly implicitFirst?: boolean; readonly targetNamespace?: boolean; readonly emptyTarget?: boolean } = {}) {
  const dir = await mkdtemp(join(tmpdir(), 'root-input-fixture-'));
  const sourceText = `${Array.from({ length: 41 }, (_, index) => {
    const heading = targetNamespace || emptyTarget ? uniqueHeading(index) : repeatedQuestions ? '## 猫' : `## 猫 ${index}`;
    return implicitFirst && index === 40 ? heading : `${heading}\n\n${repeatedQuestions ? '猫猫。' : `猫猫 ${index}。`}`;
  }).join('\n\n')}\n\n## Notes\n\n[^1]: 猫注。\n`; 
  const sourceRaw = sourceText.replaceAll('\n', '\r\n');
  const archiveText = `(To-Do)\n\n${Array.from({ length: 41 }, (_, index) => {
    if (emptyTarget && index === 39) return '';
    const heading = targetNamespace || emptyTarget ? uniqueHeading(index) : repeatedQuestions ? '## Cat' : `## Cat ${index}`;
    return implicitFirst && index === 40 ? heading : `${heading}\n\n${repeatedQuestions ? 'Cat is non‑binary.' : `Cat ${index} is non‑binary.`}`;
  }).join('\n\n')}\n\n## Notes\n\n[^1]: Cat note.\n${targetNamespace ? '\n## Extra namespace\n\n[^outside]: Unpaired target note.\n' : ''}`;
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
  const prior: { entries: Record<string, unknown>[] } = { entries: [] };
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
if (args[args.indexOf('-C') + 1] !== ${JSON.stringify(dir)}) throw new Error('Unexpected fixture clone origin');
const data = JSON.parse(await readFile(${JSON.stringify(storePath)}, 'utf8'));
await appendFile(${JSON.stringify(tracePath)}, JSON.stringify(args) + '\\n');
if (args.includes('ls-tree')) {
  if (data.failListing) { process.stderr.write('fixture listing refused q7z9k2'); process.exitCode = 128; }
  else process.stdout.write((data.listed ?? ['fixture']).map(id => 'people/' + id).join('\\n') + '\\n');
}
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
function carryReadings(f: Awaited<ReturnType<typeof fixture>>) {
  const [entry] = f.values.journal.entries;
  if (entry === undefined) throw new Error('expected carried entry');
  const prior = { entryId: 'fixture', sourceHash: entry.sourceHash, targetHash: entry.targetHash, selectedParentIndexes: [...entry.selectedParentIndexes],
    requiredContext: [' Retained prior context. '], pictureEvidenceNeeded: false, scopeQualificationOpen: true, automaticPairingVerified: false };
  f.values.prior.entries = [structuredClone(prior)];
  const priorJournalHash = digest(JSON.stringify(f.values.prior));
  f.values.journal.priorJournalHash = priorJournalHash;
  Reflect.deleteProperty(entry, 'currentNoteFile');
  Reflect.deleteProperty(entry, 'currentNoteHash');
  Object.assign(entry, { completeEntryReading: 'carried-by-exact-entry-hashes', priorReading: structuredClone(prior), priorJournalHash });
  f.values.journal.parents.forEach(parent => {
    Reflect.deleteProperty(parent, 'reading');
    Reflect.deleteProperty(parent, 'noteFile');
    Reflect.deleteProperty(parent, 'noteHash');
    Object.assign(parent, { scopeReading: 'carried-by-exact-parent-and-entry-hashes', priorJournalHash, priorEntryId: 'fixture' });
  });
  f.selection.dependencies.forEach(obligation => Object.assign(obligation, { requiredContext: [...prior.requiredContext], pictureEvidenceNeeded: false, scopeQualificationOpen: true }));
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
  it({ name: 'retains exact carried entry and parent evidence without promoting correspondence qualification', fn: async () => {
    await using f = await fixture();
    carryReadings(f);
    const inputs = await buildPreparationRootInputs(f.request());
    expect(inputs.obligations.every(item => item.scopeQualificationOpen && !item.pictureEvidenceNeeded)).toBe(true);
    expect(inputs.obligations.map(item => item.requiredContext)).toEqual(f.selection.dependencies.map(item => item.requiredContext));
    expect(inputs.references[4]?.bindings).toEqual([{ role: 'opaque-selection-support', consumer: 'selection' }]);
  } }),
  ...['duplicate-prior', 'changed-prior', 'parent-carry-hash', 'contradictory-entry-status', 'contradictory-parent-status'].map(kind => it({ name: `refuses invalid carried reading provenance ${kind}`, fn: async () => {
    await using f = await fixture();
    const [entry] = f.values.journal.entries;
    const [parent] = f.values.journal.parents;
    if (entry === undefined || parent === undefined) throw new Error('expected reading witnesses');
    if (kind.startsWith('contradictory')) {
      if (kind === 'contradictory-entry-status') Object.assign(entry, { completeEntryReading: 'carried-by-exact-entry-hashes' });
      else Object.assign(parent, { scopeReading: 'carried-by-exact-parent-and-entry-hashes' });
    } else {
      carryReadings(f);
      if (kind === 'duplicate-prior') {
        const [prior] = f.values.prior.entries;
        if (prior === undefined) throw new Error('expected prior entry');
        f.values.prior.entries.push(structuredClone(prior));
        f.values.journal.priorJournalHash = digest(JSON.stringify(f.values.prior));
      } else if (kind === 'changed-prior') {
        const [prior] = f.values.prior.entries;
        if (prior === undefined) throw new Error('expected prior witness');
        Object.assign(prior, { sourceHash: digest('other') });
        f.values.journal.priorJournalHash = digest(JSON.stringify(f.values.prior));
      } else Object.assign(parent, { priorJournalHash: digest('other') });
      if (kind !== 'parent-carry-hash') {
        const priorJournalHash = f.values.journal.priorJournalHash;
        Object.assign(entry, { priorJournalHash });
        f.values.journal.parents.forEach(row => Object.assign(row, { priorJournalHash }));
      }
    }
    expect((await refusal(async () => await buildPreparationRootInputs(f.request()))).kind).toBe('reading-provenance');
  } })),
  it({ name: 'keeps native singleton dispatch structural instead of manufacturing a question', fn: async () => {
    await using f = await fixture({ implicitFirst: true });
    const inputs = await buildPreparationRootInputs(f.request());
    const [first] = inputs.registry;
    if (first === undefined) throw new Error('expected structural registration');
    expect(first.dispatch).toBe('implicit');
    expect('question' in first).toBe(false);
    expect('questionDigest' in first).toBe(false);
  } }),
  it({ name: 'keeps empty-target insertion dispatch structural without inventing a receipt question', fn: async () => {
    await using f = await fixture({ emptyTarget: true });
    const inputs = await buildPreparationRootInputs(f.request());
    const empty = inputs.registry.find(record => record.dispatch === 'empty');
    expect(empty).toBeDefined();
    if (empty === undefined) throw new Error('expected empty-target registration');
    expect(empty.roles).toContain('writer-parent');
    expect('question' in empty).toBe(false);
    expect('questionDigest' in empty).toBe(false);
  } }),
  it({ name: 'groups exact repeated native questions without merging occurrence identities', fn: async () => {
    await using f = await fixture({ repeatedQuestions: true });
    const inputs = await buildPreparationRootInputs(f.request());
    expect(inputs.questionAliases).toHaveLength(1);
    expect(inputs.questionAliases[0]?.parentIds).toEqual(f.selection.orderedParentIds);
    expect(new Set(inputs.registry.map(item => item.parentId)).size).toBe(41);
  } }),
  it({ name: 'retains unaligned target definitions as namespace data rather than buying another parent', fn: async () => {
    await using f = await fixture({ targetNamespace: true });
    const inputs = await buildPreparationRootInputs(f.request());
    expect(inputs.unalignedDefinitions).toHaveLength(1);
    expect(inputs.unalignedDefinitions[0]?.source).toEqual([]);
    expect(inputs.unalignedDefinitions[0]?.target).toHaveLength(1);
    expect(inputs.unalignedDefinitions[0]?.target[0]?.zone).toBe('footnote-definition');
    expect(inputs.registry).toHaveLength(41);
  } }),
  it({ name: 'retains a missing unselected corpus side as an explicit exclusion with successful-side provenance', fn: async () => {
    await using f = await fixture();
    const excluded = [{ entryId: 'gap', kind: 'missing-corpus-side' }];
    Object.assign(f.selection, { exclusions: excluded });
    Object.assign(f.values.pool, { excluded: structuredClone(excluded) });
    f.selection.census.listed = 2;
    await writeFile(f.storePath, JSON.stringify({ files: { ...f.files, 'people/gap/page.md': 'Only original.' }, fail: '', listed: ['fixture', 'gap'] }));
    const inputs = await buildPreparationRootInputs(f.request());
    expect(inputs.excluded).toEqual(excluded);
    expect(inputs.rawDocuments).toHaveLength(3);
    expect(inputs.rawDocuments[2]?.relPath).toBe('people/gap/page.md');
  } }),
  ...[false, true].map(normalize => it({ name: `applies whole-page original eligibility before selected-parent lookup normalized=${normalize}`, fn: async () => {
    await using f = await fixture();
    const archive = normalize ? '<!-- (Origina\u200bl Language: English) -->\n\nCat.' : '<!-- (Original Language: English) -->\n\nCat.';
    const before = archiveOriginalReadingOf({ document: parseDocument({ text: archive }) });
    const target = passArchiveText({ text: archive, l });
    const after = archiveOriginalReadingOf({ document: parseDocument({ text: target }) });
    expect(before.kind).toBe(normalize ? 'none' : 'whole-page');
    expect(after.kind).toBe('whole-page');
    if (after.kind !== 'whole-page') throw new Error('expected whole-page control');
    const excluded = [{ entryId: 'original', kind: normalize ? 'normalized-whole-page-original' : 'production-whole-page-original', archiveHash: digest(archive),
      ...(normalize ? { targetHash: digest(target) } : {}), noteHash: digest(after.note) }];
    Object.assign(f.selection, { exclusions: excluded });
    Object.assign(f.values.pool, { excluded: structuredClone(excluded) });
    f.selection.census.listed = 2;
    await writeFile(f.storePath, JSON.stringify({ files: { ...f.files, 'people/original/page.md': 'Cat source.', 'people/original/page.en.md': archive }, fail: '', listed: ['fixture', 'original'] }));
    expect((await buildPreparationRootInputs(f.request())).excluded).toEqual(excluded);
  } })),
  it({ name: 'refuses native corpus listing failures without retaining private subprocess details', fn: async () => {
    await using f = await fixture();
    await writeFile(f.storePath, JSON.stringify({ files: f.files, fail: '', failListing: true }));
    const error = await refusal(async () => await buildPreparationRootInputs(f.request()));
    expect(error.kind).toBe('corpus-read');
    expect(error.input).toBe('people/');
    expect(inspect(error, { depth: null })).not.toContain('q7z9k2');
  } }),
  it({ name: 'refuses an eligible entry that the old frozen representation cannot identity-bind', fn: async () => {
    await using f = await fixture();
    f.selection.census.listed = 2;
    f.selection.census.eligibleEntries = 2;
    await writeFile(f.storePath, JSON.stringify({ files: { ...f.files, 'people/blank/page.md': '', 'people/blank/page.en.md': '' }, listed: ['fixture', 'blank'], fail: '' }));
    const error = await refusal(async () => await buildPreparationRootInputs(f.request()));
    expect(error.kind).toBe('population');
    expect(error.input).toBe('frozen entry identity coverage');
  } }),
  ...['json', 'utf8', 'array', 'order', 'ambiguous-frame'].map(kind => it({ name: `refuses invalid semantic role document ${kind}`, fn: async () => {
    await using f = await fixture();
    const request = f.request();
    const record = structuredClone(f.selection);
    const [poolReference, journalReference] = record.references;
    if (poolReference === undefined || journalReference === undefined) throw new Error('expected frozen role references');
    const artifacts = [...request.artifacts];
    const [first] = artifacts;
    if (first === undefined) throw new Error('expected role witness');
    if (kind === 'order') record.references = [journalReference, poolReference, ...record.references.slice(2)];
    else if (kind === 'ambiguous-frame') {
      const source = artifacts[3];
      if (source === undefined) throw new Error('expected frame witness');
      artifacts.push({ path: '/another/frame.md', content: new Uint8Array(source.content) });
      record.references.push({ path: '/another/frame.md', hash: createHash('sha256').update(source.content).digest('hex') });
    } else {
      const content = kind === 'utf8' ? new Uint8Array([255]) : new TextEncoder().encode(kind === 'array' ? '[]' : 'q7z9k2');
      artifacts[0] = { path: first.path, content };
      poolReference.hash = createHash('sha256').update(content).digest('hex');
    }
    const text = JSON.stringify(record);
    const error = await refusal(async () => await buildPreparationRootInputs({ ...request, text, expectedDigest: digest(text), artifacts }));
    expect(error.kind).toBe(kind === 'ambiguous-frame' ? 'reading-provenance' : 'reference-role');
    expect(inspect(error, { depth: null })).not.toContain('q7z9k2');
  } })),
  it({ name: 'snapshots relative clone location before logger callbacks change cwd and caller pin fields', fn: async () => {
    await using f = await fixture();
    const origin = process.cwd();
    const elsewhere = join(f.dir, 'elsewhere');
    await mkdir(elsewhere);
    using reset = { [Symbol.dispose]: () => { process.chdir(origin); } };
    const request = f.request();
    const pin = { ...request.pin, cloneDir: relative(origin, f.dir) };
    let changed = false;
    const logger = { ...l, debug(message: string) {
      l.debug(message);
      if (!changed) {
        changed = true;
        process.chdir(elsewhere);
        pin.cloneDir = '/changed-after-snapshot';
        pin.commitSha = 'invalid';
      }
    } };
    const [outcome] = await Promise.allSettled([buildPreparationRootInputs({ ...request, pin, l: logger })]);
    expect(changed).toBe(true);
    expect(outcome?.status).toBe('fulfilled');
    if (outcome?.status !== 'fulfilled') throw new Error('expected stable cloned corpus pin');
    expect(outcome.value.parents.map(parent => parent.id)).toEqual(f.selection.orderedParentIds);
  } }),
  it({ name: 'pins omitted native Git lookup before logger callbacks alter PATH', fn: async () => {
    await using f = await fixture();
    const request = f.request();
    const executable = request.pin.gitPath;
    const script = await readFile(executable, 'utf8');
    await writeFile(executable, `#!${process.execPath}\n${script.slice(script.indexOf('\n') + 1)}`);
    await symlink(executable, join(f.dir, 'git'));
    const previousPath = process.env.PATH;
    using reset = { [Symbol.dispose]: () => {
      if (previousPath === undefined) delete process.env.PATH;
      else process.env.PATH = previousPath;
    } };
    process.env.PATH = f.dir;
    let changed = false;
    const logger = { ...l, debug(message: string) {
      l.debug(message);
      changed = true;
      process.env.PATH = join(f.dir, 'unavailable');
    } };
    const pin = { cloneDir: f.dir, commitSha: CORPUS_COMMIT_SHA };
    const [outcome] = await Promise.allSettled([buildPreparationRootInputs({ ...request, pin, l: logger })]);
    expect(changed).toBe(true);
    expect(outcome?.status).toBe('fulfilled');
    if (outcome?.status !== 'fulfilled') throw new Error('expected snapshotted executable lookup');
    expect(outcome.value.parents).toHaveLength(40);
  } }),
  ...['revision', 'blank-clone', 'relative-executable', 'throwing-getter'].map(kind => it({ name: `refuses unsupported independent corpus pin ${kind}`, fn: async () => {
    await using f = await fixture();
    const request = f.request();
    const pin = { ...request.pin };
    if (kind === 'revision') pin.commitSha = 'different';
    else if (kind === 'blank-clone') pin.cloneDir = ' ';
    else if (kind === 'relative-executable') pin.gitPath = 'relative-git';
    else Object.defineProperty(pin, 'cloneDir', { get() { throw new Error('q7z9k2'); } });
    const error = await refusal(async () => await buildPreparationRootInputs({ ...request, pin }));
    expect(error.kind).toBe('corpus-identity');
    expect(inspect(error, { depth: null })).not.toContain('q7z9k2');
  } })),
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
