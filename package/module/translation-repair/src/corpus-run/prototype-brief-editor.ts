// PROTOTYPE ONLY: Candidate C brief-before-prose finite dependency graph.

import {
  mkdir,
  readFile,
} from 'node:fs/promises';
import { join, } from 'node:path';

import {
  type CorpusPin,
  readCorpusFile,
} from '../corpus-source.ts';
import { hashContent, } from '../document-node.ts';
import { photoReferences, } from '../photo-reference.ts';
import {
  gatherPrototypeMedia,
  prototypeBriefMessages,
  prototypeEditorMessages,
} from '../prototype-brief-editor-input.ts';
import {
  BRIEF_NODES,
  buildEditorialPacket,
  EDITOR_NODES,
  selectFixedPriorityEditor,
  validateBriefEditorCandidate,
  validatePreparationBrief,
} from '../prototype-brief-editor-plan.ts';
import { runBriefEditorLocalControls, } from '../prototype-brief-editor-controls.ts';
import { publishBriefEditorPrototype, } from '../prototype-brief-editor-publication.ts';
import { createPrototypeBriefEditorScriptedClient, } from '../prototype-brief-editor-scripted-client.ts';
import {
  executeStructuredNode,
  type BriefEditorNodeRecord,
  restartStructuredNode,
  settleStructuredNode,
  writePrototypeJson,
} from '../prototype-brief-editor-runtime.ts';
import {
  BRIEF_EDITOR_RESPONSE_FORMAT,
  isBriefEditorDocument,
  isPreparationBrief,
  PREPARATION_BRIEF_RESPONSE_FORMAT,
  type BriefEditorDocument,
  type PreparationBrief,
} from '../prototype-brief-editor-wire.ts';
import { passArchiveText, } from './pass-archive.ts';
import { createRunClient, } from './run-config.ts';

const ENTRY_ID = 'Carena0442';
const PR_HEAD = 'a80634a674f94861ea3b7056fba054ca9eab1a2c';

type NodeState<ValueT,> = {
  readonly record: BriefEditorNodeRecord;
  readonly value?: ValueT;
};

const outputDir = process.env.TRANSLATION_REPAIR_PROTOTYPE_DIR ?? '';
if (outputDir === '')
  throw new Error('set TRANSLATION_REPAIR_PROTOTYPE_DIR');
const cloneDir = process.env.TRANSLATION_REPAIR_CORPUS_DIR ?? '';
if (cloneDir === '')
  throw new Error('set TRANSLATION_REPAIR_CORPUS_DIR');
const restart = process.env.TRANSLATION_REPAIR_PROTOTYPE_RESTART === '1';
if (!restart) {
  try {
    await mkdir(outputDir,);
  }
  catch (error) {
    if (Error.isError(error,) && ('code' in error) && (error.code === 'EEXIST'))
      throw new Error('prototype output root must be fresh');
    throw error;
  }
}
const startedAt = Date.now();
runBriefEditorLocalControls();
const pin: CorpusPin = { cloneDir, commitSha: PR_HEAD, };
const [sourceText, archiveRaw,] = await Promise.all([
  readCorpusFile({ pin, relPath: `people/${ENTRY_ID}/page.md`, },),
  readCorpusFile({ pin, relPath: `people/${ENTRY_ID}/page.en.md`, },),
]);
const archiveText = passArchiveText({ text: archiveRaw, },);
const sourcePictures = photoReferences({ text: sourceText, });
const media = await gatherPrototypeMedia({ pin, entryId: ENTRY_ID, sourceText, },);
const manifestPlan = {
  version: 1,
  prototype: 'brief-before-prose-c',
  entryId: ENTRY_ID,
  sourceDigest: hashContent({ content: sourceText, },),
  archiveDigest: hashContent({ content: archiveText, },),
  media: media.map(function manifest(item,) { return { assetName: item.assetName, digest: item.digest, }; },),
  waves: [BRIEF_NODES, EDITOR_NODES,],
} as const;
const manifestDigest = hashContent({ content: JSON.stringify(manifestPlan,), },);
if (restart) {
  const stored = JSON.parse(await readFile(join(outputDir, 'manifest.json',), 'utf8',),) as {
    readonly manifestDigest?: string;
  };
  if (stored.manifestDigest !== manifestDigest)
    throw new Error('restart manifest digest differs');
}
else
  await writePrototypeJson({ path: join(outputDir, 'manifest.json',), value: { manifestDigest, ...manifestPlan, }, },);
const client = process.env.TRANSLATION_REPAIR_PROTOTYPE_SCRIPTED === '1'
  ? createPrototypeBriefEditorScriptedClient({ sourceText, archiveText, })
  : createRunClient({
    promptPayloadDir: join(outputDir, 'prompt-payloads',),
    retryPolicy: { limit: 0, baseMs: 0, },
  },);
const controller = new AbortController();
process.once('SIGINT', function abortOnSigint() { controller.abort(new Error('caller abort: SIGINT'),); },);
process.once('SIGTERM', function abortOnSigterm() { controller.abort(new Error('caller abort: SIGTERM'),); },);
const { signal, } = controller;
const mediaNames = new Set(media.map(function name(item,) { return item.assetName; },),);

