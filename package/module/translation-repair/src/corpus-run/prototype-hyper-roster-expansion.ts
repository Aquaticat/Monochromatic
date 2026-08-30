// PROTOTYPE ONLY: equal-depth Hyper out-of-roster model validation on pinned Carena.

import { mkdir, readdir, readFile, } from 'node:fs/promises';
import { join, } from 'node:path';

import type { CorpusPin, } from '../corpus-source.ts';
import { readCorpusFile, } from '../corpus-source.ts';
import { hashContent, } from '../document-node.ts';
import { photoReferences, } from '../photo-reference.ts';
import { promptPayloadStore, } from '../prompt-payload-store.ts';
import { promptUniqueClient, } from '../prompt-uniqueness-client.ts';
import type { ConditionalCandidate, } from '../prototype-conditional-audit-model.ts';
import {
  conditionalAuditMessages,
  type ConditionalAuditNode,
} from '../prototype-conditional-audit-plan.ts';
import { runConditionalAuditNode, } from '../prototype-conditional-audit-wave.ts';
import { gatherPrototypeMedia, } from '../prototype-brief-editor-input.ts';
import { writePrototypeJson, } from '../prototype-brief-editor-runtime.ts';
import {
  createHyperExpansionClient,
  type HyperExpansionModel,
} from '../prototype-hyper-expansion-client.ts';
import { compileSlotDocument, } from '../prototype-slot-compile.ts';
import type { SlotDocumentResponse, } from '../prototype-slot-model.ts';
import { buildImmutableShell, } from '../prototype-slot-shell.ts';
import type { SlotAuthorNode, } from '../prototype-slot-plan.ts';
import { slotAuthorMessages, } from '../prototype-slot-plan.ts';
import { runSlotCandidateNode, } from '../prototype-slot-wave.ts';
import { slotDocumentGuard, slotResponseFormat, } from '../prototype-slot-wire.ts';
import type { RosterModelId, } from '../roster-id.ts';
import { writeFileAtomic, } from './atomic-write.ts';
import { passArchiveText, } from './pass-archive.ts';

const ENTRY_ID = 'Carena0442';
const PR_HEAD = 'a80634a674f94861ea3b7056fba054ca9eab1a2c';
const PROJECT_OUTPUT_CEILING = 32_000;
const MODELS = [
  { id: 'qwen3.6-flash', providerOutputTokens: 64_000, family: 'qwen', },
  { id: 'qwen3.6-plus', providerOutputTokens: 64_000, family: 'qwen', },
  { id: 'qwen3.7-flash', providerOutputTokens: 64_000, family: 'qwen', },
  { id: 'qwen3.7-plus', providerOutputTokens: 64_000, family: 'qwen', },
  { id: 'qwen3.8-flash', providerOutputTokens: 128_000, family: 'qwen', },
] as const;

type EvaluationModel = typeof MODELS[number];

/** Reads required runtime setting without exposing value. */
function requiredEnvironment({ name, }: { readonly name: string; }): string {
  const value = process.env[name] ?? '';
  if (value === '')
    throw new Error(`set ${name}`);
  return value;
}

/**
 * Carries pre-adoption provider id through prototype runtime's roster-typed seam.
 * Production client still refuses same id because no catalog row is added.
 */
function evaluationModelId({ id, }: { readonly id: string; }): RosterModelId {
  return id as RosterModelId;
}

/** Returns request ceiling shared by manifest and transport. */
function requestOutputTokens({ model, }: { readonly model: EvaluationModel; }): number {
  return Math.min(model.providerOutputTokens, PROJECT_OUTPUT_CEILING,);
}

/** Builds complete-author node for one evaluated model. */
function authorNode({ model, }: { readonly model: EvaluationModel; }): SlotAuthorNode {
  return {
    id: `expansion-${model.id}-author`,
    modelId: evaluationModelId({ id: model.id, }),
    priority: 2,
    role: 'Candidate E out-of-roster Hyper immutable-shell author under equal-depth evaluation',
  };
}

/** Builds quote-bound auditor node for one evaluated model. */
function auditorNode({ model, }: { readonly model: EvaluationModel; }): ConditionalAuditNode {
  return {
    id: `expansion-${model.id}-auditor`,
    modelId: evaluationModelId({ id: model.id, }),
    role: 'Candidate E out-of-roster full-contract quote-bound auditor under equal-depth evaluation',
  };
}

/** Counts completed durable payloads without mistaking plan for measurement. */
async function completedPromptPayloads({ dir, }: { readonly dir: string; }): Promise<number> {
  try {
    return (await readdir(dir, { withFileTypes: true, },))
      .filter(function payload(entry,) { return entry.isFile() && entry.name.endsWith('.json'); },)
      .length;
  }
  catch (error) {
    if (Error.isError(error,) && ('code' in error) && (error.code === 'ENOENT'))
      return 0;
    throw error;
  }
}

