/**
 Model registration and routing failures with explicit input context. @module
 */

//region Domain error

/**
 Fast model cannot be registered or dispatched through the original Codex provider.
 */
export class FastModelError extends Error {
  /**
   Preserve the affected model and remediation in the diagnostic.
   
   @param message - operation-specific diagnostic
   */
  constructor(message: string,) {
    super(message,);
    this.name = 'FastModelError';
  }
}

//endregion
