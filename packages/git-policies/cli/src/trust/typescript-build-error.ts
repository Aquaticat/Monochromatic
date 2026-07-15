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
   *
   * @mutates options through global Error options cause access
   */
  public constructor(
    message: string,
    options?: ErrorOptions,
  ) {
    super(
      message,
      options,
    );
    this.name = 'TypeScriptBuildError';
  }
}
