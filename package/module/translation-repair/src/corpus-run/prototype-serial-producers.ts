// PROTOTYPE ONLY: corrected Candidate A with serial complete-document producers.

import {
  mkdir,
  readFile,
} from 'node:fs/promises';
import { join, } from 'node:path';

import {
  readCorpusFile,
  type CorpusPin,
} from '../corpus-source.ts';
import { hashContent, } from '../document-node.ts';
import { photoReferences, } from '../photo-reference.ts';
import {
  applyProducerChanges,
  executeProducerNode,
  PrototypeProducerUnavailableError,
  recordCompletedProducer,
  type ExecutedProducer,
  type SerialProducerRecord,
} from '../prototype-serial-producer-runtime.ts';
import {
  loadSerialRestartState,
  runSerialLocalControls,
  serialProducerSystemInstruction,
  validateSerialCandidate,
} from '../prototype-serial-producer-plan.ts';
import type { RosterModelId, } from '../roster-id.ts';
import { writeFileAtomic, } from './atomic-write.ts';
import { passArchiveText, } from './pass-archive.ts';
import { createRunClient, } from './run-config.ts';

const ENTRY_ID = 'Carena0442';
const PR_HEAD = 'a80634a674f94861ea3b7056fba054ca9eab1a2c';
const PRODUCERS = [
  {
    id: 'whole',
    role: 'whole-document',
    modelId: 'hf:moonshotai/Kimi-K3',
    responsibility: 'Create complete publication-ready English with correct meaning, completeness, identity, grammar, references, tense, paragraph relations, register, and all document structure.',
    allowedKinds: [],
  },
  {
    id: 'fidelity',
    role: 'fidelity',
    modelId: 'deepseek-v4-pro-0813',
    responsibility: 'Correct wrong meaning, omission, addition, identity change, and attribution while preserving every sound choice.',
    allowedKinds: ['wrong-meaning', 'omission', 'addition', 'identity-change', 'attribution',],
  },
  {
    id: 'expression',
    role: 'expression',
    modelId: 'hf:openai/gpt-oss-120b',
    responsibility: 'Correct grammar, usage, unclear English expression, and concrete register mismatch while preserving meaning and every sound choice.',
    allowedKinds: ['grammar', 'usage', 'unclear-expression', 'register-mismatch',],
  },
  {
    id: 'continuity',
    role: 'continuity',
    modelId: 'hf:Qwen/Qwen3.8-27B',
    responsibility: 'Correct unclear references, tense inconsistency, chronology, unintended repetition, and broken paragraph relations while preserving meaning and every sound choice.',
    allowedKinds: ['unclear-reference', 'tense-inconsistency', 'chronology', 'repetition', 'paragraph-relation',],
  },
] as const satisfies readonly {
  readonly id: string;
  readonly role: string;
  readonly modelId: RosterModelId;
  readonly responsibility: string;
  readonly allowedKinds: readonly string[];
}[];

async function writeArtifact(
  { path, text, }: { readonly path: string; readonly text: string; },
): Promise<void> {
  await writeFileAtomic({ path, text, },);
}

async function writeResult(
  { outputDir, value, }: { readonly outputDir: string; readonly value: Record<string, unknown>; },
): Promise<void> {
  await writeFileAtomic({ path: join(outputDir, 'result.json',), text: `${JSON.stringify(value, null, 2,)}\n`, },);
}

const outputDir = process.env.TRANSLATION_REPAIR_PROTOTYPE_DIR ?? '';
if (outputDir === '')
  throw new Error('set TRANSLATION_REPAIR_PROTOTYPE_DIR');
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
runSerialLocalControls();
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
const client = createRunClient({ promptPayloadDir: join(outputDir, 'prompt-payloads',), },);
const controller = new AbortController();
process.once('SIGINT', function abortOnSigint(): void {
  controller.abort(new Error('caller abort: SIGINT'),);
},);
process.once('SIGTERM', function abortOnSigterm(): void {
  controller.abort(new Error('caller abort: SIGTERM'),);
},);
const { signal, } = controller;
const manifestPlan = {
  version: 2,
  prototype: 'serial-producers-a2',
  entryId: ENTRY_ID,
  sourceDigest: hashContent({ content: sourceText, },),
  archiveDigest: hashContent({ content: archiveText, },),
  mediaReferenceCount: sourcePictures.length,
  nodes: PRODUCERS,
} as const;
const manifestDigest = hashContent({ content: JSON.stringify(manifestPlan,), },);
let records: SerialProducerRecord[];
let current: string | undefined;
if (restart) {
  let priorResultText: string | undefined;
  try {
    priorResultText = await readFile(join(outputDir, 'result.json',), 'utf8',);
  }
  catch (error) {
    if (!(Error.isError(error,) && ('code' in error) && (error.code === 'ENOENT')))
      throw error;
  }
  if (priorResultText !== undefined) {
    const priorResult = JSON.parse(priorResultText,) as { readonly status?: string; };
    if (priorResult.status === 'written-pending-output-review')
      throw new Error('completed prototype root cannot restart');
  }
  const storedManifest = JSON.parse(await readFile(join(outputDir, 'manifest.json',), 'utf8',),) as {
    readonly manifestDigest?: string;
  };
  if (storedManifest.manifestDigest !== manifestDigest)
    throw new Error('restart manifest digest differs');
  const state = await loadSerialRestartState({
    outputDir,
    manifestDigest,
    producers: manifestPlan.nodes,
    sourceText,
    archiveText,
    sourcePictures,
    signal,
  },);
  records = state.records;
  current = state.current;
}
else {
  records = [];
  await writeArtifact({ path: join(outputDir, 'manifest.json',), text: `${JSON.stringify({
    manifestDigest,
    ...manifestPlan,
  }, null, 2,)}\n`, },);
}

