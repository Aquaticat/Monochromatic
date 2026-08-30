// PROTOTYPE ONLY: Candidate E retained-output auditor calibration.

import { mkdir, readFile, } from 'node:fs/promises';
import { join, } from 'node:path';

import {
  confirmConditionalFindings,
  selectConditionalBaseline,
  shouldAdoptConditionalResolution,
} from '../prototype-conditional-audit.ts';
import type {
  ConditionalAuditResponse,
  ConditionalCandidate,
} from '../prototype-conditional-audit-model.ts';
import {
  conditionalAuditGuard,
  conditionalAuditMessages,
  CONDITIONAL_AUDIT_NODES,
  conditionalAuditResponseFormat,
} from '../prototype-conditional-audit-plan.ts';
import { gatherPrototypeMedia, } from '../prototype-brief-editor-input.ts';
import { writePrototypeJson, } from '../prototype-brief-editor-runtime.ts';
import { compileSlotDocument, } from '../prototype-slot-compile.ts';
import type { SlotDocumentResponse, } from '../prototype-slot-model.ts';
import {
  executeSlotNode,
  settleSlotNode,
  type SlotNodeRecord,
} from '../prototype-slot-runtime.ts';
import { buildImmutableShell, } from '../prototype-slot-shell.ts';
import { hashContent, } from '../document-node.ts';
import type { CorpusPin, } from '../corpus-source.ts';
import { readCorpusFile, } from '../corpus-source.ts';
import { createRunClient, } from './run-config.ts';

const ENTRY_ID = 'Carena0442';
const PR_HEAD = 'a80634a674f94861ea3b7056fba054ca9eab1a2c';

function requiredEnvironment({ name, }: { readonly name: string; }): string {
  const value = process.env[name] ?? '';
  if (value === '')
    throw new Error(`set ${name}`);
  return value;
}

async function readCandidate(
  {
    root,
    id,
    outputId,
    modelId,
    priority,
    shell,
  }: {
    readonly root: string;
    readonly id: string;
    readonly outputId: string;
    readonly modelId: ConditionalCandidate['modelId'];
    readonly priority: number;
    readonly shell: ReturnType<typeof buildImmutableShell>;
  },
): Promise<ConditionalCandidate> {
  const response = JSON.parse(
    await readFile(join(root, `response-${id}.json`,), 'utf8',),
  ) as SlotDocumentResponse;
  return {
    id: outputId,
    modelId,
    priority,
    response,
    document: compileSlotDocument({ shell, response, }),
  };
}

function damageCalibrationCandidate(
  {
    baseline,
    shell,
  }: {
    readonly baseline: ConditionalCandidate;
    readonly shell: ReturnType<typeof buildImmutableShell>;
  },
): { readonly candidate: ConditionalCandidate; readonly plantedSlots: readonly string[]; } {
  const replacements = [
    { key: 's0', before: 'Carena', after: 'Morgan', },
    { key: 's2', before: 'marks the passing', after: 'will mark the passing', },
    { key: 's10', before: '', after: ' The university awarded her a medal.', },
  ] as const;
  const slots = replacements.reduce(function replace(current, replacement,) {
    const value = current[replacement.key];
    if (value === undefined)
      throw new Error(`calibration damage slot absent: ${replacement.key}`);
    if ((replacement.before !== '') && !value.includes(replacement.before,))
      throw new Error(`calibration damage anchor absent: ${replacement.key}`);
    return {
      ...current,
      [replacement.key]: replacement.before === ''
        ? `${value}${replacement.after}`
        : value.replace(replacement.before, replacement.after,),
    };
  }, { ...baseline.response.slots, },);
  const response: SlotDocumentResponse = { slots, };
  return {
    candidate: {
      id: 'damaged',
      modelId: baseline.modelId,
      priority: 1,
      response,
      document: compileSlotDocument({ shell, response, }),
    },
    plantedSlots: replacements.map(function key(item,) { return item.key; },),
  };
}

