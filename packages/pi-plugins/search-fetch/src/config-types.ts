/**
 * Pi Search Fetch config types.
 *
 * @module
 */

/**
 * Loaded Pi Search Fetch config.
 */
type LinkupConfig = {
  /**
   * Optional Exa API key after environment and file precedence are applied.
   */
  readonly exaApiKey?: string;
  /**
   * Optional Linkup API key after environment and file precedence are applied.
   */
  readonly linkupApiKey?: string;
  /**
   * Normalized global host suffix blocklist.
   */
  readonly blocklist: readonly string[];
  /**
   * Source metadata useful for diagnostics.
   */
  readonly source: LinkupConfigSource;
};

/**
 * Pi Search Fetch config source metadata.
 */
type LinkupConfigSource = {
  /**
   * Absolute config file path checked by the loader.
   */
  readonly path: string;
  /**
   * Whether config file existed and loaded successfully.
   */
  readonly loaded: boolean;
  /**
   * Legacy config path migrated into this source, when migration happened.
   */
  readonly migratedFrom?: string;
};

/**
 * Options for loading Pi Search Fetch config.
 */
type LoadLinkupConfigOptions = {
  /**
   * Home directory used to resolve global Pi config.
   */
  readonly home?: string;
  /**
   * Environment used for API key precedence.
   */
  readonly env?: Readonly<NodeJS.ProcessEnv>;
};

/**
 * Parsed config-file shape after schema validation.
 */
type ConfigFileShape = {
  /**
   * Optional Exa API key from config file.
   */
  readonly exaApiKey?: string;
  /**
   * Optional Linkup API key from config file.
   */
  readonly linkupApiKey?: string;
  /**
   * Optional raw host suffix blocklist.
   */
  readonly blocklist?: readonly string[];
};

/**
 * Parsed legacy config-file shape after schema validation.
 */
type LegacyConfigFileShape = {
  /**
   * Optional legacy Linkup API key from config file.
   */
  readonly apiKey?: string;
  /**
   * Optional raw host suffix blocklist.
   */
  readonly blocklist?: readonly string[];
};

/**
 * Optional parsed config JSON result.
 */
type ConfigJsonReadResult = {
  /**
   * Whether config file loaded.
   */
  readonly loaded: false;
} | {
  /**
   * Whether config file loaded.
   */
  readonly loaded: true;
  /**
   * Parsed JSON value.
   */
  readonly value: unknown;
};

/**
 * API key resolution result.
 */
type ApiKeyResolution = {
  /**
   * Whether an API key was configured.
   */
  readonly configured: false;
} | {
  /**
   * Whether an API key was configured.
   */
  readonly configured: true;
  /**
   * Effective API key.
   */
  readonly value: string;
};

/**
 * Legacy migration result.
 */
type LegacyMigrationResult = {
  /**
   * Whether legacy config migrated.
   */
  readonly migrated: false;
} | {
  /**
   * Whether legacy config migrated.
   */
  readonly migrated: true;
  /**
   * Migrated new config shape.
   */
  readonly value: ConfigFileShape;
  /**
   * Legacy config path consumed by migration.
   */
  readonly legacyPath: string;
};

/**
 * Error object with a Node system code.
 */
type ErrorWithCode = Error & {
  /**
   * Node system code.
   */
  readonly code: unknown;
};

export type {
  ApiKeyResolution,
  ConfigFileShape,
  ConfigJsonReadResult,
  ErrorWithCode,
  LegacyConfigFileShape,
  LegacyMigrationResult,
  LinkupConfig,
  LinkupConfigSource,
  LoadLinkupConfigOptions,
};
