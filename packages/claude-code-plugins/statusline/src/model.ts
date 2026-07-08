/**
 * Claude model display formatting.
 *
 * @module
 */

//region Defaults

/**
 * Latest versions and default context sizes per model family.
 */
const MODEL_DEFAULTS: Record<
  string,
  {
    readonly latestVersion: string;
    readonly defaultContext: string;
  }
> = {
  Opus: {
    latestVersion: '4.8',
    defaultContext: '1M',
  },
  Sonnet: {
    latestVersion: '4.6',
    defaultContext: '200K',
  },
  Haiku: {
    latestVersion: '4.5',
    defaultContext: '200K',
  },
};

/**
 * Capture `family`, optional `version`, and optional `context` from display names.
 */
// oxlint-disable-next-line no-restricted-syntax/no-regex -- bounded single-line model display string, anchored, no nested quantifiers, and named captures keep parsing readable.
const DISPLAY_NAME_RE = /^(?<family>[A-Za-z]+)(?: (?<version>\d+\.\d+))?(?: \((?<context>\S+) context\))?$/u;

//endregion Defaults

//region Model display

/**
 * Parses a Claude model display name and strips values matching defaults.
 *
 * @param raw - model display name from Claude Code
 *
 * @returns concise model display name
 *
 * @example
 * ```ts
 * formatModelDisplay('Sonnet 4.6 (1M context)');
 * ```
 */
function formatModelDisplay(raw: string,): string {
  /**
   * Captured groups from the display-name format.
   */
  const match = DISPLAY_NAME_RE.exec(raw,);
  if (match?.groups === undefined)
    return raw;

  /**
   * Captured group record from the model display name.
   */
  const { groups, } = match;
  /**
   * Parsed display-name components.
   */
  const {
    family,
    version,
    context,
  } = groups;
  if (family === undefined)
    return raw;
  /**
   * Reference values for this family.
   */
  const defaults = MODEL_DEFAULTS[family];
  /**
   * Accumulator for the trimmed display name.
   */
  let result = family;

  if ((version !== undefined) && (version !== defaults?.latestVersion))
    result += ` ${version}`;
  if ((context !== undefined) && (context !== defaults?.defaultContext))
    result += ` (${context})`;

  return result;
}

//endregion Model display

export { formatModelDisplay, };
