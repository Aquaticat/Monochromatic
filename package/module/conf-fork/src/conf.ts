/**
 The config store factory.
 
 Rewrites upstream `conf` 15.1.0's `Conf` class as {@link createConf},
 a factory returning one frozen store object,
 because this repository bans classes for long-lived stateful objects.
 Behavior,
 error texts,
 and the file format stay upstream's:
 a JSON config file with defaults,
 schema validation,
 dot-notation access,
 optional encryption,
 migrations,
 watching,
 and change events.
 
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
 
 @module
 */

import path from 'node:path';
import { isDeepStrictEqual, } from 'node:util';

import { caughtValueText, } from '@monochromatic-dev/module-caught-value/ts';
import { tagged, type Logger, } from '@monochromatic-dev/module-logger/ts';

import {
  createCrud,
  type CrudApi,
} from './conf-crud.ts';
import {
  createEventMethods,
  type EventApi,
} from './conf-events.ts';
import {
  createPlainObject,
  deleteStoreValue,
  getStoreValue,
  hasStoreValue,
  setStoreValue,
} from './store-access.ts';
import {
  INTERNAL_KEY,
  MIGRATION_KEY,
  isReservedKeyPath,
} from './internal-key.ts';
import {
  createStoreFile,
  isMissingFileError,
  type StoreFile,
} from './store-file.ts';
import {
  applyMigrations,
} from './migrate.ts';
import { prepareOptions, type PreparedOptions, } from './prepare-options.ts';
import { createSchemaValidator, } from './schema.ts';
import { createConfigWatcher, type ConfigWatcher, } from './watcher.ts';
import type { MigrationHost, } from './migration-host.ts';
import type { Options, } from './options.ts';
import type {
  DotNotationKeyOf,
  DotNotationValueOf,
  OnDidAnyChangeCallback,
  OnDidChangeCallback,
  PartialObjectDeep,
  Unsubscribe,
} from './types.ts';

//region Store type

/**
 One config store:
 the frozen object {@link createConf} returns.
 
 Members mirror upstream `conf` 15.1.0's `Conf` instance with the call
 shapes this repository requires:
 multi-argument members take one destructured object,
 and `set` distinguishes its single and multi forms by the `key` and
 `values` fields.
 
 @example
 ```ts
 const config: Conf<{ theme: string, }> = createConf({
   projectName: 'foo',
 });
 ```
 */
