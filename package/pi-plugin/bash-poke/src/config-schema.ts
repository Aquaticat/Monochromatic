/**
 Bash-poke settings validation and defaults.

 @module
 */

import { BashPokeConfigError, } from './config-error.ts';
import type { BashPokeSettings, } from './config-types.ts';
import {
  DEFAULT_KILL_GRACE_MS,
  DEFAULT_POKE_HEAD_CHARS,
  DEFAULT_POKE_INSTRUCTION,
  DEFAULT_POKE_TAIL_CHARS,
  DEFAULT_PROGRESS_REFRESH_MS,
  DEFAULT_PROGRESS_TAIL_LINES,
  DEFAULT_PROGRESS_WIDGET,
} from './constants.ts';

//region Key inventory

/**
 Settings keys this package honors, which is also the rejection boundary.
 */
const SETTING_KEYS = [
  'pokeInstruction',
  'pokeHeadChars',
  'pokeTailChars',
  'progressWidget',
  'progressTailLines',
  'progressRefreshMs',
  'killGraceMs',
] as const;

/**
 One settings key name.
 */
type SettingKey = (typeof SETTING_KEYS)[number];

/**
 Decoded settings object, read-only because validation never writes back.
 */
type SettingsRecord = Readonly<Record<string, unknown>>;

/**
 Key lookup used to reject settings this package cannot honor, because a
 silently ignored key leaves the user believing a knob works.
 */
const SETTING_KEY_SET: ReadonlySet<string> = new Set<string>(SETTING_KEYS, );

/**
 Settings applied when no file exists, and per-key fallbacks when a key is absent.
 */
const DEFAULT_SETTINGS: BashPokeSettings = {
  pokeInstruction: DEFAULT_POKE_INSTRUCTION,
  pokeHeadChars: DEFAULT_POKE_HEAD_CHARS,
  pokeTailChars: DEFAULT_POKE_TAIL_CHARS,
  progressWidget: DEFAULT_PROGRESS_WIDGET,
  progressTailLines: DEFAULT_PROGRESS_TAIL_LINES,
  progressRefreshMs: DEFAULT_PROGRESS_REFRESH_MS,
  killGraceMs: DEFAULT_KILL_GRACE_MS,
};

//endregion Key inventory

//region Readers

/**
 Inputs shared by every per-kind settings reader.
 */
type SettingReadInput<TFallback> = {
  /**
   Decoded settings object.
   */
  readonly record: SettingsRecord;

  /**
   Key being read.
   */
  readonly key: SettingKey;

  /**
   Value used when the key is absent.
   */
  readonly fallback: TFallback;

  /**
   Path named in diagnostics so the user knows which file to edit.
   */
  readonly fileName: string;
};

/**
 Narrows decoded JSON to an object readable key by key.
 
 Positional because a type predicate cannot name a binding pattern element.
 
 @param value - decoded JSON
 
 @returns whether key-wise reading is possible
 
 @example
 ```ts
 isSettingsRecord({ pokeHeadChars: 10, });
 ```
 */
function isSettingsRecord(value: unknown, ): value is SettingsRecord {
  return ((typeof value) === 'object')
    && (value !== null)
    && (!Array.isArray(value, ));
}

/**
 Reads one string setting, applying its default when absent.
 
 @param record - decoded settings object
 
 @param key - string-valued key
 
 @param fallback - default for an absent key
 
 @param fileName - path named in diagnostics
 
 @returns configured or default string
 
 @throws BashPokeConfigError when the present value is not a string
 
 @example
 ```ts
 readStringSetting({ record: {}, key: 'pokeInstruction', fallback: 'continue', fileName: 'pi-bash-poke.json', },);
 ```
 */
function readStringSetting(
  {
    record,
    key,
    fallback,
    fileName,
  }: SettingReadInput<string>,
): string {
  /**
   Raw value stored under the key, absent when the user omitted it.
   */
  const present: unknown = record[key];
  if (present === undefined)
    return fallback;
  if ((typeof present) !== 'string')
    throw new BashPokeConfigError(`${fileName}: ${key} must be a string`, );
  return present;
}

/**
 Reads one whole-number setting, applying its default when absent.
 
 @param record - decoded settings object
 
 @param key - number-valued key
 
 @param fallback - default for an absent key
 
 @param fileName - path named in diagnostics
 
 @returns configured or default count
 
 @throws BashPokeConfigError when the value is not a whole number of zero or more
 
 @example
 ```ts
 readNumberSetting({ record: { pokeTailChars: 100, }, key: 'pokeTailChars', fallback: 6000, fileName: 'pi-bash-poke.json', },);
 ```
 */
