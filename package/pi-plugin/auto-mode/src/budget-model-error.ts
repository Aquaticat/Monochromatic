/**
 * Auto-mode judge-model availability error.
 *
 * @module
 */

/**
 * Error thrown when fixed judge selection cannot return an authenticated model.
 *
 * @example
 * ```typescript
 * throw new NoBudgetModelError('no active model set');
 * ```
 */
class NoBudgetModelError extends Error {
  /**
   * Create unavailable-model error with remediation through Pi's host model registry.
   *
   * @param reason - why fixed judge selection failed
   */
  public constructor(reason: string,) {
    super(
      [
        "Tried to auto-detect a fast judge model for a background task, but couldn't find one.",
        `Reason: ${reason}`,
        'To fix: authenticate a model in Pi or expand Pi\'s effective model scope.',
      ].join('\n',),
    );
    this.name = 'NoBudgetModelError';
  }
}

export { NoBudgetModelError, };
