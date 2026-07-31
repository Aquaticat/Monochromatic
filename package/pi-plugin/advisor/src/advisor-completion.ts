/**
 * Bounded Advisor provider-attempt state machine.
 *
 * @module
 */

import type {
  AssistantMessage,
  SimpleStreamOptions,
} from '@earendil-works/pi-ai';
import { caughtValueText, } from '@monochromatic-dev/module-caught-value/ts';
import type {
  ForeignBorrowed,
  ForeignHostCapability,
} from '@monochromatic-dev/ownership-marker-foreign-borrowed/ts';

//region Constants

/** Maximum provider attempts allowed for one Advisor operation. */
const MAX_ADVISOR_ATTEMPTS = 2;

//endregion Constants

//region Types

/**
 * Deadline shared by every provider attempt in one Advisor operation.
 */
type AdvisorDeadline = {
  /** Absolute operation deadline in Unix milliseconds. */
  readonly deadlineAtMs: number;
  /** Configured total operation timeout. */
  readonly timeoutMs: number;
  /** Caller cancellation signal, when supplied by Pi. */
  readonly callerSignal?: ForeignHostCapability<AbortSignal>;
  /** Timeout signal owned by Advisor. */
  readonly timeoutSignal: AbortSignal;
  /** Combined caller and timeout signal handed to providers. */
  readonly combinedSignal: AbortSignal;
};

/**
 * Inputs for one bounded Advisor completion sequence.
 */
export type CompleteAdvisorAttemptsOptions = {
  /** Canonical selected model slug used in diagnostics. */
  readonly modelSlug: string;
  /** Configured total operation timeout. */
  readonly timeoutMs: number;
  /** Operation start time, including context preparation. */
  readonly operationStartedAtMs?: number;
  /** Caller cancellation signal from Pi. */
  readonly signal?: ForeignHostCapability<AbortSignal>;
  /** Provider options shared by every attempt. */
  readonly providerOptions: Readonly<Omit<SimpleStreamOptions, 'signal' | 'timeoutMs'>>;
  /** Provider invocation boundary supplied by Advisor client. */
  readonly complete: (options: {
    readonly providerOptions: ForeignHostCapability<SimpleStreamOptions>;
  }) => Promise<AssistantMessage>;
};

//endregion Types

//region Errors

/**
 * Advisor completion failure carrying a user-visible provider diagnostic.
 *
 * @example
 * ```typescript
 * throw new AdvisorCompletionError('advisor: provider call failed');
 * ```
 */
export class AdvisorCompletionError extends Error {
  /**
   * Build an Advisor completion failure.
   *
   * @param message - actionable failure diagnostic
   */
  public constructor(message: string,) {
    super(message,);
    this.name = AdvisorCompletionError.name;
  }
}

//endregion Errors

//region Public API

/**
 * Complete Advisor through at most one no-text retry under a shared deadline.
 *
 * @param options - provider boundary, deadline, and diagnostic identity
 *
 * @returns successful Advisor response containing user-visible text
 *
 * @throws {@link AdvisorCompletionError} when provider fails, aborts, times out, requests a tool, or returns no text twice
 *
 * @example
 * ```typescript
 * await completeAdvisorAttempts({ modelSlug, timeoutMs, providerOptions, complete });
 * ```
 */
