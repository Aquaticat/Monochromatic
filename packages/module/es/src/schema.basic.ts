import type { Promisable, } from 'type-fest';


/**
 * Generic schema interface that validation libraries can implement for parsing values.
 * Provides synchronous or asynchronous parsing capability through a unified parse method.
 *
 * @example
 * ```ts
 * const numberSchema: Schema = {
 *   parse: (value) => {
 *     if (typeof value === 'number') return value;
 *     throw new Error('Expected number');
 *   }
 * };
 * ```
 */
export type Schema<Input = unknown, Output = Input> = {
  readonly parse: (
    value: Input,
  ) => Promisable<Output>;
};

/**
 * Schema interface for synchronous validation only.
 * Restricts parsing to synchronous operations by returning non-Promise values.
 *
 * @example
 * ```ts
 * const syncSchema: SyncSchema = {
 *   parse: (value) => {
 *     if (typeof value === 'string') return value;
 *     throw new Error('Expected string');
 *   }
 * };
 * ```
 */
export type SyncSchema = {
  readonly parse: (value: unknown,) => unknown;
};

/**
 * Schema interface for asynchronous validation.
 * Provides parseAsync method for handling Promise-based validation logic.
 *
 * @example
 * ```ts
 * const asyncSchema: AsyncSchema = {
 *   parseAsync: async (value) => {
 *     const result = await validateAsync(value);
 *     return result;
 *   }
 * };
 * ```
 */
export type AsyncSchema = {
  readonly parseAsync: (value: unknown,) => Promisable<unknown>;
};

/**
 * Union type combining synchronous and asynchronous schema interfaces.
 * Allows validation functions to accept either sync or async schema objects.
 *
 * @example
 * ```ts
 * function validateWith(schema: MaybeAsyncSchema, value: unknown) {
 *   if ('parseAsync' in schema) {
 *     return schema.parseAsync(value);
 *   }
 *   return schema.parse(value);
 * }
 * ```
 */
export type MaybeAsyncSchema = {
  readonly parse: (value: unknown,) => Promisable<unknown>;
} | AsyncSchema;

/**
 * Type guard determining if value implements the generic Schema interface.
 * Checks for presence and function type of parse method to ensure schema compatibility.
 *
 * @param value - Value to test for Schema interface compliance
 * @returns True if value has callable parse method, false otherwise
 *
 * @example
 * ```ts
 * const maybeSchema = { parse: (x) => x };
 * if (isSchema(maybeSchema)) {
 *   // TypeScript knows maybeSchema has parse method
 *   const result = maybeSchema.parse(input);
 * }
 * ```
 */
export function isSchema(value: unknown,): value is Schema {
  if (value === null)
    return false;
  if (typeof value !== 'object')
    return false;
  if (!(value as { parse: unknown; }).parse)
    return false;
  return typeof ((value as { parse: unknown; }).parse) === 'function';
}

/**
 * Type guard determining if value implements the AsyncSchema interface.
 * Validates presence and function type of parseAsync method for async schema detection.
 *
 * @param value - Value to test for AsyncSchema interface compliance
 * @returns True if value has callable parseAsync method, false otherwise
 *
 * @example
 * ```ts
 * const asyncValidator = { parseAsync: async (x) => x };
 * if (isAsyncSchema(asyncValidator)) {
 *   // TypeScript knows asyncValidator has parseAsync method
 *   const result = await asyncValidator.parseAsync(input);
 * }
 * ```
 */
export function isAsyncSchema(value: unknown,): value is AsyncSchema {
  if (value === null)
    return false;
  if (typeof value !== 'object')
    return false;
  if (!(value as { parse: unknown; }).parse)
    return false;
  return typeof ((value as { parseAsync: unknown; }).parseAsync) === 'function';
}

/**
 * Type guard determining if value implements either Schema or AsyncSchema interface.
 * Provides unified detection for both synchronous and asynchronous validation schemas.
 *
 * @param value - Value to test for schema interface compliance
 * @returns True if value implements any schema interface, false otherwise
 *
 * @example
 * ```ts
 * function processSchema(schema: unknown) {
 *   if (isMaybeAsyncSchema(schema)) {
 *     // Can safely use schema for validation
 *     return convertToAsync(schema);
 *   }
 *   throw new Error('Invalid schema');
 * }
 * ```
 */
export function isMaybeAsyncSchema(value: unknown,): value is MaybeAsyncSchema {
  return isSchema(value,) || isAsyncSchema(value,);
}

/**
 * Converts any schema type to AsyncSchema interface for unified async processing.
 * Wraps synchronous parse method with parseAsync when needed for consistency.
 *
 * @param schema - Schema to convert to async interface
 * @returns AsyncSchema with parseAsync method available
 *
 * @example
 * ```ts
 * const syncSchema = { parse: (x) => x };
 * const asyncVersion = maybeAsyncSchemaToAsyncSchema(syncSchema);
 * // asyncVersion.parseAsync is now available
 * const result = await asyncVersion.parseAsync(value);
 * ```
 */
export function maybeAsyncSchemaToAsyncSchema(schema: MaybeAsyncSchema,): AsyncSchema {
  if (isAsyncSchema(schema,))
    return schema;
  return { ...schema, parseAsync: schema.parse, };
}
