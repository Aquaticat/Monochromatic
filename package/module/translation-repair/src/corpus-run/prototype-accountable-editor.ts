// PROTOTYPE ONLY: five-payload accountable whole-document editor.

import { existsSync, } from 'node:fs';
import {
  mkdir,
  readFile,
  writeFile,
} from 'node:fs/promises';
import { join, } from 'node:path';

import { droppedContributorNameForms, } from '../contributor-name-authority.ts';
import {
  readCorpusFile,
  type CorpusPin,
} from '../corpus-source.ts';
import { hashContent, } from '../document-node.ts';
import { parseDocument, } from '../parse-document.ts';
import { photoReferences, } from '../photo-reference.ts';
import {
  applyPrototypePatches,
  reduceDossier,
  runPrototypeNode,
  type PrototypeNodeRecord,
} from '../prototype-accountable-editor-runtime.ts';
import {
  AUDIT_RESPONSE_FORMAT,
  COMMIT_RESPONSE_FORMAT,
  DRAFT_RESPONSE_FORMAT,
  isPrototypeAudit,
  isPrototypeCommit,
  isPrototypeDraft,
} from '../prototype-accountable-editor-wire.ts';
import type { RosterModelId, } from '../roster-id.ts';
import { droppedDestinations, } from './dropped-destinations.ts';
import { writeFileAtomic, } from './atomic-write.ts';
import { passArchiveText, } from './pass-archive.ts';
import { createRunClient, } from './run-config.ts';

const ENTRY_ID = 'Carena0442';
const PR_HEAD = 'a80634a674f94861ea3b7056fba054ca9eab1a2c';
const EDITOR: RosterModelId = 'hf:moonshotai/Kimi-K3';
const AUDITORS = [
  ['fidelity', 'hf:zai-org/GLM-5.3-Flash',],
  ['expression', 'deepseek-v4-pro-0813',],
  ['continuity', 'hf:Qwen/Qwen3.8-27B',],
] as const satisfies readonly (readonly [string, RosterModelId])[];

function auditInstruction({ role, }: { readonly role: string; }): string {
  if (role === 'fidelity')
    return 'Find only wrong meaning, omission, addition, identity, attribution, or source-evidence defects.';
  if (role === 'expression')
    return 'Find only grammar, usage, concrete register mismatch, or unclear English expression defects.';
  return 'Find only unclear references, tense inconsistency, chronology, repetition, or broken paragraph relations.';
}

async function writeResult(
  {
    outputDir,
    value,
  }: {
    readonly outputDir: string;
    readonly value: Record<string, unknown>;
  },
): Promise<void> {
  await writeFileAtomic({ path: join(outputDir, 'result.json',), text: `${JSON.stringify(value, null, 2,)}\n`, },);
}

