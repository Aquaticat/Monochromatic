/**
 Native host failures identify their original ownership boundary.

 @module
 */

/**
 Bootstrap and lifecycle errors remain distinct from semantic policy outcomes.
 */
export class NativeCliHostError extends Error {
  /**
   Native diagnostics identify the affected host boundary.
   */
  override readonly name = 'NativeCliHostError';
}
