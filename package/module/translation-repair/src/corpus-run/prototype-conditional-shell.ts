// PROTOTYPE ONLY: Candidate E1 double-prime conditional immutable-shell graph.

import { mkdir, readFile, } from 'node:fs/promises';
import { join, } from 'node:path';

import type { CorpusPin, } from '../corpus-source.ts';
import { readCorpusFile, } from '../corpus-source.ts';
import { hashContent, } from '../document-node.ts';
import { photoReferences, } from '../photo-reference.ts';
import {
  conditionalResolutionBallot,
  selectConditionalBaselineByAuditorVotes,
  shouldAdoptConditionalResolutionByAuditorVotes,
} from '../prototype-conditional-audit.ts';
import type { ConditionalCandidate, } from '../prototype-conditional-audit-model.ts';
import {
  conditionalAuditMessages,
  CONDITIONAL_AUDIT_NODES,
} from '../prototype-conditional-audit-plan.ts';
import { runConditionalAuditNode, } from '../prototype-conditional-audit-wave.ts';
import { gatherPrototypeMedia, } from '../prototype-brief-editor-input.ts';
import { writePrototypeJson, } from '../prototype-brief-editor-runtime.ts';
import { publishConditionalPrototype, } from '../prototype-conditional-publication.ts';
import {
  collectLocatedConditionalFindings,
  conditionalResolverMessages,
  CONDITIONAL_RESOLVER_NODE,
  resolverChangedOnlyLocatedSlots,
} from '../prototype-conditional-resolver.ts';
import { createConditionalScriptedClient, } from '../prototype-conditional-scripted-client.ts';
import type { SlotDocumentResponse, } from '../prototype-slot-model.ts';
import { buildImmutableShell, } from '../prototype-slot-shell.ts';
import {
  slotAuthorMessages,
  SLOT_AUTHOR_NODES,
} from '../prototype-slot-plan.ts';
import { runSlotCandidateNode, type SlotState, } from '../prototype-slot-wave.ts';
import { slotDocumentGuard, slotResponseFormat, } from '../prototype-slot-wire.ts';
import { passArchiveText, } from './pass-archive.ts';
import { createRunClient, } from './run-config.ts';

const ENTRY_ID = 'Carena0442';
const PR_HEAD = 'a80634a674f94861ea3b7056fba054ca9eab1a2c';

function auditNodeIds({ stage, }: { readonly stage: 'author-audit' | 'post-audit'; }): readonly string[] {
  return CONDITIONAL_AUDIT_NODES.map(function id(node,) { return `${stage}-${node.id}`; },);
}

const outputDir = process.env.TRANSLATION_REPAIR_PROTOTYPE_DIR ?? '';
if (outputDir === '')
  throw new Error('set TRANSLATION_REPAIR_PROTOTYPE_DIR');
const cloneDir = process.env.TRANSLATION_REPAIR_CORPUS_DIR ?? '';
if (cloneDir === '')
  throw new Error('set TRANSLATION_REPAIR_CORPUS_DIR');
const restart = process.env.TRANSLATION_REPAIR_PROTOTYPE_RESTART === '1';
const providerSelectionValue = process.env.TRANSLATION_REPAIR_PROTOTYPE_PROVIDER ?? 'all';
if ((providerSelectionValue !== 'all')
  && (providerSelectionValue !== 'synthetic-only')
  && (providerSelectionValue !== 'hyper-only'))
  throw new Error('TRANSLATION_REPAIR_PROTOTYPE_PROVIDER must be all, synthetic-only, or hyper-only');
const providerSelection: 'all' | 'synthetic-only' | 'hyper-only' = providerSelectionValue;
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
const archiveText = passArchiveText({ text: archiveRaw, });
const sourcePictures = photoReferences({ text: sourceText, });
const media = await gatherPrototypeMedia({ pin, entryId: ENTRY_ID, sourceText, });
const shell = buildImmutableShell({ sourceText, archiveText, });
const responseFormat = slotResponseFormat({ shell, });
const manifestPlan = {
  version: 1,
  prototype: 'conditional-shell-e1-double-prime',
  validator: 'immutable-shell-v4-conditional-audit-v2',
  entryId: ENTRY_ID,
  sourceDigest: hashContent({ content: sourceText, }),
  archiveDigest: hashContent({ content: archiveText, }),
  shellDigest: shell.shellDigest,
  slotKeys: shell.slots.map(function key(slot,) { return slot.key; },),
  media: media.map(function item(value,) { return { assetName: value.assetName, digest: value.digest, }; },),
  waves: [
    SLOT_AUTHOR_NODES.map(function id(node,) { return node.id; },),
    auditNodeIds({ stage: 'author-audit', }),
    [CONDITIONAL_RESOLVER_NODE.id,],
    auditNodeIds({ stage: 'post-audit', }),
  ],
  payloadCeiling: 10,
  retryLimit: 0,
  providerSelection,
  authorSelectionVotesRequired: 2,
  postAdoptionVotesRequired: 2,
} as const;
const manifestDigest = hashContent({ content: JSON.stringify(manifestPlan,), },);
if (restart) {
  const stored = JSON.parse(await readFile(join(outputDir, 'manifest.json',), 'utf8',),) as {
    readonly manifestDigest?: string;
  };
  if (stored.manifestDigest !== manifestDigest)
    throw new Error('conditional shell restart manifest digest differs');
}
else
  await writePrototypeJson({ path: join(outputDir, 'manifest.json',), value: { manifestDigest, ...manifestPlan, }, },);
