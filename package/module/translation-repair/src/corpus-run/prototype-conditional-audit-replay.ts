// PROTOTYPE ONLY: Candidate E1 double-prime replay over retained provider replies.

import { mkdir, readFile, } from 'node:fs/promises';
import { join, } from 'node:path';

import {
  confirmConditionalFindings,
  selectConditionalBaselineByAuditorVotes,
  shouldAdoptConditionalResolutionByAuditorVotes,
} from '../prototype-conditional-audit.ts';
import type {
  ConditionalAuditResponse,
  ConditionalCandidate,
} from '../prototype-conditional-audit-model.ts';
import {
  admitConditionalAudit,
  conditionalAuditStructuralGuard,
} from '../prototype-conditional-audit-plan.ts';
import { writePrototypeJson, } from '../prototype-brief-editor-runtime.ts';
import { compileSlotDocument, } from '../prototype-slot-compile.ts';
import type { SlotDocumentResponse, } from '../prototype-slot-model.ts';
import { buildImmutableShell, } from '../prototype-slot-shell.ts';
import type { SlotNodeRecord, } from '../prototype-slot-runtime.ts';
import { hashContent, } from '../document-node.ts';

const ENTRY_ID = 'Carena0442';

function requiredEnvironment({ name, }: { readonly name: string; }): string {
  const value = process.env[name] ?? '';
  if (value === '')
    throw new Error(`set ${name}`);
  return value;
}

async function readJson({ path, }: { readonly path: string; }): Promise<unknown> {
  return JSON.parse(await readFile(path, 'utf8',)) as unknown;
}

async function readCandidate(
  {
    root,
    responseId,
    candidateId,
    modelId,
    priority,
    shell,
  }: {
    readonly root: string;
    readonly responseId: string;
    readonly candidateId: string;
    readonly modelId: ConditionalCandidate['modelId'];
    readonly priority: number;
    readonly shell: ReturnType<typeof buildImmutableShell>;
  },
): Promise<ConditionalCandidate> {
  const response = await readJson({ path: join(root, `response-${responseId}.json`,), }) as SlotDocumentResponse;
  return {
    id: candidateId,
    modelId,
    priority,
    response,
    document: compileSlotDocument({ shell, response, }),
  };
}

