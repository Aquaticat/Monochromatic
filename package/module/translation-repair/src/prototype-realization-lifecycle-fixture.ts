// PROTOTYPE ONLY: Candidate G lifecycle fixture builders.

import type { SyntheticClient, } from './chat-contract.ts';
import { hashContent, } from './document-node.ts';
import type { PrototypeMedia, } from './prototype-brief-editor-input.ts';
import type {
  RealizationAuthorResponse,
  RealizationCandidatePlan,
  RealizationManifest,
  RealizationObligationLedger,
  RealizationVerifierResponse,
  RealizedCandidate,
} from './prototype-realization-model.ts';
import { REALIZATION_GLOBAL_CRITERIA, } from './prototype-realization-model.ts';
import { buildRealizationObligationLedger, } from './prototype-realization-ledger.ts';
import { createRealizationManifest, } from './prototype-realization-manifest.ts';
import type { ImmutableShell, } from './prototype-slot-model.ts';
import { buildImmutableShell, } from './prototype-slot-shell.ts';
import type { RosterModelId, } from './roster-id.ts';

/** Fixed source carrying two independently mapped source clauses. */
export const REALIZATION_LIFECYCLE_SOURCE = `---\nname: 猫\n---\n# 猫\n\n猫休息。猫醒来。\n\n<PhotoScroll photos={['\${path}/photos/fixture.webp']} />\n`;

/** Fixed archive carrying shell authority and complete destination shape. */
export const REALIZATION_LIFECYCLE_ARCHIVE = `---\nname: Cat\n---\n# Cat\n\nThe cat rests. The cat wakes.\n\n<PhotoScroll photos={['\${path}/photos/fixture.webp']} />\n`;

/** Fixed image data URI used to bind prompt bytes. */
const REALIZATION_LIFECYCLE_DATA_URI = 'data:image/webp;base64,AA==';

/** Page-referenced image inventory and exact prompt payload for every lifecycle node. */
export const REALIZATION_LIFECYCLE_MEDIA: readonly PrototypeMedia[] = [{
  assetName: 'fixture.webp',
  dataUri: REALIZATION_LIFECYCLE_DATA_URI,
  digest: hashContent({ content: REALIZATION_LIFECYCLE_DATA_URI, }),
},];

/** Page-reference names consumed by deterministic candidate guards. */
export const REALIZATION_LIFECYCLE_PICTURES: readonly { readonly assetName: string; }[] = REALIZATION_LIFECYCLE_MEDIA.map(function picture(item,) {
  return { assetName: item.assetName, };
},);

/** Deterministic shell, ledger, and finite manifest used by lifecycle controls. */
export type RealizationLifecycleFixture = {
  readonly shell: ImmutableShell;
  readonly ledger: RealizationObligationLedger;
  readonly manifest: RealizationManifest;
};

/** Creates two-author, two-verifier Hyper-only fixture graph. */
export function createRealizationLifecycleFixture(): RealizationLifecycleFixture {
  const shell = buildImmutableShell({
    sourceText: REALIZATION_LIFECYCLE_SOURCE,
    archiveText: REALIZATION_LIFECYCLE_ARCHIVE,
  },);
  const ledger = buildRealizationObligationLedger({
    sourceBody: shell.body,
    archiveBody: REALIZATION_LIFECYCLE_ARCHIVE,
    slots: shell.slots,
    shellDigest: shell.shellDigest,
  },);
  const candidatePlan: readonly RealizationCandidatePlan[] = [
    { ordinal: 0, modelId: 'hf:Qwen/Qwen3.8-27B', priority: 0, },
    { ordinal: 1, modelId: 'hf:moonshotai/Kimi-K3', priority: 1, },
  ];
  const verifierModelIds: readonly RosterModelId[] = [
    'minimax-m3',
    'deepseek-v4-flash-0731',
  ];
  const manifest = createRealizationManifest({
    ledger,
    shell,
    archiveBody: REALIZATION_LIFECYCLE_ARCHIVE,
    candidatePlan,
    verifierModelIds,
    providerSelection: 'hyper-only',
    sourcePictures: REALIZATION_LIFECYCLE_MEDIA.map(function picture(item,) {
      return { assetName: item.assetName, digest: item.digest, };
    },),
  },);
  return { shell, ledger, manifest, };
}

