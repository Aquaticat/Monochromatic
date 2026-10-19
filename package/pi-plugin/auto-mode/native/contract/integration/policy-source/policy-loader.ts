/**
 The policy loader owns mutable input publication and its exact native resource binding. @module
 */
import { createHash } from 'node:crypto';
import { caughtValueText } from '@monochromatic-dev/module-caught-value/ts';
import { nonNullishOrThrow } from '@monochromatic-dev/module-or-throw/ts';
import { tagged } from '@monochromatic-dev/module-logger/ts';
import { copyOptions } from '../../collector/resource-input-custody/values.ts';
import { readBoundResourceFrame } from '../../collector/rule-relevance-sdk-copy/input/resource-owner.mjs';
import { assertOriginalInputBudget } from './input-budget.mjs';
import {
  createGoverningContextEmitter,
  type ContextPolicyPublication
} from './context-emission.mjs';
import { copyAuthorityRegistration } from './registration.mjs';
import { retainPolicyInput } from './policy-input-collector.mjs';
import { PolicySlotBindingError } from './system-slot-error.ts';
import { buildPolicyBinding } from './policy-loader-publication.ts';
import type {
  HostPromptInput,
  PolicyInputBinding,
  PolicyLoaderConfiguration,
  PolicyLoaderHandle,
  PolicyLoaderState,
  PolicyResourceStage,
  ResourceReceiptInput,
  ResourceSystemStage,
  ResourceToolInputOrigin
} from './policy-loader-types.ts';

export type {
  PolicyInputBinding,
  PolicyLoaderConfiguration,
  PolicyLoaderState
} from './policy-loader-types.ts';

//region The loader owns mutable input publication and its exact native resource binding.

/**
 Mutable publication record is rebuilt on every reload and revalidated on every read.
 Absent entries stay optional so reads observe the original absence unchanged.
 */
type PolicyLoaderPublication = {
  binding?: PolicyInputBinding;
  contextPublication?: ContextPolicyPublication;
  failure?: {
    readonly cause: unknown;
  };
  loader?: PolicyLoaderHandle;
  retainedResourceReceipts: readonly ResourceReceiptInput[];
};

/* oxlint-disable no-restricted-syntax/no-nullish-union -- Mirrors the untyped policy-input-collector.mjs boundary whose `?? []` consumer observes the unconfigured-reader absence unchanged. */
/**
 Resource tool input view may be absent when this loader configures no fixed readers.
 */
type ResourceToolInputsView = readonly ResourceToolInputOrigin[] | undefined;
/* oxlint-enable no-restricted-syntax/no-nullish-union */

/**
 Prove the fixed reader returned its original frozen owned view.

 @param value - original resource tool input view from the fixed reader

 @returns whether the view is the original frozen owned array
 */
function isFrozenOriginArray(value: readonly ResourceToolInputOrigin[]): value is readonly ResourceToolInputOrigin[] {
  return (Array.isArray(value)) && (Object.isFrozen(value));
}

/**
 Extend the existing resource owner with an actual policy-capture-to-input link.
 The governing context emitter links its original policy capture to the native context.
 Other resource inputs are preserved, not removed to manufacture coverage.

 @param owner - original constructor owner of the created loader

 @param options - original native loader options before detached copying

 @param policy - original designated policy file and optional relevance contract

 @param authority - original startup authority declaration for this policy

 @param customPromptAuthority - original authority declaration for explicit host text

 @param readSessionConstructedInputs - fixed native session receipt reader

 @param readResourceToolInputs - fixed native frozen resource tool view reader

 @param readResourceToolOrigin - fixed native tool input origin authenticator

 @param readResourceToolUsage - fixed native resource usage counter reader

 @param readSessionInputUsage - fixed native session usage counter reader

 @param readSessionDomainEvents - fixed native session domain observation reader

 @returns complete loader-owned publication state for this policy binding

 @throws PolicySlotBindingError when the fixed readers, host prompt authority or options violate their ownership checks

 @example
 ```ts
 const state = createPolicyLoaderState({ owner, options, policy, authority });
 ```
 */
