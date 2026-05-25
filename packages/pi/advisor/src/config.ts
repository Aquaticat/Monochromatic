/**
 * Advisor extension config loading and merging.
 *
 * @module
 */

import { readFileSync, } from 'node:fs';
import { join, } from 'node:path';
import * as v from 'valibot';
import {
  type AdvisorConfigFile,
  AdvisorConfigFileSchema,
} from './config-schemas.ts';
import {
  CONFIG_FILE_NAME,
  DEFAULT_MAX_ADVISOR_OUTPUT_TOKENS,
  DEFAULT_TIMEOUT_MS,
} from './constants.ts';
import type { AdvisorConfig, } from './types.ts';

//region Defaults

/** Default runtime config before user files are merged. */
export const DEFAULT_CONFIG: Omit<AdvisorConfig, 'source'> = {
  enabled: true,
  timeoutMs: DEFAULT_TIMEOUT_MS,
  maxAdvisorOutputTokens: DEFAULT_MAX_ADVISOR_OUTPUT_TOKENS,
  includePriorAdvisorResults: true,
};

//endregion Defaults

//region Public API

/** Options for loading Advisor config. */
export type LoadConfigOptions = {
  /** Current working directory used for project config lookup. */
  readonly cwd: string;
  /** Home directory override for tests. */
  readonly home?: string | undefined;
};

/**
 * Load and merge global and project Advisor config files.
 *
 * @param options - lookup directories for global and project config
 *
 * @returns merged runtime configuration
 *
 * @throws when a present config file is invalid JSON or fails schema validation
 *
 * @example
 * ```typescript
 * const config = loadMergedConfig({ cwd: process.cwd() });
 * ```
 */
export function loadMergedConfig(
  options: LoadConfigOptions,
): AdvisorConfig {
  /** Path metadata for both config scopes. */
  const paths = getConfigPaths(options,);
  /** Global config file contents, when present. */
  const global = loadConfigFile({
    path: paths.globalPath,
    label: 'global',
  },);
  /** Project config file contents, when present. */
  const project = loadConfigFile({
    path: paths.projectPath,
    label: 'project',
  },);
  /** Config values merged with project scalar overrides. */
  const merged = mergeConfigFiles({
    defaults: DEFAULT_CONFIG,
    configs: [
      global,
      project,
    ],
  },);

  return {
    ...merged,
    source: {
      globalPath: paths.globalPath,
      projectPath: paths.projectPath,
      globalLoaded: global !== undefined,
      projectLoaded: project !== undefined,
    },
  };
}

/**
 * Build absolute global and project config paths.
 *
 * @param options - lookup directories
 *
 * @returns config paths
 *
 * @example
 * ```typescript
 * getConfigPaths({ cwd: '/repo', home: '/home/me' });
 * ```
 */
export function getConfigPaths(
  options: LoadConfigOptions,
): {
  readonly globalPath: string;
  readonly projectPath: string;
} {
  /** Home directory used by pi for global agent config. */
  const home = options.home
    ?? process
    .env
    .HOME
    ?? '~';
  return {
    globalPath: join(
      home,
      '.pi',
      'agent',
      'extensions',
      CONFIG_FILE_NAME,
    ),
    projectPath: join(
      options.cwd,
      '.pi',
      'extensions',
      CONFIG_FILE_NAME,
    ),
  };
}

//endregion Public API

//region Internal loading

/**
 * Merge config file overrides without letting explicit undefined erase defaults.
 *
 * @param defaults - default runtime config
 *
 * @param configs - config files in merge order
 *
 * @returns merged runtime config without source metadata
 */
function mergeConfigFiles(
  {
    defaults,
    configs,
  }: {
    readonly defaults: Omit<AdvisorConfig, 'source'>;
    readonly configs: readonly (AdvisorConfigFile | undefined)[];
  },
): Omit<AdvisorConfig, 'source'> {
  return configs.reduce(
    function mergeConfig(
      accumulator: Omit<AdvisorConfig, 'source'>,
      config: AdvisorConfigFile | undefined,
    ) {
      if (config === undefined)
        return accumulator;
      /** Merged context cap, omitted when neither scope configures one. */
      const maxContextChars = config.maxContextChars
        ?? accumulator
        .maxContextChars;
      return {
        enabled: config.enabled
          ?? accumulator
          .enabled,
        timeoutMs: config.timeoutMs
          ?? accumulator
          .timeoutMs,
        maxAdvisorOutputTokens: config.maxAdvisorOutputTokens
          ?? accumulator
          .maxAdvisorOutputTokens,
        includePriorAdvisorResults: config.includePriorAdvisorResults
          ?? accumulator
          .includePriorAdvisorResults,
        ...(maxContextChars === undefined ? {} : { maxContextChars, }),
        ...(config.systemPrompt
          === undefined
          ? {}
          : { systemPrompt: config.systemPrompt, }),
      };
    },
    defaults,
  );
}

/**
 * Load one optional config file.
 *
 * @param path - config file path
 *
 * @param label - config scope label
 *
 * @returns parsed config file, or `undefined` when absent
 */
function loadConfigFile(
  {
    path,
    label,
  }: {
    readonly path: string;
    readonly label: string;
  },
): AdvisorConfigFile | undefined {
  /** Raw JSON data, or `undefined` when file is absent. */
  const raw = readJsonFile({
    path,
    label,
  },);
  if (raw === undefined)
    return undefined;
  return parseConfigFile({
    raw,
    path,
    label,
  },);
}

/**
 * Read and parse an optional JSON file.
 *
 * @param path - JSON file path
 *
 * @param label - config scope label
 *
 * @returns parsed JSON data, or `undefined` when absent
 */
function readJsonFile(
  {
    path,
    label,
  }: {
    readonly path: string;
    readonly label: string;
  },
): unknown {
  try {
    return JSON.parse(readFileSync(
      path,
      'utf8',
    ),);
  }
  catch (error) {
    /** Filesystem error code when available. */
    const code = errorCode(error,);
    if (code === 'ENOENT')
      return undefined;
    throw new Error(
      `advisor: failed to read ${label} config at ${path}: ${
        error instanceof Error ? error.message : String(error,)
      }`,
      { cause: error, },
    );
  }
}

/**
 * Validate parsed config data.
 *
 * @param raw - parsed JSON data
 *
 * @param path - config file path
 *
 * @param label - config scope label
 *
 * @returns validated config file
 */
function parseConfigFile(
  {
    raw,
    path,
    label,
  }: {
    readonly raw: unknown;
    readonly path: string;
    readonly label: string;
  },
): AdvisorConfigFile {
  /** Validation result from valibot. */
  const result = v.safeParse(
    AdvisorConfigFileSchema,
    raw,
  );
  if (result.success)
    return result.output;
  throw new Error(
    `advisor: invalid ${label} config at ${path}: ${JSON.stringify(result.issues,)}`,
  );
}

/**
 * Extract Node-style error code without unsafe assertion.
 *
 * @param error - caught error value
 *
 * @returns error code, when present
 */
function errorCode(
  error: unknown,
): string | undefined {
  if ((!(error instanceof Error)) || (!('code' in error)))
    return undefined;
  return (typeof error.code) === 'string' ? error.code : undefined;
}

//endregion Internal loading