const briefStates = await Promise.all(BRIEF_NODES.map(async function runBrief(node,): Promise<NodeState<PreparationBrief>> {
  const messages = prototypeBriefMessages({ node, sourceText, archiveText, media, },);
  if (restart) {
    const stored = await restartStructuredNode({
      outputDir,
      id: node.id,
      modelId: node.modelId,
      manifestDigest,
      messages,
      responseFormat: PREPARATION_BRIEF_RESPONSE_FORMAT,
      validate: isPreparationBrief,
      signal,
    },);
    if (stored.kind !== 'pending') {
      if (stored.kind === 'usable') {
        validatePreparationBrief({
          brief: stored.value,
          sourceText,
          archiveText,
          mediaNames,
          domains: new Set(node.domains,),
          defectClasses: new Set(node.defectClasses,),
        },);
        return { record: stored.record, value: stored.value, };
      }
      return { record: stored.record, };
    }
  }
  const execution = await executeStructuredNode({
    outputDir,
    client,
    id: node.id,
    modelId: node.modelId,
    manifestDigest,
    messages,
    responseFormat: PREPARATION_BRIEF_RESPONSE_FORMAT,
    validate: isPreparationBrief,
    signal,
  },);
  if (execution.kind === 'unusable')
    return { record: execution.record, };
  try {
    validatePreparationBrief({
      brief: execution.value,
      sourceText,
      archiveText,
      mediaNames,
      domains: new Set(node.domains,),
      defectClasses: new Set(node.defectClasses,),
    },);
  }
  catch (error) {
    const record = await settleStructuredNode({
      outputDir,
      execution,
      usable: false,
      failureType: error instanceof Error ? error.constructor.name : 'unknown',
      failure: error,
    },);
    return { record, };
  }
  const record = await settleStructuredNode({ outputDir, execution, usable: true, },);
  return { record, value: execution.value, };
},));
const usableBriefs = new Map<string, PreparationBrief>();
for (const [index, state,] of briefStates.entries()) {
  const node = BRIEF_NODES[index];
  if ((node !== undefined) && (state.value !== undefined))
    usableBriefs.set(node.id, state.value,);
}
const packet = buildEditorialPacket({
  sourceText,
  archiveText,
  mediaNames: [...mediaNames,],
  briefs: usableBriefs,
},);
await writePrototypeJson({ path: join(outputDir, 'editorial-packet.json',), value: packet, },);
const editorMessages = prototypeEditorMessages({ sourceText, archiveText, packet, media, },);
const editorStates = await Promise.all(EDITOR_NODES.map(async function runEditor(node,): Promise<NodeState<BriefEditorDocument>> {
  if (restart) {
    const stored = await restartStructuredNode({
      outputDir,
      id: node.id,
      modelId: node.modelId,
      manifestDigest,
      messages: editorMessages,
      responseFormat: BRIEF_EDITOR_RESPONSE_FORMAT,
      validate: isBriefEditorDocument,
      signal,
    },);
    if (stored.kind !== 'pending') {
      if (stored.kind === 'usable') {
        validateBriefEditorCandidate({
          response: stored.value,
          packet,
          sourceText,
          archiveText,
          sourcePictures,
        },);
        return { record: stored.record, value: stored.value, };
      }
      return { record: stored.record, };
    }
  }
  const execution = await executeStructuredNode({
    outputDir,
    client,
    id: node.id,
    modelId: node.modelId,
    manifestDigest,
    messages: editorMessages,
    responseFormat: BRIEF_EDITOR_RESPONSE_FORMAT,
    validate: isBriefEditorDocument,
    signal,
  },);
  if (execution.kind === 'unusable')
    return { record: execution.record, };
  try {
    validateBriefEditorCandidate({
      response: execution.value,
      packet,
      sourceText,
      archiveText,
      sourcePictures,
    },);
  }
  catch (error) {
    const record = await settleStructuredNode({
      outputDir,
      execution,
      usable: false,
      failureType: error instanceof Error ? error.constructor.name : 'unknown',
      failure: error,
    },);
    return { record, };
  }
  const record = await settleStructuredNode({ outputDir, execution, usable: true, },);
  return { record, value: execution.value, };
},));
const usableEditors = new Map<string, BriefEditorDocument>();
for (const [index, state,] of editorStates.entries()) {
  const node = EDITOR_NODES[index];
  if ((node !== undefined) && (state.value !== undefined))
    usableEditors.set(node.id, state.value,);
}
const selected = selectFixedPriorityEditor({ usable: usableEditors, });
const records = [...briefStates, ...editorStates,].map(function record(state,) { return state.record; },);
if (selected === undefined) {
  await writePrototypeJson({ path: join(outputDir, 'result.json',), value: {
    prototype: 'brief-before-prose-c',
    status: 'production-unavailable',
    nodeRecords: records,
    invocationDurationMs: Date.now() - startedAt,
  }, },);
  throw new Error('ProductionUnavailableError: both finite document editors were unusable');
}
await publishBriefEditorPrototype({
  outputDir,
  entryId: ENTRY_ID,
  manifestDigest,
  selected,
  editorValues: usableEditors,
  records,
  usableBriefs: usableBriefs.size,
  startedAt,
  signal,
},);
