/**
 * Claude effort-level indicator formatting.
 *
 * @module
 */

import { readFile, } from 'node:fs/promises';

//region Constants

/**
 * Effort level symbols matching Claude Code's built-in indicators.
 */
const EFFORT_SYMBOLS: Record<string, string> = {
  low: '\u25CB',
  medium: '\u25D0',
  max: '\u25C9',
};

/**
 * Default effort level, rendered as an empty indicator.
 */
const DEFAULT_EFFORT_LEVEL = 'high';

//endregion Constants

//region Settings parser

/**
 * Reads string property from a parsed settings value.
 *
 * @param value - parsed JSON settings value
 *
 * @param key - property key to read
 *
 * @returns property string, or empty string when missing
 *
 * @example
 * ```ts
 * readStringProperty({ value: { effortLevel: 'low' }, key: 'effortLevel' });
 * ```
 */
function readStringProperty({
  value,
  key,
}: Readonly<{
  value: unknown;
  key: string;
}>,): string {
  /**
   * Whether parsed settings can have string properties.
   */
  const isReadableObject = ((typeof value) === 'object')
    && (value !== null)
    && (!Array.isArray(value,));
  if (!isReadableObject)
    return '';

  /**
   * Property value read through reflection so parsed JSON can remain unknown.
   */
  const property: unknown = Reflect.get(
    value,
    key,
  );
  return (typeof property) === 'string'
    ? property
    : '';
}

/**
 * Reads `effortLevel` from settings JSON text.
 *
 * @param raw - raw settings JSON text
 *
 * @returns effort level string, or default level when unreadable
 *
 * @example
 * ```ts
 * effortLevelFromSettings('{"effortLevel":"low"}');
 * ```
 */
function effortLevelFromSettings(raw: string,): string {
  try {
    /**
     * Parsed settings JSON value.
     */
    const parsed: unknown = JSON.parse(raw,);
    /**
     * Optional effort level property.
     */
    const level = readStringProperty({
      value: parsed,
      key: 'effortLevel',
    },);
    return level.length > 0 ? level : DEFAULT_EFFORT_LEVEL;
  }
  catch (_error: unknown) {
    return DEFAULT_EFFORT_LEVEL;
  }
}

//endregion Settings parser

//region Public reader

/**
 * Reads `effortLevel` from `~/.claude/settings.json`.
 *
 * @returns effort indicator symbol, or empty string for high/default/unreadable settings
 *
 * @example
 * ```ts
 * await readEffortIndicator();
 * ```
 */
async function readEffortIndicator(): Promise<string> {
  try {
    /**
     * User home directory; empty path simply fails to resolve settings.
     */
    const { HOME: home = '', } = process.env;
    /**
     * Path to the global Claude Code settings file storing `effortLevel`.
     */
    const settingsPath = `${home}/.claude/settings.json`;
    /**
     * Raw JSON read from disk.
     */
    const raw = await readFile(
      settingsPath,
      'utf8',
    );
    /**
     * Resolved effort level.
     */
    const level = effortLevelFromSettings(raw,);
    return EFFORT_SYMBOLS[level] ?? '';
  }
  catch (_error: unknown) {
    return '';
  }
}

//endregion Public reader

export {
  EFFORT_SYMBOLS,
  effortLevelFromSettings,
  readEffortIndicator,
};
