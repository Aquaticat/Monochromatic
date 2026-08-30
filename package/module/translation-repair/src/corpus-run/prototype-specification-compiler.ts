// PROTOTYPE ONLY: Candidate B finite specification compiler.

import { mkdir, readFile, } from 'node:fs/promises';
import { join, } from 'node:path';

import { type CorpusPin, readCorpusFile, } from '../corpus-source.ts';
import { hashContent, } from '../document-node.ts';
import { photoReferences, } from '../photo-reference.ts';
import { gatherPrototypeMedia, } from '../prototype-brief-editor-input.ts';
import { sourceUnitsFor, } from '../prototype-brief-editor-plan.ts';
import { writePrototypeJson, } from '../prototype-brief-editor-runtime.ts';
import {
  buildCompilerSpecification,
  compilerBaseDigest,
  COMPILER_SPECIALISTS,
  RENDERER_NODE,
  selectCompilerFallback,
  SPECIFICATION_NODE,
} from '../prototype-spec-compiler-plan.ts';
import {
  type CompilerRoleDecision,
  publishSpecificationCompiler,
} from '../prototype-spec-compiler-publication.ts';
import { createSpecificationCompilerScriptedClient, } from '../prototype-spec-compiler-scripted-client.ts';
import {
  adoptCompilerRole,
  type LocatedCompilerChange,
} from '../prototype-spec-compiler-transaction.ts';
import {
  type CompilerDocument,
  MAX_COMPILER_DOCUMENT_CHARACTERS,
} from '../prototype-spec-compiler-wire.ts';
import {
  runRendererWave,
  runSpecialistWave,
  runSpecificationWave,
} from '../prototype-spec-compiler-waves.ts';
import { validateSerialCandidate, } from '../prototype-serial-producer-plan.ts';
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
const pin: CorpusPin = { cloneDir, commitSha: PR_HEAD, };
const [sourceText, archiveRaw,] = await Promise.all([
  readCorpusFile({ pin, relPath: `people/${ENTRY_ID}/page.md`, },),
  readCorpusFile({ pin, relPath: `people/${ENTRY_ID}/page.en.md`, },),
]);
const archiveText = passArchiveText({ text: archiveRaw, },);
const sourceUnits = sourceUnitsFor({ sourceText, });
const sourcePictures = photoReferences({ text: sourceText, });
const media = await gatherPrototypeMedia({ pin, entryId: ENTRY_ID, sourceText, },);
const manifestPlan = {
  version: 1,
  prototype: 'specification-compiler-b',
  validator: 'specification-compiler-v1',
  entryId: ENTRY_ID,
  sourceDigest: hashContent({ content: sourceText, },),
  archiveDigest: hashContent({ content: archiveText, },),
  sourceUnitIds: sourceUnits.map(function id(unit,) { return unit.id; },),
  media: media.map(function item(mediaItem,) {
    return { assetName: mediaItem.assetName, digest: mediaItem.digest, };
  },),
  waves: [[SPECIFICATION_NODE,], [RENDERER_NODE,], COMPILER_SPECIALISTS,],
  specificationFallback: 'raw-source-units',
  retryLimit: 0,
  outputEnvelope: {
    maxDocumentCharacters: MAX_COMPILER_DOCUMENT_CHARACTERS,
    maxRealizations: 128,
    maxChanges: 64,
  },
} as const;
const manifestDigest = hashContent({ content: JSON.stringify(manifestPlan,), },);
if (restart) {
  const stored: unknown = JSON.parse(await readFile(join(outputDir, 'manifest.json',), 'utf8',),);
  if ((typeof stored !== 'object') || (stored === null)
    || (!('manifestDigest' in stored)) || (stored.manifestDigest !== manifestDigest))
    throw new Error('restart manifest digest differs');
}
else
  await writePrototypeJson({ path: join(outputDir, 'manifest.json',), value: { manifestDigest, ...manifestPlan, }, },);
const scripted = process.env.TRANSLATION_REPAIR_PROTOTYPE_SCRIPTED;
const client = scripted === undefined
  ? createRunClient({
    promptPayloadDir: join(outputDir, 'prompt-payloads',),
    retryPolicy: { limit: 0, baseMs: 0, },
  },)
  : createSpecificationCompilerScriptedClient({
    sourceText,
    archiveText,
    rendererInvalid: scripted === 'renderer-invalid',
    specificationInvalid: scripted === 'specification-invalid',
  },);
