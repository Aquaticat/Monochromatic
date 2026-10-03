/**
 Loaded-configuration validation failure shared by every config validator.

 @module
 */

/**
 Loaded configuration failed runtime validation.

 @example
 ```ts
 throw new ConfigValidationError('Unknown configuration key: x');
 ```
 */
export class ConfigValidationError extends Error {
  /**
   Creates configuration validation failure.

   @param message - safe failure explanation
   */
  public constructor(message: string,) {
    super(message,);
    this.name = 'ConfigValidationError';
  }
}
