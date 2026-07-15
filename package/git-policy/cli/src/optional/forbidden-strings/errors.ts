// Generated from `package/git-policy/forbidden-strings/src/errors.ts` by file-enforcer; edit canonical source owner.
/**
 * Forbidden-strings policy adapter errors.
 *
 * @module
 */

/**
 * Infrastructure failure owned by forbidden-strings plugin adapter.
 *
 * @example
 * ```ts
 * throw new ForbiddenStringsPluginError('Scanner output was malformed.');
 * ```
 */
export class ForbiddenStringsPluginError extends Error {
  /**
   * Stable error type exposed through cli-git engine diagnostics.
   */
  public override readonly name = 'ForbiddenStringsPluginError';
}