const outputDir = requiredEnvironment({ name: 'TRANSLATION_REPAIR_PROTOTYPE_DIR', });
const cloneDir = requiredEnvironment({ name: 'TRANSLATION_REPAIR_CORPUS_DIR', });
const d1Root = requiredEnvironment({ name: 'TRANSLATION_REPAIR_PROTOTYPE_D1_DIR', });
const d13Root = requiredEnvironment({ name: 'TRANSLATION_REPAIR_PROTOTYPE_D13_DIR', });
await mkdir(outputDir,);
const startedAt = Date.now();
const pin: CorpusPin = { cloneDir, commitSha: PR_HEAD, };
const [sourceText, archiveText,] = await Promise.all([
  readCorpusFile({ pin, relPath: `people/${ENTRY_ID}/page.md`, },),
  readCorpusFile({ pin, relPath: `people/${ENTRY_ID}/page.en.md`, },),
]);
const shell = buildImmutableShell({ sourceText, archiveText, });
const media = await gatherPrototypeMedia({ pin, entryId: ENTRY_ID, sourceText, });
const d1Candidates = await Promise.all([
  readCandidate({
    root: d1Root,
    id: 'primary-author',
    outputId: 'primary-author',
    modelId: 'hf:moonshotai/Kimi-K3',
    priority: 0,
    shell,
  },),
  readCandidate({
    root: d1Root,
    id: 'fallback-author',
    outputId: 'fallback-author',
    modelId: 'hf:Qwen/Qwen3.8-27B',
    priority: 1,
    shell,
  },),
  readCandidate({
    root: d1Root,
    id: 'reserve-author',
    outputId: 'reserve-author',
    modelId: 'hf:zai-org/GLM-5.3-Flash',
    priority: 2,
    shell,
  },),
]);
const d13Baseline = await readCandidate({
  root: d13Root,
  id: 'final-reviser',
  outputId: 'baseline',
  modelId: 'hf:moonshotai/Kimi-K3',
  priority: 0,
  shell,
},);
const d13Resolution = await readCandidate({
  root: d13Root,
  id: 'final-copy-editor',
  outputId: 'resolution',
  modelId: 'hf:Qwen/Qwen3.8-27B',
  priority: 1,
  shell,
},);
const seededBaseline = { ...d13Baseline, id: 'baseline', priority: 0, };
const seededDamage = damageCalibrationCandidate({ baseline: seededBaseline, shell, });
const datasets = [
  { id: 'd1-selection', candidates: d1Candidates, },
  { id: 'd13-post', candidates: [d13Baseline, d13Resolution,], },
  { id: 'seeded-positive', candidates: [seededBaseline, seededDamage.candidate,], },
] as const;
const manifestPlan = {
  version: 1,
  prototype: 'conditional-shell-audit-calibration-e',
  entryId: ENTRY_ID,
  sourceDigest: hashContent({ content: sourceText, }),
  archiveDigest: hashContent({ content: archiveText, }),
  shellDigest: shell.shellDigest,
  datasets: datasets.map(function dataset(item,) {
    return {
      id: item.id,
      candidates: item.candidates.map(function candidate(value,) {
        return { id: value.id, digest: hashContent({ content: value.document, }), priority: value.priority, };
      },),
    };
  },),
  auditors: CONDITIONAL_AUDIT_NODES,
  quorumByUsableAuditors: { 3: 2, 2: 2, 1: 0, 0: 0, },
  payloadCeiling: datasets.length * CONDITIONAL_AUDIT_NODES.length,
  dependencyWaves: 1,
  retryLimit: 0,
} as const;
const manifestDigest = hashContent({ content: JSON.stringify(manifestPlan,), },);
await writePrototypeJson({
  path: join(outputDir, 'manifest.json',),
  value: { manifestDigest, ...manifestPlan, },
},);
const client = createRunClient({
  promptPayloadDir: join(outputDir, 'prompt-payloads',),
  retryPolicy: { limit: 0, baseMs: 0, },
},);
const controller = new AbortController();
process.once('SIGINT', function abortOnSigint() { controller.abort(new Error('caller abort: SIGINT'),); },);
process.once('SIGTERM', function abortOnSigterm() { controller.abort(new Error('caller abort: SIGTERM'),); },);
const { signal, } = controller;
const outcomes = await Promise.all(datasets.flatMap(function dataset(item,) {
  return CONDITIONAL_AUDIT_NODES.map(async function audit(node,) {
    const id = `${item.id}-${node.id}`;
    const responseFormat = conditionalAuditResponseFormat({ shell, candidates: item.candidates, });
    const execution = await executeSlotNode({
      outputDir,
      client,
      id,
      modelId: node.modelId,
      manifestDigest,
      messages: conditionalAuditMessages({
        node,
        shell,
        sourceText,
        archiveText,
        candidates: item.candidates,
        media,
      },),
      responseFormat,
      validate: conditionalAuditGuard({ shell, candidates: item.candidates, }),
      signal,
    },);
    if (execution.kind === 'unusable')
      return { datasetId: item.id, nodeId: node.id, record: execution.record, };
    const record = await settleSlotNode({ outputDir, execution, usable: true, },);
    return { datasetId: item.id, nodeId: node.id, record, response: execution.value, };
  },);
},),);
const records: readonly SlotNodeRecord[] = outcomes.map(function record(outcome,) { return outcome.record; },);
const responsesFor = function responsesFor(datasetId: string,): readonly ConditionalAuditResponse[] {
  return outcomes.flatMap(function response(outcome,): readonly ConditionalAuditResponse[] {
    return (outcome.datasetId === datasetId) && (outcome.response !== undefined) ? [outcome.response,] : [];
  },);
};
const d1Audits = responsesFor('d1-selection',);
const d1Findings = confirmConditionalFindings({
  audits: d1Audits,
  candidateIds: d1Candidates.map(function id(candidate,) { return candidate.id; },),
},);
const d1Selected = selectConditionalBaseline({ candidates: d1Candidates, findings: d1Findings, });
const d13Audits = responsesFor('d13-post',);
const d13Findings = confirmConditionalFindings({
  audits: d13Audits,
  candidateIds: [d13Baseline.id, d13Resolution.id,],
},);
const d13BaselineFindings = d13Findings.filter(function baseline(finding,) {
  return finding.candidateId === d13Baseline.id;
},);
const d13ResolutionFindings = d13Findings.filter(function resolution(finding,) {
  return finding.candidateId === d13Resolution.id;
},);
const d13BaselineKeys = new Set(d13BaselineFindings.map(function key(finding,) {
  return `${finding.slotKey}:${finding.defectClass}`;
},),);
const d13RegressionDetected = d13ResolutionFindings.some(function regression(finding,) {
  return !d13BaselineKeys.has(`${finding.slotKey}:${finding.defectClass}`,);
},);
const d13Adopt = shouldAdoptConditionalResolution({
  baselineFindings: d13BaselineFindings,
  resolutionFindings: d13ResolutionFindings,
  usableAuditorCount: d13Audits.length,
  resolverChangedOnlyLocatedSlots: true,
},);
const seededAudits = responsesFor('seeded-positive',);
const seededFindings = confirmConditionalFindings({
  audits: seededAudits,
  candidateIds: ['baseline', 'damaged',],
},);
const seededDetectedSlots = new Set(seededFindings
  .filter(function damaged(finding,) { return finding.candidateId === 'damaged'; },)
  .map(function slot(finding,) { return finding.slotKey; },),);
