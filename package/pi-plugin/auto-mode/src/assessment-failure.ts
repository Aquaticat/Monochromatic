/** Sanitized transport failures retain retry eligibility without borrowed causes. @module */
import { tagged } from '@monochromatic-dev/module-logger/ts';

//region Transport categories never supply model answers or execution permission.
/** Permanent preparation, protocol, and cancellation failures do not authorize retries. */
export class AssessmentTransportError extends Error {
  /** Identify the transport seam without retaining upstream failure text. */
  override readonly name: string = 'AssessmentTransportError';
}

/** Only an actual failed HTTP invocation can produce this transport category. */
export class AssessmentRequestFailure extends AssessmentTransportError {
  /** Distinguish request failures from credential, cancellation, and protocol rejection. */
  override readonly name = 'AssessmentRequestFailure';
}

/**
 Classify complete failed bundles without accepting protocol or credential failures.
 @param error - actual rejection from the original assessment invocation
 @returns whether every failed call permits the original bounded retry
 */
export function isRetryableAssessmentFailure(error: unknown): boolean {
  /** Only category information crosses the diagnostic seam. */
  const l = tagged({ tag: isRetryableAssessmentFailure.name });
  /** Unprocessed failures retain the original bundle's complete rejection set. */
  const pending: unknown[] = [error];
  /** Cyclic aggregate graphs cannot qualify for automatic transport recovery. */
  const visited = new Set<unknown>();
  /** An empty aggregate is not evidence that an HTTP invocation failed. */
  const failures = new Set<AssessmentRequestFailure>();
  while (pending.length > 0) {
    /** Each original rejection is classified independently of its borrowed message. */
    const current = pending.pop();
    if (current instanceof AggregateError) {
      if (visited.has(current)) return false;
      visited.add(current);
      pending.push(...current.errors);
      continue;
    }
    if (!(current instanceof AssessmentRequestFailure)) {
      l.debug('assessment failure does not permit transport retry');
      return false;
    }
    failures.add(current);
  }
  l.debug('classified original failed assessment bundle');
  return failures.size > 0;
}
//endregion