export async function completeAdvisorAttempts(
  options: ForeignBorrowed<CompleteAdvisorAttemptsOptions>,
): Promise<AssistantMessage> {
  /** Shared operation deadline for every attempt. */
  const deadline = createAdvisorDeadline({
    timeoutMs: options.timeoutMs,
    ...(options.operationStartedAtMs === undefined
      ? {}
      : { operationStartedAtMs: options.operationStartedAtMs, }),
    ...(options.signal === undefined ? {} : { callerSignal: options.signal, }),
  },);

  for (let attempt = 1; attempt <= MAX_ADVISOR_ATTEMPTS; attempt += 1) {
    throwIfDeadlineEnded({
      deadline,
      modelSlug: options.modelSlug,
      attempt,
    },);
    /** Provider options with shared signal and remaining deadline. */
    const attemptOptions: SimpleStreamOptions = {
      ...options.providerOptions,
      signal: deadline.combinedSignal,
      timeoutMs: remainingDeadlineMs(deadline,),
    };
    /** Terminal response from current provider attempt. */
    let response: AssistantMessage;
    try {
      response = await options.complete({
        providerOptions: attemptOptions,
      },);
    }
    catch (error) {
      throw completionErrorFromCaught({
        error,
        deadline,
        modelSlug: options.modelSlug,
        attempt,
      },);
    }

    throwForFailedResponse({
      response,
      deadline,
      modelSlug: options.modelSlug,
      attempt,
    },);
    if (responseHasText(response,))
      return response;
  }

  throwIfDeadlineEnded({
    deadline,
    modelSlug: options.modelSlug,
    attempt: MAX_ADVISOR_ATTEMPTS,
  },);
  throw new AdvisorCompletionError(
    `advisor: provider ${options.modelSlug} returned no text after ${String(MAX_ADVISOR_ATTEMPTS,)} attempts`,
  );
}

//endregion Public API

//region Deadline helpers

/**
 * Create one deadline shared by all provider attempts.
 *
 * @param timeoutMs - configured total timeout
 *
 * @param operationStartedAtMs - operation start time before context preparation
 *
 * @param callerSignal - caller cancellation signal
 *
 * @returns shared deadline state
 */
function createAdvisorDeadline(
  {
    timeoutMs,
    operationStartedAtMs = Date.now(),
    callerSignal,
  }: ForeignBorrowed<Readonly<{
    timeoutMs: number;
    operationStartedAtMs?: number;
    callerSignal?: ForeignHostCapability<AbortSignal>;
  }>>,
): AdvisorDeadline {
  /** Absolute deadline inherited by every attempt. */
  const deadlineAtMs = operationStartedAtMs + timeoutMs;
  /** Initial timeout delay, clamped for AbortSignal.timeout. */
  const initialRemainingMs = Math.max(
    1,
    Math.ceil(deadlineAtMs - Date.now(),),
  );
  /** Advisor-owned signal identifying deadline expiry. */
  const timeoutSignal = AbortSignal.timeout(initialRemainingMs,);
  return {
    deadlineAtMs,
    timeoutMs,
    ...(callerSignal === undefined ? {} : { callerSignal, }),
    timeoutSignal,
    combinedSignal: callerSignal === undefined
      ? timeoutSignal
      : AbortSignal.any([
        callerSignal,
        timeoutSignal,
      ],),
  };
}

/**
 * Return positive provider timeout remaining under shared deadline.
 *
 * @param deadline - shared Advisor deadline
 *
 * @returns remaining timeout rounded up to one millisecond minimum
 */
function remainingDeadlineMs(
  deadline: ForeignBorrowed<AdvisorDeadline>,
): number {
  return Math.max(
    1,
    Math.ceil(deadline.deadlineAtMs - Date.now(),),
  );
}

/**
 * Throw when caller cancellation or Advisor deadline already ended the operation.
 *
 * @param deadline - shared operation deadline
 *
 * @param modelSlug - selected model diagnostic identity
 *
 * @param attempt - current provider attempt
 *
 * @throws {@link AdvisorCompletionError} when operation ended
 */
function throwIfDeadlineEnded(
  {
    deadline,
    modelSlug,
    attempt,
  }: ForeignBorrowed<Readonly<{
    deadline: AdvisorDeadline;
    modelSlug: string;
    attempt: number;
  }>>,
): void {
  if (deadline.callerSignal?.aborted === true) {
    throw new AdvisorCompletionError(
      `advisor: call cancelled for ${modelSlug} on attempt ${String(attempt,)}`,
    );
  }
  if (deadline.timeoutSignal.aborted || (Date.now() >= deadline.deadlineAtMs)) {
    throw new AdvisorCompletionError(
      `advisor: call timed out after ${String(deadline.timeoutMs,)}ms for ${modelSlug} on attempt ${String(attempt,)}`,
    );
  }
}

