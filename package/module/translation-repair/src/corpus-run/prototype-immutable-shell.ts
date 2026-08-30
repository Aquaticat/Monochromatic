// PROTOTYPE ONLY: Candidate D immutable-shell finite candidate graph.

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
} from '../prototype-brief-editor-input.ts';
import { writePrototypeJson, } from '../prototype-brief-editor-runtime.ts';
import { runSlotLocalControls, } from '../prototype-slot-controls.ts';
import {
  selectSlotAuthor,
  slotAuthorMessages,
  slotCopyEditorMessages,
  slotReviserMessages,
  SLOT_AUTHOR_NODES,
  SLOT_COPY_EDITOR_NODE,
  SLOT_REVISER_NODE,
} from '../prototype-slot-plan.ts';
import { publishSlotPrototype, } from '../prototype-slot-publication.ts';
import { runSlotCandidateNode, type SlotState, } from '../prototype-slot-wave.ts';
import { createSlotScriptedClient, } from '../prototype-slot-scripted-client.ts';
import type { SlotDocumentResponse, } from '../prototype-slot-model.ts';
import { buildImmutableShell, } from '../prototype-slot-shell.ts';
import {
  slotDocumentGuard,
  slotResponseFormat,
} from '../prototype-slot-wire.ts';
import { passArchiveText, } from './pass-archive.ts';
import { createRunClient, } from './run-config.ts';

const ENTRY_ID = 'Carena0442';
const PR_HEAD = 'a80634a674f94861ea3b7056fba054ca9eab1a2c';

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
runSlotLocalControls();
const pin: CorpusPin = { cloneDir, commitSha: PR_HEAD, };
const [sourceText, archiveRaw,] = await Promise.all([
  readCorpusFile({ pin, relPath: `people/${ENTRY_ID}/page.md`, },),
  readCorpusFile({ pin, relPath: `people/${ENTRY_ID}/page.en.md`, },),
]);
const archiveText = passArchiveText({ text: archiveRaw, },);
const sourcePictures = photoReferences({ text: sourceText, });
const media = await gatherPrototypeMedia({ pin, entryId: ENTRY_ID, sourceText, },);
const shell = buildImmutableShell({ sourceText, archiveText, });
const responseFormat = slotResponseFormat({ shell, });
const manifestPlan = {
  version: 1,
  prototype: 'immutable-shell-slot-compiler-d',
  validator: 'immutable-shell-v4',
  entryId: ENTRY_ID,
  sourceDigest: hashContent({ content: sourceText, }),
  archiveDigest: hashContent({ content: archiveText, }),
  shellDigest: shell.shellDigest,
  slotKeys: shell.slots.map(function key(slot,) { return slot.key; },),
  media: media.map(function manifest(item,) { return { assetName: item.assetName, digest: item.digest, }; },),
  waves: [SLOT_AUTHOR_NODES, [SLOT_REVISER_NODE,], [SLOT_COPY_EDITOR_NODE,],],
  retryLimit: 0,
} as const;
const manifestDigest = hashContent({ content: JSON.stringify(manifestPlan,), },);
if (restart) {
  const stored = JSON.parse(await readFile(join(outputDir, 'manifest.json',), 'utf8',),) as {
    readonly manifestDigest?: string;
  };
  if (stored.manifestDigest !== manifestDigest)
    throw new Error('immutable shell restart manifest digest differs');
}
else
  await writePrototypeJson({ path: join(outputDir, 'manifest.json',), value: { manifestDigest, ...manifestPlan, }, },);
const scripted = process.env.TRANSLATION_REPAIR_PROTOTYPE_SCRIPTED;
const primaryAuthor = SLOT_AUTHOR_NODES[0];
if (primaryAuthor === undefined)
  throw new Error('immutable shell primary author is absent');
const sourceEchoAuthors = scripted === 'primary-source-echo'
  ? new Set([primaryAuthor.id,])
  : new Set<string>();
const presentationArtifactAuthors = scripted === 'primary-presentation-artifact'
  ? new Set([primaryAuthor.id,])
  : new Set<string>();