export type Conf<T extends Record<string, unknown> = Record<string, unknown>> = {
  /**
   Path of the config file this store persists to.
   */
  readonly path: string;
  /**
   Dispatches `change` whenever the config changes;
   `onDidChange` and `onDidAnyChange` subscribe through it.
   */
  readonly events: EventTarget;
  /**
   Item count of the user-visible store.
   */
  readonly size: number;
  /**
   The whole store:
   read it for every item,
   assign it to replace everything.
   */
  store: T;

  /**
   Gets one item by key.
   */
  get<Key extends keyof T>(key: Key): T[Key];
  /**
   Gets one item with a default for missing keys.
   */
  get<Key extends keyof T>(input: {
    readonly key: Key;
    readonly defaultValue: Required<T>[Key];
  }): Required<T>[Key];
  /**
   Gets one item by dotted path.
   */
  get<Key extends DotNotationKeyOf<T>>(key: Key): DotNotationValueOf<T, Key>;
  /**
   Gets one dotted-path item with a default for missing paths.
   */
  get<Key extends DotNotationKeyOf<T>>(input: {
    readonly key: Key;
    readonly defaultValue: NonNullable<DotNotationValueOf<T, Key>>;
  }): NonNullable<DotNotationValueOf<T, Key>>;
  /**
   Gets one item from stores without static key types.
   */
  get<Key extends string, Value = unknown>(key: Exclude<Key, DotNotationKeyOf<T>>): Value;
  /**
   Gets one item from stores without static key types,
   with a default.
   */
  get<Key extends string, Value = unknown>(input: {
    readonly key: Exclude<Key, DotNotationKeyOf<T>>;
    readonly defaultValue?: Value;
  }): Value;

  /**
   Sets one item by key.
   */
  set<Key extends keyof T>(input: {
    readonly key: Key;
    readonly value?: T[Key];
  }): void;
  /**
   Sets one item by dotted path.
   */
  set<Key extends DotNotationKeyOf<T>>(input: {
    readonly key: Key;
    readonly value?: DotNotationValueOf<T, Key>;
  }): void;
  /**
   Sets one item on stores without static key types.
   */
  set(input: {
    readonly key: string;
    readonly value?: unknown;
  }): void;
  /**
   Sets multiple items at once under the `values` field.
   */
  set(input: {
    readonly values: PartialObjectDeep<T>;
  }): void;

  /**
   Reports whether an item exists.
   */
  has<Key extends keyof T>(key: Key): boolean;
  /**
   Reports whether a dotted path exists.
   */
  has<Key extends DotNotationKeyOf<T>>(key: Key): boolean;
  /**
   Reports whether a key exists on stores without static key types.
   */
  has(key: string): boolean;

  /**
   Appends one item to a key's array value.
   */
  appendToArray<Key extends keyof T>(input: {
    readonly key: Key;
    readonly value: T[Key] extends ReadonlyArray<infer U> ? U : unknown;
  }): void;
  /**
   Appends one item to a dotted path's array value.
   */
  appendToArray<Key extends DotNotationKeyOf<T>>(input: {
    readonly key: Key;
    readonly value: DotNotationValueOf<T, Key> extends ReadonlyArray<infer U> ? U : unknown;
  }): void;
  /**
   Appends one item on stores without static key types.
   */
  appendToArray(input: {
    readonly key: string;
    readonly value: unknown;
  }): void;

  /**
   Restores keys to their default values.
   */
  reset<Key extends keyof T>(input: {
    readonly keys: readonly Key[];
  }): void;
  /**
   Restores dotted paths to their default values.
   */
  reset<Key extends DotNotationKeyOf<T>>(input: {
    readonly keys: readonly Key[];
  }): void;
  /**
   Restores keys on stores without static key types.
   */
  reset(input: {
    readonly keys: readonly string[];
  }): void;

  /**
   Deletes one item.
   */
  delete<Key extends keyof T>(key: Key): void;
  /**
   Deletes one dotted path.
   */
  delete<Key extends DotNotationKeyOf<T>>(key: Key): void;

  /**
   Deletes all items,
   restoring defaults.
   */
  clear(): void;

  /**
   Subscribes to changes of one key's value.
   */
  onDidChange<Key extends keyof T>(input: {
    readonly key: Key;
    readonly callback: OnDidChangeCallback<T[Key]>;
  }): Unsubscribe;
  /**
   Subscribes to changes of one dotted path's value.
   */
  onDidChange<Key extends DotNotationKeyOf<T>>(input: {
    readonly key: Key;
    readonly callback: OnDidChangeCallback<DotNotationValueOf<T, Key>>;
  }): Unsubscribe;
  /**
   Subscribes to changes of one key on stores without static key types.
   */
  onDidChange(input: {
    readonly key: string;
    readonly callback: OnDidChangeCallback<unknown>;
  }): Unsubscribe;

  /**
   Subscribes to whole-store changes.
   */
  onDidAnyChange(callback: OnDidAnyChangeCallback<T>): Unsubscribe;

  /**
   Closes the file watcher when one exists.
   */
  closeWatcher(): void;

  /**
   Iterates the user-visible store's entries.
   */
  [Symbol.iterator](): IterableIterator<[keyof T, T[keyof T]]>;
};

//endregion Store type

//region Serialization defaults

