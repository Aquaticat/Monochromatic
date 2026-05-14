/**
 * Custom error subclasses for programmatic discrimination via `instanceof`.
 *
 * Classes are used here only because `instanceof` is the standard JS
 * idiom for thrown-error discrimination; the rest of the public API is
 * free-function only.
 *
 * @module
 */

/**
 * Base error class. All other errors from this module extend this one.
 *
 * Wraps an underlying cause via the standard `Error.options.cause`.
 *
 * @example
 * ```ts
 * try {
 *   parseTomlEdit({ source: badInput, },);
 * } catch (e) {
 *   if (e instanceof TomlEditError) handle(e,);
 * }
 * ```
 */
export class TomlEditError extends Error {
  /** Wrap `message` and the optional `cause`. */
  constructor(message: string, options?: ErrorOptions,) {
    super(message, options,);
    this.name = 'TomlEditError';
  }
}

/**
 * Thrown when a read or write targets a path that does not exist (and the
 * operation cannot resolve it via path-create).
 */
export class TomlPathNotFoundError extends TomlEditError {
  /** Wrap `message` and the optional `cause`. */
  constructor(message: string, options?: ErrorOptions,) {
    super(message, options,);
    this.name = 'TomlPathNotFoundError';
  }
}

/**
 * Thrown when a function that requires splice mode (e.g. `tomlGetRaw`) is
 * called on a canonical-mode state.
 */
export class TomlSpliceUnavailableError extends TomlEditError {
  /** Wrap `message` and the optional `cause`. */
  constructor(message: string, options?: ErrorOptions,) {
    super(message, options,);
    this.name = 'TomlSpliceUnavailableError';
  }
}

/**
 * Thrown when a JS value cannot be coerced into a TOML value (e.g. `null`,
 * `undefined`, symbols, functions).
 */
export class TomlTypeError extends TomlEditError {
  /** Wrap `message` and the optional `cause`. */
  constructor(message: string, options?: ErrorOptions,) {
    super(message, options,);
    this.name = 'TomlTypeError';
  }
}

/**
 * Thrown when an operation targets an AST shape that the v1 implementation
 * does not support mutating (e.g. overwriting an entire array-of-tables in
 * one shot). Documented in the package's Open risks.
 */
export class TomlImmutableNodeError extends TomlEditError {
  /** Wrap `message` and the optional `cause`. */
  constructor(message: string, options?: ErrorOptions,) {
    super(message, options,);
    this.name = 'TomlImmutableNodeError';
  }
}
