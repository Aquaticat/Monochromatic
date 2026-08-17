/**
 * Publication and reconciliation errors.
 *
 * @module
 */

/**
 * Reports terminal publication response or retry failure.
 */
export class IssuePublicationError extends Error {
  /**
   * Creates publication failure.
   *
   * @param message - Safe status or response-shape diagnostic.
   *
   * @example
   * ```ts
   * const error = new IssuePublicationError('Issue creation failed');
   * ```
   */
  public constructor(message: string,) {
    super(message,);
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