function readNumberSetting(
  {
    record,
    key,
    fallback,
    fileName,
  }: SettingReadInput<number>,
): number {
  /**
   Raw value stored under the key, absent when the user omitted it.
   */
  const present: unknown = record[key];
  if (present === undefined)
    return fallback;
  if ((typeof present) !== 'number')
    throw new BashPokeConfigError(`${fileName}: ${key} must be a number`, );
  if (!Number.isInteger(present, ))
    throw new BashPokeConfigError(`${fileName}: ${key} must be a whole number`, );
  if (present < 0)
    throw new BashPokeConfigError(`${fileName}: ${key} must not be negative`, );
  return present;
}

/**
 Reads one boolean setting, applying its default when absent.
 
 @param record - decoded settings object
 
 @param key - boolean-valued key
 
 @param fallback - default for an absent key
 
 @param fileName - path named in diagnostics
 
 @returns configured or default flag
 
 @throws BashPokeConfigError when the present value is not a boolean
 
 @example
 ```ts
 readBooleanSetting({ record: { progressWidget: false, }, key: 'progressWidget', fallback: true, fileName: 'pi-bash-poke.json', },);
 ```
 */
function readBooleanSetting(
  {
    record,
    key,
    fallback,
    fileName,
  }: SettingReadInput<boolean>,
): boolean {
  /**
   Raw value stored under the key, absent when the user omitted it.
   */
  const present: unknown = record[key];
  if (present === undefined)
    return fallback;
  if ((typeof present) !== 'boolean')
    throw new BashPokeConfigError(`${fileName}: ${key} must be a boolean`, );
  return present;
}

//endregion Readers

//region Parsing

/**
 Validates decoded settings JSON into a complete settings record.
 
 @param decoded - value produced by parsing the settings file
 
 @param fileName - path named in diagnostics
 
 @returns settings with every key resolved
 
 @throws BashPokeConfigError when the shape is wrong, a key is unknown, or a value has the wrong kind
 
 @example
 ```ts
 parseSettings({ decoded: { pokeTailChars: 400, }, fileName: 'pi-bash-poke.json', },);
 ```
 */
function parseSettings(
  {
    decoded,
    fileName,
  }: {
    readonly decoded: unknown;
    readonly fileName: string;
  },
): BashPokeSettings {
  if (!isSettingsRecord(decoded, ))
    throw new BashPokeConfigError(`${fileName}: settings must be a JSON object`, );

  /**
   Keys the file carries that this package would silently ignore.
   */
  const unknownKeys: string[] = Object.keys(decoded, )
    .filter(function isUnknownKey(key: string, ): boolean {
      return !SETTING_KEY_SET.has(key, );
    }, );
  if (unknownKeys.length > 0)
    throw new BashPokeConfigError(
      `${fileName}: unknown settings ${unknownKeys.join(', ', )}`,
    );

  return {
    pokeInstruction: readStringSetting({
      record: decoded,
      key: 'pokeInstruction',
      fallback: DEFAULT_SETTINGS.pokeInstruction,
      fileName,
    }, ),
    pokeHeadChars: readNumberSetting({
      record: decoded,
      key: 'pokeHeadChars',
      fallback: DEFAULT_SETTINGS.pokeHeadChars,
      fileName,
    }, ),
    pokeTailChars: readNumberSetting({
      record: decoded,
      key: 'pokeTailChars',
      fallback: DEFAULT_SETTINGS.pokeTailChars,
      fileName,
    }, ),
    progressWidget: readBooleanSetting({
      record: decoded,
      key: 'progressWidget',
      fallback: DEFAULT_SETTINGS.progressWidget,
      fileName,
    }, ),
    progressTailLines: readNumberSetting({
      record: decoded,
      key: 'progressTailLines',
      fallback: DEFAULT_SETTINGS.progressTailLines,
      fileName,
    }, ),
    progressRefreshMs: readNumberSetting({
      record: decoded,
      key: 'progressRefreshMs',
      fallback: DEFAULT_SETTINGS.progressRefreshMs,
      fileName,
    }, ),
    killGraceMs: readNumberSetting({
      record: decoded,
      key: 'killGraceMs',
      fallback: DEFAULT_SETTINGS.killGraceMs,
      fileName,
    }, ),
  };
}

//endregion Parsing

export {
  DEFAULT_SETTINGS,
  parseSettings,
  readBooleanSetting,
  readNumberSetting,
  readStringSetting,
  SETTING_KEYS,
  SETTING_KEY_SET,
};

export type {
  SettingKey,
  SettingsRecord,
};