//endregion Deadline helpers

//region Response classification

/**
 * Throw for unsuccessful terminal provider responses.
 *
 * @param response - terminal provider response
 *
 * @param deadline - shared operation deadline
 *
 * @param modelSlug - selected model identity
 *
 * @param attempt - provider attempt number
 *
 * @throws {@link AdvisorCompletionError} for error, abort, or unexpected tool use
 */
function throwForFailedResponse(
  {
    response,
    deadline,
    modelSlug,
    attempt,
  }: ForeignBorrowed<Readonly<{
    response: AssistantMessage;
    deadline: AdvisorDeadline;
    modelSlug: string;
    attempt: number;
  }>>,
): void {
  if (response.stopReason === 'error') {
    throw new AdvisorCompletionError(
      `advisor: provider call failed for ${modelSlug} on attempt ${String(attempt,)}: ${responseFailureText(response,)}`,
    );
  }
  if (response.stopReason === 'aborted') {
    throwIfDeadlineEnded({ deadline, modelSlug, attempt, },);
    throw new AdvisorCompletionError(
      `advisor: provider aborted ${modelSlug} on attempt ${String(attempt,)}: ${responseFailureText(response,)}`,
    );
  }
  if (response.stopReason === 'toolUse') {
    throw new AdvisorCompletionError(
      `advisor: provider ${modelSlug} requested unavailable tool use on attempt ${String(attempt,)}`,
    );
  }
}

/**
 * Convert thrown provider boundary value into classified Advisor failure.
 *
 * @param error - thrown provider boundary value
 *
 * @param deadline - shared operation deadline
 *
 * @param modelSlug - selected model identity
 *
 * @param attempt - provider attempt number
 *
 * @returns classified Advisor completion error
 */
function completionErrorFromCaught(
  {
    error,
    deadline,
    modelSlug,
    attempt,
  }: ForeignBorrowed<Readonly<{
    error: unknown;
    deadline: AdvisorDeadline;
    modelSlug: string;
    attempt: number;
  }>>,
): AdvisorCompletionError {
  try {
    throwIfDeadlineEnded({ deadline, modelSlug, attempt, },);
  }
  catch (deadlineError) {
    if (deadlineError instanceof AdvisorCompletionError)
      return deadlineError;
    throw deadlineError;
  }
  return new AdvisorCompletionError(
    `advisor: provider call failed for ${modelSlug} on attempt ${String(attempt,)}: ${caughtValueText(error,)}`,
  );
}

/**
 * Extract provider error and redacted diagnostic text.
 *
 * @param response - failed provider response
 *
 * @returns visible diagnostic text
 */
function responseFailureText(
  response: ForeignBorrowed<AssistantMessage>,
): string {
  /** Trimmed provider error, when present. */
  const errorMessage = response.errorMessage
    ?.trim();
  /** Serialized redacted provider diagnostics, when present. */
  const diagnostics = response.diagnostics === undefined
    ? ''
    : JSON.stringify(response.diagnostics,);
  if ((errorMessage !== undefined) && (errorMessage !== ''))
    return diagnostics === ''
      ? errorMessage
      : `${errorMessage}; diagnostics=${diagnostics}`;
  return diagnostics === ''
    ? `stopReason=${response.stopReason}`
    : `diagnostics=${diagnostics}`;
}

/**
 * Test whether response contains user-visible Advisor text.
 *
 * @param response - terminal provider response
 *
 * @returns whether any non-empty text block exists
 */
function responseHasText(
  response: ForeignBorrowed<AssistantMessage>,
): boolean {
  return response.content.some(function hasTextContent(
    block: ForeignBorrowed<AssistantMessage['content'][number]>,
  ): boolean {
    return (block.type === 'text') && (block.text !== '');
  },);
}

//endregion Response classification
