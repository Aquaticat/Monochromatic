/**
 * Helpers that keep pi's persisted scalar thinking default at the non-GPT fallback.
 *
 * @module
 */

import { getAgentDir, } from '@earendil-works/pi-coding-agent';
import {
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { join, } from 'node:path';
import type { ThinkingDefaultLevel, } from './model-policy.ts';

//region Constants

/** Persisted scalar default kept for non-GPT startup paths. */
export const PERSISTED_DEFAULT_THINKING_LEVEL: ThinkingDefaultLevel = 'high';

/** Global pi settings file name. */
const SETTINGS_FILE_NAME = 'settings.json';

//endregion Constants

//region Types

/** JSON object shape used after parsing settings. */
type JsonRecord = Record<string, unknown>;

/** Dependencies for reading and writing global pi settings. */
type RestoreGlobalDefaultOptions = {
  /** Desired persisted scalar default. */
  defaultLevel?: ThinkingDefaultLevel;
  /** Settings path to read and write. */
  settingsPath?: string;
  /** Reads a settings file as UTF-8 text. */
  readSettingsFile?: (path: string,) => string;
  /** Writes UTF-8 settings text. */
  writeSettingsFile?: (
    path: string,
    content: string,
  ) => void;
};

//endregion Types

//region Predicates

/**
 * Detects JSON object values suitable for settings mutation.
 *
 * @param value - parsed JSON value
 *
 * @returns whether value is an object record
 *
 * @example
 * ```typescript
 * isJsonRecord({ defaultThinkingLevel: 'xhigh' }); // true
 * ```
 */
function isJsonRecord(value: unknown,): value is JsonRecord {
  if (value === null)
    return false;
  /** Whether parsed value has object runtime type. */
  const isObject = (typeof value) === 'object';
  if (!isObject)
    return false;
  return !Array.isArray(value,);
}

//endregion Predicates

//region Settings mutation

/**
 * Returns the global pi settings path.
 *
 * @returns absolute path to global pi settings
 *
 * @example
 * ```typescript
 * getGlobalSettingsPath(); // '/home/user/.pi/agent/settings.json'
 * ```
 */
export function getGlobalSettingsPath(): string {
  return join(
    getAgentDir(),
    SETTINGS_FILE_NAME,
  );
}

/**
 * Restores the persisted global `defaultThinkingLevel` to `high`.
 *
 * Pi's public `setThinkingLevel()` API immediately persists the selected level
 * to global settings. This extension uses that API to change the active session
 * level, then rewrites the scalar default back to the non-GPT fallback so the
 * next startup still begins from `high` unless a GPT model is selected.
 *
 * @param defaultLevel - scalar default to persist
 *
 * @param settingsPath - settings file path
 *
 * @param readSettingsFile - file reader dependency for tests
 *
 * @param writeSettingsFile - file writer dependency for tests
 *
 * @returns whether settings were rewritten
 *
 * @throws when settings JSON is not an object
 *
 * @example
 * ```typescript
 * restoreGlobalDefaultThinkingLevel();
 * ```
 */
export function restoreGlobalDefaultThinkingLevel(
  {
    defaultLevel = PERSISTED_DEFAULT_THINKING_LEVEL,
    settingsPath = getGlobalSettingsPath(),
    readSettingsFile = function readSettings(path: string,): string {
      return readFileSync(
        path,
        'utf8',
      );
    },
    writeSettingsFile = function writeSettings(
      path: string,
      content: string,
    ): void {
      writeFileSync(
        path,
        content,
        'utf8',
      );
    },
  }: RestoreGlobalDefaultOptions = {},
): boolean {
  /** Raw JSON settings text. */
  const rawSettings = readSettingsFile(settingsPath,);
  /** Parsed settings value before object validation. */
  const parsedSettings: unknown = JSON.parse(rawSettings,);
  if (!isJsonRecord(parsedSettings,))
    throw new Error('Global pi settings JSON must be an object.',);

  if (parsedSettings.defaultThinkingLevel === defaultLevel)
    return false;

  parsedSettings.defaultThinkingLevel = defaultLevel;
  /** Pretty-printed settings JSON written back to disk. */
  const nextSettings = `${
    JSON.stringify(
      parsedSettings,
      null,
      2,
    )
  }\n`;
  writeSettingsFile(
    settingsPath,
    nextSettings,
  );
  return true;
}

//endregion Settings mutation
