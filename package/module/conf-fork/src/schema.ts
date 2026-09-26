/**
 JSON Schema validation for the config store.
 
 Wraps ajv in [draft-2020-12](https://json-schema.org/draft-2020-12/release-notes)
 mode with `allErrors` and `useDefaults` on,
 exactly as upstream `conf` 15.1.0 configures it,
 and surfaces violations as {@link SchemaViolationError} with upstream's
 message text.
 
 @module
 */

import { Ajv2020 as Ajv, type ValidateFunction as AjvValidateFunction, } from 'ajv/dist/2020.js';
import ajvFormatsModule from 'ajv-formats';

import {
  InvalidSchemaError,
  RootSchemaPropertiesError,
  SchemaViolationError,
} from './errors.ts';
import type { PreparedOptions, } from './prepare-options.ts';
import type { Schema, } from './options.ts';

//region Types

/**
 Compiled validation surface for one store.
 
 @example
 ```ts
 const validator = createSchemaValidator(options);
 validator.validate({ theme: 'dark', });
 ```
 */
export type SchemaValidator = {
  /**
   Validates one store object in place,
   applying schema defaults,
   and throws on violations.
   */
  readonly validate: (data: unknown,) => void;
  /**
   Defaults declared by the schema's property definitions,
   keyed by top-level property name.
   */
  readonly schemaDefaults: Readonly<Record<string, unknown>>;
};

//endregion Types

//region Helpers

/**
 Collects each schema property's `default` value,
 which the store exposes through `get`,
 `reset`,
 and `clear`.
 
 @param schema - Property-to-schema map from the `schema` option.
 
 @returns Defaults keyed by top-level property name.
 
 @example
 ```ts
 captureSchemaDefaults({ port: { type: 'number', default: 8080, }, });
 // => { port: 8080 }
 ```
 */
export function captureSchemaDefaults<T extends Record<string, unknown>>(schema: Schema<T> | undefined,): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(schema ?? {},).filter(
      function hasDefault(entry: [string, unknown],): boolean {
        /**
         Candidate property schema from the map.
         */
        const [, candidateSchema,] = entry;
        return typeof candidateSchema === 'object'
          && candidateSchema !== null
          && Object.hasOwn(candidateSchema, 'default',)
          && (candidateSchema as {
            readonly default?: unknown;
          }).default !== undefined;
      },
    ).map(
      function toDefaultEntry(entry: [string, unknown],): [string, unknown] {
        /**
         Property schema holding the declared default.
         */
        const [propertyName, propertySchema,] = entry;
        return [
          propertyName,
          (propertySchema as {
            readonly default: unknown;
          }).default,
        ];
      },
    ),
  );
}

//endregion Helpers

//region Factory

/**
 Compiles the store's schema into a validator,
 or a no-op validator when no schema option is configured.
 
 @param options - Prepared store options carrying `schema`,
 `rootSchema`,
 and `ajvOptions`.
 
 @returns Validator applying defaults and throwing {@link SchemaViolationError}.
 
 @throws {InvalidSchemaError} When `schema` is set but is not an object.
 @throws {RootSchemaPropertiesError} When `rootSchema` carries `properties`.
 
 @example
 ```ts
 const validator = createSchemaValidator(preparedOptions);
 validator.validate({ port: 8080, });
 ```
 */
export function createSchemaValidator<T extends Record<string, unknown>>(options: PreparedOptions<T>,): SchemaValidator {
  /**
   Property-to-schema map from the `schema` option.
   */
  const schema = options.schema;
  /**
   Root-level JSON Schema keywords from the `rootSchema` option.
   */
  const rootSchema = options.rootSchema;
  /**
   ajv configuration overrides from the `ajvOptions` option.
   */
  const ajvOptions = options.ajvOptions;
  if (schema === undefined && rootSchema === undefined && ajvOptions === undefined)
    return {
      validate: function validateNothing(_data: unknown,): void {},
      schemaDefaults: {},
    };
  if (schema !== undefined && typeof schema !== 'object')
    throw new InvalidSchemaError();
  if (rootSchema !== undefined && 'properties' in rootSchema)
    throw new RootSchemaPropertiesError();
  /**
   ajv-formats entry point; upstream `conf` unwraps one extra `.default`
   layer for CommonJS/ESM interop (ajv-validator/ajv#2047).
   */
  const ajvFormats = ajvFormatsModule.default;
  /**
   Validator instance configured like upstream `conf`'s:
   every error reported,
   schema defaults applied in place.
   */
  const ajv = new Ajv({
    allErrors: true,
    useDefaults: true,
    ...ajvOptions,
  },);
  ajvFormats(ajv,);
  /**
   Whole-store schema: upstream's `rootSchema` keywords around the
   `properties` map built from `schema`.
   */
  const wholeStoreSchema = {
    ...rootSchema,
    type: 'object',
    properties: schema,
  };
  /**
   Compiled validator function holding its error list.
   */
  const validator: AjvValidateFunction = ajv.compile(wholeStoreSchema,);
  return {
    validate: function validate(data: unknown,): void {
      if (validator(data,))
        return;
      /**
       Violation descriptions collected by the failed validation.
       */
      const errors = validator.errors ?? [];
      if (errors.length === 0)
        return;
      /**
       Per-property violation texts joined into upstream's message.
       */
      const violations = errors.map(
        function toViolation(error: {
          readonly instancePath: string;
          readonly message?: string;
        },): string {
          return `\`${error.instancePath.slice(1,)}\` ${error.message ?? ''}`;
        },
      );
      throw new SchemaViolationError({
        violations,
      },);
    },
    schemaDefaults: captureSchemaDefaults(schema,),
  };
}

//endregion Factory
