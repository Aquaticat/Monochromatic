/**
 * Error raised when command-line arguments do not satisfy the command contract.
 *
 * @example
 * ```ts
 * throw new CliUsageError('Missing required option: --allowed');
 * ```
 */
export class CliUsageError extends Error {}

/**
 * Error raised when input text cannot represent an address set accepted by the CLI.
 *
 * @example
 * ```ts
 * throw new InputValidationError('Allowed input must contain at least one address.');
 * ```
 */
export class InputValidationError extends Error {}
