/**
 * Reads pi settings needed to reconstruct Advisor model scope.
 *
 * @module
 */

import { readFileSync, } from 'node:fs';
import { join, } from 'node:path';
import * as v from 'valibot';
import {
  type AdvisorSettingsFile,
  AdvisorSettingsFileSchema,
} from './config-schemas.ts';

//region Types

/** Options for reading pi settings files. */
export type LoadSettingsScopeOptions = {
  /** Current working directory for project settings lookup. */
  readonly cwd: string;
  /** Home directory override for tests. */
  readonly home?: string | undefined;
};

/** Reconstructed enabled-model patterns from pi settings. */
export type SettingsScopePatterns = {
  /** Effective enabled-model patterns, or `undefined` when unrestricted. */
  readonly patterns?: readonly string[] | undefined;
  /** Settings file path that supplied the effective patterns. */
  readonly sourcePath?: string | undefined;
};

//endregion Types

//region Public API

/**
 * Load effective `enabledModels` from global and project pi settings.
 *
 * Project settings override global settings when the `enabledModels` field is present.
 *
 * @param options - lookup directories
 *
 * @returns effective patterns and source path
 *
 * @example
 * ```typescript
 * const scope = loadSettingsScopePatterns({ cwd: process.cwd() });
 * ```
 */
export function loadSettingsScopePatterns(
  options: LoadSettingsScopeOptions,
): SettingsScopePatterns {
  /** Paths checked for pi settings. */
  const paths = getSettingsPaths(options,);
  /** Global settings subset. */
  const global = loadSettingsFile({
    path: paths.globalPath,
    label: 'global',
  },);
  /** Project settings subset. */
  const project = loadSettingsFile({
    path: paths.projectPath,
    label: 'project',
  },);

  if (project?.enabledModels !== undefined) {
    return {
      patterns: cleanPatterns(project.enabledModels,),
      sourcePath: paths.projectPath,
    };
  }

  if (global?.enabledModels !== undefined) {
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
  /** Home directory used by pi for global settings. */
  const home = options.home ?? process.env.HOME ?? '~';
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
 * @returns parsed settings subset, or `undefined` when absent
 */
function loadSettingsFile(
  {
    path,
    label,
  }: {
    readonly path: string;
    readonly label: string;
  },
): AdvisorSettingsFile | undefined {
  /** Raw parsed JSON object, or `undefined` when absent. */
  const raw = readJsonFile({
    path,
    label,
  },);
  if (raw === undefined)
    return undefined;

  /** Valibot validation result for the settings subset. */
  const result = v.safeParse(
    AdvisorSettingsFileSchema,
    raw,
  );
  if (result.success)
    return result.output;
  throw new Error(
    `advisor: invalid ${label} settings at ${path}: ${JSON.stringify(result.issues,)}`,
  );
}

/**
 * Read one JSON settings file.
 *
 * @param path - settings file path
 *
 * @param label - settings scope label
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
      `advisor: failed to read ${label} settings at ${path}: ${
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

//endregion Internal helpers
