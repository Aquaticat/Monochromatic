// PROTOTYPE ONLY: Candidate H deterministic lifecycle fixtures.

import type { SyntheticClient, } from './chat-contract.ts';
import { hashContent, } from './document-node.ts';
import { isJsonRecord, } from './json-guard.ts';
import type { PrototypeMedia, } from './prototype-brief-editor-input.ts';
import { createBoundedVerdictManifest, } from './prototype-bounded-verdict-manifest.ts';
import type {
  BoundedCandidate,
  BoundedVerifierResponse,
  BoundedVerdictManifest,
} from './prototype-bounded-verdict-model.ts';
import {
  REALIZATION_GLOBAL_CRITERIA,
  type RealizationCandidatePlan,
  type RealizationObligationLedger,
} from './prototype-realization-model.ts';
import { buildRealizationObligationLedger, } from './prototype-realization-ledger.ts';
import type { ImmutableShell, SlotDocumentResponse, } from './prototype-slot-model.ts';
import { buildImmutableShell, } from './prototype-slot-shell.ts';
import type { RosterModelId, } from './roster-id.ts';

/** Source carrying independent clauses and one page image. */
export const BOUNDED_LIFECYCLE_SOURCE = `---\nname: 猫\n---\n# 猫\n\n猫休息。猫醒来。\n\n<PhotoScroll photos={['\${path}/photos/fixture.webp']} />\n`;

/** Archive carrying destination shell authority. */
export const BOUNDED_LIFECYCLE_ARCHIVE = `---\nname: Cat\n---\n# Cat\n\nThe cat rests. The cat wakes.\n\n<PhotoScroll photos={['\${path}/photos/fixture.webp']} />\n`;

/** Page image payload attached to every node. */
const BOUNDED_DATA_URI = 'data:image/webp;base64,AA==';

/** Page image inventory and exact payload. */
export const BOUNDED_LIFECYCLE_MEDIA: readonly PrototypeMedia[] = [{
  assetName: 'fixture.webp',
  dataUri: BOUNDED_DATA_URI,
  digest: hashContent({ content: BOUNDED_DATA_URI, }),
},];

/** Deterministic shell, ledger, and Hyper-only plan. */
export type BoundedLifecycleFixture = {
  readonly shell: ImmutableShell;
  readonly ledger: RealizationObligationLedger;
  readonly manifest: BoundedVerdictManifest;
};

/** Creates two-author, three-verifier finite fixture. */
export function createBoundedLifecycleFixture(): BoundedLifecycleFixture {
  const shell = buildImmutableShell({
    sourceText: BOUNDED_LIFECYCLE_SOURCE,
    archiveText: BOUNDED_LIFECYCLE_ARCHIVE,
  },);
  const ledger = buildRealizationObligationLedger({
    sourceBody: shell.body,
    archiveBody: BOUNDED_LIFECYCLE_ARCHIVE,
    slots: shell.slots,
    shellDigest: shell.shellDigest,
  },);
  const candidatePlan: readonly RealizationCandidatePlan[] = [
    { ordinal: 0, modelId: 'hf:Qwen/Qwen3.8-27B', priority: 0, },
    { ordinal: 1, modelId: 'hf:moonshotai/Kimi-K3', priority: 1, },
    { ordinal: 2, modelId: 'hf:zai-org/GLM-5.3-Flash', priority: 2, },
    { ordinal: 3, modelId: 'hf:openai/gpt-oss-120b', priority: 3, },
  ];
  const verifierModelIds: readonly RosterModelId[] = [
    'minimax-m3',
    'deepseek-v4-flash-0731',
    'deepseek-v4-pro-0813',
  ];
  const manifest = createBoundedVerdictManifest({
    ledger,
    shell,
    archiveBody: BOUNDED_LIFECYCLE_ARCHIVE,
    candidatePlan,
    verifierModelIds,
    providerSelection: 'hyper-only',
    sourcePictures: BOUNDED_LIFECYCLE_MEDIA.map(function picture(item,) {
      return { assetName: item.assetName, digest: item.digest, };
    },),
  },);
  return { shell, ledger, manifest, };
}

