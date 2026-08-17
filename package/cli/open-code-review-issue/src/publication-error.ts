/**
 * Publication and reconciliation errors.
 *
 * @module
 */

import type { InputPosition, } from './model.ts';
import type { CreatedIssue, } from './publisher-model.ts';

/**
 * Reports terminal publication response or retry failure.
 */
export class IssuePublicationError extends Error {
  /**
   * Creates publication failure.
   *
   * @param message - Safe status or response-shape diagnostic.
   *
   * @param options - Optional native error cause metadata.
   *
   * @example
   * ```ts
   * const error = new IssuePublicationError('Issue creation failed');
   * ```
   */
  public constructor(message: string, options?: ErrorOptions,) {
    super(message, options,);
    this.name = 'IssuePublicationError';
  }
}

/**
 * Reports multiple exact post-failure matches without mutating any match.
 */
export class AmbiguousReconciliationError extends IssuePublicationError {
  /**
   * Every exact matching Issue URL.
   */
  public readonly urls: readonly string[];

  /**
   * Creates multiple-match reconciliation failure.
   *
   * @param urls - Every exact title-and-body match above high-water mark.
   *
   * @example
   * ```ts
   * const error = new AmbiguousReconciliationError({ urls: ['https://example.test/1'] });
   * ```
   */
  public constructor({ urls, }: { readonly urls: readonly string[]; },) {
    super(`ambiguous create reconciliation found ${String(urls.length,)} exact matches: ${urls.join(', ',)}`,);
    this.name = 'AmbiguousReconciliationError';
    this.urls = urls;
  }
}


/**
 * Carries partial created results and exact input position of stopping failure.
 */
export class PublicationStoppedError extends IssuePublicationError {
  /**
   * Confirmed Issues created before failure.
   */
  public readonly created: readonly CreatedIssue[];

  /**
   * Input position whose publication stopped the run.
   */
  public readonly position: InputPosition;

  /**
   * Creates positioned partial publication failure.
   *
   * @param created - Confirmed Issues created before failure.
   *
   * @param position - Input position of failed Issue.
   *
   * @param cause - Original terminal publication error.
   *
   * @example
   * ```ts
   * const error = new PublicationStoppedError({ created: [], position, cause });
   * ```
   */
  public constructor({
    created,
    position,
    cause,
  }: {
    readonly created: readonly CreatedIssue[];
    readonly position: InputPosition;
    readonly cause: unknown;
  },) {
    super(
      `publication stopped at ${position.kind} ${String(position.value,)}: ${String(cause,)}`,
      { cause, },
    );
    this.name = 'PublicationStoppedError';
    this.created = created;
    this.position = position;
  }
}