export function createPolicyLoaderState({
  owner,
  options: inputOptions,
  policy,
  authority,
  customPromptAuthority,
  readSessionConstructedInputs,
  readResourceToolInputs,
  readResourceToolOrigin,
  readResourceToolUsage,
  readSessionInputUsage,
  readSessionDomainEvents
}: PolicyLoaderConfiguration): PolicyLoaderState {
  if ((readSessionConstructedInputs !== undefined) && ((typeof readSessionConstructedInputs) !== 'function')) throw new PolicySlotBindingError('Constructed inputs require a fixed native session reader');
  if (((readResourceToolInputs === undefined) !== (readResourceToolOrigin === undefined)) || ((readResourceToolInputs !== undefined)
    && (((typeof readResourceToolInputs) !== 'function') || ((typeof readResourceToolOrigin) !== 'function')))) throw new PolicySlotBindingError('Resource tool inputs require paired fixed native readers');
  if (((readResourceToolInputs !== undefined) && ((typeof readResourceToolUsage) !== 'function')) || ((readSessionInputUsage !== undefined) && ((typeof readSessionInputUsage) !== 'function'))) throw new PolicySlotBindingError('Input budgets require fixed native usage readers');
  /**
   Copied options own every selected field without retaining borrowed dependencies.
   */
  const options = copyOptions(inputOptions);
  /**
   Original registrations copy only their declared trust-root fields.
   */
  const registration = copyAuthorityRegistration(authority);
  /**
   Host registration links explicit host text without granting instruction authority.
   */
  const hostRegistration = copyAuthorityRegistration(customPromptAuthority);
  if (hostRegistration && (((typeof options.systemPrompt) !== 'string')
    || (options.systemPromptOverride !== undefined))) throw new PolicySlotBindingError('Host prompt authority requires explicit systemPrompt text without a replacement callback');
  /**
   Explicit host text keeps its own digest when no replacement callback is configured.
   */
  const hostPrompt = ((typeof options.systemPrompt) === 'string')
    && (options.systemPromptOverride === undefined)
    ? Object.freeze({
      kind: 'bootstrap-host-custom-prompt',
      content: options.systemPrompt,
      sha256: createHash('sha256')
        .update(options.systemPrompt)
        .digest('hex'),
      occurrence: Object.freeze({}),
      registration: hostRegistration
    })
    : undefined;
  /**
   Mutable publication state owns this loader's current binding and receipts.
   */
  const inputState: PolicyLoaderPublication = {
    retainedResourceReceipts: Object.freeze([])
  };
  /**
   Context publication links the original selected capture to the native context.
   */
  const contextEmitter = createGoverningContextEmitter({
    callback: options.agentsFilesOverride,
    readSource: function captureDesignatedPolicy() {
      return owner.captureGoverningPolicy(nonNullishOrThrow(inputState.loader));
    }
  });
  inputState.loader = owner.create({
    ...options,
    agentsFilesOverride: contextEmitter.emit
  });
  /**
   Original created loader is fixed before any designation or binding exists.
   */
  const loader = nonNullishOrThrow(inputState.loader);
  owner.designateGoverningPolicy({
    ...policy,
    loader
  });
  /**
   Original native binding authenticates this loader's exact resource occurrence.
   */
  const nativeBinding = owner.bindNativeLoader(loader);

  /**
   Revalidate through the exact original binding and its retained file custody.

   @param value - original earlier policy binding

   @throws PolicySlotBindingError when the binding, frame, source or host text no longer match
   */
  function assertCurrent(value: unknown): void {
    if ((value !== inputState.binding) || (!inputState.binding)) throw new PolicySlotBindingError('Policy input link is not this loader original binding');
    if (inputState.failure) throw new PolicySlotBindingError(
      'Original policy input link lost eligibility',
      {
        cause: inputState.failure
          .cause
      }
    );
    try {
      /**
       Original bound frame is read before its retained binding copy.
       */
      const boundFrame = readBoundResourceFrame({
        binding: nativeBinding,
        loader
      });
      /**
       Retained binding frame is read after the fresh bound frame, as before.
       */
      const bindingFrame = inputState.binding
        .frame;
      if (boundFrame !== bindingFrame) throw new PolicySlotBindingError('Original resource input frame changed');
      /**
       Original selected capture is read through the exact constructor owner.
       */
      const currentSource = owner.captureGoverningPolicy(loader);
      /**
       Retained binding source is read after the fresh capture, as before.
       */
      const bindingSource = inputState.binding
        .source;
      if (currentSource !== bindingSource) throw new PolicySlotBindingError('Original selected policy capture changed');
      inputState.contextPublication
        ?.assertCurrent();
      inputState.binding
        .readablePolicies
        .assertCurrent();
      if (hostPrompt) {
        /**
         Original system stage retains the explicitly registered host text.
         */
        const system = inputState.binding
          .frame
          .stages
          .find(function isCapturedSystemStage(stage: PolicyResourceStage): stage is ResourceSystemStage { return (stage.kind === 'system'); });
        if ((system?.before !== hostPrompt.content) || (system?.after !== hostPrompt.content)) throw new PolicySlotBindingError('Native custom prompt does not retain the explicitly registered host text');
      }
    }
    catch (error) {
      inputState.failure = { cause: error };
      throw error;
    }
  }

  /**
   Rebuild the complete publication from one native reload occurrence.

   @param reloadOptions - original native reload options forwarded unchanged

   @returns complete revalidated policy binding for this publication

   @throws PolicySlotBindingError when the reloaded publication loses its selected source
   */
  async function reload(reloadOptions?: unknown): Promise<PolicyInputBinding> {
    delete inputState.binding;
    delete inputState.failure;
    delete inputState.contextPublication;
    contextEmitter.reset();
    await loader
      .reload(reloadOptions);
    /**
     Original bound frame authenticates this loader's complete phase sequence.
     */
    const frame = readBoundResourceFrame({
      binding: nativeBinding,
      loader
    });
    /**
     Original selected capture is read through the exact constructor owner.
     */
    const source = owner.captureGoverningPolicy(loader);
    /**
     Relevance capture keeps refresh failures beside their original selection inputs.
     */
    const relevanceCapture: {
      relevance?: unknown;
      relevanceFailure?: {
        readonly cause: unknown;
      };
    } = {};
    if (policy.relevance) {
      try {
        relevanceCapture.relevance = await owner.refreshGoverningRelevance({
          loader,
          signal: new AbortController().signal
        });
      }
      catch (error) {
        relevanceCapture.relevanceFailure = { cause: error };
        tagged({ tag: 'reload-policy-relevance' })
          .error(caughtValueText(error));
      }
    }
    inputState.contextPublication = contextEmitter.publish({
      nativeBinding,
      loader,
      frame,
      source
    });
    /**
     Published binding assembles every original proof field from the exact frame.
     */
    const publication = buildPolicyBinding({
      frame,
      source,
      policy,
      relevanceCapture,
      contextPublication: inputState.contextPublication,
      retainedResourceReceipts: inputState.retainedResourceReceipts,
      ...(hostPrompt === undefined ? {} : { hostPrompt })
    });
    inputState.retainedResourceReceipts = publication.retainedResourceReceipts;
    inputState.binding = publication.binding;
    assertCurrent(inputState.binding);
    return inputState.binding;
  }

  /**
   Read the current binding through its original currentness checks.

   @returns complete original policy binding
   */
  function readCurrent(): PolicyInputBinding {
    assertCurrent(inputState.binding);
    return nonNullishOrThrow(inputState.binding);
  }

  /**
   Extend the incumbent collector with this owner's exact governing-source capture.

   @param context - original incumbent collector context

   @returns incumbent collector extended by this owner's capture
   */
  function bindCollector(context: unknown): unknown {
    return retainPolicyInput({
      readSessionConstructedInputs,
      readSessionDomainEvents,
      readCurrent,
      assertCurrent,
      assertInputBudget,
      resourceInputs,
      hostPrompt,
      base: owner.bindCollector({
        loader,
        context,
        readPolicy() {
          /**
           Original policy reader exposes only identity and complete text.
           */
          const { source } = readCurrent();
          return {
            identity: source.identity,
            content: source.content
          };
        }
      })
    });
  }

  /**
   Retain actual native session/base/run publication links through the incumbent owner.

   @param session - original native session

   @returns incumbent session collector retaining its original publication links
   */
  function bindSessionCollector(session: unknown): unknown {
    return retainPolicyInput({
      readSessionConstructedInputs,
      readSessionDomainEvents,
      readCurrent,
      assertCurrent,
      assertInputBudget,
      resourceInputs,
      hostPrompt,
      base: owner.bindSessionCollector({ session }),
      session
    });
  }

  /**
   Check combined resource and session receipt counters before collection continues.

   @param session - original native session or its absence for resource-only collection

   @throws PolicySlotBindingError when combined budgets lack their native usage reader
   */
  function assertInputBudget(session: unknown): void {
    if (readResourceToolInputs === undefined) return;
    /**
     Session presence decides whether session counters join this aggregate.
     */
    const hasSession = Boolean(session);
    if (hasSession && ((typeof readSessionInputUsage) !== 'function')) throw new PolicySlotBindingError('Combined resource and session input budgets require their native session usage reader');
    /**
     Original usage counters join receipt bytes in one exact aggregate check.
     */
    const resource = nonNullishOrThrow(readResourceToolUsage)(loader);
    /**
     Session counters stay zero only when no native session joined this collection.
     */
    const currentSession = hasSession ? nonNullishOrThrow(readSessionInputUsage)(session) : {
      count: 0,
      bytes: 0
    };
    /**
     Receipt bytes accumulate complete serialized receipt occurrences.
     */
    const receiptBytes = inputState.retainedResourceReceipts
      .reduce(
        function sumReceiptInputBytes(
          bytes,
          source
        ) { return (bytes + Buffer.byteLength(JSON.stringify(source))); },
        0
      );
    /**
     Original resource count is read before the retained receipt count.
     */
    const resourceCount = resource.count;
    /**
     Retained receipt count joins the resource usage counters unchanged.
     */
    const retainedReceiptCount = inputState.retainedResourceReceipts
      .length;
    assertOriginalInputBudget({
      resource: {
        count: resourceCount + retainedReceiptCount,
        bytes: resource.bytes + receiptBytes
      },
      session: currentSession
    });
  }

  /**
   Expose only the original frozen resource tool input view of this loader.

   @returns original frozen resource tool inputs or their absence without configured readers

   @throws PolicySlotBindingError when an input is not an original unregistered receipt
   */
  function resourceInputs(): ResourceToolInputsView {
    if (readResourceToolInputs === undefined) return undefined;
    /**
     Original owned view is re-read after each exact identity check.
     */
    const origins = readResourceToolInputs(loader);
    if (!isFrozenOriginArray(origins)) throw new PolicySlotBindingError('Resource tool inputs require their original native view');
    for (const origin of origins) {
      /**
       Original origin fields are validated exactly as their checks read them.
       */
      const {
        source,
        publication,
        resourceInputOccurrence
      } = origin;
      if ((nonNullishOrThrow(readResourceToolOrigin)({
        loader,
        publication
      }) !== origin) || (resourceInputOccurrence === undefined)
        || (source.resourceInputOccurrence !== resourceInputOccurrence)
        || (publication.sourceOccurrence !== source.occurrence)
        || (source.kind !== 'native-resource-tool-input')
        || (source.registration !== undefined)
        || (source.permission !== false)) throw new PolicySlotBindingError('Resource tool input is not an original unregistered receipt of this loader');
    }
    if (
      readResourceToolInputs(loader) !== origins
    ) throw new PolicySlotBindingError('Resource tool inputs changed during source binding');
    return origins;
  }
  return Object.freeze({
    loader,
    nativeBinding,
    reload,
    readCurrent,
    assertCurrent,
    registration,
    bindCollector,
    bindSessionCollector,
    ...(hostPrompt === undefined ? {} : { hostPrompt })
  });
}

//endregion The loader owns mutable input publication and its exact native resource binding.
