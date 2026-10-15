/**
 Original collector diagnostics retain their category and exact caller-supplied message. @module
 */

/**
 Native collection failures identify missing original membership or expired transport custody.
 */
export class DeclaredGroupCollectionError extends Error {
  /**
   Original diagnostic category remains independent of constructor property lookup.
   */
  override readonly name: string;

  /** Retain the original collection diagnostic without replacing its message.
   @param message - original collection boundary failure
   */
  constructor(message: string) {
    super(message);
    this.name = 'DeclaredGroupCollectionError';
  }
}
