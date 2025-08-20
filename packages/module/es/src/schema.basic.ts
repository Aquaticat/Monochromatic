import type { Promisable, } from 'type-fest';
import type { Logged, } from './logged.basic';
import { getDefaultLogger, } from './string.log';

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
export type Schema<Input = unknown, Output = Input,> = {
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
 * const syncSchema: SchemaSync = {
 *   parse: (value) => {
 *     if (typeof value === 'string') return value;
 *     throw new Error('Expected string');
 *   }
 * };
 * ```
 */
export type SchemaSync<Input = unknown, Output = Input,> = {
  readonly parse: (
    value: Input,
  ) => Output;
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
export type SchemaAsync<Input = unknown, Output = Input,> = {
  readonly parseAsync: (
    value: Input,
  ) => Promisable<Output>;
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
export type MaybeAsyncSchema<Input = unknown, Output = Input,> =
  | Schema<Input, Output>
  | SchemaAsync<Input, Output>;

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
export function isSchema<
  const MyValue = unknown,
>(
  value: MyValue,
): value is MyValue extends Schema<infer MyInput, infer MyOutput>
  ? (MyValue & Schema<MyInput, MyOutput>)
  : never
{
  if (value === null)
    return false;
  if (typeof value !== 'object')
    return false;
  if (!('parse' in value))
    return false;
  return typeof value.parse === 'function';
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
export function isSchemaAsync<
  const MyValue = unknown,
>(
  value: MyValue,
): value is MyValue extends SchemaAsync<infer MyInput, infer MyOutput>
  ? (MyValue & SchemaAsync<MyInput, MyOutput>)
  : never
{
  if (value === null)
    return false;
  if (typeof value !== 'object')
    return false;
  if (!('parseAsync' in value))
    return false;
  return typeof value.parseAsync === 'function';
}

export function maybeAsyncSchemaIsSchemaAsync<const Input = unknown,
  const Output = unknown,
  const MyMaybeAsyncSchema extends MaybeAsyncSchema<Input, Output> = MaybeAsyncSchema<
    Input,
    Output
  >,>(
  maybeAsyncSchema: MyMaybeAsyncSchema,
): maybeAsyncSchema is SchemaAsync<Input, Output> & MyMaybeAsyncSchema {
  return ('parseAsync' in maybeAsyncSchema);
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
export function isMaybeAsyncSchema<
  const MyValue = unknown,
>(
  value: MyValue,
): value is MyValue extends MaybeAsyncSchema<infer MyInput, infer MyOutput>
  ? (MyValue & MaybeAsyncSchema<MyInput, MyOutput>)
  : never
{
  return isSchema(value,) || isSchemaAsync(value,);
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
export function maybeAsyncSchemaToAsyncSchema<
  const MySchema extends MaybeAsyncSchema = MaybeAsyncSchema,
>(
  { schema, l = getDefaultLogger(), }:
    & { schema: MySchema; }
    & Partial<Logged>,
): MySchema extends MaybeAsyncSchema<infer Input, infer Output>
  ? (SchemaAsync<Input, Output> & MySchema)
  : never
{
  l.trace(maybeAsyncSchemaToAsyncSchema.name,);
  if (isSchemaAsync(schema,))
    return schema as any;
  // Schema must have parse method if it's not async
  const syncSchema = schema as Schema<unknown, unknown>;
  return Object.assign(syncSchema, { parseAsync: syncSchema.parse, },) as any;
}
