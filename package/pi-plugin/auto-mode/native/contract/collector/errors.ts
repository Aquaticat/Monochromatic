/**
 Source collection failures describe unavailable evidence without interpreting instruction meaning.

 @module
 */

//region Collection failures retain their original shared runtime identity

/**
 Original collector category remains shared by typed and native JavaScript callers.
 */
export class SourceCollectionError extends Error {
  /**
   Subclasses can retain their distinct collection diagnostics.
   */
  override readonly name: string = 'SourceCollectionError';
}

//endregion Collection failures retain their original shared runtime identity
