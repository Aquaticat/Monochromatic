/** Pi host integration for operation-scoped review collection. @module */
import type { AssistantMessage, } from '@earendil-works/pi-ai';
import type { ForeignHostCapability, } from '@monochromatic-dev/ownership-marker-foreign-borrowed/ts';
import { resolveEffectiveScope, } from '@monochromatic-dev/pi-shared-model-selection/ts';
import { requestAdvisor, } from './advisor-client.ts';
import { ADVISOR_CLOCK_BOUNDARY, createAdvisorCancellation, waitForAdvisorEvent, } from './operation-clock.ts';
import { createAdvisorOperationLedger, } from './operation-ledger.ts';
import { AdvisorOperationError, } from './operation-error.ts';
import { runAdvisorOperation, } from './operation.ts';
import type { AdvisorDispatch, } from './operation-attempt.ts';
import { prepareAdvisorRun, } from './run-preparation.ts';
import type { AdvisorRunOptions, AdvisorRunResult, } from './types.ts';

/**
 Run Advisor through the Pi host while keeping preparation inside the original deadline.
 @param options - host capabilities, request, and runtime policy
 @returns collected original review text and complete available accounting
 @mutates options - scope, auth, provider, and progress callbacks consume host capabilities
 @throws when no usable review is available or the caller cancels
 @example
 ```ts
 const result = await runAdvisor({ ctx, config });
 ```
 */