/** Builds one non-overlapping complete realization response from manifest obligations. */
export function realizationLifecycleAuthorResponse({ fixture, plan, }: {
  readonly fixture: RealizationLifecycleFixture;
  readonly plan: RealizationCandidatePlan;
}): RealizationAuthorResponse {
  const slots = fixture.shell.slots.map(function slotRow(slot,) {
    const owned = fixture.ledger.obligations.filter(function allowed(obligation,) {
      return (obligation.targetCardinality === 'one-or-more')
        && (obligation.allowedTargetSlotKeys[0] === slot.key);
    },);
    const realizedIds = owned.map(function id(obligation,) { return obligation.id; }).join(' ');
    return {
      slotKey: slot.key,
      text: `Author ${String(plan.ordinal,)} realizes ${realizedIds}.`,
    };
  },);
  const slotText = new Map(slots.map(function pair(slot,) { return [slot.slotKey, slot.text,] as const; },),);
  const realization = fixture.ledger.obligations.map(function claim(obligation,) {
    if (obligation.targetCardinality === 'shell-owned')
      return { obligationId: obligation.id, targetAnchors: [], };
    const slotKey = obligation.allowedTargetSlotKeys[0];
    const text = slotKey === undefined ? undefined : slotText.get(slotKey,);
    const startOffset = text?.indexOf(obligation.id,) ?? -1;
    if ((slotKey === undefined) || (text === undefined) || (startOffset < 0))
      throw new Error(`realization lifecycle author anchor fixture differs at ${obligation.id}`);
    const endOffset = startOffset + obligation.id.length;
    return {
      obligationId: obligation.id,
      targetAnchors: [{
        slotKey,
        startOffset,
        endOffset,
        digest: hashContent({ content: text.slice(startOffset, endOffset,), }),
      },],
    };
  },);
  return { slots, realization, };
}

/** Builds one complete checked-clean verifier matrix over admitted candidates. */
export function realizationLifecycleVerifierResponse({ fixture, candidates, }: {
  readonly fixture: RealizationLifecycleFixture;
  readonly candidates: readonly Pick<
    RealizedCandidate,
    'candidateId' | 'candidateDigest' | 'realization'
  >[];
}): RealizationVerifierResponse {
  return {
    candidates: candidates.map(function verification(candidate,) {
      return {
        candidateId: candidate.candidateId,
        candidateDigest: candidate.candidateDigest,
        obligations: fixture.ledger.obligations.map(function status(obligation,) {
          return {
            obligationId: obligation.id,
            obligationEvidenceDigest: obligation.evidenceDigest,
            status: 'preserved' as const,
            verifiedTargetAnchors: candidate.realization[obligation.id] ?? [],
          };
        },),
        globalChecks: REALIZATION_GLOBAL_CRITERIA.map(function clean(criterion,) {
          return { criterion, status: 'clean' as const, };
        },),
        findings: [],
      };
    },),
  };
}

/** Checks anonymous verifier candidate packet fields needed by clean fixture ballot. */
function isVerifierCandidateEvidence(value: unknown,): value is Pick<
  RealizedCandidate,
  'candidateId' | 'candidateDigest' | 'realization'
> {
  return (typeof value === 'object')
    && (value !== null)
    && ('candidateId' in value)
    && (typeof value.candidateId === 'string')
    && ('candidateDigest' in value)
    && (typeof value.candidateDigest === 'string')
    && ('realization' in value)
    && (typeof value.realization === 'object')
    && (value.realization !== null);
}

/** Reads anonymous candidate rows from canonical verifier packet. */
function verifierCandidatesFromRequest(
  request: Parameters<SyntheticClient['chatJson']>[0],
): readonly Pick<RealizedCandidate, 'candidateId' | 'candidateDigest' | 'realization'>[] {
  const userMessage = request.messages[1];
  if ((userMessage === undefined) || (typeof userMessage.content === 'string'))
    throw new Error('realization lifecycle verifier packet is absent');
  const textPart = userMessage.content.find(function text(part,) { return part.type === 'text'; });
  if ((textPart === undefined) || (textPart.type !== 'text'))
    throw new Error('realization lifecycle verifier packet text is absent');
  const marker = 'VERIFIER_PACKET:\n';
  const start = textPart.text.indexOf(marker,);
  if (start < 0)
    throw new Error('realization lifecycle verifier packet marker is absent');
  const packet: unknown = JSON.parse(textPart.text.slice(start + marker.length,),);
  if ((typeof packet !== 'object') || (packet === null)
    || !('candidates' in packet) || !Array.isArray(packet.candidates,)
    || !packet.candidates.every(isVerifierCandidateEvidence,))
    throw new Error('realization lifecycle verifier candidates differ');
  return packet.candidates;
}

/** Returns fixture response for canonical author or verifier request. */
export function realizationLifecycleResponseForRequest({ fixture, }: {
  readonly fixture: RealizationLifecycleFixture;
}): (request: Parameters<SyntheticClient['chatJson']>[0]) => unknown {
  return function response(request,) {
    const schemaName = request.responseFormat?.json_schema.name;
    if (schemaName === 'verified_realization_author') {
      const plan = fixture.manifest.candidatePlan.find(function model(item,) {
        return item.modelId === request.modelId;
      },);
      if (plan === undefined)
        throw new Error('realization lifecycle author model differs');
      return realizationLifecycleAuthorResponse({ fixture, plan, });
    }
    if (schemaName !== 'verified_realization_ballot')
      throw new Error('realization lifecycle schema differs');
    return realizationLifecycleVerifierResponse({
      fixture,
      candidates: verifierCandidatesFromRequest(request,),
    },);
  };
}
