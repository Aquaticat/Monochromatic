/**
 Failure class for the markdown-lint policy adapter.

 @module
 */

/**
 Thrown when the markdown-lint subprocess cannot be started, is interrupted,
 or exits with a usage or infrastructure status. A lint violation is never an
 error: it becomes a finding.

 @example
 ```ts
 throw new MarkdownLintPluginError('markdown-lint could not be started.', { cause });
 ```
 */
export class MarkdownLintPluginError extends Error {
  /**
   @param message - reason the adapter failed

   @param options - optional cause, kept for the log line
   */
  constructor(
    message: string,
    options?: ErrorOptions,
  ) {
    super(
      message,
      options,
    );
    this.name = 'MarkdownLintPluginError';
  }
}
