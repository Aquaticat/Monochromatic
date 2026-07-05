/**
 * Pi guardrail config shape normalization.
 *
 * @module
 */

import { basename, } from 'node:path';

import type {
  NormalizedConfigFile,
  PathRule,
} from './types.ts';

//region Public API

/**
 * Normalizes a parsed config file value.
 *
 * @param value - parsed JSON value
 *
 * @param configPath - config path used in diagnostics
 *
 * @returns normalized config file shape
 *
 * @throws when config shape is invalid
 *
 * @example
 * ```typescript
 * normalizeConfigFile({ value: { 'pnpm-lock.yaml': 'run pnpm install' }, configPath });
 * ```
 */
function normalizeConfigFile(
  {
    value,
    configPath,
  }: {
    readonly value: unknown;
    readonly configPath: string;
  },
): NormalizedConfigFile {
  if (!isRecord(value,)) {
    throw new Error(
      `${basename(configPath,)} must contain a JSON object: ${configPath}`,
    );
  }

  if (isAdvancedConfigObject(value,)) {
    return normalizeAdvancedConfig({
      value,
      configPath,
    },);
  }

  return {
    pathRules: recordToPathRules({
      value,
      configPath,
      fieldName: 'top-level config object',
    },),
  };
}

//endregion Public API

//region Advanced config

/**
 * Detects advanced config shape by reserved top-level keys.
 *
 * @param value - object config value
 *
 * @returns whether value uses advanced shape
 *
 * @example
 * ```typescript
 * isAdvancedConfigObject({ blockBunTest: false }); // true
 * ```
 */
function isAdvancedConfigObject(value: Readonly<Record<string, unknown>>,): boolean {
  return Object.hasOwn(
    value,
    'pathRules',
  )
    || Object.hasOwn(
      value,
      'blockBunTest',
    );
}

/**
 * Normalizes advanced config shape.
 *
 * @param value - advanced config object
 *
 * @param configPath - config path used in diagnostics
 *
 * @returns normalized config
 */
function normalizeAdvancedConfig(
  {
    value,
    configPath,
  }: {
    readonly value: Readonly<Record<string, unknown>>;
    readonly configPath: string;
  },
): NormalizedConfigFile {
  assertOnlyAdvancedKeys({
    value,
    configPath,
  },);

  /**
   * Optional blockBunTest scalar.
   */
  const blockBunTestValue = value.blockBunTest;
  assertOptionalBoolean({
    value: blockBunTestValue,
    configPath,
    fieldName: 'blockBunTest',
  },);

  /**
   * Optional advanced path rule map.
   */
  const rawPathRules = value.pathRules;
  if ((rawPathRules !== undefined) && (!isRecord(rawPathRules,))) {
    throw new Error(
      `${basename(configPath,)} field pathRules must be an object mapping patterns to messages`,
    );
  }

  /**
   * Normalized path rule list.
   */
  const pathRules = rawPathRules === undefined
    ? []
    : recordToPathRules({
      value: rawPathRules,
      configPath,
      fieldName: 'pathRules',
    },);

  return {
    pathRules,
    ...(blockBunTestValue === undefined ? {} : { blockBunTest: blockBunTestValue, }),
  };
}

/**
 * Throws when advanced config contains unknown top-level keys.
 *
 * @param value - advanced config object
 *
 * @param configPath - config path used in diagnostics
 */
function assertOnlyAdvancedKeys(
  {
    value,
    configPath,
  }: {
    readonly value: Readonly<Record<string, unknown>>;
    readonly configPath: string;
  },
): void {
  /**
   * Allowed advanced config keys.
   */
  const allowedKeys = new Set([
    'pathRules',
    'blockBunTest',
  ],);
  /**
   * Unknown advanced config keys.
   */
  const unknownKeys = Object
    .keys(value,)
    .filter(function isUnknownKey(key,): boolean {
      return !allowedKeys.has(key,);
    },);
  if (unknownKeys.length > 0) {
    throw new Error(
      `${basename(configPath,)} has unknown advanced config keys: ${unknownKeys.join(', ',)}`,
    );
  }
}

/**
 * Throws when optional field is present and not boolean.
 *
 * @param value - field value
 *
 * @param configPath - config path used in diagnostics
 *
 * @param fieldName - field name used in diagnostics
 */
function assertOptionalBoolean(
  {
    value,
    configPath,
    fieldName,
  }: {
    readonly value: unknown;
    readonly configPath: string;
    readonly fieldName: string;
  },
): asserts value is boolean | undefined {
  if ((value !== undefined) && ((typeof value) !== 'boolean')) {
    throw new Error(
      `${basename(configPath,)} field ${fieldName} must be boolean when present`,
    );
  }
}

//endregion Advanced config

//region Path rule normalization

/**
 * Converts an object mapping gitignore patterns to messages into ordered rules.
 *
 * @param value - record to normalize
 *
 * @param configPath - config path used in diagnostics
 *
 * @param fieldName - human-readable field name used in errors
 *
 * @returns path rules preserving JSON insertion order
 */
function recordToPathRules(
  {
    value,
    configPath,
    fieldName,
  }: {
    readonly value: Readonly<Record<string, unknown>>;
    readonly configPath: string;
    readonly fieldName: string;
  },
): readonly PathRule[] {
  return Object
    .entries(value,)
    .map(function toPathRule(entry,): PathRule {
      /**
       * Pattern and refusal message entry from config.
       */
      const [pattern, message,] = entry;
      if (pattern.length === 0) {
        throw new Error(
          `${basename(configPath,)} ${fieldName} contains an empty pattern`,
        );
      }
      if ((typeof message) !== 'string') {
        throw new Error(
          `${basename(configPath,)} ${fieldName} value for ${pattern} must be a string message`,
        );
      }
      return {
        pattern,
        message,
      };
    },);
}

/**
 * Returns whether value is a non-array object record.
 *
 * @param value - value to inspect
 *
 * @returns whether value can be treated as a JSON object record
 */
function isRecord(value: unknown,): value is Readonly<Record<string, unknown>> {
  return (value !== null)
    && ((typeof value) === 'object')
    && (!Array.isArray(value,));
}

//endregion Path rule normalization

export {
  isAdvancedConfigObject,
  normalizeAdvancedConfig,
  normalizeConfigFile,
  recordToPathRules,
};
