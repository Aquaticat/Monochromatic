/**
 * Global configuration loading for pi guardrail.
 *
 * @module
 */

import {
  readFile,
} from 'node:fs/promises';
import { homedir, } from 'node:os';
import {
  basename,
  join,
} from 'node:path';

import {
  DEFAULT_BLOCK_BUN_TEST,
  DEFAULT_PATH_RULES,
  FILE_NOT_FOUND_CODE,
  GUARDRAIL_CONFIG_FILE_NAME,
  PI_EXTENSION_CONFIG_DIR,
} from './constants.ts';
import type {
  GuardrailConfig,
  GuardrailObjectConfigFile,
  NormalizedConfigFile,
  PathRule,
} from './types.ts';

//region Types

/**
 * Options for loading global guardrail config.
 */
type LoadGuardrailConfigOptions = {
  /**
   * Home directory override for tests.
   */
  readonly home?: string;
  /**
   * Environment override for tests.
   */
  readonly env?: Readonly<Record<string, string | undefined>>;
  /**
   * Config reader dependency for tests.
   */
  readonly readConfigFile?: (path: string) => Promise<string>;
};

/**
 * Config file read result.
 */
type ConfigReadResult =
  | {
    /**
     * Whether config file existed.
     */
    readonly loaded: false;
  }
  | {
    /**
     * Whether config file existed.
     */
    readonly loaded: true;
    /**
     * Parsed JSON value.
     */
    readonly value: unknown;
  };

/**
 * Error shape with optional Node filesystem code.
 */
type ErrorWithCode = Error & {
  /**
   * Node filesystem error code.
   */
  readonly code?: string;
};

//endregion Types

//region Path helpers

/**
 * Resolves global guardrail config path for a home directory.
 *
 * @param home - home directory
 *
 * @returns absolute config path
 *
 * @example
 * ```typescript
 * configPathForHome({ home: '/home/user' });
 * ```
 */
function configPathForHome({ home, }: { readonly home: string; }): string {
  return join(
    home,
    PI_EXTENSION_CONFIG_DIR,
    GUARDRAIL_CONFIG_FILE_NAME,
  );
}

//endregion Path helpers

//region Public API

/**
 * Loads global pi guardrail config and merges built-in defaults.
 *
 * Config is optional. When present, it may be a direct map from gitignore-style
 * pattern to refusal message, matching the short user-facing shape, or an
 * advanced object with `pathRules` and `blockBunTest` fields.
 *
 * @param options - test overrides for home, env, and file reading
 *
 * @returns runtime guardrail config
 *
 * @example
 * ```typescript
 * const config = await loadGuardrailConfig();
 * ```
 */
async function loadGuardrailConfig(
  options: LoadGuardrailConfigOptions = {},
): Promise<GuardrailConfig> {
  /**
   * Environment read for HOME when `home` option is absent.
   */
  const env = options.env
    ?? process.env;
  /**
   * Home directory used for global config lookup.
   */
  const home = options.home
    ?? env.HOME
    ?? homedir();
  /**
   * Config path in the pi global extension config directory.
   */
  const configPath = configPathForHome({ home, },);
  /**
   * Optional JSON config read result.
   */
  const readResult = await readOptionalConfigJson({
    configPath,
    readConfigFile: options.readConfigFile ?? defaultReadConfigFile,
  },);
  /**
   * User config normalized to ordered path rules and optional scalar settings.
   */
  const normalized = readResult.loaded
    ? normalizeConfigFile({
      value: readResult.value,
      configPath,
    },)
    : {
      pathRules: [],
    } satisfies NormalizedConfigFile;

  return {
    pathRules: [
      ...DEFAULT_PATH_RULES,
      ...normalized.pathRules,
    ],
    blockBunTest: normalized.blockBunTest ?? DEFAULT_BLOCK_BUN_TEST,
    source: {
      path: configPath,
      loaded: readResult.loaded,
    },
  };
}

//endregion Public API

//region File parsing

/**
 * Default config file reader.
 *
 * @param path - absolute file path
 *
 * @returns UTF-8 file contents
 *
 * @example
 * ```typescript
 * await defaultReadConfigFile('/home/user/.pi/agent/extensions/pi-guardrail.json');
 * ```
 */
async function defaultReadConfigFile(path: string,): Promise<string> {
  return readFile(
    path,
    'utf8',
  );
}

/**
 * Reads optional JSON config from disk.
 *
 * @param configPath - absolute config path
 *
 * @param readConfigFile - file reader dependency
 *
 * @returns parsed config read result
 *
 * @example
 * ```typescript
 * await readOptionalConfigJson({ configPath: '/tmp/pi-guardrail.json', readConfigFile });
 * ```
 */
async function readOptionalConfigJson(
  {
    configPath,
    readConfigFile,
  }: {
    readonly configPath: string;
    readonly readConfigFile: (path: string) => Promise<string>;
  },
): Promise<ConfigReadResult> {
  try {
    /**
     * Raw config file contents.
     */
    const content = await readConfigFile(configPath,);
    return {
      loaded: true,
      value: parseConfigJson({
        content,
        configPath,
      },),
    };
  }
  catch (error: unknown) {
    if (isMissingFileError(error,))
      return { loaded: false, };
    throw error;
  }
}

/**
 * Parses config JSON with file-path context in errors.
 *
 * @param content - raw JSON text
 *
 * @param configPath - config file path used in diagnostics
 *
 * @returns parsed JSON value
 */
function parseConfigJson(
  {
    content,
    configPath,
  }: {
    readonly content: string;
    readonly configPath: string;
  },
): unknown {
  try {
    return JSON.parse(content,) as unknown;
  }
  catch (error: unknown) {
    /**
     * Human-readable parse error detail.
     */
    const detail = Error.isError(error,)
      ? error.message
      : String(error,);
    throw new Error(
      `${basename(configPath,)} parsing failed at ${configPath}: ${detail}`,
      { cause: error, },
    );
  }
}

//endregion File parsing

//region Shape normalization

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

  /**
   * Optional blockBunTest scalar.
   */
  const blockBunTestValue = value.blockBunTest;
  if ((blockBunTestValue !== undefined) && ((typeof blockBunTestValue) !== 'boolean')) {
    throw new Error(
      `${basename(configPath,)} field blockBunTest must be boolean when present`,
    );
  }

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
  } satisfies GuardrailObjectConfigFile & NormalizedConfigFile;
}

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

//endregion Shape normalization

//region Error helpers

/**
 * Returns whether error is a missing-file error.
 *
 * @param error - caught read error
 *
 * @returns whether error code is ENOENT
 */
function isMissingFileError(error: unknown,): boolean {
  return isErrorWithCode(error,)
    && (error.code === FILE_NOT_FOUND_CODE);
}

/**
 * Returns whether value is an Error with an optional code field.
 *
 * @param error - caught error
 *
 * @returns whether error shape can carry a Node code
 */
function isErrorWithCode(error: unknown,): error is ErrorWithCode {
  return Error.isError(error,)
    && ('code' in error);
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

//endregion Error helpers

export {
  configPathForHome,
  loadGuardrailConfig,
  normalizeConfigFile,
  parseConfigJson,
  readOptionalConfigJson,
};
export type { LoadGuardrailConfigOptions, };