for (const producer of manifestPlan.nodes) {
  if (records.some(function alreadySpent(record,) { return record.id === producer.id; },))
    continue;
  const prior = current;
  const messages = [
    { role: 'system' as const, content: serialProducerSystemInstruction({
      role: producer.role,
      responsibility: producer.responsibility,
      fallback: prior === undefined,
    },), },
    { role: 'user' as const, content: `SOURCE:\n${sourceText}\n\nARCHIVE EVIDENCE:\n${archiveText}\n\nPRIOR:\n${prior ?? '[NO PRIOR CANDIDATE]'}`, },
  ];
  let executed: ExecutedProducer;
  try {
    executed = await executeProducerNode({
      outputDir,
      records,
      client,
      id: producer.id,
      modelId: producer.modelId,
      manifestDigest,
      messages,
      signal,
    },);
  }
  catch (error) {
    if (signal.aborted)
      throw signal.reason;
    if (!(error instanceof PrototypeProducerUnavailableError))
      throw error;
    await writeArtifact({ path: join(outputDir, `diagnostic-${producer.id}.json`,), text: `${JSON.stringify({
      id: producer.id,
      state: 'spent-unusable',
      errorType: error.constructor.name,
    }, null, 2,)}\n`, },);
    continue;
  }
  let candidate: string;
  try {
    candidate = prior === undefined
      ? (() => {
        if (executed.response.changes.length !== 0)
          throw new Error('fallback producer returned change transaction without prior');
        return executed.response.document;
      })()
      : applyProducerChanges({
        prior,
        sourceText,
        response: executed.response,
        allowedKinds: new Set(producer.allowedKinds,),
      },);
    validateSerialCandidate({ sourceText, archiveText, sourcePictures, candidate, },);
  }
  catch (error) {
    await writeArtifact({ path: join(outputDir, `diagnostic-${producer.id}.json`,), text: `${JSON.stringify({
      id: producer.id,
      state: 'spent-unusable',
      errorType: error instanceof Error ? error.constructor.name : 'unknown',
    }, null, 2,)}\n`, },);
    await writeArtifact({ path: join(outputDir, `decision-${producer.id}.json`,), text: `${JSON.stringify({
      id: producer.id,
      modelId: producer.modelId,
      manifestDigest,
      promptDigest: executed.record.promptDigest,
      adopted: false,
      priorDigest: prior === undefined ? null : hashContent({ content: prior, },),
      responseDigest: hashContent({ content: JSON.stringify(executed.response,), },),
      editCount: executed.response.changes.length,
    }, null, 2,)}\n`, },);
    await recordCompletedProducer({ outputDir, records, executed, adopted: false, },);
    continue;
  }
  await writeArtifact({ path: join(outputDir, `candidate-${producer.id}.md`,), text: candidate, },);
  await writeArtifact({ path: join(outputDir, `decision-${producer.id}.json`,), text: `${JSON.stringify({
    id: producer.id,
    modelId: producer.modelId,
    manifestDigest,
    promptDigest: executed.record.promptDigest,
    adopted: true,
    priorDigest: prior === undefined ? null : hashContent({ content: prior, },),
    responseDigest: hashContent({ content: JSON.stringify(executed.response,), },),
    candidateDigest: hashContent({ content: candidate, },),
    editCount: executed.response.changes.length,
  }, null, 2,)}\n`, },);
  await recordCompletedProducer({ outputDir, records, executed, adopted: true, },);
  current = candidate;
}

if (current === undefined) {
  await writeResult({ outputDir, value: {
    prototype: 'serial-producers-a2',
    status: 'production-unavailable',
    exhaustedNodes: records.map(function nodeId(record,) { return record.id; },),
    invocationDurationMs: Date.now() - startedAt,
  }, },);
  throw new Error('ProductionUnavailableError: every finite producer was unusable');
}
const pagePath = join(outputDir, 'fixed', 'people', ENTRY_ID, 'page.en.md',);
try {
  await mkdir(join(outputDir, 'fixed', 'people', ENTRY_ID,), { recursive: true, },);
  await writeFileAtomic({ path: pagePath, text: current, },);
  if (await readFile(pagePath, 'utf8',) !== current)
    throw new Error('readback mismatch');
}
catch (error) {
  if (signal.aborted)
    throw signal.reason;
  throw new Error(`PublicationUnavailableError: ${error instanceof Error ? error.constructor.name : 'unknown'}`);
}
await writeResult({ outputDir, value: {
  prototype: 'serial-producers-a2',
  status: 'written-pending-output-review',
  payloadCeiling: PRODUCERS.length,
  spentNodes: records.length,
  providerPayloadCountSource: 'SPEND lines in process log',
  adoptedCandidates: records.filter(function adopted(record,) { return record.adopted; },).length,
  invocationDurationMs: Date.now() - startedAt,
  elapsedFromFirstNodeMs: Date.now() - Date.parse(records[0]?.startedAt ?? new Date().toISOString(),),
  finalDigest: hashContent({ content: current, },),
  nodes: records,
}, },);
console.log(`PROTOTYPE ${ENTRY_ID} design=A2 status=written-pending-output-review spentNodes=${String(records.length,)} adopted=${String(records.filter(function adopted(record,) { return record.adopted; },).length,)} ms=${String(Date.now() - startedAt,)}`,);
