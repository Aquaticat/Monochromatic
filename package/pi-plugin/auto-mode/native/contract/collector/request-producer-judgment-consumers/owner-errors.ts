/**
 Producer custody diagnostics and the shared reference guard stay one module
 so both lifecycle and consumer owners use the exact original error constructor. @module
 */

/**
 Producer diagnostics retain the original message and optional cause.
 */
export class RequestProducerError extends Error {
  /* oxlint-disable unicorn/custom-error-definition -- The untyped owner writes the dynamic subclass name at runtime; a literal name would change subclass error identity. See doc/request-producer-owner.md. */
  /**
   Original category follows the constructing subclass name.

   @param message - original producer custody failure explanation

   @param options - original optional cause retained in the standard error chain
   */
  constructor(
    message: string,
    options?: Readonly<ErrorOptions>
  ) {
    super(
      message,
      options
    );
    this.name = this.constructor
      .name;
  }
  /* oxlint-enable unicorn/custom-error-definition */
}

/**
 Recognize the object and function values the producer tables retain.

 @param value - untrusted stream, response or option candidate

 @returns whether the candidate is an object or function reference

 @example
 ```ts
 const owned = reference(candidate);
 ```
 */
export function reference(value: unknown): value is object {
  return (value !== null) && (((typeof value) === 'object') || ((typeof value) === 'function'));
}
