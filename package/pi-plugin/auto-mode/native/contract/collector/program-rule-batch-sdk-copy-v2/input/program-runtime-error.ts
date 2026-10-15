/** Original program runtime diagnostics retain operation-specific messages. @module */

/** Runtime lifetime and membership failures remain distinct from native tool conversion failures. */
export class ReachedProgramRuntimeError extends Error {
  /** Original runtime category remains independent of mutable constructor lookup. */
  override readonly name: string;
  /** Retain the original runtime diagnostic without replacing its message.
   @param message - original runtime lifetime or membership failure
   */
  constructor(message: string) {
    super(message);
    this.name = 'ReachedProgramRuntimeError';
  }
}