/** Reads and compiles one retained D1 audit candidate. */
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
const apiKey = requiredEnvironment({ name: 'TRANSLATION_REPAIR_CHARM_HYPER_API_KEY', });
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
const modelPlan = MODELS.map(function plan(model,) {
  return {
    id: model.id,
    family: model.family,
    providerOutputTokens: model.providerOutputTokens,
    requestOutputTokens: requestOutputTokens({ model, }),
    authorNode: authorNode({ model, }),
    auditorNode: auditorNode({ model, }),
  };
},);
const manifestPlan = {
  version: 1,
  prototype: 'hyper-roster-expansion-evaluation',
  entryId: ENTRY_ID,
  corpusCommit: PR_HEAD,
  sourceDigest: hashContent({ content: sourceText, }),
  archiveDigest: hashContent({ content: archiveText, }),
  shellDigest: shell.shellDigest,
  media: media.map(function item(value,) { return { assetName: value.assetName, digest: value.digest, }; },),
  retainedAuditCandidateDigests: auditCandidates.map(function candidate(value,) {
    return { id: value.id, digest: hashContent({ content: value.document, }), };
  },),
  endpoint: 'https://hyper.charm.land/v1/messages',
  models: modelPlan,
  payloadCeiling: MODELS.length * 2,
  dependencyWaves: 1,
  retryLimit: 0,
} as const;
const manifestDigest = hashContent({ content: JSON.stringify(manifestPlan,), },);
await writePrototypeJson({ path: join(outputDir, 'manifest.json',), value: { manifestDigest, ...manifestPlan, }, },);
const expansionModels: readonly HyperExpansionModel[] = modelPlan.map(function model(value,) {
  return { id: value.id, requestOutputTokens: value.requestOutputTokens, };
},);
const client = promptUniqueClient({
  inner: createHyperExpansionClient({ apiKey, models: expansionModels, }),
  store: promptPayloadStore({ dir: join(outputDir, 'prompt-payloads',), }),
},);
const controller = new AbortController();
process.once('SIGINT', function abortOnSigint() { controller.abort(new Error('caller abort: SIGINT'),); },);
process.once('SIGTERM', function abortOnSigterm() { controller.abort(new Error('caller abort: SIGTERM'),); },);
const { signal, } = controller;
const evaluations = await Promise.all(modelPlan.map(async function evaluate(model,) {
  const [authorState, auditState,] = await Promise.all([
    runSlotCandidateNode({
      outputDir,
      client,
      node: model.authorNode,
      manifestDigest,
      messages: slotAuthorMessages({
        node: model.authorNode,
        shell,
        sourceText,
        archiveText,
        media,
      },),
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
      node: model.auditorNode,
      manifestDigest,
      messages: conditionalAuditMessages({
        node: model.auditorNode,
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
    const candidateDir = join(outputDir, 'candidate', model.id, 'people', ENTRY_ID,);
    await mkdir(candidateDir, { recursive: true, },);
    await writeFileAtomic({ path: join(candidateDir, 'page.en.md',), text: authorState.document, },);
  }
  const auditFindingCounts = Object.fromEntries(auditCandidates.map(function count(candidate,) {
    return [candidate.id, auditState.response?.candidates[candidate.id]?.findings.length ?? null,];
  },),);
  return {
    id: model.id,
    family: model.family,
    requestOutputTokens: model.requestOutputTokens,
    authorUsable: authorState.document !== undefined,
    authorDigest: authorState.document === undefined
      ? null
      : hashContent({ content: authorState.document, }),
    auditorUsable: auditState.response !== undefined,
    auditFindingCounts,
    rejectedFindingCount: auditState.rejectedFindingCount,
    nodeRecords: [authorState.record, auditState.record,],
  };
},));
const result = {
  prototype: manifestPlan.prototype,
  status: 'validation-completed-pending-page-review',
  manifestDigest,
  payloadCeiling: manifestPlan.payloadCeiling,
  dependencyWaves: manifestPlan.dependencyWaves,
  completedPromptPayloads: await completedPromptPayloads({
    dir: join(outputDir, 'prompt-payloads',),
  },),
  evaluations,
  invocationDurationMs: Date.now() - startedAt,
};
await writePrototypeJson({ path: join(outputDir, 'result.json',), value: result, },);
const authorCount = evaluations.filter(function usable(value,) { return value.authorUsable; },).length;
const auditorCount = evaluations.filter(function usable(value,) { return value.auditorUsable; },).length;
console.log(`PROTOTYPE ${ENTRY_ID} roster-expansion authors=${String(authorCount,)}/${String(MODELS.length,)} auditors=${String(auditorCount,)}/${String(MODELS.length,)} ms=${String(result.invocationDurationMs,)}`,);
