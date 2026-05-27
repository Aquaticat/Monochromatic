/**
 * Reads pi settings needed to reconstruct effective model scope.
 *
 * @module
 */

import { readFileSync, } from 'node:fs';
import { join, } from 'node:path';
import * as v from 'valibot';
import {
  ABSENT,
  type Maybe,
} from './maybe.ts';

//region Types and schemas

/** Pi settings subset needed for model-scope reconstruction. */
export type PiSettingsFile = {
  /** Pi model-cycle patterns. */
  readonly enabledModels?: readonly string[];
};

/** Options for reading pi settings files. */
export type LoadSettingsScopeOptions = {
  /** Current working directory for project settings lookup. */
  readonly cwd: string;
  /** Home directory override for tests. */
  readonly home?: string;
  /** Error prefix used by the consuming extension. */
  readonly errorPrefix?: string;
};

/** Reconstructed enabled-model patterns from pi settings. */
export type SettingsScopePatterns = {
  /** Effective enabled-model patterns, omitted when unrestricted. */
  readonly patterns?: readonly string[];
  /** Settings file path that supplied effective patterns. */
  readonly sourcePath?: string;
};

/** Pi settings subset schema. */
export const PiSettingsFileSchema: v.GenericSchema<PiSettingsFile> = v.object({
  enabledModels: v.exactOptional(
    v.array(v.string(),),
  ),
},);

//endregion Types and schemas

//region Public API

/**
 * Load effective `enabledModels` from global and project pi settings.
 *
 * Project settings override global settings when `enabledModels` is present.
 *
 * @param options - lookup directories and optional error prefix
 *
 * @returns effective patterns and source path
 *
 * @example
 * ```typescript
 * loadSettingsScopePatterns({ cwd: process.cwd() });
 * ```
 */
export function loadSettingsScopePatterns(
  options: LoadSettingsScopeOptions,
): SettingsScopePatterns {
  /** Paths checked for pi settings. */
  const paths = getSettingsPaths(options,);
  /** Error prefix for thrown messages. */
  const errorPrefix = options.errorPrefix
    ?? 'model selection';
  /** Global settings subset. */
  const global = loadSettingsFile({
    path: paths.globalPath,
    label: 'global',
    errorPrefix,
  },);
  /** Project settings subset. */
  const project = loadSettingsFile({
    path: paths.projectPath,
    label: 'project',
    errorPrefix,
  },);

  if ((project !== ABSENT) && (project.enabledModels
    !== undefined)) {
    return {
      patterns: cleanPatterns(project.enabledModels,),
      sourcePath: paths.projectPath,
    };
  }

  if ((global !== ABSENT) && (global.enabledModels
    !== undefined)) {
    return {
      patterns: cleanPatterns(global.enabledModels,),
      sourcePath: paths.globalPath,
    };
  }

  return {};
}

/**
 * Build absolute global and project pi settings paths.
 *
 * @param options - lookup directories
 *
 * @returns settings paths
 *
 * @example
 * ```typescript
 * getSettingsPaths({ cwd: '/repo', home: '/home/me' });
 * ```
 */
export function getSettingsPaths(
  options: LoadSettingsScopeOptions,
): {
  readonly globalPath: string;
  readonly projectPath: string;
} {
  /** Process environment variables. */
  const { env, } = process;
  /** HOME environment variable value, when present. */
  const { HOME: envHome, } = env;
  /** Home directory used by pi for global settings. */
  const home = options.home
    ?? envHome
    ?? '~';
  return {
    globalPath: join(
      home,
      '.pi',
      'agent',
      'settings.json',
    ),
    projectPath: join(
      options.cwd,
      '.pi',
      'settings.json',
    ),
  };
}

//endregion Public API

//region Internal helpers

/**
 * Load one optional pi settings file.
 *
 * @param path - settings file path
 *
 * @param label - settings scope label
 *
 * @param errorPrefix - message prefix
 *
 * @returns parsed settings subset, or {@link ABSENT} when absent
 */
function loadSettingsFile(
  {
    path,
    label,
    errorPrefix,
  }: {
    readonly path: string;
    readonly label: string;
    readonly errorPrefix: string;
  },
): Maybe<PiSettingsFile> {
  /** Raw parsed JSON object, or `undefined` when absent. */
  const raw = readJsonFile({
    path,
    label,
    errorPrefix,
  },);
  if (raw === undefined)
    return ABSENT;

  /** Valibot validation result for settings subset. */
  const result = v.safeParse(
    PiSettingsFileSchema,
    raw,
  );
  if (result.success)
    return result.output;
  throw new Error(
    `${errorPrefix}: invalid ${label} settings at ${path}: ${JSON.stringify(result.issues,)}`,
  );
}

/**
 * Read one JSON settings file.
 *
 * @param path - settings file path
 *
 * @param label - settings scope label
 *
 * @param errorPrefix - message prefix
 *
 * @returns parsed JSON data, or `undefined` when absent
 */
function readJsonFile(
  {
    path,
    label,
    errorPrefix,
  }: {
    readonly path: string;
    readonly label: string;
    readonly errorPrefix: string;
  },
): unknown {
  try {
    return JSON.parse(readFileSync(
      path,
      'utf8',
    ),);
  }
  catch (error) {
    if (isFileMissingError(error,))
      return undefined;
    throw new Error(
      `${errorPrefix}: failed to read ${label} settings at ${path}: ${
        error instanceof Error ? error.message : String(error,)
      }`,
      { cause: error, },
    );
  }
}

/**
 * Remove empty pattern strings.
 *
 * @param patterns - raw model patterns
 *
 * @returns cleaned model patterns
 */
function cleanPatterns(
  patterns: readonly string[],
): string[] {
  return patterns
    .map(function trimPattern(pattern,) {
      return pattern.trim();
    },)
    .filter(function keepPattern(pattern,) {
      return pattern !== '';
    },);
}

/**
 * Detect Node ENOENT missing-file errors without unsafe assertion.
 *
 * @param error - caught error value
 *
 * @returns whether error reports a missing settings file
 */
function isFileMissingError(
  error: unknown,
): boolean {
  if ((!(error instanceof Error)) || (!('code' in error)))
    return false;
  return error.code === 'ENOENT';
}

//endregion Internal helpers