const invalidAuthors = scripted === 'reviser-invalid'
  ? new Set([SLOT_REVISER_NODE.id,])
  : scripted === 'copy-editor-invalid'
    ? new Set([SLOT_COPY_EDITOR_NODE.id,])
    : scripted === 'reviser-copy-editor-invalid'
      ? new Set([SLOT_REVISER_NODE.id, SLOT_COPY_EDITOR_NODE.id,])
  : scripted === 'primary-invalid'
  ? new Set(['primary-author',])
  : scripted === 'primary-fallback-invalid'
    ? new Set(['primary-author', 'fallback-author',])
    : scripted === 'all-invalid'
      ? new Set(SLOT_AUTHOR_NODES.map(function id(node,) { return node.id; },))
      : new Set<string>();
const client = scripted === undefined
  ? createRunClient({
    promptPayloadDir: join(outputDir, 'prompt-payloads',),
    retryPolicy: { limit: 0, baseMs: 0, },
  },)
  : createSlotScriptedClient({
      shell,
      invalidAuthors,
      sourceEchoAuthors,
      presentationArtifactAuthors,
      hang: scripted === 'hang',
    },);
const controller = new AbortController();
process.once('SIGINT', function abortOnSigint() { controller.abort(new Error('caller abort: SIGINT'),); },);
process.once('SIGTERM', function abortOnSigterm() { controller.abort(new Error('caller abort: SIGTERM'),); },);
const { signal, } = controller;

const states = await Promise.all(SLOT_AUTHOR_NODES.map(async function runAuthor(node,): Promise<SlotState> {
  return await runSlotCandidateNode({
    outputDir,
    client,
    node,
    manifestDigest,
    messages: slotAuthorMessages({ node, shell, sourceText, archiveText, media, }),
    responseFormat,
    validate: slotDocumentGuard({ shell, }),
    shell,
    sourceText,
    archiveText,
    sourcePictures,
    restart,
    signal,
  },);
},));
const usable = new Map<string, { readonly response: SlotDocumentResponse; readonly document: string; }>();
for (const [index, state,] of states.entries()) {
  const node = SLOT_AUTHOR_NODES[index];
  if ((node !== undefined) && (state.value !== undefined) && (state.document !== undefined))
    usable.set(node.id, { response: state.value, document: state.document, },);
}
const selected = selectSlotAuthor({ usable, });
const authorRecords = states.map(function record(state,) { return state.record; },);
if (selected === undefined) {
  await writePrototypeJson({ path: join(outputDir, 'result.json',), value: {
    prototype: 'immutable-shell-slot-compiler-d',
    status: 'production-unavailable',
    payloadCeiling: SLOT_AUTHOR_NODES.length + 2,
    dependencyWaves: 3,
    manifestDigest,
    slotCount: shell.slots.length,
    nodeRecords: authorRecords,
    unattemptedNodes: [SLOT_REVISER_NODE.id, SLOT_COPY_EDITOR_NODE.id,],
    invocationDurationMs: Date.now() - startedAt,
  }, },);
  throw new Error('ProductionUnavailableError: every finite immutable-shell author was unusable');
}
const reviserState = await runSlotCandidateNode({
  outputDir,
  client,
  node: SLOT_REVISER_NODE,
  manifestDigest,
  messages: slotReviserMessages({
    shell,
    sourceText,
    archiveText,
    baseResponse: selected.response,
    baseDocument: selected.document,
    media,
  },),
  responseFormat,
  validate: slotDocumentGuard({ shell, }),
  shell,
  sourceText,
  archiveText,
  sourcePictures,
  restart,
  signal,
},);
const currentResponse = reviserState.value ?? selected.response;
const currentDocument = reviserState.document ?? selected.document;
const copyEditorState = await runSlotCandidateNode({
  outputDir,
  client,
  node: SLOT_COPY_EDITOR_NODE,
  manifestDigest,
  messages: slotCopyEditorMessages({
    shell,
    sourceText,
    archiveText,
    currentResponse,
    currentDocument,
    media,
  },),
  responseFormat,
  validate: slotDocumentGuard({ shell, }),
  shell,
  sourceText,
  archiveText,
  sourcePictures,
  restart,
  signal,
},);
const finalDocument = copyEditorState.document ?? currentDocument;
await publishSlotPrototype({
  outputDir,
  entryId: ENTRY_ID,
  manifestDigest,
  selectedAuthor: selected,
  finalDocument,
  ...(reviserState.document === undefined ? {} : { reviserDocument: reviserState.document, }),
  ...(copyEditorState.document === undefined ? {} : { copyEditorDocument: copyEditorState.document, }),
  usable,
  records: [...authorRecords, reviserState.record, copyEditorState.record,],
  slotCount: shell.slots.length,
  startedAt,
  signal,
},);