async function runPrototype(
  {
    outputDir,
    records,
  }: {
    readonly outputDir: string;
    readonly records: PrototypeNodeRecord[];
  },
): Promise<void> {
  const startedAt = Date.now();
  const cloneDir = process.env.TRANSLATION_REPAIR_CORPUS_DIR ?? '';
  if (cloneDir === '')
    throw new Error('set TRANSLATION_REPAIR_CORPUS_DIR');
  const pin: CorpusPin = { cloneDir, commitSha: PR_HEAD, };
  const [sourceText, archiveRaw,] = await Promise.all([
    readCorpusFile({ pin, relPath: `people/${ENTRY_ID}/page.md`, },),
    readCorpusFile({ pin, relPath: `people/${ENTRY_ID}/page.en.md`, },),
  ],);
  const archiveText = passArchiveText({ text: archiveRaw, },);
  const sourcePictures = photoReferences({ text: sourceText, });
  const signal = new AbortController().signal;
  const client = createRunClient({ promptPayloadDir: join(outputDir, 'prompt-payloads',), },);
  await writeFile(join(outputDir, 'manifest.json',), `${JSON.stringify({
    version: 1,
    prototype: 'accountable-editor-a',
    entryId: ENTRY_ID,
    sourceDigest: hashContent({ content: sourceText, },),
    archiveDigest: hashContent({ content: archiveText, },),
    mediaReferenceCount: sourcePictures.length,
    nodes: [
      { id: 'draft', modelId: EDITOR, },
      ...AUDITORS.map(([role, modelId,],) => ({ id: `audit-${role}`, modelId, })),
      { id: 'commit', modelId: EDITOR, },
    ],
  }, null, 2,)}\n`,);

  const draft = await runPrototypeNode({
    outputDir,
    records,
    client,
    id: 'draft',
    modelId: EDITOR,
    messages: [
      { role: 'system', content: 'You are the accountable editor for one memorial page. Produce complete publication-ready English from the source. Preserve Markdown, MDX, links, images, front matter, identities, contributor forms, and source meaning. The archive is evidence, not authority over the source. Return no alternatives.', },
      { role: 'user', content: `SOURCE CHINESE:\n${sourceText}\n\nEXISTING ENGLISH ARCHIVE:\n${archiveText}\n\nReturn the complete English document and a brief private note.`, },
    ],
    responseFormat: DRAFT_RESPONSE_FORMAT,
    validate: isPrototypeDraft,
    signal,
  },);
  await writeFile(join(outputDir, 'draft.md',), draft.document,);

  const audits = await Promise.all(AUDITORS.map(async ([role, modelId,],) => ({
    role,
    modelId,
    audit: await runPrototypeNode({
      outputDir,
      records,
      client,
      id: `audit-${role}`,
      modelId,
      messages: [
        { role: 'system', content: `You are the ${role} specialist. ${auditInstruction({ role, },)} Report concrete defects only. targetQuote must be one exact nonempty substring of DRAFT. sourceQuote must be exact SOURCE substring when source evidence applies, otherwise empty. Do not score, approve, rewrite, or discuss general quality.`, },
        { role: 'user', content: `SOURCE:\n${sourceText}\n\nARCHIVE CONTEXT:\n${archiveText}\n\nDRAFT:\n${draft.document}`, },
      ],
      responseFormat: AUDIT_RESPONSE_FORMAT,
      validate: isPrototypeAudit,
      signal,
    },),
  }),),);
  const dossier = reduceDossier({
    sourceText,
    draftText: draft.document,
    findings: audits.flatMap(({ role, audit, },) => audit.findings.map((finding,) => ({ role, ...finding, })),),
  },);
  await writeFile(join(outputDir, 'audits.json',), `${JSON.stringify(audits, null, 2,)}\n`,);
  await writeFile(join(outputDir, 'dossier.json',), `${JSON.stringify(dossier, null, 2,)}\n`,);

  const commit = await runPrototypeNode({
    outputDir,
    records,
    client,
    id: 'commit',
    modelId: EDITOR,
    messages: [
      { role: 'system', content: 'You are the same accountable editor. Resolve every dossier item in one finite patch transaction. Each before value must be one exact nonempty substring of DRAFT and occur exactly once. Keep patches minimal and non-overlapping. Every dossier id must appear in resolvedFindingIds and in at least one patch findingIds. Do not rewrite untouched text. Return no unresolved item and no alternative.', },
      { role: 'user', content: `SOURCE:\n${sourceText}\n\nDRAFT:\n${draft.document}\n\nDOSSIER:\n${JSON.stringify(dossier,)}`, },
    ],
    responseFormat: COMMIT_RESPONSE_FORMAT,
    validate: isPrototypeCommit,
    signal,
  },);
  const findingIds = new Set(dossier.map(({ id, },) => id,));
  const resolved = new Set(commit.resolvedFindingIds,);
  if ((resolved.size !== findingIds.size) || [...findingIds].some((id,) => !resolved.has(id,)))
    throw new Error('prototype commit did not resolve exact dossier ids');
  const patchedIds = new Set(commit.patches.flatMap(({ findingIds: ids, },) => ids,));
  if ([...findingIds].some((id,) => !patchedIds.has(id,)))
    throw new Error('prototype commit left finding without patch');
  const finalText = applyPrototypePatches({ text: draft.document, patches: commit.patches, findingIds, },);

  parseDocument({ text: finalText, },);
  const destinationCheck = droppedDestinations({ sourceText, pageText: finalText, },);
  if (destinationCheck.dropped.length > 0)
    throw new Error(`prototype dropped ${String(destinationCheck.dropped.length,)} source destinations`);
  const droppedContributors = droppedContributorNameForms({ archiveText, candidateText: finalText, },);
  if (droppedContributors.length > 0)
    throw new Error(`prototype dropped ${String(droppedContributors.length,)} contributor forms`);
  const finalPictures = new Set(photoReferences({ text: finalText, }).map(({ assetName, },) => assetName,));
  if (sourcePictures.some(({ assetName, },) => !finalPictures.has(assetName,)))
    throw new Error('prototype dropped source media reference');

  const pagePath = join(outputDir, 'fixed', 'people', ENTRY_ID, 'page.en.md',);
  await mkdir(join(outputDir, 'fixed', 'people', ENTRY_ID,), { recursive: true, },);
  await writeFile(join(outputDir, 'commit.json',), `${JSON.stringify(commit, null, 2,)}\n`,);
  await writeFileAtomic({ path: pagePath, text: finalText, },);
  const readback = await readFile(pagePath, 'utf8',);
  if (readback !== finalText)
    throw new Error('prototype publication readback differs');
  const orderedRecords = records.toSorted((left, right,) => manifestPosition(left.id,) - manifestPosition(right.id,));
  await writeResult({ outputDir, value: {
    prototype: 'accountable-editor-a',
    status: 'written-pending-output-review',
    nodesTotal: orderedRecords.length,
    freshPayloadsAcrossRun: orderedRecords.length,
    invocationDurationMs: Date.now() - startedAt,
    elapsedFromFirstNodeMs: Date.now() - Date.parse(orderedRecords[0]?.startedAt ?? new Date().toISOString(),),
    findingCount: dossier.length,
    patchCount: commit.patches.length,
    mediaReferenceCount: sourcePictures.length,
    finalDigest: hashContent({ content: finalText, },),
    nodes: orderedRecords,
  }, },);
  console.log(`PROTOTYPE ${ENTRY_ID} design=A status=written-pending-output-review payloads=${String(orderedRecords.length,)} findings=${String(dossier.length,)} patches=${String(commit.patches.length,)} ms=${String(Date.now() - startedAt,)}`,);
}