/**
 Serializes the store like upstream `conf`'s default:
 indented JSON.
 
 @param value - Store object to serialize.
 
 @returns JSON text written to the config file.
 
 @example
 ```ts
 defaultSerialize({ theme: 'dark', });
 ```
 */
function defaultSerialize(value: unknown,): string {
  return JSON.stringify(value, undefined, '\t',);
}

/**
 Deserializes the store like upstream `conf`'s default:
 JSON parsing.
 
 @param text - Config file text.
 
 @returns Parsed store object.
 
 @example
 ```ts
 defaultDeserialize('{"theme":"dark"}');
 ```
 */
function defaultDeserialize(text: string,): Record<string, unknown> {
  return JSON.parse(text,) as Record<string, unknown>;
}

//endregion Serialization defaults

//region Helpers

/**
 Resolves the config file path from prepared options,
 with upstream `conf`'s extension handling.
 
 @param options - Prepared store options.
 
 @returns Absolute config file path.
 
 @example
 ```ts
 resolveConfigPath(prepared); // => '/home/me/.config/foo-nodejs/config.json'
 ```
 */
function resolveConfigPath<T extends Record<string, unknown>>(options: PreparedOptions<T>,): string {
  /**
   Extension suffix including its leading dot;
   empty when the extension is empty.
   */
  const extensionSuffix = options.fileExtension === '' ? '' : `.${options.fileExtension}`;
  return path.resolve(options.cwd, `${options.configName}${extensionSuffix}`,);
}

/**
 Mutable per-store runtime state shared by the store's closures.
 
 @example
 ```ts
 const state: StoreState<Record<string, unknown>> = { isInMigration: false, };
 ```
 */
type StoreState<T extends Record<string, unknown>> = {
  /**
   While true,
   reads and writes skip schema validation,
   as upstream `conf` does during migrations.
   */
  isInMigration: boolean;
  /**
   Memoized user store when `cache` is enabled.
   */
  cachedStore?: T;
  /**
   Running file watcher when `watch` is enabled.
   */
  watcher?: ConfigWatcher;
};

/**
 Marks the migration window so validation is bypassed while steps run and
 restored when the scope ends.
 
 @param state - Store state whose flag is managed.
 
 @returns Disposable resetting the flag at scope exit.
 
 @example
 ```ts
 {
   using _scope = createMigrationScope(state);
   applyMigrations({ host, migrations, projectVersion: '1.0.0', });
 }
 ```
 */
function createMigrationScope<T extends Record<string, unknown>>(state: StoreState<T>,): {
  readonly [Symbol.dispose]: () => void;
} {
  state.isInMigration = true;
  return {
    [Symbol.dispose]: function leaveMigrationScope(): void {
      state.isInMigration = false;
    },
  };
}

//endregion Helpers

//region Factory

/**
 Creates one config store bound to a config file.
 
 @param options - Store configuration;
 pass `cwd` or `projectName` to locate the file.
 
 @returns Frozen store object persisting to the resolved config file.
 
 @throws {InvalidEncryptionAlgorithmError} When `encryptionAlgorithm` names
 an unsupported algorithm.
 @throws {MissingProjectNameError} When neither `cwd` nor `projectName`
 resolves a config directory.
 @throws {MissingProjectVersionError} When `migrations` is set without
 `projectVersion`.
 
 @example
 ```ts
 const config = createConf({
   projectName: 'foo',
   defaults: { theme: 'light', },
 });
 ```
 */