const controller = new AbortController();
process.once('SIGINT', function abortOnSigint() { controller.abort(new Error('caller abort: SIGINT'),); },);
process.once('SIGTERM', function abortOnSigterm() { controller.abort(new Error('caller abort: SIGTERM'),); },);
const { signal, } = controller;
const specificationState = await runSpecificationWave({
  outputDir,
  client,
  manifestDigest,
  sourceText,
  archiveText,
  sourceUnits,
  media,
  restart,
  signal,
},);
const specification = buildCompilerSpecification({
  sourceText,
  archiveText,
  mediaNames: media.map(function name(item,) { return item.assetName; },),
  ...(specificationState.value === undefined ? {} : { response: specificationState.value, }),
},);
await writePrototypeJson({ path: join(outputDir, 'specification.json',), value: specification, },);
const rendererState = await runRendererWave({
  outputDir,
  client,
  manifestDigest,
  sourceText,
  archiveText,
  sourceUnits,
  sourcePictures,
  specification,
  media,
  restart,
  signal,
},);
const base = rendererState.value?.document;
const baseDigest = base === undefined ? null : compilerBaseDigest({ base, });
const specialistStates = await runSpecialistWave({
  outputDir,
  client,
  manifestDigest,
  sourceText,
  archiveText,
  sourceUnits,
  sourcePictures,
  specification,
  ...(base === undefined ? {} : { base, }),
  baseDigest,
  media,
  restart,
  signal,
},);
const records = [specificationState.record, rendererState.record, ...specialistStates.map(function record(state,) {
  return state.record;
},),];
const decisions: CompilerRoleDecision[] = [];
let finalDocument: string | undefined;
let selectedFallback: string | undefined;
if (base === undefined) {
  const usable = new Map<string, CompilerDocument>();
  for (const [index, state,] of specialistStates.entries()) {
    const specialist = COMPILER_SPECIALISTS[index];
    if ((specialist !== undefined) && (state.value !== undefined))
      usable.set(specialist.id, state.value,);
  }
  const selected = selectCompilerFallback({ usable, });
  finalDocument = selected?.value.document;
  selectedFallback = selected?.id;
  for (const specialist of COMPILER_SPECIALISTS) {
    const value = usable.get(specialist.id,);
    decisions.push({
      id: specialist.id,
      applied: specialist.id === selectedFallback,
      beforeDigest: 'absent',
      afterDigest: value === undefined ? 'absent' : hashContent({ content: value.document, }),
      ...(value === undefined ? { failureType: 'UnusableResponse', } : {}),
    },);
  }
}
else {
  finalDocument = base;
  let accepted: readonly LocatedCompilerChange[] = [];
  decisions.push({
    id: RENDERER_NODE.id,
    applied: true,
    beforeDigest: 'absent',
    afterDigest: hashContent({ content: base, }),
  },);
  for (const specialist of COMPILER_SPECIALISTS.toSorted(function priority(left, right,) {
    return left.priority - right.priority;
  },)) {
    const index = COMPILER_SPECIALISTS.findIndex(function same(node,) { return node.id === specialist.id; },);
    const state = specialistStates[index];
    const beforeDigest = hashContent({ content: finalDocument, });
    if ((state?.value === undefined) || (state.located === undefined)) {
      decisions.push({
        id: specialist.id,
        applied: false,
        beforeDigest,
        afterDigest: beforeDigest,
        failureType: state?.record.failureType ?? 'UnusableResponse',
      },);
      continue;
    }
    const adopted = adoptCompilerRole({
      current: finalDocument,
      accepted,
      response: state.value,
      located: state.located,
      validate: function validateMerged(document,) {
        validateSerialCandidate({ sourceText, archiveText, sourcePictures, candidate: document, },);
      },
    },);
    finalDocument = adopted.document;
    accepted = adopted.accepted;
    decisions.push({
      id: specialist.id,
      applied: adopted.applied,
      beforeDigest,
      afterDigest: hashContent({ content: finalDocument, }),
      ...(adopted.failureType === undefined ? {} : { failureType: adopted.failureType, }),
    },);
  }
}
if (finalDocument === undefined) {
  await writePrototypeJson({ path: join(outputDir, 'result.json',), value: {
    prototype: 'specification-compiler-b',
    status: 'production-unavailable',
    manifestDigest,
    specificationStatus: specification.status,
    nodeRecords: records,
    decisions,
    invocationDurationMs: Date.now() - startedAt,
  }, },);
  throw new Error('ProductionUnavailableError: renderer and finite fallback producers were unusable');
}
await publishSpecificationCompiler({
  outputDir,
  entryId: ENTRY_ID,
  manifestDigest,
  document: finalDocument,
  records,
  decisions,
  startedAt,
  specificationStatus: specification.status,
  ...(selectedFallback === undefined ? {} : { selectedFallback, }),
  signal,
},);