const seededControlPassed = seededDamage.plantedSlots.every(function detected(slotKey,) {
  return seededDetectedSlots.has(slotKey,);
},);
const accepted = (d1Audits.length >= 2)
  && (d1Selected.id === 'fallback-author')
  && (d13Audits.length >= 2)
  && !d13Adopt
  && d13RegressionDetected
  && (seededAudits.length >= 2)
  && seededControlPassed;
const result = {
  prototype: manifestPlan.prototype,
  status: accepted ? 'calibration-accepted' : 'calibration-rejected',
  payloadCeiling: manifestPlan.payloadCeiling,
  dependencyWaves: manifestPlan.dependencyWaves,
  manifestDigest,
  nodeRecords: records,
  d1: {
    usableAuditors: d1Audits.length,
    selected: d1Selected.id,
    confirmedFindings: d1Findings,
  },
  d13: {
    usableAuditors: d13Audits.length,
    adoptResolution: d13Adopt,
    regressionDetected: d13RegressionDetected,
    baselineFindings: d13BaselineFindings,
    resolutionFindings: d13ResolutionFindings,
  },
  seeded: {
    usableAuditors: seededAudits.length,
    plantedSlots: seededDamage.plantedSlots,
    detectedSlots: [...seededDetectedSlots,].toSorted(),
    confirmedFindings: seededFindings,
  },
  invocationDurationMs: Date.now() - startedAt,
};
await writePrototypeJson({ path: join(outputDir, 'result.json',), value: result, },);
console.log(`PROTOTYPE ${ENTRY_ID} design=E calibration=${result.status} d1=${d1Selected.id} d13Adopt=${String(d13Adopt,)} seeded=${String(seededControlPassed,)} ms=${String(result.invocationDurationMs,)}`,);
if (!accepted)
  throw new Error('conditional shell audit calibration rejected');