export async function runAdvisor(options: ForeignHostCapability<AdvisorRunOptions>,): Promise<AdvisorRunResult> {
  /** Operation timing includes scope and evidence preparation. */
  const startedAtMs = Date.now();
  /** Original deadline never resets for fallback, retries, or collection. */
  const deadlineAtMs = startedAtMs + options.config.timeoutMs;
  /** Own cleanup even while preparation is awaiting host work. */
  using cancellation = createAdvisorCancellation();
  /** Caller cancellation is forwarded to every dispatch. */
  const signal = options.signal === undefined ? cancellation.controller.signal : AbortSignal.any([options.signal, cancellation.controller.signal,],);
  if (signal.aborted) {
    /** Empty operation preserves cancellation without invoking scope or provider capabilities. */
    const ledger = createAdvisorOperationLedger({ startedAtMs, deadlineAtMs, },);
    ledger.finish({ end: 'caller', now: Date.now(), },);
    throw new AdvisorOperationError(ledger.snapshot(),);
  }
  /** Preparation is independently bounded even if the host ignores cancellation. */
  const prepared = await waitForAdvisorEvent({ pending: [prepareAdvisorRun(options,),], untilMs: deadlineAtMs, signal, },);
  if (prepared === ADVISOR_CLOCK_BOUNDARY) {
    /** No dispatch occurred, but the local failure still has an accounting record. */
    const ledger = createAdvisorOperationLedger({ startedAtMs, deadlineAtMs, },);
    ledger.finish({ end: signal.aborted ? 'caller' : 'deadline', now: Date.now(), },);
    throw new AdvisorOperationError(ledger.snapshot(),);
  }
  /** Exact requests receive neither cross-model fallback nor speculative overlap. */
  const explicit = prepared.initial.selection.requestedSlug !== undefined;
  /** Candidate lookup retains already-serialized evidence across later scope checks. */
  const bank = new Map(prepared.candidates.map(candidate => [candidate.scopedModel.canonicalSlug, candidate,] as const),);
  /** Provider boundary refreshes scope but never reserializes later conversation messages. */
  const complete: AdvisorDispatch = async function dispatch(input): Promise<AssistantMessage> {
    /** Prepared evidence for this exact endpoint. */
    const candidate = bank.get(input.candidate.model,);
    if (candidate === undefined)
      throw new Error(`advisor: missing prepared candidate ${input.candidate.model}`,);
    /** Scope changes can remove an endpoint after the original operation began. */
    const currentScope = await resolveEffectiveScope({ ctx: options.ctx, errorPrefix: 'advisor', },);
    if (!currentScope.entries.some(entry => entry.canonicalSlug === input.candidate.model))
      throw new Error(`advisor: ${input.candidate.model} left the effective scope before dispatch`,);
    return await requestAdvisor({
      ctx: options.ctx, model: candidate.scopedModel.model, config: options.config,
      advisorContext: candidate.advisorContext, projectContext: options.projectContext ?? '',
      operationStartedAtMs: startedAtMs, signal: input.signal,
      ...(options.question === undefined ? {} : { question: options.question, }),
      onUsage: input.onUsage,
      onDispatch(metadata): void {
        /** Live session scope can change during asynchronous authentication. */
        const live = options.ctx.scopedModels;
        if (live !== undefined && live.length > 0 && !live.some(entry => `${entry.model.provider}/${entry.model.id}` === input.candidate.model))
          throw new Error(`advisor: ${input.candidate.model} left the live scope before dispatch`,);
        input.onDispatch(metadata,);
      },
    },);
  };
  if (!explicit && options.config.hedgingEnabled && options.config.hedgeDelayMs === undefined)
    throw new Error('advisor: hedgingEnabled requires an explicit hedgeDelayMs',);
  /** Sealed collection and attempt accounting. */
  const operation = await runAdvisorOperation({
    candidates: prepared.candidates.map(candidate => ({
      model: candidate.scopedModel.canonicalSlug, provider: candidate.scopedModel.model.provider,
      contextChars: candidate.advisorContext.finalChars, estimatedInputTokens: candidate.advisorContext.estimatedInputTokens,
      truncated: candidate.advisorContext.truncated,
    })),
    startedAtMs, deadlineAtMs, signal, complete, collectionGraceMs: options.config.collectionGraceMs,
    ...(!explicit && options.config.hedgingEnabled && options.config.hedgeDelayMs !== undefined ? { hedgeDelayMs: options.config.hedgeDelayMs, } : {}),
    ...(options.onUpdate === undefined ? {} : { onUpdate: options.onUpdate, }),
  },);
  if (operation.end === 'caller' || operation.reviews.length === 0)
    throw new AdvisorOperationError(operation,);
  /** First retained review in stable dispatch order supplies legacy summary metadata. */
  const first = operation.reviews[0];
  if (first === undefined)
    throw new Error('advisor: collected review disappeared',);
  /** Context metadata belongs to an actual completed review, not a failed initial model. */
  const reviewed = bank.get(first.model,);
  if (reviewed === undefined)
    throw new Error('advisor: reviewed candidate disappeared',);
  /** Return all original reviews without paying for or imposing a synthesis. */
  const text = operation.reviews.length === 1 && !first.lengthLimited ? first.text : operation.reviews.map(review =>
    `## Review from ${review.model}${review.lengthLimited ? ' (output limit reached)' : ''}\n\n${review.text}`,
  ).join('\n\n',);
  return {
    text,
    details: {
      operation,
      ...(prepared.initial.selection.requestedSlug === undefined ? {} : { requestedSlug: prepared.initial.selection.requestedSlug, }),
      selectedSlug: first.model, provider: reviewed.scopedModel.model.provider,
      scopeSource: prepared.scope.source, scopedSlugs: prepared.scope.entries.map(entry => entry.canonicalSlug),
      durationMs: Date.now() - startedAtMs, contextBudgetChars: reviewed.advisorContext.maxContextChars,
      contextChars: reviewed.advisorContext.finalChars, estimatedInputTokens: reviewed.advisorContext.estimatedInputTokens,
      truncated: reviewed.advisorContext.truncated, stopReason: first.lengthLimited ? 'length' : 'stop', usage: operation.usage,
      ...(prepared.initial.selection.defaultSelection === undefined ? {} : {
        defaultSelectionReason: `Initial selection: ${prepared.initial.selection.defaultSelection.reason}`,
        costRanking: prepared.initial.selection.defaultSelection.ranking,
      }),
    },
  };
}
