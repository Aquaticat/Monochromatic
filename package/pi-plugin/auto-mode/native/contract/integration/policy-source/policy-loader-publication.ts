/**
 Reload publication assembles the complete policy binding from one native frame occurrence.
 @module
 */
import { createHash } from 'node:crypto';
import { nonNullishOrThrow } from '@monochromatic-dev/module-or-throw/ts';
import { captureDecisionMaterial } from './decision-material.mjs';
import { bindReadablePolicyFiles } from './readable-policy-files.mjs';
import {
  createResourceReceiptInputs,
  retainResourceReceiptInputs
} from './resource-receipts.mjs';
import type { NativePolicyDesignation } from '../native-host/bootstrap-types.ts';
import type { ContextPolicyPublication } from './context-emission.mjs';
import type {
  AppendPromptInput,
  ContextPolicyCarrier,
  ContextPromptInput,
  GoverningPolicyCapture,
  HostPromptInput,
  PolicyInputBinding,
  PolicyResourceFrame,
  PolicyResourceStage,
  ResourceAppendStage,
  ResourceContextStage,
  ResourceReceiptInput,
  ResourceSystemStage
} from './policy-loader-types.ts';

/**
 One reload publication retains its complete binding and accumulated receipts.
 */
export type PolicyReloadPublication = {
  readonly binding: PolicyInputBinding;
  readonly retainedResourceReceipts: readonly ResourceReceiptInput[];
};

/**
 Original relevance capture retains its optional refresh failure for decision selection.
 */
export type RelevanceCapture = {
  readonly relevance?: unknown;
  readonly relevanceFailure?: {
    readonly cause: unknown;
  };
};

/**
 Assemble every published input and proof field from the exact bound frame.

 @param frame - original bound resource frame for this publication

 @param source - original selected policy capture

 @param hostPrompt - explicit host text retained beside the resource inputs

 @param policy - original designated policy with its optional relevance contract

 @param relevanceCapture - original relevance refresh result and failure

 @param contextPublication - original governing context publication link

 @param retainedResourceReceipts - previous retained resource receipts

 @returns complete revalidated binding and retained receipt sequence

 @example
 ```ts
 const publication = buildPolicyBinding({ frame, source, policy, relevanceCapture, contextPublication, retainedResourceReceipts });
 ```
 */