/** Builds complete deterministic author slot map. */
function authorResponse({ fixture, plan, }: {
  readonly fixture: BoundedLifecycleFixture;
  readonly plan: RealizationCandidatePlan;
}): SlotDocumentResponse {
  return {
    slots: Object.fromEntries(fixture.shell.slots.map(function slot(item, index,) {
      return [
        item.key,
        `Author ${String(plan.ordinal,)} complete English slot ${String(index,)}.`,
      ];
    },),),
  };
}

/** Candidate evidence subset present in anonymous verifier packet. */
type BoundedCandidateEvidence = Pick<
  BoundedCandidate,
  'candidateId' | 'candidateDigest'
>;

/** Guards anonymous candidate evidence before scripted response. */
function isCandidateEvidence(value: unknown,): value is BoundedCandidateEvidence {
  return (typeof value === 'object')
    && (value !== null)
    && ('candidateId' in value)
    && ((typeof value.candidateId) === 'string')
    && ('candidateDigest' in value)
    && ((typeof value.candidateDigest) === 'string');
}

/** Reads canonical packet from first text part. */
function packetFromRequest(
  request: Parameters<SyntheticClient['chatJson']>[0],
): Readonly<Record<string, unknown>> {
  const message = request.messages[1];
  if ((message === undefined) || (typeof message.content === 'string'))
    throw new Error('bounded lifecycle verifier packet is absent');
  const textPart = message.content.find(function text(part,) {
    return part.type === 'text';
  },);
  if ((textPart === undefined) || (textPart.type !== 'text'))
    throw new Error('bounded lifecycle verifier packet text is absent');
  const marker = 'BOUNDED_VERIFIER_PACKET:\n';
  const start = textPart.text.indexOf(marker,);
  if (start < 0)
    throw new Error('bounded lifecycle verifier packet marker is absent');
  const value: unknown = JSON.parse(textPart.text.slice(start + marker.length,),);
  if (!isJsonRecord(value,))
    throw new Error('bounded lifecycle verifier packet differs');
  return value;
}

/** Reads anonymous candidate bindings from canonical packet. */
function candidatesFromRequest(
  request: Parameters<SyntheticClient['chatJson']>[0],
): readonly BoundedCandidateEvidence[] {
  const packet = packetFromRequest(request,);
  const { candidates, } = packet;
  if (!Array.isArray(candidates,) || !candidates.every(isCandidateEvidence,))
    throw new Error('bounded lifecycle candidate evidence differs');
  return candidates;
}

/** Builds one complete checked-clean all-candidate response. */
function cleanResponse({
  fixture,
  candidates,
}: {
  readonly fixture: BoundedLifecycleFixture;
  readonly candidates: readonly BoundedCandidateEvidence[];
}): BoundedVerifierResponse {
  return {
    candidates: candidates.map(function row(candidate,) {
      return {
        candidateId: candidate.candidateId,
        candidateDigest: candidate.candidateDigest,
        obligationStatuses: fixture.ledger.obligations.map(function preserved() {
          return 'p' as const;
        },),
        globalStatuses: REALIZATION_GLOBAL_CRITERIA.map(function clean() {
          return 'c' as const;
        },),
        overflow: false,
        findings: [],
      };
    },),
  };
}

/** Returns deterministic response for author or verifier request. */
export function boundedLifecycleResponseForRequest({ fixture, }: {
  readonly fixture: BoundedLifecycleFixture;
}): (request: Parameters<SyntheticClient['chatJson']>[0]) => unknown {
  return function response(request,) {
    const schemaName = request.responseFormat?.json_schema.name;
    if (schemaName === 'immutable_shell_slots') {
      const plan = fixture.manifest.candidatePlan.find(function model(item,) {
        return item.modelId === request.modelId;
      },);
      if (plan === undefined)
        throw new Error('bounded lifecycle author model differs');
      return authorResponse({ fixture, plan, });
    }
    if (schemaName !== 'bounded_verdict_ballot')
      throw new Error('bounded lifecycle schema differs');
    return cleanResponse({
      fixture,
      candidates: candidatesFromRequest(request,),
    },);
  };
}
