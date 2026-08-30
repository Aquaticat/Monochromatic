// PROTOTYPE ONLY: MiniMax M3 Hyper reserve author and auditor evaluation.

import { mkdir, readFile, } from 'node:fs/promises';
import { join, } from 'node:path';

import type { CorpusPin, } from '../corpus-source.ts';
import { readCorpusFile, } from '../corpus-source.ts';
import { hashContent, } from '../document-node.ts';
import { answerCeilingFor, } from '../hyper-catalog.ts';
import { photoReferences, } from '../photo-reference.ts';
import type { ConditionalCandidate, } from '../prototype-conditional-audit-model.ts';
import {
  conditionalAuditMessages,
  type ConditionalAuditNode,
} from '../prototype-conditional-audit-plan.ts';
import { runConditionalAuditNode, } from '../prototype-conditional-audit-wave.ts';
import { gatherPrototypeMedia, } from '../prototype-brief-editor-input.ts';
import { writePrototypeJson, } from '../prototype-brief-editor-runtime.ts';
import { compileSlotDocument, } from '../prototype-slot-compile.ts';
import type { SlotDocumentResponse, } from '../prototype-slot-model.ts';
import { buildImmutableShell, } from '../prototype-slot-shell.ts';
import type { SlotAuthorNode, } from '../prototype-slot-plan.ts';
import { slotAuthorMessages, } from '../prototype-slot-plan.ts';
import { runSlotCandidateNode, } from '../prototype-slot-wave.ts';
import { slotDocumentGuard, slotResponseFormat, } from '../prototype-slot-wire.ts';
import { writeFileAtomic, } from './atomic-write.ts';
import { passArchiveText, } from './pass-archive.ts';
import { createRunClient, } from './run-config.ts';

const ENTRY_ID = 'Carena0442';
const PR_HEAD = 'a80634a674f94861ea3b7056fba054ca9eab1a2c';
const AUTHOR_NODE: SlotAuthorNode = {
  id: 'minimax-reserve-author',
  modelId: 'minimax-m3',
  priority: 2,
  role: 'Candidate E Hyper reserve immutable-shell author under evaluation',
};
const AUDITOR_NODE: ConditionalAuditNode = {
  id: 'minimax-reserve-auditor',
  modelId: 'minimax-m3',
  role: 'Candidate E full-contract source, language, relation, and register reserve auditor under evaluation',
};

function requiredEnvironment({ name, }: { readonly name: string; }): string {
  const value = process.env[name] ?? '';
  if (value === '')
    throw new Error(`set ${name}`);
  return value;
}

async function retainedCandidate(
  {
    root,
    responseId,
    id,
    modelId,
    priority,
    shell,
  }: {
    readonly root: string;
    readonly responseId: string;
    readonly id: string;
    readonly modelId: ConditionalCandidate['modelId'];
    readonly priority: number;
    readonly shell: ReturnType<typeof buildImmutableShell>;
  },
): Promise<ConditionalCandidate> {
  const response = JSON.parse(
    await readFile(join(root, `response-${responseId}.json`,), 'utf8',),
  ) as SlotDocumentResponse;
  return {
    id,
    modelId,
    priority,
    response,
    document: compileSlotDocument({ shell, response, }),
  };
}