export function buildPolicyBinding({
  frame,
  source,
  hostPrompt,
  policy,
  relevanceCapture,
  contextPublication,
  retainedResourceReceipts
}: {
  readonly frame: PolicyResourceFrame;
  readonly source: GoverningPolicyCapture;
  readonly hostPrompt?: HostPromptInput;
  readonly policy: NativePolicyDesignation['policy'];
  readonly relevanceCapture: RelevanceCapture;
  readonly contextPublication?: ContextPolicyPublication;
  readonly retainedResourceReceipts: readonly ResourceReceiptInput[];
}): PolicyReloadPublication {
  /**
   Original system stage supplies the unregistered resource-stage text.
   */
  const system = frame.stages
    .find(function isResourceSystemStage(value: PolicyResourceStage): value is ResourceSystemStage { return (value.kind === 'system'); });
  /**
   Explicit host text replaces the resource-stage publication without changing its absence.
   */
  const systemStage = hostPrompt ? undefined : nonNullishOrThrow(system);
  /**
   Resource-stage text publishes only when no host text owns the system slot.
   */
  const resourceSystemInput = (systemStage === undefined)
    || (systemStage.after === undefined) ? undefined : Object.freeze({
      kind: 'native-resource-system-input',
      content: systemStage.after,
      sha256: createHash('sha256')
        .update(systemStage.after)
        .digest('hex'),
      occurrence: Object.freeze({}),
      registration: undefined,
      pathToRawFileIdentity: 'not-established'
    });
  /**
   Governing carriers link each emitted policy entry to its original ordinal.
   */
  const contextCarriers = contextPublication
    ?.carriers
    ?? Object.freeze([]);
  /**
   Carrier lookup indexes governing links by their original context ordinal.
   */
  const carrierByOrdinal = new Map(contextCarriers.map(function indexContextCarrier(carrier): [
    number,
    typeof carrier
  ] {
    return ([
      carrier.ordinal,
      carrier
    ]);
  }));
  /**
   Original context phase supplies the complete detached context snapshot.
   */
  const context = frame.stages
    .find(function isResourceContextStage(value: PolicyResourceStage): value is ResourceContextStage { return (value.kind === 'context'); });
  /**
   Original append phase supplies the complete ordered appendix texts.
   */
  const append = frame.stages
    .find(function isResourceAppendStage(value: PolicyResourceStage): value is ResourceAppendStage { return (value.kind === 'append'); });
  /**
   Append inputs keep their original ordinal and complete text digest.
   */
  const appendInputs: readonly AppendPromptInput[] = Object.freeze(nonNullishOrThrow(append)
    .after
    .map(function captureResourceAppendInput(
      content,
      ordinal
    ) { return (Object.freeze({
      kind: 'native-resource-append-input',
      content,
      ordinal,
      sha256: createHash('sha256')
        .update(content)
        .digest('hex'),
      occurrence: Object.freeze({}),
      registration: undefined,
      pathToRawFileIdentity: 'not-established'
    })); }));
  /**
   Context inputs keep their original entry and governing carrier link.
   */
  const contextInputs: readonly ContextPromptInput[] = Object.freeze(nonNullishOrThrow(context)
    .after
    .agentsFiles
    .map(function captureResourceContextInput(
      entry,
      ordinal
    ) {
      /**
       Original ordinal lookup links the governing carrier without minting one.
       */
      const carrier = carrierByOrdinal.get(ordinal);
      return (Object.freeze({
        kind: 'native-resource-context-input',
        content: entry.content,
        path: entry.path,
        ordinal,
        entry,
        carrier,
        sha256: createHash('sha256')
          .update(entry.content)
          .digest('hex'),
        occurrence: Object.freeze({}),
        registration: undefined,
        pathToRawFileIdentity: 'not-established'
      }));
    }));
  /**
   Receipt retention accumulates this occurrence's receipts beside earlier ones.
   */
  const receipts = retainResourceReceiptInputs({
    previous: retainedResourceReceipts,
    current: createResourceReceiptInputs({
      frame,
      ...(contextPublication === undefined ? {} : { priorContext: contextPublication.prior })
    })
  });
  /**
   Readable custody keeps only entries matching their original readable file.
   */
  const readablePolicies = bindReadablePolicyFiles(contextInputs);
  /**
   Decision selection retains the original excerpt material beside its failure.
   */
  const decisionSelection = policy.relevance ? captureDecisionMaterial({
    sources: Object.freeze([
      source,
      ...readablePolicies.sources
    ]),
    input: {
      parsePolicy: policy.relevance
        .parse,
      relevance: relevanceCapture.relevance,
      relevanceFailure: relevanceCapture.relevanceFailure
    }
  }) : undefined;
  /**
   Published binding keeps every original proof field and layout constant.
   */
  const binding: PolicyInputBinding = Object.freeze({
    readablePolicies,
    decisionSelection,
    relevance: relevanceCapture.relevance,
    resourceReceiptInputs: receipts,
    source,
    frame,
    appendInputs,
    contextInputs,
    contextCarriers,
    slot: 'governing-policy',
    singleCarrier: false,
    sourceOccurrenceLinked: false,
    otherInstructionCoverage: 'not-established',
    permission: false,
    ...(relevanceCapture.relevanceFailure === undefined ? {} : { relevanceFailure: relevanceCapture.relevanceFailure }),
    ...(resourceSystemInput === undefined ? {} : { resourceSystemInput }),
    ...(contextPublication === undefined ? {} : { priorContext: contextPublication.prior })
  });
  return Object.freeze({
    binding,
    retainedResourceReceipts: receipts
  });
}
