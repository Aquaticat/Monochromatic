/**
 * Reports that no PATH-exposed candidate can act as real Git.
 *
 * @example
 * ```ts
 * throw new RealGitNotFoundError();
 * ```
 */
export class RealGitNotFoundError extends Error {
  /**
   * Stable error classification independent of minification.
   */
  override readonly name = 'RealGitNotFoundError';

  /**
   * Creates resolution failure with operator-facing remediation.
   *
   * @example
   * ```ts
   * const error = new RealGitNotFoundError();
   * ```
   */
  constructor() {
    super(
      'Could not find a real Git executable on PATH. '
        + 'Ensure Git is installed and PATH/PATHEXT expose its executable.',
    );
  }
}