const outputDir = requiredEnvironment({ name: 'TRANSLATION_REPAIR_PROTOTYPE_DIR', });
const cloneDir = requiredEnvironment({ name: 'TRANSLATION_REPAIR_CORPUS_DIR', });
const d1Root = requiredEnvironment({ name: 'TRANSLATION_REPAIR_PROTOTYPE_D1_DIR', });
try {
  await mkdir(outputDir,);
}
catch (error) {
  if (Error.isError(error,) && ('code' in error) && (error.code === 'EEXIST'))
    throw new Error('prototype output root must be fresh');
  throw error;
}
const startedAt = Date.now();
const pin: CorpusPin = { cloneDir, commitSha: PR_HEAD, };
const [sourceText, archiveRaw,] = await Promise.all([
  readCorpusFile({ pin, relPath: `people/${ENTRY_ID}/page.md`, },),
  readCorpusFile({ pin, relPath: `people/${ENTRY_ID}/page.en.md`, },),
]);
const archiveText = passArchiveText({ text: archiveRaw, });
const shell = buildImmutableShell({ sourceText, archiveText, });
const sourcePictures = photoReferences({ text: sourceText, });
const media = await gatherPrototypeMedia({ pin, entryId: ENTRY_ID, sourceText, });
const auditCandidates = await Promise.all([
  retainedCandidate({
    root: d1Root,
    responseId: 'primary-author',
    id: 'primary-author',
    modelId: 'hf:moonshotai/Kimi-K3',
    priority: 0,
    shell,
  },),
  retainedCandidate({
    root: d1Root,
    responseId: 'fallback-author',
    id: 'fallback-author',
    modelId: 'hf:Qwen/Qwen3.8-27B',
    priority: 1,
    shell,
  },),
  retainedCandidate({
    root: d1Root,
    responseId: 'reserve-author',
    id: 'reserve-author',
    modelId: 'hf:zai-org/GLM-5.3-Flash',
    priority: 2,
    shell,
  },),
]);
const manifestPlan = {
  version: 1,
  prototype: 'hyper-reserve-minimax-evaluation',
  entryId: ENTRY_ID,
  corpusCommit: PR_HEAD,
  sourceDigest: hashContent({ content: sourceText, }),
  archiveDigest: hashContent({ content: archiveText, }),
  shellDigest: shell.shellDigest,
  media: media.map(function item(value,) { return { assetName: value.assetName, digest: value.digest, }; },),
  nodes: [AUTHOR_NODE, AUDITOR_NODE,],
  retainedAuditCandidateDigests: auditCandidates.map(function candidate(value,) {
    return { id: value.id, digest: hashContent({ content: value.document, }), };
  },),
  providerSelection: 'hyper-only',
  maxOutputTokensRequest: answerCeilingFor({ modelId: 'minimax-m3', }),
  payloadCeiling: 2,
  dependencyWaves: 1,
  retryLimit: 0,
} as const;
const manifestDigest = hashContent({ content: JSON.stringify(manifestPlan,), },);
await writePrototypeJson({ path: join(outputDir, 'manifest.json',), value: { manifestDigest, ...manifestPlan, }, },);
const client = createRunClient({
  promptPayloadDir: join(outputDir, 'prompt-payloads',),
  retryPolicy: { limit: 0, baseMs: 0, },
  providerSelection: 'hyper-only',
},);
const controller = new AbortController();
process.once('SIGINT', function abortOnSigint() { controller.abort(new Error('caller abort: SIGINT'),); },);
process.once('SIGTERM', function abortOnSigterm() { controller.abort(new Error('caller abort: SIGTERM'),); },);
const { signal, } = controller;
const [authorState, auditState,] = await Promise.all([
  runSlotCandidateNode({
    outputDir,
    client,
    node: AUTHOR_NODE,
    manifestDigest,
    messages: slotAuthorMessages({ node: AUTHOR_NODE, shell, sourceText, archiveText, media, }),
    responseFormat: slotResponseFormat({ shell, }),
    validate: slotDocumentGuard({ shell, }),
    shell,
    sourceText,
    archiveText,
    sourcePictures,
    restart: false,
    signal,
  },),
  runConditionalAuditNode({
    outputDir,
    client,
    stage: 'author-audit',
    node: AUDITOR_NODE,
    manifestDigest,
    messages: conditionalAuditMessages({
      node: AUDITOR_NODE,
      shell,
      sourceText,
      archiveText,
      candidates: auditCandidates,
      media,
    },),
    shell,
    candidates: auditCandidates,
    restart: false,
    signal,
  },),
]);
if (authorState.document !== undefined) {
  const candidateDir = join(outputDir, 'candidate', 'people', ENTRY_ID,);
  await mkdir(candidateDir, { recursive: true, },);
  await writeFileAtomic({ path: join(candidateDir, 'page.en.md',), text: authorState.document, },);
}
const auditFindingCounts = Object.fromEntries(auditCandidates.map(function count(candidate,) {
  return [candidate.id, auditState.response?.candidates[candidate.id]?.findings.length ?? null,];
},),);
const accepted = (authorState.document !== undefined) && (auditState.response !== undefined);
const result = {
  prototype: manifestPlan.prototype,
  status: accepted ? 'validation-completed-pending-page-review' : 'validation-rejected',
  manifestDigest,
  payloadCeiling: manifestPlan.payloadCeiling,
  dependencyWaves: manifestPlan.dependencyWaves,
  providerSelection: manifestPlan.providerSelection,
  authorUsable: authorState.document !== undefined,
  authorDigest: authorState.document === undefined ? null : hashContent({ content: authorState.document, }),
  auditorUsable: auditState.response !== undefined,
  auditFindingCounts,
  rejectedFindingCount: auditState.rejectedFindingCount,
  nodeRecords: [authorState.record, auditState.record,],
  invocationDurationMs: Date.now() - startedAt,
};
await writePrototypeJson({ path: join(outputDir, 'result.json',), value: result, },);
console.log(`PROTOTYPE ${ENTRY_ID} reserve=minimax-m3 status=${result.status} author=${String(result.authorUsable,)} auditor=${String(result.auditorUsable,)} ms=${String(result.invocationDurationMs,)}`,);
if (!accepted)
  throw new Error('HyperReserveValidationError: MiniMax M3 author or auditor unusable');