function seededCandidate(
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
  const slots = replacements.reduce(function replace(current, item,) {
    const value = current[item.key];
    if (value === undefined)
      throw new Error(`conditional replay slot absent: ${item.key}`);
    return {
      ...current,
      [item.key]: item.before === '' ? `${value}${item.after}` : value.replace(item.before, item.after,),
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

type RetainedRun = {
  readonly manifestDigest: string;
  readonly nodeRecords: readonly SlotNodeRecord[];
};

type ReplyEnvelope = {
  readonly reply?: { readonly text?: string; };
};

const outputDir = requiredEnvironment({ name: 'TRANSLATION_REPAIR_PROTOTYPE_DIR', });
const calibrationRoot = requiredEnvironment({ name: 'TRANSLATION_REPAIR_E1_CALIBRATION_DIR', });
const corpusDir = requiredEnvironment({ name: 'TRANSLATION_REPAIR_CORPUS_DIR', });
const d1Root = requiredEnvironment({ name: 'TRANSLATION_REPAIR_PROTOTYPE_D1_DIR', });
const d13Root = requiredEnvironment({ name: 'TRANSLATION_REPAIR_PROTOTYPE_D13_DIR', });
await mkdir(outputDir,);
const startedAt = Date.now();
const [sourceText, archiveText,] = await Promise.all([
  readFile(join(corpusDir, 'people', ENTRY_ID, 'page.md',), 'utf8',),
  readFile(join(corpusDir, 'people', ENTRY_ID, 'page.en.md',), 'utf8',),
]);
const shell = buildImmutableShell({ sourceText, archiveText, });
const d1Candidates = await Promise.all([
  readCandidate({
    root: d1Root,
    responseId: 'primary-author',
    candidateId: 'primary-author',
    modelId: 'hf:moonshotai/Kimi-K3',
    priority: 0,
    shell,
  },),
  readCandidate({
    root: d1Root,
    responseId: 'fallback-author',
    candidateId: 'fallback-author',
    modelId: 'hf:Qwen/Qwen3.8-27B',
    priority: 1,
    shell,
  },),
  readCandidate({
    root: d1Root,
    responseId: 'reserve-author',
    candidateId: 'reserve-author',
    modelId: 'hf:zai-org/GLM-5.3-Flash',
    priority: 2,
    shell,
  },),
]);
const d13Baseline = await readCandidate({
  root: d13Root,
  responseId: 'final-reviser',
  candidateId: 'baseline',
  modelId: 'hf:moonshotai/Kimi-K3',
  priority: 0,
  shell,
},);
const d13Resolution = await readCandidate({
  root: d13Root,
  responseId: 'final-copy-editor',
  candidateId: 'resolution',
  modelId: 'hf:Qwen/Qwen3.8-27B',
  priority: 1,
  shell,
},);
const planted = seededCandidate({ baseline: d13Baseline, shell, });
const datasets: Readonly<Record<string, readonly ConditionalCandidate[]>> = {
  'd1-selection': d1Candidates,
  'd13-post': [d13Baseline, d13Resolution,],
  'seeded-positive': [d13Baseline, planted.candidate,],
};
const retained = await readJson({ path: join(calibrationRoot, 'result.json',), }) as RetainedRun;
const replayed = await Promise.all(retained.nodeRecords.map(async function replay(record,) {
  const datasetId = record.id.startsWith('d1-selection-')
    ? 'd1-selection'
    : record.id.startsWith('d13-post-')
      ? 'd13-post'
      : 'seeded-positive';
  const candidates = datasets[datasetId];
  if ((candidates === undefined) || (record.replyCacheKey === undefined))
    return { nodeId: record.id, modelId: record.modelId, datasetId, state: 'unavailable' as const, };
  const envelope = await readJson({
    path: join(calibrationRoot, 'prompt-payloads', `${record.replyCacheKey}.json`,),
  }) as ReplyEnvelope;
  const rawText = envelope.reply?.text;
  if ((rawText === undefined) || (hashContent({ content: rawText, }) !== record.providerResponseDigest))
    throw new Error(`conditional replay provider binding differs at ${record.id}`);
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawText,) as unknown;
  }
  catch {
    return { nodeId: record.id, modelId: record.modelId, datasetId, state: 'structural-mismatch' as const, };
  }
  const guard = conditionalAuditStructuralGuard({ shell, candidates, });
  if (!guard(parsed,))
    return { nodeId: record.id, modelId: record.modelId, datasetId, state: 'structural-mismatch' as const, };
  const admission = admitConditionalAudit({ shell, candidates, response: parsed, });
  return {
    nodeId: record.id,
    modelId: record.modelId,
    datasetId,
    state: 'admitted' as const,
    response: admission.response,
    rejectedFindings: admission.rejectedFindings,
  };
},),);
const auditEntriesFor = function auditEntriesFor(datasetId: string,): readonly {
  readonly response: ConditionalAuditResponse;
  readonly modelId: ConditionalCandidate['modelId'];
}[] {
  return replayed.flatMap(function admitted(item,) {
    return (item.datasetId === datasetId) && (item.state === 'admitted')
      ? [{ response: item.response, modelId: item.modelId, },]
      : [];
  },);
};
const d1Entries = auditEntriesFor('d1-selection',);
const d1Audits = d1Entries.map(function audit(entry,) { return entry.response; },);
const d1Decision = selectConditionalBaselineByAuditorVotes({
  candidates: d1Candidates,
  audits: d1Audits,
  auditorModelIds: d1Entries.map(function model(entry,) { return entry.modelId; },),
},);
const d13Entries = auditEntriesFor('d13-post',);
const d13Audits = d13Entries.map(function audit(entry,) { return entry.response; },);
const d13Adopt = shouldAdoptConditionalResolutionByAuditorVotes({
  audits: d13Audits,
  baselineId: d13Baseline.id,
  resolutionId: d13Resolution.id,
},);
const d13EveryAuditorLocatedDefect = d13Audits.every(function nonempty(audit,) {
  return Object.values(audit.candidates,).some(function findings(candidate,) { return candidate.findings.length > 0; },);
},);
const seededAudits = auditEntriesFor('seeded-positive',).map(function audit(entry,) { return entry.response; },);
const seededFindings = confirmConditionalFindings({
  audits: seededAudits,
  candidateIds: [d13Baseline.id, planted.candidate.id,],
},);
const seededDetected = new Set(seededFindings
  .filter(function damaged(finding,) { return finding.candidateId === planted.candidate.id; },)
  .map(function slot(finding,) { return finding.slotKey; },),);
const seededPassed = planted.plantedSlots.every(function detected(slotKey,) { return seededDetected.has(slotKey,); });
const accepted = (d1Audits.length === 3)
  && d1Decision.evidenceFloorMet
  && (d1Decision.candidate.id === 'fallback-author')
  && (d13Audits.length === 2)
  && d13EveryAuditorLocatedDefect
  && !d13Adopt
  && (seededAudits.length === 3)
  && seededPassed;
const result = {
  prototype: 'conditional-shell-audit-replay-e1-double-prime',
  status: accepted ? 'replay-accepted' : 'replay-rejected',
  retainedManifestDigest: retained.manifestDigest,
  sourceDigest: hashContent({ content: sourceText, }),
  archiveDigest: hashContent({ content: archiveText, }),
  replayed: replayed.map(function summary(item,) {
    return item.state === 'admitted'
      ? {
        nodeId: item.nodeId,
        datasetId: item.datasetId,
        state: item.state,
        rejectedFindings: item.rejectedFindings,
      }
      : item;
  },),
  d1: {
    usableAuditors: d1Audits.length,
    selected: d1Decision.candidate.id,
    evidenceFloorMet: d1Decision.evidenceFloorMet,
    votes: d1Decision.votes,
  },
  d13: {
    usableAuditors: d13Audits.length,
    everyAuditorLocatedDefect: d13EveryAuditorLocatedDefect,
    adoptResolution: d13Adopt,
  },
  seeded: {
    usableAuditors: seededAudits.length,
    plantedSlots: planted.plantedSlots,
    detectedSlots: [...seededDetected,].toSorted(),
  },
  invocationDurationMs: Date.now() - startedAt,
};
await writePrototypeJson({ path: join(outputDir, 'result.json',), value: result, },);
console.log(`PROTOTYPE ${ENTRY_ID} design=E1-double-prime status=${result.status} d1=${d1Decision.candidate.id} d13Adopt=${String(d13Adopt,)} seeded=${String(seededPassed,)}`,);
if (!accepted)
  throw new Error('conditional shell audit retained replay rejected');