export function createConf<T extends Record<string, unknown> = Record<string, unknown>>(options: Options<T> = {},): Conf<T> {
  /**
   Options with defaults filled and paths resolved.
   */
  const prepared = prepareOptions(options,);
  /**
   Schema validator carrying the schema's declared defaults.
   */
  const validator = createSchemaValidator(prepared,);
  /**
   Logger wrapped with this factory's name so store diagnostics name their
   origin.
   */
  const log: Logger = prepared.logger ?? tagged({
    tag: createConf.name,
  },);
  /**
   Mutable runtime state shared by the closures below.
   */
  const state: StoreState<T> = {
    isInMigration: false,
  };
  /**
   Absolute config file path.
   */
  const configPath = resolveConfigPath(prepared,);
  /**
   Validation hook honoring the migration bypass,
   mirroring upstream `conf`'s `#isInMigration` gate.
   */
  const validate = function validateParsedStore(data: unknown,): void {
    if (state.isInMigration)
      return;
    validator.validate(data,);
  };
  /**
   Read/write pipeline over the config file.
   */
  const storeFile = createStoreFile<T>({
    path: configPath,
    encryptionKey: prepared.encryptionKey,
    encryptionAlgorithm: prepared.encryptionAlgorithm,
    serialize: prepared.serialize ?? defaultSerialize,
    deserialize: prepared.deserialize ?? defaultDeserialize,
    clearInvalidConfig: prepared.clearInvalidConfig,
    configFileMode: prepared.configFileMode,
    validate,
    logger: log,
  },);
  /**
   Event target backing the change subscriptions.
   */
  const events = new EventTarget();
  /**
   Default values:
   schema defaults overwritten by `defaults`,
   exactly as upstream `conf` merges them.
   */
  const defaultValues: Record<string, unknown> = {
    ...validator.schemaDefaults,
    ...prepared.defaults,
  };

  /**
   Drops the memoized store so the next read hits the file.
   */
  function dropCache(): void {
    delete state.cachedStore;
  }

  /**
   Reads the user-visible store:
   file contents validated and stripped of reserved bookkeeping keys.
   */
  function readUserStore(): T {
    /**
     File contents including bookkeeping.
     */
    const store = storeFile.readStore();
    for (const key of Object.keys(store)) {
      if (isReservedKeyPath(key,))
        deleteStoreValue({
          store,
          key,
          accessPropertiesByDotNotation: false,
        },);
    }
    return store as T;
  }

  /**
   Reads the whole store,
   through the cache when caching is enabled.
   */
  function getStore(): T {
    if (!prepared.cache)
      return readUserStore();
    if (state.cachedStore === undefined)
      state.cachedStore = readUserStore();
    return state.cachedStore;
  }

  /**
   Writes raw store contents,
   dropping the cache first like upstream `conf`'s `_write`.
   */
  function writeStore(store: Record<string, unknown>,): void {
    dropCache();
    storeFile.writeStore(store,);
  }

  /**
   Merges the reserved bookkeeping key back into a replacement store,
   leaving the caller's object untouched.
   */
  function preserveInternalKey(value: Record<string, unknown>,): Record<string, unknown> {
    if (hasStoreValue({
      store: value,
      key: INTERNAL_KEY,
      accessPropertiesByDotNotation: true,
    },))
      return value;
    try {
      /**
       Current file contents carrying any bookkeeping to preserve.
       */
      const currentStore = storeFile.readParsedFile();
      if (!hasStoreValue({
        store: currentStore,
        key: INTERNAL_KEY,
        accessPropertiesByDotNotation: true,
      },))
        return value;
      /**
       Caller value copy carrying the preserved bookkeeping.
       */
      const merged = Object.assign(createPlainObject(), value,);
      setStoreValue({
        store: merged,
        key: INTERNAL_KEY,
        value: getStoreValue({
          store: currentStore,
          key: INTERNAL_KEY,
          accessPropertiesByDotNotation: true,
        },),
        accessPropertiesByDotNotation: true,
      },);
      return merged;
    }
    catch (error) {
      if (!isMissingFileError(error,))
        log.debug(`internal-data preservation skipped: ${caughtValueText(error,)}`,);
      return value;
    }
  }

  /**
   Replaces the whole store the way the `store` setter does:
   preserve bookkeeping,
   validate,
   persist,
   dispatch `change`.
   */
  function assignStore(value: Record<string, unknown>,): void {
    storeFile.ensureDirectory();
    /**
     Value actually persisted.
     */
    const valueToWrite = preserveInternalKey(value,);
    if (!state.isInMigration)
      validate(valueToWrite,);
    writeStore(valueToWrite,);
    events.dispatchEvent(new Event('change',),);
  }

  /**
   Initializes a non-migrating store:
   merge defaults,
   validate,
   and persist only when the merge changed something.
   */
  function initializeStore(): void {
    /**
     File contents before the defaults merge.
     */
    const fileStore = storeFile.readStore();
    /**
     File contents with defaults filled in for missing keys.
     */
    const storeWithDefaults = Object.assign(createPlainObject(), prepared.defaults ?? {}, fileStore,);
    validate(storeWithDefaults,);
    if (!isDeepStrictEqual(fileStore, storeWithDefaults,))
      assignStore(storeWithDefaults,);
  }

  /**
   CRUD methods bound to this store's context.
   */
  const crud: CrudApi = createCrud<T>({
    options: prepared,
    defaultValues,
    storeFile,
    getStore,
    assignStore,
  },);
  /**
   Change-subscription methods bound to this store's context.
   */
  const eventMethods: EventApi = createEventMethods<T>({
    events,
    getStore,
    readValue: function readValue(key: string,): unknown {
      return crud.get(key,);
    },
  },);

  /**
   The frozen store object handed to the caller.
   */
  const conf = {
    path: configPath,
    events,
    get size(): number {
      return Object.keys(getStore(),).length;
    },
    get store(): T {
      return getStore();
    },
    set store(value: T) {
      assignStore(value as Record<string, unknown>,);
    },
    get: crud.get,
    set: crud.set,
    has: crud.has,
    appendToArray: crud.appendToArray,
    reset: crud.reset,
    delete: crud.delete,
    clear: crud.clear,
    onDidChange: eventMethods.onDidChange,
    onDidAnyChange: eventMethods.onDidAnyChange,
    closeWatcher: function closeWatcher(): void {
      state.watcher?.close();
      delete state.watcher;
    },
    * [Symbol.iterator](): IterableIterator<[keyof T, T[keyof T]]> {
      for (const [key, value,] of Object.entries(getStore(),))
        yield [
          key as keyof T,
          value as T[keyof T],
        ];
    },
  } as unknown as Conf<T>;
  Object.freeze(conf,);

  if (prepared.migrations !== undefined) {
    {
      using _migrationScope = createMigrationScope(state,);
      applyMigrations<T>({
        host: {
          store: conf,
          configFileExists: storeFile.fileExists,
          readRawStore: storeFile.readStore,
          readUserStore: getStore,
          writeUserStore: function writeUserStore(store: T,): void {
            assignStore(store as Record<string, unknown>,);
          },
          writeStoreWithoutEvents: writeStore,
          recordVersion: function recordVersion(version: string,): void {
            /**
             File contents awaiting the recorded version.
             */
            const store = storeFile.readStore();
            setStoreValue({
              store,
              key: MIGRATION_KEY,
              value: version,
              accessPropertiesByDotNotation: true,
            },);
            assignStore(store,);
          },
        },
        migrations: prepared.migrations,
        projectVersion: prepared.projectVersion ?? '',
        defaults: prepared.defaults,
        beforeEachMigration: prepared.beforeEachMigration,
      },);
    }
    validate(getStore(),);
  }
  else {
    initializeStore();
  }

  if (prepared.watch) {
    storeFile.ensureDirectory();
    if (!storeFile.fileExists())
      writeStore(createPlainObject(),);
    state.watcher = createConfigWatcher({
      path: configPath,
      onChange: function onConfigFileChanged(): void {
        dropCache();
        events.dispatchEvent(new Event('change',),);
      },
      logger: log,
    },);
  }

  return conf;
}

//endregion Factory
