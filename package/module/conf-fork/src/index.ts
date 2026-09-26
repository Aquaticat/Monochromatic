/**
 TypeScript fork of [`conf`](https://github.com/sindresorhus/conf) by
 Sindre Sorhus (MIT): a JSON config file store with defaults,
 schema validation,
 dot-notation access,
 optional encryption,
 migrations,
 watching,
 and change events.
 
 Rewritten to this repository's TypeScript standards with upstream `conf`
 15.1.0 behavior preserved. The only API-shape deviations are
 lint-mandated: {@link createConf} is a factory instead of a class,
 multi-argument members take one destructured object,
 and change callbacks receive one change object instead of positional
 pairs.
 
 @example
 ```ts
 import { createConf, } from '\@monochromatic-dev/module-conf-fork';
 
 const config = createConf<{ theme: string, }>({
   projectName: 'foo',
   defaults: { theme: 'light', },
 });
 config.set({ key: 'theme', value: 'dark', });
 config.get('theme'); // => 'dark'
 ```
 
 @packageDocumentation
 */

export {
  createConf,
  type Conf,
} from './conf.ts';

export type {
  AjvOptions,
  Options,
  Schema,
  ValueSchema,
} from './options.ts';

export type {
  BeforeEachMigrationCallback,
  BeforeEachMigrationContext,
  Deserialize,
  DotNotationKeyOf,
  DotNotationValueOf,
  Migrations,
  OnDidAnyChangeCallback,
  OnDidChangeCallback,
  PartialObjectDeep,
  Serialize,
  StoreChange,
  Unsubscribe,
  ValueChange,
} from './types.ts';

export {
  DecryptionFailedError,
  InvalidAuthenticationTagError,
  InvalidCallbackError,
  InvalidEncryptionAlgorithmError,
  InvalidKeyError,
  InvalidSchemaError,
  MigrationFailedError,
  MissingProjectNameError,
  MissingProjectVersionError,
  MissingValueError,
  NonArrayValueError,
  ReservedKeyError,
  RootSchemaPropertiesError,
  SchemaViolationError,
  UnsupportedValueTypeError,
} from './errors.ts';

export {
  decryptConfigData,
  encryptSerializedStore,
  type EncryptionAlgorithm,
  type EncryptionKey,
} from './encryption.ts';

export {
  isMissingFileError,
  isRecoverableReadFailure,
} from './store-file.ts';

/**
 @internal Test-fixture helpers for the built artifact;
 not part of the supported store API.
 */
export {
  bytesToString,
  concatBytes,
  stringToBytes,
} from './bytes.ts';
