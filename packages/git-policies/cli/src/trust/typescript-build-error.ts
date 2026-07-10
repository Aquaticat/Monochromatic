/**
 * TypeScript trust build error boundary.
 *
 * @module
 */

/**
 * TypeScript trust build failure.
 */
export class TypeScriptBuildError extends Error {
  /**
   * Creates stable TypeScript build failure.
   *
   * @param message - safe failure explanation
   *
   * @param options - optional cause
   */
  public constructor(
    message: string,
    options?: Readonly<ErrorOptions>,
  ) {
    super(
      message,
      options,
    );
    this.name = 'TypeScriptBuildError';
  }
}