const scripted = process.env.TRANSLATION_REPAIR_PROTOTYPE_SCRIPTED;
const client = scripted === undefined
  ? createRunClient({
    promptPayloadDir: join(outputDir, 'prompt-payloads',),
    retryPolicy: { limit: 0, baseMs: 0, },
    providerSelection,
  },)
  : createConditionalScriptedClient({ shell, scenario: scripted, });
const controller = new AbortController();
process.once('SIGINT', function abortOnSigint() { controller.abort(new Error('caller abort: SIGINT'),); },);
process.once('SIGTERM', function abortOnSigterm() { controller.abort(new Error('caller abort: SIGTERM'),); },);
const { signal, } = controller;
const authorStates = await Promise.all(SLOT_AUTHOR_NODES.map(async function author(node,): Promise<SlotState> {
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
const candidates = authorStates.flatMap(function candidate(state, index,): readonly ConditionalCandidate[] {
  const node = SLOT_AUTHOR_NODES[index];
  return (node === undefined) || (state.value === undefined) || (state.document === undefined)
    ? []
    : [{ id: node.id, modelId: node.modelId, priority: node.priority, response: state.value, document: state.document, },];
},);
const records = authorStates.map(function record(state,) { return state.record; },);
if (candidates.length === 0) {
  const unattemptedNodes = [
    ...auditNodeIds({ stage: 'author-audit', }),
    CONDITIONAL_RESOLVER_NODE.id,
    ...auditNodeIds({ stage: 'post-audit', }),
  ];
  await writePrototypeJson({ path: join(outputDir, 'result.json',), value: {
    prototype: manifestPlan.prototype,
    status: 'production-unavailable',
    payloadCeiling: manifestPlan.payloadCeiling,
    dependencyWaves: manifestPlan.waves.length,
    manifestDigest,
    nodeRecords: records,
    unattemptedNodes,
    invocationDurationMs: Date.now() - startedAt,
  }, },);
  throw new Error('ProductionUnavailableError: every finite conditional-shell author was unusable');
}
const authorAuditStates = await Promise.all(CONDITIONAL_AUDIT_NODES.map(async function audit(node,) {
  return await runConditionalAuditNode({
    outputDir,
    client,
    stage: 'author-audit',
    node,
    manifestDigest,
    messages: conditionalAuditMessages({ node, shell, sourceText, archiveText, candidates, media, }),
    shell,
    candidates,
    restart,
    signal,
  },);
},));
records.push(...authorAuditStates.map(function record(state,) { return state.record; },),);
const authorAuditEntries = authorAuditStates.flatMap(function response(state, index,) {
  const node = CONDITIONAL_AUDIT_NODES[index];
  return (state.response === undefined) || (node === undefined)
    ? []
    : [{ response: state.response, modelId: node.modelId, },];
},);
const authorAudits = authorAuditEntries.map(function audit(entry,) { return entry.response; },);
let rejectedFindingCount = authorAuditStates.reduce(function count(sum, state,) {
  return sum + state.rejectedFindingCount;
}, 0,);
const baselineDecision = selectConditionalBaselineByAuditorVotes({
  candidates,
  audits: authorAudits,
  auditorModelIds: authorAuditEntries.map(function model(entry,) { return entry.modelId; },),
},);
const baseline = baselineDecision.candidate;
const locatedFindings = collectLocatedConditionalFindings({ audits: authorAudits, candidateId: baseline.id, });
await writePrototypeJson({ path: join(outputDir, 'decision-author-selection.json',), value: {
  manifestDigest,
  selectedAuthor: baseline.id,
  providerSelection,
  evidenceFloorMet: baselineDecision.evidenceFloorMet,
  votes: baselineDecision.votes,
  ballots: baselineDecision.ballots,
  locatedFindingCount: locatedFindings.length,
  candidateDigests: Object.fromEntries(candidates.map(function digest(candidate,) {
    return [candidate.id, hashContent({ content: candidate.document, }),];
  },),),
}, },);
const postNodeIds = auditNodeIds({ stage: 'post-audit', });
let finalDocument = baseline.document;
let resolverAttempted = false;
let resolverChangedOnlyLocated = false;
let resolutionAdopted = false;
const unattemptedNodes: string[] = [];
if (locatedFindings.length === 0)
  unattemptedNodes.push(CONDITIONAL_RESOLVER_NODE.id, ...postNodeIds,);
else {
  resolverAttempted = true;
  const resolverState = await runSlotCandidateNode({
    outputDir,
    client,
    node: CONDITIONAL_RESOLVER_NODE,
    manifestDigest,
    messages: conditionalResolverMessages({
      shell,
      sourceText,
      archiveText,
      baselineResponse: baseline.response,
      baselineDocument: baseline.document,
      findings: locatedFindings,
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
  records.push(resolverState.record,);
  if ((resolverState.value === undefined) || (resolverState.document === undefined))
    unattemptedNodes.push(...postNodeIds,);
  else {
    const locationDecision = resolverChangedOnlyLocatedSlots({
      baseline: baseline.response,
      resolution: resolverState.value,
      findings: locatedFindings,
    },);
    resolverChangedOnlyLocated = locationDecision.accepted;
    await writePrototypeJson({ path: join(outputDir, 'decision-conditional-resolver.json',), value: {
      manifestDigest,
      candidateDigest: hashContent({ content: resolverState.document, }),
      acceptedForPostAudit: locationDecision.accepted,
      changedSlotKeys: locationDecision.changedSlotKeys,
    }, },);
    if (!locationDecision.accepted)
      unattemptedNodes.push(...postNodeIds,);
    else {
      const postCandidates: readonly ConditionalCandidate[] = [
        {
          id: 'baseline',
          modelId: baseline.modelId,
          priority: 0,
          response: baseline.response,
          document: baseline.document,
        },
        {
          id: 'resolution',
          modelId: CONDITIONAL_RESOLVER_NODE.modelId,
          priority: 1,
          response: resolverState.value,
          document: resolverState.document,
        },
      ];
      const postStates = await Promise.all(CONDITIONAL_AUDIT_NODES.map(async function audit(node,) {
        return await runConditionalAuditNode({
          outputDir,
          client,
          stage: 'post-audit',
          node,
          manifestDigest,
          messages: conditionalAuditMessages({ node, shell, sourceText, archiveText, candidates: postCandidates, media, }),
          shell,
          candidates: postCandidates,
          restart,
          signal,
        },);
      },));
      records.push(...postStates.map(function record(state,) { return state.record; },),);
      const postAudits = postStates.flatMap(function response(state,) {
        return state.response === undefined ? [] : [state.response,];
      },);
      rejectedFindingCount += postStates.reduce(function count(sum, state,) {
        return sum + state.rejectedFindingCount;
      }, 0,);
      const auditorBallots = postStates.map(function ballot(state, index,) {
        const node = CONDITIONAL_AUDIT_NODES[index];
        if (node === undefined)
          throw new Error('conditional post-auditor roster differs');
        return state.response === undefined
          ? {
            auditorId: node.id,
            modelId: node.modelId,
            resolverSelfReview: node.modelId === CONDITIONAL_RESOLVER_NODE.modelId,
            usable: false,
            rejectedFindingCount: 0,
          }
          : {
            auditorId: node.id,
            modelId: node.modelId,
            resolverSelfReview: node.modelId === CONDITIONAL_RESOLVER_NODE.modelId,
            usable: true,
            rejectedFindingCount: state.rejectedFindingCount,
            ...conditionalResolutionBallot({
              audit: state.response,
              baselineId: 'baseline',
              resolutionId: 'resolution',
            },),
          };
      },);
      resolutionAdopted = shouldAdoptConditionalResolutionByAuditorVotes({
        audits: postAudits,
        baselineId: 'baseline',
        resolutionId: 'resolution',
      },);
      if (resolutionAdopted)
        finalDocument = resolverState.document;
      await writePrototypeJson({ path: join(outputDir, 'decision-post-audit.json',), value: {
        manifestDigest,
        usableAuditors: postAudits.length,
        approvals: auditorBallots.filter(function approved(ballot,) { return ('approves' in ballot) && ballot.approves; },).length,
        auditorBallots,
        resolutionAdopted,
        baselineDigest: hashContent({ content: baseline.document, }),
        resolutionDigest: hashContent({ content: resolverState.document, }),
      }, },);
    }
  }
}
await publishConditionalPrototype({
  outputDir,
  entryId: ENTRY_ID,
  manifestDigest,
  finalDocument,
  selectedAuthor: baseline.id,
  providerSelection,
  evidenceFloorMet: baselineDecision.evidenceFloorMet,
  votes: baselineDecision.votes,
  authorBallots: baselineDecision.ballots,
  resolverAttempted,
  resolverChangedOnlyLocated,
  resolutionAdopted,
  rejectedFindingCount,
  records,
  unattemptedNodes,
  slotCount: shell.slots.length,
  startedAt,
  signal,
},);