function manifestPosition(id: string,): number {
  const order = ['draft', 'audit-fidelity', 'audit-expression', 'audit-continuity', 'commit',];
  return order.indexOf(id,);
}

async function loadCompletedRecords(
  { outputDir, }: { readonly outputDir: string; },
): Promise<PrototypeNodeRecord[]> {
  const records: PrototypeNodeRecord[] = [];
  for (const id of ['draft', 'audit-fidelity', 'audit-expression', 'audit-continuity', 'commit',]) {
    try {
      const parsed: unknown = JSON.parse(await readFile(join(outputDir, `node-${id}.json`,), 'utf8',),);
      if ((typeof parsed === 'object') && (parsed !== null) && ('state' in parsed) && (parsed.state === 'completed'))
        records.push(parsed as PrototypeNodeRecord,);
    }
    catch {
      continue;
    }
  }
  return records;
}

const outputDir = process.env.TRANSLATION_REPAIR_PROTOTYPE_DIR ?? '';
const resume = process.env.TRANSLATION_REPAIR_PROTOTYPE_RESUME === '1';
if (outputDir === '')
  throw new Error('set TRANSLATION_REPAIR_PROTOTYPE_DIR');
if (existsSync(outputDir,) && (!resume))
  throw new Error('prototype output root must be fresh');
await mkdir(outputDir, { recursive: true, },);
const records = resume ? await loadCompletedRecords({ outputDir, },) : [];
const invocationStartedAt = Date.now();
try {
  await runPrototype({ outputDir, records, },);
}
catch (error) {
  await writeResult({ outputDir, value: {
    prototype: 'accountable-editor-a',
    status: 'suspended',
    cause: String(error,),
    invocationDurationMs: Date.now() - invocationStartedAt,
    completedNodes: records.toSorted((left, right,) => manifestPosition(left.id,) - manifestPosition(right.id,)),
    resumeAuthority: records.length > 0
      ? 'unfinished-node-from-same-manifest'
      : 'new-external-evidence-or-human-authorized-plan',
  }, },);
  console.log(`PROTOTYPE ${ENTRY_ID} design=A status=suspended completedNodes=${String(records.length,)}`,);
}
