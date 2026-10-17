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
  const pending: unknown[] = [error];
  const visited = new Set<unknown>();
  let failures = 0;
  while (pending.length > 0) {
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
    failures++;
  }
  l.debug('classified original failed assessment bundle');
  return failures > 0;
}
//endregion
